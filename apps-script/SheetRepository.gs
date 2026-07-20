function getWorkbook_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw createError_('WORKBOOK_NOT_FOUND', 'Buka script dari Google Sheets Financial Planner.');
  return spreadsheet;
}

function ensureSheet_(name, headers) {
  const workbook = getWorkbook_();
  let sheet = workbook.getSheetByName(name);
  if (!sheet) sheet = workbook.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#126b59')
      .setFontColor('#ffffff');
  } else {
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    headers.forEach(function(header, index) {
      if (!existing[index]) sheet.getRange(1, index + 1).setValue(header);
    });
  }
  return sheet;
}

function rowsAsObjects_(sheetName) {
  const sheet = getWorkbook_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map(function(row, rowIndex) {
    const result = { _row: rowIndex + 2 };
    headers.forEach(function(header, index) { result[String(header)] = row[index]; });
    return result;
  });
}

function appendObjects_(sheetName, objects) {
  if (!objects.length) return;
  const headers = VINN_CONFIG.HEADERS[sheetName];
  const sheet = ensureSheet_(sheetName, headers);
  const values = objects.map(function(object) {
    return headers.map(function(header) { return object[header] === undefined ? '' : object[header]; });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
}

function findById_(sheetName, id) {
  return rowsAsObjects_(sheetName).find(function(row) { return String(row.id) === String(id); }) || null;
}

function updateObjectRow_(sheetName, rowNumber, object) {
  const headers = VINN_CONFIG.HEADERS[sheetName];
  const sheet = getWorkbook_().getSheetByName(sheetName);
  if (!sheet) throw createError_('SHEET_NOT_FOUND', 'Sheet ' + sheetName + ' belum tersedia.');
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function(header) {
    return object[header] === undefined ? '' : object[header];
  })]);
}

function deleteObjectRow_(sheetName, rowNumber) {
  const sheet = getWorkbook_().getSheetByName(sheetName);
  if (!sheet) throw createError_('SHEET_NOT_FOUND', 'Sheet ' + sheetName + ' belum tersedia.');
  if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw createError_('ROW_NOT_FOUND', 'Baris data tidak ditemukan.');
  sheet.deleteRow(rowNumber);
}

function assertContiguousObjectRows_(entries) {
  const sorted = (entries || []).slice().sort(function(a, b) { return a.rowNumber - b.rowNumber; });
  if (!sorted.length) throw createError_('ROW_UPDATE_REQUIRED', 'Tidak ada baris yang akan diperbarui.');
  sorted.forEach(function(entry, index) {
    if (!entry.rowNumber || entry.rowNumber !== sorted[0].rowNumber + index) {
      throw createError_('ROWS_NOT_CONTIGUOUS', 'Pasangan transaksi tidak berada pada baris berurutan; pembaruan dibatalkan.');
    }
  });
  return sorted;
}

function updateContiguousObjectRows_(sheetName, entries) {
  const sorted = assertContiguousObjectRows_(entries);
  const headers = VINN_CONFIG.HEADERS[sheetName];
  const sheet = getWorkbook_().getSheetByName(sheetName);
  if (!sheet) throw createError_('SHEET_NOT_FOUND', 'Sheet ' + sheetName + ' belum tersedia.');
  const values = sorted.map(function(entry) {
    return headers.map(function(header) {
      return entry.object[header] === undefined ? '' : entry.object[header];
    });
  });
  sheet.getRange(sorted[0].rowNumber, 1, values.length, headers.length).setValues(values);
}

function withDocumentLock_(callback) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw createError_('LOCK_TIMEOUT', 'Data sedang diperbarui. Coba lagi beberapa saat.');
  try { return callback(); } finally { lock.releaseLock(); }
}
