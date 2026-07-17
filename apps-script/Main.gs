function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(VINN_CONFIG.APP_NAME + ' — Financial OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('VINN STORE')
    .addItem('Jalankan Setup', 'setupVinnStore')
    .addItem('Periksa Struktur', 'apiHealthCheck')
    .addSeparator()
    .addItem('Buat Backup', 'apiCreateBackup')
    .addToUi();
}
