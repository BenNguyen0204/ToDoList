# register / login / logout. these are normal html pages (forms), not json
import re

from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db
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


@blueprint.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("pages.index"))

    username = ""
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
def login():
    if current_user.is_authenticated:
        return redirect(url_for("pages.index"))

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
