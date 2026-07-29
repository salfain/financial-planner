const NOTIFICATION_DEFAULTS = Object.freeze({
  enabled: true,
  billReminderDays: [7, 3, 1, 0],
  budgetWarningPercent: 75,
  backupWarningDays: 7,
  goalWarningDays: 30,
  emailEnabled: false,
  emailAddress: '',
  weeklyDigest: true
});

function notificationNumberSetting_(key, fallback, allowed) {
  const value = Number(settingValue_(key, fallback));
  return allowed.indexOf(value) >= 0 ? value : fallback;
}

function notificationDays_(value, fallback) {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); }
    catch (error) { source = source.split(','); }
  }
  if (!Array.isArray(source)) source = fallback;
  const days = [];
  source.forEach(function(item) {
    const day = Number(item);
    if ([7, 3, 1, 0].indexOf(day) >= 0 && days.indexOf(day) === -1) days.push(day);
  });
  return (days.length ? days : fallback.slice()).sort(function(a, b) { return b - a; });
}

function notificationSettingsGs_() {
  return {
    enabled: truthy_(settingValue_('notification_enabled', 'true')),
    billReminderDays: notificationDays_(settingValue_('notification_bill_days', '[7,3,1,0]'), NOTIFICATION_DEFAULTS.billReminderDays),
    budgetWarningPercent: notificationNumberSetting_('notification_budget_percent', 75, [75, 90]),
    backupWarningDays: notificationNumberSetting_('notification_backup_days', 7, [7, 14, 30]),
    goalWarningDays: notificationNumberSetting_('notification_goal_days', 30, [7, 30, 60]),
    emailEnabled: truthy_(settingValue_('notification_email_enabled', 'false')),
    emailAddress: String(settingValue_('notification_email_address', '')),
    weeklyDigest: truthy_(settingValue_('notification_weekly_digest', 'true'))
  };
}

function notificationDaysBetween_(today, eventDate) {
  return Math.round((new Date(eventDate + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000);
}

function notificationRecurringBillDate_(dueDate, period) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !/^\d{4}-\d{2}$/.test(period)) return dueDate;
  const parts = period.split('-');
  const lastDay = new Date(Date.UTC(Number(parts[0]), Number(parts[1]), 0)).getUTCDate();
  return period + '-' + String(Math.min(Number(dueDate.slice(8, 10)), lastDay)).padStart(2, '0');
}

function notificationPriority_(severity) { return severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2; }

function notificationStateMap_() {
  const result = {};
  rowsAsObjects_(VINN_CONFIG.SHEETS.NOTIFICATION_STATES).forEach(function(row) { result[String(row.notification_key)] = row; });
  return result;
}

function financeNotificationsGs_(period, today, settings) {
  if (!settings.enabled) return [];
  const notifications = [];
  rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS).forEach(function(bill) {
    const dueDate = String(bill.due_date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || String(bill.status || 'active') !== 'active' || String(bill.last_paid_period || '') === period || dueDate.slice(0, 7) > period) return;
    const eventDate = notificationRecurringBillDate_(dueDate, period);
    const remaining = notificationDaysBetween_(today, eventDate);
    const billDays = notificationDays_(bill.reminder_days, settings.billReminderDays).filter(function(day) { return settings.billReminderDays.indexOf(day) >= 0; });
    const maxReminder = billDays.length ? Math.max.apply(null, billDays) : -1;
    if (remaining >= 0 && (maxReminder < 0 || remaining > maxReminder)) return;
    notifications.push({
      id: 'bill:' + String(bill.id) + ':' + period,
      type: remaining < 0 ? 'bill_overdue' : 'bill_due',
      severity: remaining <= 0 ? 'critical' : remaining <= 1 ? 'warning' : 'info',
      title: remaining < 0 ? String(bill.name) + ' terlambat' : remaining === 0 ? String(bill.name) + ' jatuh tempo hari ini' : String(bill.name) + ' segera jatuh tempo',
      message: remaining < 0 ? 'Terlambat ' + Math.abs(remaining) + ' hari. Bayar dari akun sumber agar tidak tercatat ganda.' : 'Jatuh tempo dalam ' + remaining + ' hari pada ' + eventDate + '.',
      actionPage: 'bills', eventDate: eventDate, read: false, dismissed: false
    });
  });

  const transactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
    return !row.deleted_at && String(row.status || 'completed') === 'completed' && String(row.date || '').slice(0, 7) === period;
  });
  rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS).filter(function(row) { return String(row.month || '') === period; }).forEach(function(budget) {
    const spent = transactions.filter(function(row) { return String(row.type) === 'expense'; }).reduce(function(sum, row) {
      const splits = parseJsonObject_(row.splits_json);
      if (Array.isArray(splits) && splits.length) return sum + splits.filter(function(split) { return String(split.category) === String(budget.category); }).reduce(function(splitSum, split) { return splitSum + Number(split.amount || 0); }, 0);
      return String(row.category) === String(budget.category) ? sum + Number(row.amount || 0) : sum;
    }, 0);
    const limit = Number(budget.limit_amount || 0);
    const percent = limit > 0 ? spent / limit * 100 : 0;
    if (percent < settings.budgetWarningPercent) return;
    notifications.push({
      id: 'budget:' + String(budget.id) + ':' + period, type: 'budget', severity: percent > 100 ? 'critical' : percent >= 90 ? 'warning' : 'info',
      title: percent > 100 ? 'Anggaran ' + String(budget.category) + ' terlampaui' : 'Anggaran ' + String(budget.category) + ' perlu dipantau',
      message: percent.toFixed(1) + '% dari batas bulanan sudah terpakai.', actionPage: 'budgets', eventDate: period + '-01', read: false, dismissed: false
    });
  });

  rowsAsObjects_(VINN_CONFIG.SHEETS.GOALS).forEach(function(goal) {
    if (Number(goal.current_amount || 0) >= Number(goal.target_amount || 0)) return;
    const deadline = String(goal.deadline || '');
    const remaining = notificationDaysBetween_(today, deadline);
    if (remaining > settings.goalWarningDays) return;
    notifications.push({
      id: 'goal:' + String(goal.id) + ':' + deadline, type: 'goal', severity: remaining < 0 ? 'critical' : remaining <= 7 ? 'warning' : 'info',
      title: remaining < 0 ? 'Deadline ' + String(goal.name) + ' terlewat' : 'Deadline ' + String(goal.name) + ' mendekat',
      message: remaining < 0 ? 'Target belum tercapai dan terlambat ' + Math.abs(remaining) + ' hari.' : remaining + ' hari tersisa untuk mencapai target.',
      actionPage: 'goals', eventDate: deadline, read: false, dismissed: false
    });
  });

  rowsAsObjects_(VINN_CONFIG.SHEETS.ASSETS).filter(function(asset) {
    return accountIsActive_({ is_active: asset.is_active }) && String(asset.price_status || 'unavailable') === 'unavailable';
  }).forEach(function(asset) {
    notifications.push({ id: 'investment:' + String(asset.id) + ':price', type: 'investment_price', severity: 'warning', title: 'Harga ' + String(asset.ticker) + ' belum tersedia', message: 'Tambahkan harga manual agar nilai portofolio dan net worth tetap terukur.', actionPage: 'investments', eventDate: null, read: false, dismissed: false });
  });

  const backups = portabilityHistory_().filter(function(item) { return item.kind === 'backup' && item.status === 'ready'; }).sort(function(a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  const latestBackupAt = backups.length ? String(backups[0].createdAt) : '';
  const backupAge = latestBackupAt ? Math.max(0, Math.floor((new Date(today + 'T00:00:00Z').getTime() - new Date(latestBackupAt).getTime()) / 86400000)) : Infinity;
  if (!latestBackupAt || backupAge >= settings.backupWarningDays) notifications.push({
    id: 'backup:' + (latestBackupAt ? latestBackupAt.slice(0, 10) : 'missing'), type: 'backup', severity: !latestBackupAt || backupAge >= settings.backupWarningDays * 2 ? 'critical' : 'warning',
    title: latestBackupAt ? 'Backup sudah terlalu lama' : 'Belum ada backup lengkap', message: latestBackupAt ? 'Backup terakhir dibuat ' + backupAge + ' hari lalu.' : 'Buat backup pertama untuk melindungi data keuangan.',
    actionPage: 'settings', eventDate: latestBackupAt ? latestBackupAt.slice(0, 10) : null, read: false, dismissed: false
  });
  return notifications.sort(function(a, b) { return notificationPriority_(a.severity) - notificationPriority_(b.severity) || String(a.eventDate || '9999').localeCompare(String(b.eventDate || '9999')) || a.id.localeCompare(b.id); });
}

function apiNotificationOverview(payload) {
  try {
    const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(payload.period || '')) ? String(payload.period) : Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
    const today = Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const settings = notificationSettingsGs_();
    const states = notificationStateMap_();
    const notifications = financeNotificationsGs_(period, today, settings).map(function(notification) {
      const state = states[notification.id];
      notification.read = Boolean(state && state.read_at);
      notification.dismissed = Boolean(state && state.dismissed_at);
      return notification;
    }).filter(function(notification) { return !notification.dismissed; });
    return ok_({ notifications: notifications, unreadCount: notifications.filter(function(item) { return !item.read; }).length, generatedAt: nowIso_(), settings: settings });
  } catch (error) { return fail_(error); }
}

function apiUpdateNotificationSettings(payload) {
  try {
    const settings = {
      enabled: payload.enabled !== false,
      billReminderDays: notificationDays_(payload.billReminderDays, []),
      budgetWarningPercent: Number(payload.budgetWarningPercent),
      backupWarningDays: Number(payload.backupWarningDays),
      goalWarningDays: Number(payload.goalWarningDays)
      ,emailEnabled: payload.emailEnabled === true
      ,emailAddress: String(payload.emailAddress || '').trim().slice(0, 160)
      ,weeklyDigest: payload.weeklyDigest !== false
    };
    if (settings.emailEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.emailAddress)) throw createError_('INVALID_NOTIFICATION_EMAIL', 'Alamat email notifikasi tidak valid.');
    if (!settings.billReminderDays.length || [75, 90].indexOf(settings.budgetWarningPercent) === -1 || [7, 14, 30].indexOf(settings.backupWarningDays) === -1 || [7, 30, 60].indexOf(settings.goalWarningDays) === -1) throw createError_('INVALID_NOTIFICATION_SETTINGS', 'Pengaturan reminder tidak valid.');
    upsertSetting_('notification_enabled', settings.enabled);
    upsertSetting_('notification_bill_days', JSON.stringify(settings.billReminderDays));
    upsertSetting_('notification_budget_percent', settings.budgetWarningPercent);
    upsertSetting_('notification_backup_days', settings.backupWarningDays);
    upsertSetting_('notification_goal_days', settings.goalWarningDays);
    upsertSetting_('notification_email_enabled', settings.emailEnabled);
    upsertSetting_('notification_email_address', settings.emailAddress);
    upsertSetting_('notification_weekly_digest', settings.weeklyDigest);
    configureFinanceNotificationTrigger_(settings.emailEnabled);
    audit_('UPDATE_NOTIFICATION_SETTINGS', 'notifications', '', id_('req'), settings);
    return ok_({ settings: settings });
  } catch (error) { return fail_(error); }
}

function configureFinanceNotificationTrigger_(enabled) {
  ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === 'sendFinanceNotificationEmail'; }).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  if (enabled) ScriptApp.newTrigger('sendFinanceNotificationEmail').timeBased().everyDays(1).atHour(7).create();
}

function sendFinanceNotificationEmail() {
  const settings = notificationSettingsGs_();
  if (!settings.enabled || !settings.emailEnabled || !settings.emailAddress) return;
  const now = new Date();
  const period = Utilities.formatDate(now, VINN_CONFIG.TIMEZONE, 'yyyy-MM');
  const today = Utilities.formatDate(now, VINN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const isWeeklyDay = Number(Utilities.formatDate(now, VINN_CONFIG.TIMEZONE, 'u')) === 1;
  const items = financeNotificationsGs_(period, today, settings).filter(function(item) {
    return item.severity === 'critical' || item.type === 'bill_due' || (settings.weeklyDigest && isWeeklyDay);
  });
  if (!items.length) return;
  const signature = today + ':' + items.map(function(item) { return item.id; }).join('|');
  if (String(settingValue_('notification_email_last_signature', '')) === signature) return;
  const rows = items.slice(0, 20).map(function(item) {
    return '<li style="margin:0 0 12px"><strong>' + escapeHtml_(item.title) + '</strong><br><span style="color:#5f6f69">' + escapeHtml_(item.message) + '</span></li>';
  }).join('');
  const subject = (items.some(function(item) { return item.severity === 'critical'; }) ? '[Perlu perhatian] ' : '') + 'Ringkasan Financial Planner';
  const textBody = items.map(function(item) { return '- ' + item.title + ': ' + item.message; }).join('\n');
  MailApp.sendEmail({ to: settings.emailAddress, subject: subject, body: textBody, htmlBody: '<div style="font-family:Arial,sans-serif;color:#12231d"><h2>Financial Planner</h2><p>Berikut pengingat dari data keuangan Anda:</p><ul>' + rows + '</ul><p style="color:#7a8984;font-size:12px">Email ini informatif dan tidak melakukan pembayaran otomatis.</p></div>', name: 'Financial Planner' });
  upsertSetting_('notification_email_last_signature', signature);
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, function(character) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]; });
}

function apiUpdateNotificationState(payload) {
  try {
    const rawIds = Array.isArray(payload.notificationIds) ? payload.notificationIds.map(String) : [];
    const ids = rawIds.filter(function(id, index, values) { return values.indexOf(id) === index; });
    const action = String(payload.action || '');
    if (!ids.length || ids.length > 50 || rawIds.some(function(id) { return !/^[A-Za-z0-9:_-]{1,180}$/.test(id); }) || ['read', 'unread', 'dismiss', 'restore'].indexOf(action) === -1) throw createError_('INVALID_NOTIFICATION_STATE', 'Perubahan status notifikasi tidak valid.');
    const now = nowIso_();
    ids.forEach(function(notificationKey) {
      const existing = rowsAsObjects_(VINN_CONFIG.SHEETS.NOTIFICATION_STATES).find(function(row) { return String(row.notification_key) === notificationKey; });
      const record = existing ? Object.assign({}, existing) : { notification_key: notificationKey, read_at: '', dismissed_at: '', created_at: now, updated_at: now };
      delete record._row;
      if (action === 'read' || action === 'dismiss') record.read_at = now;
      if (action === 'unread') record.read_at = '';
      if (action === 'dismiss') record.dismissed_at = now;
      if (action === 'restore') record.dismissed_at = '';
      record.updated_at = now;
      if (existing) updateObjectRow_(VINN_CONFIG.SHEETS.NOTIFICATION_STATES, existing._row, record);
      else appendObjects_(VINN_CONFIG.SHEETS.NOTIFICATION_STATES, [record]);
    });
    return ok_({ updated: ids.length, action: action });
  } catch (error) { return fail_(error); }
}
