import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FEATURE_PREFERENCES,
  isOptionalFeatureEnabled,
  normalizeFeaturePreferences,
} from "../lib/feature-preferences";

test("semua fitur opsional aktif secara default untuk instalasi lama", () => {
  assert.deepEqual(normalizeFeaturePreferences(undefined), DEFAULT_FEATURE_PREFERENCES);
  assert.equal(Object.values(DEFAULT_FEATURE_PREFERENCES).every(Boolean), true);
});

test("pilihan fitur hanya menerima kunci yang dikenal", () => {
  const result = normalizeFeaturePreferences({
    budgets: false,
    assistant: false,
    unknownFeature: false,
  });
  assert.equal(result.budgets, false);
  assert.equal(result.assistant, false);
  assert.equal(result.goals, true);
  assert.equal("unknownFeature" in result, false);
});

test("fitur inti tidak dapat dimatikan oleh preferensi menu", () => {
  const preferences = normalizeFeaturePreferences({ budgets: false });
  assert.equal(isOptionalFeatureEnabled(preferences, "budgets"), false);
  assert.equal(isOptionalFeatureEnabled(preferences, "transactions"), true);
  assert.equal(isOptionalFeatureEnabled(preferences, "accounts"), true);
  assert.equal(isOptionalFeatureEnabled(preferences, "settings"), true);
});
