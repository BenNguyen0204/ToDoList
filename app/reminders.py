# daily "your task is due tomorrow" emails.
# github actions calls POST /internal/send-reminders once a day (.github/workflows/reminders.yml).
# locally you can run the same thing with: flask send-reminders
import hmac
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import click
from flask import Blueprint, abort, current_app, jsonify, request
from sqlalchemy import or_

from .extensions import db
from .mailer import send_email
from .models import Task, TodoList, User

# cli_group=None -> "flask send-reminders" instead of "flask reminders send-reminders"
blueprint = Blueprint("reminders", __name__, cli_group=None)


def user_zone(user):
    try:
        return ZoneInfo(user.timezone) if user.timezone else timezone.utc
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


def send_due_reminders(now=None):
    now = now or datetime.now(timezone.utc)
    users = db.session.scalars(db.select(User).where(User.email_verified_at.is_not(None))).all()

    emails_sent = 0
    for user in users:
        # "tomorrow" in the user's timezone, not the server's
        tomorrow = (now.astimezone(user_zone(user)) + timedelta(days=1)).date()
        tasks = db.session.scalars(
            db.select(Task)
            .join(TodoList)
            .where(
                TodoList.user_id == user.id,
                Task.completed.is_(False),
                Task.due_date == tomorrow,
                # skip ones we already reminded about. if the job runs twice, nobody gets 2 emails
                or_(Task.reminded_for.is_(None), Task.reminded_for != Task.due_date),
            )
            .order_by(TodoList.id, Task.position)
        ).all()
        if not tasks:
            continue

        lines = "\n".join(f"- {task.text} ({task.todo_list.name})" for task in tasks)
        try:
            send_email(
                user.email,
                f"{len(tasks)} task{'s' if len(tasks) != 1 else ''} due tomorrow",
                f"Hi {user.shown_name},\n\nThese are due tomorrow ({tomorrow:%b %d}):\n\n{lines}\n",
            )
        except Exception:
            # one bad address shouldn't stop everyone else's reminders.
            # not marked as reminded, so it gets tried again next run
            current_app.logger.exception("reminder email to user %s failed", user.id)
            continue

        for task in tasks:
            task.reminded_for = task.due_date
        db.session.commit()
        emails_sent += 1

    return emails_sent


@blueprint.post("/internal/send-reminders")
def send_reminders_route():
    token = current_app.config["REMINDER_TOKEN"]
    given = request.headers.get("Authorization", "")
    # compare_digest takes the same time whether it's close or not, so the token can't be guessed
    # one character at a time. 404 so the url looks like it doesn't exist
    if not token or not hmac.compare_digest(given.encode(), f"Bearer {token}".encode()):
        abort(404)
    return jsonify(emailsSent=send_due_reminders())


@blueprint.cli.command("send-reminders")
def send_reminders_command():
    click.echo(f"emails sent: {send_due_reminders()}")
