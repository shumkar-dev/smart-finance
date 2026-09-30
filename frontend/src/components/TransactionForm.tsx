import { FormEvent, useState } from "react";
import { api, Category, parseSom, TxType, Wallet } from "../api";

const TYPES: { value: TxType; label: string }[] = [
  { value: "expense", label: "Расход" },
  { value: "income", label: "Доход" },
  { value: "transfer", label: "Перевод" },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Props { wallets: Wallet[]; categories: Category[]; onAdded: () => void }

export default function TransactionForm({ wallets, categories, onAdded }: Props) {
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<number | "">("");
  const [toWalletId, setToWalletId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [date, setDate] = useState(today());
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const wid = walletId === "" ? wallets[0]?.id : walletId;
  const cats = categories.filter((c) => c.type === type && c.wallet_id === wid);
  const otherWallets = wallets.filter((w) => w.id !== wid);
  const toId = toWalletId === "" || toWalletId === wid ? otherWallets[0]?.id : toWalletId;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const tyiyn = parseSom(amount);
    if (!tyiyn) return setError("Введите сумму, например 1500 или 1500,50");
    if (wid === undefined) return setError("Нет кошелька");
    if (type === "transfer" && toId === undefined) return setError("Выберите кошелёк назначения");
    setBusy(true);
    try {
      await api.addTransaction({
        type, amount: tyiyn, wallet_id: wid,
        to_wallet_id: type === "transfer" ? toId! : null,
        category_id: type === "transfer" || categoryId === "" ? null : categoryId,
        date, comment: comment.trim() || null, source: "manual",
      });
      setAmount(""); setComment(""); setCategoryId(""); setError(null);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const row = { display: "flex", flexDirection: "column" as const, gap: 4, marginBottom: 8 };

  return (
    <form onSubmit={submit} style={{ borderTop: "1px solid #ddd", marginTop: 16, paddingTop: 8 }}>
      <h2 style={{ fontSize: 16 }}>Новая операция</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {TYPES.map((t) => (
          <label key={t.value}>
            <input type="radio" name="type" checked={type === t.value}
              onChange={() => { setType(t.value); setCategoryId(""); }} /> {t.label}
          </label>
        ))}
      </div>
      <label style={row}>Сумма, сом
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </label>
      <label style={row}>{type === "transfer" ? "Откуда" : "Кошелёк"}
        <select value={wid ?? ""} onChange={(e) => { setWalletId(Number(e.target.value)); setCategoryId(""); }}>
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      {type === "transfer" ? (
        <label style={row}>Куда
          <select value={toId ?? ""} onChange={(e) => setToWalletId(Number(e.target.value))}>
            {otherWallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
      ) : (
        <label style={row}>Категория
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">— без категории —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <label style={row}>Дата
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label style={row}>Комментарий
        <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit" disabled={busy}>Добавить</button>
    </form>
  );
}
