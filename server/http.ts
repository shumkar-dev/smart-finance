export interface Env {
  DB: D1Database;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const noContent = () => new Response(null, { status: 204 });

/** Тело ответа об ошибке: {detail: "..."} — формат, который ждёт фронтенд. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ detail: e.message }, e.status);
  console.error(e);
  return json({ detail: "Внутренняя ошибка сервера" }, 500);
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(422, "Тело запроса должно быть JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(422, "Тело запроса должно быть JSON-объектом");
  }
  return body as Record<string, unknown>;
}

export function parseId(value: string): number {
  if (!/^\d+$/.test(value)) throw new HttpError(404, "Не найдено");
  return Number(value);
}
