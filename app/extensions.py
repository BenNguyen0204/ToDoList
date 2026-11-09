# extensions are created here and hooked up later in create_app() with init_app().
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
    # ix_tasks_list_id
    "ix": "ix_%(column_0_label)s",
    # uq_users_username
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    # ck_tasks_valid_color
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    # fk_tasks_list_id_lists
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    # pk_tasks
    "pk": "pk_%(table_name)s"
}

# MetaData covers every table so the convention applies to all of them
db = SQLAlchemy(metadata=MetaData(naming_convention=convention))

# batch mode bc sqlite can't really do ALTER TABLE.
# it makes a new table, copies the data over, drops the old one and renames
migrate = Migrate(render_as_batch=True)

# keeps track of who's logged in (stores the user id in the session cookie)
login_manager = LoginManager()

# CSRF: every POST/PATCH/PUT/DELETE must carry a secret token from our own page,
# so another website can't make your browser send requests with your cookie
csrf = CSRFProtect()

# the client's ip. on render, ProxyFix (stage 10) makes this the real visitor ip
def client_ip():
    return request.remote_addr or "127.0.0.1"

# rate limiting (counts are kept in memory, see RATELIMIT_STORAGE_URI)
limiter = Limiter(key_func=client_ip)