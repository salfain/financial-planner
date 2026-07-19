import { getD1 } from "@/db";
import {
  ApiError,
  monthPeriod,
  nowIso,
  optionalString,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
} from "../_lib/api";
import { auditStatement } from "../_lib/audit";
import { DEFAULT_CATEGORIES, parseAccount, parseCategory } from "../_lib/domain";
import { getBootstrap, getWorkspace } from "../_lib/repository";

function currentMonth(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    if (year && month) return `${year}-${month}`;
  } catch {
    // Fall through to Jakarta's fixed UTC+7 offset for legacy timezone values.
  }
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export async function GET(request: Request) {
  try {
    const rawMonth = new URL(request.url).searchParams.get("month");
    const month = rawMonth ? monthPeriod({ month: rawMonth }, "month") : undefined;
    return Response.json(await getBootstrap(resolveWorkspaceId(request), month));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const existing = await getWorkspace(workspaceId);
    const requestedMonth =
      payload.month === undefined ? undefined : monthPeriod(payload, "month");
    if (existing?.configured) {
      return Response.json(
        await getBootstrap(
          workspaceId,
          requestedMonth ?? currentMonth(existing.timezone),
        ),
      );
    }

    const storeName =
      payload.storeName === undefined ? "Financial Planner" : requiredString(payload, "storeName", 100);
    const profileName =
      payload.profileName === undefined && payload.name === undefined
        ? "Vinn"
        : requiredString(
            { profileName: payload.profileName ?? payload.name },
            "profileName",
            100,
          );
    const currency =
      payload.currency === undefined ? "IDR" : requiredString(payload, "currency", 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ApiError(400, "INVALID_FIELD", "currency harus berupa kode ISO tiga huruf.", {
        field: "currency",
      });
    }
    const timezone =
      payload.timezone === undefined
        ? "Asia/Jakarta"
        : requiredString(payload, "timezone", 80);

    const rawAccounts = payload.accounts ?? [];
    if (!Array.isArray(rawAccounts)) {
      throw new ApiError(400, "INVALID_FIELD", "accounts harus berupa array.", {
        field: "accounts",
      });
    }
    if (rawAccounts.length > 50) {
      throw new ApiError(400, "TOO_MANY_ACCOUNTS", "Setup maksimal memuat 50 akun.");
    }
    const accounts = rawAccounts.map((value, index) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new ApiError(400, "INVALID_FIELD", `accounts[${index}] harus berupa object.`);
      }
      return parseAccount(value as Record<string, unknown>);
    });
    if (new Set(accounts.map((account) => account.id)).size !== accounts.length) {
      throw new ApiError(400, "DUPLICATE_ACCOUNT_ID", "Setiap akun harus memiliki id unik.");
    }
    const categories = DEFAULT_CATEGORIES.map((category) =>
      parseCategory({ ...category }),
    );

    const d1 = getD1();
    const now = nowIso();
    const statements: D1PreparedStatement[] = [
      d1
        .prepare(
          `INSERT INTO workspaces
             (id, profile_name, store_name, currency, timezone, configured, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
        )
        .bind(workspaceId, profileName, storeName, currency, timezone, now, now),
      d1
        .prepare(
          `UPDATE workspaces
           SET profile_name = ?, store_name = ?, currency = ?, timezone = ?, updated_at = ?
           WHERE id = ? AND configured = 0`,
        )
        .bind(profileName, storeName, currency, timezone, now, workspaceId),
      ...accounts.map((account) =>
        d1
          .prepare(
            `INSERT INTO accounts
               (id, workspace_id, name, type, institution, balance, opening_balance, mask,
                color, liability, active, created_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
             FROM workspaces WHERE id = ? AND configured = 0`,
          )
          .bind(
            account.id,
            workspaceId,
            account.name,
            account.type,
            account.institution,
            account.balance,
            account.balance,
            account.mask,
            account.color,
            account.liability ? 1 : 0,
            now,
            now,
            workspaceId,
          ),
      ),
      ...categories.map((category) =>
        d1
          .prepare(
            `INSERT INTO categories
               (id, workspace_id, name, type, color, icon, archived, is_default,
                created_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, 0, 1, ?, ?
             FROM workspaces
             WHERE id = ? AND configured = 0
               AND NOT EXISTS (
                 SELECT 1 FROM categories
                 WHERE workspace_id = ? AND lower(name) = lower(?)
               )`,
          )
          .bind(
            category.id,
            workspaceId,
            category.name,
            category.type,
            category.color,
            category.icon,
            now,
            now,
            workspaceId,
            workspaceId,
            category.name,
          ),
      ),
      d1
        .prepare(
          `UPDATE workspaces
           SET configured = 1, configured_at = ?, updated_at = ?
           WHERE id = ? AND configured = 0`,
        )
        .bind(now, now, workspaceId),
      auditStatement(d1, {
        workspaceId,
        action: "workspace.setup",
        entityType: "workspace",
        entityId: workspaceId,
        requestId,
        details: {
          storeName,
          profileName,
          accountCount: accounts.length,
          categoryCount: categories.length,
        },
        createdAt: now,
      }),
    ];
    await d1.batch(statements);

    return Response.json(
      await getBootstrap(workspaceId, requestedMonth ?? currentMonth(timezone)),
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
