import { useCallback, useEffect, useRef, useState } from "react";
import { api, AuthError, Category, formatNum, setUnauthorizedHandler, Summary, Transaction, Wallet } from "./api";
import Home from "./components/Home";
import PinScreen from "./components/PinScreen";
import Record from "./components/Record";
import Settings from "./components/Settings";
import { errText } from "./components/ui";

type ScreenName = "home" | "record" | "settings";

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function App() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenName>("home");
  // checking — ещё не знаем, вошли ли; locked — нужен PIN; ok — данные загружены
  const [auth, setAuth] = useState<"checking" | "locked" | "ok">("checking");
  const [toast, setToast] = useState<{ text: string; txId: number } | null>(null);
  const toastTimer = useRef<number>();

  const reload = useCallback(async () => {
    try {
      const [w, c, s, t] = await Promise.all([api.wallets(), api.categories(), api.summary(), api.transactions(20)]);
      setWallets(w); setCategories(c); setSummary(s); setTransactions(t);
      setError(null);
      setAuth("ok");
    } catch (e) {
      if (e instanceof AuthError) return; // экран PIN покажет обработчик 401
      setError(errText(e, "Не удалось загрузить данные. Проверьте интернет."));
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      history.replaceState(null, "");
      setScreen("home");
      setToast(null);
      setAuth("locked");
    });
    reload();
    return () => setUnauthorizedHandler(null);
  }, [reload]);

  async function logout() {
    try { await api.logout(); } catch { /* всё равно показываем экран PIN */ }
    // данные не должны оставаться в памяти после выхода
    setWallets([]); setCategories([]); setSummary(null); setTransactions([]);
    history.replaceState(null, "");
    setScreen("home");
    setAuth("locked");
  }

  // Кнопка «Назад» телефона закрывает экран, а не приложение
  useEffect(() => {
    const onPop = () => setScreen((history.state?.screen as ScreenName) ?? "home");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const open = (s: ScreenName) => { history.pushState({ screen: s }, ""); setScreen(s); };
  const close = () => { if (history.state?.screen) history.back(); else setScreen("home"); };

  const showToast = (text: string, txId: number) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, txId });
    toastTimer.current = window.setTimeout(() => setToast(null), 8000);
  };

  async function undo(txId: number) {
    setToast(null);
    try { await api.deleteTransaction(txId); } catch { /* уже удалено */ }
    reload();
  }

  const today = summary?.today ?? localToday();

  if (auth === "locked") {
    return <PinScreen onSuccess={() => { setAuth("checking"); setError(null); reload(); }} />;
  }
  if (auth === "checking" && !error) {
    return <main className="app"><p className="hint" style={{ textAlign: "center", marginTop: 64 }}>Загружаю…</p></main>;
  }

  return (
    <main className="app">
      {screen === "home" && (
        <Home
          summary={summary} transactions={transactions} categories={categories} wallets={wallets}
          error={error} onRetry={reload} onRecord={() => open("record")} onSettings={() => open("settings")}
          toast={toast && { text: toast.text, undo: () => undo(toast.txId) }}
        />
      )}
      {screen === "record" && (
        <Record
          categories={categories} wallets={wallets} today={today} onClose={close}
          onSaved={(tx, name) => {
            close();
            reload();
            showToast(`Записано: ${name} ${tx.type === "income" ? "+" : "−"}${formatNum(tx.amount)} сом`, tx.id);
          }}
        />
      )}
      {screen === "settings" && (
        <Settings wallets={wallets} categories={categories} summary={summary} today={today} onBack={close} onChanged={reload} onLogout={logout} />
      )}
    </main>
  );
}
