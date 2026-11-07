# File này chỉ tạo các extension, chưa gắn vào app nào.
# create_app() sẽ gắn chúng vào app bằng init_app(app).
# Tách riêng để models.py import được db mà không bị circular import.

from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

# Quy tắc đặt tên tự động cho các ràng buộc (constraint) trong database.
# Migration cần biết tên ràng buộc thì mới sửa hoặc xóa được chúng.
convention = {
    "ix": "ix_%(column_0_label)s",  # Index, ví dụ: ix_tasks_list_id
    "uq": "uq_%(table_name)s_%(column_0_name)s",  # Unique, ví dụ: uq_users_username
    "ck": "ck_%(table_name)s_%(constraint_name)s",  # Check, ví dụ: ck_tasks_valid_color
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",  # Khóa ngoại, ví dụ: fk_tasks_list_id_lists
    "pk": "pk_%(table_name)s"  # Khóa chính, ví dụ: pk_tasks
}

# db: dùng để khai báo model và đọc, ghi database.
# MetaData giữ danh sách tất cả các bảng, nên quy tắc đặt tên ở đây áp dụng cho mọi bảng.
db = SQLAlchemy(metadata=MetaData(naming_convention=convention))

# migrate: quản lý các thay đổi cấu trúc database (lệnh flask db ...).
# SQLite không hỗ trợ ALTER TABLE đầy đủ, nên giai đoạn 6 cần batch mode.
# Batch mode là cách đi đường vòng: tạo bảng mới, chép dữ liệu sang, xóa bảng cũ, rồi đổi tên.
migrate = Migrate(render_as_batch=True)