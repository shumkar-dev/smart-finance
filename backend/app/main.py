from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (регистрация таблиц)
from .database import Base, SessionLocal, engine
from .routers import categories, summary, transactions, wallets
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="Smart Finance", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "capacitor://localhost", "http://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (wallets, categories, transactions, summary):
    app.include_router(r.router, prefix="/api")
