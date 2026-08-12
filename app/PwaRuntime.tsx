"use client";

import { useEffect, useState } from "react";
import { Download, ShieldCheck, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "financial-planner-install-dismissed-until";

export function PwaRuntime() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    const capture = (event: Event) => {
      event.preventDefault();
      const dismissedUntil = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedUntil <= Date.now()) setInstallPrompt(event as InstallPromptEvent);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "dismissed") window.localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setInstallPrompt(null);
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setInstallPrompt(null);
  };

  if (!installPrompt) return null;
  return <aside className="pwa-install-banner" role="status">
    <span><Download size={20} /></span>
    <div><strong>Pasang Financial Planner</strong><small><ShieldCheck size={13} /> Buka lebih cepat dari layar utama tanpa menyimpan data finansial di cache offline.</small></div>
    <button className="primary-button" onClick={() => void install()}>Pasang</button>
    <button className="icon-button small" onClick={dismiss} aria-label="Ingatkan pemasangan nanti"><X size={16} /></button>
  </aside>;
}
