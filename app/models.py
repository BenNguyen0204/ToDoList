# each class = a table, each db.Column = a column
from datetime import datetime, timezone

from flask_login import UserMixin

from .extensions import db

class User(UserMixin, db.Model):
    # UserMixin gives flask-login what it needs (is_authenticated, get_id, ...)
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    # stored lowercase, unique so two people can't take the same name
    username = db.Column(db.String(32), nullable=False, unique=True)
    # the name shown in the app. can be anything and doesn't have to be unique.
    # empty -> we show the username instead
    display_name = db.Column(db.String(50))
    # optional, stored lowercase. unique so a reminder can't go to two accounts.
    # 254 = longest an email address can be
    email = db.Column(db.String(254), unique=True)
    # when they clicked the link in the verification email. None = not verified,
    # and we never send reminders to an unverified address
    email_verified_at = db.Column(db.DateTime)
    # like "America/Toronto", sent by the browser. decides what "tomorrow" means for reminders
    timezone = db.Column(db.String(64))
    # never the real password, only the hash from generate_password_hash
    password_hash = db.Column(db.String(255), nullable=False)
    # lambda so it runs on every insert, not once when the file loads
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # one user -> many lists, deleting a user deletes their lists (and their tasks)
    lists = db.relationship("TodoList", back_populates="user", cascade="all, delete-orphan")

    # what the sidebar shows
    @property
    def shown_name(self):
        return self.display_name or self.username

    # for the account panel. never put password_hash in here
    def to_dict(self):
        return {
            "username": self.username,
            "displayName": self.display_name,
            "email": self.email,
            "emailVerified": self.email_verified_at is not None,
            "timezone": self.timezone,
            # date only, "2026-11-09", the JS formats it like the due dates
            "createdAt": self.created_at.date().isoformat(),
        }

class TodoList(db.Model):
    # named TodoList so it doesn't get mixed up with python's list
    __tablename__ = 'lists'

    # db gives us the id now, no more Date.now()
    id = db.Column(db.Integer, primary_key=True)
    # max 100 chars, required
    name = db.Column(db.String(100), nullable=False)

    # who owns this list. every lookup in api.py filters on this
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user = db.relationship("User", back_populates="lists")

    # one list -> many tasks, deleting a list deletes its tasks
    tasks = db.relationship(
        # string bc Task is defined below
        "Task",
        # keeps task.todo_list in sync
        back_populates="todo_list",
        # also deletes a task if it's removed from the list
        cascade="all, delete-orphan",
        # drag & drop order
        order_by="Task.position",
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
        # db level cascade, sqlite ignores it unless foreign keys are turned on
        db.ForeignKey("lists.id", ondelete="CASCADE"),
        nullable=False,
        # postgres doesn't index FKs by itself
        index=True
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
    # the due date we already sent a reminder for. if the due date changes,
    # it won't match anymore so the new date gets its own reminder
    reminded_for = db.Column(db.Date)

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