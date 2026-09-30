import { HttpError } from "./http";

type Body = Record<string, unknown>;

const bad = (msg: string) => new HttpError(422, msg);

export function str(body: Body, key: string, max: number, required = true): string | undefined {
  const v = body[key];
  if (v === undefined) {
    if (required) throw bad(`Поле ${key} обязательно`);
    return undefined;
  }
  if (typeof v !== "string" || v.trim().length === 0 || v.length > max) {
    throw bad(`Поле ${key}: непустая строка до ${max} символов`);
  }
  return v.trim();
}

/** Необязательный текст: null/отсутствует → null. */
export function optStr(body: Body, key: string, max: number): string | null {
  const v = body[key];
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > max) throw bad(`Поле ${key}: строка до ${max} символов`);
  return v;
}

export function int(body: Body, key: string, opts: { min?: number; required?: boolean } = {}): number | undefined {
  const v = body[key];
  if (v === undefined) {
    if (opts.required) throw bad(`Поле ${key} обязательно`);
    return undefined;
  }
  if (typeof v !== "number" || !Number.isSafeInteger(v)) throw bad(`Поле ${key} должно быть целым числом (в тыйынах)`);
  if (opts.min !== undefined && v < opts.min) throw bad(`Поле ${key} должно быть не меньше ${opts.min}`);
  return v;
}

/** Целое или null (для необязательных ссылок и лимита). */
export function nullableInt(body: Body, key: string, opts: { min?: number } = {}): number | null | undefined {
  if (body[key] === null) return null;
  return int(body, key, opts);
}

export function oneOf<T extends string>(body: Body, key: string, allowed: readonly T[], fallback?: T): T {
  const v = body[key];
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw bad(`Поле ${key}: одно из ${allowed.join(", ")}`);
  }
  return v as T;
}

export function isoDate(value: unknown, key = "date"): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw bad(`Поле ${key}: дата в формате ГГГГ-ММ-ДД`);
  const d = new Date(value + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw bad(`Поле ${key}: несуществующая дата`);
  return value;
}
