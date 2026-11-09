# each class = a table, each db.Column = a column
from .extensions import db

class TodoList(db.Model):
    # named TodoList so it doesn't get mixed up with python's list
    __tablename__ = 'lists'

    # db gives us the id now, no more Date.now()
    id = db.Column(db.Integer, primary_key=True)
    # max 100 chars, required
    name = db.Column(db.String(100), nullable=False)
    
    # one list -> many tasks, deleting a list deletes its tasks
    tasks = db.relationship(
        "Task",  # string bc Task is defined below
        back_populates="todo_list",  # keeps task.todo_list in sync
        cascade="all, delete-orphan",  # also deletes a task if it's removed from the list
        order_by="Task.position",  # drag & drop order
    )
    
    # so flask can send it as json
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "tasks": [task.to_dict() for task in self.tasks]
        }
        
class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)

    # which list the task is in (FK goes on the "many" side)
    list_id = db.Column(
        db.Integer,
        db.ForeignKey("lists.id", ondelete="CASCADE"),  # db level cascade, sqlite ignores it unless foreign keys are turned on
        nullable=False,
        index=True  # postgres doesn't index FKs by itself
    )

    # max 500 chars, required
    text = db.Column(db.String(500), nullable=False)
    # new tasks start not done
    completed = db.Column(db.Boolean, nullable=False, default=False)
    # hex like #ff0000, optional
    color = db.Column(db.String(7))
    # date only (no time), optional
    due_date = db.Column(db.Date)
    # drag & drop order, the db doesn't keep row order
    position = db.Column(db.Integer, nullable=False, default=0)
    
    # task.todo_list, other side of TodoList.tasks
    todo_list = db.relationship("TodoList", back_populates="tasks")
    
    # dueDate in camelCase bc that's what the JS uses
    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "completed": self.completed,
            "color": self.color,
            # json has no date type -> "2026-11-07" or None
            "dueDate": self.due_date.isoformat() if self.due_date else None,
        }