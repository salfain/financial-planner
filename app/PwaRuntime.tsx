"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, ShieldCheck, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "financial-planner-install-dismissed-until";

export function PwaRuntime() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    let registration: ServiceWorkerRegistration | null = null;
    let updateTimer = 0;
    const register = async () => {
      if (!("serviceWorker" in navigator)) return;
      registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      if (registration.waiting && navigator.serviceWorker.controller) setWaitingWorker(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration?.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(worker);
        });
      });
      updateTimer = window.setInterval(() => registration?.update().catch(() => undefined), 60 * 60 * 1000);
    };
    void register().catch(() => undefined);
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
      window.clearInterval(updateTimer);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) return;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    }, { once: true });
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

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

  if (waitingWorker) return <aside className="pwa-install-banner pwa-update-banner" role="status">
    <span><RefreshCw size={20} /></span>
    <div><strong>Versi baru tersedia</strong><small>Pembaruan siap dipakai tanpa mengubah data di Google Sheets.</small></div>
    <button className="primary-button" onClick={applyUpdate}>Perbarui</button>
    <button className="icon-button small" onClick={() => setWaitingWorker(null)} aria-label="Tutup pemberitahuan pembaruan"><X size={16} /></button>
  </aside>;
  if (!installPrompt) return null;
  return <aside className="pwa-install-banner" role="status">
    <span><Download size={20} /></span>
    <div><strong>Pasang Financial Planner</strong><small><ShieldCheck size={13} /> Buka lebih cepat dari layar utama tanpa menyimpan data finansial di cache offline.</small></div>
    <button className="primary-button" onClick={() => void install()}>Pasang</button>
    <button className="icon-button small" onClick={dismiss} aria-label="Ingatkan pemasangan nanti"><X size={16} /></button>
  </aside>;
}
