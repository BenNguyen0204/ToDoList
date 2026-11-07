# Ghi chú: GET, POST và Blueprint trong Flask

## Blueprint có tự chạy không?

Không. Blueprint chỉ hoạt động sau khi được đăng ký bằng `register_blueprint`.

Khi server khởi động, việc này diễn ra một lần:

```text
wsgi.py gọi create_app()
  → tạo Flask app
  → import pages.py (các route được gom vào blueprint)
  → app.register_blueprint(...) (gắn các route vào app)
```

Sau đó, mỗi khi có request, Flask tự tìm route khớp và gọi hàm tương ứng.

- Quên `register_blueprint` thì không báo lỗi lúc khởi động, nhưng vào URL sẽ bị 404.
- Bạn không tự gọi hàm `index()`. Flask gọi nó khi có người vào `/`.

---

## GET và POST là gì?

Mỗi request gửi đến server đều có một phương thức, cho server biết client muốn làm gì.

| | GET | POST |
|---|---|---|
| **Mục đích** | Lấy dữ liệu | Gửi dữ liệu lên để tạo mới |
| **Dữ liệu nằm ở** | URL, ví dụ `/tasks?done=true` | Body của request |
| **Làm thay đổi dữ liệu không** | Không | Có |
| **Gửi lại nhiều lần** | An toàn, kết quả như nhau | Mỗi lần có thể tạo thêm một bản ghi |
| **Xảy ra khi** | Mở URL trên trình duyệt, tải CSS, ảnh | Gửi form, gọi `fetch` với `method: "POST"` |

Không đưa mật khẩu hay dữ liệu nhạy cảm lên URL của GET, vì URL được lưu trong lịch sử trình duyệt và log của server.

---

## Viết route trong Flask

Mặc định, route chỉ nhận GET. Muốn nhận phương thức khác thì phải khai báo `methods`.

```python
from flask import Blueprint, jsonify, request

api = Blueprint("api", __name__)
tasks = []  # ví dụ thôi, dữ liệu sẽ mất khi tắt server


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

- `request.get_json()`: đọc JSON trong body của request.
- `request.args.get("done")`: đọc tham số trên URL của GET, ví dụ `/tasks?done=true`.
- `jsonify(...)`: trả về dữ liệu dạng JSON.
- `, 201`: đặt status code cho response.

Flask 2.0 trở lên có cách viết ngắn hơn: `@api.get("/tasks")` và `@api.post("/tasks")`.

---

## Gọi từ JavaScript

```js
// GET: lấy danh sách task
const response = await fetch("/api/tasks");
const tasks = await response.json();

// POST: tạo task mới
const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Học Flask" }),
});
const task = await response.json();
```

Hai đoạn trên là hai ví dụ riêng, nên đừng dán chung vào một chỗ vì `response` bị khai báo trùng.

Nếu thiếu header `Content-Type: application/json`, `request.get_json()` sẽ báo lỗi 415.

---

## Luồng khi đổi tên list

Ví dụ đổi tên list có id 5:

```text
1. Sửa tên, nhấn Enter hoặc bấm ra ngoài   (trình duyệt)
        ↓
2. JS gửi PATCH /api/lists/5               (apiSave, kèm {"name": "Việc nhà"})
        ↓
3. Flask chạy update_list(list_id=5)       (lấy 5 từ URL)
        ↓
4. get_list_or_404(5)                      (tìm list, không có thì trả 404)
        ↓
5. get_json_body()                         (đọc JSON, sai định dạng thì trả 400)
        ↓
6. todo_list.name = validate_text(...)     (mới đổi trong session, chưa lưu hẳn)
        ↓
7. db.session.commit()                     (lưu vào database)
        ↓
8. return jsonify(todo_list.to_dict())     (trả list đã sửa về cho JS, status 200)
        ↓
9. JS cập nhật list.name, vẽ lại giao diện
```

So với luồng thêm list, có 2 điểm khác:

- id đã có sẵn nên nằm trên URL. Khi thêm list, database mới cấp id lúc `commit()`.
- Không cần `db.session.add()` vì object lấy từ database đã nằm trong session.

---

## Id được tạo và luân chuyển thế nào

Database sinh ra id một lần duy nhất, backend gửi nó cho frontend, rồi frontend gửi lại trên URL mỗi khi muốn thao tác với list đó. Ví dụ list mới được cấp id 5:

```text
 CHUẨN BỊ (làm một lần)
 models.py:9            id = db.Column(db.Integer, primary_key=True)
    ↓ flask db migrate + flask db upgrade
 instance/todo.db       bảng lists có cột id tự cấp số


 TẠO LIST
 Trình duyệt   bấm +, nhập tên
    ↓ POST /api/lists   {"name": "Việc nhà"}      ← chưa có id
 Flask         create_list() → add() → commit()
    ↓ INSERT
 Database      thêm dòng mới, TỰ CẤP id = 5       ← id ra đời ở đây
    ↓
 Flask         todo_list.id = 5
    ↓ to_dict() + jsonify, trả 201
 Trình duyệt   {"id": 5, "name": "Việc nhà", "tasks": []}


 FRONTEND GIỮ ID
 lists                  có phần tử {id: 5, ...}
 currentListId = 5      list đang chọn
 localStorage           nhớ currentListId sau khi tải lại trang


 DÙNG LẠI ID
 Trình duyệt   đổi tên list
    ↓ PATCH /api/lists/5   {"name": "Đi học"}     ← id nằm trên URL
 Flask         <int:list_id> → update_list(list_id=5)
    ↓ get_list_or_404(5)
 Database      tìm dòng có id = 5, cập nhật rồi lưu


 TẢI LẠI TRANG
 loadList()    GET /api/lists → backend trả mọi list kèm id
               currentListId còn trong lists thì giữ, không thì lấy list đầu


 TASK GẮN VỚI LIST
 tasks.list_id = 5      ghi lại task này thuộc list có id 5
```

Id mang tên khác nhau ở mỗi nơi, nhưng vẫn là cùng một số:

| Nơi | Tên |
|---|---|
| Database, bảng `lists` | `id` |
| Database, bảng `tasks` | `list_id` |
| Object Python | `todo_list.id` |
| JSON gửi cho JS | `"id"` |
| Biến JS | `list.id`, `currentListId` |
| URL | `/api/lists/5` |
| Tham số Flask | `list_id` |

3 điều nên nhớ:

1. Chỉ database tạo id. Các nơi khác chỉ lưu và chuyển tiếp nó.
2. Tạo mới thì chưa có id, các thao tác sau thì phải có. Vì vậy `POST /lists` không có id trên URL, còn `PATCH /lists/5` thì có.
3. Id gửi từ client không được tin ngay. `get_list_or_404` kiểm tra nó có tồn tại không, và sau này còn phải kiểm tra list đó có thuộc user hiện tại không.

---

## Các phương thức khác

Một REST API cho task thường có đủ các route sau:

| Phương thức | URL | Việc làm |
|---|---|---|
| GET | `/api/tasks` | Lấy tất cả task |
| GET | `/api/tasks/5` | Lấy task số 5 |
| POST | `/api/tasks` | Tạo task mới |
| PUT | `/api/tasks/5` | Thay toàn bộ task số 5 |
| PATCH | `/api/tasks/5` | Sửa một phần, ví dụ chỉ đổi `done` |
| DELETE | `/api/tasks/5` | Xóa task số 5 |

Cùng một URL nhưng khác phương thức thì là hai việc khác nhau.

---

## Status code hay gặp

| Code | Nghĩa | Khi nào gặp |
|---|---|---|
| 200 | OK | Yêu cầu thành công |
| 201 | Created | POST tạo được bản ghi mới |
| 204 | No Content | Thành công, không có gì để trả về, thường gặp khi DELETE |
| 400 | Bad Request | Dữ liệu gửi lên sai |
| 401 | Unauthorized | Chưa đăng nhập |
| 403 | Forbidden | Đã đăng nhập nhưng không có quyền |
| 404 | Not Found | URL hoặc bản ghi không tồn tại |
| 405 | Method Not Allowed | Route có tồn tại nhưng không nhận phương thức này |
| 415 | Unsupported Media Type | Sai `Content-Type` |
| 500 | Internal Server Error | Code phía server bị lỗi |

Lỗi 405 hay gặp nhất khi mới học: gửi POST vào route chưa khai báo `methods=["POST"]`.
