import { useCallback, useEffect, useState } from "react";
import { api, Category, Transaction, Wallet } from "../api";
import { BackBar, ErrorBox, errText, Money, Screen } from "./ui";

type Kind = "expense" | "income";
type Step = "kind" | "amount" | "category";

interface Props {
  categories: Category[];
  wallets: Wallet[];
  today: string;
  onClose: () => void;
  onSaved: (tx: Transaction, categoryName: string) => void;
}

const MAX_DIGITS = 9;

export default function Record({ categories, wallets, today, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>("kind");
  const [kind, setKind] = useState<Kind>("expense");
  const [digits, setDigits] = useState(""); // сумма в сомах, целые
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(digits || "0") * 100; // тыйыны
  const press = useCallback((k: string) => {
    setDigits((d) => {
      if (k === "del") return d.slice(0, -1);
      const next = (d + k).replace(/^0+/, "");
      return next.length > MAX_DIGITS ? d : next;
    });
  }, []);

  // клавиатура компьютера: цифры, Backspace, Enter
  useEffect(() => {
    if (step !== "amount") return;
    const on = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter" && Number(digits) > 0) setStep("category");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [step, digits, press]);

  function back() {
    setError(null);
    if (step === "kind") onClose();
    else setStep(step === "category" ? "amount" : "kind");
  }

  async function save(c: Category) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await api.addTransaction({
        type: kind, amount, wallet_id: c.wallet_id, category_id: c.id, to_wallet_id: null,
        date: today, comment: null, source: "manual",
      });
      onSaved(tx, c.name);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  const kindLabel = kind === "expense" ? "Расход" : "Доход";
  const kindColor = kind === "expense" ? "var(--expense)" : "var(--income)";

  return (
    <Screen>
      <BackBar onBack={back} label={step === "kind" ? "Отмена" : "Назад"} />

      {step === "kind" && (
        <>
          <h2 className="title">Что записать?</h2>
          <div className="big-choices">
            <button className="choice expense" onClick={() => { setKind("expense"); setStep("amount"); }}>
              Расход<small>Потратил деньги</small>
            </button>
            <button className="choice income" onClick={() => { setKind("income"); setStep("amount"); }}>
              Доход<small>Получил деньги</small>
            </button>
          </div>
        </>
      )}

      {step === "amount" && (
        <>
          <div className="amount-view">
            <div className="kind" style={{ color: kindColor }}>{kindLabel} — сколько?</div>
            <Money tyiyn={amount} size={72} />
          </div>
          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
              <button key={k} className="key" onClick={() => press(k)}>{k}</button>
            ))}
            <button className="key aux" onClick={() => press("000")} aria-label="Добавить три нуля">000</button>
            <button className="key" onClick={() => press("0")}>0</button>
            <button className="key aux" onClick={() => press("del")} aria-label="Стереть цифру">Стереть</button>
          </div>
          <button className="btn btn-primary" disabled={amount <= 0} onClick={() => setStep("category")}>Дальше</button>
        </>
      )}

      {step === "category" && <CategoryStep
        kind={kind} kindLabel={kindLabel} kindColor={kindColor} amount={amount}
        categories={categories} wallets={wallets} busy={busy} error={error} onPick={save}
      />}
    </Screen>
  );
}

function CategoryStep({ kind, kindLabel, kindColor, amount, categories, wallets, busy, error, onPick }: {
  kind: Kind; kindLabel: string; kindColor: string; amount: number;
  categories: Category[]; wallets: Wallet[]; busy: boolean; error: string | null; onPick: (c: Category) => void;
}) {
  const cats = categories.filter((c) => c.type === kind);
  // «Бизнес» (создаётся последним) показываем первым — туда записывают чаще
  const groups = [...wallets].reverse()
    .map((w) => ({ wallet: w, items: cats.filter((c) => c.wallet_id === w.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <div className="amount-view small">
        <div className="kind" style={{ color: kindColor }}>{kindLabel}</div>
        <Money tyiyn={amount} size={52} />
      </div>
      <h2 className="title" style={{ margin: 0 }}>Выберите категорию</h2>
      {error && <ErrorBox message={error} />}
      {groups.length === 0 && <p className="hint">Нет категорий. Добавьте их в «Настройках».</p>}
      {groups.map((g) => (
        <section key={g.wallet.id} aria-label={g.wallet.name}>
          {groups.length > 1 && <div className="group-title" style={{ marginBottom: 8 }}>{g.wallet.name}</div>}
          <div className="tiles">
            {g.items.map((c) => (
              <button key={c.id} className="tile" disabled={busy} onClick={() => onPick(c)}>{c.name}</button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
