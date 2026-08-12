import type { NotificationOverview } from "./notifications";

export type DeviceNotificationState = "unsupported" | NotificationPermission;

const SEEN_KEY = "financial-planner-device-notifications-seen";

export function deviceNotificationState(): DeviceNotificationState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission;
}

async function readyRegistration() {
  if (!("serviceWorker" in navigator)) throw new Error("Service worker tidak tersedia.");
  return navigator.serviceWorker.ready;
}

export async function enableDeviceNotifications() {
  const state = deviceNotificationState();
  if (state === "unsupported") throw new Error("Notifikasi perangkat belum didukung browser ini.");
  const permission = state === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const registration = await readyRegistration();
  await registration.showNotification("Notifikasi Financial Planner aktif", {
    body: "Reminder penting akan muncul saat aplikasi aktif dan, pada perangkat yang mendukung, melalui pemeriksaan berkala.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: "finance-notification-enabled",
    data: { url: "/" },
  });
  const periodic = registration as ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> } };
  await periodic.periodicSync?.register("finance-reminders", { minInterval: 12 * 60 * 60 * 1000 }).catch(() => undefined);
  return permission;
}

export async function showFinanceDeviceNotifications(overview: NotificationOverview) {
  if (!overview.settings.enabled || deviceNotificationState() !== "granted") return 0;
  const registration = await readyRegistration();
  let seen: string[] = [];
  try { seen = JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]") as string[]; }
  catch { seen = []; }
  const seenSet = new Set(seen);
  const pending = overview.notifications
    .filter((item) => !item.read && !item.dismissed && item.severity !== "info" && !seenSet.has(item.id))
    .slice(0, 3);
  for (const item of pending) {
    await registration.showNotification(item.title, {
      body: item.message,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: item.id,
      data: { url: "/", notificationId: item.id, actionPage: item.actionPage },
    });
    seenSet.add(item.id);
  }
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seenSet).slice(-200)));
  return pending.length;
}
