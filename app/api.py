import re
from datetime import date
from flask import Blueprint, abort, jsonify, request
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from .extensions import db
from .models import Task, TodoList

blueprint = Blueprint("api", __name__)

COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")

# ---------- Kiểm tra dữ liệu từ client ----------
# Không bao giờ tin dữ liệu gửi lên: JS có thể có bug, hoặc ai đó gọi API trực tiếp.
# Sai thì abort(400, "lý do"), Flask dừng route ngay và trả lỗi 400.

def get_json_body():
    # silent=True: body không phải JSON hợp lệ thì trả None thay vì tự báo lỗi
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, "Request body must be a JSON object")
    return data

def validate_text(value, field, max_length):
    # Phải là chuỗi, không rỗng sau khi bỏ khoảng trắng hai đầu, không quá độ dài cột
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

# ---------- Tìm list và task ----------
# khai báo <int:list_id> trong URL của route, Flask sẽ tự lấy giá trị đó và truyền vào hàm
def get_list_or_404(list_id):
    return db.get_or_404(TodoList, list_id, description="List not found")

def get_task_or_404(task_id):
    return db.get_or_404(Task, task_id, description="Task not found")

# ---------- List ----------
@blueprint.get("/lists")
def get_lists():
    # SQLAlchemy lấy list trước, gom hết id lại, rồi lấy toàn bộ tasks trong một query:
    # SELECT * FROM tasks WHERE list_id IN (1, 2, ..., 100) ORDER BY position; 
    # thay vi ELECT * FROM tasks WHERE list_id = 1 ORDER BY position;
    query = db.select(TodoList).options(selectinload(TodoList.tasks)).order_by(TodoList.id)
    lists = db.session.scalars(query).all()
    return jsonify([todo_list.to_dict() for todo_list in lists])

@blueprint.post("/lists")
def create_list():
    data = get_json_body()
    name = validate_text(data.get("name"), "name", 100)
    # Một list có 3 key khi ở dạng JSON, và id cũng là một key trong số đó:
    # {
    #   "id": 5,
    #   "name": "Việc nhà",
    #   "tasks": []
    # }
 
    todo_list = TodoList(name=name)
    db.session.add(todo_list)
    db.session.commit()          # sau commit, database đã cấp id cho todo_list
    return jsonify(todo_list.to_dict()), 201   # 201 Created: đã tạo mới

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
    db.session.delete(todo_list)   # cascade trong models.py xoá luôn các task của list
    db.session.commit()
    return "", 204                 # 204 No Content: thành công, không có gì để trả về

# ---------- Task ----------
@blueprint.post("/lists/<int:list_id>/tasks")
def create_task(list_id):
    todo_list = get_list_or_404(list_id)
    data = get_json_body()
    text = validate_text(data.get("text"), "text", 500)
    color = validate_color(data.get("color"))
    due_date = validate_due_date(data.get("dueDate"))
    
    # Task mới nằm cuối danh sách: position = số lớn nhất hiện tại + 1.
    # List chưa có task nào thì max trả về None, khi đó bắt đầu từ 0.
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
    # Kiem tra task co phai cua list ko
    if not isinstance(task_ids,list) or not all(
        isinstance(i, int) and not isinstance(i, bool) for i in task_ids
    ):
        abort(400, "taskIds must be a list of integers")
        
    # Bảng tra id -> task, chỉ gồm task của list này
    tasks_by_id = {task.id: task for task in todo_list.tasks}
    
    # Thứ tự mới: theo taskIds gửi lên, bỏ qua id lạ (không thuộc list này) và id lặp lại.
    ordered = []
    seen = set()
    for task_id in task_ids:
        if task_id in tasks_by_id and task_id not in seen:
            ordered.append(tasks_by_id[task_id])
            seen.add(task_id)
            
    # Task có trong database mà client không gửi (ví dụ vừa được thêm ở thiết bị khác)
    # thì giữ nguyên thứ tự cũ, xếp xuống cuối. Không task nào bị mất.
    ordered += [task for task in todo_list.tasks if task.id not in seen]
    
    for position, task in enumerate(ordered):
        task.position = position
    
    db.session.commit()
    return "", 204

@blueprint.patch("/tasks/<int:task_id>")
def update_task(task_id):
    task = get_task_or_404(task_id)
    data = get_json_body()
    
    # Chỉ sửa trường có trong request.
    # {"color": null} là xoá màu, còn không gửi "color" thì giữ nguyên.
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

# ---------- Lỗi trả về JSON ----------
# Đăng ký ở mức app (không phải Blueprint), vì URL không tồn tại như /api/abc
# không thuộc Blueprint nào, handler của Blueprint sẽ không bắt được.
 
def register_error_handlers(app):
    def handle_error(error):
        # URL bắt đầu bằng /api/ thì trả JSON để JS đọc được
        if request.path.startswith("/api/"):
            return jsonify(error=error.description), error.code
        # Trang thường thì giữ trang lỗi mặc định của Flask
        return error
 
    for code in (400, 404, 405):
        app.register_error_handler(code, handle_error)


# ---------- Lệnh test API (PowerShell) ----------
# Viết trong chuỗi """ (Python bỏ qua) thay vì comment "#" để copy thẳng được:
# PowerShell coi dòng bắt đầu bằng "#" là comment nên paste vào sẽ không chạy gì.
# Cách dùng: một terminal chạy "flask run", mở terminal PowerShell khác,
# copy từng khối theo thứ tự (biến $B, $L, $t1... được giữ lại giữa các lần paste).
"""
# 0. Địa chỉ API
$B = "http://127.0.0.1:5000/api"

# 1. Xem tất cả list
Invoke-RestMethod "$B/lists" | ConvertTo-Json -Depth 5

# 2. Tạo list mới, lưu id vào $L
$L = (Invoke-RestMethod -Method Post "$B/lists" -ContentType "application/json" -Body '{"name":"Test list"}').id
$L

# 3. Đổi tên list
Invoke-RestMethod -Method Patch "$B/lists/$L" -ContentType "application/json" -Body '{"name":"Renamed"}'

# 4. Tạo 3 task (task mới nằm cuối: position 0, 1, 2)
$t1 = (Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"Task A"}').id
$t2 = (Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"Task B","color":"#ff8800"}').id
$t3 = (Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"Task C","dueDate":"2026-11-08"}').id
"$t1 $t2 $t3"

# 5. Sửa task: đánh dấu xong, xoá màu
Invoke-RestMethod -Method Patch "$B/tasks/$t1" -ContentType "application/json" -Body '{"completed":true}'
Invoke-RestMethod -Method Patch "$B/tasks/$t2" -ContentType "application/json" -Body '{"color":null}'

# 6. Sắp xếp lại thành C, A, B rồi xem kết quả (thứ tự tasks phải là C, A, B)
Invoke-RestMethod -Method Put "$B/lists/$L/order" -ContentType "application/json" -Body (@{taskIds = @($t3, $t1, $t2)} | ConvertTo-Json)
(Invoke-RestMethod "$B/lists") | Where-Object id -eq $L | ConvertTo-Json -Depth 5

# 7. Các request SAI, mỗi lệnh phải báo lỗi 400 / 404 (chữ đỏ là đúng)
Invoke-RestMethod -Method Post "$B/lists" -ContentType "application/json" -Body '{"name":"   "}'
Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"X","color":"red"}'
Invoke-RestMethod -Method Post "$B/lists/$L/tasks" -ContentType "application/json" -Body '{"text":"X","dueDate":"08/11/2026"}'
Invoke-RestMethod -Method Patch "$B/tasks/$t1" -ContentType "application/json" -Body '{"completed":"yes"}'
Invoke-RestMethod -Method Put "$B/lists/$L/order" -ContentType "application/json" -Body '{"taskIds":"1,2,3"}'
Invoke-RestMethod -Method Put "$B/lists/$L/order" -ContentType "application/json" -Body '{"taskIds":["1","2"]}'
Invoke-RestMethod -Method Put "$B/lists/$L/order" -ContentType "application/json" -Body '{"taskIds":[true,false]}'
Invoke-RestMethod -Method Post "$B/lists" -ContentType "application/json" -Body 'not json'
Invoke-RestMethod "$B/lists/999999" -Method Patch -ContentType "application/json" -Body '{"name":"x"}'
Invoke-RestMethod "$B/khong-ton-tai"

# 8. Dọn dẹp: xoá 1 task, rồi xoá cả list (cascade xoá luôn task còn lại)
Invoke-RestMethod -Method Delete "$B/tasks/$t3"
Invoke-RestMethod -Method Delete "$B/lists/$L"
"""