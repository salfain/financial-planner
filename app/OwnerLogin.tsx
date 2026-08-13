"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

export function OwnerLogin({ configured }: { configured: boolean }) {
  const [pin, setPin] = useState("");
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin) || working || !configured) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const body = await response.json() as { ok?: boolean; error?: { message?: string } };
      if (!response.ok || !body.ok) throw new Error(body.error?.message || "PIN tidak cocok.");
      window.location.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Akses belum dapat diverifikasi.");
      setWorking(false);
    }
  };

  return <main className="owner-login-page">
    <section className="owner-login-card" aria-labelledby="owner-login-title">
      <span className="owner-login-mark"><LockKeyhole size={25} /></span>
      <div className="owner-login-heading"><span>AREA PEMILIK</span><h1 id="owner-login-title">Financial Planner</h1><p>Masukkan PIN 6 digit untuk membuka data keuangan pribadi.</p></div>
      {configured ? <form onSubmit={submit}>
        <label htmlFor="owner-pin">PIN akses</label>
        <div className="owner-password-field owner-pin-field"><KeyRound size={18} /><input id="owner-pin" type={visible ? "text" : "password"} inputMode="numeric" pattern="[0-9]{6}" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="current-password" autoFocus maxLength={6} aria-label="PIN akses 6 digit" required /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Sembunyikan PIN" : "Tampilkan PIN"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        {error && <div className="owner-login-error" role="alert">{error}</div>}
        <button className="owner-login-submit" disabled={working || pin.length !== 6}>{working ? "Memverifikasi…" : "Buka Financial Planner"}</button>
      </form> : <div className="owner-login-error" role="alert">Perlindungan pemilik belum selesai dikonfigurasi. Hubungi pengelola deployment.</div>}
      <small><ShieldCheck size={15} /> Data tetap berada di Google Sheets dan PIN tidak pernah disimpan di browser.</small>
    </section>
  </main>;
}
