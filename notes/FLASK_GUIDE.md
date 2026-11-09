# Guide (basic version): from a JavaScript app to a Flask app running on a server

Starting point: the app runs entirely in the browser, data is in `localStorage`.

Goal: a Flask app with accounts, data in PostgreSQL, deployed on Render + Neon, usable on any device.

**Status:** stages 0–7 are done ✅, plus extras (phone layout, account panel, email reminders). Next up: stage 8 (tests), then 9–10 (PostgreSQL and deploy).

**How to use this file:** go in order. Each stage has a **Goal**, **To do** and **Check yourself**. Only move on once the check passes. The code here is just short hints, write the rest yourself. Tick `[x]` when done and commit after each stage.

This is the short version: only what's needed for the app to work, be reasonably secure and go on a resume. Advanced stuff is at the end, for later.

## The big picture

```
Before:  Browser (HTML/CSS/JS) <-> localStorage

Goal:    Browser (HTML/CSS/JS) <-> Flask API <-> PostgreSQL
         Phone                 <-/   (Render)     (Neon)
```

Folder structure when done:

```
ToDoList/
├── app/
│   ├── __init__.py      # create_app(): creates and configures the app
│   ├── extensions.py    # db, migrate, login_manager, csrf, limiter
│   ├── models.py        # the database tables
│   ├── pages.py         # returns HTML pages
│   ├── api.py           # JSON API
│   ├── auth.py          # sign up, log in, log out, verify email
│   ├── mailer.py        # sending email (Brevo)
│   ├── reminders.py     # daily "due tomorrow" emails
│   ├── templates/       # index.html, auth.html, verify.html
│   └── static/          # images/, scripts/, styles/
├── migrations/          # generated, history of database changes
├── .github/workflows/   # reminders.yml
├── tests/
├── wsgi.py              # the app's entry point
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## Stage 0: Setup ✅

**Goal:** a separate Python environment and a Git setup that keeps `main` working.

- [x] Create a virtual environment. On this machine plain `python` doesn't work outside it, so use `py`:
  ```powershell
  py -m venv .venv
  .venv\Scripts\activate
  ```
  If it says "running scripts is disabled", run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and activate again. Inside the venv, `python` and `pip` work normally.
- [x] Create `.gitignore` with: `.venv/`, `__pycache__/`, `*.pyc`, `.env`, `instance/`, `.pytest_cache/`.
- [x] Install Flask: `pip install flask python-dotenv`, then write `requirements.txt`.

**Check yourself:** `git status` doesn't show `.venv`. The prompt starts with `(.venv)`.

**Understand:** what's a virtual environment? Why commit `requirements.txt` but not `.venv`?

---

## Stage 1: First Flask app ✅

**Goal:** a server that answers the browser.

- [x] Create `app/__init__.py` with a `create_app()` function. It creates `Flask(__name__)`, adds a `/` route that returns "Hello", then `return app`.
- [x] Create `wsgi.py`:
  ```python
  from app import create_app

  app = create_app()
  ```
- [x] Run: `flask --app wsgi run --debug`

**Check yourself:** open http://127.0.0.1:5000 and see "Hello". Change the text, save, reload, see the change.

**Understand:** what's a route? What does `--debug` do, and why must it never be on in production?

---

## Stage 2: Flask serves the frontend ✅

**Goal:** the app works exactly like before but through Flask. Data is still in `localStorage`.

- [x] Use `git mv` to move `images/`, `scripts/`, `styles/` into `app/static/`, and `index.html` into `app/templates/`. **Commit right after moving, before changing anything** (`Move frontend files into Flask folders`), so Git sees it as a move and keeps each file's history. Paths will break for a bit, the next steps fix them.
- [x] Create `app/pages.py` with a Blueprint whose `/` route calls `render_template("index.html")`. Register the Blueprint in `create_app()`.
- [x] In `index.html`, switch every path to `url_for`:
  ```html
  <link rel="stylesheet" href="{{ url_for('static', filename='styles/base.css') }}" />
  ```
- [x] The JS has image paths like `"images/edit.png"`. JS files don't go through Jinja so they can't use `url_for`, change them to `"/static/images/edit.png"`.
- [x] Change `<title>Document</title>` to the app's name.

**Check yourself:** DevTools → Network tab, reload: no 404s. Every old feature still works, including the edit and delete icons.

**Note:** `localStorage` is separate per address. Data from opening `index.html` directly won't show up at `127.0.0.1:5000`. That's normal, not a bug.

**Commit:** `Serve frontend through Flask`

---

## Stage 3: Database and migrations ✅

**Goal:** `lists` and `tasks` tables, created by a migration. SQLite for now to keep it simple.

- [x] Install `flask-sqlalchemy flask-migrate`.
- [x] Create `app/extensions.py` with `db = SQLAlchemy()` and `migrate = Migrate()`. Call `init_app(app)` in `create_app()`. A separate file avoids circular imports.
- [x] **Required for SQLite:** use `migrate = Migrate(render_as_batch=True)`, and give `db` a constraint naming convention:
  ```python
  from sqlalchemy import MetaData

  convention = {
      "ix": "ix_%(column_0_label)s",
      "uq": "uq_%(table_name)s_%(column_0_name)s",
      "ck": "ck_%(table_name)s_%(constraint_name)s",
      "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
      "pk": "pk_%(table_name)s",
  }
  db = SQLAlchemy(metadata=MetaData(naming_convention=convention))
  ```
  SQLite can't add a foreign key to an existing table. Without these 2 things, the stage 6 migration (adding `user_id` to `lists`) fails, even after deleting the database.
- [x] Config: `SQLALCHEMY_DATABASE_URI = "sqlite:///todo.db"`.
- [x] Write `app/models.py` with this design:

  | `lists` table | Type |
  | --- | --- |
  | `id` | Integer, primary key |
  | `name` | String(100), required |

  | `tasks` table | Type |
  | --- | --- |
  | `id` | Integer, primary key |
  | `list_id` | Foreign key to `lists.id`, required, `ondelete="CASCADE"` |
  | `text` | String(500), required |
  | `completed` | Boolean, default False |
  | `color` | String(7), optional |
  | `due_date` | Date, optional |
  | `position` | Integer, drag and drop order |

- [x] Declare the one-to-many relationship with `db.relationship`, with `cascade="all, delete-orphan"` and tasks ordered by `position`.
- [x] Add a `to_dict()` to each model. The JS uses the name `dueDate`, so return exactly that.
- [x] Create the first migration. `create_app()` has to import the models or `migrate` won't see the tables:
  ```powershell
  flask --app wsgi db init
  flask --app wsgi db migrate -m "Create lists and tasks"
  flask --app wsgi db upgrade
  ```

**Check yourself:** open the file in `migrations/versions/` and read `upgrade()` and `downgrade()`. `db downgrade` then `db upgrade` both work.

**Understand:** what's a foreign key? What does `cascade` do when a list is deleted? Why does the database assign `id` instead of `Date.now()` like the JS did? (Hint: `Date.now()` is a 13-digit number, a Postgres Integer only goes up to about 2.1 billion. SQLite doesn't complain, so the bug only shows up on the server.)

**Commit:** `Add database models and first migration`

---

## Stage 4: REST API ✅

**Goal:** every data operation through a URL that returns JSON. Don't touch the JS yet.

- [x] Create `app/api.py` with a Blueprint, registered with `url_prefix="/api"`.
- [x] Write the routes:

  | Method | URL | What it does | Success |
  | --- | --- | --- | --- |
  | GET | `/api/lists` | All lists with their tasks | 200 |
  | POST | `/api/lists` | Create a list `{name}` | 201 |
  | PATCH | `/api/lists/<id>` | Rename | 200 |
  | DELETE | `/api/lists/<id>` | Delete a list | 204 |
  | POST | `/api/lists/<id>/tasks` | Create a task `{text, color, dueDate}` | 201 |
  | PUT | `/api/lists/<id>/order` | Reorder `{taskIds: [...]}` | 204 |
  | PATCH | `/api/tasks/<id>` | Change the fields that were sent | 200 |
  | DELETE | `/api/tasks/<id>` | Delete a task | 204 |

- [x] **Never trust client data.** Write reusable check functions, and `abort(400, "reason")` when something's wrong:
  - Names and text are strings, not empty after `strip()`, not too long.
  - Colors look like `#rrggbb`.
  - Dates are read with `date.fromisoformat()`, catching both `TypeError` and `ValueError`.
  - `completed` must be a real boolean.
- [x] **PATCH only changes fields in the request:** use `if "color" in data:`. That way `{"color": null}` removes the color, and not sending `color` keeps it.
- [x] A new task's `position` = the current highest + 1.
- [x] The reorder route has to handle unknown or missing ids, because another device might have just added or deleted a task.
- [x] Add error handlers for 400, 404 and 405 so the API always returns JSON, not HTML. Note: a handler on the Blueprint can't catch a 404 for a URL that doesn't exist (e.g. `/api/abc`), because that request doesn't belong to any Blueprint. Register it on the app (`app.register_error_handler`), return JSON when `request.path` starts with `/api/`, and the normal error page otherwise.

**Check yourself:** open the app, F12 → Console, call each API:
```js
await fetch("/api/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test" })
}).then(r => r.json())
```
Try the bad cases too: empty name, color `"red"`, an id that doesn't exist. You must get 400 or 404, never 500.

**Understand:** PUT vs PATCH? Why 201 and 204 instead of always 200?

**Commit:** `Add REST API for lists and tasks`

---

## Stage 5: Connect the JavaScript to the API ✅

**Goal:** no more `localStorage` for data. This is the hardest part, do one feature at a time.

**Important design decision:** don't keep something like `saveLists(lists)` that sends the whole array. If the tab on computer A is out of date, it would overwrite what you just did on your phone. Each action sends exactly one change.

- [x] Rewrite `storage.js`, remove `getLists`, `saveLists`, `migrateOldTasks`:
  - `apiRequest(method, path, body)` calls `fetch`, throws when `!response.ok`, and handles 204 separately because there's no JSON.
  - `apiSave(method, path, body)` wraps `apiRequest`, catches errors and tells the user with `showToast`.
  - `loadList()` calls `GET /api/lists`.
- [x] Change `main.js`: `lists` starts as `[]`, `await loadList()` before rendering. Stop the server to see how errors are handled.
- [x] **Tasks:** thanks to the earlier refactor, every task change is in the 4 functions in `taskActions.js`. Only change the inside of those 4, rendering, popups and filters stay the same:
  - [x] `addTask`: wait for the server to return the task (with the server's `id`) before adding it. In `submitNewTask` in `taskRender.js`, the input is cleared before `addTask` is called, so pressing Enter twice doesn't create a duplicate.
  - [x] `updateTask(id, changes)`: update the UI first, then send `PATCH /api/tasks/<id>` with exactly `changes`. Removing a color or date sends `null`.
  - [x] `deleteTask`: send `DELETE /api/tasks/<id>`.
  - [x] `reorderTasks`: keep the `slots` logic, then send `PUT /api/lists/<id>/order` with `taskIds` = the ids of **all** tasks in the new order.
- [x] **Lists** (in `sidebar.js`):
  - [x] Create a list: wait for the server before adding it, the server assigns the `id`.
  - [x] Rename and delete lists. Careful: `sidebar.js` has a local function called `save` in the rename code, which clashes if your global function is also called `save`. Rename one of them.
- [x] Keep `localStorage` for `theme`, `sortOrder`, `currentListId`. Those are per-device preferences, no need to store them on the server.
- [x] Refresh when coming back to the tab: listen for `visibilitychange` and call `loadList()` again. Skip it if a save is still in progress, or old data could overwrite the change you just made.

**About old `id`s:** data in `localStorage` used `id: Date.now()`. From now on the database assigns `id`s, so the old `localStorage` data isn't used anymore. The app starts empty, that's normal.

**Two old bugs (drag and drop while filtering lost tasks, Escape while renaming a list still saved) were fixed during the refactor.** When switching to the API, don't lose those fixes: keep the `slots` logic in `reorderTasks` and the `finished` flag in `sidebar.js`.

**Check yourself:**
- Do each action, reload, the data is still there.
- Two windows: add a task in A, switch to another tab and back in B, the new task shows up.
- Filter "Active", drag and drop, clear the filter: no tasks lost.
- Stop the server and do something: there's an error message, the app doesn't freeze.

**Understand:** how does `async/await` work? What's good about "update the UI first, save after", and what do you do when the save fails?

**Commit:** `Save list and task changes through the API`

---

## Stage 6: User accounts ✅

**Goal:** everyone only sees their own data. Without this anyone with the link can read and delete everything, so **don't skip it**, even in the basic version.

- [x] Install `flask-login`.
- [x] Add a `User` model: `id`, `username` (unique, max 32 characters), `password_hash` (String 255), `created_at`.
- [x] Add `user_id` to `TodoList`, a required foreign key to `users.id`.
- [x] Create the migration and **read the generated file carefully**. If `lists` already has data, adding a required column fails because the old rows have no value. With test data the easy way out is deleting `instance/todo.db` and running `db upgrade` again.
- [x] Create `app/auth.py` with these routes:
  - `/register`: check the username and password (at least 8 characters), store it with `generate_password_hash`. Never store the real password.
  - `/login`: compare with `check_password_hash`, then `login_user(user, remember=True)`.
  - `/logout`: must be POST, so a link or image on another site can't log you out.
- [x] Lowercase the username before saving and before looking it up.
- [x] Catch `IntegrityError` for a duplicate username, instead of only checking first, because two requests can arrive at the same time.
- [x] Create `templates/auth.html` shared by both pages, show errors with `flash`.
- [x] Add `@login_required` to `/`. For the whole API, use `before_request` on the Blueprint.
- [x] Write `unauthorized_handler`: `/api/...` returns JSON 401, everything else redirects to `/login`. In the JS, a 401 sends you to `/login`.
- [x] **Most important:** looking up a list or task must always include the current user:
  ```python
  db.select(TodoList).filter_by(id=list_id, user_id=current_user.id)
  ```
  Tasks have no `user_id`, so `join` through `TodoList`. Put it in `get_list_or_404` and `get_task_or_404` so no route can forget it. Add a log out button and the username to the sidebar.

**Check yourself:**
- Logged out: `/` redirects to `/login`, `/api/lists` returns 401.
- Make accounts A and B. B calling `PATCH /api/tasks/<A's id>` must get 404. Try every route.

**Understand:** why hash passwords instead of encrypting them? Why return 404 instead of 403 for someone else's data? This bug is called IDOR and comes up a lot in interviews. How do sessions and cookies work? (See `SESSION_COOKIE.md`.)

**Commit:** `Add user accounts with register, login and logout`

---

## Stage 7: Config and security ✅

**Goal:** no secrets in the code, ready to be public.

- [x] **SECRET_KEY:** read it from an environment variable, `raise` at startup if it's missing. Never hardcode it. Make a random one:
  ```powershell
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- [x] Create `.env` (never committed) and `.env.example` (committed, placeholder values only).
- [x] **Cookies:** turn on `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE="Lax"`, `SESSION_COOKIE_SECURE`, and the matching `REMEMBER_COOKIE_*` settings.
- [x] Secure cookies are only sent over HTTPS, so on your laptop you'd log in and get bounced back to the login page. Read a `COOKIE_SECURE` variable, on by default, and set `COOKIE_SECURE=0` in `.env`.
- [x] **CSRF:** install `flask-wtf`, create `CSRFProtect` in `extensions.py` and `init_app(app)`.
  - HTML forms (sign up, log in, log out) get `<input type="hidden" name="csrf_token" value="{{ csrf_token() }}" />`.
  - The main page gets `<meta name="csrf-token" content="{{ csrf_token() }}" />`. In `apiRequest`, the JS reads it and sends it in an `X-CSRFToken` header on every non-GET request.
  - Set `WTF_CSRF_TIME_LIMIT = None`. By default tokens expire after 1 hour, so a tab left open would stop saving.
- [x] **Login limit:** install `flask-limiter`, allow 10 per minute on `/login`, **counting only POSTs**: `@limiter.limit("10 per minute", methods=["POST"])`. Without `methods`, just opening the login page (GET) counts too. On Render the IP can be the proxy's, so limit by username (a `key_func` that reads the username from the form). See `RATE_LIMIT.md`.
- [x] **Closing sign ups:** add a `REGISTRATION_OPEN` variable, so once your account exists strangers can't make more.

**Check yourself:**
- Delete `.env` and the app gives a clear error on startup. Logging in on your laptop still works with `COOKIE_SECURE=0`.
- A `fetch` POST in the Console without the `X-CSRFToken` header gets 400. Everything in the app still saves.
- 11 wrong passwords in a row gets 429.

**Understand:** what's `SECRET_KEY` for? What's CSRF and how does a `SameSite` cookie help? What attack does `HttpOnly` stop? Why rate limit by username and not just IP?

**Commit:** `Harden login: env config, CSRF, rate limits, secure cookies`

---

## Stage 8: A few important tests

**Goal:** tests for the things most likely to break. No need to test everything.

- [ ] Install `pytest`, create `tests/test_app.py`.
- [x] `create_app` takes a `test_config=None` parameter. If given, `app.config.update(test_config)`, and this has to run **before** the `SECRET_KEY` check, or tests fail with a missing `SECRET_KEY`. (Already done in stage 7.)
- [ ] Write a fixture that makes the app with `create_app({...})`: temporary database (use `tmp_path`), `TESTING=True`, any `SECRET_KEY`, CSRF off (`WTF_CSRF_ENABLED=False`) and rate limiting off (`RATELIMIT_ENABLED=False`), then `db.create_all()`.
- [ ] Write about 4 tests:
  - [ ] Logged out, `/api/lists` returns 401.
  - [ ] Sign up, log in, then the API works.
  - [ ] Create, edit, delete a task.
  - [ ] **User B can't edit or delete user A's task** (gets 404).

**Check yourself:** `pytest` all green. Temporarily remove `user_id=current_user.id` from `get_list_or_404`: the last test must go red. If it stays green, the test isn't checking the right thing.

**Commit:** `Add basic tests`

---

## Stage 9: Switch to PostgreSQL

**Goal:** the code works with a real database, not just SQLite.

- [ ] Install `psycopg[binary]`.
- [ ] Read `DATABASE_URL` from an environment variable, fall back to SQLite if it's not set.
- [ ] Services give URLs like `postgresql://...` or `postgres://...`, but SQLAlchemy needs to know the driver. Write a function that changes the start to `postgresql+psycopg://`.
- [ ] Set `SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 300}`. Neon shuts the database down when idle, so the connection has to be checked before use.
- [ ] On Neon, create a project just for this app (don't share it with another project). Put the connection string in `DATABASE_URL` in `.env`, run `flask --app wsgi db upgrade`, then use the app locally.

**Check yourself:** open the SQL Editor on Neon, run `select * from tasks;` and see the task you just made locally.

**Commit:** `Support PostgreSQL`

---

## Stage 10: Deploy to Render + Neon

**Goal:** a public link. Render's and Neon's dashboards might look a bit different from what's described here.

- [ ] Install `gunicorn`, then update `requirements.txt` with every library you use. See the installed versions with `pip freeze`.
- [ ] Add a `/healthz` route that returns `{"status": "ok"}`, so Render knows the app is alive.
- [ ] Add `ProxyFix` in `create_app()`. Render handles HTTPS and forwards to the app, without it Flask thinks every request is HTTP:
  ```python
  app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
  ```
- [ ] Update `README.md`: remove "open `index.html`", add the demo link, how to run it, and the new features.
- [ ] Push `main` to GitHub. Check `.env` isn't committed:
  ```powershell
  git ls-files | Select-String "\.env"
  ```
  Only `.env.example` should show up.
- [ ] **Render:** **New > Web Service**, pick the repo, Free plan, then fill in:

  | Field | Value |
  | --- | --- |
  | Build Command | `pip install -r requirements.txt` |
  | Start Command | `flask --app wsgi db upgrade && gunicorn wsgi:app --workers 1 --threads 4 --bind 0.0.0.0:$PORT` |
  | Health Check Path | `/healthz` |

- [ ] Environment variables on Render:

  | Variable | Value |
  | --- | --- |
  | `SECRET_KEY` | A new random string, different from your laptop's |
  | `DATABASE_URL` | Neon's connection string. Keep it secret, it contains the password |
  | `PYTHON_VERSION` | `3.13.5`, or whatever version you use |
  | `BREVO_API_KEY`, `MAIL_SENDER`, `REMINDER_TOKEN` | For emails, see `EMAIL_REMINDERS.md` |

- [ ] Add the `APP_URL` and `REMINDER_TOKEN` secrets on GitHub for the daily reminders (see `EMAIL_REMINDERS.md`).
- [ ] Deploy and read the Logs tab. If something fails, read the last error line first.

**Why it's like this:**
- `gunicorn` instead of `flask run`, because Flask's dev server isn't made for production. Gunicorn doesn't run on Windows, so locally you still use `flask run`.
- `db upgrade` runs before `gunicorn`, so the database always matches the code.
- `--workers 1` because the Free plan has little RAM, and the rate limit counts are kept in each worker's memory. With several workers each one counts separately and the limits get multiplied.

**Check yourself after deploying:**
- [ ] Open the link, see the login page, the address bar shows HTTPS.
- [ ] Make an account, add a task, reload.
- [ ] Log in on your phone over mobile data, see the same data.
- [ ] Set `REGISTRATION_OPEN=0` on Render. Signing up is blocked, logging in still works.
- [ ] Add an email, verify it, make a task due tomorrow, run the workflow by hand, get the email.

**Note:** the Free plan sleeps when nobody uses it, so the first visit can take up to a minute. Check Render's and Neon's current limits, they can change.

**Commit:** `Deploy to Render`

---

## Every update after that

1. Change the code, test it locally, run `pytest`.
2. If `models.py` changed, make a migration and read the generated file.
3. Commit to `main` and push. Render deploys and runs the migration by itself.

---

## Extras if there's time (optional)

Roughly in the order worth doing:

- **More tests:** PATCH one field doesn't change the others, reordering with unknown ids, bad data gets rejected (use `@pytest.mark.parametrize`).
- ✅ **Phone layout:** done, `styles/mobile.css` + `scripts/mobile.js`. The first screen is the lists, tap one to open it. Still missing: drag and drop on touch screens. See `UI.md`.
- ✅ **Display name and password change:** done, the ⓘ button in the sidebar. See `ACCOUNT.md`.
- ✅ **Email reminders:** done, email verification + reminders for tasks due tomorrow through Brevo, triggered daily by GitHub Actions. See `EMAIL_REMINDERS.md`.
- **Forgot password:** send a reset link to the verified email, built like the verification link.
- **GitHub Actions:** run `pytest` automatically on every push.
- **Import old data** from `localStorage` to the server.

---

## When something breaks

| What you see | Usual cause |
| --- | --- |
| `No such command "db"` | Flask-Migrate isn't installed or `init_app`'d, or `--app wsgi` is missing |
| `db migrate` sees no tables | `create_app()` doesn't import the models |
| Migration says "No support for ALTER of constraints in SQLite" | Missing `render_as_batch=True` or the constraint naming convention (stage 3) |
| CSS or images 404 | Not using `url_for`, or the JS still has the old paths |
| Logged in but bounced back to `/login` | Secure cookie over HTTP, set `COOKIE_SECURE=0` in `.env` |
| POST says 400 "CSRF token missing" | No `csrf_token` in the form, or no `X-CSRFToken` header |
| Login tests get 400 or 429 | The fixture didn't turn off CSRF or rate limiting |
| `SECRET_KEY is not set` | No `.env`, or running from the wrong folder |
| Works locally, driver error on Render | Missing `psycopg`, or the URL isn't changed to `postgresql+psycopg://` |
| Random database connection errors on Render | Missing `pool_pre_ping` |
| `relation "..." does not exist` on Render | The migration didn't run, or `migrations/` isn't committed |
| `no such table: users` / `no such column` | Changed `models.py` without `db migrate` + `db upgrade` |
| `ModuleNotFoundError: No module named 'flask_limiter'` (or another library) | Not `pip install`ed, or missing from `requirements.txt` |
| Installed a library but the page shows the same error | `flask run` was started before installing. Ctrl+C and run it again. The reloader only restarts when a `.py` file changes |
| Changed CSS/JS but the page looks the same | The browser has the old file, press Ctrl+Shift+R |
| Back to the login page, submitting logs into the old account | The old page came from the cache. Fixed with `Cache-Control: no-store` (see `ACCOUNT.md`) |
| `ZoneInfoNotFoundError` on Windows | Missing the `tzdata` package |
| No email arrives | Without `BREVO_API_KEY` emails are only printed in the terminal. With it, check spam and that `MAIL_SENDER` is confirmed in Brevo |

---

## Interview questions

Moved to `INTERVIEW.md`, with answers.
