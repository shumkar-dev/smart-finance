// Сквозной тест. Запускать при работающем `npm run dev` на пустой (только что мигрированной) базе:
//   BASE_URL=http://localhost:8788 npm test
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:8788";
const call = async (method, path, body) => {
  const res = await fetch(BASE + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

test("сквозной сценарий", async () => {
  const wallets = Object.fromEntries((await call("GET", "/wallets")).body.map((w) => [w.name, w.id]));
  assert.deepEqual(Object.keys(wallets).sort(), ["Бизнес", "Личное"]);
  await call("PATCH", `/wallets/${wallets["Бизнес"]}`, { initial_balance: 100000 });

  const cats = (await call("GET", "/categories")).body;
  assert.equal(cats.length, 16);
  const chem = cats.find((c) => c.name === "Химия и средства");
  const office = cats.find((c) => c.name === "Офис");
  assert.equal((await call("PATCH", `/categories/${chem.id}`, { monthly_limit: 200000 })).body.monthly_limit, 200000);

  const tx = (o) => call("POST", "/transactions", { date: "2026-09-15", ...o });
  const B = wallets["Бизнес"], L = wallets["Личное"];
  assert.equal((await tx({ type: "income", amount: 500000, wallet_id: B, category_id: office.id })).status, 201);
  assert.equal((await tx({ type: "expense", amount: 50000, wallet_id: B, category_id: chem.id })).status, 201);
  assert.equal((await tx({ type: "transfer", amount: 100000, wallet_id: B, to_wallet_id: L })).status, 201);

  // отклоняется
  assert.equal((await tx({ type: "expense", amount: 100, wallet_id: L, category_id: chem.id })).status, 422); // чужой кошелёк
  assert.equal((await tx({ type: "income", amount: 100, wallet_id: B, category_id: chem.id })).status, 422); // не тот тип
  assert.equal((await tx({ type: "expense", amount: 0, wallet_id: L })).status, 422);
  assert.equal((await tx({ type: "expense", amount: -5, wallet_id: L })).status, 422);
  assert.equal((await tx({ type: "expense", amount: 1.5, wallet_id: L })).status, 422);
  assert.equal((await tx({ type: "transfer", amount: 1, wallet_id: L, to_wallet_id: L })).status, 422);
  assert.equal((await tx({ type: "expense", amount: 1, wallet_id: 999 })).status, 422);
  assert.equal((await tx({ type: "expense", amount: 1, wallet_id: L, date: "2026-02-31" })).status, 422);

  const s = (await call("GET", "/summary?on=2026-09-15")).body;
  const bal = Object.fromEntries(s.balances.map((b) => [b.name, b.balance]));
  assert.deepEqual(bal, { Бизнес: 100000 + 500000 - 50000 - 100000, Личное: 100000 });
  assert.deepEqual(s.day, { income: 500000, expense: 50000 });
  assert.deepEqual(s.month, { income: 500000, expense: 50000 });
  const u = s.categories.find((c) => c.category_id === chem.id);
  assert.equal(u.spent, 50000);
  assert.equal(u.percent, 25);
  assert.equal((await call("GET", "/summary?on=2026-10-01")).body.month.expense, 0);
  assert.equal((await call("GET", "/summary?on=2026-12-31")).body.month.expense, 0);

  // список, удаление, конфликты
  const list = (await call("GET", "/transactions?limit=10")).body;
  assert.equal(list.length, 3);
  assert.equal((await call("DELETE", `/categories/${chem.id}`)).status, 409);
  assert.equal((await call("DELETE", `/wallets/${B}`)).status, 409);
  assert.equal((await call("DELETE", `/transactions/${list[0].id}`)).status, 204);
  assert.equal((await call("GET", `/transactions/${list[0].id}`)).status, 404);
  assert.equal((await call("GET", "/nope")).status, 404);
  assert.equal((await call("POST", "/wallets", { name: "Личное" })).status, 409);
});
