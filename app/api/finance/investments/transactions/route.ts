import { getD1 } from "@/db";
import { calculateInvestmentBuy, calculateInvestmentSell } from "@/lib/investment";
import {
  auditStatementWhenInvestmentTransactionExists,
  auditStatementWhenTransactionExists,
} from "../../../_lib/audit";
import {
  ApiError,
  makeId,
  nowIso,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
} from "../../../_lib/api";
import { parseInvestmentTrade } from "../../../_lib/investment-domain";
import { requireCapability } from "../../../_lib/license";
import { assertMonthlyPeriodOpen } from "../../../_lib/monthly-closing";
import {
  getAccountRow,
  getInvestmentAssetRow,
  getInvestmentTransactionByRequest,
  investmentTransactionSelect,
  requireWorkspace,
  serializeInvestmentAsset,
  serializeInvestmentTransaction,
  type InvestmentTransactionRow,
} from "../../../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const result = await getD1()
      .prepare(`${investmentTransactionSelect} WHERE workspace_id = ? ORDER BY date DESC, created_at DESC, id DESC LIMIT 500`)
      .bind(workspaceId)
      .all<InvestmentTransactionRow>();
    return Response.json({ transactions: result.results.map(serializeInvestmentTransaction) });
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
    const trade = parseInvestmentTrade(payload);
    await assertMonthlyPeriodOpen(workspaceId, trade.date);
    requestId = trade.requestId;
    const replay = await getInvestmentTransactionByRequest(workspaceId, requestId);
    if (replay) {
      const replayAsset = await getInvestmentAssetRow(workspaceId, replay.assetId);
      return Response.json({
        transaction: serializeInvestmentTransaction(replay),
        asset: replayAsset ? serializeInvestmentAsset(replayAsset) : null,
        replayed: true,
      });
    }

    const asset = await getInvestmentAssetRow(workspaceId, trade.assetId);
    if (!asset || !asset.active) throw new ApiError(404, "NOT_FOUND", "Aset investasi tidak ditemukan atau sudah diarsipkan.");
    const [cashAccount, investmentAccount] = await Promise.all([
      getAccountRow(workspaceId, trade.accountId),
      getAccountRow(workspaceId, asset.accountId),
    ]);
    if (!cashAccount || cashAccount.liability || cashAccount.type === "Investment") {
      throw new ApiError(400, "CASH_ACCOUNT_REQUIRED", "Pilih akun Bank, E-Wallet, atau Cash untuk transaksi investasi.");
    }
    if (!investmentAccount || investmentAccount.liability || investmentAccount.type !== "Investment") {
      throw new ApiError(409, "INVESTMENT_ACCOUNT_REQUIRED", "Akun buku investasi aset tidak tersedia.");
    }
    if (cashAccount.id === investmentAccount.id) {
      throw new ApiError(400, "ACCOUNT_CONFLICT", "Akun kas dan akun investasi harus berbeda.");
    }

    let calculation: ReturnType<typeof calculateInvestmentBuy> | ReturnType<typeof calculateInvestmentSell>;
    try {
      calculation = trade.type === "buy"
        ? calculateInvestmentBuy(
            { unitsMicro: asset.unitsMicro, costBasis: asset.costBasis, realizedPl: asset.realizedPl },
            trade,
          )
        : calculateInvestmentSell(
            { unitsMicro: asset.unitsMicro, costBasis: asset.costBasis, realizedPl: asset.realizedPl },
            trade,
          );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaksi investasi tidak valid.";
      const code = message.includes("melebihi unit") ? "INSUFFICIENT_UNITS" : "INVALID_INVESTMENT_TRADE";
      throw new ApiError(code === "INSUFFICIENT_UNITS" ? 409 : 400, code, message);
    }

    const investmentTransactionId = makeId("invtx");
    const linkedCashTransactionId = makeId("inv-cash");
    const linkedAdjustmentTransactionId = calculation.realizedPl === 0 ? null : makeId("inv-pl");
    const now = nowIso();
    const cashDelta = trade.type === "buy" ? -calculation.netAmount : calculation.netAmount;
    const investmentDelta = trade.type === "buy"
      ? calculation.netAmount
      : -(calculation as ReturnType<typeof calculateInvestmentSell>).costBasisSold;
    if (cashAccount.balance + cashDelta < 0) {
      throw new ApiError(409, "INSUFFICIENT_BALANCE", "Saldo akun kas tidak cukup untuk pembelian investasi.");
    }
    if (investmentAccount.balance + investmentDelta < 0) {
      throw new ApiError(409, "INVESTMENT_LEDGER_CONFLICT", "Saldo buku investasi tidak cukup. Rekonsiliasi akun investasi sebelum menjual.");
    }

    const d1 = getD1();
    const guardInsert = d1.prepare(
      `INSERT INTO investment_transactions
         (id, workspace_id, asset_id, account_id, date, type, units_micro,
          price_per_unit, gross_amount, fee, tax, net_amount, average_cost_after,
          remaining_units_micro, realized_pl, linked_cash_transaction_id,
          linked_adjustment_transaction_id, note, request_id, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM investment_positions p
       JOIN investment_assets a ON a.id = p.asset_id AND a.workspace_id = p.workspace_id
       JOIN accounts cash ON cash.id = ? AND cash.workspace_id = p.workspace_id AND cash.active = 1
       JOIN accounts book ON book.id = a.account_id AND book.workspace_id = p.workspace_id AND book.active = 1
       WHERE p.workspace_id = ? AND p.asset_id = ? AND p.units_micro = ?
         AND p.cost_basis = ? AND p.realized_pl = ? AND p.updated_at = ?
         AND a.active = 1 AND cash.balance = ? AND book.balance = ?
         AND cash.balance + ? >= 0 AND book.balance + ? >= 0`,
    ).bind(
      investmentTransactionId, workspaceId, asset.id, cashAccount.id, trade.date, trade.type,
      trade.unitsMicro, trade.pricePerUnit, calculation.grossAmount, calculation.fee,
      calculation.tax, calculation.netAmount, calculation.averageCostAfter,
      calculation.remainingUnitsMicro, calculation.realizedPl, linkedCashTransactionId,
      linkedAdjustmentTransactionId, trade.note, requestId, now, now,
      cashAccount.id, workspaceId, asset.id, asset.unitsMicro, asset.costBasis,
      asset.realizedPl, asset.positionUpdatedAt, cashAccount.balance,
      investmentAccount.balance, cashDelta, investmentDelta,
    );

    const statements: D1PreparedStatement[] = [
      guardInsert,
      d1.prepare(
        `UPDATE investment_positions
         SET units_micro = ?, cost_basis = ?, realized_pl = ?, updated_at = ?
         WHERE workspace_id = ? AND asset_id = ? AND units_micro = ?
           AND cost_basis = ? AND realized_pl = ? AND updated_at = ?
           AND EXISTS (SELECT 1 FROM investment_transactions WHERE workspace_id = ? AND id = ?)`,
      ).bind(
        calculation.remainingUnitsMicro, calculation.costBasis, calculation.realizedPlTotal,
        now, workspaceId, asset.id, asset.unitsMicro, asset.costBasis, asset.realizedPl,
        asset.positionUpdatedAt, workspaceId, investmentTransactionId,
      ),
      d1.prepare(
        `UPDATE investment_assets
         SET latest_price_cache = CASE WHEN manual_price IS NULL THEN ? ELSE latest_price_cache END,
             price_source = CASE WHEN manual_price IS NULL THEN 'last_trade' ELSE price_source END,
             price_status = CASE WHEN manual_price IS NULL THEN 'delayed' ELSE price_status END,
             price_updated_at = CASE WHEN manual_price IS NULL THEN ? ELSE price_updated_at END,
             updated_at = ?
         WHERE workspace_id = ? AND id = ?
           AND EXISTS (SELECT 1 FROM investment_transactions WHERE workspace_id = ? AND id = ?)`,
      ).bind(trade.pricePerUnit, now, now, workspaceId, asset.id, workspaceId, investmentTransactionId),
      d1.prepare(
        `UPDATE accounts SET balance = balance + ?, updated_at = ?
         WHERE workspace_id = ? AND id = ? AND balance = ?
           AND EXISTS (SELECT 1 FROM investment_transactions WHERE workspace_id = ? AND id = ?)`,
      ).bind(cashDelta, now, workspaceId, cashAccount.id, cashAccount.balance, workspaceId, investmentTransactionId),
      d1.prepare(
        `UPDATE accounts SET balance = balance + ?, updated_at = ?
         WHERE workspace_id = ? AND id = ? AND balance = ?
           AND EXISTS (SELECT 1 FROM investment_transactions WHERE workspace_id = ? AND id = ?)`,
      ).bind(investmentDelta, now, workspaceId, investmentAccount.id, investmentAccount.balance, workspaceId, investmentTransactionId),
      d1.prepare(
        `INSERT INTO transactions
           (id, workspace_id, type, date, title, merchant, category, account_id,
            destination_account_id, transfer_group_id, amount, status, idempotency_key,
            created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, 'Investasi', ?, ?, ?, ?, 'completed', ?, ?, ?
         FROM investment_transactions WHERE workspace_id = ? AND id = ?`,
      ).bind(
        linkedCashTransactionId, workspaceId,
        trade.type === "buy" ? "investment_buy" : "transfer", trade.date,
        `${trade.type === "buy" ? "Beli" : "Jual"} ${asset.name}`, asset.name,
        trade.type === "buy" ? cashAccount.id : investmentAccount.id,
        trade.type === "buy" ? investmentAccount.id : cashAccount.id,
        linkedCashTransactionId, calculation.netAmount,
        `investment:${requestId}:cash`, now, now, workspaceId, investmentTransactionId,
      ),
    ];

    if (linkedAdjustmentTransactionId) {
      statements.push(
        d1.prepare(
          `INSERT INTO transactions
             (id, workspace_id, type, date, title, merchant, category, account_id,
              destination_account_id, transfer_group_id, amount, status, idempotency_key,
              created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, 'Penyesuaian Saldo', ?, NULL, NULL, ?, 'completed', ?, ?, ?
           FROM investment_transactions WHERE workspace_id = ? AND id = ?`,
        ).bind(
          linkedAdjustmentTransactionId, workspaceId,
          calculation.realizedPl > 0 ? "adjustment_in" : "adjustment_out", trade.date,
          `${calculation.realizedPl > 0 ? "Realisasi untung" : "Realisasi rugi"} ${asset.name}`,
          asset.name, investmentAccount.id, Math.abs(calculation.realizedPl),
          `investment:${requestId}:pl`, now, now, workspaceId, investmentTransactionId,
        ),
      );
    }

    statements.push(
      auditStatementWhenTransactionExists(d1, {
        workspaceId,
        action: "transaction.create",
        entityType: "transaction",
        entityId: linkedCashTransactionId,
        requestId: `investment:${requestId}:cash`,
        details: { source: "investment", investmentTransactionId, assetId: asset.id },
        createdAt: now,
      }, linkedCashTransactionId),
    );
    if (linkedAdjustmentTransactionId) {
      statements.push(
        auditStatementWhenTransactionExists(d1, {
          workspaceId,
          action: "transaction.create",
          entityType: "transaction",
          entityId: linkedAdjustmentTransactionId,
          requestId: `investment:${requestId}:pl`,
          details: { source: "investment", investmentTransactionId, assetId: asset.id },
          createdAt: now,
        }, linkedAdjustmentTransactionId),
      );
    }
    statements.push(
      auditStatementWhenInvestmentTransactionExists(d1, {
        workspaceId,
        action: `investment.${trade.type}`,
        entityType: "investment_transaction",
        entityId: investmentTransactionId,
        requestId,
        after: {
          assetId: asset.id,
          accountId: cashAccount.id,
          units: trade.units,
          pricePerUnit: trade.pricePerUnit,
          grossAmount: calculation.grossAmount,
          fee: calculation.fee,
          tax: calculation.tax,
          netAmount: calculation.netAmount,
          realizedPl: calculation.realizedPl,
          remainingUnitsAfter: calculation.remainingUnitsMicro,
        },
        createdAt: now,
      }, investmentTransactionId),
    );

    const results = await d1.batch(statements);
    if (Number(results[0].meta.changes ?? 0) === 0) {
      const concurrentReplay = await getInvestmentTransactionByRequest(workspaceId, requestId);
      if (concurrentReplay) {
        const replayAsset = await getInvestmentAssetRow(workspaceId, asset.id);
        return Response.json({
          transaction: serializeInvestmentTransaction(concurrentReplay),
          asset: replayAsset ? serializeInvestmentAsset(replayAsset) : null,
          replayed: true,
        });
      }
      throw new ApiError(409, "STALE_INVESTMENT", "Posisi atau saldo akun sudah berubah. Muat ulang data lalu coba lagi.");
    }
    const [created, updatedAsset] = await Promise.all([
      getInvestmentTransactionByRequest(workspaceId, requestId),
      getInvestmentAssetRow(workspaceId, asset.id),
    ]);
    if (!created || !updatedAsset) throw new ApiError(500, "CREATE_FAILED", "Transaksi investasi tidak dapat dimuat setelah disimpan.");
    return Response.json({
      transaction: serializeInvestmentTransaction(created),
      asset: serializeInvestmentAsset(updatedAsset),
      replayed: false,
    }, { status: 201 });
  } catch (error) {
    if (workspaceId && requestId && error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      const replay = await getInvestmentTransactionByRequest(workspaceId, requestId);
      if (replay) {
        const asset = await getInvestmentAssetRow(workspaceId, replay.assetId);
        return Response.json({ transaction: serializeInvestmentTransaction(replay), asset: asset ? serializeInvestmentAsset(asset) : null, replayed: true });
      }
    }
    return routeError(error);
  }
}
