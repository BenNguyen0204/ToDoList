from flask import Flask, jsonify, redirect, request, url_for
from .extensions import db, login_manager, migrate
 
def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///todo.db"  # ends up in instance/
    
    # signs the session cookie so nobody can fake being logged in.
    # TEMPORARY: stage 7 moves this to .env, never ship a key that's in git
    app.config["SECRET_KEY"] = "dev-only-change-me"
 
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
 
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