import re
from datetime import date
from flask import Blueprint, abort, jsonify, request
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from .extensions import db
from .models import Task, TodoList

blueprint = Blueprint("api", __name__)

COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")

# ---------- validation ----------
# don't trust anything the client sends (JS could have a bug, or someone calls the API directly)
# bad input -> abort(400, "reason") and flask stops right there

def get_json_body():
    # silent=True returns None instead of raising when the body isn't valid json
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, "Request body must be a JSON object")
    return data

def validate_text(value, field, max_length):
    # has to be a string, not empty after strip, and fit in the column
    if not isinstance(value, str) or not value.strip():
        abort(400, f"{field} must be a non-empty string")
    value = value.strip()
    if len(value) > max_length:
        abort(400, f"{field} must be at most {max_length} characters")
    return value

def validate_color(value):
    if value is None:
        return None
    if not isinstance(value, str) or not COLOR_PATTERN.match(value):
        abort(400, "color must look like #rrggbb")
    return value.lower()

def validate_due_date(value):
    if value is None:
        return None
    try:
        # "2026-11-07" -> date(2026, 11, 7)
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        abort(400, "dueDate must be a date like 2026-11-07")
        
def validate_completed(value):
    if not isinstance(value, bool):
        abort(400, "completed must be true or false")
    return value

# ---------- lookups ----------
# flask pulls <int:list_id> out of the url and passes it in
def get_list_or_404(list_id):
    return db.get_or_404(TodoList, list_id, description="List not found")

def get_task_or_404(task_id):
    return db.get_or_404(Task, task_id, description="Task not found")

# ---------- lists ----------
@blueprint.get("/lists")
def get_lists():
    # selectinload gets all the tasks in one query:
    # SELECT * FROM tasks WHERE list_id IN (1, 2, ..., 100) ORDER BY position;
    # instead of one query per list (WHERE list_id = 1, then 2, ...)
    query = db.select(TodoList).options(selectinload(TodoList.tasks)).order_by(TodoList.id)
    lists = db.session.scalars(query).all()
    return jsonify([todo_list.to_dict() for todo_list in lists])

@blueprint.post("/lists")
def create_list():
    data = get_json_body()
    name = validate_text(data.get("name"), "name", 100)
    # returns {"id": 5, "name": "Chores", "tasks": []}
 
    todo_list = TodoList(name=name)
    db.session.add(todo_list)
    db.session.commit()          # id gets assigned here
    return jsonify(todo_list.to_dict()), 201   # 201 = created

@blueprint.patch("/lists/<int:list_id>")
def update_list(list_id):
    todo_list = get_list_or_404(list_id)
    data = get_json_body()
    
    if "name" in data:
        todo_list.name = validate_text(data["name"], "name", 100)
    
    db.session.commit()
    return jsonify(todo_list.to_dict())

@blueprint.delete("/lists/<int:list_id>")
def delete_list(list_id):
    todo_list = get_list_or_404(list_id)
    db.session.delete(todo_list)   # tasks go too (cascade)
    db.session.commit()
    return "", 204                 # 204 = ok, nothing to return

# ---------- tasks ----------
@blueprint.post("/lists/<int:list_id>/tasks")
def create_task(list_id):
    todo_list = get_list_or_404(list_id)
    data = get_json_body()
    text = validate_text(data.get("text"), "text", 500)
    color = validate_color(data.get("color"))
    due_date = validate_due_date(data.get("dueDate"))
    
    # new task goes last: max position + 1 (max is None if the list is empty)
    max_position = db.session.scalar(
        db.select(func.max(Task.position)).where(Task.list_id == todo_list.id)
    )
    
    position = 0 if max_position is None else max_position + 1
    
    task = Task(
        list_id = todo_list.id,
        text = text,
        color = color,
        due_date = due_date,
        position = position
    )
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201

@blueprint.put("/lists/<int:list_id>/order")
def reorder_tasks(list_id):
    todo_list = get_list_or_404(list_id)
    data = get_json_body()
    task_ids = data.get("taskIds")
    # has to be a list of ints (bool counts as int in python so exclude it)
    if not isinstance(task_ids,list) or not all(
        isinstance(i, int) and not isinstance(i, bool) for i in task_ids
    ):
        abort(400, "taskIds must be a list of integers")
        
    # id -> task, only this list's tasks
    tasks_by_id = {task.id: task for task in todo_list.tasks}
    
    # follow taskIds, skip ids from other lists and duplicates
    ordered = []
    seen = set()
    for task_id in task_ids:
        if task_id in tasks_by_id and task_id not in seen:
            ordered.append(tasks_by_id[task_id])
            seen.add(task_id)
            
    # tasks the client didn't send (e.g. added on another device) keep their old order at the end
    # so nothing gets lost
    ordered += [task for task in todo_list.tasks if task.id not in seen]
    
    for position, task in enumerate(ordered):
        task.position = position
    
    db.session.commit()
    return "", 204

@blueprint.patch("/tasks/<int:task_id>")
def update_task(task_id):
    task = get_task_or_404(task_id)
    data = get_json_body()
    
    # only touch fields that are in the request.
    # {"color": null} clears the color, not sending "color" leaves it alone
    if "text" in data:
        task.text = validate_text(data["text"], "text", 500)
    if "completed" in data:
        task.completed = validate_completed(data["completed"])
    if "color" in data:
        task.color = validate_color(data["color"])
    if "dueDate" in data:
        task.due_date = validate_due_date(data["dueDate"])
    
    db.session.commit()
    return jsonify(task.to_dict())

@blueprint.delete("/tasks/<int:task_id>")
def delete_task(task_id):
    task = get_task_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return "", 204

# ---------- json errors ----------
# registered on the app, not the blueprint. a bad url like /api/abc doesn't match
# any blueprint route so a blueprint handler would never see it
 
def register_error_handlers(app):
    def handle_error(error):
        # /api/ gets json so the JS can read it
        if request.path.startswith("/api/"):
            return jsonify(error=error.description), error.code
        # normal pages keep flask's default error page
        return error
 
    for code in (400, 404, 405):
        app.register_error_handler(code, handle_error)


# ---------- manual API test (PowerShell) ----------
# it's inside a """ string instead of # comments so i can copy paste it straight into powershell.
# run "flask run" in one terminal, paste the blocks in order in another one
# ($B, $L, $t1... stick around between pastes)
"""
# 0. base url
$B = "http://127.0.0.1:5000/api"

# 1. get all lists
Invoke-RestMethod "$B/lists" | ConvertTo-Json -Depth 5

# 2. make a list, save its id in $L
$L = (Invoke-RestMethod -Method Post "$B/lists" -ContentType "application/json" -Body '{"name":"Test list"}').id
$L

# 3. rename it
Invoke-RestMethod -Method Patch "$B/lists/$L" -ContentType "application/json" -Body '{"name":"Renamed"}'

# 4. add 3 tasks (positions 0, 1, 2)
$t1 = (Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"Task A"}').id
$t2 = (Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"Task B","color":"#ff8800"}').id
$t3 = (Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"Task C","dueDate":"2026-11-08"}').id
"$t1 $t2 $t3"

# 5. mark one done, clear a color
Invoke-RestMethod -Method Patch "$B/tasks/$t1" -ContentType "application/json" -Body '{"completed":true}'
Invoke-RestMethod -Method Patch "$B/tasks/$t2" -ContentType "application/json" -Body '{"color":null}'

# 6. reorder to C, A, B and check it
Invoke-RestMethod -Method Put "$B/lists/$L/order" -ContentType "application/json" -Body (@{taskIds = @($t3, $t1, $t2)} | ConvertTo-Json)
(Invoke-RestMethod "$B/lists") | Where-Object id -eq $L | ConvertTo-Json -Depth 5

# 7. bad requests, each should fail with 400 / 404 (red text = good)
Invoke-RestMethod -Method Post "$B/lists" -ContentType "application/json" -Body '{"name":"   "}'
Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"X","color":"red"}'
Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"X","dueDate":"08/11/2026"}'
Invoke-RestMethod -Method Patch "$B/tasks/$t1" -ContentType "application/json" -Body '{"completed":"yes"}'
Invoke-RestMethod -Method Put "$B/lists/$L/order" -ContentType "application/json" -Body '{"taskIds":"1,2,3"}'
Invoke-RestMethod -Method Put "$B/lists/$L/order" -ContentType "application/json" -Body '{"taskIds":["1","2"]}'
Invoke-RestMethod -Method Put "$B/lists/$L/order" -ContentType "application/json" -Body '{"taskIds":[true,false]}'
Invoke-RestMethod -Method Post "$B/lists" -ContentType "application/json" -Body 'not json'
Invoke-RestMethod "$B/lists/999999" -Method Patch -ContentType "application/json" -Body '{"name":"x"}'
Invoke-RestMethod "$B/does-not-exist"

# 8. cleanup: delete a task, then the list (cascade gets the rest)
Invoke-RestMethod -Method Delete "$B/tasks/$t3"
Invoke-RestMethod -Method Delete "$B/lists/$L"
"""