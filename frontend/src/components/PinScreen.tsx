import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ErrorBox, errText } from "./ui";

const MIN = 4;
const MAX = 6;

export default function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = useCallback((k: string) => {
    setError(null);
    setPin((p) => (k === "del" ? p.slice(0, -1) : p.length < MAX ? p + k : p));
  }, []);

  const submit = useCallback(async () => {
    if (busy || pin.length < MIN) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(pin);
      onSuccess();
    } catch (e) {
      setError(errText(e));
      setPin("");
      setBusy(false);
    }
  }, [busy, pin, onSuccess]);

  // клавиатура компьютера
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [press, submit]);

  return (
    <main className="app">
      <div className="screen pin">
        <h1 className="title" style={{ textAlign: "center", marginTop: 16 }}>Введите код</h1>

        {/* одно место для подсказки или ошибки — чтобы клавиатура не прыгала */}
        <div className="pin-info">
          {error
            ? <ErrorBox message={error} />
            : <p className="hint">{pin.length < MIN ? "Код из 4–6 цифр" : "Когда введёте весь код, нажмите «Войти»"}</p>}
        </div>

        {/* кружок появляется с каждой введённой цифрой (до 6); код сам никогда не отправляется */}
        <div className="pin-dots" aria-label={`Введено цифр: ${pin.length}`}>
          {Array.from({ length: pin.length }, (_, i) => <i key={i} className="on" />)}
        </div>

        <div className="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
            <button key={k} className="key" onClick={() => press(k)}>{k}</button>
          ))}
          <span />
          <button className="key" onClick={() => press("0")}>0</button>
          <button className="key aux" onClick={() => press("del")} aria-label="Стереть цифру">Стереть</button>
        </div>

        <button className="btn btn-primary" disabled={busy || pin.length < MIN} onClick={submit}>Войти</button>
      </div>
    </main>
  );
}
