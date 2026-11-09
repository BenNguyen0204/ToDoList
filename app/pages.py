from flask import Blueprint, render_template
from flask_login import login_required

# a blueprint is just a group of routes
blueprint = Blueprint('pages', __name__)

# not logged in -> unauthorized_handler in __init__.py sends you to /login
@blueprint.route('/')
@login_required
def index():
    return render_template('index.html')