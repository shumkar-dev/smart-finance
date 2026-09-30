from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from . import models as m
from .schemas import CategoryUsage, PeriodTotals, Summary, WalletBalance

T = m.TransactionType


def _sum(condition):
    return func.coalesce(func.sum(case((condition, m.Transaction.amount), else_=0)), 0)


def wallet_balances(db: Session) -> list[WalletBalance]:
    # Остаток = стартовый + доходы − расходы + входящие переводы − исходящие
    result = []
    for w in db.scalars(select(m.Wallet).order_by(m.Wallet.id)):
        own = db.execute(
            select(
                _sum(m.Transaction.type == T.income),
                _sum(m.Transaction.type == T.expense),
                _sum(m.Transaction.type == T.transfer),
            ).where(m.Transaction.wallet_id == w.id)
        ).one()
        incoming = db.scalar(
            select(func.coalesce(func.sum(m.Transaction.amount), 0)).where(
                m.Transaction.type == T.transfer, m.Transaction.to_wallet_id == w.id
            )
        )
        balance = w.initial_balance + own[0] - own[1] - own[2] + incoming
        result.append(WalletBalance(wallet_id=w.id, name=w.name, balance=balance))
    return result


def _totals(db: Session, start: date, end: date) -> PeriodTotals:
    """end — не включительно."""
    inc, exp = db.execute(
        select(_sum(m.Transaction.type == T.income), _sum(m.Transaction.type == T.expense)).where(
            m.Transaction.date >= start, m.Transaction.date < end
        )
    ).one()
    return PeriodTotals(income=inc, expense=exp)


def build_summary(db: Session, today: date) -> Summary:
    month_start = today.replace(day=1)
    next_month = (month_start.replace(day=28) + (date(2000, 1, 5) - date(2000, 1, 1))).replace(day=1)
    day_end = date.fromordinal(today.toordinal() + 1)

    spent = dict(
        db.execute(
            select(m.Transaction.category_id, func.sum(m.Transaction.amount))
            .where(
                m.Transaction.type == T.expense,
                m.Transaction.date >= month_start,
                m.Transaction.date < next_month,
            )
            .group_by(m.Transaction.category_id)
        ).all()
    )
    usage = []
    for c in db.scalars(
        select(m.Category).where(m.Category.type == m.CategoryType.expense).order_by(m.Category.id)
    ):
        s = spent.get(c.id, 0)
        pct = round(s * 100 / c.monthly_limit, 1) if c.monthly_limit else None
        usage.append(
            CategoryUsage(
                category_id=c.id, name=c.name, wallet_id=c.wallet_id,
                spent=s, monthly_limit=c.monthly_limit, percent=pct,
            )
        )
    return Summary(
        today=today,
        balances=wallet_balances(db),
        day=_totals(db, today, day_end),
        month=_totals(db, month_start, next_month),
        categories=usage,
    )
