-- Шаблон «Клининг». Выполнять один раз, после 0001_schema.sql.

INSERT INTO wallets (id, name, initial_balance) VALUES (1, 'Личное', 0), (2, 'Бизнес', 0);

-- Доходы (кошелёк «Бизнес»)
INSERT INTO categories (name, type, wallet_id) VALUES
  ('Уборка квартиры', 'income', 2),
  ('Генеральная уборка', 'income', 2),
  ('Уборка после ремонта', 'income', 2),
  ('Офис', 'income', 2),
  ('Химчистка мебели', 'income', 2);

-- Бизнес-расходы
INSERT INTO categories (name, type, wallet_id) VALUES
  ('Химия и средства', 'expense', 2),
  ('Инвентарь', 'expense', 2),
  ('Оплата клинерам', 'expense', 2),
  ('Транспорт/бензин', 'expense', 2),
  ('Реклама', 'expense', 2),
  ('Связь', 'expense', 2);

-- Личные расходы
INSERT INTO categories (name, type, wallet_id) VALUES
  ('Еда', 'expense', 1),
  ('Жильё', 'expense', 1),
  ('Транспорт', 'expense', 1),
  ('Развлечения', 'expense', 1),
  ('Прочее', 'expense', 1);
