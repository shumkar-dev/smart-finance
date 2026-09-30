from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Category, CategoryType, Wallet

INCOME = ["Уборка квартиры", "Генеральная уборка", "Уборка после ремонта", "Офис", "Химчистка мебели"]
BUSINESS_EXPENSE = ["Химия и средства", "Инвентарь", "Оплата клинерам", "Транспорт/бензин", "Реклама", "Связь"]
PERSONAL_EXPENSE = ["Еда", "Жильё", "Транспорт", "Развлечения", "Прочее"]


def seed(db: Session) -> None:
    """Шаблон «Клининг». Выполняется только в пустой базе."""
    if db.scalar(select(Wallet.id).limit(1)) is not None:
        return
    personal, business = Wallet(name="Личное"), Wallet(name="Бизнес")
    db.add_all([personal, business])
    db.flush()
    for name in INCOME:
        db.add(Category(name=name, type=CategoryType.income, wallet_id=business.id))
    for name in BUSINESS_EXPENSE:
        db.add(Category(name=name, type=CategoryType.expense, wallet_id=business.id))
    for name in PERSONAL_EXPENSE:
        db.add(Category(name=name, type=CategoryType.expense, wallet_id=personal.id))
    db.commit()
