import type { Question } from './types';
import { startOfDay } from './utils';
import { DAY_MS } from './srs';

/**
 * Gera arquivo ICS (RFC 5545) com revisões agendadas dos próximos N
 * dias. Cada dia com >0 revisões é um evento de dia inteiro:
 * "🎯 Estudo Simples: X revisões".
 *
 * Importável no Google Calendar, Outlook, Apple Calendar.
 */

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function formatDateUTC(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function formatDateOnly(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate())
  );
}

/**
 * Escapa caracteres especiais ICS conforme RFC 5545.
 */
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateRevisionICS(
  questions: Question[],
  daysAhead = 30
): string {
  const today = startOfDay(Date.now());
  const limit = today + daysAhead * DAY_MS;
  // Conta por dia
  const byDay = new Map<number, number>();
  for (const q of questions) {
    const due = q.srs?.dueDate;
    if (!due) continue;
    const d = startOfDay(due);
    if (d >= today && d <= limit) {
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
  }
  // Agrupa atrasadas em "hoje"
  let atrasadas = 0;
  for (const q of questions) {
    const due = q.srs?.dueDate ?? Infinity;
    if (due < today) atrasadas++;
  }
  if (atrasadas > 0) {
    byDay.set(today, (byDay.get(today) ?? 0) + atrasadas);
  }

  const now = formatDateUTC(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Estudo Simples//Revisoes//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Estudo Simples — Revisões',
    'X-WR-TIMEZONE:UTC',
  ];

  let idx = 0;
  for (const [d, count] of Array.from(byDay.entries()).sort((a, b) => a[0] - b[0])) {
    const start = new Date(d);
    const end = new Date(d + DAY_MS);
    const uid = `es-rev-${d}-${idx}@estudo-simples.app`;
    idx++;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatDateOnly(start)}`,
      `DTEND;VALUE=DATE:${formatDateOnly(end)}`,
      `SUMMARY:${escapeIcs(`🎯 ${count} ${count === 1 ? 'revisão' : 'revisões'} no Estudo Simples`)}`,
      `DESCRIPTION:${escapeIcs(`${count} questão(ões) agendada(s) pra revisão. Abra https://estudo-simples.app/estudar pra começar.`)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  // Linhas terminam com CRLF (RFC 5545)
  return lines.join('\r\n') + '\r\n';
}

export function downloadICS(content: string, filename = 'revisoes.ics'): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
