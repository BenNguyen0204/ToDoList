# Notes: Rate limiting with Flask-Limiter

## What is rate limiting?

Limiting how many times someone can call a route in a period of time. For example: "at most 5 logins per minute".

Go over it and Flask returns **429 Too Many Requests**, the route doesn't run.

Like an ATM: enter the wrong PIN 3 times and the card gets locked.

---

## What this project uses

**Flask-Limiter 4.1.1** is installed (the general examples further down were written for version 3, but the parts used here work the same).

| Route | Limit | Counted per | File |
|---|---|---|---|
| `POST /login` | 10 / minute | username | `auth.py` |
| `POST /login` | 30 / minute | IP | `auth.py` |
| `POST /register` | 10 / hour | IP | `auth.py` |
| `POST /api/account/password` | 10 / hour | logged-in user | `api.py` |
| `PUT /api/account/email` + `POST /api/account/email/resend` | 5 / hour, **shared** | logged-in user | `api.py` |

- **Blocked on the login / sign up page:** `too_many_attempts` in `auth.py` shows the message right on the form.
- **Blocked on `/api/...`:** returns JSON `{"error": "..."}` (429 is in `register_error_handlers`). The message comes from `error_message=...`, otherwise it would say `10 per 1 hour`.
- **`limiter.shared_limit`:** the 2 routes that send email share one counter, so you can't get around it by alternating between them. Without this limit, anyone could use the app to spam any email address.
- **Counting per user** (`f"pw:{current_user.id}"`): Flask-Limiter checks **before** `require_login` runs, so there might not be a user yet. The key function falls back to the IP if nobody is logged in.
- Counts are kept in memory (`RATELIMIT_STORAGE_URI="memory://"`), which is why Render runs 1 worker (stage 10).

---

## Why it's needed

Without a limit, `/login` lets you try passwords **forever**. An attacker writes a script that tries thousands of passwords for user `ben` until one works. That's called **brute force**.

- `generate_password_hash` is slow on purpose, so each try takes longer, but that **doesn't stop it**.
- Rate limiting does: after a few wrong tries, every extra try just gets 429.

| Route | Why |
|---|---|
| `POST /login` | Stops password guessing |
| `POST /register` | Stops mass fake accounts |
| `POST /api/account/password` | Stops guessing the current password from an open tab |
| Email routes | Stops the app being used to spam |

---

## Install

```powershell
pip install Flask-Limiter
pip freeze | Set-Content -Encoding ascii requirements.txt
```

---

## How to use it

Same pattern as `db`, `migrate`, `login_manager`: create it in `extensions.py`, attach it in `create_app()`.

```python
# extensions.py
from flask_limiter import Limiter

def client_ip():
    return request.remote_addr or "127.0.0.1"

# key_func: what to count by. default here = IP
limiter = Limiter(key_func=client_ip)
```

```python
# __init__.py, inside create_app()
limiter.init_app(app)
```

```python
# auth.py
@blueprint.route("/login", methods=["GET", "POST"])
# only POSTs count, just opening the page doesn't
@limiter.limit("30 per minute", methods=["POST"])
def login():
    ...
```

### Writing limits

| String | Meaning |
|---|---|
| `"5 per minute"` | 5 / minute |
| `"10 per hour"` | 10 / hour |
| `"100 per day"` | 100 / day |
| `"5/minute;50/day"` | Both at once, going over either one blocks |

### What is `key_func`?

Every key value gets **its own counter**.

```
key = IP           -> 1.2.3.4 has its own counter, 5.6.7.8 has its own
key = username     -> "ben" has its own counter, "hung" has its own
```

---

## Per IP or per username?

| Counted per | Stops | Weak spot |
|---|---|---|
| **IP** | One machine trying lots of accounts | Changing IPs (VPN, botnet) gets around it. Also, lots of people can share one IP (school wifi) |
| **Username** | Trying lots of passwords on **one** account, no matter how many IPs | An attacker can type wrong on purpose to lock someone else out for a bit |

The goal is protecting **accounts**, so the main limit is per **username**. A per-IP limit on top stops one machine from spamming too much. **Use both** (this is what `auth.py` does):

```python
def username_key():
    # lowercase like read_form(), so "Ben" and "ben" share one counter
    return "user:" + (request.form.get("username", "").strip().lower() or client_ip())

@blueprint.route("/login", methods=["GET", "POST"])
# per account
@limiter.limit("10 per minute", methods=["POST"], key_func=username_key)
# per IP
@limiter.limit("30 per minute", methods=["POST"])
def login():
    ...
```

Remember `lower()`. Without it, an attacker tries `Ben`, `BEN`, `bEn`... and each one gets a fresh counter, even though it's all the same account.

### Only counting WRONG logins (not used yet)

By default every POST counts, including correct logins. You can count only failures:

```python
@limiter.limit(
    "10 per hour",
    key_func=username_key,
    methods=["POST"],
    # wrong login -> page rendered again -> 200. right login -> redirect -> 302
    deduct_when=lambda response: response.status_code == 200,
)
```

---

## When someone gets blocked (429)

Flask-Limiter's default 429 page is ugly. This project catches it on the auth blueprint and shows it on the form:

```python
@blueprint.errorhandler(429)
def too_many_attempts(error):
    mode = "register" if request.endpoint == "auth.register" else "login"
    flash("Too many attempts. Wait a minute and try again.")
    return render_template("auth.html", mode=mode, username=""), 429
```

For `/api/...`, 429 is in the `for code in (...)` loop in `register_error_handlers`, so it comes back as JSON.

---

## When deploying

### 1. Where are the counts kept?

By default in **memory** (`memory://`):

- Restart the server -> all counts are gone.
- Gunicorn with several workers -> each worker counts separately. With 4 workers people effectively get 4x the tries.

In production, Redis lets every worker share one counter:

```python
limiter = Limiter(key_func=client_ip, storage_uri="redis://localhost:6379")
```

For now this project uses `memory://` and 1 worker.

### 2. Behind a proxy

Render, Heroku, nginx... all sit between the user and Flask. The IP Flask sees is **the proxy's IP**, so everyone shares one per-IP counter: one person spamming blocks everyone.

Fix it with `ProxyFix`, which reads the real IP from the `X-Forwarded-For` header (stage 10):

```python
from werkzeug.middleware.proxy_fix import ProxyFix
# 1 = there's 1 proxy in front
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)
```

Don't turn on `ProxyFix` when there's **no** proxy: then anyone can send a fake `X-Forwarded-For` to change their IP.

### 3. In tests

Turn the limiter off, otherwise tests that call `/login` many times get 429:

```python
app.config["RATELIMIT_ENABLED"] = False
```

---

## Try it yourself

1. Log in with a wrong password 11 times in a row.
2. The 11th try shows "Too many attempts".
3. Wait a minute and it works again.

---

## Summary

- Rate limit = cap on how often a route can be called, over the cap gets 429.
- Used on `/login`, `/register`, password change and the email routes.
- `key_func` decides what to count by. Login uses **both username and IP**.
- `lower()` the username, or changing upper/lower case gets around it.
- Deploying: Redis for shared counts, `ProxyFix` behind a proxy.
- Tests: `RATELIMIT_ENABLED=False`.
