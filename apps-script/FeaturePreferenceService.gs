const FINANCIAL_PLANNER_OPTIONAL_FEATURES = Object.freeze([
  'budgets', 'goals', 'funds', 'roadmap', 'forecast', 'emergency',
  'bills', 'calendar', 'recurring', 'debts', 'investments', 'review',
  'reports', 'assistant'
]);

function normalizeFeaturePreferencesGs_(value) {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch (error) { source = {}; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) source = {};
  return FINANCIAL_PLANNER_OPTIONAL_FEATURES.reduce(function(result, key) {
    result[key] = source[key] === undefined ? true : source[key] === true;
    return result;
  }, {});
}

function featurePreferences_() {
  return normalizeFeaturePreferencesGs_(settingValue_('feature_preferences', ''));
}

function apiUpdateFeaturePreferences(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const previous = featurePreferences_();
      const preferences = normalizeFeaturePreferencesGs_(payload && payload.preferences);
      upsertSetting_('feature_preferences', JSON.stringify(preferences));
      audit_('UPDATE_FEATURE_PREFERENCES', 'settings', 'features', requestId, {
        before: previous,
        after: preferences
      });
      invalidateDashboard_();
      return ok_({ preferences: preferences }, requestId);
    });
  } catch (error) {
    return fail_(error, requestId);
  }
}
