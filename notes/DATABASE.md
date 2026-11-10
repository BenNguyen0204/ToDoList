# Notes: Database design

## Overview

```text
users 1 ──── N lists 1 ──── N tasks
```

One user has many lists, one list has many tasks.

The `users` table was added in stage 6. Stage 3 only needed `lists` and `tasks`. After stage 7, `users` also got a display name, email and timezone, and `tasks` got a column that remembers whether a reminder was already sent.

---

## Tables

### `users` (stage 6)

| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary key |
| `username` | String(32) | Required, unique, stored lowercase. Used to log in, **can't be changed** |
| `display_name` | String(50) | Optional. The name shown in the app, can be anything, **doesn't have to be unique** |
| `email` | String(254) | Optional, unique, stored lowercase |
| `email_verified_at` | DateTime | Optional. When the verification link was clicked. `NULL` = not verified |
| `timezone` | String(64) | Optional, e.g. `America/Toronto`. Sent automatically by the browser |
| `password_hash` | String(255) | Required |
| `created_at` | DateTime | Required, defaults to the time the row is created |

### `lists`

| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary key |
| `name` | String(100) | Required |
| `user_id` | Integer | Added in stage 6: foreign key to `users.id`, required, `ondelete="CASCADE"`, indexed |

### `tasks`

| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary key |
| `list_id` | Integer | Foreign key to `lists.id`, required, `ondelete="CASCADE"`, indexed |
| `text` | String(500) | Required |
| `completed` | Boolean | Required, defaults to `False` |
| `color` | String(7) | Optional, e.g. `#ff0000` |
| `due_date` | Date | Optional |
| `position` | Integer | Required, drag and drop order |
| `reminded_for` | Date | Optional. The due date a reminder email was already sent for |

---

## Why it's designed this way

### From the start

- **`tasks` has no `user_id`:** a task belongs to a list and a list belongs to a user, so we already know whose task it is. Storing it twice would let the data get out of sync.
- **The database assigns `id`:** `Date.now()` in JS is a 13-digit number, way bigger than a PostgreSQL Integer (about 2.1 billion). The JS has to use the `id` the server sends back.
- **`position` stores the drag and drop order:** a database doesn't guarantee row order, so this column is needed for sorting.
- **`due_date` in the database, `dueDate` in JS:** Python and SQL use `snake_case`, and `to_dict()` renames it to `dueDate` for the JS.
- **Indexes on `lists.user_id` and `tasks.list_id`:** the app searches by these two columns all the time, and PostgreSQL doesn't index foreign keys by itself.
- **`completed` and `position` are `nullable=False`:** stops `NULL` values from breaking the filters and the order.
- **The class is called `TodoList`:** the table is still `lists`, and the class doesn't get confused with Python's `list`.

### Display name

- **`username` and `display_name` are separate:** `username` is for logging in, so it has to be unique and never change. `display_name` is just for showing, people can use anything, and two people can have the same one.
- **`display_name` can be empty:** then the app shows the `username`. The code uses `user.shown_name` (a `@property` in `models.py`) so we don't write `display_name or username` everywhere.
- **Empty is stored as `None`, not `""`:** only one way to say "no name set", easier to check.

### Email

- **`email` is unique:** one email belongs to one account, otherwise a reminder could go to the wrong account.
- **`email` can be empty:** email is optional, old accounts without one keep working. Multiple `NULL`s don't count as duplicates, so `unique` still works.
- **`email_verified_at` is a datetime, not `True/False`:** it tells us if it's verified (`NULL` or not) and also when.
- **Changing the email sets `email_verified_at` back to `NULL`:** the new address has to be verified again. Reminders only go to verified emails.
- **254 characters:** the longest an email address can be.

### Timezone and reminders

- **`timezone` stores a name (`America/Toronto`), not an offset (`-5`):** the offset changes with daylight saving time, the name doesn't. Python works out the right offset for each date.
- **Why we need a timezone:** "tomorrow" in Toronto and in Vietnam can be two different dates. A "your task is due tomorrow" email has to use the user's own time.
- **`reminded_for` is a date, not `True/False`:** if we already sent a reminder and the user then **changes the due date**, `reminded_for` no longer equals `due_date`, so the new date gets its own reminder. With `True/False` we'd have to remember to reset it every time the date changes.
- **Also thanks to `reminded_for`:** if the reminder job accidentally runs twice in one day, nobody gets 2 emails.

---

## Primary keys and foreign keys

- **Primary key:** a unique ID for every row, e.g. `tasks.id`.
- **Foreign key:** a column that points to another table's primary key, e.g. `tasks.list_id` points to `lists.id`. The database won't let you create a task in a list that doesn't exist.
- **One-to-many:** the foreign key always goes on the "many" side, so `list_id` is in `tasks` and `user_id` is in `lists`.

---

## What gets deleted along with what?

```text
delete a user  ->  all of their lists go  ->  all tasks in those lists go
delete a list  ->  all of its tasks go
```

It's declared in 2 places:

| Declaration | Where | Who does it |
|---|---|---|
| `cascade="all, delete-orphan"` on `db.relationship` | Python | SQLAlchemy |
| `ondelete="CASCADE"` on the foreign key | Database | The database |

Note for SQLite: by default SQLite doesn't enforce `ondelete="CASCADE"`. Tasks still get deleted with their list thanks to `cascade="all, delete-orphan"`, as long as the list is deleted with `db.session.delete(list)`.

---

## Constraint naming convention

Set in `app/extensions.py`, before the first migration:

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

Names it generates:

| Key | Type | What it does | Generated name |
|---|---|---|---|
| `pk` | Primary key | Identifies each row | `pk_tasks` |
| `fk` | Foreign key | Links to another table | `fk_tasks_list_id_lists`, `fk_lists_user_id_users` |
| `uq` | Unique | No duplicate values | `uq_users_username`, `uq_users_email` |
| `ix` | Index | Faster lookups | `ix_tasks_list_id`, `ix_lists_user_id` |
| `ck` | Check | Checks a condition on the data | `ck_tasks_valid_color` |

Why: to change or drop a constraint, a migration needs to know its name. Without a convention every database names them its own way, or not at all (SQLite).

SQLite also needs `Migrate(render_as_batch=True)` because it can't add a foreign key to an existing table.

---

## Migration history

In order, files are in `migrations/versions/`:

| Revision | Name | Change |
|---|---|---|
| `a62d8d9419da` | Create lists and tasks | Create `lists`, `tasks` (stage 3) |
| `36f0d677e920` | Add users and list owner | Create `users`, add `lists.user_id` (stage 6) |
| `c08b573e7c6b` | Add display name to users | Add `users.display_name` |
| `ad38363f31db` | Add email, timezone and task reminders | Add `users.email` (unique), `users.email_verified_at`, `users.timezone`, `tasks.reminded_for` |

- The last three only **add optional columns**, so they run fine on a database that already has data. Old rows get `NULL`.
- `36f0d677e920` adds a **required** `lists.user_id`. It worked because `lists` was empty at the time. If `lists` had rows, the old rows would need a `user_id` first.
- Check which revision the database is on: `flask db current`.

---

## Migration commands

```powershell
# only once
flask --app wsgi db init
# generate a migration file
flask --app wsgi db migrate -m "Create lists and tasks"
# apply it to the database
flask --app wsgi db upgrade
# go back one step
flask --app wsgi db downgrade
# which revision the database is on
flask --app wsgi db current
```

- `create_app()` has to import the models, or `migrate` won't see the tables.
- Always read the generated file in `migrations/versions/` before running `upgrade`.
- Adding a required column to a table that already has data fails, because the old rows have no value for it.
- If you change `models.py` and forget `migrate` + `upgrade`, the app crashes with `no such table: users` or `no such column`.

---

## Connection pool (stage 9, Neon)

A **connection pool** is a group of database connections that are opened once and kept around to be reused.

### Why it's needed

Every time the app reads or writes the database it needs a connection. Opening a new one is slow: find the Neon server over the network, set up encryption (SSL), log in. That's about **100–300 ms**.

If every request opened a new connection and closed it right after, the app would be slow.

### How it works

```text
Request 1 → borrow connection A from the pool → run the query → give A back
Request 2 → borrow A again (already open)     → run the query → give A back
```

Connections are borrowed and returned, not closed. The next request uses one straight away, without waiting to open a new one. **SQLAlchemy does this by itself**, there's no code to write.

Like a bike-share: instead of buying a new bike for every trip, you take one from the station and put it back for the next person.

### The problem with Neon, and the fix

Neon puts the database to sleep when nobody uses it, and closes connections that have been idle for a while. But the pool doesn't know that: it still thinks connection A is open. The next request borrows A, and the query fails with a connection error.

In `create_app()`:

```python
SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True, "pool_recycle": 300}
```

| Option | What it does | Bike-share version |
|---|---|---|
| `pool_pre_ping=True` | Before lending a connection, send a tiny test query (like `SELECT 1`). If it's dead, throw it away and open a new one | Check the tires before handing out the bike |
| `pool_recycle=300` | Replace any connection older than 300 seconds (5 min), before the server gets a chance to close it | Retire bikes regularly instead of waiting for them to break |

The cost: the ping adds a tiny bit of time to each request. Much better than random errors.

### SQLite vs Neon

- **SQLite** (local, and in the tests) is a file on your own disk, so opening it is almost free. The pool matters much less.
- **Neon** is a server somewhere else on the internet, so the pool (and `pre_ping`) really matters.

That's also why the symptom "random database connection errors on Render" means `pool_pre_ping` is missing (see `FLASK_GUIDE.md`).
