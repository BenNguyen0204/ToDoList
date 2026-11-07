# Ghi chú: Các hàm và lệnh dùng trong project

Tra cứu nhanh mọi hàm, lớp và lệnh dùng trong ToDoList, xếp theo nhóm.
Mỗi mục ghi giai đoạn bắt đầu dùng, ví dụ **[GĐ 4]**. Mục có dấu ⏳ là của giai đoạn chưa làm tới.

Mục lục:

1. [Python: Flask](#1-python-flask)
2. [Python: Database (Flask-SQLAlchemy, SQLAlchemy)](#2-python-database-flask-sqlalchemy-sqlalchemy)
3. [Python: Migration (Flask-Migrate, Alembic)](#3-python-migration-flask-migrate-alembic)
4. [Python: Có sẵn trong Python](#4-python-có-sẵn-trong-python)
5. [Python: Hàm tự viết trong project](#5-python-hàm-tự-viết-trong-project)
6. [Python: Giai đoạn 6 đến 10](#6-python-giai-đoạn-6-đến-10-)
7. [JavaScript: Có sẵn trong trình duyệt](#7-javascript-có-sẵn-trong-trình-duyệt)
8. [JavaScript: Hàm tự viết trong project](#8-javascript-hàm-tự-viết-trong-project)
9. [Lệnh terminal](#9-lệnh-terminal)

---

## 1. Python: Flask

### Tạo app và cấu hình

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `Flask(__name__)` **[GĐ 1]** | Tạo app. `__name__` giúp Flask tìm thư mục `templates/` và `static/` | `app = Flask(__name__)` |
| `app.config[...]` **[GĐ 3]** | Đọc và ghi cấu hình của app | `app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///todo.db"` |
| `app.config.update({...})` ⏳ GĐ 8 | Ghi nhiều cấu hình một lần | `app.config.update(test_config)` |
| `app.instance_path` | Đường dẫn thư mục `instance/`, nơi chứa file database SQLite | |

### Route và Blueprint

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `Blueprint(tên, __name__)` **[GĐ 2]** | Tạo một nhóm route | `blueprint = Blueprint("api", __name__)` |
| `app.register_blueprint(bp, url_prefix=...)` **[GĐ 2]** | Gắn Blueprint vào app. Quên dòng này thì vào URL bị 404 | `app.register_blueprint(api_blueprint, url_prefix="/api")` |
| `@bp.route(path, methods=[...])` **[GĐ 1]** | Gắn URL với hàm. Mặc định chỉ nhận GET | `@blueprint.route("/", methods=["GET"])` |
| `@bp.get` / `@bp.post` / `@bp.patch` / `@bp.put` / `@bp.delete` **[GĐ 4]** | Viết tắt của `route(..., methods=[...])` | `@blueprint.post("/lists")` |
| `<int:id>` trong URL **[GĐ 4]** | Lấy một phần URL làm tham số, tự đổi sang số. Không phải số thì 404 | `@blueprint.patch("/tasks/<int:task_id>")` → hàm nhận `task_id` |
| `@bp.before_request` ⏳ GĐ 6 | Chạy trước mọi route trong Blueprint. Dùng để bắt đăng nhập cho cả API | |

### Đọc request

| Thuộc tính | Làm gì | Ví dụ |
|---|---|---|
| `request.get_json(silent=True)` **[GĐ 4]** | Đọc body JSON thành dict. `silent=True`: sai định dạng thì trả `None` thay vì báo lỗi | `data = request.get_json(silent=True)` |
| `request.path` **[GĐ 4]** | Đường dẫn của request, ví dụ `/api/lists` | `if request.path.startswith("/api/"):` |
| `request.form` ⏳ GĐ 6 | Dữ liệu từ form HTML (trang đăng nhập) | `request.form.get("username", "")` |
| `request.args` | Tham số sau dấu `?` trong URL | `/tasks?done=true` → `request.args.get("done")` |

### Trả response

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `render_template(file)` **[GĐ 2]** | Trả trang HTML từ `templates/`, có xử lý Jinja | `return render_template("index.html")` |
| `url_for("static", filename=...)` **[GĐ 2]** | Tạo đường dẫn tới file tĩnh. Dùng trong HTML (Jinja) | `{{ url_for('static', filename='styles/base.css') }}` |
| `url_for("tên_bp.tên_hàm")` ⏳ GĐ 6 | Tạo URL tới một route theo tên hàm | `url_for("auth.login")` → `/login` |
| `jsonify(...)` **[GĐ 4]** | Đổi dict hoặc list thành response JSON | `return jsonify(task.to_dict())` |
| `return body, mã` **[GĐ 4]** | Trả kèm mã trạng thái | `return jsonify(...), 201` / `return "", 204` |
| `abort(mã, "lý do")` **[GĐ 4]** | Dừng route ngay, trả lỗi | `abort(400, "name must be a non-empty string")` |
| `redirect(url)` ⏳ GĐ 6 | Chuyển hướng sang trang khác | `return redirect(url_for("pages.index"))` |
| `flash("...")` ⏳ GĐ 6 | Lưu một thông báo để trang sau hiển thị | `flash("Wrong username or password")` |
| `get_flashed_messages()` ⏳ GĐ 6 | Dùng trong Jinja để lấy thông báo đã `flash` | |

### Xử lý lỗi

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `app.register_error_handler(mã, hàm)` **[GĐ 4]** | Hàm chạy khi có lỗi với mã đó. Đặt ở mức app thì bắt được cả URL không tồn tại | `app.register_error_handler(404, handle_error)` |
| `@app.errorhandler(mã)` | Cách viết khác của dòng trên, dạng decorator | |
| `error.code` / `error.description` **[GĐ 4]** | Mã lỗi và lý do của lỗi | `jsonify(error=error.description), error.code` |

### Mã trạng thái HTTP dùng trong project

| Mã | Nghĩa | Khi nào |
|---|---|---|
| 200 | OK | GET, PATCH thành công |
| 201 | Created | POST tạo mới thành công |
| 204 | No Content | DELETE, PUT order thành công, không có gì để trả |
| 400 | Bad Request | Dữ liệu gửi lên sai |
| 401 | Unauthorized | Chưa đăng nhập ⏳ GĐ 6 |
| 404 | Not Found | Không có list hay task đó, hoặc không phải của bạn |
| 405 | Method Not Allowed | Gọi sai method, ví dụ DELETE `/api/lists` |
| 429 | Too Many Requests | Đăng nhập sai quá nhiều lần ⏳ GĐ 7 |
| 500 | Internal Server Error | Code server bị lỗi. Không bao giờ được để xảy ra vì dữ liệu sai |

---

## 2. Python: Database (Flask-SQLAlchemy, SQLAlchemy)

### Khởi tạo

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `SQLAlchemy(metadata=...)` **[GĐ 3]** | Tạo đối tượng `db` | `db = SQLAlchemy(metadata=MetaData(naming_convention=convention))` |
| `MetaData(naming_convention=...)` **[GĐ 3]** | Quy tắc đặt tên constraint, để migration sửa hoặc xoá được | xem `extensions.py` |
| `db.init_app(app)` **[GĐ 3]** | Gắn `db` vào app | |
| `db.create_all()` ⏳ GĐ 8 | Tạo mọi bảng ngay, không qua migration. Chỉ dùng trong test | `with app.app_context(): db.create_all()` |
| `app.app_context()` | Một số việc với `db` cần chạy "bên trong app", ví dụ trong test | `with app.app_context(): ...` |

### Khai báo bảng (model)

| Thứ | Làm gì | Ví dụ |
|---|---|---|
| `class X(db.Model)` **[GĐ 3]** | Mỗi class là một bảng | `class Task(db.Model):` |
| `__tablename__` **[GĐ 3]** | Tên bảng thật trong database | `__tablename__ = "tasks"` |
| `db.Column(kiểu, ...)` **[GĐ 3]** | Một cột | `text = db.Column(db.String(500), nullable=False)` |
| `db.Integer` / `db.String(n)` / `db.Boolean` / `db.Date` / `db.DateTime` | Kiểu dữ liệu của cột | |
| `primary_key=True` | Khoá chính, database tự cấp số | |
| `nullable=False` | Bắt buộc có giá trị | |
| `default=...` | Giá trị mặc định khi không truyền | `default=False` |
| `unique=True` ⏳ GĐ 6 | Không được trùng | `username` |
| `index=True` | Tạo index để tìm nhanh hơn | `list_id` |
| `db.ForeignKey("bảng.cột", ondelete="CASCADE")` **[GĐ 3]** | Khoá ngoại | `db.ForeignKey("lists.id", ondelete="CASCADE")` |
| `db.relationship("Model", back_populates=..., cascade=..., order_by=...)` **[GĐ 3]** | Quan hệ giữa 2 bảng ở mức Python, ví dụ `todo_list.tasks`, `task.todo_list` | xem `models.py` |

### Đọc dữ liệu

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `db.select(Model)` **[GĐ 4]** | Tạo câu truy vấn (chưa chạy) | `db.select(TodoList)` |
| `.where(điều_kiện)` **[GĐ 4]** | Lọc bằng biểu thức | `.where(Task.list_id == 3)` |
| `.filter_by(cột=giá_trị)` ⏳ GĐ 6 | Lọc kiểu viết tắt, so sánh bằng | `.filter_by(id=list_id, user_id=current_user.id)` |
| `.order_by(cột)` **[GĐ 4]** | Sắp xếp | `.order_by(TodoList.id)` |
| `.join(Model)` ⏳ GĐ 6 | Nối bảng | `db.select(Task).join(TodoList)` |
| `.options(selectinload(Model.quan_hệ))` **[GĐ 4]** | Tải luôn dữ liệu quan hệ bằng 1 truy vấn thêm, tránh lỗi N+1 query | `.options(selectinload(TodoList.tasks))` |
| `db.session.scalars(q).all()` **[GĐ 4]** | Chạy truy vấn, lấy danh sách object | `lists = db.session.scalars(query).all()` |
| `db.session.scalars(q).first()` | Lấy object đầu tiên, không có thì `None` | |
| `db.session.scalar(q)` **[GĐ 4]** | Chạy truy vấn trả về đúng 1 giá trị | `db.session.scalar(db.select(func.max(Task.position)))` |
| `func.max(cột)` / `func.count(cột)` **[GĐ 4]** | Hàm SQL: lớn nhất, đếm | `from sqlalchemy import func` |
| `db.session.get(Model, id)` ⏳ GĐ 6 | Tìm theo khoá chính, không có thì `None` | `db.session.get(User, int(user_id))` |
| `db.get_or_404(Model, id, description=...)` **[GĐ 4]** | Tìm theo khoá chính, không có thì tự trả 404 | `db.get_or_404(Task, task_id, description="Task not found")` |
| `db.first_or_404(q, description=...)` ⏳ GĐ 6 | Chạy truy vấn, không có kết quả thì 404 | `db.first_or_404(db.select(TodoList).filter_by(...))` |

### Ghi dữ liệu

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `db.session.add(obj)` **[GĐ 4]** | Đánh dấu object mới để lưu | `db.session.add(task)` |
| `db.session.delete(obj)` **[GĐ 4]** | Đánh dấu object để xoá | `db.session.delete(todo_list)` |
| Gán thuộc tính | Sửa dữ liệu, chỉ cần gán rồi commit | `task.text = "Mới"` |
| `db.session.commit()` **[GĐ 4]** | Lưu thật vào database. Sau commit, object mới có `id` | |
| `db.session.rollback()` ⏳ GĐ 6 | Huỷ các thay đổi chưa commit, dùng khi bị lỗi | sau khi bắt `IntegrityError` |

---

## 3. Python: Migration (Flask-Migrate, Alembic)

| Thứ | Làm gì |
|---|---|
| `Migrate(render_as_batch=True)` **[GĐ 3]** | Tạo `migrate`. Batch mode cần cho SQLite |
| `migrate.init_app(app, db)` **[GĐ 3]** | Gắn vào app, để có lệnh `flask db ...` |
| `op.create_table(...)` / `op.drop_table(...)` | Trong file migration: tạo và xoá bảng |
| `op.batch_alter_table(...)` | Trong file migration: sửa bảng theo kiểu batch (SQLite) |
| `upgrade()` / `downgrade()` | Hàm áp dụng / quay ngược thay đổi trong mỗi file migration |

Lệnh xem ở [mục 9](#9-lệnh-terminal).

---

## 4. Python: Có sẵn trong Python

| Hàm | Làm gì | Ví dụ trong project |
|---|---|---|
| `isinstance(x, kiểu)` **[GĐ 4]** | Kiểm tra kiểu dữ liệu | `isinstance(value, str)` |
| `str.strip()` **[GĐ 4]** | Bỏ khoảng trắng hai đầu | `"  Work ".strip()` → `"Work"` |
| `str.lower()` | Đổi sang chữ thường | `value.lower()` |
| `str.startswith(...)` **[GĐ 4]** | Kiểm tra chuỗi bắt đầu bằng gì | `request.path.startswith("/api/")` |
| `len(x)` | Độ dài | `len(value) > 100` |
| `re.compile(mẫu)` / `.match(chuỗi)` **[GĐ 4]** | Biểu thức chính quy (regex) | `COLOR_PATTERN.match("#e74c3c")` |
| `date.fromisoformat(s)` **[GĐ 4]** | Chuỗi `"2026-11-07"` → `date` | `from datetime import date` |
| `date.isoformat()` **[GĐ 3]** | `date` → chuỗi `"2026-11-07"` | trong `to_dict()` |
| `enumerate(list)` **[GĐ 4]** | Duyệt kèm vị trí | `for position, task in enumerate(ordered):` |
| `all(...)` **[GĐ 4]** | `True` nếu mọi phần tử đều đúng | `all(isinstance(i, int) for i in task_ids)` |
| `set()` / `.add()` / `in` **[GĐ 4]** | Tập hợp, kiểm tra "đã có chưa" rất nhanh | `seen = set()` |
| Dict comprehension | Tạo dict ngắn gọn | `{task.id: task for task in todo_list.tasks}` |
| List comprehension | Tạo list ngắn gọn | `[t.to_dict() for t in self.tasks]` |
| f-string | Chèn biến vào chuỗi | `f"{field} must be a non-empty string"` |
| `try / except (A, B):` **[GĐ 4]** | Bắt lỗi | `except (TypeError, ValueError):` |
| `os.environ.get("TÊN")` ⏳ GĐ 7 | Đọc biến môi trường | `os.environ.get("SECRET_KEY")` |
| `secrets.token_hex(32)` ⏳ GĐ 7 | Tạo chuỗi ngẫu nhiên an toàn | dùng tạo `SECRET_KEY` |
| `raise RuntimeError("...")` ⏳ GĐ 7 | Tự báo lỗi, dừng chương trình | thiếu `SECRET_KEY` |

---

## 5. Python: Hàm tự viết trong project

### `wsgi.py`, `app/__init__.py`

| Hàm | Làm gì |
|---|---|
| `create_app()` **[GĐ 1]** | Tạo app, cấu hình, gắn extension, đăng ký Blueprint, trả về app |
| `app = create_app()` trong `wsgi.py` | Điểm vào: tạo app thật để `flask run` hoặc `gunicorn wsgi:app` chạy |

### `app/models.py` **[GĐ 3]**

| Hàm | Làm gì |
|---|---|
| `TodoList.to_dict()` | Đổi list (kèm mọi task) thành dict để trả JSON |
| `Task.to_dict()` | Đổi task thành dict. Đổi `due_date` thành chuỗi, tên khoá là `dueDate` cho khớp với JS |

### `app/pages.py` **[GĐ 2]**

| Hàm | URL | Làm gì |
|---|---|---|
| `index()` | `GET /` | Trả `index.html` |

### `app/api.py` **[GĐ 4]**

Kiểm tra dữ liệu (sai thì `abort(400)`):

| Hàm | Làm gì |
|---|---|
| `get_json_body()` | Đọc body JSON. Không phải object `{...}` thì 400 |
| `validate_text(value, field, max_length)` | Chuỗi, không rỗng sau `strip()`, không quá độ dài. Trả về chuỗi đã `strip()` |
| `validate_color(value)` | `None` hoặc `#rrggbb`. Trả về chữ thường |
| `validate_due_date(value)` | `None` hoặc `"YYYY-MM-DD"`. Trả về `date` |
| `validate_completed(value)` | Phải là `True`/`False` thật |

Tìm dữ liệu (không có thì 404). Giai đoạn 6 thêm điều kiện người dùng ở đây:

| Hàm | Làm gì |
|---|---|
| `get_list_or_404(list_id)` | Tìm list theo id |
| `get_task_or_404(task_id)` | Tìm task theo id |

Route:

| Hàm | Method + URL | Thành công |
|---|---|---|
| `get_lists()` | `GET /api/lists` | 200, mảng list kèm task |
| `create_list()` | `POST /api/lists` `{name}` | 201, list mới |
| `update_list(list_id)` | `PATCH /api/lists/<id>` `{name}` | 200, list đã sửa |
| `delete_list(list_id)` | `DELETE /api/lists/<id>` | 204 |
| `create_task(list_id)` | `POST /api/lists/<id>/tasks` `{text, color, dueDate}` | 201, task mới |
| `reorder_tasks(list_id)` | `PUT /api/lists/<id>/order` `{taskIds: [...]}` | 204 |
| `update_task(task_id)` | `PATCH /api/tasks/<id>` (chỉ trường có gửi) | 200, task đã sửa |
| `delete_task(task_id)` | `DELETE /api/tasks/<id>` | 204 |

Lỗi:

| Hàm | Làm gì |
|---|---|
| `register_error_handlers(app)` | URL `/api/...` bị lỗi 400/404/405 thì trả JSON `{"error": "..."}`, trang thường giữ trang lỗi HTML |

---

## 6. Python: Giai đoạn 6 đến 10 ⏳

### Đăng nhập: Flask-Login **[GĐ 6]**

| Thứ | Làm gì |
|---|---|
| `LoginManager()` / `login_manager.init_app(app)` | Tạo và gắn bộ quản lý đăng nhập |
| `UserMixin` | Cho class `User` kế thừa, có sẵn các thuộc tính Flask-Login cần |
| `@login_manager.user_loader` | Hàm nhận id từ session, trả về `User`. Flask-Login gọi ở mỗi request |
| `@login_manager.unauthorized_handler` | Chạy khi chưa đăng nhập mà vào trang cần đăng nhập |
| `login_user(user, remember=True)` | Đăng nhập: lưu id vào session cookie |
| `logout_user()` | Đăng xuất |
| `@login_required` | Đặt trên route, bắt buộc đăng nhập |
| `current_user` | Người dùng của request hiện tại. `current_user.id`, `current_user.is_authenticated` |

### Mật khẩu và lỗi database **[GĐ 6]**

| Thứ | Làm gì |
|---|---|
| `generate_password_hash(pw)` | Băm mật khẩu để lưu. Không bao giờ lưu mật khẩu gốc. `from werkzeug.security import ...` |
| `check_password_hash(hash, pw)` | So mật khẩu nhập vào với bản đã băm |
| `IntegrityError` | Lỗi khi vi phạm ràng buộc, ví dụ trùng username. `from sqlalchemy.exc import IntegrityError` |

### Cấu hình và bảo mật **[GĐ 7]**

| Thứ | Làm gì |
|---|---|
| `load_dotenv()` | Đọc file `.env` vào biến môi trường. `from dotenv import load_dotenv` |
| `CSRFProtect()` / `csrf.init_app(app)` | Bật chống CSRF cho mọi request POST/PATCH/PUT/DELETE. `from flask_wtf.csrf import CSRFProtect` |
| `{{ csrf_token() }}` | Trong HTML (Jinja): tạo token CSRF cho form hoặc thẻ `<meta>` |
| `Limiter(key_func=get_remote_address)` / `limiter.init_app(app)` | Bộ giới hạn số request. `from flask_limiter import Limiter` |
| `@limiter.limit("10 per minute", methods=["POST"], key_func=...)` | Giới hạn một route |

### Test: pytest **[GĐ 8]**

| Thứ | Làm gì |
|---|---|
| `@pytest.fixture` | Hàm chuẩn bị dữ liệu dùng chung cho test, ví dụ tạo app, tạo client |
| `tmp_path` | Fixture có sẵn của pytest: một thư mục tạm cho mỗi test |
| `app.test_client()` | Client giả để gửi request mà không cần chạy server |
| `client.get(url)` / `client.post(url, json={...})` / `.patch` / `.delete` | Gửi request thử |
| `response.status_code` / `response.get_json()` | Đọc kết quả |
| `assert điều_kiện` | Kiểm tra. Sai thì test đỏ |

### Database thật và deploy **[GĐ 9, 10]**

| Thứ | Làm gì |
|---|---|
| `SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 300}` | Kiểm tra kết nối trước khi dùng, vì Neon tắt database khi rảnh |
| `ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)` | Cho Flask biết request thật là HTTPS khi chạy sau proxy của Render. `from werkzeug.middleware.proxy_fix import ProxyFix` |

---

## 7. JavaScript: Có sẵn trong trình duyệt

### Tìm và tạo phần tử HTML (DOM)

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `document.getElementById(id)` | Tìm phần tử theo id | `document.getElementById("taskInput")` |
| `document.querySelector(css)` | Tìm phần tử đầu tiên khớp selector CSS | `document.querySelector(".main")` |
| `document.querySelectorAll(css)` | Tìm mọi phần tử khớp, trả về `NodeList` | `tasksList.querySelectorAll("li:not(.dragging)")` |
| `document.createElement(tag)` | Tạo phần tử mới (chưa hiện) | `document.createElement("li")` |
| `parent.appendChild(el)` / `parent.append(a, b, ...)` | Thêm vào cuối phần tử cha | `li.append(checkBox, text)` |
| `parent.insertBefore(el, ref)` | Chèn trước `ref`. `ref` là `null` thì chèn cuối | dùng khi kéo thả |
| `el.replaceWith(other)` | Thay phần tử này bằng phần tử khác | đổi tên list: `span` → `input` |
| `el.innerHTML = ""` | Xoá hết nội dung bên trong | trước khi vẽ lại |
| `el.textContent = "..."` | Đặt chữ (an toàn, không chạy HTML) | `span.textContent = task.text` |
| `el.dataset.id` | Đọc/ghi thuộc tính `data-id` trong HTML. **Luôn là chuỗi** | `li.dataset.id = String(task.id)` |
| `el.children` | Các phần tử con trực tiếp | `[...tasksList.children]` |
| `el.focus()` / `input.select()` | Đặt con trỏ vào ô / bôi đen chữ trong ô | |
| `el.getBoundingClientRect()` | Vị trí và kích thước trên màn hình | đặt popup, kéo thả |

### Class và style

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `el.classList.add/remove(tên)` | Thêm / bỏ class | `li.classList.add("dragging")` |
| `el.classList.toggle(tên)` | Có thì bỏ, chưa có thì thêm | `menu.classList.toggle("open")` |
| `el.classList.toggle(tên, điều_kiện)` | `true` thì thêm, `false` thì bỏ | `btn.classList.toggle("empty", !pendingColor)` |
| `el.classList.contains(tên)` | Có class đó không | `body.classList.contains("dark")` |
| `el.style.display = "none"` | Đặt CSS trực tiếp. Gán `""` để bỏ | |
| `el.style.setProperty("--biến", giá_trị)` | Đặt biến CSS | `li.style.setProperty("--task-color", task.color)` |

### Sự kiện

| Thứ | Làm gì |
|---|---|
| `el.addEventListener(sự_kiện, hàm)` | Chạy hàm khi sự kiện xảy ra |
| `e.stopPropagation()` | Không cho sự kiện nổi lên phần tử cha (xem giải thích "bubbling") |
| `e.preventDefault()` | Chặn hành vi mặc định của trình duyệt. Bắt buộc trong `dragover` |
| `e.key` | Phím vừa bấm: `"Enter"`, `"Escape"` |
| `e.clientY` | Vị trí chuột theo chiều dọc |

Các sự kiện dùng trong project:

| Sự kiện | Khi nào |
|---|---|
| `click` | Bấm chuột |
| `change` | Giá trị ô nhập, checkbox, radio thay đổi |
| `keydown` | Bấm phím |
| `blur` | Ô nhập mất con trỏ (bấm ra ngoài) |
| `dragstart` / `dragover` / `dragend` | Bắt đầu kéo / đang kéo ngang qua / thả ra |
| `scroll` / `resize` | Cuộn trang / đổi kích thước cửa sổ |
| `visibilitychange` ⏳ GĐ 5 | Chuyển sang tab khác hoặc quay lại. `document.visibilityState` là `"visible"` hoặc `"hidden"` |

### Mảng

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `arr.find(fn)` | Phần tử đầu tiên thoả điều kiện, không có thì `undefined` | `lists.find(l => l.id === id)` |
| `arr.filter(fn)` | Mảng mới gồm các phần tử thoả điều kiện | `tasks.filter(t => !t.completed)` |
| `arr.map(fn)` | Mảng mới, mỗi phần tử được biến đổi | `tasks.map(t => t.id)` |
| `arr.some(fn)` | `true` nếu có ít nhất 1 phần tử thoả | kiểm tra task trùng |
| `arr.forEach(fn)` | Duyệt từng phần tử, `(phần_tử, vị_trí)` | `tasks.forEach((t, i) => ...)` |
| `arr.includes(x)` | Có chứa `x` không | `visibleIds.includes(id)` |
| `arr.push(x)` | Thêm vào cuối (sửa mảng gốc) | `getTasks().push(task)` |
| `arr.sort(fn)` | Sắp xếp (sửa mảng gốc) | `withDate.sort((a, b) => ...)` |
| `arr.indexOf(x)` | Vị trí của `x`, không có thì `-1` | thứ tự màu |
| `[...a, ...b]` | Spread: ghép mảng, hoặc đổi `NodeList` thành mảng | `[...withDate, ...withoutDate]` |

### Object, chuỗi, số

| Hàm | Làm gì | Ví dụ |
|---|---|---|
| `Object.assign(đích, nguồn)` | Chép các trường của `nguồn` vào `đích` | `Object.assign(task, { completed: true })` |
| `str.trim()` | Bỏ khoảng trắng hai đầu | |
| `str.toLowerCase()` | Chữ thường | so task trùng |
| `str.split("-")` | Tách chuỗi thành mảng | `"2026-11-07".split("-")` |
| `str.localeCompare(other)` | So sánh 2 chuỗi để sắp xếp | sắp theo ngày |
| `` `...${biến}...` `` | Template literal: chèn biến vào chuỗi | `` `/api/tasks/${id}` `` |
| `Number(x)` / `String(x)` | Đổi kiểu | `String(t.id) === el.dataset.id` |
| `new Date(y, m - 1, d)` / `.toLocaleDateString(...)` | Tạo ngày (tháng tính từ 0) / hiển thị ngày | `formatTaskDate` |
| `Date.now()` | Số mili giây hiện tại. Từ GĐ 5 không dùng làm id nữa | |

### Lưu trữ và JSON

| Hàm | Làm gì |
|---|---|
| `localStorage.getItem(key)` / `setItem(key, value)` / `removeItem(key)` | Lưu trong trình duyệt, **chỉ lưu chuỗi**. Từ GĐ 5 chỉ dùng cho `theme`, `sortOrder`, `currentListId` |
| `JSON.stringify(obj)` | Object → chuỗi JSON |
| `JSON.parse(str)` | Chuỗi JSON → object |

### Gọi server và bất đồng bộ ⏳ GĐ 5

| Thứ | Làm gì |
|---|---|
| `fetch(url, { method, headers, body })` | Gửi request. Trả về Promise. **Không tự báo lỗi khi gặp 404/500** |
| `response.ok` | `true` nếu mã 200–299 |
| `response.status` | Mã trạng thái, ví dụ 204 |
| `response.json()` | Đọc body JSON (cũng là bất đồng bộ) |
| `async function` | Hàm được dùng `await` bên trong, luôn trả về Promise |
| `await` | Đợi Promise có kết quả rồi mới chạy dòng sau. Trang không bị đơ |
| `try / catch / finally` | Bắt lỗi. `finally` luôn chạy |
| `throw new Error("...")` | Tự báo lỗi |
| `console.error(err)` | In lỗi ra tab Console (F12) |
| `location.reload()` | Tải lại trang |

### Cú pháp hay quên

| Cú pháp | Nghĩa | Ví dụ |
|---|---|---|
| `a?.b` | Optional chaining: `a` là `null`/`undefined` thì trả `undefined` thay vì lỗi | `lists[0]?.id` |
| `a ?? b` | `a` là `null`/`undefined` thì lấy `b` | `lists[0]?.id ?? null` |
| `a \|\| b` | `a` là giá trị "sai" (`0`, `""`, `null`, `undefined`, `false`) thì lấy `b` | `Number(...) \|\| null` |
| `x => ...` | Arrow function, hàm viết ngắn | `t => t.id` |
| `{ method }` | Viết tắt của `{ method: method }` | |
| `const` / `let` | Biến không gán lại được / gán lại được | |
| `===` | So sánh bằng, **cả kiểu dữ liệu**: `4 === "4"` là `false` | |

---

## 8. JavaScript: Hàm tự viết trong project

Thứ tự nạp trong `index.html`: storage → toast → pickers → controls → taskActions → taskRender → sidebar → theme → main.

### `storage.js`: dữ liệu

| Hàm | Làm gì |
|---|---|
| `getCurrentList()` | List đang mở, không có thì `null` |
| `getTasks()` | Mảng task của list đang mở, không có thì `[]` |
| `getLists()` / `saveLists(lists)` / `saveTasks()` | Đọc / ghi `lists` vào localStorage. **Bỏ ở GĐ 5** |
| `migrateOldTasks()` | Chuyển dữ liệu từ bản app cũ (key `"tasks"`). **Bỏ ở GĐ 5** |
| `apiRequest(method, path, body)` ⏳ GĐ 5 | Gửi request, trả JSON hoặc `null` (204). Lỗi thì ném ra |
| `apiSave(method, path, body)` ⏳ GĐ 5 | Như trên nhưng tự bắt lỗi, báo người dùng, trả `null` nếu lỗi. Đếm `pendingSaves` |
| `loadLists()` ⏳ GĐ 5 | `GET /api/lists` vào biến `lists` |

### `main.js`: khởi động

| Thứ | Làm gì |
|---|---|
| `lists`, `currentListId` | Biến toàn cục, mọi file dùng chung |
| Khởi động | Đọc dữ liệu rồi vẽ sidebar và task. Từ GĐ 5 là hàm `init()`, đợi `loadLists()` |

### `toast.js`: hộp thoại

| Hàm | Làm gì |
|---|---|
| `showToast(text, onYes)` | Hỏi Yes/No. Bấm Yes thì gọi `onYes()` |
| `showInputToast(label, initialValue, onSave, placeholder)` | Ô nhập một dòng. Enter/nút để lưu (gọi `onSave(value)`), Escape để huỷ |
| `openToast(yesText, noText)` / `closeToast()` | Mở / đóng hộp thoại (dùng nội bộ) |

### `pickers.js`: chọn màu, chọn ngày

| Hàm / hằng | Làm gì |
|---|---|
| `TASK_COLORS` | Danh sách 6 màu |
| `formatTaskDate(dateStr)` | `"2026-11-10"` → `"Nov 10, 2026"`, không lệch múi giờ |
| `createAnchoredPopup(tag, className)` | Tạo popup hiện dưới một nút, tự đóng khi bấm ra ngoài, cuộn, đổi cỡ. Trả `{ element, open, close }` |
| `openDueDatePicker(anchor, currentValue, onSelect)` | Mở ô chọn ngày, chọn xong gọi `onSelect(ngày hoặc null)` |
| `openColorPicker(anchor, owner, onSelect)` | Mở bảng màu, chọn xong gọi `onSelect(màu hoặc null)`. Bấm lại cùng nút thì đóng |

### `controls.js`: lọc và sắp xếp

| Hàm / biến | Làm gì |
|---|---|
| `setupDropdown(toggleId, menuId, onChange)` | Dựng menu thả xuống: bấm nút để mở, bấm ra ngoài để đóng, chọn thì gọi `onChange(value)` |
| `currentFilter` | `"all"` / `"active"` / `"completed"` |
| `filterTasks(tasks)` | Trả mảng task theo bộ lọc |
| `currentSort` | `"manual"` / `"earliest"` / `"latest"` / `"color"`, nhớ trong localStorage |
| `sortTasks(tasks)` | Trả mảng **mới** đã sắp xếp, task không có ngày/màu xếp cuối |

### `taskActions.js`: nơi DUY NHẤT sửa dữ liệu task

| Hàm | Làm gì | GĐ 5 gửi request |
|---|---|---|
| `findTask(id)` | Tìm task trong list đang mở | |
| `addTask(text, color, dueDate)` | Thêm task | `POST /api/lists/<id>/tasks`, **đợi server** rồi mới thêm |
| `updateTask(id, changes)` | Sửa các trường trong `changes` | `PATCH /api/tasks/<id>`, vẽ trước rồi lưu |
| `deleteTask(id)` | Xoá task | `DELETE /api/tasks/<id>` |
| `reorderTasks(visibleIds)` | Đổi thứ tự sau khi kéo thả, giữ nguyên task bị ẩn (logic `slots`) | `PUT /api/lists/<id>/order` |

### `taskRender.js`: vẽ và xử lý thao tác

| Hàm / biến | Làm gì |
|---|---|
| `renderTask()` | Xoá rồi vẽ lại danh sách task (lọc → sắp xếp → `buildTaskItem`) |
| `buildTaskItem(task)` | Tạo `<li>` cho 1 task: checkbox, chấm màu, chữ, nút ngày, sửa, xoá, kéo thả |
| `createIconButton(className, imgSrc, alt, onClick)` | Tạo nút có icon |
| `updateCounters()` | Cập nhật Total / Active / Completed |
| `pendingColor` / `pendingDueDate` | Màu, ngày đã chọn ở hàng nhập trước khi bấm Add |
| `updateNewTaskButtons()` / `resetNewTaskRow()` | Cập nhật / xoá hàng nhập task mới |
| `submitNewTask()` | Đọc ô nhập, hỏi lại nếu trùng, rồi gọi `addTask` |

### `sidebar.js`: danh sách list

| Hàm | Làm gì |
|---|---|
| `updateMainVisibility()` | Chưa có list thì hiện màn hình Welcome, có rồi thì hiện giao diện chính |
| `renderSidebar()` | Vẽ lại danh sách list: chọn, đổi tên (Enter lưu, Escape huỷ, cờ `finished`), xoá |
| Nút `+` (newListButton) | Mở `showInputToast` để tạo list mới |

### `theme.js`: dark mode

| Thứ | Làm gì |
|---|---|
| Các nút `.themeButton` | Bật/tắt class `dark` trên `<body>`, nhớ lựa chọn trong localStorage |

---

## 9. Lệnh terminal

### Môi trường Python (PowerShell)

| Lệnh | Làm gì |
|---|---|
| `py -m venv .venv` | Tạo môi trường ảo (một lần) |
| `.venv\Scripts\activate` | Bật môi trường ảo. Thấy `(.venv)` ở đầu dòng là được |
| `pip install tên` | Cài thư viện |
| `pip freeze \| Set-Content -Encoding ascii requirements.txt` | Ghi danh sách thư viện. **Đừng dùng `>`**, PowerShell sẽ lưu UTF-16 và Render không đọc được |
| `pip install -r requirements.txt` | Cài lại đủ thư viện từ file (máy mới, Render) |

### Flask

| Lệnh | Làm gì |
|---|---|
| `flask --app wsgi run --debug` | Chạy server ở máy, tự tải lại khi sửa code. **Không dùng `--debug` trên server thật** |
| `flask --app wsgi db init` | Tạo thư mục `migrations/` (chỉ một lần) |
| `flask --app wsgi db migrate -m "mô tả"` | So `models.py` với database, sinh file migration. **Luôn đọc lại file sinh ra** |
| `flask --app wsgi db upgrade` | Áp dụng migration vào database |
| `flask --app wsgi db downgrade` | Quay ngược migration gần nhất |
| `flask --app wsgi routes` | Liệt kê mọi route của app. Tiện để kiểm tra Blueprint đã đăng ký chưa |
| `pytest` ⏳ GĐ 8 | Chạy test |
| `gunicorn wsgi:app ...` ⏳ GĐ 10 | Chạy server production (Render). Không chạy trên Windows |

### Git

| Lệnh | Làm gì |
|---|---|
| `git status` | Xem file đã đổi |
| `git switch -c tên` | Tạo nhánh mới và chuyển sang |
| `git mv cũ mới` | Đổi tên/di chuyển file. Commit riêng trước khi sửa nội dung |
| `git add -A` / `git commit -m "..."` | Lưu thay đổi |
| `git log --oneline` | Xem lịch sử commit gọn |
| `git push -u origin tên` | Đẩy nhánh lên GitHub |
| `git ls-files \| Select-String "\.env"` | Kiểm tra `.env` không bị commit |
