const CATEGORY_RULES_SETTING_KEY = 'category_rules';

function normalizeCategoryRuleGs_(value) {
  const rule = value && typeof value === 'object' ? value : {};
  return {
    id: String(rule.id || id_('rule')),
    keyword: String(rule.keyword || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    category: String(rule.category || '').trim().slice(0, 100),
    transactionType: String(rule.transactionType || rule.transaction_type || 'expense') === 'income' ? 'income' : 'expense',
    matchType: ['contains', 'starts_with', 'exact'].indexOf(String(rule.matchType || rule.match_type)) >= 0 ? String(rule.matchType || rule.match_type) : 'contains',
    priority: Math.max(0, Math.min(1000, Math.round(Number(rule.priority === undefined ? 100 : rule.priority) || 0))),
    active: rule.active === undefined ? true : truthy_(rule.active),
    createdAt: String(rule.createdAt || rule.created_at || nowIso_()),
    updatedAt: String(rule.updatedAt || rule.updated_at || nowIso_())
  };
}

function normalizeCategoryRulesGs_(value) {
  const parsed = parseJsonObject_(value || '[]');
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeCategoryRuleGs_).filter(function(rule) { return rule.keyword && rule.category; })
    .sort(function(a, b) { return Number(b.active) - Number(a.active) || b.priority - a.priority || a.keyword.localeCompare(b.keyword); });
}

function categoryRulesGs_() {
  return normalizeCategoryRulesGs_(settingValue_(CATEGORY_RULES_SETTING_KEY, '[]'));
}

function saveCategoryRulesGs_(rules) {
  upsertSetting_(CATEGORY_RULES_SETTING_KEY, JSON.stringify((rules || []).map(normalizeCategoryRuleGs_)));
  invalidateDashboard_();
}

function normalizeCategoryRuleTextGs_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findCategoryRuleGs_(description, transactionType) {
  const source = normalizeCategoryRuleTextGs_(description);
  return categoryRulesGs_().filter(function(rule) {
    if (!rule.active || rule.transactionType !== transactionType) return false;
    const keyword = normalizeCategoryRuleTextGs_(rule.keyword);
    if (!source || !keyword) return false;
    if (rule.matchType === 'exact') return source === keyword;
    if (rule.matchType === 'starts_with') return source.indexOf(keyword) === 0;
    return source.indexOf(keyword) >= 0;
  }).sort(function(a, b) { return b.priority - a.priority || b.keyword.length - a.keyword.length; })[0] || null;
}

function applyCategoryRuleGs_(transaction) {
  if (!transaction || (Array.isArray(transaction.splits) && transaction.splits.length)) return transaction;
  const type = String(transaction.type || '') === 'income' ? 'income' : 'expense';
  const rule = findCategoryRuleGs_([transaction.title, transaction.merchant, transaction.notes, transaction.location].join(' '), type);
  if (!rule) return transaction;
  return Object.assign({}, transaction, { category: rule.category, category_rule_id: rule.id });
}

function validateCategoryRuleGs_(payload, existingId) {
  const rule = normalizeCategoryRuleGs_(Object.assign({}, payload || {}, { id: existingId || payload.id || id_('rule') }));
  if (rule.keyword.length < 2) throw createError_('INVALID_CATEGORY_RULE', 'Kata kunci minimal dua karakter.');
  const category = categoryRows_().find(function(item) {
    return item.active && String(item.name).toLowerCase() === rule.category.toLowerCase() && String(item.type) === rule.transactionType;
  });
  if (!category) throw createError_('CATEGORY_NOT_FOUND', 'Kategori aturan tidak ditemukan atau jenisnya tidak cocok.');
  return rule;
}

function apiCategoryRules() {
  try { return ok_({ rules: categoryRulesGs_() }); }
  catch (error) { return fail_(error); }
}

function apiCreateCategoryRule(payload) {
  const requestId = requireRequestId_(payload);
  try {
    const rules = categoryRulesGs_();
    const next = validateCategoryRuleGs_(payload);
    if (rules.some(function(rule) { return rule.transactionType === next.transactionType && rule.keyword.toLowerCase() === next.keyword.toLowerCase(); })) {
      throw createError_('CATEGORY_RULE_EXISTS', 'Kata kunci tersebut sudah memiliki aturan untuk jenis transaksi yang sama.');
    }
    rules.push(next);
    saveCategoryRulesGs_(rules);
    audit_('CREATE_CATEGORY_RULE', 'category_rules', next.id, requestId, { after: next });
    return ok_({ rule: next }, requestId);
  } catch (error) { return fail_(error, requestId); }
}

function apiUpdateCategoryRule(payload) {
  const requestId = requireRequestId_(payload);
  try {
    const ruleId = String(payload.ruleId || '').trim();
    const rules = categoryRulesGs_();
    const index = rules.findIndex(function(rule) { return rule.id === ruleId; });
    if (index < 0) throw createError_('NOT_FOUND', 'Aturan kategori tidak ditemukan.');
    const before = rules[index];
    const next = validateCategoryRuleGs_(Object.assign({}, payload, { createdAt: before.createdAt, updatedAt: nowIso_() }), ruleId);
    if (rules.some(function(rule, rowIndex) { return rowIndex !== index && rule.transactionType === next.transactionType && rule.keyword.toLowerCase() === next.keyword.toLowerCase(); })) {
      throw createError_('CATEGORY_RULE_EXISTS', 'Kata kunci tersebut sudah memiliki aturan untuk jenis transaksi yang sama.');
    }
    rules[index] = next;
    saveCategoryRulesGs_(rules);
    audit_('UPDATE_CATEGORY_RULE', 'category_rules', next.id, requestId, { before: before, after: next });
    return ok_({ rule: next }, requestId);
  } catch (error) { return fail_(error, requestId); }
}

function apiDeleteCategoryRule(payload) {
  const requestId = requireRequestId_(payload);
  try {
    const ruleId = String(payload.ruleId || '').trim();
    const rules = categoryRulesGs_();
    const before = rules.find(function(rule) { return rule.id === ruleId; });
    if (!before) return ok_({ deleted: true, ruleId: ruleId, replayed: true }, requestId);
    saveCategoryRulesGs_(rules.filter(function(rule) { return rule.id !== ruleId; }));
    audit_('DELETE_CATEGORY_RULE', 'category_rules', ruleId, requestId, { before: before });
    return ok_({ deleted: true, ruleId: ruleId }, requestId);
  } catch (error) { return fail_(error, requestId); }
}
