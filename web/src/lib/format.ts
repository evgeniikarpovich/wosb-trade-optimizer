/** Locale-aware number formatting helpers. */

export function fmtInt(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

export function fmtNum(n: number, locale: string, digits = 1): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
  }).format(n);
}

export function fmtPct(fraction: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(fraction);
}
