/**
 * Вход по PIN-коду.
 *
 * - PIN лежит только в секрете Cloudflare APP_PIN.
 * - После верного PIN выдаётся cookie (httpOnly, Secure, SameSite=Strict) на 1 год.
 *   Cookie подписана случайным ключом из D1 (не выводится из PIN — иначе PIN можно было бы
 *   подбирать подделкой cookie в обход лимита попыток) и привязана к текущему APP_PIN:
 *   смена APP_PIN разлогинивает все устройства.
 * - 5 неверных попыток подряд → пауза 15 минут. Счётчик общий и атомарный (в D1): попытка
 *   «резервируется» до проверки PIN, поэтому параллельные запросы лимит не обходят.
 * - Если APP_PIN не задан или задан неверно, приложение закрыто (не открыто).
 */
import { Env, HttpError, json, readBody } from "./http";

const COOKIE = "sf_session";
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_SECONDS = 365 * 24 * 60 * 60;
const PIN_RE = /^\d{4,6}$/;
const enc = new TextEncoder();

// ---------- служебные таблицы (создаются сами, отдельной миграции не нужно) ----------

let tablesReady: Promise<unknown> | null = null;
function ensureTables(env: Env): Promise<unknown> {
  tablesReady ??= env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS auth_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS auth_attempts (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         fails INTEGER NOT NULL DEFAULT 0,
         locked_until INTEGER NOT NULL DEFAULT 0)`
    ),
    env.DB.prepare("INSERT OR IGNORE INTO auth_attempts (id, fails, locked_until) VALUES (1, 0, 0)"),
  ]).catch((e) => { tablesReady = null; throw e; });
  return tablesReady;
}

// ---------- криптография ----------

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
}

let keyCache: CryptoKey | null = null;
async function sessionKey(env: Env): Promise<CryptoKey> {
  if (keyCache) return keyCache;
  await ensureTables(env);
  const candidate = toHex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare("INSERT OR IGNORE INTO auth_state (key, value) VALUES ('session_key', ?)").bind(candidate).run();
  const row = await env.DB.prepare("SELECT value FROM auth_state WHERE key = 'session_key'").first<{ value: string }>();
  keyCache = await crypto.subtle.importKey(
    "raw", fromHex(row!.value)!, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
  return keyCache;
}

async function pinTag(key: CryptoKey, pin: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode("pin:" + pin))).slice(0, 16);
}

async function makeToken(env: Env, pin: string): Promise<string> {
  const key = await sessionKey(env);
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_SECONDS}.${await pinTag(key, pin)}`;
  return `${payload}.${toHex(await crypto.subtle.sign("HMAC", key, enc.encode(payload)))}`;
}

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", enc.encode(text));
}

/** Сравнение без утечки по времени: сравниваются хэши одинаковой длины. */
async function pinEquals(input: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(input), sha256(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// ---------- настройка и проверка cookie ----------

function configuredPin(env: Env): string | null {
  const pin = typeof env.APP_PIN === "string" ? env.APP_PIN.trim() : "";
  return PIN_RE.test(pin) ? pin : null;
}

function readCookie(request: Request): string | null {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return null;
}

export async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  const token = readCookie(request);
  if (!token) return false; // быстрый отказ без обращения к базе
  const pin = configuredPin(env);
  if (!pin) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d{1,12}$/.test(parts[0])) return false;
  if (Number(parts[0]) <= Date.now() / 1000) return false; // срок истёк
  const sig = fromHex(parts[2]);
  if (!sig) return false;
  const key = await sessionKey(env);
  if (parts[1] !== (await pinTag(key, pin))) return false; // PIN сменили — cookie недействительна
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(`${parts[0]}.${parts[1]}`));
}

function cookieHeader(value: string, maxAge: number, request: Request): string {
  const secure = new URL(request.url).protocol === "https:"; // на http://localhost Secure не нужен
  return `${COOKIE}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

// ---------- маршруты /api/auth/* ----------

const tooMany = (ms: number) =>
  new HttpError(
    429,
    `Слишком много неверных попыток. Попробуйте через ${Math.max(1, Math.ceil(ms / 60000))} мин.`,
    { "Retry-After": String(Math.max(1, Math.ceil(ms / 1000))) }
  );

async function login(request: Request, env: Env): Promise<Response> {
  const pin = configuredPin(env);
  if (!pin) {
    throw new HttpError(503, "Вход не настроен: нужно задать секрет APP_PIN (4–6 цифр) в панели Cloudflare");
  }
  const body = await readBody(request);
  const input = typeof body.pin === "string" ? body.pin : "";
  if (!PIN_RE.test(input)) throw new HttpError(422, "Введите код из 4–6 цифр");

  await ensureTables(env);
  const now = Date.now();
  // пауза закончилась — начинаем заново
  await env.DB.prepare("UPDATE auth_attempts SET fails = 0, locked_until = 0 WHERE id = 1 AND locked_until > 0 AND locked_until <= ?")
    .bind(now).run();
  // резервируем попытку ДО проверки PIN (атомарно)
  const slot = await env.DB.prepare(
    `UPDATE auth_attempts
       SET fails = fails + 1, locked_until = CASE WHEN fails + 1 >= ?1 THEN ?2 ELSE 0 END
     WHERE id = 1 AND fails < ?1 AND locked_until <= ?3
     RETURNING fails`
  ).bind(MAX_FAILS, now + LOCK_MS, now).first<{ fails: number }>();
  if (!slot) {
    const row = await env.DB.prepare("SELECT locked_until FROM auth_attempts WHERE id = 1").first<{ locked_until: number }>();
    throw tooMany((row?.locked_until ?? now) - now);
  }

  if (!(await pinEquals(input, pin))) {
    const left = MAX_FAILS - slot.fails;
    if (left <= 0) throw tooMany(LOCK_MS);
    throw new HttpError(401, `Неверный код. Осталось попыток: ${left}`);
  }

  await env.DB.prepare("UPDATE auth_attempts SET fails = 0, locked_until = 0 WHERE id = 1").run();
  const token = await makeToken(env, pin);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(token, SESSION_SECONDS, request) });
}

export async function authRoute(request: Request, env: Env, action: string | undefined, rest: string[]): Promise<Response> {
  if (rest.length || (action !== "login" && action !== "logout")) throw new HttpError(404, "Не найдено");
  if (request.method !== "POST") throw new HttpError(405, "Метод не поддерживается");
  if (action === "login") return login(request, env);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0, request) });
}
