"""Все суммы — целые числа в тыйынах (1 сом = 100 тыйынов)."""
import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class CategoryType(str, enum.Enum):
    income = "income"
    expense = "expense"


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"


class Source(str, enum.Enum):
    manual = "manual"
    text = "text"
    voice = "voice"


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    initial_balance: Mapped[int] = mapped_column(Integer, default=0)  # тыйыны


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[CategoryType] = mapped_column(Enum(CategoryType))
    wallet_id: Mapped[int] = mapped_column(ForeignKey("wallets.id"))
    monthly_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)  # тыйыны

    wallet: Mapped[Wallet] = relationship()


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    amount: Mapped[int] = mapped_column(Integer)  # тыйыны, всегда > 0
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    wallet_id: Mapped[int] = mapped_column(ForeignKey("wallets.id"))  # откуда / куда для дохода-расхода
    to_wallet_id: Mapped[int | None] = mapped_column(ForeignKey("wallets.id"), nullable=True)  # только перевод
    date: Mapped[date] = mapped_column(Date, index=True)
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source: Mapped[Source] = mapped_column(Enum(Source), default=Source.manual)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    category: Mapped[Category | None] = relationship()
