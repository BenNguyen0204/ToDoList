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