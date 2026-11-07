# Mỗi class trong file này là một bảng trong database, mỗi db.Column là một cột.
from .extensions import db

class TodoList(db.Model):
    # Tên bảng trong database. Class vẫn tên ToDoList để không nhầm với list của Python.
    __tablename__ = 'lists'

    # Khóa chính: do database tự cấp, không dùng Date.now() như JS.
    id = db.Column(db.Integer, primary_key=True)
    # Tên list, tối đa 100 ký tự. nullable=False nghĩa là bắt buộc phải có.
    name = db.Column(db.String(100), nullable=False)
    
    # Một list có nhiều task. Xoá list thì xoá luôn task của nó.
    tasks = db.relationship(
        "Task",  # Model ở phía bên kia của quan hệ. Viết dạng chuỗi vì class Task khai báo sau.
        back_populates="todo_list",  # Nối với thuộc tính todo_list bên Task, hai bên luôn đồng bộ.
        cascade="all, delete-orphan",  # SQLAlchemy tự xóa task khi xóa list, hoặc khi task bị gỡ khỏi list.
        order_by="Task.position",  # Lấy task theo đúng thứ tự kéo thả.
    )
    
    # Đổi object thành dict để Flask trả về dạng JSON cho JS.
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "tasks": [task.to_dict() for task in self.tasks]
        }
        
class Task(db.Model):
    # Tên bảng trong database.
    __tablename__ = 'tasks'
    
    # Khóa chính: do database tự cấp.
    id = db.Column(db.Integer, primary_key=True)

    # Khóa ngoại: cho biết task thuộc list nào.
    # Quan hệ một-nhiều nên khóa ngoại nằm ở phía "nhiều", tức là bảng tasks.
    list_id = db.Column(
        db.Integer,
        db.ForeignKey("lists.id", ondelete="CASCADE"),  # Database tự xóa task khi list bị xóa. SQLite mặc định không thực thi.
        nullable=False,
        index=True  # Tìm task theo list nhanh hơn, vì PostgreSQL không tự tạo index cho khóa ngoại.
    )

    # Nội dung task, tối đa 500 ký tự, bắt buộc.
    text = db.Column(db.String(500), nullable=False)
    # Trạng thái hoàn thành. Task mới mặc định là chưa xong.
    completed = db.Column(db.Boolean, nullable=False, default=False)
    # Mã màu dạng #ff0000, đúng 7 ký tự. Không ghi nullable=False nên được để trống.
    color = db.Column(db.String(7))
    # Hạn hoàn thành, không bắt buộc. Kiểu Date chỉ lưu ngày, không lưu giờ.
    due_date = db.Column(db.Date)
    # Thứ tự kéo thả, vì database không đảm bảo thứ tự các dòng.
    position = db.Column(db.Integer, nullable=False, default=0)
    
    # Từ một task đi ngược về list của nó (task.todo_list). Nối với thuộc tính tasks bên ToDoList.
    todo_list = db.relationship("TodoList", back_populates="tasks")
    
    # Đổi object thành dict để trả về JSON. Dùng tên dueDate vì JS đang dùng tên đó.
    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "completed": self.completed,
            "color": self.color,
            # JSON không có kiểu ngày, nên đổi sang chuỗi "2026-11-07". Không có hạn thì trả về None.
            "dueDate": self.due_date.isoformat() if self.due_date else None,
        }