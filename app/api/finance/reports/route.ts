import { ApiError, booleanValue, monthPeriod, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../_lib/api";
import { listExports, saveReport } from "../../_lib/portability";

const reportSections = new Set(["summary", "cashflow", "categories", "accounts", "budgets", "bills", "goals", "roadmap", "investments"]);

export async function GET(request: Request) {
  try {
    return Response.json({ reports: await listExports(resolveWorkspaceId(request), "report") });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    if (!Array.isArray(payload.sections) || !payload.sections.length || payload.sections.length > reportSections.size
      || payload.sections.some((item) => typeof item !== "string" || !reportSections.has(item))
      || new Set(payload.sections).size !== payload.sections.length) {
      throw new ApiError(400, "INVALID_REPORT_SECTIONS", "Bagian laporan tidak valid atau terduplikasi.");
    }
    const pageCount = Number(payload.pageCount);
    if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 100) {
      throw new ApiError(400, "INVALID_PAGE_COUNT", "Jumlah halaman PDF tidak valid.");
    }
    return Response.json(await saveReport(workspaceId, {
      filename: requiredString(payload, "filename", 160),
      contentBase64: requiredString(payload, "contentBase64", 12_000_000),
      period: monthPeriod(payload, "period"),
      sections: payload.sections as string[],
      privacy: booleanValue(payload, "privacy"),
      pageCount,
    }), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
