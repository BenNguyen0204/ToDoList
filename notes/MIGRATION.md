# Ghi chú: Migration

## Migration là gì?

Migration là cách đưa thay đổi từ `models.py` xuống database thật.

Có 2 nơi tách biệt:

- **`models.py`:** mô tả bảng bằng code.
- **`todo.db`:** bảng thật, nơi lưu dữ liệu.

Sửa `models.py` thì `todo.db` không tự đổi. Migration là cầu nối giữa hai nơi đó, và giữ được dữ liệu đang có.

Có thể hình dung `models.py` là bản vẽ, database là căn nhà, còn migration là từng lần sửa nhà theo bản vẽ mới mà đồ đạc bên trong vẫn còn.

---

## Các lệnh

| Lệnh | Nó làm gì | Ví dụ đời thường |
|---|---|---|
| `db init` | Tạo thư mục `migrations/`, chỉ chạy một lần | Mua cuốn sổ |
| `db migrate` | So `models.py` với database, ghi thay đổi vào một file. **Chưa đổi database** | Viết việc cần làm vào sổ |
| `db upgrade` | Chạy file đó, **lúc này database mới đổi** | Làm theo sổ |
| `db downgrade` | Hoàn tác lần thay đổi gần nhất | Làm ngược lại |

```powershell
flask --app wsgi db init
flask --app wsgi db migrate -m "Create lists and tasks"
flask --app wsgi db upgrade
flask --app wsgi db downgrade
```

---

## Quy trình mỗi lần đổi cấu trúc

1. Sửa bảng hoặc cột trong `models.py`.
2. Chạy `db migrate -m "mô tả thay đổi"`.
3. Mở file mới trong `migrations/versions/` và đọc kiểm tra.
4. Chạy `db upgrade`.
5. Commit cả `models.py` và thư mục `migrations/`.

---

## Khi nào cần migrate?

| Việc làm | Cần migrate không? |
|---|---|
| Thêm, sửa, xóa task, tick hoàn thành | Không, đây là dữ liệu |
| Sửa `to_dict()`, thêm route, sửa HTML, CSS, JS | Không, đây không phải cấu trúc bảng |
| Thêm, xóa, đổi tên cột | Có |
| Đổi kiểu cột hoặc ràng buộc | Có |
| Thêm, xóa bảng | Có |

---

## Nếu không migrate thì sao?

- **Sửa `models.py` mà không migrate:** code và database lệch nhau, app báo lỗi `no such column: tasks.priority`.
- **Dùng `db.create_all()`:** chỉ tạo bảng còn thiếu, không sửa bảng đã có, nên vẫn báo lỗi như trên.
- **Xóa database rồi tạo lại:** app chạy được nhưng mất hết dữ liệu. Lúc học thì không sao, app có người dùng thì không làm thế được.
- **Tự chạy `ALTER TABLE` bằng tay:** phải nhớ chạy đúng lệnh trên mọi máy và server, sót một chỗ là database mỗi nơi một khác.

---

## File migration trông như thế nào?

```python
revision = "a1b2c3"        # mã của migration này
down_revision = "9f8e7d"   # migration ngay trước nó

def upgrade():
    # đi tới: thêm cột
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("priority", sa.Integer(), nullable=True))

def downgrade():
    # lùi lại: xóa cột
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("priority")
```

`down_revision` nối các migration thành một chuỗi, nên database biết mình đang ở đâu và còn phải chạy những cái nào:

```text
Tạo lists, tasks → Thêm users → Thêm user_id → ...
```

`batch_alter_table` là batch mode, cần cho SQLite vì SQLite không hỗ trợ `ALTER TABLE` đầy đủ. Nó tạo bảng mới, chép dữ liệu sang, xóa bảng cũ rồi đổi tên.

---

## So với Git

| Git | Migration |
|---|---|
| `git commit` | `db migrate` |
| Lịch sử commit | Thư mục `migrations/versions/` |
| `git pull` để lấy code mới | `db upgrade` để cập nhật database |
| `git revert` | `db downgrade` |

---

## Đọc log khi chạy

```text
Running upgrade  -> a62d8d9419da, Create lists and tasks
Running downgrade a62d8d9419da -> , Create lists and tasks
```

- `a62d8d9419da` là mã của migration, giống mã commit trong Git.
- ` -> a62d8d9419da`: đi từ trạng thái trống lên migration đó.
- `a62d8d9419da -> `: lùi từ migration đó về trạng thái trống.
- `Context impl SQLiteImpl`: đang dùng SQLite.
- `non-transactional DDL`: nếu migration lỗi giữa chừng, SQLite không tự hoàn tác hết các bước đã chạy.

Chạy `db downgrade` rồi `db upgrade` để thử migration chạy được cả hai chiều.

---

## Lưu ý

- Luôn đọc file sinh ra trước khi `upgrade`, vì `db migrate` chỉ đoán và có thể đoán sai. Ví dụ đổi tên cột có thể bị hiểu thành xóa cột cũ rồi thêm cột mới, làm mất dữ liệu.
- `downgrade` xóa bảng thì dữ liệu trong bảng cũng mất, `upgrade` chỉ tạo lại bảng trống. Đừng chạy thử như vậy khi có dữ liệu thật.
- `create_app()` phải import models thì `db migrate` mới thấy bảng.
- Thêm cột bắt buộc vào bảng đã có dữ liệu sẽ lỗi, vì dòng cũ không có giá trị cho cột đó.
- Commit thư mục `migrations/` lên GitHub, nhưng không commit `todo.db`.
