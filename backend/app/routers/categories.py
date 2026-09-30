from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m, schemas as s
from ..database import get_db

router = APIRouter(prefix="/categories", tags=["categories"])


def _get(db: Session, category_id: int) -> m.Category:
    c = db.get(m.Category, category_id)
    if not c:
        raise HTTPException(404, "Категория не найдена")
    return c


def _check_wallet(db: Session, wallet_id: int):
    if not db.get(m.Wallet, wallet_id):
        raise HTTPException(422, "Кошелёк не существует")


@router.get("", response_model=list[s.CategoryOut])
def list_categories(
    wallet_id: int | None = None,
    type: m.CategoryType | None = None,
    db: Session = Depends(get_db),
):
    q = select(m.Category).order_by(m.Category.id)
    if wallet_id is not None:
        q = q.where(m.Category.wallet_id == wallet_id)
    if type is not None:
        q = q.where(m.Category.type == type)
    return db.scalars(q).all()


@router.post("", response_model=s.CategoryOut, status_code=201)
def create_category(data: s.CategoryIn, db: Session = Depends(get_db)):
    _check_wallet(db, data.wallet_id)
    c = m.Category(**data.model_dump())
    db.add(c)
    db.commit()
    return c


@router.get("/{category_id}", response_model=s.CategoryOut)
def get_category(category_id: int, db: Session = Depends(get_db)):
    return _get(db, category_id)


@router.patch("/{category_id}", response_model=s.CategoryOut)
def update_category(category_id: int, data: s.CategoryUpdate, db: Session = Depends(get_db)):
    c = _get(db, category_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("wallet_id") is not None:
        _check_wallet(db, changes["wallet_id"])
    for k, v in changes.items():
        # monthly_limit=null допустимо — снимает лимит; остальные поля null не принимают
        if v is None and k != "monthly_limit":
            continue
        setattr(c, k, v)
    db.commit()
    return c


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    c = _get(db, category_id)
    if db.scalar(select(m.Transaction.id).where(m.Transaction.category_id == c.id).limit(1)):
        raise HTTPException(409, "У категории есть операции")
    db.delete(c)
    db.commit()
