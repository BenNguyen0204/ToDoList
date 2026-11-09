# register / login / logout. these are normal html pages (forms), not json
import re

from flask import Blueprint, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import client_ip, db, limiter
from .models import User

blueprint = Blueprint("auth", __name__)

# 3-32 chars, lowercase letters, numbers, underscore (we lowercase before checking)
USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,32}$")
MIN_PASSWORD_LENGTH = 8
# hashing is slow on purpose, a 1MB "password" would tie up the server
MAX_PASSWORD_LENGTH = 128


def read_form():
    # lowercase so "Hung" and "hung" are the same account
    username = request.form.get("username", "").strip().lower()
    password = request.form.get("password", "")
    return username, password


# rate limit key for login: the username being tried.
# limiting only by ip isn't enough on its own: lots of people can share one ip (school wifi)
def username_key():
    return "user:" + (request.form.get("username", "").strip().lower() or client_ip())


# too many attempts -> limiter raises a 429. show it on the form instead of a bare error page
@blueprint.errorhandler(429)
def too_many_attempts(error):
    mode = "register" if request.endpoint == "auth.register" else "login"
    flash("Too many attempts. Wait a minute and try again.")
    return render_template("auth.html", mode=mode, username=""), 429


# don't let the browser keep a copy of these pages. otherwise the back button can show
# an old login page while you're still logged in, and the form on it looks like it works
@blueprint.after_request
def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


# already logged in and opened /login or /register
def already_logged_in(mode):
    # just opening the page -> go to your lists
    if request.method == "GET":
        return redirect(url_for("pages.index"))
    # a form got sent anyway (e.g. from an old page). don't quietly ignore it,
    # say who you're logged in as. auth.html shows a log out button instead of the form
    flash(f"You're already logged in as {current_user.username}. Log out first to use another account.")
    return render_template("auth.html", mode=mode, username="")


@blueprint.route("/register", methods=["GET", "POST"])
# max 10 sign-ups per hour from one ip, stops a script from making thousands of accounts
@limiter.limit("10 per hour", methods=["POST"])
def register():
    if current_user.is_authenticated:
        return already_logged_in("register")

    username = ""
    if not current_app.config["REGISTRATION_OPEN"]:
        if request.method == "POST":
            flash("Sign-ups are closed")
        return render_template("auth.html", mode="register", username=username), 403

    if request.method == "POST":
        username, password = read_form()

        if not USERNAME_PATTERN.match(username):
            flash("Username must be 3-32 characters: letters, numbers or _")
        elif not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
            flash(f"Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters")
        else:
            user = User(username=username, password_hash=generate_password_hash(password))
            db.session.add(user)
            try:
                db.session.commit()
            except IntegrityError:
                # unique constraint caught a duplicate. checking first isn't enough,
                # two requests could both pass the check at the same time
                db.session.rollback()
                flash("That username is taken")
            else:
                login_user(user, remember=True)
                return redirect(url_for("pages.index"))

    return render_template("auth.html", mode="register", username=username)


@blueprint.route("/login", methods=["GET", "POST"])
# only POSTs count (just opening the page shouldn't).
# 10/min per username stops guessing one account's password,
# 30/min per ip stops one person trying lots of different usernames
@limiter.limit("10 per minute", methods=["POST"], key_func=username_key)
@limiter.limit("30 per minute", methods=["POST"])
def login():
    if current_user.is_authenticated:
        return already_logged_in("login")

    username = ""
    if request.method == "POST":
        username, password = read_form()
        user = db.session.scalar(db.select(User).filter_by(username=username))

        # same message either way so nobody can find out which usernames exist
        if user is None or not check_password_hash(user.password_hash, password):
            flash("Wrong username or password")
        else:
            # remember=True keeps you logged in after closing the browser
            login_user(user, remember=True)
            return redirect(url_for("pages.index"))

    return render_template("auth.html", mode="login", username=username)


# POST only: a GET logout could be triggered by any link or <img> on another site
@blueprint.post("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("auth.login"))