import { Env, json } from "./http";
import { isoDate } from "./validate";

/** Сегодняшняя дата в Кыргызстане (UTC+6), а не по UTC сервера. */
function todayBishkek(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bishkek" }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextMonthStart(date: string): string {
  const d = new Date(date.slice(0, 7) + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

const TOTALS_SQL = `
  SELECT COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
  FROM transactions WHERE date >= ? AND date < ?`;

export async function summary(env: Env, url: URL) {
  const on = url.searchParams.has("on") ? isoDate(url.searchParams.get("on"), "on") : todayBishkek();
  const monthStart = on.slice(0, 7) + "-01";
  const monthEnd = nextMonthStart(on);
  const dayEnd = addDays(on, 1);

  const [balances, day, month, categories] = await env.DB.batch([
    // Остаток = стартовый + доходы − расходы − исходящие переводы + входящие переводы
    env.DB.prepare(`
      SELECT w.id AS wallet_id, w.name,
        w.initial_balance
        + COALESCE((SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
                    FROM transactions t WHERE t.wallet_id = w.id), 0)
        + COALESCE((SELECT SUM(t.amount) FROM transactions t
                    WHERE t.type = 'transfer' AND t.to_wallet_id = w.id), 0) AS balance
      FROM wallets w ORDER BY w.id`),
    env.DB.prepare(TOTALS_SQL).bind(on, dayEnd),
    env.DB.prepare(TOTALS_SQL).bind(monthStart, monthEnd),
    env.DB.prepare(`
      SELECT c.id AS category_id, c.name, c.wallet_id, c.monthly_limit,
             COALESCE(SUM(t.amount), 0) AS spent
      FROM categories c
      LEFT JOIN transactions t ON t.category_id = c.id AND t.type = 'expense'
                               AND t.date >= ? AND t.date < ?
      WHERE c.type = 'expense'
      GROUP BY c.id ORDER BY c.id`).bind(monthStart, monthEnd),
  ]);

  return json({
    today: on,
    balances: balances.results,
    day: day.results[0],
    month: month.results[0],
    categories: (categories.results as { spent: number; monthly_limit: number | null }[]).map((c) => ({
      ...c,
      percent: c.monthly_limit ? Math.round((c.spent * 1000) / c.monthly_limit) / 10 : null,
    })),
  });
}
