from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m, schemas as s
from ..database import get_db

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _get(db: Session, tx_id: int) -> m.Transaction:
    t = db.get(m.Transaction, tx_id)
    if not t:
        raise HTTPException(404, "Операция не найдена")
    return t


def _validate(db: Session, data: s.TransactionIn):
    for wid in (data.wallet_id, data.to_wallet_id):
        if wid is not None and not db.get(m.Wallet, wid):
            raise HTTPException(422, "Кошелёк не существует")
    if data.category_id is not None:
        c = db.get(m.Category, data.category_id)
        if not c:
            raise HTTPException(422, "Категория не существует")
        if c.type.value != data.type.value:
            raise HTTPException(422, "Тип категории не совпадает с типом операции")
        if c.wallet_id != data.wallet_id:
            raise HTTPException(422, "Категория относится к другому кошельку")


@router.get("", response_model=list[s.TransactionOut])
def list_transactions(
    wallet_id: int | None = None,
    category_id: int | None = None,
    type: m.TransactionType | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = select(m.Transaction).order_by(m.Transaction.date.desc(), m.Transaction.id.desc())
    if wallet_id is not None:
        q = q.where((m.Transaction.wallet_id == wallet_id) | (m.Transaction.to_wallet_id == wallet_id))
    if category_id is not None:
        q = q.where(m.Transaction.category_id == category_id)
    if type is not None:
        q = q.where(m.Transaction.type == type)
    if date_from is not None:
        q = q.where(m.Transaction.date >= date_from)
    if date_to is not None:
        q = q.where(m.Transaction.date <= date_to)
    return db.scalars(q.limit(min(max(limit, 1), 500)).offset(max(offset, 0))).all()


@router.post("", response_model=s.TransactionOut, status_code=201)
def create_transaction(data: s.TransactionIn, db: Session = Depends(get_db)):
    _validate(db, data)
    t = m.Transaction(**data.model_dump())
    db.add(t)
    db.commit()
    return t


@router.get("/{tx_id}", response_model=s.TransactionOut)
def get_transaction(tx_id: int, db: Session = Depends(get_db)):
    return _get(db, tx_id)


@router.put("/{tx_id}", response_model=s.TransactionOut)
def replace_transaction(tx_id: int, data: s.TransactionIn, db: Session = Depends(get_db)):
    t = _get(db, tx_id)
    _validate(db, data)
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    db.commit()
    return t


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    db.delete(_get(db, tx_id))
    db.commit()
