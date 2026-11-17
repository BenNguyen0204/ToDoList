# separate file so models.py can import db without a circular import

from flask import request
from flask_limiter import Limiter
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect
from sqlalchemy import MetaData

# naming convention for constraints, alembic needs the names to alter/drop them later
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

db = SQLAlchemy(metadata=MetaData(naming_convention=convention))

# batch mode bc sqlite can't really do ALTER TABLE.
migrate = Migrate(render_as_batch=True)

login_manager = LoginManager()

csrf = CSRFProtect()

# the client's ip. on render, ProxyFix makes this the real visitor ip
def client_ip():
    return request.remote_addr or "127.0.0.1"

limiter = Limiter(key_func=client_ip)