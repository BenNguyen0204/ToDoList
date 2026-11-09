# Notes: GET, POST and Blueprints in Flask

## Does a Blueprint run by itself?

No. A Blueprint only works after it's registered with `register_blueprint`.

This happens once, when the server starts:

```text
wsgi.py calls create_app()
  → creates the Flask app
  → imports pages.py (its routes are collected in the blueprint)
  → app.register_blueprint(...) (attaches those routes to the app)
```

After that, for every request Flask finds the matching route and calls its function.

- Forget `register_blueprint` and there's no error at startup, but the URLs give 404.
- You never call `index()` yourself. Flask calls it when someone opens `/`.

---

## What are GET and POST?

Every request to the server has a method that tells the server what the client wants to do.

| | GET | POST |
|---|---|---|
| **Purpose** | Get data | Send data to create something |
| **Data goes in** | The URL, e.g. `/tasks?done=true` | The request body |
| **Changes data?** | No | Yes |
| **Sending it again** | Safe, same result | Can create another record each time |
| **Happens when** | Opening a URL, loading CSS, images | Submitting a form, `fetch` with `method: "POST"` |

Never put passwords or sensitive data in a GET URL, because URLs end up in the browser history and server logs.

---

## Writing routes in Flask

By default a route only accepts GET. To accept other methods, declare `methods`.

```python
from flask import Blueprint, jsonify, request

api = Blueprint("api", __name__)
# just an example, the data is lost when the server stops
tasks = []


@api.route("/tasks", methods=["GET"])
def get_tasks():
    return jsonify(tasks)


@api.route("/tasks", methods=["POST"])
def create_task():
    data = request.get_json()
    task = {"id": len(tasks) + 1, "text": data["text"]}
    tasks.append(task)
    return jsonify(task), 201
```

- `request.get_json()`: reads the JSON in the request body.
- `request.args.get("done")`: reads a parameter from a GET URL, e.g. `/tasks?done=true`.
- `jsonify(...)`: returns the data as JSON.
- `, 201`: sets the response status code.

Flask 2.0+ has a shorter way: `@api.get("/tasks")` and `@api.post("/tasks")`.

---

## Calling it from JavaScript

```js
// GET: get the list of tasks
const response = await fetch("/api/tasks");
const tasks = await response.json();

// POST: create a new task
const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Learn Flask" }),
});
const task = await response.json();
```

These are two separate examples, don't paste them together because `response` would be declared twice.

Without the `Content-Type: application/json` header, `request.get_json()` fails with 415.

In this project, every non-GET request also sends an `X-CSRFToken` header (stage 7), see `SESSION_COOKIE.md`.

---

## What happens when you rename a list

Renaming the list with id 5:

```text
1. Edit the name, press Enter or click away   (browser)
        ↓
2. JS sends PATCH /api/lists/5                (apiSave, with {"name": "Chores"})
        ↓
3. Flask runs update_list(list_id=5)          (5 comes from the URL)
        ↓
4. get_list_or_404(5)                         (find the list for the current user, 404 if not found)
        ↓
5. get_json_body()                            (read the JSON, 400 if it's not valid)
        ↓
6. todo_list.name = validate_text(...)        (changed in the session only, not saved yet)
        ↓
7. db.session.commit()                        (saved to the database)
        ↓
8. return jsonify(todo_list.to_dict())        (send the updated list back to JS, status 200)
        ↓
9. JS updates list.name and redraws
```

Compared to adding a list, 2 differences:

- The id already exists, so it's in the URL. When adding a list, the database only assigns the id at `commit()`.
- No `db.session.add()` needed, an object loaded from the database is already in the session.

---

## How ids are created and passed around

The database creates an id exactly once, the backend sends it to the frontend, and the frontend sends it back in the URL whenever it wants to do something with that list. Say a new list gets id 5:

```text
 SETUP (once)
 models.py              id = db.Column(db.Integer, primary_key=True)
    ↓ flask db migrate + flask db upgrade
 instance/todo.db       the lists table has an auto-numbered id column


 CREATING THE LIST
 Browser       click +, type a name
    ↓ POST /api/lists   {"name": "Chores"}        ← no id yet
 Flask         create_list() → add() → commit()
    ↓ INSERT
 Database      new row, ASSIGNS id = 5            ← the id is born here
    ↓
 Flask         todo_list.id = 5
    ↓ to_dict() + jsonify, returns 201
 Browser       {"id": 5, "name": "Chores", "tasks": []}


 FRONTEND KEEPS THE ID
 lists                  has an item {id: 5, ...}
 currentListId = 5      the selected list
 localStorage           remembers currentListId after a reload


 USING THE ID AGAIN
 Browser       rename the list
    ↓ PATCH /api/lists/5   {"name": "School"}     ← id is in the URL
 Flask         <int:list_id> → update_list(list_id=5)
    ↓ get_list_or_404(5)
 Database      find the row with id = 5, update it, save


 RELOADING THE PAGE
 loadList()    GET /api/lists → backend returns every list with its id
               keep currentListId if it's still in lists, otherwise take the first one


 TASKS POINT TO THE LIST
 tasks.list_id = 5      records that this task belongs to list 5
```

The id has a different name in each place, but it's the same number:

| Where | Name |
|---|---|
| Database, `lists` table | `id` |
| Database, `tasks` table | `list_id` |
| Python object | `todo_list.id` |
| JSON sent to JS | `"id"` |
| JS variable | `list.id`, `currentListId` |
| URL | `/api/lists/5` |
| Flask parameter | `list_id` |

3 things to remember:

1. Only the database creates ids. Everything else just stores and passes them on.
2. Creating something has no id yet, everything after that needs one. That's why `POST /lists` has no id in the URL but `PATCH /lists/5` does.
3. Never trust an id from the client. `get_list_or_404` checks that it exists **and** that it belongs to the logged-in user (stage 6).

---

## Other methods

A REST API for tasks usually has these routes:

| Method | URL | What it does |
|---|---|---|
| GET | `/api/tasks` | Get all tasks |
| GET | `/api/tasks/5` | Get task 5 |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/5` | Replace task 5 completely |
| PATCH | `/api/tasks/5` | Change part of it, e.g. only `done` |
| DELETE | `/api/tasks/5` | Delete task 5 |

Same URL with a different method means a different action.

---

## Common status codes

| Code | Meaning | When |
|---|---|---|
| 200 | OK | Request worked |
| 201 | Created | POST created a new record |
| 204 | No Content | Worked, nothing to send back, common for DELETE |
| 400 | Bad Request | The data sent is wrong |
| 401 | Unauthorized | Not logged in |
| 403 | Forbidden | Logged in but not allowed |
| 404 | Not Found | The URL or record doesn't exist |
| 405 | Method Not Allowed | The route exists but doesn't accept this method |
| 415 | Unsupported Media Type | Wrong `Content-Type` |
| 429 | Too Many Requests | Called too many times, blocked by the rate limit (see `RATE_LIMIT.md`) |
| 500 | Internal Server Error | The server code crashed |
| 502 | Bad Gateway | Our server is fine but an outside service failed. In this project: Brevo couldn't send an email |

The most common 405 when starting out: sending a POST to a route without `methods=["POST"]`.
