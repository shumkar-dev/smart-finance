// Базовый адрес API. В dev работает прокси Vite; для Capacitor/прод задать VITE_API_URL.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export type TxType = "income" | "expense" | "transfer";

export interface Wallet { id: number; name: string; initial_balance: number }
export interface Category { id: number; name: string; type: "income" | "expense"; wallet_id: number; monthly_limit: number | null }
export interface Transaction {
  id: number; type: TxType; amount: number; category_id: number | null;
  wallet_id: number; to_wallet_id: number | null; date: string; comment: string | null;
  source: "manual" | "text" | "voice";
}
export type NewTransaction = Omit<Transaction, "id">;
export interface Summary {
  today: string;
  balances: { wallet_id: number; name: string; balance: number }[];
  day: { income: number; expense: number };
  month: { income: number; expense: number };
  categories: { category_id: number; name: string; wallet_id: number; spent: number; monthly_limit: number | null; percent: number | null }[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch { /* пустое тело */ }
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  wallets: () => req<Wallet[]>("/wallets"),
  categories: () => req<Category[]>("/categories"),
  transactions: (limit = 20) => req<Transaction[]>(`/transactions?limit=${limit}`),
  summary: () => req<Summary>("/summary"),
  addTransaction: (t: NewTransaction) => req<Transaction>("/transactions", { method: "POST", body: JSON.stringify(t) }),
  deleteTransaction: (id: number) => req<void>(`/transactions/${id}`, { method: "DELETE" }),
};

// Деньги: в API — тыйыны (целые), в интерфейсе — сомы.
export function formatSom(tyiyn: number): string {
  const som = tyiyn / 100;
  return som.toLocaleString("ru-RU", { minimumFractionDigits: tyiyn % 100 ? 2 : 0, maximumFractionDigits: 2 }) + " сом";
}

/** "1 250,50" -> 125050; null, если не число. Без float-арифметики над деньгами. */
export function parseSom(text: string): number | null {
  const m = text.trim().replace(/\s/g, "").replace(",", ".").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
}
