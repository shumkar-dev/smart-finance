-- Схема Smart Finance для Cloudflare D1.
-- Все суммы — целые числа в тыйынах (1 сом = 100 тыйынов). Остатки в базе не хранятся.

CREATE TABLE wallets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL UNIQUE,
  initial_balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  wallet_id     INTEGER NOT NULL REFERENCES wallets(id),
  monthly_limit INTEGER CHECK (monthly_limit IS NULL OR monthly_limit >= 0)
);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT    NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  category_id  INTEGER REFERENCES categories(id),
  wallet_id    INTEGER NOT NULL REFERENCES wallets(id),
  to_wallet_id INTEGER REFERENCES wallets(id),
  date         TEXT    NOT NULL,  -- YYYY-MM-DD
  comment      TEXT,
  source       TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'text', 'voice')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (type = 'transfer' AND to_wallet_id IS NOT NULL AND to_wallet_id <> wallet_id AND category_id IS NULL)
    OR (type <> 'transfer' AND to_wallet_id IS NULL)
  )
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_categories_wallet ON categories(wallet_id);
