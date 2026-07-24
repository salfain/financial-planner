import { getD1 } from "@/db";
import { auditStatement } from "../../../_lib/audit";
import {
  ApiError,
  makeId,
  nowIso,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
} from "../../../_lib/api";
import { parseInvestmentAsset } from "../../../_lib/investment-domain";
import { requireCapability } from "../../../_lib/license";
import {
  getAccountRow,
  getInvestmentAssetByRequest,
  investmentAssetSelect,
  requireWorkspace,
  serializeInvestmentAsset,
  type InvestmentAssetRow,
} from "../../../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
    const result = await getD1()
      .prepare(`${investmentAssetSelect} WHERE a.workspace_id = ? ${includeArchived ? "" : "AND a.active = 1"} ORDER BY a.name, a.id`)
      .bind(workspaceId)
      .all<InvestmentAssetRow>();
    return Response.json({ assets: result.results.map(serializeInvestmentAsset) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  let workspaceId: string | null = null;
  let requestId: string | null = null;
  try {
    const payload = await readJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "investments");
    requestId = requiredString(payload, "requestId", 120);
    const replay = await getInvestmentAssetByRequest(workspaceId, requestId);
    if (replay) return Response.json({ asset: serializeInvestmentAsset(replay), replayed: true });

    const asset = parseInvestmentAsset(payload);
    const account = await getAccountRow(workspaceId, asset.accountId);
    if (!account || account.type !== "Investment" || account.liability) {
      throw new ApiError(400, "INVESTMENT_ACCOUNT_REQUIRED", "Pilih akun bertipe Investment untuk menyimpan cost basis aset.");
    }
    const id = payload.id === undefined ? makeId("asset") : requiredString(payload, "id", 80);
    const now = nowIso();
    const marketPrice = asset.manualPrice ?? 0;
    const priceSource = asset.manualPrice === null ? "unavailable" : "manual";
    const priceStatus = asset.manualPrice === null ? "unavailable" : "manual";
    const d1 = getD1();
    await d1.batch([
      d1.prepare(
        `INSERT INTO investment_assets
           (id, workspace_id, account_id, ticker, name, asset_class, exchange, currency,
            manual_price, latest_price_cache, price_source, price_status, price_updated_at,
            active, request_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id, workspaceId, asset.accountId, asset.ticker, asset.name, asset.assetClass,
        asset.exchange, asset.currency, asset.manualPrice, marketPrice, priceSource,
        priceStatus, asset.manualPrice === null ? null : now, asset.active ? 1 : 0,
        requestId, now, now,
      ),
      d1.prepare(
        `INSERT INTO investment_positions
           (asset_id, workspace_id, units_micro, cost_basis, realized_pl, updated_at)
         VALUES (?, ?, 0, 0, 0, ?)`,
      ).bind(id, workspaceId, now),
      auditStatement(d1, {
        workspaceId,
        action: "investment.asset.create",
        entityType: "investment_asset",
        entityId: id,
        requestId,
        after: { ...asset, id, marketPrice, priceSource, priceStatus },
        createdAt: now,
      }),
    ]);
    const created = await getD1()
      .prepare(`${investmentAssetSelect} WHERE a.workspace_id = ? AND a.id = ? LIMIT 1`)
      .bind(workspaceId, id)
      .first<InvestmentAssetRow>();
    if (!created) throw new ApiError(500, "CREATE_FAILED", "Aset investasi tidak dapat dimuat setelah dibuat.");
    return Response.json({ asset: serializeInvestmentAsset(created), replayed: false }, { status: 201 });
  } catch (error) {
    if (workspaceId && requestId && error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      const replay = await getInvestmentAssetByRequest(workspaceId, requestId);
      if (replay) return Response.json({ asset: serializeInvestmentAsset(replay), replayed: true });
    }
    return routeError(error);
  }
}
