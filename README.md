# Умная заметка — личный бухгалтер

Учёт личных и бизнес-денег (сом). Данные хранятся на сервере, фронтенд работает только через REST API
(это позволит подключить ИИ-ассистента, Telegram-бота и Android-виджет).

- `backend/` — Python, FastAPI, SQLAlchemy, SQLite
- `frontend/` — React + Vite + TypeScript, PWA

Суммы везде хранятся целыми числами в **тыйынах** (1 сом = 100 тыйынов). Остатки и итоги считаются запросами, отдельно не хранятся.

## Запуск backend (порт 8000)

```bash
cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload
```

Документация API: http://localhost:8000/docs. При первом запуске создаётся `smart_finance.db`
с кошельками «Личное»/«Бизнес» и категориями шаблона «Клининг».
Для PostgreSQL задайте `DATABASE_URL` (например `postgresql+psycopg://user:pass@host/db`) и установите драйвер.

Тесты: `cd backend && python -m pytest`

## Запуск frontend (порт 5173)

```bash
cd frontend && npm install
npm run dev
```

В dev-режиме запросы `/api` проксируются на `localhost:8000`. Для сборки: `npm run build`
(другой адрес API — переменная `VITE_API_URL`).

## API

`/api/wallets`, `/api/categories`, `/api/transactions` — CRUD;
`GET /api/summary[?on=YYYY-MM-DD]` — остатки кошельков, доходы/расходы за день и месяц, расход по категориям относительно лимита.
Перевод между кошельками: `type=transfer`, `wallet_id` (откуда), `to_wallet_id` (куда).
