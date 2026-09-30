// Проверка блокировки: 5 неверных попыток → 429 на 15 минут (даже с верным PIN).
// ВНИМАНИЕ: после запуска локальная база «заперта» на 15 минут. Сбросить: удалить .wrangler и повторить `npm run db:local`.
// Запуск: npm run test:lockout  (на свежей базе при работающем `npm run dev`)
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const PIN = process.env.APP_PIN ?? "123456";
const wrong = PIN === "000000" ? "111111" : "000000";
const login = (pin) =>
  fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });

test("5 неверных попыток → пауза", async () => {
  for (let i = 4; i >= 0; i--) {
    const r = await login(wrong);
    if (i > 0) { assert.equal(r.status, 401); assert.match((await r.json()).detail, new RegExp(`попыток: ${i}`)); }
    else { assert.equal(r.status, 429); assert.match((await r.json()).detail, /15 мин/); }
  }
  const locked = await login(PIN); // верный PIN во время паузы тоже отклоняется
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get("retry-after")) > 800);
  assert.equal(locked.headers.get("set-cookie"), null);
});

test("параллельный перебор не обходит лимит", async () => {
  // пауза уже идёт; сюда попадает пачка параллельных запросов — ни один не должен пройти
  const rs = await Promise.all(Array.from({ length: 20 }, () => login(PIN)));
  assert.ok(rs.every((r) => r.status === 429));
});
