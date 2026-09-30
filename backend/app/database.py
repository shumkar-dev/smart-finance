import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Для PostgreSQL достаточно сменить переменную, например:
# DATABASE_URL=postgresql+psycopg://user:pass@localhost/smart_finance
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smart_finance.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
