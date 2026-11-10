from flask import Blueprint, jsonify, render_template
from flask_login import login_required

# a blueprint is just a group of routes
blueprint = Blueprint('pages', __name__)

# not logged in -> unauthorized_handler in __init__.py sends you to /login
@blueprint.route('/')
@login_required
def index():
    return render_template('index.html')

# render calls this every few seconds to check the app is alive. no login, no database,
# so it stays fast and doesn't fail just because neon is waking up
@blueprint.get('/healthz')
def healthz():
    return jsonify(status="ok")
