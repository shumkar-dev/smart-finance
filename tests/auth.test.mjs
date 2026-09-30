// Проверки защиты. Запускать при работающем `npm run dev` (APP_PIN в .dev.vars, по умолчанию 123456).
// Не доводит до блокировки — для неё есть tests/lockout.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const PIN = process.env.APP_PIN ?? "123456";
const api = (path, { method = "GET", cookie, body } = {}) =>
  fetch(BASE + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const login = (pin) => api("/auth/login", { method: "POST", body: { pin } });

test("без cookie все /api/* отвечают 401", async () => {
  for (const [m, p] of [["GET", "/wallets"], ["GET", "/categories"], ["GET", "/transactions"], ["GET", "/summary"],
    ["POST", "/transactions"], ["DELETE", "/transactions/1"], ["PATCH", "/wallets/1"], ["GET", "/nope"]]) {
    const r = await api(p, { method: m, body: m === "POST" ? {} : undefined });
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.match(r.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("cookie: httpOnly, SameSite=Strict, 1 год; доступ работает", async () => {
  const r = await login(PIN);
  assert.equal(r.status, 200);
  const sc = r.headers.get("set-cookie");
  assert.match(sc, /HttpOnly/i);
  assert.match(sc, /SameSite=Strict/i);
  assert.match(sc, /Max-Age=31536000/);
  assert.match(sc, /Path=\//);
  assert.ok(!sc.includes(PIN), "PIN не должен попадать в cookie");
  const cookie = sc.split(";")[0];
  assert.equal((await api("/wallets", { cookie })).status, 200);
  // выход очищает cookie на устройстве
  const out = await api("/auth/logout", { method: "POST", cookie });
  assert.equal(out.status, 200);
  assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
});

test("поддельные и испорченные cookie не проходят", async () => {
  const good = (await login(PIN)).headers.get("set-cookie").split(";")[0];
  const [name, value] = [good.slice(0, good.indexOf("=")), good.slice(good.indexOf("=") + 1)];
  const [exp, tag, sig] = value.split(".");
  const forged = [
    `${name}=`, `${name}=abc`, `${name}=${exp}.${tag}`, `${name}=${exp}.${tag}.${"0".repeat(sig.length)}`,
    `${name}=${Number(exp) + 1000}.${tag}.${sig}`, // продлили срок — подпись не сходится
    `${name}=${exp}.${"0".repeat(16)}.${sig}`, `${name}=1.${tag}.${sig}`, // чужой тег / истёкший срок
    `${name}=${exp}.${tag}.zz`,
  ];
  for (const c of forged) assert.equal((await api("/wallets", { cookie: c })).status, 401, c);
});

test("неверный PIN: 401 с числом оставшихся попыток; формат проверяется без расхода попыток", async () => {
  assert.equal((await login("12")).status, 422);
  assert.equal((await login("abcdef")).status, 422);
  assert.equal((await api("/auth/login", { method: "POST", body: {} })).status, 422);
  const wrong = PIN === "000000" ? "111111" : "000000";
  const r = await login(wrong);
  assert.equal(r.status, 401);
  assert.match((await r.json()).detail, /Неверный код. Осталось попыток: \d/);
  // верный код сбрасывает счётчик
  assert.equal((await login(PIN)).status, 200);
});

test("/api/auth/*: методы и пути", async () => {
  assert.equal((await api("/auth/login")).status, 405);
  assert.equal((await api("/auth/whatever", { method: "POST" })).status, 404);
});
