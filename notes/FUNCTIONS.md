# Notes: Functions and commands used in the project

Quick reference for every function, class and command used in ToDoList, grouped by topic.
Each entry says which stage it was first used in, e.g. **[Stage 4]**. **[Extra]** = the extras done after stage 7 (account panel, email reminders, phone layout). ⏳ = a stage that isn't done yet.

Contents:

1. [Python: Flask](#1-python-flask)
2. [Python: Database (Flask-SQLAlchemy, SQLAlchemy)](#2-python-database-flask-sqlalchemy-sqlalchemy)
3. [Python: Migrations (Flask-Migrate, Alembic)](#3-python-migrations-flask-migrate-alembic)
4. [Python: Built into Python](#4-python-built-into-python)
5. [Python: Functions written in this project](#5-python-functions-written-in-this-project)
6. [Python: Libraries from stage 6 on](#6-python-libraries-from-stage-6-on)
7. [JavaScript: Built into the browser](#7-javascript-built-into-the-browser)
8. [JavaScript: Functions written in this project](#8-javascript-functions-written-in-this-project)
9. [Terminal commands](#9-terminal-commands)

---

## 1. Python: Flask

### Creating the app and config

| Function | What it does | Example |
|---|---|---|
| `Flask(__name__)` **[Stage 1]** | Creates the app. `__name__` helps Flask find `templates/` and `static/` | `app = Flask(__name__)` |
| `app.config[...]` **[Stage 3]** | Read and write the app's config | `app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///todo.db"` |
| `app.config.update(...)` **[Stage 7]** | Write several config values at once | `app.config.update(SECRET_KEY=..., ...)`, `app.config.update(test_config)` |
| `app.instance_path` | Path of the `instance/` folder, where the SQLite file lives | |

### Routes and Blueprints

| Function | What it does | Example |
|---|---|---|
| `Blueprint(name, __name__)` **[Stage 2]** | Creates a group of routes | `blueprint = Blueprint("api", __name__)` |
| `app.register_blueprint(bp, url_prefix=...)` **[Stage 2]** | Attaches a Blueprint to the app. Forget it and the URLs 404 | `app.register_blueprint(api_blueprint, url_prefix="/api")` |
| `@bp.route(path, methods=[...])` **[Stage 1]** | Links a URL to a function. Only GET by default | `@blueprint.route("/", methods=["GET"])` |
| `@bp.get` / `@bp.post` / `@bp.patch` / `@bp.put` / `@bp.delete` **[Stage 4]** | Short for `route(..., methods=[...])` | `@blueprint.post("/lists")` |
| `<int:id>` in the URL **[Stage 4]** | Takes part of the URL as a parameter, converted to a number. Not a number = 404 | `@blueprint.patch("/tasks/<int:task_id>")` → the function gets `task_id` |
| `@bp.before_request` **[Stage 6]** | Runs before every route in the Blueprint. Used to require login for the whole API | `require_login()` in `api.py` |
| `@bp.after_request` **[Extra]** | Runs after every route in the Blueprint and can change the response | `no_store()` in `auth.py` adds `Cache-Control` |

### Reading the request

| Attribute | What it does | Example |
|---|---|---|
| `request.get_json(silent=True)` **[Stage 4]** | Reads a JSON body into a dict. `silent=True`: returns `None` instead of raising if it's not valid | `data = request.get_json(silent=True)` |
| `request.path` **[Stage 4]** | The request's path, e.g. `/api/lists` | `if request.path.startswith("/api/"):` |
| `request.form` **[Stage 6]** | Data from an HTML form (login page) | `request.form.get("username", "")` |
| `request.args` | Parameters after `?` in the URL | `/tasks?done=true` → `request.args.get("done")` |
| `request.headers` **[Extra]** | Request headers | `request.headers.get("Authorization", "")` |
| `request.method` / `request.endpoint` **[Stage 7]** | `"GET"`/`"POST"`... / the name of the matched route, e.g. `"auth.register"` | |
| `request.remote_addr` **[Stage 7]** | The client's IP | `client_ip()` |

### Sending a response

| Function | What it does | Example |
|---|---|---|
| `render_template(file, **vars)` **[Stage 2]** | Returns an HTML page from `templates/`, run through Jinja | `return render_template("auth.html", mode="login")` |
| `url_for("static", filename=...)` **[Stage 2]** | Path to a static file. Used in HTML (Jinja) | `{{ url_for('static', filename='styles/base.css') }}` |
| `url_for("bp_name.function")` **[Stage 6]** | URL of a route by its function name | `url_for("auth.login")` → `/login` |
| `url_for(..., _external=True)` **[Extra]** | Full URL with `http://domain`, for emails | verification link |
| `jsonify(...)` **[Stage 4]** | Turns a dict or list into a JSON response | `return jsonify(task.to_dict())` |
| `return body, code` **[Stage 4]** | Return with a status code | `return jsonify(...), 201` / `return "", 204` |
| `abort(code, "reason")` **[Stage 4]** | Stops the route right away with an error | `abort(400, "name must be a non-empty string")` |
| `redirect(url)` **[Stage 6]** | Sends the browser to another page | `return redirect(url_for("pages.index"))` |
| `flash("...")` **[Stage 6]** | Saves a message for the next page to show | `flash("Wrong username or password")` |
| `get_flashed_messages()` **[Stage 6]** | Used in Jinja to get the `flash`ed messages | |
| `response.headers[...]` **[Extra]** | Set a response header | `response.headers["Cache-Control"] = "no-store"` |

### Error handling

| Function | What it does | Example |
|---|---|---|
| `app.register_error_handler(code, fn)` **[Stage 4]** | Function that runs for that error code. On the app, so it also catches URLs that don't exist | `app.register_error_handler(404, handle_error)` |
| `@bp.errorhandler(code)` **[Stage 7]** | Same, but only for routes in that Blueprint | `too_many_attempts()` for 429 in `auth.py` |
| `error.code` / `error.description` **[Stage 4]** | The error's code and reason | `jsonify(error=error.description), error.code` |

### HTTP status codes used in the project

| Code | Meaning | When |
|---|---|---|
| 200 | OK | GET, PATCH worked |
| 201 | Created | POST created something |
| 204 | No Content | DELETE, PUT order, password change worked, nothing to return |
| 400 | Bad Request | Bad data, wrong current password |
| 401 | Unauthorized | Not logged in **[Stage 6]** |
| 403 | Forbidden | Sign ups closed (`REGISTRATION_OPEN=0`) |
| 404 | Not Found | No such list or task, or it's not yours. Also a wrong `REMINDER_TOKEN` |
| 405 | Method Not Allowed | Wrong method, e.g. DELETE `/api/lists` |
| 429 | Too Many Requests | Rate limited **[Stage 7]** |
| 500 | Internal Server Error | The server code crashed. Should never happen because of bad input |
| 502 | Bad Gateway | Brevo couldn't send the email **[Extra]** |

---

## 2. Python: Database (Flask-SQLAlchemy, SQLAlchemy)

### Setup

| Function | What it does | Example |
|---|---|---|
| `SQLAlchemy(metadata=...)` **[Stage 3]** | Creates the `db` object | `db = SQLAlchemy(metadata=MetaData(naming_convention=convention))` |
| `MetaData(naming_convention=...)` **[Stage 3]** | Constraint naming rules, so migrations can change or drop them | see `extensions.py` |
| `db.init_app(app)` **[Stage 3]** | Attaches `db` to the app | |
| `db.create_all()` ⏳ Stage 8 | Creates every table right away, no migration. Only for tests | `with app.app_context(): db.create_all()` |
| `app.app_context()` | Some `db` work has to run "inside the app", e.g. in tests | `with app.app_context(): ...` |

### Declaring tables (models)

| Thing | What it does | Example |
|---|---|---|
| `class X(db.Model)` **[Stage 3]** | Each class is a table | `class Task(db.Model):` |
| `__tablename__` **[Stage 3]** | The real table name | `__tablename__ = "tasks"` |
| `db.Column(type, ...)` **[Stage 3]** | A column | `text = db.Column(db.String(500), nullable=False)` |
| `db.Integer` / `db.String(n)` / `db.Boolean` / `db.Date` / `db.DateTime` | Column types | |
| `primary_key=True` | Primary key, the database assigns the number | |
| `nullable=False` | Required | |
| `default=...` | Default value when not given. A function (lambda) runs on every insert | `default=lambda: datetime.now(timezone.utc)` |
| `unique=True` **[Stage 6]** | No duplicates | `username`, `email` |
| `index=True` | Index for faster lookups | `list_id` |
| `db.ForeignKey("table.column", ondelete="CASCADE")` **[Stage 3]** | Foreign key | `db.ForeignKey("lists.id", ondelete="CASCADE")` |
| `db.relationship("Model", back_populates=..., cascade=..., order_by=...)` **[Stage 3]** | Relationship between 2 tables in Python, e.g. `todo_list.tasks`, `task.todo_list` | see `models.py` |
| `UserMixin` **[Stage 6]** | Gives `User` what Flask-Login needs (`is_authenticated`, `get_id`...) | `class User(UserMixin, db.Model)` |

### Reading data

| Function | What it does | Example |
|---|---|---|
| `db.select(Model)` **[Stage 4]** | Builds a query (doesn't run it) | `db.select(TodoList)` |
| `.where(condition)` **[Stage 4]** | Filter with an expression | `.where(Task.list_id == 3)` |
| `.filter_by(column=value)` **[Stage 6]** | Shorter filter, equality only | `.filter_by(id=list_id, user_id=current_user.id)` |
| `.order_by(column)` **[Stage 4]** | Sort | `.order_by(TodoList.id)` |
| `.join(Model)` **[Stage 6]** | Join tables | `db.select(Task).join(TodoList)` |
| `.is_(None)` / `.is_not(None)` / `.is_(False)` **[Extra]** | `IS NULL` / `IS NOT NULL` / `IS FALSE` in SQL | `User.email_verified_at.is_not(None)` |
| `or_(a, b)` **[Extra]** | SQL `OR`. `from sqlalchemy import or_` | `or_(Task.reminded_for.is_(None), Task.reminded_for != Task.due_date)` |
| `.options(selectinload(Model.relationship))` **[Stage 4]** | Loads related data with 1 extra query, avoids the N+1 query problem | `.options(selectinload(TodoList.tasks))` |
| `db.session.scalars(q).all()` **[Stage 4]** | Runs the query, returns a list of objects | `lists = db.session.scalars(query).all()` |
| `db.session.scalars(q).first()` | First object or `None` | |
| `db.session.scalar(q)` **[Stage 4]** | Runs a query that returns one value | `db.session.scalar(db.select(func.max(Task.position)))` |
| `func.max(col)` / `func.count(col)` **[Stage 4]** | SQL functions: max, count | `from sqlalchemy import func` |
| `db.session.get(Model, id)` **[Stage 6]** | Find by primary key, `None` if not found | `db.session.get(User, int(user_id))` |
| `db.get_or_404(Model, id, description=...)` **[Stage 4]** | Find by primary key, 404 if not found | |
| `db.first_or_404(q, description=...)` **[Stage 6]** | Run a query, 404 if no result | `db.first_or_404(db.select(TodoList).filter_by(...))` |

### Writing data

| Function | What it does | Example |
|---|---|---|
| `db.session.add(obj)` **[Stage 4]** | Marks a new object to be saved | `db.session.add(task)` |
| `db.session.delete(obj)` **[Stage 4]** | Marks an object to be deleted | `db.session.delete(todo_list)` |
| Setting an attribute | Change data, just set it and commit | `task.text = "New"` |
| `db.session.commit()` **[Stage 4]** | Actually saves to the database. After commit, a new object has its `id` | |
| `db.session.rollback()` **[Stage 6]** | Undoes uncommitted changes, used after an error | after catching `IntegrityError` |

---

## 3. Python: Migrations (Flask-Migrate, Alembic)

| Thing | What it does |
|---|---|
| `Migrate(render_as_batch=True)` **[Stage 3]** | Creates `migrate`. Batch mode is needed for SQLite |
| `migrate.init_app(app, db)` **[Stage 3]** | Attaches it to the app, adds the `flask db ...` commands |
| `op.create_table(...)` / `op.drop_table(...)` | In a migration file: create and drop tables |
| `op.batch_alter_table(...)` | In a migration file: change a table in batch mode (SQLite) |
| `batch_op.add_column(...)` / `create_unique_constraint(...)` | Add a column / a unique constraint |
| `upgrade()` / `downgrade()` | Apply / undo the change in each migration file |

Commands are in [section 9](#9-terminal-commands).

---

## 4. Python: Built into Python

| Function | What it does | Example in the project |
|---|---|---|
| `isinstance(x, type)` **[Stage 4]** | Check a value's type | `isinstance(value, str)` |
| `str.strip()` **[Stage 4]** | Remove spaces at both ends | `"  Work ".strip()` → `"Work"` |
| `str.lower()` | Lowercase | `value.lower()` |
| `str.startswith(...)` **[Stage 4]** | Check how a string starts | `request.path.startswith("/api/")` |
| `len(x)` | Length | `len(value) > 100` |
| `re.compile(pattern)` / `.match(string)` **[Stage 4]** | Regular expressions | `COLOR_PATTERN.match("#e74c3c")` |
| `date.fromisoformat(s)` **[Stage 4]** | `"2026-11-07"` → `date` | `from datetime import date` |
| `date.isoformat()` **[Stage 3]** | `date` → `"2026-11-07"` | in `to_dict()` |
| `enumerate(list)` **[Stage 4]** | Loop with the index | `for position, task in enumerate(ordered):` |
| `all(...)` **[Stage 4]** | `True` if every item is true | `all(isinstance(i, int) for i in task_ids)` |
| `set()` / `.add()` / `in` **[Stage 4]** | A set, very fast "seen this already?" | `seen = set()` |
| Dict comprehension | Build a dict in one line | `{task.id: task for task in todo_list.tasks}` |
| List comprehension | Build a list in one line | `[t.to_dict() for t in self.tasks]` |
| f-string | Put variables in a string | `f"{field} must be a non-empty string"` |
| `f"{date:%b %d}"` **[Extra]** | Format a date in an f-string | `"Nov 10"` |
| `try / except (A, B):` **[Stage 4]** | Catch errors | `except (TypeError, ValueError):` |
| `try / except / else` **[Stage 6]** | `else` runs only if nothing was raised | sign up: commit, else log in |
| `os.environ.get("NAME")` **[Stage 7]** | Read an environment variable | `os.environ.get("SECRET_KEY")` |
| `secrets.token_hex(32)` **[Stage 7]** | Secure random string | making `SECRET_KEY`, `REMINDER_TOKEN` |
| `raise RuntimeError("...")` **[Stage 7]** | Raise an error and stop | missing `SECRET_KEY` |
| `@property` **[Extra]** | Turns a method into an attribute, no `()` needed | `user.shown_name` |
| `datetime.now(timezone.utc)` **[Stage 6]** | Now, in UTC | `created_at`, `send_due_reminders()` |
| `timedelta(days=1)` **[Extra]** | A length of time, add or subtract it from dates | `now + timedelta(days=1)` → tomorrow |
| `dt.astimezone(zone)` **[Extra]** | Convert a datetime to another timezone | each user's local time |
| `ZoneInfo("America/Toronto")` **[Extra]** | A timezone by name. Bad name = `ZoneInfoNotFoundError`. Windows needs `tzdata` | `from zoneinfo import ZoneInfo` |
| `hmac.compare_digest(a, b)` **[Extra]** | Compare 2 byte strings in constant time, so a token can't be guessed by timing | checking `REMINDER_TOKEN` |
| `urllib.request.Request(...)` / `urlopen(req, timeout=10)` **[Extra]** | Send an HTTP request without installing anything | sending email through Brevo |
| `json.dumps(obj).encode()` **[Extra]** | Dict → JSON string → bytes to send | the body sent to Brevo |

---

## 5. Python: Functions written in this project

### `wsgi.py`, `app/__init__.py`

| Function | What it does |
|---|---|
| `create_app(test_config=None)` **[Stage 1]** | Creates the app, config, extensions, Blueprints, returns the app. `test_config` overrides settings for tests |
| `env_flag(name, default)` **[Stage 7]** | Reads an on/off environment variable (`"1"`, `"true"`, `"yes"`, `"on"` = on) |
| `load_user(user_id)` **[Stage 6]** | Flask-Login calls it every request: id from the cookie → `User` |
| `unauthorized()` **[Stage 6]** | Not logged in: `/api/...` → 401 JSON, other pages → redirect to `/login` |
| `app = create_app()` in `wsgi.py` | Entry point: makes the real app for `flask run` or `gunicorn wsgi:app` |

### `app/extensions.py`

| Thing | What it does |
|---|---|
| `db`, `migrate`, `login_manager`, `csrf`, `limiter` | The extensions, created here and attached in `create_app()` |
| `client_ip()` **[Stage 7]** | The client's IP, used as the default rate limit key |

### `app/models.py` **[Stage 3]**

| Function | What it does |
|---|---|
| `TodoList.to_dict()` | List (with all its tasks) → dict for JSON |
| `Task.to_dict()` | Task → dict. `due_date` becomes a string, key named `dueDate` to match the JS |
| `User.shown_name` **[Extra]** | `display_name` if set, otherwise `username`. Used in the sidebar and email greetings |
| `User.to_dict()` **[Extra]** | Info for the account panel: `username`, `displayName`, `email`, `emailVerified`, `timezone`, `createdAt`. **No `password_hash`** |

### `app/pages.py` **[Stage 2]**

| Function | URL | What it does |
|---|---|---|
| `index()` | `GET /` | Returns `index.html`. Needs login |

### `app/api.py` **[Stage 4]**

Checking data (`abort(400)` if wrong):

| Function | What it does |
|---|---|
| `get_json_body()` | Reads the JSON body. Not an object `{...}` → 400 |
| `validate_text(value, field, max_length)` | String, not empty after `strip()`, not too long. Returns the stripped string |
| `validate_color(value)` | `None` or `#rrggbb`. Returns it lowercase |
| `validate_due_date(value)` | `None` or `"YYYY-MM-DD"`. Returns a `date` |
| `validate_completed(value)` | Must be a real `True`/`False` |

Finding data (404 if not found, or not yours):

| Function | What it does |
|---|---|
| `require_login()` **[Stage 6]** | `before_request` on the API: every route needs login |
| `get_list_or_404(list_id)` | Finds a list **owned by the current user** |
| `get_task_or_404(task_id)` | Finds a task whose list is owned by the current user (join through `TodoList`) |

Routes:

| Function | Method + URL | Success |
|---|---|---|
| `get_lists()` | `GET /api/lists` | 200, the user's lists with tasks |
| `create_list()` | `POST /api/lists` `{name}` | 201, the new list |
| `update_list(list_id)` | `PATCH /api/lists/<id>` `{name}` | 200, the updated list |
| `delete_list(list_id)` | `DELETE /api/lists/<id>` | 204 |
| `create_task(list_id)` | `POST /api/lists/<id>/tasks` `{text, color, dueDate}` | 201, the new task |
| `reorder_tasks(list_id)` | `PUT /api/lists/<id>/order` `{taskIds: [...]}` | 204 |
| `update_task(task_id)` | `PATCH /api/tasks/<id>` (only the fields sent) | 200, the updated task |
| `delete_task(task_id)` | `DELETE /api/tasks/<id>` | 204 |
| `get_account()` **[Extra]** | `GET /api/account` | 200, account info |
| `update_account()` **[Extra]** | `PATCH /api/account` `{displayName, timezone}` | 200 |
| `set_email()` **[Extra]** | `PUT /api/account/email` `{email}` | 200, sends a verification link if the email is new |
| `resend_verification()` **[Extra]** | `POST /api/account/email/resend` | 204 |
| `change_password()` **[Extra]** | `POST /api/account/password` `{currentPassword, newPassword}` | 204. Wrong current password = **400** (not 401) |

Account helpers **[Extra]**:

| Function | What it does |
|---|---|
| `password_change_key()` / `email_key()` | Rate limit keys: per user, or per IP if nobody's logged in |
| `email_limit` | `limiter.shared_limit(...)`: the 2 email routes share 5 / hour |
| `try_send_verification()` | Sends the verification link. On failure, logs it and returns a message instead of breaking the request |

Errors:

| Function | What it does |
|---|---|
| `register_error_handlers(app)` | `/api/...` errors 400/404/405/429/502 return JSON `{"error": "..."}`, normal pages keep the HTML error page |

### `app/auth.py` **[Stage 6]**

| Function | URL | What it does |
|---|---|---|
| `register()` | `GET/POST /register` | Sign up. Rate limit 10 / hour / IP |
| `login()` | `GET/POST /login` | Log in. Rate limit 10 / minute / username and 30 / minute / IP |
| `logout()` | `POST /logout` | Log out. POST only |
| `verify_email(token)` **[Extra]** | `GET /verify-email/<token>` | The link in the verification email. No login needed |
| `read_form()` | | Reads the username (lowercased) and password from the form |
| `username_key()` **[Stage 7]** | | Rate limit key by username |
| `too_many_attempts(error)` **[Stage 7]** | | 429 shows on the form instead of a blank error page |
| `no_store(response)` **[Extra]** | | `Cache-Control: no-store`: Back doesn't show an old login page |
| `already_logged_in(mode)` **[Extra]** | | Logged in and opened/submitted the form: GET → main page, POST → "already logged in" message |

### `app/mailer.py` **[Extra]**

| Function | What it does |
|---|---|
| `send_email(to, subject, text)` | Sends through Brevo. No `BREVO_API_KEY` → prints it in the terminal |
| `make_verify_token(user)` / `read_verify_token(token)` | Make / read a token signed with `SECRET_KEY`. Reading returns `None` if it's fake or older than 24 hours |
| `send_verification_email(user)` | Sends the email with the `/verify-email/<token>` link |

### `app/reminders.py` **[Extra]**

| Function | What it does |
|---|---|
| `user_zone(user)` | The user's timezone, UTC if missing or invalid |
| `send_due_reminders(now=None)` | Emails unfinished tasks due tomorrow, returns how many emails were sent. `now` lets tests use a fake time |
| `send_reminders_route()` | `POST /internal/send-reminders`, needs `Authorization: Bearer <REMINDER_TOKEN>`, otherwise 404 |
| `send_reminders_command()` | The `flask send-reminders` command |

---

## 6. Python: Libraries from stage 6 on

### Logging in: Flask-Login **[Stage 6]**

| Thing | What it does |
|---|---|
| `LoginManager()` / `login_manager.init_app(app)` | Creates and attaches the login manager |
| `UserMixin` | `User` inherits from it to get what Flask-Login needs |
| `@login_manager.user_loader` | Function that takes the id from the session and returns a `User`. Called every request |
| `@login_manager.unauthorized_handler` | Runs when someone not logged in opens a page that needs login |
| `login_user(user, remember=True)` | Log in: puts the id in the session cookie |
| `logout_user()` | Log out |
| `@login_required` | On a route: login required |
| `current_user` | This request's user. `current_user.id`, `current_user.is_authenticated` |

### Passwords and database errors **[Stage 6]**

| Thing | What it does |
|---|---|
| `generate_password_hash(pw)` | Hashes a password to store it. Never store the real one. `from werkzeug.security import ...` |
| `check_password_hash(hash, pw)` | Checks a typed password against the stored hash |
| `IntegrityError` | Raised when a constraint is broken, e.g. duplicate username or email. `from sqlalchemy.exc import IntegrityError` |

### Config and security **[Stage 7]**

| Thing | What it does |
|---|---|
| `load_dotenv()` | Reads `.env` into environment variables. `from dotenv import load_dotenv` |
| `CSRFProtect()` / `csrf.init_app(app)` | CSRF protection for every POST/PATCH/PUT/DELETE. `from flask_wtf.csrf import CSRFProtect` |
| `{{ csrf_token() }}` | In HTML (Jinja): makes a CSRF token for a form or a `<meta>` tag |
| `csrf.exempt(blueprint)` **[Extra]** | Turns CSRF off for a Blueprint. Only when it's protected another way (a token in a header) |
| `Limiter(key_func=client_ip)` / `limiter.init_app(app)` | The rate limiter. `from flask_limiter import Limiter` |
| `@limiter.limit("10 per minute", methods=["POST"], key_func=...)` | Limits one route |
| `@limiter.limit(..., error_message="...")` **[Extra]** | The message when blocked, instead of `10 per 1 hour` |
| `limiter.shared_limit("5 per hour", scope="...")` **[Extra]** | Several routes share one counter |

### Signed tokens, CLI commands **[Extra]**

| Thing | What it does |
|---|---|
| `URLSafeTimedSerializer(key, salt=...)` | `.dumps(data)` makes a signed string safe for URLs. `.loads(token, max_age=seconds)` reads it, raises if it's fake or expired. `from itsdangerous import ...` |
| `SignatureExpired` / `BadSignature` | The errors `.loads` raises |
| `Blueprint(..., cli_group=None)` + `@bp.cli.command("name")` | Adds a `flask name` command |
| `click.echo(...)` | Prints in a `flask ...` command |
| `current_app.logger.warning(...)` / `.exception(...)` | Write to the server log. `.exception` includes the traceback |

### Tests: pytest ⏳ Stage 8

| Thing | What it does |
|---|---|
| `@pytest.fixture` | Shared setup for tests, e.g. make the app, make a client |
| `tmp_path` | Built-in fixture: a temporary folder per test |
| `app.test_client()` | A fake client to send requests without running a server |
| `client.get(url)` / `client.post(url, json={...})` / `.patch` / `.delete` | Send a test request |
| `response.status_code` / `response.get_json()` | Read the result |
| `assert condition` | Check. False = the test fails |

### Real database and deploy ⏳ Stages 9, 10

| Thing | What it does |
|---|---|
| `SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 300}` | Checks the connection before using it, because Neon shuts down when idle |
| `ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)` | Tells Flask the real request was HTTPS when running behind Render's proxy. `from werkzeug.middleware.proxy_fix import ProxyFix` |

---

## 7. JavaScript: Built into the browser

### Finding and creating HTML elements (DOM)

| Function | What it does | Example |
|---|---|---|
| `document.getElementById(id)` | Find an element by id | `document.getElementById("taskInput")` |
| `document.querySelector(css)` | First element matching a CSS selector | `document.querySelector(".main")` |
| `document.querySelectorAll(css)` | Every match, returns a `NodeList` | `tasksList.querySelectorAll("li:not(.dragging)")` |
| `document.createElement(tag)` | Create a new element (not shown yet) | `document.createElement("li")` |
| `parent.appendChild(el)` / `parent.append(a, b, ...)` | Add to the end of a parent | `li.append(checkBox, text)` |
| `parent.insertBefore(el, ref)` | Insert before `ref`. `ref` = `null` inserts at the end | drag and drop |
| `el.replaceWith(other)` | Replace this element with another | renaming a list: `span` → `input` |
| `el.innerHTML = ""` | Clear everything inside | before redrawing |
| `el.textContent = "..."` | Set text (safe, no HTML runs) | `span.textContent = task.text` |
| `el.dataset.id` | Read/write the `data-id` attribute. **Always a string** | `li.dataset.id = String(task.id)` |
| `el.children` | Direct child elements | `[...tasksList.children]` |
| `el.closest(css)` **[Extra]** | The element itself or its nearest parent matching the selector, or `null` | `e.target.closest("input")` |
| `el.hidden = true` **[Extra]** | Hide an element (like `display: none`) | `toastYes.hidden = true` |
| `el.focus()` / `input.select()` | Put the cursor in an input / select its text | |
| `el.getBoundingClientRect()` | Position and size on screen | placing popups, drag and drop |
| `Object.assign(node, props)` **[Extra]** | Copy every property of `props` onto `node` | `el()` in `account.js` |
| `form.reset()` **[Extra]** | Clear every field in a form | after changing the password |

### Classes and styles

| Function | What it does | Example |
|---|---|---|
| `el.classList.add/remove(name)` | Add / remove a class | `li.classList.add("dragging")` |
| `el.classList.toggle(name)` | Remove if there, add if not | `menu.classList.toggle("open")` |
| `el.classList.toggle(name, condition)` | `true` adds, `false` removes | `btn.classList.toggle("empty", !pendingColor)` |
| `el.classList.contains(name)` | Has that class? | `body.classList.contains("dark")` |
| `el.style.display = "none"` | Set CSS directly. `""` removes it | |
| `el.style.setProperty("--var", value)` | Set a CSS variable | `li.style.setProperty("--task-color", task.color)` |

### Events

| Thing | What it does |
|---|---|
| `el.addEventListener(event, fn)` | Run `fn` when the event happens |
| `e.stopPropagation()` | Don't let the event bubble up to parent elements |
| `e.preventDefault()` | Stop the browser's default behavior. Required in `dragover`, and on form `submit` so the page doesn't reload |
| `e.key` | The key pressed: `"Enter"`, `"Escape"` |
| `e.clientY` | Mouse position, vertical |
| `e.target` | The element the event happened on |

Events used in the project:

| Event | When |
|---|---|
| `click` | Mouse click |
| `change` | An input, checkbox or radio value changed |
| `keydown` | Key pressed |
| `blur` | An input lost focus (clicked away) |
| `submit` **[Extra]** | A form was sent (button or Enter) |
| `dragstart` / `dragover` / `dragend` | Start dragging / dragging over / dropped |
| `scroll` / `resize` | Page scrolled / window resized |
| `visibilitychange` **[Stage 5]** | Switched to another tab or back. `document.visibilityState` is `"visible"` or `"hidden"` |
| `popstate` **[Extra]** | Back / Forward pressed |

### Arrays

| Function | What it does | Example |
|---|---|---|
| `arr.find(fn)` | First item that matches, or `undefined` | `lists.find(l => l.id === id)` |
| `arr.filter(fn)` | New array with the matching items | `tasks.filter(t => !t.completed)` |
| `arr.map(fn)` | New array, every item transformed | `tasks.map(t => t.id)` |
| `arr.some(fn)` | `true` if at least 1 item matches | duplicate task check |
| `arr.forEach(fn)` | Loop over each item, `(item, index)` | `tasks.forEach((t, i) => ...)` |
| `arr.includes(x)` | Contains `x`? | `visibleIds.includes(id)` |
| `arr.push(x)` | Add to the end (changes the array) | `list.tasks.push(task)` |
| `arr.sort(fn)` | Sort (changes the array) | `withDate.sort((a, b) => ...)` |
| `arr.indexOf(x)` | Position of `x`, or `-1` | color order |
| `[...a, ...b]` | Spread: join arrays, or turn a `NodeList` into an array | `[...withDate, ...withoutDate]` |

### Objects, strings, numbers

| Function | What it does | Example |
|---|---|---|
| `Object.assign(target, source)` | Copy `source`'s fields onto `target` | `Object.assign(task, { completed: true })` |
| `str.trim()` | Remove spaces at both ends | |
| `str.toLowerCase()` | Lowercase | duplicate task check |
| `str.split("-")` | Split a string into an array | `"2026-11-07".split("-")` |
| `str.localeCompare(other)` | Compare 2 strings for sorting | sorting by date |
| `` `...${var}...` `` | Template literal: put variables in a string. **Only with backticks**, not `"..."` | `` `/api/tasks/${id}` `` |
| `Number(x)` / `String(x)` | Convert type | `String(t.id) === el.dataset.id` |
| `new Date(y, m - 1, d)` / `.toLocaleDateString(...)` | Make a date (months start at 0) / show a date | `formatTaskDate` |
| `Date.now()` | Current time in milliseconds. Not used as an id since stage 5 | |
| `Intl.DateTimeFormat().resolvedOptions().timeZone` **[Extra]** | The device's timezone, e.g. `"America/Toronto"` | `syncTimezone()` |

### Storage and JSON

| Function | What it does |
|---|---|
| `localStorage.getItem(key)` / `setItem(key, value)` / `removeItem(key)` | Stored in the browser, **strings only**. Since stage 5 only for `theme`, `sortOrder`, `currentListId` |
| `JSON.stringify(obj)` | Object → JSON string |
| `JSON.parse(str)` | JSON string → object |

### Browser history and screen size **[Extra]**

| Thing | What it does |
|---|---|
| `window.matchMedia("(max-width: 700px)").matches` | `true` if the screen matches, like `@media` in CSS |
| `history.pushState(state, "")` | Adds a history step, the URL doesn't change. Back returns to the step before |
| `history.back()` | Same as pressing Back |
| `history.replaceState(state, "")` | Changes the current step, doesn't add one |
| `history.state` | The current step's `state` |
| `window.scrollTo(0, 0)` | Scroll to the top |

### Talking to the server, async **[Stage 5]**

| Thing | What it does |
|---|---|
| `fetch(url, { method, headers, body })` | Sends a request. Returns a Promise. **Doesn't throw on 404/500** |
| `response.ok` | `true` for 200–299 |
| `response.status` | The status code, e.g. 204 |
| `response.json()` | Reads the JSON body (also async) |
| `async function` | A function that can use `await`, always returns a Promise |
| `await` | Wait for a Promise before the next line. The page doesn't freeze |
| `try / catch / finally` | Catch errors. `finally` always runs |
| `throw new Error("...")` | Throw an error |
| `console.error(err)` | Print an error in the Console tab (F12) |
| `location.reload()` / `window.location.href = "/login"` | Reload the page / go to another page |

### Syntax that's easy to forget

| Syntax | Meaning | Example |
|---|---|---|
| `a?.b` | Optional chaining: if `a` is `null`/`undefined`, gives `undefined` instead of crashing | `lists[0]?.id` |
| `a ?? b` | If `a` is `null`/`undefined`, use `b` | `lists[0]?.id ?? null` |
| `a \|\| b` | If `a` is "falsy" (`0`, `""`, `null`, `undefined`, `false`), use `b` | `Number(...) \|\| null` |
| `x => ...` | Arrow function, a short function | `t => t.id` |
| `{ method }` | Short for `{ method: method }` | |
| `const` / `let` | Can't reassign / can reassign | |
| `===` | Equality **including the type**: `4 === "4"` is `false` | |
| `fn(a, b = {})` | Default parameter value | `el(tag, props = {}, children = [])` |

---

## 8. JavaScript: Functions written in this project

Load order in `index.html`: storage → toast → pickers → controls → taskActions → taskRender → sidebar → mobile → account → theme → main.

### `storage.js`: data

| Function | What it does |
|---|---|
| `getCurrentList()` | The open list, or `null` |
| `getTasks()` | The open list's tasks, or `[]` |
| `apiRequest(method, path, body)` **[Stage 5]** | Sends a request with the CSRF header, returns JSON or `null` (204). On error it throws: `error.message` is the server's `{"error": "..."}`, `error.status` is the code. 401 → goes to `/login` |
| `apiSave(method, path, body)` **[Stage 5]** | Same, but catches errors, tells the user, returns `null` on failure. Counts `pendingSaves` |
| `loadList()` **[Stage 5]** | `GET /api/lists` into the `lists` variable |

### `main.js`: startup

| Thing | What it does |
|---|---|
| `lists`, `currentListId` | Global variables shared by every file |
| `init()` | Waits for `loadList()`, then draws the sidebar and tasks |
| `visibilitychange` listener | Reloads data when you come back to the tab, unless a save is in progress |

### `toast.js`: dialogs

| Function | What it does |
|---|---|
| `showToast(text, onYes)` | Yes/No question. Yes calls `onYes()` |
| `showInputToast(label, initialValue, onSave, placeholder)` | One-line input. Enter/button saves (calls `onSave(value)`), Escape cancels |
| `showPanelToast(element)` **[Extra]** | Shows any element (the account panel), with just a Close button |
| `openToast(yesText, noText)` / `closeToast()` | Open / close the dialog (used internally) |

### `pickers.js`: color and date pickers

| Function / constant | What it does |
|---|---|
| `TASK_COLORS` | The 6 colors |
| `formatTaskDate(dateStr)` | `"2026-11-10"` → `"Nov 10, 2026"`, without timezone shifts |
| `createAnchoredPopup(tag, className)` | A popup under a button, closes on outside click, scroll, resize. Returns `{ element, open, close }` |
| `openDueDatePicker(anchor, currentValue, onSelect)` | Opens the date picker, calls `onSelect(date or null)` |
| `openColorPicker(anchor, owner, onSelect)` | Opens the color picker, calls `onSelect(color or null)`. Clicking the same button again closes it |

### `controls.js`: filter and sort

| Function / variable | What it does |
|---|---|
| `setupDropdown(toggleId, menuId, onChange)` | Builds a dropdown: click to open, click outside to close, picking calls `onChange(value)` |
| `currentFilter` | `"all"` / `"active"` / `"completed"` |
| `filterTasks(tasks)` | Tasks matching the filter |
| `currentSort` | `"manual"` / `"earliest"` / `"latest"` / `"color"`, saved in localStorage |
| `sortTasks(tasks)` | A **new** sorted array, tasks without a date/color go last |

### `taskActions.js`: the ONLY place task data changes

| Function | What it does | Request |
|---|---|---|
| `findTask(id)` | Finds a task in the open list | |
| `addTask(text, color, dueDate)` | Adds a task | `POST /api/lists/<id>/tasks`, **waits for the server** before adding |
| `updateTask(id, changes)` | Changes the fields in `changes` | `PATCH /api/tasks/<id>`, UI first then save |
| `deleteTask(id)` | Deletes a task | `DELETE /api/tasks/<id>` |
| `reorderTasks(visibleIds)` | New order after drag and drop, hidden tasks stay put (`slots` logic) | `PUT /api/lists/<id>/order` |

### `taskRender.js`: drawing and user input

| Function / variable | What it does |
|---|---|
| `renderTask()` | Clears and redraws the task list (filter → sort → `buildTaskItem`) |
| `buildTaskItem(task)` | Makes the `<li>` for a task: checkbox, color dot, text, date, edit, delete, drag and drop |
| `createIconButton(className, imgSrc, alt, onClick)` | A button with an icon |
| `updateCounters()` | Updates Total / Active / Completed |
| `pendingColor` / `pendingDueDate` | Color and date picked in the input row before pressing Add |
| `updateNewTaskButtons()` / `resetNewTaskRow()` | Update / clear the new task row |
| `submitNewTask()` | Reads the input, asks if it's a duplicate, then calls `addTask` |

### `sidebar.js`: the lists

| Function | What it does |
|---|---|
| `updateMainVisibility()` | No lists → Welcome screen, otherwise the main UI |
| `renderSidebar()` | Redraws the lists: select, rename (Enter saves, Escape cancels, `finished` flag), delete |
| `+` button (newListButton) | Opens `showInputToast` to create a list |
| Clicking a list / creating a list | Also calls `openListOnPhone()` (mobile.js). Does nothing on a computer |

### `mobile.js`: phone layout **[Extra]**

| Function / variable | What it does |
|---|---|
| `phoneQuery` | `matchMedia("(max-width: 700px)")`, same number as `mobile.css` |
| `openListOnPhone()` | Adds `listOpen` to `<body>` (shows the list screen) and `history.pushState` |
| `showListsOnPhone()` | Removes `listOpen` (back to the lists screen) |
| `‹ Lists` button | `history.back()`, the `popstate` listener does the rest |

### `account.js`: the account panel (ⓘ button) **[Extra]**

| Function | What it does |
|---|---|
| `el(tag, props, children)` | Makes an HTML element in one line |
| `detailRow(label, value)` | A "label ... value" row, e.g. Username |
| `setStatus(status, text, ok)` | Shows a message under a form, teal if `ok`, red if an error |
| `buildAccountPanel(account)` | Builds the 4 sections: Account, Display name, Email, Change password, with their save handlers |
| `syncTimezone()` | Sends the device's timezone to the server if it changed, runs on every page load |

### `theme.js`: dark mode

| Thing | What it does |
|---|---|
| `.themeButton` buttons | Toggle the `dark` class on `<body>`, remembered in localStorage |

---

## 9. Terminal commands

### Python environment (PowerShell)

| Command | What it does |
|---|---|
| `py -m venv .venv` | Create the virtual environment (once) |
| `.venv\Scripts\activate` | Turn on the virtual environment. `(.venv)` at the start of the line = on |
| `pip install name` | Install a library |
| `pip freeze \| Set-Content -Encoding ascii requirements.txt` | Write the library list. **Don't use `>`**, PowerShell saves UTF-16 and Render can't read it |
| `pip install -r requirements.txt` | Install every library from the file (new machine, Render) |

### Flask

| Command | What it does |
|---|---|
| `flask --app wsgi run --debug` | Run the server locally, reloads when code changes. **Never `--debug` on a real server** |
| `flask --app wsgi db init` | Create the `migrations/` folder (once) |
| `flask --app wsgi db migrate -m "description"` | Compare `models.py` with the database, generate a migration. **Always read the file** |
| `flask --app wsgi db upgrade` | Apply migrations to the database |
| `flask --app wsgi db downgrade` | Undo the last migration |
| `flask --app wsgi db current` | Which migration the database is on |
| `flask --app wsgi routes` | List every route. Handy to check a Blueprint is registered |
| `flask --app wsgi send-reminders` | Send the reminder emails now (no `BREVO_API_KEY` → printed in the terminal) |
| `pytest` ⏳ Stage 8 | Run the tests |
| `gunicorn wsgi:app ...` ⏳ Stage 10 | Production server (Render). Doesn't run on Windows |

### Git

| Command | What it does |
|---|---|
| `git status` | See changed files |
| `git mv old new` | Rename/move a file. Commit that on its own before changing the content |
| `git add -A` / `git commit -m "..."` | Save changes |
| `git log --oneline` | Short commit history |
| `git push origin main` | Push to GitHub |
| `git ls-files \| Select-String "\.env"` | Check `.env` was never committed |
