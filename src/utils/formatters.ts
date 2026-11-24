export const BRAND_COLORS = {
  navy: '#0B1F3A',
  midNavy: '#16325C',
  slateNavy: '#2C4A75',
  gold: '#C89B3C',
  goldBright: '#D4AF37',
  crimson: '#8B1E24',
  crimsonBright: '#A1232B',
  canvas: '#F5F7FA',
  white: '#FFFFFF',
  border: '#E2E8F0',
  ink: '#0F172A',
  muted: '#475569',
} as const;

export function formatGBP(value: number, decimals = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function formatGBPCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe) >= 1_000_000) {
    return `£${(safe / 1_000_000).toFixed(2)}m`;
  }
  if (Math.abs(safe) >= 1_000) {
    return `£${(safe / 1_000).toFixed(1)}k`;
  }
  return formatGBP(safe, 0);
}

export function formatCurrencyDisplay(value: number, compact = true): string {
  return compact ? formatGBPCompact(value) : formatGBP(value, 0);
}

export function formatPercent(value: number, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function formatDateUK(isoOrStr: string): string {
  if (!isoOrStr) return '—';
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return isoOrStr;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTimestamp(isoOrStr: string): string {
  if (!isoOrStr) return '—';
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return isoOrStr;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}
