from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import CategoryType, Source, TransactionType


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class WalletIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    initial_balance: int = 0


class WalletUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    initial_balance: int | None = None


class WalletOut(ORM, WalletIn):
    id: int


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    wallet_id: int
    monthly_limit: int | None = Field(default=None, ge=0)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: CategoryType | None = None
    wallet_id: int | None = None
    monthly_limit: int | None = Field(default=None, ge=0)


class CategoryOut(ORM, CategoryIn):
    id: int


class TransactionIn(BaseModel):
    type: TransactionType
    amount: int = Field(gt=0)
    category_id: int | None = None
    wallet_id: int
    to_wallet_id: int | None = None
    date: date
    comment: str | None = Field(default=None, max_length=500)
    source: Source = Source.manual

    @model_validator(mode="after")
    def _check(self):
        if self.type == TransactionType.transfer:
            if self.to_wallet_id is None:
                raise ValueError("Для перевода нужен to_wallet_id")
            if self.to_wallet_id == self.wallet_id:
                raise ValueError("Кошельки перевода должны различаться")
            if self.category_id is not None:
                raise ValueError("У перевода не бывает категории")
        elif self.to_wallet_id is not None:
            raise ValueError("to_wallet_id только для перевода")
        return self


class TransactionOut(ORM, TransactionIn):
    id: int


class WalletBalance(BaseModel):
    wallet_id: int
    name: str
    balance: int


class PeriodTotals(BaseModel):
    income: int
    expense: int


class CategoryUsage(BaseModel):
    category_id: int
    name: str
    wallet_id: int
    spent: int
    monthly_limit: int | None
    percent: float | None  # None, если лимита нет


class Summary(BaseModel):
    today: date
    balances: list[WalletBalance]
    day: PeriodTotals
    month: PeriodTotals
    categories: list[CategoryUsage]
