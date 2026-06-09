/**
 * Formats a minor-unit amount (e.g. 34900 = NOK 349,00) into a human-readable
 * currency string. Defaults to Norwegian locale formatting.
 */
export function formatMinor(minor: number, currency: string): string {
  const major = minor / 100;

  // Use the Norwegian locale for NOK so we get "kr 349,00" style formatting.
  const locale = currency === 'NOK' ? 'nb-NO' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}
