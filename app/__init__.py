import os

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, url_for
from .extensions import csrf, db, limiter, login_manager, migrate


# "1", "true", "yes", "on" -> True. not set -> default
def env_flag(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def create_app(test_config=None):
    # reads .env into environment variables. `flask run` does this by itself,
    # gunicorn (stage 10) doesn't, so do it here too. never overrides real env vars
    load_dotenv()

    app = Flask(__name__)

    # secure cookies only travel over https. your laptop is http, so .env sets COOKIE_SECURE=0.
    # on render it stays on (the default)
    cookie_secure = env_flag("COOKIE_SECURE", True)

    app.config.update(
        SQLALCHEMY_DATABASE_URI="sqlite:///todo.db",  # ends up in instance/

        # signs the session cookie so nobody can fake being logged in. comes from .env, never from git
        SECRET_KEY=os.environ.get("SECRET_KEY"),

        # HttpOnly: JS can't read the cookie, so injected JS can't steal your session
        # SameSite=Lax: the cookie isn't sent on POSTs that come from other sites
        # Secure: https only
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=cookie_secure,
        # same settings for flask-login's "remember me" cookie
        REMEMBER_COOKIE_HTTPONLY=True,
        REMEMBER_COOKIE_SAMESITE="Lax",
        REMEMBER_COOKIE_SECURE=cookie_secure,

        # csrf tokens normally expire after 1 hour, which breaks a tab left open all day.
        # the token is still tied to your session, so it's safe without a time limit
        WTF_CSRF_TIME_LIMIT=None,

        # keep rate limit counts in memory (that's why render runs 1 worker, see stage 10)
        RATELIMIT_STORAGE_URI="memory://",

        # set REGISTRATION_OPEN=0 once your account exists, so strangers can't sign up
        REGISTRATION_OPEN=env_flag("REGISTRATION_OPEN", True),
    )

    # tests (stage 8) pass their own settings here: temp database, csrf off, etc.
    # has to run before the SECRET_KEY check so tests can provide one
    if test_config:
        app.config.update(test_config)

    # fail loudly at startup instead of running with no key
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("SECRET_KEY is not set. Copy .env.example to .env and fill it in.")

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)

    from . import models

    # flask-login only keeps the user id in the cookie, this turns it back into a User
    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(models.User, int(user_id))

    # runs when @login_required blocks someone who isn't logged in
    @login_manager.unauthorized_handler
    def unauthorized():
        # the JS reads the 401 and goes to /login itself
        if request.path.startswith("/api/"):
            return jsonify(error="Login required"), 401
        return redirect(url_for("auth.login"))

    from .pages import blueprint as pages_blueprint
    app.register_blueprint(pages_blueprint)

    from .auth import blueprint as auth_blueprint
    app.register_blueprint(auth_blueprint)

    from .api import blueprint as api_blueprint, register_error_handlers
    app.register_blueprint(api_blueprint, url_prefix="/api")
    register_error_handlers(app)

    return app