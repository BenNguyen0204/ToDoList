from flask import Flask
from .extensions import db, migrate

def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///todo.db"  # file nằm trong instance/
    
    db.init_app(app)
    migrate.init_app(app, db)
    
    from . import models

    from .pages import blueprint as pages_blueprint
    app.register_blueprint(pages_blueprint)
    
    return app