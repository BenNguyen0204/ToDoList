# extensions are created here and hooked up later in create_app() with init_app().
# separate file so models.py can import db without a circular import

from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

# naming convention for constraints, alembic needs the names to alter/drop them later
convention = {
    "ix": "ix_%(column_0_label)s",  # ix_tasks_list_id
    "uq": "uq_%(table_name)s_%(column_0_name)s",  # uq_users_username
    "ck": "ck_%(table_name)s_%(constraint_name)s",  # ck_tasks_valid_color
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",  # fk_tasks_list_id_lists
    "pk": "pk_%(table_name)s"  # pk_tasks
}

# MetaData covers every table so the convention applies to all of them
db = SQLAlchemy(metadata=MetaData(naming_convention=convention))

# batch mode bc sqlite can't really do ALTER TABLE.
# it makes a new table, copies the data over, drops the old one and renames
migrate = Migrate(render_as_batch=True)

# keeps track of who's logged in (stores the user id in the session cookie)
login_manager = LoginManager()