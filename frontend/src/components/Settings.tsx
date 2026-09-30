import { FormEvent, ReactNode, useEffect, useState } from "react";
import { api, Category, formatNum, parseSom, Summary, toInputSom, Transaction, Wallet } from "../api";
import { BackBar, dayLabel, ErrorBox, errText, Money, Screen, txTitle } from "./ui";

type Section = null | "transfer" | "categories" | "opening" | "history";

interface Props {
  wallets: Wallet[];
  categories: Category[];
  summary: Summary | null;
  today: string;
  onBack: () => void;
  onChanged: () => Promise<void> | void;
  onLogout: () => void;
}

export default function Settings(props: Props) {
  const [section, setSection] = useState<Section>(null);
  const back = () => (section ? setSection(null) : props.onBack());

  const items: { key: Exclude<Section, null>; title: string; text: string }[] = [
    { key: "transfer", title: "Перевод между кошельками", text: "Например, из «Бизнес» в «Личное»" },
    { key: "categories", title: "Категории и лимиты", text: "Добавить, удалить, задать лимит на месяц" },
    { key: "opening", title: "Стартовые остатки", text: "С какой суммы вы начинаете учёт" },
    { key: "history", title: "Удалить запись", text: "Если записали по ошибке" },
  ];

  return (
    <Screen>
      <BackBar onBack={back} label={section ? "К настройкам" : "На главный экран"} />
      {section === null && (
        <>
          <h2 className="title">Настройки</h2>
          <div className="menu">
            {items.map((i) => (
              <button key={i.key} className="menu-item" onClick={() => setSection(i.key)}>
                <b>{i.title}</b><span>{i.text}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => {
            if (confirm("Выйти на этом устройстве? Чтобы войти снова, понадобится PIN-код.")) props.onLogout();
          }}>Выйти на этом устройстве</button>
        </>
      )}
      {section === "transfer" && <Transfer {...props} />}
      {section === "categories" && <Categories {...props} />}
      {section === "opening" && <Opening {...props} />}
      {section === "history" && <History {...props} />}
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Transfer({ wallets, today, onChanged }: Props) {
  const pairs = wallets.flatMap((a) => wallets.filter((b) => b.id !== a.id).map((b) => ({ from: a, to: b })));
  const [pair, setPair] = useState(0);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const tyiyn = parseSom(amount);
    const p = pairs[pair];
    if (!tyiyn || !p) return setError("Введите сумму, например 5000");
    setBusy(true); setError(null); setMsg(null);
    try {
      await api.addTransaction({
        type: "transfer", amount: tyiyn, wallet_id: p.from.id, to_wallet_id: p.to.id,
        category_id: null, date: today, comment: null, source: "manual",
      });
      await onChanged();
      setMsg(`Переведено ${formatNum(tyiyn)} сом: ${p.from.name} → ${p.to.name}`);
      setAmount("");
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h2 className="title">Перевод между кошельками</h2>
      <div className="field"><span>Откуда и куда</span>
        <div className="seg">
          {pairs.map((p, i) => (
            <button type="button" key={i} aria-pressed={i === pair} onClick={() => setPair(i)}>
              {p.from.name} → {p.to.name}
            </button>
          ))}
        </div>
      </div>
      <Field label="Сумма, сом">
        <input className="input" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {error && <ErrorBox message={error} />}
      {msg && <div className="notice">{msg}</div>}
      <button className="btn btn-primary" disabled={busy || pairs.length === 0}>Перевести</button>
    </form>
  );
}

function Categories({ wallets, categories, summary, onChanged }: Props) {
  const [openId, setOpenId] = useState<number | "new" | null>(null);
  const groups = [...wallets].reverse().map((w) => ({ w, items: categories.filter((c) => c.wallet_id === w.id) }));
  const spent = (id: number) => summary?.categories.find((c) => c.category_id === id)?.spent ?? 0;

  return (
    <div className="stack">
      <h2 className="title">Категории и лимиты</h2>
      <p className="hint">Нажмите на категорию, чтобы задать лимит расходов на месяц или удалить её.</p>
      {groups.map(({ w, items }) => (
        <section key={w.id}>
          <div className="group-title" style={{ marginBottom: 8 }}>{w.name}</div>
          <div className="list">
            {items.map((c) => (
              <div key={c.id}>
                <button className="cat-row" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                  <div className="name"><span>{c.name}</span><span className="sub">{c.type === "income" ? "доход" : "расход"}</span></div>
                  {c.type === "expense" && (
                    <div className="sub">
                      {c.monthly_limit
                        ? `За месяц: ${formatNum(spent(c.id))} из ${formatNum(c.monthly_limit)} сом`
                        : "Лимит не задан"}
                    </div>
                  )}
                  {c.type === "expense" && c.monthly_limit ? (
                    <div className="bar"><i className={spent(c.id) > c.monthly_limit ? "over" : ""}
                      style={{ width: Math.min(100, (spent(c.id) * 100) / c.monthly_limit) + "%" }} /></div>
                  ) : null}
                </button>
                {openId === c.id && <CategoryEdit c={c} onDone={async () => { setOpenId(null); await onChanged(); }} />}
              </div>
            ))}
            {items.length === 0 && <div className="empty">Категорий нет</div>}
          </div>
        </section>
      ))}
      {openId === "new"
        ? <NewCategory wallets={wallets} onDone={async () => { setOpenId(null); await onChanged(); }} />
        : <button className="btn btn-secondary" onClick={() => setOpenId("new")}>+ Добавить категорию</button>}
    </div>
  );
}

function CategoryEdit({ c, onDone }: { c: Category; onDone: () => void }) {
  const [limit, setLimit] = useState(c.monthly_limit ? toInputSom(c.monthly_limit) : "");
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); onDone(); } catch (e) { setError(errText(e)); }
  }
  function saveLimit() {
    const v = limit.trim() === "" ? null : parseSom(limit);
    if (limit.trim() !== "" && v === null) return setError("Введите сумму, например 50000");
    run(() => api.updateCategory(c.id, { monthly_limit: v }));
  }

  return (
    <div className="cat-edit">
      {c.type === "expense" && (
        <>
          <Field label="Лимит на месяц, сом (пусто — без лимита)">
            <input className="input" inputMode="decimal" placeholder="Без лимита" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
          <button className="btn btn-secondary" onClick={saveLimit}>Сохранить лимит</button>
        </>
      )}
      {error && <ErrorBox message={error} />}
      <button className="btn btn-danger" onClick={() => {
        if (confirm(`Удалить категорию «${c.name}»?`)) run(() => api.deleteCategory(c.id));
      }}>Удалить категорию</button>
    </div>
  );
}

function NewCategory({ wallets, onDone }: { wallets: Wallet[]; onDone: () => void }) {
  const ordered = [...wallets].reverse();
  const [name, setName] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [walletId, setWalletId] = useState(ordered[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Введите название");
    try {
      await api.addCategory({ name: name.trim(), type, wallet_id: walletId, monthly_limit: null });
      onDone();
    } catch (err) { setError(errText(err)); }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <Field label="Название">
        <input className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <div className="field"><span>Это</span>
        <div className="seg row2">
          <button type="button" aria-pressed={type === "expense"} onClick={() => setType("expense")}>Расход</button>
          <button type="button" aria-pressed={type === "income"} onClick={() => setType("income")}>Доход</button>
        </div>
      </div>
      <div className="field"><span>Кошелёк</span>
        <div className="seg row2">
          {ordered.map((w) => (
            <button type="button" key={w.id} aria-pressed={walletId === w.id} onClick={() => setWalletId(w.id)}>{w.name}</button>
          ))}
        </div>
      </div>
      {error && <ErrorBox message={error} />}
      <button className="btn btn-primary" style={{ minHeight: 64 }}>Добавить</button>
    </form>
  );
}

function Opening({ wallets, onChanged }: Props) {
  const [values, setValues] = useState<Record<number, string>>(
    () => Object.fromEntries(wallets.map((w) => [w.id, toInputSom(w.initial_balance)]))
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null); setError(null);
    const parsed = wallets.map((w) => ({ w, v: parseSom(values[w.id] || "0") }));
    if (parsed.some((p) => p.v === null)) return setError("Введите суммы числами, например 120000");
    try {
      for (const { w, v } of parsed) if (v !== w.initial_balance) await api.updateWallet(w.id, { initial_balance: v! });
      await onChanged();
      setMsg("Сохранено");
    } catch (err) { setError(errText(err)); }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h2 className="title">Стартовые остатки</h2>
      <p className="hint">Сколько денег было в каждом кошельке, когда вы начали вести учёт. Остаток на главном экране = эта сумма + все записи.</p>
      {wallets.map((w) => (
        <Field key={w.id} label={`${w.name}, сом`}>
          <input className="input" inputMode="decimal" value={values[w.id] ?? ""}
            onChange={(e) => setValues({ ...values, [w.id]: e.target.value })} />
        </Field>
      ))}
      {error && <ErrorBox message={error} />}
      {msg && <div className="notice">{msg}</div>}
      <button className="btn btn-primary">Сохранить</button>
    </form>
  );
}

function History({ wallets, categories, today, onChanged }: Props) {
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.transactions(20).then(setItems).catch((e) => setError(errText(e)));
  useEffect(() => { load(); }, []);

  async function remove(t: Transaction) {
    if (!confirm(`Удалить запись «${txTitle(t, categories, wallets)}» на ${formatNum(t.amount)} сом?`)) return;
    try { await api.deleteTransaction(t.id); await onChanged(); await load(); } catch (e) { setError(errText(e)); }
  }

  return (
    <div className="stack">
      <h2 className="title">Удалить запись</h2>
      <p className="hint">Последние 20 записей.</p>
      {error && <ErrorBox message={error} />}
      <div className="list">
        {items?.length === 0 && <div className="empty">Записей нет</div>}
        {items?.map((t) => (
          <div className="row" key={t.id}>
            <div>
              <div className="name">{txTitle(t, categories, wallets)}</div>
              <div className="sub">{dayLabel(t.date, today)}</div>
            </div>
            <div className="del-col">
              <Money tyiyn={t.amount} size={22} bare sign={t.type === "income" ? "+" : t.type === "expense" ? "−" : undefined}
                className={t.type === "income" ? "pos" : t.type === "expense" ? "neg" : ""} />
              <button onClick={() => remove(t)}>Удалить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
