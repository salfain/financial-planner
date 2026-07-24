const DEMO_WHATSAPP_PROPERTY = 'FINANCIAL_PLANNER_DEMO_WHATSAPP_URL';

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.whatsappUrl = demoWhatsAppUrl_();
  return template.evaluate()
    .setTitle('Financial Planner Demo')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function configureFinancialPlannerDemo(whatsappUrl) {
  const url = validateDemoWhatsAppUrl_(whatsappUrl);
  PropertiesService.getScriptProperties().setProperty(DEMO_WHATSAPP_PROPERTY, url);
  return { configured: true, whatsappUrl: url };
}

function api(action, payload) {
  if (action === 'health') {
    return demoOk_({ appName: 'Financial Planner Demo', schemaVersion: 'demo-read-only', sheets: [] });
  }
  return demoFail_('DEMO_READ_ONLY', 'Mode demo hanya-baca. Hubungi penjual untuk memakai fitur penyimpanan.', payload && payload.requestId);
}

function demoWhatsAppUrl_() {
  const value = PropertiesService.getScriptProperties().getProperty(DEMO_WHATSAPP_PROPERTY);
  return value ? validateDemoWhatsAppUrl_(value) : '';
}

function validateDemoWhatsAppUrl_(value) {
  const text = String(value || '').trim();
  if (!/^https:\/\/(wa\.me|api\.whatsapp\.com)(\/|$)/i.test(text)) {
    throw new Error('Gunakan URL HTTPS wa.me atau api.whatsapp.com yang valid.');
  }
  return text;
}

function demoOk_(data) {
  return { ok: true, data: data, requestId: null, timestamp: new Date().toISOString() };
}

function demoFail_(code, message, requestId) {
  return { ok: false, error: { code: code, message: message, details: null }, requestId: requestId || null, timestamp: new Date().toISOString() };
}
