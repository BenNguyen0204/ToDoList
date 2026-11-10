# Notes: Tests (stage 8)

## Numbers

| | |
|---|---|
| Tests | 8, all in `tests/test_app.py` |
| Coverage | **87%** of `app/` (437 of 501 statements) |
| Run time | ~4–5 seconds |
| Tools | pytest, pytest-cov, Flask's test client |

| File | Coverage |
|---|---|
| `models.py` | 100% |
| `extensions.py` | 93% |
| `__init__.py` | 91% |
| `api.py` | 88% |
| `reminders.py` | 87% |
| `pages.py` | 86% |
| `mailer.py` | 85% |
| `auth.py` | 79% |

Not covered on purpose: the real Brevo HTTP call (we never send real emails in tests), the `flask send-reminders` CLI command, and some rate-limit/error branches.

---

## How to run

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt   # first time only
pytest                                # all tests
pytest -v                             # one line per test
pytest --cov=app                      # with coverage
pytest -k reminders                   # only tests with "reminders" in the name
```

Works from the project root or from `tests\`, because `pytest.ini` marks the root.

---

## Files

| File | What it does |
|---|---|
| `tests/test_app.py` | The fixtures, helpers and 8 tests |
| `pytest.ini` | `pythonpath = .` so `from app import create_app` works, and hides a flask-login warning that isn't our code |
| `requirements-dev.txt` | `requirements.txt` + pytest + pytest-cov. Render only installs `requirements.txt` |

---

## How the setup works

### `create_app(test_config)`

`create_app` takes an optional dict. The tests pass their own settings, and they're applied **before** the `SECRET_KEY` check, otherwise the app would refuse to start without a `.env`.

### The `app` fixture

A fixture is something pytest builds for each test and passes in by name. Every test gets a **brand new app with an empty database**, so tests can't affect each other.

| Setting | Why |
|---|---|
| `SQLALCHEMY_DATABASE_URI` = file in `tmp_path` | Fresh database per test. pytest deletes `tmp_path` afterwards. Never touches `instance/todo.db` |
| `TESTING=True` | Errors show up as real exceptions instead of a 500 page |
| `SECRET_KEY="test"` | Any value works, it just can't be empty |
| `WTF_CSRF_ENABLED=False` | The tests would otherwise have to fetch a CSRF token from a page first |
| `RATELIMIT_ENABLED=False` | Signing up and logging in a lot would hit the limits |
| `SESSION_COOKIE_SECURE=False`, `REMEMBER_COOKIE_SECURE=False` | The test client uses http. Secure cookies wouldn't be sent back, so login wouldn't stick |
| `REGISTRATION_OPEN=True` | A `.env` with sign-ups closed shouldn't break the tests |
| `BREVO_API_KEY=None` | Never send a real email |
| `REMINDER_TOKEN="test-token"` | Turns on `/internal/send-reminders` so it can be tested |

Then `db.create_all()` makes the tables. (The real app uses migrations, but for an empty test database `create_all` is simpler.)

### The `client` fixture

`app.test_client()` sends requests straight to Flask without a real server. It keeps cookies between requests like a browser, so after `register()` you stay logged in.

### Helpers

- `register` / `login`: post the form and check for a `302` redirect, because a failed sign up or login re-renders the form with `200`.
- `logout`: `POST /logout`.
- `create_task`: makes a list and a task, returns the task id.
- `verify_email`: sets an email through the API, then makes the same token the email would contain (`make_verify_token`) and opens `/verify-email/<token>`.

---

## The 8 tests

| # | Test | What it checks |
|---|---|---|
| 1 | `test_api_needs_login` | Logged out → `GET /api/lists` is `401` with `{"error": "Login required"}` (the JS relies on that to go to `/login`) |
| 2 | `test_sign_up_then_log_in` | Sign up → log out → API locked → wrong password doesn't log in → right password does → API returns `[]` |
| 3 | `test_create_edit_delete_task` | Create, edit (text, completed, due date), bad color → `400`, the edit is **actually saved** (read back with `GET`), delete |
| 4 | `test_users_cant_touch_each_others_data` | Bob can't see Alice's lists. Editing/deleting her task, renaming/deleting/adding to her list → all `404`. Alice's data is unchanged afterwards |
| 5 | `test_lists_rename_reorder_delete` | Rename, empty name → `400`, reorder (tasks not sent stay at the end), bad `taskIds` → `400`, deleting a list deletes its tasks |
| 6 | `test_account_settings_and_password_change` | Display name, timezone, fake timezone → `400`, wrong current password / too short → `400`, after changing only the new password works |
| 7 | `test_email_verification` | Bad email → `400`, fake token → `400`, real token verifies, two accounts can't share an email |
| 8 | `test_reminders` | Missing/wrong token → `404`, only the task due tomorrow is in the email, running twice doesn't send a second email |

### Faking the email in test 8

```python
sent = []
monkeypatch.setattr(reminders, "send_email", lambda to, subject, text: sent.append((to, subject, text)))
```

`monkeypatch` swaps `send_email` inside `reminders.py` for a function that just saves the email in a list, and puts the real one back after the test. Then the test can check who it went to and what it said.

It patches `reminders.send_email`, not `mailer.send_email`, because `reminders.py` did `from .mailer import send_email`, so it has its own name pointing to the function.

---

## Checking that the tests actually test something

A test that never fails is useless. For the important ones I broke the code on purpose and made sure the test went red:

| Broke | Test that failed | Error |
|---|---|---|
| Removed `user_id=current_user.id` from `get_list_or_404` | test 4 | Bob renaming Alice's list got `200` instead of `404` |
| Removed `task.reminded_for = task.due_date` in `reminders.py` | test 8 | Second run sent `1` email instead of `0` |

Then put the code back (`git checkout app/api.py`).

---

## Things worth knowing

- **Each test starts from zero.** No test depends on another one running first, so they can run in any order or alone.
- **Read the data back.** Checking the `PATCH` response isn't enough, the route could return the right JSON without saving. Test 3 does a `GET` afterwards.
- **Test the "no" cases.** Most of the asserts are about things that should fail: wrong password, someone else's id, bad input, wrong token.
- **Why 87% and not 100%?** The last % are things like the real Brevo call and rare error branches. Testing those needs a lot of mocking for little value. What matters more is that the risky parts (ownership, login, reminders) are tested and that the tests can fail.

---

## Next

- Run the tests on every push with GitHub Actions (CI).
- Test the rate limits (turn them on for one test).
- A test with the user's timezone set, so "tomorrow" is different from UTC.
