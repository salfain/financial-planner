"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

export function OwnerLogin({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || working || !configured) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json() as { ok?: boolean; error?: { message?: string } };
      if (!response.ok || !body.ok) throw new Error(body.error?.message || "Kunci akses tidak cocok.");
      window.location.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Akses belum dapat diverifikasi.");
      setWorking(false);
    }
  };

  return <main className="owner-login-page">
    <section className="owner-login-card" aria-labelledby="owner-login-title">
      <span className="owner-login-mark"><LockKeyhole size={25} /></span>
      <div className="owner-login-heading"><span>AREA PEMILIK</span><h1 id="owner-login-title">Financial Planner</h1><p>Masukkan kunci akses pemilik untuk membuka data keuangan pribadi.</p></div>
      {configured ? <form onSubmit={submit}>
        <label htmlFor="owner-password">Kunci akses</label>
        <div className="owner-password-field"><KeyRound size={18} /><input id="owner-password" type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus maxLength={256} required /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Sembunyikan kunci akses" : "Tampilkan kunci akses"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        {error && <div className="owner-login-error" role="alert">{error}</div>}
        <button className="owner-login-submit" disabled={working || !password}>{working ? "Memverifikasi…" : "Buka Financial Planner"}</button>
      </form> : <div className="owner-login-error" role="alert">Perlindungan pemilik belum selesai dikonfigurasi. Hubungi pengelola deployment.</div>}
      <small><ShieldCheck size={15} /> Data tetap berada di Google Sheets dan kunci tidak pernah dikirim ke browser lain.</small>
    </section>
  </main>;
}
