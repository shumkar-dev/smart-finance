import { Env, HttpError, json, noContent, readBody } from "./http";
import { int, str } from "./validate";

async function getWallet(env: Env, id: number) {
  const w = await env.DB.prepare("SELECT * FROM wallets WHERE id = ?").bind(id).first();
  if (!w) throw new HttpError(404, "Кошелёк не найден");
  return w;
}

async function ensureNameFree(env: Env, name: string, exceptId?: number) {
  const dup = await env.DB.prepare("SELECT id FROM wallets WHERE name = ? AND id <> ?").bind(name, exceptId ?? 0).first();
  if (dup) throw new HttpError(409, "Кошелёк с таким названием уже есть");
}

export const wallets = {
  async list(env: Env) {
    const { results } = await env.DB.prepare("SELECT * FROM wallets ORDER BY id").all();
    return json(results);
  },

  async get(env: Env, id: number) {
    return json(await getWallet(env, id));
  },

  async create(env: Env, request: Request) {
    const body = await readBody(request);
    const name = str(body, "name", 100)!;
    const initial = int(body, "initial_balance") ?? 0;
    await ensureNameFree(env, name);
    const w = await env.DB.prepare("INSERT INTO wallets (name, initial_balance) VALUES (?, ?) RETURNING *")
      .bind(name, initial).first();
    return json(w, 201);
  },

  async update(env: Env, id: number, request: Request) {
    const current = await getWallet(env, id);
    const body = await readBody(request);
    const name = str(body, "name", 100, false) ?? (current.name as string);
    const initial = int(body, "initial_balance") ?? (current.initial_balance as number);
    await ensureNameFree(env, name, id);
    const w = await env.DB.prepare("UPDATE wallets SET name = ?, initial_balance = ? WHERE id = ? RETURNING *")
      .bind(name, initial, id).first();
    return json(w);
  },

  async remove(env: Env, id: number) {
    await getWallet(env, id);
    const used = await env.DB.prepare(
      `SELECT 1 FROM transactions WHERE wallet_id = ?1 OR to_wallet_id = ?1
       UNION ALL SELECT 1 FROM categories WHERE wallet_id = ?1 LIMIT 1`
    ).bind(id).first();
    if (used) throw new HttpError(409, "У кошелька есть категории или операции");
    await env.DB.prepare("DELETE FROM wallets WHERE id = ?").bind(id).run();
    return noContent();
  },
};
