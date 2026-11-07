from flask import Blueprint, render_template

# Blueprint là một nhóm route đi chung với nhau.
blueprint = Blueprint('pages', __name__)

@blueprint.route('/')
def index():
    return render_template('index.html')
