from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas as s
from ..database import get_db
from ..summary import build_summary

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("", response_model=s.Summary)
def get_summary(on: date | None = None, db: Session = Depends(get_db)):
    """Сводка на дату `on` (по умолчанию — сегодня)."""
    return build_summary(db, on or date.today())
