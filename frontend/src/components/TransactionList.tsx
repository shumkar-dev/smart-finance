import { api, Category, formatSom, Transaction, Wallet } from "../api";

interface Props {
  transactions: Transaction[]; wallets: Wallet[]; categories: Category[]; onChanged: () => void;
}

export default function TransactionList({ transactions, wallets, categories, onChanged }: Props) {
  const wallet = (id: number | null) => wallets.find((w) => w.id === id)?.name ?? "?";
  const category = (id: number | null) => categories.find((c) => c.id === id)?.name;

  async function remove(id: number) {
    if (!confirm("Удалить операцию?")) return;
    await api.deleteTransaction(id);
    onChanged();
  }

  return (
    <section style={{ borderTop: "1px solid #ddd", marginTop: 16, paddingTop: 8 }}>
      <h2 style={{ fontSize: 16 }}>Последние операции</h2>
      {transactions.length === 0 && <p style={{ color: "#666" }}>Операций пока нет</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {transactions.map((t) => {
          const sign = t.type === "income" ? "+" : t.type === "expense" ? "−" : "⇄";
          const color = t.type === "income" ? "green" : t.type === "expense" ? "crimson" : "#333";
          const title = t.type === "transfer"
            ? `${wallet(t.wallet_id)} → ${wallet(t.to_wallet_id)}`
            : category(t.category_id) ?? "Без категории";
          return (
            <li key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee" }}>
              <div>
                <div>{title}{t.type !== "transfer" && <span style={{ color: "#888" }}> · {wallet(t.wallet_id)}</span>}</div>
                <small style={{ color: "#888" }}>{t.date}{t.comment ? ` · ${t.comment}` : ""}</small>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ color }}>{sign} {formatSom(t.amount)}</strong>{" "}
                <button onClick={() => remove(t.id)} aria-label="Удалить">✕</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
