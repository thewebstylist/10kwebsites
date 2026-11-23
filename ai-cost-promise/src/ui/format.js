/** Number formatting shared by counters and the calculator. */
export function formatNumber(v, { decimals = 0, format } = {}) {
  if (format === 'plain') return Math.round(v).toString();
  return v.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Sensible precision for calculator outputs that span 0.01 to 100,000. */
export function smartFormat(v) {
  if (v === 0) return '0';
  if (v < 1) return v.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (v < 10) return v.toLocaleString('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return Math.round(v).toLocaleString('en-GB');
}
