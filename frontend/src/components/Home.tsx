import { Category, Summary, Transaction, Wallet } from "../api";
import { dayLabel, ErrorBox, GearIcon, Money, txTitle } from "./ui";

interface Props {
  summary: Summary | null;
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  error: string | null;
  toast: { text: string; undo: () => void } | null;
  onRetry: () => void;
  onRecord: () => void;
  onSettings: () => void;
}

export default function Home({ summary, transactions, categories, wallets, error, toast, onRetry, onRecord, onSettings }: Props) {
  const recent = transactions.slice(0, 5);
  const today = summary?.today ?? "";

  return (
    <>
      <div className="screen">
        <div className="topbar">
          <h1>Мои деньги</h1>
          <button className="link-btn" onClick={onSettings} style={{ marginRight: -12 }}>
            <GearIcon />Настройки
          </button>
        </div>

        {error && <ErrorBox message={error} onRetry={onRetry} />}

        {summary && (
          <>
            {summary.balances.map((b) => (
              <section className="card" key={b.wallet_id}>
                <div className="label">{b.name}</div>
                <Money tyiyn={b.balance} size={46} className={b.balance < 0 ? "neg" : ""} />
              </section>
            ))}

            <div className="today">
              <span>Сегодня</span>
              <span>
                <b className="pos">+{fmt(summary.day.income)}</b>
                {" "}
                <b className="neg">−{fmt(summary.day.expense)}</b>
                <span style={{ color: "var(--muted)" }}> сом</span>
              </span>
            </div>

            <div className="section-title">Последние записи</div>
            <div className="list">
              {recent.length === 0 && <div className="empty">Пока нет записей.<br />Нажмите «+ Записать».</div>}
              {recent.map((t) => (
                <div className="row" key={t.id}>
                  <div>
                    <div className="name">{txTitle(t, categories, wallets)}</div>
                    <div className="sub">{dayLabel(t.date, today)}</div>
                  </div>
                  <Money
                    tyiyn={t.amount} size={24} bare
                    sign={t.type === "income" ? "+" : t.type === "expense" ? "−" : undefined}
                    className={t.type === "income" ? "pos" : t.type === "expense" ? "neg" : ""}
                  />
                </div>
              ))}
            </div>
          </>
        )}
        {!summary && !error && <p className="hint">Загружаю…</p>}
      </div>

      <div className="cta-bar">
        {toast && (
          <div className="toast" role="status">
            <span>{toast.text}</span>
            <button onClick={toast.undo}>Отменить</button>
          </div>
        )}
        <button className="btn btn-primary" onClick={onRecord}>+ Записать</button>
      </div>
    </>
  );
}

const fmt = (tyiyn: number) => (tyiyn / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
