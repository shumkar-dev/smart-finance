# Умная заметка — личный бухгалтер

Учёт личных и бизнес-денег (сом). Всё работает на Cloudflare: сайт и API — один проект **Cloudflare Pages**,
данные — база **Cloudflare D1**. Каждый пуш в GitHub автоматически выкладывается.

Суммы хранятся целыми числами в **тыйынах** (1 сом = 100 тыйынов). Остатки и итоги считаются запросами.

## Что где лежит

| Папка / файл | Что это |
|---|---|
| `frontend/` | сайт (React + Vite, PWA) |
| `functions/api/[[path]].ts`, `server/` | API (`/api/...`), работает как Cloudflare Pages Functions |
| `migrations/0001_schema.sql` | создаёт таблицы |
| `migrations/0002_seed_cleaning.sql` | кошельки «Личное»/«Бизнес» и категории шаблона «Клининг» |

---

## Как запустить: пошагово, без терминала

Нужен аккаунт Cloudflare и этот репозиторий на GitHub.

### Шаг 1. Создать базу D1
1. Зайдите на [dash.cloudflare.com](https://dash.cloudflare.com).
2. В меню слева: **Storage & databases** (или **Workers & Pages**) → **D1 SQL database**.
3. Нажмите **Create database** (Создать базу).
4. Название: `smart-finance` → **Create**.

### Шаг 2. Создать проект Pages из GitHub
1. В меню слева: **Workers & Pages** → **Create application** → вкладка **Pages** → **Connect to Git**.
2. Выберите GitHub-аккаунт и репозиторий `smart-finance` → **Begin setup**.
3. Заполните настройки сборки:
   - **Production branch:** ветка, из которой выкладываете (например `main`)
   - **Framework preset:** `None`
   - **Build command:** `npm run build`
   - **Build output directory:** `frontend/dist`
   - **Root directory:** оставьте пустым
4. Нажмите **Save and Deploy**. Первая сборка пройдёт, но сайт пока покажет ошибку, потому что база ещё не подключена — это нормально.

### Шаг 3. Подключить базу к проекту (binding)
1. Откройте созданный проект: **Workers & Pages** → `smart-finance`.
2. Вкладка **Settings** → раздел **Bindings** (в старом интерфейсе: **Functions** → **D1 database bindings**).
3. **Add** → **D1 database**.
4. **Variable name:** строго `DB` (заглавными буквами).
5. **D1 database:** выберите `smart-finance` → **Save**.
6. Если панель предлагает разное для Production и Preview — добавьте одинаково в оба.

### Шаг 4. Применить миграции (создать таблицы и категории)
1. **Storage & databases** → **D1 SQL database** → откройте `smart-finance` → вкладка **Console**.
2. На GitHub откройте файл `migrations/0001_schema.sql`, нажмите кнопку **Copy raw file** (значок копирования справа над файлом).
3. Вставьте текст в окно Console → **Execute**. Должно появиться сообщение об успехе.
4. Так же выполните `migrations/0002_seed_cleaning.sql`.
   **Выполняйте по одному разу и строго в этом порядке** — повторный запуск выдаст ошибку (это защита от дублей).
5. Проверка: во вкладке **Tables** должны быть `wallets`, `categories`, `transactions`.

### Шаг 5. Перезапустить деплой и получить ссылку
Binding подхватывается только новым деплоем:
1. Проект → вкладка **Deployments** → у последнего деплоя **⋯** → **Retry deployment**.
2. Когда статус станет **Success**, вверху проекта будет ссылка вида `https://smart-finance-xxx.pages.dev` — это и есть ваше приложение.
3. Проверка API: откройте `https://ваша-ссылка/api/wallets` — должен показаться список из двух кошельков.

Дальше просто пушьте в GitHub — Cloudflare сам пересоберёт и выложит. Данные в базе при этом не затрагиваются.

> ⚠️ **Доступ.** В этой версии нет входа по паролю: у кого есть ссылка, тот видит и меняет данные.
> Не публикуйте ссылку. Защиту (например, Cloudflare Access — бесплатно до 50 пользователей:
> **Zero Trust → Access → Applications**) стоит включить до реального использования.

### Если что-то не работает
- **Сайт открывается, но «Ошибка 500» или пусто** — не подключён binding `DB` (шаг 3) или после него не сделан **Retry deployment** (шаг 5).
- **Ошибка `no such table`** — не выполнены миграции (шаг 4).
- **Ошибка сборки** — проверьте Build command и Output directory в **Settings → Builds**.

---

## Для разработчиков (необязательно)

```bash
npm install
npm run build && npm run db:local     # один раз: собрать сайт и создать локальную базу с сидом
npm run dev                           # сайт и API на http://localhost:8788
```

Проверки: `npm run typecheck`; сквозной тест API при запущенном `npm run dev` на свежей базе: `npm test`.
Чтобы сбросить локальную базу, удалите папку `.wrangler` и повторите `npm run db:local`.

## API

`/api/wallets`, `/api/categories`, `/api/transactions` — CRUD;
`GET /api/summary[?on=ГГГГ-ММ-ДД]` — остатки кошельков, доходы/расходы за день и месяц, расход по категориям относительно лимита.
«Сегодня» считается по времени Бишкека (UTC+6).
Перевод между кошельками: `type=transfer`, `wallet_id` (откуда), `to_wallet_id` (куда).
Ошибки приходят в виде `{"detail": "текст"}`.
