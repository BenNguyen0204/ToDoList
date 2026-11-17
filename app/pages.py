from flask import Blueprint, jsonify, render_template
from flask_login import login_required

blueprint = Blueprint('pages', __name__)

@blueprint.route('/')
@login_required
def index():
    return "HIHI"

# render calls this every few seconds to check the app is alive. no login, no database,
# so it stays fast and doesn't fail just because neon is waking up
@blueprint.get('/healthz')
def healthz():
    return jsonify(status="ok")
