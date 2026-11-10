# tests for the things most likely to break: login protection, the task api, and
# users not being able to touch each other's data. run with: pytest
from datetime import datetime, timedelta, timezone

import pytest

from app import create_app, reminders
from app.extensions import db
from app.mailer import make_verify_token
from app.models import User


@pytest.fixture
def app(tmp_path):
    app = create_app({
        # fresh database file per test, deleted by pytest afterwards
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        "TESTING": True,
        "SECRET_KEY": "test",
        # no csrf token to fetch in tests, and no "too many attempts" from signing up a lot
        "WTF_CSRF_ENABLED": False,
        "RATELIMIT_ENABLED": False,
        # the test client talks plain http, secure cookies wouldn't be sent back
        "SESSION_COOKIE_SECURE": False,
        "REMEMBER_COOKIE_SECURE": False,
        "REGISTRATION_OPEN": True,
        # no real emails
        "BREVO_API_KEY": None,
        # so the reminders url is turned on
        "REMINDER_TOKEN": "test-token",
    })
    with app.app_context():
        db.create_all()
    yield app


@pytest.fixture
def client(app):
    return app.test_client()


def register(client, username, password="password123"):
    # successful sign up redirects to "/", a failed one re-renders the form (200)
    response = client.post("/register", data={"username": username, "password": password})
    assert response.status_code == 302, "sign up failed"
    return response


def login(client, username, password="password123"):
    response = client.post("/login", data={"username": username, "password": password})
    assert response.status_code == 302, "login failed"
    return response


def logout(client):
    client.post("/logout")


# makes a list and a task in it, returns the task's id
def create_task(client, text="Buy milk"):
    todo_list = client.post("/api/lists", json={"name": "Groceries"}).get_json()
    response = client.post(f"/api/lists/{todo_list['id']}/tasks", json={"text": text})
    assert response.status_code == 201
    return response.get_json()["id"]


def test_healthz(client):
    # render's health check: works without logging in
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_api_needs_login(client):
    response = client.get("/api/lists")
    assert response.status_code == 401
    assert response.get_json() == {"error": "Login required"}


def test_sign_up_then_log_in(client):
    register(client, "alice")
    logout(client)
    # logged out again -> api is locked
    assert client.get("/api/lists").status_code == 401

    # wrong password doesn't log you in
    response = client.post("/login", data={"username": "alice", "password": "wrong-password"})
    assert response.status_code == 200
    assert client.get("/api/lists").status_code == 401

    login(client, "alice")
    response = client.get("/api/lists")
    assert response.status_code == 200
    assert response.get_json() == []


def test_create_edit_delete_task(client):
    register(client, "alice")
    task_id = create_task(client)

    response = client.patch(f"/api/tasks/{task_id}",
                            json={"text": "Buy oat milk", "completed": True, "dueDate": "2026-11-20"})
    assert response.status_code == 200
    task = response.get_json()
    assert task["text"] == "Buy oat milk"
    assert task["completed"] is True
    assert task["dueDate"] == "2026-11-20"

    # bad input is rejected and nothing changes
    assert client.patch(f"/api/tasks/{task_id}", json={"color": "red"}).status_code == 400

    # the change was saved, not just echoed back
    [todo_list] = client.get("/api/lists").get_json()
    assert todo_list["tasks"] == [task]

    assert client.delete(f"/api/tasks/{task_id}").status_code == 204
    [todo_list] = client.get("/api/lists").get_json()
    assert todo_list["tasks"] == []


def test_users_cant_touch_each_others_data(client):
    # alice makes a list with a task
    register(client, "alice")
    task_id = create_task(client)
    [alice_list] = client.get("/api/lists").get_json()
    logout(client)

    # bob doesn't see it, and gets 404 (not 403) so he can't even tell it exists
    register(client, "bob")
    assert client.get("/api/lists").get_json() == []
    assert client.patch(f"/api/tasks/{task_id}", json={"text": "hacked"}).status_code == 404
    assert client.delete(f"/api/tasks/{task_id}").status_code == 404
    assert client.patch(f"/api/lists/{alice_list['id']}", json={"name": "hacked"}).status_code == 404
    assert client.post(f"/api/lists/{alice_list['id']}/tasks", json={"text": "spam"}).status_code == 404
    assert client.delete(f"/api/lists/{alice_list['id']}").status_code == 404
    logout(client)

    # alice's data is untouched
    login(client, "alice")
    assert client.get("/api/lists").get_json() == [alice_list]


def test_lists_rename_reorder_delete(client):
    register(client, "alice")
    todo_list = client.post("/api/lists", json={"name": "Chores"}).get_json()
    list_id = todo_list["id"]

    response = client.patch(f"/api/lists/{list_id}", json={"name": "House"})
    assert response.get_json()["name"] == "House"
    assert client.post("/api/lists", json={"name": "   "}).status_code == 400

    ids = [client.post(f"/api/lists/{list_id}/tasks", json={"text": t}).get_json()["id"]
           for t in ("A", "B", "C")]
    # new order C, A. B wasn't sent, so it stays at the end instead of getting lost
    assert client.put(f"/api/lists/{list_id}/order", json={"taskIds": [ids[2], ids[0]]}).status_code == 204
    [todo_list] = client.get("/api/lists").get_json()
    assert [t["text"] for t in todo_list["tasks"]] == ["C", "A", "B"]
    assert client.put(f"/api/lists/{list_id}/order", json={"taskIds": "1,2"}).status_code == 400

    # deleting the list takes its tasks with it
    assert client.delete(f"/api/lists/{list_id}").status_code == 204
    assert client.get("/api/lists").get_json() == []
    assert client.patch(f"/api/tasks/{ids[0]}", json={"text": "x"}).status_code == 404


def test_account_settings_and_password_change(client):
    register(client, "alice")

    response = client.patch("/api/account", json={"displayName": "Alice", "timezone": "America/Toronto"})
    assert response.status_code == 200
    assert response.get_json()["displayName"] == "Alice"
    assert response.get_json()["timezone"] == "America/Toronto"
    assert client.patch("/api/account", json={"timezone": "Mars/Base"}).status_code == 400

    # wrong current password or too short a new one -> 400, password unchanged
    assert client.post("/api/account/password",
                       json={"currentPassword": "nope", "newPassword": "newpassword1"}).status_code == 400
    assert client.post("/api/account/password",
                       json={"currentPassword": "password123", "newPassword": "short"}).status_code == 400
    assert client.post("/api/account/password",
                       json={"currentPassword": "password123", "newPassword": "newpassword1"}).status_code == 204

    # only the new password works now
    logout(client)
    assert client.post("/login", data={"username": "alice", "password": "password123"}).status_code == 200
    login(client, "alice", "newpassword1")


def verify_email(app, client, email):
    response = client.put("/api/account/email", json={"email": email})
    assert response.status_code == 200
    # the token that would be in the email
    with app.app_context():
        user = db.session.scalar(db.select(User).filter_by(email=email))
        token = make_verify_token(user)
    return client.get(f"/verify-email/{token}")


def test_email_verification(app, client):
    register(client, "alice")
    assert client.put("/api/account/email", json={"email": "not-an-email"}).status_code == 400

    assert client.get("/verify-email/fake-token").status_code == 400
    assert verify_email(app, client, "alice@example.com").status_code == 200
    assert client.get("/api/account").get_json()["emailVerified"] is True

    # another account can't take the same email
    logout(client)
    register(client, "bob")
    assert client.put("/api/account/email", json={"email": "alice@example.com"}).status_code == 400


def test_reminders(app, client, monkeypatch):
    # catch emails instead of sending them
    sent = []
    monkeypatch.setattr(reminders, "send_email", lambda to, subject, text: sent.append((to, subject, text)))

    register(client, "alice")
    verify_email(app, client, "alice@example.com")
    todo_list = client.post("/api/lists", json={"name": "School"}).get_json()
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    client.post(f"/api/lists/{todo_list['id']}/tasks", json={"text": "Essay", "dueDate": tomorrow})
    client.post(f"/api/lists/{todo_list['id']}/tasks", json={"text": "Not due yet"})

    # no token or the wrong one -> 404, like the url doesn't exist
    assert client.post("/internal/send-reminders").status_code == 404
    assert client.post("/internal/send-reminders", headers={"Authorization": "Bearer wrong"}).status_code == 404

    auth = {"Authorization": "Bearer test-token"}
    assert client.post("/internal/send-reminders", headers=auth).get_json() == {"emailsSent": 1}
    [(to, subject, text)] = sent
    assert to == "alice@example.com"
    assert "Essay" in text and "Not due yet" not in text

    # running it again the same day doesn't send a second email
    assert client.post("/internal/send-reminders", headers=auth).get_json() == {"emailsSent": 0}
