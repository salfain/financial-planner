import { getD1 } from "@/db";
import { auditStatementWhenInvestmentAssetVersion, getAuditByRequestId } from "../../../../_lib/audit";
import {
  ApiError,
  nowIso,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../../../_lib/api";
import { parseInvestmentAsset } from "../../../../_lib/investment-domain";
import { requireCapability } from "../../../../_lib/license";
import {
  getAccountRow,
  getInvestmentAssetRow,
  requireWorkspace,
  serializeInvestmentAsset,
} from "../../../../_lib/repository";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "investments");
    const id = validateId((await context.params).id);
    const requestId = requiredString(payload, "requestId", 120);
    const current = await getInvestmentAssetRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Aset investasi tidak ditemukan.");
    const replay = await getAuditByRequestId(workspaceId, requestId, "investment.asset.update", id);
    if (replay) return Response.json({ asset: serializeInvestmentAsset(current), replayed: true });
    const expectedUpdatedAt = requiredString(payload, "expectedUpdatedAt", 80);
    const base = {
      accountId: current.accountId,
      ticker: current.ticker,
      name: current.name,
      assetClass: current.assetClass,
      exchange: current.exchange,
      currency: current.currency,
      manualPrice: current.manualPrice,
      active: Boolean(current.active),
    };
    const next = parseInvestmentAsset({ ...base, ...payload });
    if (current.unitsMicro > 0 && next.accountId !== current.accountId) {
      throw new ApiError(409, "ASSET_IN_USE", "Akun investasi tidak dapat diganti selama aset masih memiliki unit.");
    }
    if (current.unitsMicro > 0 && !next.active) {
      throw new ApiError(409, "ASSET_IN_USE", "Jual seluruh unit sebelum mengarsipkan aset.");
    }
    const account = await getAccountRow(workspaceId, next.accountId);
    if (!account || account.type !== "Investment" || account.liability) {
      throw new ApiError(400, "INVESTMENT_ACCOUNT_REQUIRED", "Pilih akun bertipe Investment untuk menyimpan cost basis aset.");
    }
    const priceChanged = payload.manualPrice !== undefined;
    const marketPrice = priceChanged ? (next.manualPrice ?? 0) : current.latestPriceCache;
    const priceSource = priceChanged ? (next.manualPrice === null ? "unavailable" : "manual") : current.priceSource;
    const priceStatus = priceChanged ? (next.manualPrice === null ? "unavailable" : "manual") : current.priceStatus;
    const priceUpdatedAt = priceChanged ? (next.manualPrice === null ? null : nowIso()) : current.priceUpdatedAt;
    const now = nowIso();
    const before = serializeInvestmentAsset(current);
    const d1 = getD1();
    const results = await d1.batch([
      d1.prepare(
        `UPDATE investment_assets
         SET account_id = ?, ticker = ?, name = ?, asset_class = ?, exchange = ?,
             currency = ?, manual_price = ?, latest_price_cache = ?, price_source = ?,
             price_status = ?, price_updated_at = ?, active = ?, updated_at = ?
         WHERE workspace_id = ? AND id = ? AND updated_at = ?`,
      ).bind(
        next.accountId, next.ticker, next.name, next.assetClass, next.exchange,
        next.currency, next.manualPrice, marketPrice, priceSource, priceStatus,
        priceUpdatedAt, next.active ? 1 : 0, now, workspaceId, id, expectedUpdatedAt,
      ),
      auditStatementWhenInvestmentAssetVersion(d1, {
        workspaceId,
        action: "investment.asset.update",
        entityType: "investment_asset",
        entityId: id,
        requestId,
        before,
        after: { ...before, ...next, marketPrice, priceSource, priceStatus, priceUpdatedAt, updatedAt: now },
        createdAt: now,
      }, id, now),
    ]);
    if (Number(results[0].meta.changes ?? 0) === 0) {
      throw new ApiError(409, "STALE_INVESTMENT_ASSET", "Aset sudah berubah. Muat ulang data lalu coba lagi.");
    }
    const updated = await getInvestmentAssetRow(workspaceId, id);
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Aset investasi tidak ditemukan.");
    return Response.json({ asset: serializeInvestmentAsset(updated), replayed: false });
  } catch (error) {
    return routeError(error);
  }
}
