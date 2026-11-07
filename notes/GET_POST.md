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
