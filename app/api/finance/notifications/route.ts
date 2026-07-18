import type { NotificationSettings } from "@/lib/notifications";
import { ApiError, booleanValue, monthPeriod, readJsonObject, resolveWorkspaceId, routeError } from "../../_lib/api";
import { getNotificationOverview, updateNotificationSettings, updateNotificationStates, type NotificationStateAction } from "../../_lib/notifications";

const stateActions = new Set<NotificationStateAction>(["read", "unread", "dismiss", "restore"]);

function intChoice(input: Record<string, unknown>, field: string, choices: number[]) {
  const value = Number(input[field]);
  if (!Number.isSafeInteger(value) || !choices.includes(value)) throw new ApiError(400, "INVALID_FIELD", `${field} tidak valid.`);
  return value;
}

function parseSettings(payload: Record<string, unknown>): NotificationSettings {
  if (!Array.isArray(payload.billReminderDays)) throw new ApiError(400, "INVALID_REMINDER_DAYS", "Jadwal reminder tagihan tidak valid.");
  const billReminderDays = [...new Set(payload.billReminderDays.map(Number))]
    .filter((value) => Number.isSafeInteger(value) && [7, 3, 1, 0].includes(value))
    .sort((a, b) => b - a);
  if (!billReminderDays.length) throw new ApiError(400, "INVALID_REMINDER_DAYS", "Pilih minimal satu jadwal reminder tagihan.");
  return {
    enabled: booleanValue(payload, "enabled"),
    billReminderDays,
    budgetWarningPercent: intChoice(payload, "budgetWarningPercent", [75, 90]),
    backupWarningDays: intChoice(payload, "backupWarningDays", [7, 14, 30]),
    goalWarningDays: intChoice(payload, "goalWarningDays", [7, 30, 60]),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const period = monthPeriod({ period: url.searchParams.get("period") });
    return Response.json(await getNotificationOverview(resolveWorkspaceId(request), period));
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    return Response.json({ settings: await updateNotificationSettings(workspaceId, parseSettings(payload)) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    if (!Array.isArray(payload.notificationIds) || payload.notificationIds.length < 1 || payload.notificationIds.length > 50) {
      throw new ApiError(400, "INVALID_NOTIFICATION_IDS", "Pilih 1-50 notifikasi.");
    }
    const notificationIds = payload.notificationIds.map(String);
    if (notificationIds.some((id) => !/^[A-Za-z0-9:_-]{1,180}$/.test(id))) throw new ApiError(400, "INVALID_NOTIFICATION_IDS", "ID notifikasi tidak valid.");
    const action = String(payload.action) as NotificationStateAction;
    if (!stateActions.has(action)) throw new ApiError(400, "INVALID_NOTIFICATION_ACTION", "Aksi notifikasi tidak valid.");
    return Response.json(await updateNotificationStates(workspaceId, [...new Set(notificationIds)], action));
  } catch (error) {
    return routeError(error);
  }
}
