import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FinanceApp } from "../app/FinanceApp";
import "../app/globals.css";
import { callAppsScript, hasAppsScriptBridge } from "../lib/apps-script-client";
import "./styles.css";

type SheetHealth = {
  sheet: string;
  status: "healthy" | "missing" | "header_mismatch" | string;
};

type HealthResponse = {
  appName: string;
  schemaVersion: string;
  sheets: SheetHealth[];
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

function GasHost() {
  const [bridgeState, setBridgeState] = useState<BridgeState>({
    status: "connecting",
    message: "Menghubungkan Google Sheets…",
  });
  const [showStatus, setShowStatus] = useState(true);

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
      <FinanceApp />
    </>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemen #root untuk Financial Planner tidak ditemukan.");
}

createRoot(rootElement).render(<GasHost />);
