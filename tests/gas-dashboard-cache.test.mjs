import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const utils = await readFile(new URL("apps-script/Utils.gs", root), "utf8");

function createContext() {
  const values = new Map();
  const properties = new Map([["VINN_CACHE_VERSION", "cache-v1"]]);
  const warnings = [];
  const context = vm.createContext({
    values,
    warnings,
    VINN_CONFIG: { CACHE_SECONDS: 300, TIMEZONE: "Asia/Jakarta" },
    console: { warn: (message) => warnings.push(String(message)) },
    PropertiesService: {
      getDocumentProperties: () => ({
        getProperty: (key) => properties.get(key) ?? null,
        setProperty: (key, value) => properties.set(key, value),
      }),
    },
    CacheService: {
      getDocumentCache: () => ({
        get: (key) => values.get(key) ?? null,
        put: (key, value) => values.set(key, value),
        remove: (key) => values.delete(key),
      }),
    },
    Utilities: {
      formatDate: () => "2026-08",
      getUuid: () => "cache-v2",
    },
  });
  new vm.Script(utils, { filename: "apps-script/Utils.gs" }).runInContext(context);
  return context;
}

test("cache dashboard kecil tetap disimpan dan dibaca", () => {
  const context = createContext();
  context.cache = context.CacheService.getDocumentCache();
  context.snapshot = { transactions: [{ id: "tx-1", notes: "Belanja" }] };

  assert.equal(vm.runInContext('writeDashboardCache_(cache, "dashboard:test", snapshot)', context), true);
  assert.equal(
    vm.runInContext('readDashboardCache_(cache, "dashboard:test").transactions[0].id', context),
    "tx-1",
  );
});

test("payload di atas batas cache dilewati tanpa menggagalkan bootstrap", () => {
  const context = createContext();
  context.cache = context.CacheService.getDocumentCache();
  context.snapshot = { notes: "€".repeat(40_000) };

  assert.equal(vm.runInContext('writeDashboardCache_(cache, "dashboard:large", snapshot)', context), false);
  assert.equal(context.values.has("dashboard:large"), false);
  assert.match(context.warnings.at(-1), /payload berukuran/);
});

test("penolakan CacheService tidak diteruskan sebagai error aplikasi", () => {
  const context = createContext();
  context.rejectingCache = {
    get: () => null,
    put: () => { throw new Error("Argument too large: value"); },
    remove: () => undefined,
  };
  context.snapshot = { configured: true };

  assert.equal(vm.runInContext('writeDashboardCache_(rejectingCache, "dashboard:test", snapshot)', context), false);
  assert.match(context.warnings.at(-1), /Argument too large: value/);
});

test("cache rusak dibuang dan dihitung ulang", () => {
  const context = createContext();
  context.values.set("dashboard:broken", "{not-json");
  context.cache = context.CacheService.getDocumentCache();

  assert.equal(vm.runInContext('readDashboardCache_(cache, "dashboard:broken")', context), null);
  assert.equal(context.values.has("dashboard:broken"), false);
});

test("kunci cache dashboard memakai versi dan bulan aktif", () => {
  const context = createContext();
  assert.equal(
    vm.runInContext('dashboardCacheKey_("2026-08")', context),
    "dashboard:cache-v1:2026-08",
  );
});
