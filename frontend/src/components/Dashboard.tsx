import { formatSom, Summary } from "../api";

export default function Dashboard({ summary }: { summary: Summary }) {
  return (
    <section>
      <h2 style={{ fontSize: 16 }}>Остатки</h2>
      <div style={{ display: "flex", gap: 12 }}>
        {summary.balances.map((b) => (
          <div key={b.wallet_id} style={{ flex: 1, border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
            <div style={{ color: "#666" }}>{b.name}</div>
            <strong style={{ fontSize: 20 }}>{formatSom(b.balance)}</strong>
          </div>
        ))}
      </div>
      <p>Расходы сегодня: <strong>{formatSom(summary.day.expense)}</strong></p>
    </section>
  );
}
