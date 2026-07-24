function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle(VINN_CONFIG.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Financial Planner')
    .addItem('Jalankan Setup', 'setupFinancialPlanner')
    .addItem('Periksa Struktur', 'apiHealthCheck')
    .addSeparator()
    .addItem('Buat Backup', 'apiCreateBackup')
    .addToUi();
}
