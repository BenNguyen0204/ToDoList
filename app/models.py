from datetime import datetime, timezone

from flask_login import UserMixin

from .extensions import db

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    # stored lowercase, unique so two people can't take the same name
    username = db.Column(db.String(32), nullable=False, unique=True)
    display_name = db.Column(db.String(50))
    # optional, stored lowercase. unique so a reminder can't go to two accounts.
    email = db.Column(db.String(254), unique=True)
    # when they clicked the link in the verification email. None = not verified,
    # and we never send reminders to an unverified address
    email_verified_at = db.Column(db.DateTime)
    # like "America/Toronto", sent by the browser. decides what "tomorrow" means for reminders
    timezone = db.Column(db.String(64))
    password_hash = db.Column(db.String(255), nullable=False)
    # lambda so it runs on every insert, not once when the file loads
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    lists = db.relationship("TodoList", back_populates="user", cascade="all, delete-orphan")

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
            "createdAt": self.created_at.date().isoformat(),
        }

class TodoList(db.Model):
    __tablename__ = 'lists'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

    # who owns this list. every lookup in api.py filters on this
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user = db.relationship("User", back_populates="lists")

    tasks = db.relationship(
        "Task",
        back_populates="todo_list",
        cascade="all, delete-orphan",
        order_by="Task.position",
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "tasks": [task.to_dict() for task in self.tasks]
        }
        
class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)

    list_id = db.Column(
        db.Integer,
        # db level cascade, sqlite ignores it unless foreign keys are turned on
        db.ForeignKey("lists.id", ondelete="CASCADE"),
        nullable=False,
        # postgres doesn't index FKs by itself
        index=True
    )

    text = db.Column(db.String(500), nullable=False)
    completed = db.Column(db.Boolean, nullable=False, default=False)
    color = db.Column(db.String(7))
    due_date = db.Column(db.Date)
    # drag & drop order, the db doesn't keep row order
    position = db.Column(db.Integer, nullable=False, default=0)
    # the due date we already sent a reminder for. if the due date changes,
    # it won't match anymore so the new date gets its own reminder
    reminded_for = db.Column(db.Date)

    todo_list = db.relationship("TodoList", back_populates="tasks")
    
    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "completed": self.completed,
            "color": self.color,
            "dueDate": self.due_date.isoformat() if self.due_date else None,
        }