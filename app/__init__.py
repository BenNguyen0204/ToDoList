from flask import Flask, render_template

def create_app():
    app = Flask(__name__)
    from .pages import blueprint as pages_blueprint
    app.register_blueprint(pages_blueprint)
    
    return app