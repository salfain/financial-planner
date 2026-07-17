import { getD1 } from "@/db";
import { makeId, nowIso } from "./api";
import {
  auditLogSelect,
  type AuditLogRow,
  serializeAuditLog,
} from "./repository";

export type AuditEntry = {
  workspaceId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actor?: string;
  requestId?: string | null;
  before?: unknown;
  after?: unknown;
  details?: unknown;
  createdAt?: string;
};

export function auditStatement(d1: D1Database, entry: AuditEntry): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO audit_logs
         (id, workspace_id, action, entity_type, entity_id, actor, request_id,
          before_json, after_json, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      makeId("audit"),
      entry.workspaceId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.actor ?? "system",
      entry.requestId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      JSON.stringify(entry.details ?? {}),
      entry.createdAt ?? nowIso(),
    );
}

export function auditStatementWhenTransactionExists(
  d1: D1Database,
  entry: AuditEntry,
  transactionId: string,
): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO audit_logs
         (id, workspace_id, action, entity_type, entity_id, actor, request_id,
          before_json, after_json, details, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM transactions
       WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(
      makeId("audit"),
      entry.workspaceId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.actor ?? "system",
      entry.requestId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      JSON.stringify(entry.details ?? {}),
      entry.createdAt ?? nowIso(),
      entry.workspaceId,
      transactionId,
    );
}

export function auditStatementWhenInvestmentTransactionExists(
  d1: D1Database,
  entry: AuditEntry,
  investmentTransactionId: string,
): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO audit_logs
         (id, workspace_id, action, entity_type, entity_id, actor, request_id,
          before_json, after_json, details, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM investment_transactions
       WHERE workspace_id = ? AND id = ?`,
    )
    .bind(
      makeId("audit"),
      entry.workspaceId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.actor ?? "system",
      entry.requestId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      JSON.stringify(entry.details ?? {}),
      entry.createdAt ?? nowIso(),
      entry.workspaceId,
      investmentTransactionId,
    );
}

export function auditStatementWhenInvestmentAssetVersion(
  d1: D1Database,
  entry: AuditEntry,
  assetId: string,
  updatedAt: string,
): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO audit_logs
         (id, workspace_id, action, entity_type, entity_id, actor, request_id,
          before_json, after_json, details, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM investment_assets
       WHERE workspace_id = ? AND id = ? AND updated_at = ?`,
    )
    .bind(
      makeId("audit"),
      entry.workspaceId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.actor ?? "system",
      entry.requestId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      JSON.stringify(entry.details ?? {}),
      entry.createdAt ?? nowIso(),
      entry.workspaceId,
      assetId,
      updatedAt,
    );
}

export function auditStatementWhenCategoryExists(
  d1: D1Database,
  entry: AuditEntry,
  categoryId: string,
): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO audit_logs
         (id, workspace_id, action, entity_type, entity_id, actor, request_id,
          before_json, after_json, details, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM categories
       WHERE workspace_id = ? AND id = ?`,
    )
    .bind(
      makeId("audit"),
      entry.workspaceId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.actor ?? "system",
      entry.requestId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      JSON.stringify(entry.details ?? {}),
      entry.createdAt ?? nowIso(),
      entry.workspaceId,
      categoryId,
    );
}

export function auditStatementWhenTransactionVersion(
  d1: D1Database,
  entry: AuditEntry,
  transactionId: string,
  updatedAt: string,
  deletedAt: string | null,
): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO audit_logs
         (id, workspace_id, action, entity_type, entity_id, actor, request_id,
          before_json, after_json, details, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM transactions
       WHERE workspace_id = ? AND id = ? AND updated_at = ?
         AND ((? IS NULL AND deleted_at IS NULL) OR deleted_at = ?)`,
    )
    .bind(
      makeId("audit"),
      entry.workspaceId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.actor ?? "system",
      entry.requestId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      JSON.stringify(entry.details ?? {}),
      entry.createdAt ?? nowIso(),
      entry.workspaceId,
      transactionId,
      updatedAt,
      deletedAt,
      deletedAt,
    );
}

export function auditStatementWhenRequestUnused(
  d1: D1Database,
  entry: AuditEntry & { requestId: string },
): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO audit_logs
         (id, workspace_id, action, entity_type, entity_id, actor, request_id,
          before_json, after_json, details, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM audit_logs
         WHERE workspace_id = ? AND request_id = ? AND action = ?
       )`,
    )
    .bind(
      makeId("audit"),
      entry.workspaceId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.actor ?? "system",
      entry.requestId,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      JSON.stringify(entry.details ?? {}),
      entry.createdAt ?? nowIso(),
      entry.workspaceId,
      entry.requestId,
      entry.action,
    );
}

export async function getAuditByRequestId(
  workspaceId: string,
  requestId: string,
  action: string,
  entityId: string,
) {
  const row = await getD1()
    .prepare(
      `${auditLogSelect}
       WHERE workspace_id = ? AND request_id = ? AND action = ? AND entity_id = ? LIMIT 1`,
    )
    .bind(workspaceId, requestId, action, entityId)
    .first<AuditLogRow>();
  return row ? serializeAuditLog(row) : null;
}

export async function getAuditByRequest(
  workspaceId: string,
  requestId: string,
  action: string,
) {
  const row = await getD1()
    .prepare(
      `${auditLogSelect}
       WHERE workspace_id = ? AND request_id = ? AND action = ?
       ORDER BY created_at, id LIMIT 1`,
    )
    .bind(workspaceId, requestId, action)
    .first<AuditLogRow>();
  return row ? serializeAuditLog(row) : null;
}
