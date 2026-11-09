# Notes: Account (the ⓘ button)

## What's there?

At the bottom of the sidebar: the **display name**, a round **ⓘ** button, and **Log out**. Clicking ⓘ opens the account panel (it reuses the toast box). It has 4 sections, separated by lines:

| Section | What you can do |
|---|---|
| **Account** | See your username and when the account was created (read only) |
| **Display name** | Set the name shown in the app, up to 50 characters, anything goes (Vietnamese, emoji). Empty = show the username |
| **Email** | Add an email for reminders, see if it's verified, resend the link. See `EMAIL_REMINDERS.md` |
| **Change password** | Change your password, needs the current one |

---

## Username vs display name

| | `username` | `display_name` |
|---|---|---|
| Used for | Logging in | The sidebar, the greeting in emails |
| Unique | Yes | No, two people can have the same name |
| Can change | No | Yes |
| Characters | `a-z`, `0-9`, `_`, 3–32 characters | Anything, up to 50 |
| Required | Yes | No |

To show a name, the code uses `current_user.shown_name` = `display_name` if set, otherwise `username`.

---

## API

All of these need a logged-in user (`require_login` in `api.py`).

| Method + URL | Body | Returns |
|---|---|---|
| `GET /api/account` | | 200 `{username, displayName, email, emailVerified, timezone, createdAt}` |
| `PATCH /api/account` | `{displayName}` and/or `{timezone}` | 200, the updated account |
| `PUT /api/account/email` | `{email}` (`""` or `null` = remove) | 200, the account. May include a `warning` if the email couldn't be sent |
| `POST /api/account/email/resend` | | 204 |
| `POST /api/account/password` | `{currentPassword, newPassword}` | 204 |

`User.to_dict()` **never** includes `password_hash`.

### Errors

| Case | Code | Message |
|---|---|---|
| Name longer than 50 | 400 | `displayName must be at most 50 characters` |
| Current password wrong | **400** | `Current password is wrong` |
| New password not 8–128 characters | 400 | `New password must be 8-128 characters` |
| More than 10 password changes / hour | 429 | `Too many tries. Wait an hour and try again.` |

**Why does a wrong password return 400 and not 401?** `apiRequest` in `storage.js` treats 401 as "you got logged out" and sends you to `/login`. Getting kicked out for mistyping your old password would be awful.

**Why does changing the password need the old one?** If someone uses your computer while the app is open, they can't change your password and take over the account. The 10 / hour limit stops them guessing the old one.

### The JS can read error messages

`apiRequest` used to just throw `PATCH /api/account failed: 400`. Now it reads the server's `{"error": "..."}`:

```js
const data = await response.json().catch(() => null);
const error = new Error(data?.error || `${method} ${path} failed: ${response.status}`);
error.status = response.status;
throw error;
```

So the account panel can show the real message, like `Current password is wrong`.

---

## How the panel is built (`account.js`)

- Click ⓘ → `GET /api/account` (fresh every time, never out of date) → `buildAccountPanel(account)` builds the HTML → `showPanelToast(panel)`.
- `el(tag, props, children)`: tiny helper to create elements, saves writing `createElement` a hundred times.
- Each section is a `<form>`, so pressing Enter saves, and the browser's password manager recognizes the password fields.
- The messages under each form use `textContent`, **never `innerHTML`**, because the text comes from the server / the user (stops XSS).
- After saving the name, the sidebar text updates right away (`accountName.textContent = ...`), no reload.

### `showPanelToast` (`toast.js`)

The toast used to have 2 modes: a Yes/No question and a one-line input. This adds a third:

```js
function showPanelToast(element) {
    toastMessage.textContent = "";
    toastMessage.appendChild(element);
    openToast("", "Close");
    // the panel has its own buttons, only keep Close
    toastYes.hidden = true;
}
```

`openToast` sets `toastYes.hidden = false` again, so the other toasts still have their Yes button. `#toastMessage` changed from a `<p>` to a `<div>`, because a `<form>` isn't allowed inside a `<p>`.

---

## Logged in, pressing Back to the login page

**The bug:** log in as account 2 → press Back → the old sign up page shows → fill in account 3 → Sign up → you're still account 2, and account 3 was never created.

**Why:**

1. On Back, the browser shows the old page from its cache **without asking the server**. It looks logged out, but account 2's cookie is still there.
2. Submitting the form → the server sees you're account 2 → `redirect` to the main page, the form is ignored.

**Fixed in 2 places in `auth.py`:**

1. **Don't let the browser cache the login / sign up pages:**
   ```python
   @blueprint.after_request
   def no_store(response):
       response.headers["Cache-Control"] = "no-store"
       return response
   ```
   On Back, the browser has to ask the server again → `/login` sees you're logged in → main page.
2. **`already_logged_in(mode)`:** just opening the page (GET) still goes to the main page. But **submitting the form** (POST) while logged in now shows *"You're already logged in as X. Log out first to use another account."* with a Log out button, instead of silently ignoring it.

---

## Where the code is

| Part | File |
|---|---|
| `display_name` column, `shown_name`, `User.to_dict()` | `app/models.py` |
| The `/api/account...` routes | `app/api.py`, the `# ACCOUNT` section |
| `no_store`, `already_logged_in` | `app/auth.py` |
| Name + ⓘ button in the sidebar | `app/templates/index.html`, `.sidebarFooter` |
| The account panel | `app/static/scripts/account.js` |
| `showPanelToast` | `app/static/scripts/toast.js` |
| Account panel CSS (`.accountPanel`) | `app/static/styles/toast.css` |
| ⓘ button CSS (`.accountInfoButton`) | `app/static/styles/sidebar.css` |

---

## Not done yet

- **Changing the password doesn't log out other devices.** The "remember me" cookie on another device keeps working. To fix it, store a "session version" in `users`, bump it on password change, and old cookies stop matching.
- **Forgot password.** Possible now that verified emails exist: send a reset link, built the same way as the verification link.
