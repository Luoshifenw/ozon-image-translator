from pathlib import Path
from typing import Generator

from sqlmodel import Session, SQLModel, create_engine

from config import settings
from models import db_models  # noqa: F401


def _ensure_db_dir():
    db_path = Path(settings.DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)


_ensure_db_dir()
engine = create_engine(
    settings.DB_URL,
    connect_args={"check_same_thread": False} if settings.DB_URL.startswith("sqlite") else {},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
