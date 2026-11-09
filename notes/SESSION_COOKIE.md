# Notes: Session cookies and SECRET_KEY

## The problem

HTTP has no memory. Every request reaches Flask like it's from a stranger, the server can't tell whether this request and the last one came from the same person.

So after logging in, how does the server know the next requests are yours? The answer is a **cookie**.

---

## What is a cookie?

A cookie is a small piece of data the server asks the browser to keep. From then on, the browser automatically sends it with **every request** to that site.

Like a parking ticket: the lot gives you a ticket the first time, and after that you just show the ticket and they know which car is yours.

---

## The session cookie in Flask

Flask has a built-in dict called `session`. Whatever you put in it, Flask packs into a cookie called `session` and sends it to the browser.

```
1. Log in        -> server sets session["_user_id"] = "5"
2. Server sends  -> Set-Cookie: session=eyJfdXNlcl9pZCI6IjUifQ.Zx3k...
3. Next request  -> browser sends Cookie: session=...
4. Flask reads   -> session["_user_id"] == "5" -> it's user 5
```

Flask doesn't store sessions on the server. **All the data is in the cookie, in the browser.**

---

## What Flask-Login does

Flask-Login handles logging in on top of `session`:

| Function / thing | What it does |
|---|---|
| `login_user(user)` | Puts the user's id in `session` |
| `@login_manager.user_loader` | On every request, takes the id from the cookie and loads the `User` from the database |
| `current_user` | The logged-in user (or an anonymous user if not logged in) |
| `@login_required` | Blocks a route if not logged in, calls `unauthorized_handler` |
| `logout_user()` | Removes the id from `session` |

In this project:

- `app/auth.py`: `login_user(user, remember=True)` after a successful sign up / log in.
- `app/__init__.py`: `load_user` turns the id into a `User`. `unauthorized` returns 401 for `/api/...` and redirects normal pages to `/login`.
- `app/api.py`: every query filters by `current_user.id`, so nobody can change someone else's lists.

**Only the id goes in the cookie, not the whole User.** The User is loaded from the database on every request, so if the user gets deleted, their old cookie stops working.

### `remember=True`

The `session` cookie disappears when the browser closes. `remember=True` adds a second, longer-lived cookie, `remember_token` (365 days by default), so you're still logged in after reopening the browser.

---

## What is SECRET_KEY for?

The `session` cookie is **signed, not encrypted**.

- **Not encrypted:** anyone can decode it and read `{"_user_id": "5"}`.
- **Signed:** Flask takes the data + `SECRET_KEY`, computes a signature and attaches it to the cookie.

When the cookie comes back, Flask recomputes the signature and compares:

```
Original:   {"_user_id": "5"} + correct signature   -> OK
Edited:     {"_user_id": "1"} + old signature        -> doesn't match, cookie ignored
```

To make a correct signature for new data you need `SECRET_KEY`. So:

> **SECRET_KEY stops people from CHANGING the cookie, not from READING it.**

Like a wax seal on a letter: anyone can read the letter, but change a word and the seal no longer matches.

The same idea is used for the email verification links (see `EMAIL_REMINDERS.md`).

### What if SECRET_KEY leaks?

Someone can make their own cookie `{"_user_id": "1"}` with a valid signature, which means **logging in as anyone without a password**.

Fix: change `SECRET_KEY`. Every old cookie stops matching, so everyone gets logged out (including the attacker).

### In this project (stage 7)

```python
SECRET_KEY=os.environ.get("SECRET_KEY")
```

```python
# fail loudly at startup instead of running with no key
if not app.config["SECRET_KEY"]:
    raise RuntimeError("SECRET_KEY is not set. Copy .env.example to .env and fill it in.")
```

- The key lives in `.env` (in `.gitignore`, never committed). `.env.example` only has a placeholder.
- Make a random one: `python -c "import secrets; print(secrets.token_hex(32))"`
- Use a different key on the server than on your laptop.
- An old dev key (`dev-only-change-me`) is still in the git history from before stage 7, so it must never be used anywhere real.

---

## What NOT to put in the session

Because anyone can read the cookie:

- No passwords, password hashes, tokens or private info.
- Only small, non-secret things like `user_id`.
- Cookies are limited to about 4KB, so no big data either.

---

## Cookie flags

| Flag | Meaning | Protects against |
|---|---|---|
| `HttpOnly` | JS can't read the cookie (`document.cookie` doesn't see it) | XSS: injected scripts can't steal the cookie |
| `Secure` | Cookie only sent over HTTPS | Someone listening on the network (coffee shop wifi) |
| `SameSite=Lax` | Not sent on requests (like form POSTs) that come from other websites | CSRF |

In this project (`app/__init__.py`), for both the `session` and `remember_token` cookies:

```python
SESSION_COOKIE_HTTPONLY=True,
SESSION_COOKIE_SAMESITE="Lax",
SESSION_COOKIE_SECURE=cookie_secure,
REMEMBER_COOKIE_HTTPONLY=True,
REMEMBER_COOKIE_SAMESITE="Lax",
REMEMBER_COOKIE_SECURE=cookie_secure,
```

`cookie_secure` comes from `COOKIE_SECURE` in `.env`, on by default. Set `COOKIE_SECURE=0` on your laptop, because `flask run` is `http://`, not `https://`, and a Secure cookie would never be sent, so you could never stay logged in.

### What is CSRF?

You're logged in to the to-do app. A malicious site has a hidden form that POSTs to `/logout` or sends DELETE to `/api/lists/5`. Your browser automatically attaches your cookie, so the server thinks it was you.

Two defenses in this project:

1. **`SameSite=Lax`** stops the cookie from being sent in that case.
2. **CSRF tokens** (Flask-WTF): every form has a hidden `csrf_token`, and the JS sends an `X-CSRFToken` header on every non-GET request. Another site can't read our pages, so it can't get the token.

That's also why `/logout` only accepts POST: if it accepted GET, a single `<img src="/logout">` on another site could log you out.

---

## See the real cookies

F12 -> **Application** tab -> **Cookies** -> `http://127.0.0.1:5000`:

- `session`: the HttpOnly column is ticked.
- `remember_token`: has an expiry date far in the future.

Delete `session` and `remember_token`, then reload: you get sent to `/login`.

Edit a few characters in `session`, then reload: the signature is wrong, Flask ignores the cookie, you also get sent to `/login` (if `remember_token` is deleted too).

---

## Summary

- HTTP doesn't remember anyone, cookies are how it remembers.
- Flask keeps `session` inside the cookie, in the browser.
- The cookie is **signed** with `SECRET_KEY`: readable, but not editable.
- A leaked `SECRET_KEY` = anyone can pretend to be any user. Changing the key fixes it.
- Only put `user_id` in the session, nothing secret.
- The key lives in `.env`. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` everywhere except your laptop.
