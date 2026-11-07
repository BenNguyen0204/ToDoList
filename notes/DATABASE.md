# Ghi chú: Thiết kế database

## Tổng quan

```text
users 1 ──── N lists 1 ──── N tasks
```

Một user có nhiều list, một list có nhiều task.

Bảng `users` thêm ở giai đoạn 6, còn giai đoạn 3 chỉ cần `lists` và `tasks`.

---

## Các bảng

### `users` (giai đoạn 6)

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | Integer | Khóa chính |
| `username` | String(32) | Bắt buộc, unique, lưu chữ thường |
| `password_hash` | String(255) | Bắt buộc |
| `created_at` | DateTime | Bắt buộc, mặc định là lúc tạo |

### `lists`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | Integer | Khóa chính |
| `name` | String(100) | Bắt buộc |
| `user_id` | Integer | Thêm ở giai đoạn 6: khóa ngoại tới `users.id`, bắt buộc, có index |

### `tasks`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | Integer | Khóa chính |
| `list_id` | Integer | Khóa ngoại tới `lists.id`, bắt buộc, `ondelete="CASCADE"`, có index |
| `text` | String(500) | Bắt buộc |
| `completed` | Boolean | Bắt buộc, mặc định `False` |
| `color` | String(7) | Không bắt buộc, ví dụ `#ff0000` |
| `due_date` | Date | Không bắt buộc |
| `position` | Integer | Bắt buộc, thứ tự kéo thả |

---

## Vì sao thiết kế như vậy

- **`tasks` không cần `user_id`:** task thuộc list, list thuộc user, nên đã biết task của ai. Thêm nữa thì dữ liệu dễ bị lệch nhau.
- **`id` do database cấp:** `Date.now()` trong JS là số 13 chữ số, quá lớn so với Integer của PostgreSQL (khoảng 2,1 tỷ). JS phải dùng `id` do server trả về.
- **`position` lưu thứ tự kéo thả:** database không đảm bảo thứ tự dòng, nên cần cột này để sắp xếp.
- **`due_date` ở database, `dueDate` ở JS:** Python và SQL quen dùng `snake_case`, còn `to_dict()` sẽ đổi sang `dueDate` cho JS.
- **Index cho `lists.user_id` và `tasks.list_id`:** app liên tục tìm theo hai cột này, mà PostgreSQL không tự tạo index cho khóa ngoại.
- **`completed` và `position` là `nullable=False`:** tránh dữ liệu bị `NULL` làm sai bộ lọc và thứ tự.
- **Tên class là `TodoList`:** bảng vẫn tên `lists`, và class không dễ nhầm với `list` của Python.

---

## Khóa chính và khóa ngoại

- **Khóa chính (primary key):** định danh duy nhất cho mỗi dòng, ví dụ `tasks.id`.
- **Khóa ngoại (foreign key):** cột trỏ tới khóa chính của bảng khác, ví dụ `tasks.list_id` trỏ tới `lists.id`. Database sẽ không cho tạo task thuộc một list không tồn tại.
- **Quan hệ một-nhiều:** khóa ngoại luôn nằm ở phía "nhiều", nên `list_id` nằm trong `tasks`.

---

## Xóa list thì task đi đâu?

Có 2 chỗ khai báo việc xóa theo:

| Khai báo | Nằm ở đâu | Ai thực hiện |
|---|---|---|
| `cascade="all, delete-orphan"` trên `db.relationship` | Python | SQLAlchemy |
| `ondelete="CASCADE"` trên khóa ngoại | Database | Database |

Lưu ý với SQLite: mặc định SQLite không tự thực thi `ondelete="CASCADE"`. Task vẫn bị xóa theo list nhờ `cascade="all, delete-orphan"`, miễn là xóa bằng `db.session.delete(list)`.

---

## Quy tắc đặt tên constraint

Khai báo trong `app/extensions.py`, trước migration đầu tiên:

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

Tên sinh ra:

| Khóa | Loại | Tác dụng | Tên sinh ra |
|---|---|---|---|
| `pk` | Primary key | Định danh mỗi dòng | `pk_tasks` |
| `fk` | Foreign key | Nối sang bảng khác | `fk_tasks_list_id_lists` |
| `uq` | Unique | Không cho trùng giá trị | `uq_users_username` |
| `ix` | Index | Giúp tìm kiếm nhanh hơn | `ix_tasks_list_id` |
| `ck` | Check | Kiểm tra điều kiện của dữ liệu | `ck_tasks_valid_color` |

Vì sao cần: muốn sửa hoặc xóa một ràng buộc, migration phải biết tên của nó. Nếu không đặt tên, mỗi database tự đặt theo kiểu riêng, hoặc để trống như SQLite.

SQLite cũng cần thêm `Migrate(render_as_batch=True)` vì nó không cho thêm khóa ngoại vào bảng đã có.

---

## Lệnh migration

```powershell
flask --app wsgi db init                               # chỉ chạy một lần
flask --app wsgi db migrate -m "Create lists and tasks"  # sinh file migration
flask --app wsgi db upgrade                            # áp dụng vào database
flask --app wsgi db downgrade                          # lùi lại một bước
```

- `create_app()` phải import models thì lệnh `migrate` mới thấy bảng.
- Luôn đọc file sinh ra trong `migrations/versions/` trước khi chạy `upgrade`.
- Thêm cột bắt buộc vào bảng đã có dữ liệu sẽ lỗi, vì dòng cũ không có giá trị cho cột đó.
