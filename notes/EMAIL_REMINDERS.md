# Notes: Email, email verification and reminders

## Overview

1. A user adds an email in the account panel (the ⓘ button). Email is **optional**.
2. The app sends a **verification link**. Clicking it marks the email as verified.
3. Once a day, **GitHub Actions** calls the app. For everyone with a verified email, the app sends **one email** listing their unfinished tasks due **tomorrow**.

Emails go out through **Brevo** (free for 300 emails/day, can send from a Gmail address, no domain needed).

---

## Why verify the email?

- One typo and the reminders go to a stranger.
- Without verification, anyone could enter someone else's email and the app becomes a spam tool.

So **reminders only go to verified emails** (`email_verified_at` is not `NULL`).

---

## How the verification link works

The link looks like `/verify-email/<token>`. The token is made in `mailer.py`:

```python
URLSafeTimedSerializer(SECRET_KEY, salt="verify-email").dumps({"uid": user.id, "email": user.email})
```

- **Signed with `SECRET_KEY`:** same idea as the session cookie (see `SESSION_COOKIE.md`). Anyone can read what's inside, but change one character and the signature breaks. Nobody can make a verification link for someone else's email.
- **Has the creation time inside:** `loads(token, max_age=24h)` rejects links older than 24 hours.
- **Has the email inside:** after changing your email, old links stop working (`user.email != data["email"]`).
- **`salt="verify-email"`:** so this token can't be reused anywhere else that's also signed with `SECRET_KEY` (a future password reset link would use a different salt).
- **No login needed to click it:** you might open the email on your phone. The token already proves it's yours.

| Case | Result |
|---|---|
| Valid link, not expired | "Email verified" page |
| Edited link | 400, "Link doesn't work" |
| Link older than 24 hours | 400, same |
| Email changed after the link was sent | 400, same |
| Clicking the link twice | Still says verified, nothing changes |

---

## Sending email: Brevo

`send_email(to, subject, text)` in `mailer.py` sends one request to Brevo's API:

```text
POST https://api.brevo.com/v3/smtp/email
header: api-key: <BREVO_API_KEY>
body:   { sender, to, subject, textContent }
```

It uses Python's built-in `urllib.request`, no extra library.

**No `BREVO_API_KEY`** (on your laptop): nothing is sent, the email is **printed in the `flask run` terminal** instead. So verification and reminders can be tested without a Brevo account.

### Send limit

`PUT /api/account/email` and `POST /api/account/email/resend` **share** a limit of 5 / hour / user (`limiter.shared_limit`). Without it, someone could use the app to spam any address.

---

## Reminders

### Who triggers them?

```text
GitHub Actions (every day at 13:00 UTC)
   -> POST https://<app>/internal/send-reminders
      header: Authorization: Bearer <REMINDER_TOKEN>
   -> send_due_reminders() in reminders.py
   -> Brevo sends the emails
```

- **Why not let the app schedule it itself?** Render's free plan puts the app to sleep when nobody uses it, and a sleeping app can't run anything. A request from GitHub Actions wakes it up. Render Cron Jobs cost money.
- **13:00 UTC** = morning in Canada, evening in Vietnam. "Tomorrow" is worked out in each user's own timezone, not the server's.
- `curl --retry 3 --retry-delay 30`: the free Render app takes up to about a minute to wake up, the first try can fail.

### Protecting the URL

Anyone can call `/internal/send-reminders`, so it needs its own secret, `REMINDER_TOKEN`:

- Wrong or missing token → **404**, pretend the URL doesn't exist.
- The token is compared with `hmac.compare_digest`, not `==`. `==` stops at the first wrong character, so by timing the response you could guess the token one character at a time. `compare_digest` always takes the same time.
- This route has **no CSRF** (`csrf.exempt`), because GitHub Actions has no page to get a CSRF token from. The token in the header does that job instead.
- If `REMINDER_TOKEN` isn't set, the route always returns 404, so it's off.

### What `send_due_reminders()` does

For each user with a verified email:

1. Work out "tomorrow" in `user.timezone` (UTC if not set).
2. Find tasks that: are in the user's lists, are **not completed**, have `due_date` = tomorrow, and haven't been reminded for that date (`reminded_for` != `due_date`).
3. If there are any, send **one** email listing them all, for example:
   ```text
   2 tasks due tomorrow

   Hi Hùng,

   These are due tomorrow (Nov 10):

   - Essay (School)
   - Quiz (School)
   ```
4. If it sent, set `reminded_for = due_date` on those tasks.

- **Sending fails for one person** (bad address, Brevo error): log it, **don't** set `reminded_for`, move on to the next person. The next run tries again.
- **Running twice in a day:** the second run sends nothing, thanks to `reminded_for`.
- **Due date changed after a reminder:** `reminded_for` no longer equals `due_date`, so the new date gets reminded.

### Timezone

`account.js` runs `syncTimezone()` every time the page opens: it gets the browser's timezone with `Intl.DateTimeFormat().resolvedOptions().timeZone` (e.g. `"America/Toronto"`), and if it's different from what the server has, sends `PATCH /api/account {timezone}`.

The server checks it with `ZoneInfo(value)` and returns 400 if it's not a real timezone. Python on Windows has no timezone data built in, so the `tzdata` package is needed (it's in `requirements.txt`).

---

## Setup when deploying

### 1. Brevo

1. Sign up at brevo.com.
2. **Senders** → add your Gmail → click the link Brevo sends to confirm it.
3. **SMTP & API → API keys** → create a key.

### 2. Environment variables on Render

| Variable | Value |
|---|---|
| `BREVO_API_KEY` | The key you just made |
| `MAIL_SENDER` | The Gmail you confirmed in Brevo |
| `MAIL_SENDER_NAME` | Optional, defaults to `To-do List` |
| `REMINDER_TOKEN` | A random string: `python -c "import secrets; print(secrets.token_hex(32))"` |

If `BREVO_API_KEY` is set but `MAIL_SENDER` isn't, the app stops at startup, so you find out right away instead of every email failing.

### 3. GitHub secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `APP_URL` | The Render URL, e.g. `https://todo-xxx.onrender.com` (no `/` at the end) |
| `REMINDER_TOKEN` | **Exactly** the same value as on Render |

Until `APP_URL` exists, the workflow skips itself instead of failing every day. Test it right away: **Actions → Due date reminders → Run workflow**.

---

## Testing on your laptop (no Brevo needed)

1. Leave `BREVO_API_KEY` empty in `.env`. Run `flask run`.
2. Open ⓘ → enter an email → **Save email**. The verification link shows up in the terminal → open it.
3. Create a task due **tomorrow**.
4. Run `flask send-reminders` → the reminder email shows up in the terminal, plus `emails sent: 1`.
5. Run `flask send-reminders` again → `emails sent: 0`.

---

## Things to know

- **Emails might go to spam:** they say they're from `@gmail.com` but Brevo sends them, and Gmail/Outlook are suspicious of that. The real fix is owning a domain and verifying it in Brevo.
- **On Render the verification link starts with `http://`** until `ProxyFix` is added (stage 10), because Flask doesn't know the real request was HTTPS. The link still works because Render redirects to `https://`.
- **GitHub can run scheduled jobs late**, from a few minutes to tens of minutes when it's busy. For "due tomorrow" reminders that's fine.

---

## Where the code is

| Part | File |
|---|---|
| `email`, `email_verified_at`, `timezone`, `reminded_for` columns | `app/models.py` |
| `send_email`, tokens, `send_verification_email` | `app/mailer.py` |
| The `/verify-email/<token>` route | `app/auth.py`, `verify_email()` |
| The page after clicking the link | `app/templates/verify.html` |
| `PUT /api/account/email`, `/resend`, timezone check | `app/api.py`, the `# ACCOUNT` section |
| `send_due_reminders`, `/internal/send-reminders`, the `flask send-reminders` command | `app/reminders.py` |
| `BREVO_API_KEY`, `MAIL_SENDER`, `REMINDER_TOKEN` config | `app/__init__.py`, `.env.example` |
| The daily schedule | `.github/workflows/reminders.yml` |
| The Email section of the account panel, `syncTimezone()` | `app/static/scripts/account.js` |
