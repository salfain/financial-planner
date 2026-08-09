export type CsvRow = Record<string, string>;

export function parseCsv(input: string): { headers: string[]; rows: CsvRow[] } {
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = input.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field.trim()); field = ''; }
    else if (char === '\n') { row.push(field.trim()); if (row.some(Boolean)) matrix.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) matrix.push(row);
  if (quoted) throw new Error('CSV memiliki kutip yang tidak ditutup.');
  if (matrix.length < 2) throw new Error('CSV harus berisi header dan minimal satu baris data.');
  const headers = matrix[0].map((value) => value.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  if (headers.some((value) => !value)) throw new Error('Header CSV tidak boleh kosong.');
  if (new Set(headers).size !== headers.length) throw new Error('Header CSV tidak boleh duplikat.');
  return {
    headers,
    rows: matrix.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))),
  };
}
export function mapAccountCsv(rows: CsvRow[]) {
  return rows.map((row) => ({
    name: row.name || row.nama,
    type: row.type || row.jenis,
    institution: row.institution || row.institusi || '',
    mask: row.mask || '',
    openingBalance: Number((row.opening_balance || row.openingbalance || row.saldo_awal || row.balance || '0').replace(/[^\d-]/g, '')),
    color: row.color || '#126b59',
  }));
}

export function mapTransactionCsv(rows: CsvRow[], accounts: Array<{ id: string; name: string }>) {
  return rows.map((row) => {
    const accountValue = row.account_id || row.account || row.akun || '';
    const account = accounts.find((item) => item.id === accountValue || item.name.toLowerCase() === accountValue.toLowerCase());
    return {
      date: row.date || row.tanggal,
      time: row.time || row.waktu || '',
      type: (row.type || row.jenis || '').toLowerCase(),
      accountId: account?.id ?? accountValue,
      amount: Number((row.amount || row.nominal || '0').replace(/[^\d-]/g, '')),
      category: row.category || row.kategori,
      merchant: row.merchant || row.title || row.deskripsi,
      notes: row.notes || row.catatan || '',
      status: (row.status || 'completed').toLowerCase(),
      tags: (row.tags || '').split(/[;|]/).map((item) => item.trim()).filter(Boolean),
      location: row.location || row.lokasi || '',
    };
  });
}
