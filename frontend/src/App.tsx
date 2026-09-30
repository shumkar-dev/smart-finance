import { useCallback, useEffect, useState } from "react";
import { api, Category, Summary, Transaction, Wallet } from "./api";
import Dashboard from "./components/Dashboard";
import TransactionForm from "./components/TransactionForm";
import TransactionList from "./components/TransactionList";

export default function App() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [w, c, s, t] = await Promise.all([api.wallets(), api.categories(), api.summary(), api.transactions()]);
      setWallets(w); setCategories(c); setSummary(s); setTransactions(t);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>Умная заметка</h1>
      {error && <p style={{ color: "crimson" }}>{error} <button onClick={reload}>Повторить</button></p>}
      {summary && <Dashboard summary={summary} />}
      <TransactionForm wallets={wallets} categories={categories} onAdded={reload} />
      <TransactionList transactions={transactions} wallets={wallets} categories={categories} onChanged={reload} />
    </main>
  );
}
