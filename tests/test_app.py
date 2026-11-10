# tests for the things most likely to break: login protection, the task api, and
# users not being able to touch each other's data. run with: pytest
import pytest

from app import create_app
from app.extensions import db


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
