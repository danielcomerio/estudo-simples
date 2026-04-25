import { DAY_MS } from './srs';

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtRelative(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return '—';
  const diffDays = Math.round((ts - now) / DAY_MS);
  if (diffDays < -30) return `há ${Math.abs(diffDays)} dias`;
  if (diffDays < -1) return `há ${-diffDays} dias`;
  if (diffDays === -1) return 'ontem';
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'amanhã';
  if (diffDays <= 30) return `em ${diffDays} dias`;
  return `em ${diffDays} dias`;
}

export function fmtPercent(n: number, total: number): string {
  if (total === 0) return '—';
  return Math.round((100 * n) / total) + '%';
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}m${ss.toString().padStart(2, '0')}s`;
}
