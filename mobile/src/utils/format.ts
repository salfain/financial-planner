export const formatCurrency = (value: number, privacy = false, currency = 'IDR') => {
  if (privacy) return currency === 'IDR' ? 'Rp ••••••' : `${currency} ••••••`;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
};

export const formatCompactCurrency = (value: number, privacy = false, currency = 'IDR') => {
  if (privacy) return currency === 'IDR' ? 'Rp •••' : `${currency} •••`;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
};

export const formatPercent = (value: number, privacy = false) =>
  privacy ? '•••%' : `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`;

export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '-';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+07:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', options ?? {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(date);
};

export const formatMonth = (month: string) => formatDate(`${month}-01`, { month: 'long', year: 'numeric' });

export const currentMonth = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit',
}).format(new Date()).slice(0, 7);

export const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export const digitsOnly = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
export const parseMoney = (value: string) => Number(digitsOnly(value) || 0);
export const formatMoneyInput = (value: string | number) => {
  const digits = digitsOnly(String(value));
  return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
};

export const relativeUpdatedAt = (iso?: string | null) => {
  if (!iso) return 'Belum pernah diperbarui';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return 'Waktu pembaruan tidak tersedia';
  return `Data terakhir diperbarui ${new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(value)}`;
};
