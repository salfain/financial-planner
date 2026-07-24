export function moneyInputDigits(value: string | number) {
  return String(value ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function formatMoneyInput(value: string | number) {
  const digits = moneyInputDigits(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function moneyInputNumber(value: string | number) {
  const digits = moneyInputDigits(value);
  return digits ? Number(digits) : 0;
}
