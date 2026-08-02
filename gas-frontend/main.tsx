import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FinanceApp } from "../app/FinanceApp";
import "../app/globals.css";
import {
  callAppsScript,
  clearAppsScriptMemberSession,
  hasAppsScriptBridge,
  saveAppsScriptMemberSession,
} from "../lib/apps-script-client";
import { changeOwnFinancePin } from "../lib/member-auth";
import "./styles.css";

type SheetHealth = {
  sheet: string;
  status: "healthy" | "missing" | "header_mismatch" | string;
};

type HealthResponse = {
  appName: string;
  schemaVersion: string;
  sheets: SheetHealth[];
  coupleMode?: {
    enabled: boolean;
    initialized: boolean;
    requiresAuthentication: boolean;
  };
};

type MemberChoice = { id: string; displayName: string };
type MemberIdentity = MemberChoice & { role: "owner" | "editor"; mustChangePin?: boolean };
type MemberAuthResponse = {
  mode: "single" | "couple";
  authenticated: boolean;
  member: MemberIdentity | null;
  members: MemberChoice[];
  sessionToken?: string;
};

type BootstrapResponse = {
  profile: {
    name: string;
    storeName: string;
    currency: string;
    timezone: string;
  };
  summary: Record<string, number>;
  accounts: unknown[];
  budgets: unknown[];
  goals: unknown[];
  bills: unknown[];
  transactions: unknown[];
};

type BridgeState =
  | { status: "connecting"; message: string }
  | { status: "connected"; message: string; health: HealthResponse }
  | { status: "needs_setup"; message: string; health: HealthResponse }
  | { status: "unavailable" | "error"; message: string };

type VinnStoreGasBridge = {
  call<T>(action: string, payload?: Record<string, unknown>): Promise<T>;
  health(): Promise<HealthResponse>;
  bootstrap(month?: string): Promise<BootstrapResponse>;
  setup(): Promise<{ appName: string; schemaVersion: string }>;
};

declare global {
  interface Window {
    vinnStoreGas: VinnStoreGasBridge;
    __FINANCE_DEMO__?: boolean;
  }
}

function jakartaMonth() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7);
}

const gasBridge: VinnStoreGasBridge = {
  call: callAppsScript,
  health: () => callAppsScript<HealthResponse>("health"),
  bootstrap: (month = jakartaMonth()) =>
    callAppsScript<BootstrapResponse>("bootstrap", { month }),
  setup: () =>
    callAppsScript<{ appName: string; schemaVersion: string }>("setup"),
};

window.vinnStoreGas = gasBridge;

function broadcastBridgeState(detail: BridgeState) {
  document.documentElement.dataset.gasBridge = detail.status;
  window.dispatchEvent(new CustomEvent<BridgeState>("vinn-store:gas-state", { detail }));
}

function MemberLogin({ auth, onAuthenticated }: { auth: MemberAuthResponse; onAuthenticated: (next: MemberAuthResponse) => void }) {
  const [memberId, setMemberId] = useState(auth.members[0]?.id || "");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await callAppsScript<MemberAuthResponse>("memberLogin", { memberId, pin });
      if (!result.sessionToken || !result.member) throw new Error("Sesi anggota tidak berhasil dibuat.");
      saveAppsScriptMemberSession(result.sessionToken, result.member.id);
      onAuthenticated(result);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login anggota gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="setup-shell">
      <section className="setup-copy">
        <div className="brand setup-brand"><span className="brand-mark">FP</span><span className="brand-copy"><strong>Financial Planner</strong><small>Mode Pasangan</small></span></div>
        <span className="setup-kicker">RUANG KEUANGAN AMAN</span>
        <h1>Masuk sebagai anggota</h1>
        <p>Pilih profil Anda dan masukkan PIN. Data pribadi tetap dipisahkan, sedangkan akun bersama dapat digunakan berdua.</p>
        <div className="setup-benefits">
          <span>Data pribadi disaring di dalam aplikasi</span>
          <span>Akun bersama terlihat oleh kedua anggota</span>
          <span>Spreadsheet hanya dikelola oleh pemilik</span>
        </div>
      </section>
      <section className="setup-card">
        <h2>Login anggota</h2>
        <p>Gunakan PIN 6 angka yang diberikan oleh pemilik.</p>
        {error && <div className="setup-error"><span aria-hidden="true">!</span><span><strong>Belum dapat masuk</strong><small>{error}</small></span></div>}
        {!auth.members.length ? (
          <div className="setup-error"><span aria-hidden="true">!</span><span><strong>Anggota belum disiapkan</strong><small>Jalankan Aktifkan Mode Pasangan dari menu Financial Planner di Google Sheets.</small></span></div>
        ) : (
          <form onSubmit={submit}>
            <div className="form-grid setup-form">
              <label className="full-field"><span>Anggota</span><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{auth.members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label>
              <label className="full-field"><span>PIN 6 angka</span><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="current-password" placeholder="••••••" /></label>
            </div>
            <button className="primary-button setup-submit" disabled={submitting || pin.length !== 6}>{submitting ? "Memeriksa…" : "Masuk ke Financial Planner"}</button>
            <small className="setup-footnote">Lima PIN yang salah akan mengunci login selama 10 menit.</small>
          </form>
        )}
      </section>
    </main>
  );
}

function MandatoryPinChange({ auth, onChanged }: { auth: MemberAuthResponse; onChanged: (next: MemberAuthResponse) => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = currentPin.length === 6 && newPin.length === 6 && newPin === confirmation && newPin !== currentPin;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await changeOwnFinancePin(currentPin, newPin);
      saveAppsScriptMemberSession(result.sessionToken, result.member.id);
      onChanged({ ...auth, authenticated: true, member: result.member, sessionToken: result.sessionToken });
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "PIN belum dapat diganti.");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="setup-shell">
    <section className="setup-copy">
      <div className="brand setup-brand"><span className="brand-mark">FP</span><span className="brand-copy"><strong>Financial Planner</strong><small>Mode Pasangan</small></span></div>
      <span className="setup-kicker">LANGKAH KEAMANAN</span>
      <h1>Buat PIN pribadi Anda</h1>
      <p>PIN yang diberikan pemilik hanya berlaku untuk login pertama. Ganti sekarang sebelum membuka data keuangan.</p>
      <div className="setup-benefits"><span>PIN baru terdiri dari 6 angka</span><span>Sesi lama otomatis ditutup</span><span>PIN tidak pernah ditampilkan di spreadsheet</span></div>
    </section>
    <section className="setup-card">
      <h2>Ganti PIN sementara</h2>
      <p>Anda masuk sebagai <strong>{auth.member?.displayName || "Anggota"}</strong>.</p>
      {error && <div className="setup-error"><span aria-hidden="true">!</span><span><strong>Belum dapat mengganti PIN</strong><small>{error}</small></span></div>}
      <form onSubmit={submit}>
        <div className="form-grid setup-form">
          <label className="full-field"><span>PIN sementara</span><input value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="current-password" autoFocus /></label>
          <label className="full-field"><span>PIN baru</span><input value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="new-password" /></label>
          <label className="full-field"><span>Ulangi PIN baru</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="new-password" /></label>
        </div>
        <button className="primary-button setup-submit" disabled={submitting || !valid}>{submitting ? "Mengamankan…" : "Simpan PIN dan lanjutkan"}</button>
        <small className="setup-footnote">PIN baru harus berbeda dari PIN sementara.</small>
      </form>
    </section>
  </main>;
}

function GasHost() {
  const [bridgeState, setBridgeState] = useState<BridgeState>({
    status: "connecting",
    message: "Menghubungkan Google Sheets…",
  });
  const [showStatus, setShowStatus] = useState(true);
  const [memberAuth, setMemberAuth] = useState<MemberAuthResponse | null>(null);

  useEffect(() => {
    let active = true;

    const update = (nextState: BridgeState) => {
      if (!active) return;
      setBridgeState(nextState);
      broadcastBridgeState(nextState);
    };

    if (window.__FINANCE_DEMO__ === true) {
      update({
        status: "connected",
        message: "Mode demo read-only siap.",
        health: { appName: "Financial Planner Demo", schemaVersion: "demo-read-only", sheets: [] },
      });
      return () => { active = false; };
    }

    if (!hasAppsScriptBridge()) {
      update({
        status: "unavailable",
        message: "Mode lokal aktif — Google Sheets belum terhubung.",
      });
      return () => {
        active = false;
      };
    }

    const connect = async () => {
      try {
        const health = await gasBridge.health();
        const unhealthySheets = health.sheets.filter((sheet) => sheet.status !== "healthy");

        if (unhealthySheets.length) {
          update({
            status: "needs_setup",
            health,
            message: `Setup Google Sheets belum lengkap (${unhealthySheets.length} sheet).`,
          });
          return;
        }

        if (health.coupleMode?.enabled) {
          const identity = await callAppsScript<MemberAuthResponse>("whoami");
          if (identity.sessionToken && identity.member) {
            saveAppsScriptMemberSession(identity.sessionToken, identity.member.id);
          } else if (!identity.authenticated) {
            clearAppsScriptMemberSession();
          }
          if (!active) return;
          setMemberAuth(identity);
        } else {
          setMemberAuth({ mode: "single", authenticated: true, member: null, members: [] });
        }

        update({
          status: "connected",
          health,
          message: "Google Sheets terhubung.",
        });
      } catch (error) {
        update({
          status: "error",
          message: error instanceof Error ? error.message : "Koneksi Google Sheets gagal.",
        });
      }
    };

    void connect();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (bridgeState.status === "connecting") return;
    const timeout = window.setTimeout(() => setShowStatus(false), bridgeState.status === "connected" ? 2400 : 5000);
    return () => window.clearTimeout(timeout);
  }, [bridgeState.status]);

  return (
    <>
      {showStatus && (
        <div
          className={`gas-bridge-status gas-bridge-status--${bridgeState.status}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" />
          {bridgeState.message}
        </div>
      )}
      {memberAuth?.mode === "couple" && !memberAuth.authenticated
        ? <MemberLogin auth={memberAuth} onAuthenticated={setMemberAuth} />
        : memberAuth?.mode === "couple" && memberAuth.authenticated && memberAuth.member?.mustChangePin
        ? <MandatoryPinChange auth={memberAuth} onChanged={setMemberAuth} />
        : window.__FINANCE_DEMO__ === true || memberAuth?.authenticated || bridgeState.status === "unavailable" || bridgeState.status === "needs_setup" || bridgeState.status === "error"
        ? <FinanceApp memberIdentity={memberAuth?.mode === "couple" ? memberAuth.member : null} />
        : null}
    </>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemen #root untuk Financial Planner tidak ditemukan.");
}

createRoot(rootElement).render(<GasHost />);
