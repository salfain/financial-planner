export function compareVersions(left: string, right: string) {
  const a = left.split('.').map((value) => Number(value) || 0);
  const b = right.split('.').map((value) => Number(value) || 0);
  const size = Math.max(a.length, b.length);
  for (let index = 0; index < size; index += 1) {
    if ((a[index] ?? 0) > (b[index] ?? 0)) return 1;
    if ((a[index] ?? 0) < (b[index] ?? 0)) return -1;
  }
  return 0;
}

export const isBackendCompatible = (actual: string | undefined, minimum: string) =>
  Boolean(actual && compareVersions(actual, minimum) >= 0);
