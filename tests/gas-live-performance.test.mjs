import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../apps-script/PerformanceService.gs", import.meta.url), "utf8");

test("benchmark live memakai sheet sementara dan selalu membersihkannya", () => {
  assert.match(source, /PERFORMANCE_BENCHMARK_ROWS = 10000/);
  assert.match(source, /workbook\.insertSheet/);
  assert.match(source, /workbook\.deleteSheet\(temporarySheet\)/);
  assert.match(source, /runFinancialPlannerPerformanceBenchmark/);
  assert.match(source, /getLastFinancialPlannerPerformanceBenchmark/);
});

test("benchmark mengukur bootstrap, pencarian, baca, tulis, dan simpan", () => {
  for (const metric of [
    "coldBootstrapMs", "warmBootstrapMs", "liveSearchMs",
    "temporaryWrite10000Ms", "temporaryRead10000Ms",
    "temporarySearch10000Ms", "temporarySaveMs",
  ]) assert.match(source, new RegExp(metric));
  assert.match(source, /temporary_sheet_deleted/);
});
