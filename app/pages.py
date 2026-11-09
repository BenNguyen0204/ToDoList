from flask import Blueprint, render_template

# a blueprint is just a group of routes
blueprint = Blueprint('pages', __name__)

@blueprint.route('/')
def index():
    return render_template('index.html')
