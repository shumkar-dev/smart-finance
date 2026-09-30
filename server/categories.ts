import { Env, HttpError, json, noContent, readBody } from "./http";
import { int, nullableInt, oneOf, str } from "./validate";

const TYPES = ["income", "expense"] as const;

async function getCategory(env: Env, id: number) {
  const c = await env.DB.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first();
  if (!c) throw new HttpError(404, "Категория не найдена");
  return c;
}

async function ensureWallet(env: Env, walletId: number) {
  if (!(await env.DB.prepare("SELECT 1 FROM wallets WHERE id = ?").bind(walletId).first())) {
    throw new HttpError(422, "Кошелёк не существует");
  }
}

export const categories = {
  async list(env: Env, url: URL) {
    const where: string[] = [];
    const args: unknown[] = [];
    const walletId = url.searchParams.get("wallet_id");
    const type = url.searchParams.get("type");
    if (walletId !== null) { where.push("wallet_id = ?"); args.push(Number(walletId)); }
    if (type !== null) { where.push("type = ?"); args.push(type); }
    const sql = "SELECT * FROM categories" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY id";
    const { results } = await env.DB.prepare(sql).bind(...args).all();
    return json(results);
  },

  async get(env: Env, id: number) {
    return json(await getCategory(env, id));
  },

  async create(env: Env, request: Request) {
    const body = await readBody(request);
    const name = str(body, "name", 100)!;
    const type = oneOf(body, "type", TYPES);
    const walletId = int(body, "wallet_id", { required: true })!;
    const limit = nullableInt(body, "monthly_limit", { min: 0 }) ?? null;
    await ensureWallet(env, walletId);
    const c = await env.DB.prepare(
      "INSERT INTO categories (name, type, wallet_id, monthly_limit) VALUES (?, ?, ?, ?) RETURNING *"
    ).bind(name, type, walletId, limit).first();
    return json(c, 201);
  },

  async update(env: Env, id: number, request: Request) {
    const cur = await getCategory(env, id);
    const body = await readBody(request);
    const name = str(body, "name", 100, false) ?? (cur.name as string);
    const type = body.type === undefined ? (cur.type as "income" | "expense") : oneOf(body, "type", TYPES);
    const walletId = int(body, "wallet_id") ?? (cur.wallet_id as number);
    // monthly_limit: null снимает лимит, отсутствие поля — оставляет как есть
    const limit = body.monthly_limit === undefined ? (cur.monthly_limit as number | null) : nullableInt(body, "monthly_limit", { min: 0 })!;

    if (walletId !== cur.wallet_id) await ensureWallet(env, walletId);
    if (type !== cur.type || walletId !== cur.wallet_id) {
      const used = await env.DB.prepare("SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1").bind(id).first();
      if (used) throw new HttpError(409, "Нельзя менять тип или кошелёк категории, у которой есть операции");
    }
    const c = await env.DB.prepare(
      "UPDATE categories SET name = ?, type = ?, wallet_id = ?, monthly_limit = ? WHERE id = ? RETURNING *"
    ).bind(name, type, walletId, limit, id).first();
    return json(c);
  },

  async remove(env: Env, id: number) {
    await getCategory(env, id);
    if (await env.DB.prepare("SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1").bind(id).first()) {
      throw new HttpError(409, "У категории есть операции");
    }
    await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
    return noContent();
  },
};
