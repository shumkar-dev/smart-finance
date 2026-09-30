from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models as m, schemas as s
from ..database import get_db

router = APIRouter(prefix="/wallets", tags=["wallets"])


def _get(db: Session, wallet_id: int) -> m.Wallet:
    w = db.get(m.Wallet, wallet_id)
    if not w:
        raise HTTPException(404, "Кошелёк не найден")
    return w


@router.get("", response_model=list[s.WalletOut])
def list_wallets(db: Session = Depends(get_db)):
    return db.scalars(select(m.Wallet).order_by(m.Wallet.id)).all()


@router.post("", response_model=s.WalletOut, status_code=201)
def create_wallet(data: s.WalletIn, db: Session = Depends(get_db)):
    w = m.Wallet(**data.model_dump())
    db.add(w)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Кошелёк с таким названием уже есть")
    return w


@router.get("/{wallet_id}", response_model=s.WalletOut)
def get_wallet(wallet_id: int, db: Session = Depends(get_db)):
    return _get(db, wallet_id)


@router.patch("/{wallet_id}", response_model=s.WalletOut)
def update_wallet(wallet_id: int, data: s.WalletUpdate, db: Session = Depends(get_db)):
    w = _get(db, wallet_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is None:
            continue
        setattr(w, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Кошелёк с таким названием уже есть")
    return w


@router.delete("/{wallet_id}", status_code=204)
def delete_wallet(wallet_id: int, db: Session = Depends(get_db)):
    w = _get(db, wallet_id)
    used = db.scalar(
        select(m.Transaction.id).where(
            (m.Transaction.wallet_id == w.id) | (m.Transaction.to_wallet_id == w.id)
        ).limit(1)
    ) or db.scalar(select(m.Category.id).where(m.Category.wallet_id == w.id).limit(1))
    if used:
        raise HTTPException(409, "У кошелька есть категории или операции")
    db.delete(w)
    db.commit()
