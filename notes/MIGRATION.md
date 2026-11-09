# Notes: Migrations

## What is a migration?

A migration is how a change in `models.py` gets into the real database.

There are 2 separate places:

- **`models.py`:** describes the tables in code.
- **`todo.db`:** the real tables, where the data lives.

Changing `models.py` doesn't change `todo.db` by itself. A migration is the bridge between the two, and it keeps the existing data.

Think of `models.py` as the blueprint, the database as the house, and each migration as one renovation that follows the new blueprint without throwing out the furniture.

---

## Commands

| Command | What it does | Real-life version |
|---|---|---|
| `db init` | Creates the `migrations/` folder, only run once | Buy a notebook |
| `db migrate` | Compares `models.py` with the database and writes the changes to a file. **Doesn't touch the database yet** | Write the to-do list in the notebook |
| `db upgrade` | Runs that file, **now the database changes** | Do what the notebook says |
| `db downgrade` | Undoes the most recent change | Undo it |

```powershell
flask --app wsgi db init
flask --app wsgi db migrate -m "Create lists and tasks"
flask --app wsgi db upgrade
flask --app wsgi db downgrade
```

---

## Every time the structure changes

1. Change the table or column in `models.py`.
2. Run `db migrate -m "describe the change"`.
3. Open the new file in `migrations/versions/` and read it.
4. Run `db upgrade`.
5. Commit both `models.py` and the `migrations/` folder.

---

## When do I need a migration?

| What you did | Migration? |
|---|---|
| Add, edit, delete a task, tick it done | No, that's data |
| Change `to_dict()`, add a route, change HTML, CSS, JS | No, that's not table structure |
| Add, remove, rename a column | Yes |
| Change a column's type or constraint | Yes |
| Add, remove a table | Yes |

---

## What if I don't migrate?

- **Change `models.py` without migrating:** the code and the database don't match, and the app crashes with `no such column: tasks.priority`.
- **Use `db.create_all()`:** it only creates missing tables, it doesn't change existing ones, so you still get the error above.
- **Delete the database and recreate it:** works, but all data is gone. Fine while learning, not once real people use the app.
- **Run `ALTER TABLE` by hand:** you'd have to remember to run the exact same thing on every machine and server. Miss one and every database is different.

---

## What a migration file looks like

```python
# this migration's ID
revision = "a1b2c3"
# the migration right before it
down_revision = "9f8e7d"

def upgrade():
    # forward: add a column
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("priority", sa.Integer(), nullable=True))

def downgrade():
    # back: remove the column
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("priority")
```

`down_revision` links the migrations into a chain, so the database knows where it is and which ones it still needs to run:

```text
Create lists, tasks → Add users + user_id → Add display_name → Add email, timezone, reminded_for
```

`batch_alter_table` is batch mode, needed for SQLite because SQLite doesn't fully support `ALTER TABLE`. It creates a new table, copies the data over, drops the old one and renames the new one.

---

## Compared to Git

| Git | Migration |
|---|---|
| `git commit` | `db migrate` |
| Commit history | The `migrations/versions/` folder |
| `git pull` to get new code | `db upgrade` to update the database |
| `git revert` | `db downgrade` |

---

## Reading the log

```text
Running upgrade  -> a62d8d9419da, Create lists and tasks
Running downgrade a62d8d9419da -> , Create lists and tasks
```

- `a62d8d9419da` is the migration's ID, like a commit hash in Git.
- ` -> a62d8d9419da`: going from empty up to that migration.
- `a62d8d9419da -> `: going from that migration back to empty.
- `Context impl SQLiteImpl`: using SQLite.
- `non-transactional DDL`: if a migration fails halfway, SQLite doesn't undo the steps that already ran.

Run `db downgrade` then `db upgrade` to check a migration works both ways.

---

## Things to remember

- Always read the generated file before `upgrade`. `db migrate` only guesses and can guess wrong. For example, renaming a column can be read as "drop the old column, add a new one", which loses the data.
- If `downgrade` drops a table, the data in it is gone, and `upgrade` only creates an empty table again. Don't test like that with real data.
- `create_app()` has to import the models or `db migrate` won't see the tables.
- Adding a required column to a table that already has data fails, because the old rows have no value for it.
- Commit the `migrations/` folder to GitHub, but never `todo.db`.
- The full list of this project's migrations is in `DATABASE.md`.
