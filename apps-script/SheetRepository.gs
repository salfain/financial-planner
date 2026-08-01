function getWorkbook_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw createError_('WORKBOOK_NOT_FOUND', 'Buka script dari Google Sheets Financial Planner.');
  return spreadsheet;
}

function rebuildSheetRowsForHeaders_(existingHeaders, rows, expectedHeaders) {
  const current = (existingHeaders || []).map(function(header) { return String(header || '').trim(); });
  const expected = (expectedHeaders || []).map(String);
  const alreadyAligned = expected.every(function(header, index) { return current[index] === header; });
  if (alreadyAligned) return null;

  const hasUnknownHeader = current.some(function(header) {
    return header && expected.indexOf(header) === -1;
  });
  if (hasUnknownHeader) return null;

  const sourceIndexes = expected.map(function(header) {
    const candidates = [];
    current.forEach(function(currentHeader, index) {
      if (currentHeader === header) candidates.push(index);
    });
    if (!candidates.length) return -1;
    return candidates.sort(function(left, right) {
      const leftValues = (rows || []).filter(function(row) { return row[left] !== '' && row[left] !== null && row[left] !== undefined; }).length;
      const rightValues = (rows || []).filter(function(row) { return row[right] !== '' && row[right] !== null && row[right] !== undefined; }).length;
      return rightValues - leftValues || left - right;
    })[0];
  });

  return (rows || []).map(function(row) {
    return sourceIndexes.map(function(index) { return index < 0 ? '' : row[index]; });
  });
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
    const rowCount = sheet.getLastRow();
    const width = Math.max(sheet.getLastColumn(), headers.length);
    const existing = sheet.getRange(1, 1, 1, width).getValues()[0];
    const rows = rowCount > 1 ? sheet.getRange(2, 1, rowCount - 1, width).getValues() : [];
    const rebuiltRows = rebuildSheetRowsForHeaders_(existing, rows, headers);
    if (rebuiltRows) {
      sheet.getRange(1, 1, rowCount, width).clearContent();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      if (rebuiltRows.length) sheet.getRange(2, 1, rebuiltRows.length, headers.length).setValues(rebuiltRows);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#126b59')
        .setFontColor('#ffffff');
    } else {
      headers.forEach(function(header, index) {
        if (!existing[index]) sheet.getRange(1, index + 1).setValue(header);
      });
    }
  }
  return sheet;
}

// Pembacaan mentah tanpa filter Mode Pasangan. Hanya untuk idempotensi, migrasi,
// dan perawatan internal yang memang harus melihat seluruh workspace.
function rowsAsObjectsUnscoped_(sheetName) {
  const sheet = getWorkbook_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map(function(row, rowIndex) {
    const result = { _row: rowIndex + 2 };
    headers.forEach(function(header, index) {
      result[String(header)] = sheetCellValue_(header, row[index]);
    });
    return result;
  });
}

// Pembacaan default menolak data di luar scope anggota yang sedang masuk.
function rowsAsObjects_(sheetName) {
  return applyScopeFilter_(sheetName, rowsAsObjectsUnscoped_(sheetName));
}

function sheetCellValue_(header, value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return value;
  const key = String(header || '').trim().toLowerCase();
  if (key === 'time') return Utilities.formatDate(value, VINN_CONFIG.TIMEZONE, 'HH:mm');
  if (key === 'month' || key === 'period' || key === 'last_paid_period') {
    return Utilities.formatDate(value, VINN_CONFIG.TIMEZONE, 'yyyy-MM');
  }
  if (key === 'date' || key === 'deadline' || key.endsWith('_date')) {
    return Utilities.formatDate(value, VINN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  return Utilities.formatDate(value, VINN_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// Atribusi anggota dicap terpusat agar tidak ada jalur tulis yang terlewat.
function stampMemberAttribution_(sheetName, object) {
  if (sheetName !== VINN_CONFIG.SHEETS.TRANSACTIONS) return object;
  if (object.created_by_member_id) return object;
  const memberId = currentScopeMemberId_();
  if (!memberId) return object;
  return Object.assign({}, object, { created_by_member_id: memberId });
}

function appendObjects_(sheetName, objects) {
  if (!objects.length) return;
  const headers = VINN_CONFIG.HEADERS[sheetName];
  const sheet = ensureSheet_(sheetName, headers);
  const values = objects.map(function(object) {
    const row = stampMemberAttribution_(sheetName, object);
    return headers.map(function(header) { return row[header] === undefined ? '' : row[header]; });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  if (sheetName === VINN_CONFIG.SHEETS.ACCOUNTS) invalidateAccountScopeIndex_();
}

function findById_(sheetName, id) {
  return rowsAsObjects_(sheetName).find(function(row) { return String(row.id) === String(id); }) || null;
}

function findByIdUnscoped_(sheetName, id) {
  return rowsAsObjectsUnscoped_(sheetName).find(function(row) { return String(row.id) === String(id); }) || null;
}

// Baris tersamar hanya berisi sebagian data asli. Menulisnya kembali akan
// menghapus detail milik anggota lain, jadi mutasinya ditolak di lapisan ini.
function assertNotRedactedRow_(object) {
  if (object && object.scope_redacted) {
    throw createError_('SCOPE_FORBIDDEN', 'Transaksi ini milik anggota lain dan tidak dapat diubah dari akun Anda.');
  }
}

function updateObjectRow_(sheetName, rowNumber, object) {
  assertNotRedactedRow_(object);
  const headers = VINN_CONFIG.HEADERS[sheetName];
  const sheet = getWorkbook_().getSheetByName(sheetName);
  if (!sheet) throw createError_('SHEET_NOT_FOUND', 'Sheet ' + sheetName + ' belum tersedia.');
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function(header) {
    return object[header] === undefined ? '' : object[header];
  })]);
  if (sheetName === VINN_CONFIG.SHEETS.ACCOUNTS) invalidateAccountScopeIndex_();
}

function deleteObjectRow_(sheetName, rowNumber) {
  const sheet = getWorkbook_().getSheetByName(sheetName);
  if (!sheet) throw createError_('SHEET_NOT_FOUND', 'Sheet ' + sheetName + ' belum tersedia.');
  if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw createError_('ROW_NOT_FOUND', 'Baris data tidak ditemukan.');
  sheet.deleteRow(rowNumber);
  if (sheetName === VINN_CONFIG.SHEETS.ACCOUNTS) invalidateAccountScopeIndex_();
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
  sorted.forEach(function(entry) { assertNotRedactedRow_(entry.object); });
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
