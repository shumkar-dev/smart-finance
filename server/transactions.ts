import { Env, HttpError, json, noContent, readBody } from "./http";
import { int, isoDate, nullableInt, oneOf, optStr } from "./validate";

const TYPES = ["income", "expense", "transfer"] as const;
const SOURCES = ["manual", "text", "voice"] as const;

interface TxInput {
  type: (typeof TYPES)[number];
  amount: number;
  category_id: number | null;
  wallet_id: number;
  to_wallet_id: number | null;
  date: string;
  comment: string | null;
  source: (typeof SOURCES)[number];
}

async function parseAndCheck(env: Env, request: Request): Promise<TxInput> {
  const body = await readBody(request);
  const type = oneOf(body, "type", TYPES);
  const amount = int(body, "amount", { required: true, min: 1 })!;
  const walletId = int(body, "wallet_id", { required: true })!;
  const categoryId = nullableInt(body, "category_id") ?? null;
  const toWalletId = nullableInt(body, "to_wallet_id") ?? null;
  const tx: TxInput = {
    type, amount, wallet_id: walletId, category_id: categoryId, to_wallet_id: toWalletId,
    date: isoDate(body.date), comment: optStr(body, "comment", 500), source: oneOf(body, "source", SOURCES, "manual"),
  };

  if (type === "transfer") {
    if (toWalletId === null) throw new HttpError(422, "Для перевода нужен to_wallet_id");
    if (toWalletId === walletId) throw new HttpError(422, "Кошельки перевода должны различаться");
    if (categoryId !== null) throw new HttpError(422, "У перевода не бывает категории");
  } else if (toWalletId !== null) {
    throw new HttpError(422, "to_wallet_id только для перевода");
  }

  for (const wid of [walletId, toWalletId]) {
    if (wid !== null && !(await env.DB.prepare("SELECT 1 FROM wallets WHERE id = ?").bind(wid).first())) {
      throw new HttpError(422, "Кошелёк не существует");
    }
  }
  if (categoryId !== null) {
    const c = await env.DB.prepare("SELECT type, wallet_id FROM categories WHERE id = ?").bind(categoryId).first();
    if (!c) throw new HttpError(422, "Категория не существует");
    if (c.type !== type) throw new HttpError(422, "Тип категории не совпадает с типом операции");
    if (c.wallet_id !== walletId) throw new HttpError(422, "Категория относится к другому кошельку");
  }
  return tx;
}

async function getTx(env: Env, id: number) {
  const t = await env.DB.prepare("SELECT * FROM transactions WHERE id = ?").bind(id).first();
  if (!t) throw new HttpError(404, "Операция не найдена");
  return t;
}

const COLUMNS = "id, type, amount, category_id, wallet_id, to_wallet_id, date, comment, source";

export const transactions = {
  async list(env: Env, url: URL) {
    const q = url.searchParams;
    const where: string[] = [];
    const args: unknown[] = [];
    if (q.has("wallet_id")) { where.push("(wallet_id = ?1 OR to_wallet_id = ?1)"); args.push(Number(q.get("wallet_id"))); }
    const add = (cond: string, value: unknown) => { args.push(value); where.push(cond.replace("?", `?${args.length}`)); };
    if (q.has("category_id")) add("category_id = ?", Number(q.get("category_id")));
    if (q.has("type")) add("type = ?", q.get("type"));
    if (q.has("date_from")) add("date >= ?", isoDate(q.get("date_from"), "date_from"));
    if (q.has("date_to")) add("date <= ?", isoDate(q.get("date_to"), "date_to"));
    const limit = Math.min(Math.max(Math.trunc(Number(q.get("limit") ?? 50)) || 50, 1), 500);
    const offset = Math.max(Math.trunc(Number(q.get("offset") ?? 0)) || 0, 0);
    const sql = `SELECT ${COLUMNS} FROM transactions` + (where.length ? " WHERE " + where.join(" AND ") : "") +
      ` ORDER BY date DESC, id DESC LIMIT ${limit} OFFSET ${offset}`;
    const { results } = await env.DB.prepare(sql).bind(...args).all();
    return json(results);
  },

  async get(env: Env, id: number) {
    return json(await getTx(env, id));
  },

  async create(env: Env, request: Request) {
    const t = await parseAndCheck(env, request);
    const row = await env.DB.prepare(
      `INSERT INTO transactions (type, amount, category_id, wallet_id, to_wallet_id, date, comment, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`
    ).bind(t.type, t.amount, t.category_id, t.wallet_id, t.to_wallet_id, t.date, t.comment, t.source).first();
    return json(row, 201);
  },

  async replace(env: Env, id: number, request: Request) {
    await getTx(env, id);
    const t = await parseAndCheck(env, request);
    const row = await env.DB.prepare(
      `UPDATE transactions SET type = ?, amount = ?, category_id = ?, wallet_id = ?, to_wallet_id = ?,
       date = ?, comment = ?, source = ? WHERE id = ? RETURNING ${COLUMNS}`
    ).bind(t.type, t.amount, t.category_id, t.wallet_id, t.to_wallet_id, t.date, t.comment, t.source, id).first();
    return json(row);
  },

  async remove(env: Env, id: number) {
    await getTx(env, id);
    await env.DB.prepare("DELETE FROM transactions WHERE id = ?").bind(id).run();
    return noContent();
  },
};
