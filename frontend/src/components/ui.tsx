import { ReactNode } from "react";
import { Category, formatNum, Transaction, Wallet } from "../api";

/** Крупная сумма. Размер шрифта подбирается по длине, чтобы влезало на 375px. */
export function Money({ tyiyn, size, sign, className = "", bare = false }: {
  tyiyn: number; size: number; sign?: "+" | "−"; className?: string; bare?: boolean;
}) {
  const text = (sign ?? (tyiyn < 0 ? "−" : "")) + formatNum(tyiyn);
  const fit = text.length > 11 ? 0.6 : text.length > 8 ? 0.78 : 1;
  return (
    <span className={"money " + className} style={{ fontSize: Math.round(size * fit) }}>
      {text}{!bare && <small>сом</small>}
    </span>
  );
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="22" height="22">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

/** Верхняя полоса экрана: кнопка «Назад» со словом и заголовок ниже. */
export function BackBar({ onBack, label = "Назад" }: { onBack: () => void; label?: string }) {
  return (
    <div className="topbar">
      <button className="link-btn" onClick={onBack}><Arrow />{label}</button>
    </div>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="screen">{children}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error" role="alert">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry}>Повторить</button>}
    </div>
  );
}

export const errText = (e: unknown, fallback = "Не получилось. Попробуйте ещё раз.") =>
  e instanceof Error ? e.message : fallback;

/** Подпись операции: категория или «Перевод: A → B». */
export function txTitle(t: Transaction, cats: Category[], wallets: Wallet[]): string {
  const w = (id: number | null) => wallets.find((x) => x.id === id)?.name ?? "?";
  if (t.type === "transfer") return `Перевод: ${w(t.wallet_id)} → ${w(t.to_wallet_id)}`;
  return cats.find((c) => c.id === t.category_id)?.name ?? "Без категории";
}

/** «Сегодня», «Вчера» или «15 сент.». */
export function dayLabel(date: string, today: string): string {
  const d = (s: string) => new Date(s + "T00:00:00");
  const diff = Math.round((d(today).getTime() - d(date).getTime()) / 86_400_000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return d(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
