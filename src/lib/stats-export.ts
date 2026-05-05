'use client';

import type { Question } from './types';

/**
 * Geração de CSV com agregados estatísticos por questão e por
 * disciplina. Útil pra cruzar dados em planilha (Excel/Sheets) ou pra
 * análise externa (Python, R, etc.).
 *
 * Saída: 2 arquivos:
 *  - questoes.csv: linha por questão com totais, acerto, próximo due
 *  - disciplinas.csv: agregado por disciplina_id
 *
 * Compactamos como ZIP? Não — Browser native, bypass deps. Mandamos
 * cada CSV separado.
 */

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvLine(cells: unknown[]): string {
  return cells.map(csvEscape).join(',');
}

export function buildQuestionsCSV(questions: Question[]): string {
  const head = [
    'id',
    'tipo',
    'disciplina',
    'tema',
    'banca',
    'origem',
    'verificacao',
    'dificuldade',
    'tags',
    'tentativas',
    'acertos',
    'erros',
    'pct_acerto',
    'last_reviewed',
    'due_date',
    'days_until_due',
    'created_at',
  ];
  const lines: string[] = [csvLine(head)];
  const now = Date.now();
  for (const q of questions) {
    const a = q.stats?.attempts ?? 0;
    const c = q.stats?.correct ?? 0;
    const w = q.stats?.wrong ?? 0;
    const pct = a > 0 ? Math.round((c / a) * 100) : '';
    const lastIso = q.srs?.lastReviewed
      ? new Date(q.srs.lastReviewed).toISOString()
      : '';
    const dueIso = q.srs?.dueDate
      ? new Date(q.srs.dueDate).toISOString()
      : '';
    const daysUntil = q.srs?.dueDate
      ? Math.round((q.srs.dueDate - now) / (24 * 60 * 60 * 1000))
      : '';
    lines.push(
      csvLine([
        q.id,
        q.type,
        q.disciplina_id ?? '',
        q.tema ?? '',
        q.banca_estilo ?? '',
        q.origem ?? '',
        q.verificacao ?? '',
        q.dificuldade ?? '',
        (q.tags ?? []).join(';'),
        a,
        c,
        w,
        pct,
        lastIso,
        dueIso,
        daysUntil,
        q.created_at ?? '',
      ])
    );
  }
  return lines.join('\n');
}

export function buildDisciplinasCSV(questions: Question[]): string {
  const head = [
    'disciplina',
    'total_questoes',
    'tentativas',
    'acertos',
    'pct_acerto',
    'vencidas',
    'novas',
    'dominadas',
    'inimigas',
  ];
  const m = new Map<
    string,
    {
      total: number;
      attempts: number;
      correct: number;
      due: number;
      novas: number;
      dominadas: number;
      inimigas: number;
    }
  >();
  const now = Date.now();
  for (const q of questions) {
    const d = q.disciplina_id || '(sem)';
    let agg = m.get(d);
    if (!agg) {
      agg = {
        total: 0,
        attempts: 0,
        correct: 0,
        due: 0,
        novas: 0,
        dominadas: 0,
        inimigas: 0,
      };
      m.set(d, agg);
    }
    agg.total++;
    const a = q.stats?.attempts ?? 0;
    const c = q.stats?.correct ?? 0;
    agg.attempts += a;
    agg.correct += c;
    if ((q.srs?.dueDate ?? 0) < now) agg.due++;
    if (!q.srs?.lastReviewed) agg.novas++;
    const h = q.stats?.history ?? [];
    if (
      h.length >= 5 &&
      h.slice(-5).every((r) => r.result === 'correct' || r.result === 'self_pass')
    ) {
      agg.dominadas++;
    }
    if (a >= 3 && c / a < 0.3) agg.inimigas++;
  }
  const lines: string[] = [csvLine(head)];
  for (const [disc, s] of Array.from(m.entries()).sort()) {
    const pct = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : '';
    lines.push(
      csvLine([
        disc,
        s.total,
        s.attempts,
        s.correct,
        pct,
        s.due,
        s.novas,
        s.dominadas,
        s.inimigas,
      ])
    );
  }
  return lines.join('\n');
}

export function buildHistoryCSV(questions: Question[]): string {
  const head = [
    'question_id',
    'disciplina',
    'tipo',
    'date',
    'result',
    'time_ms',
    'confidence',
    'quality',
  ];
  const lines: string[] = [csvLine(head)];
  for (const q of questions) {
    for (const h of q.stats?.history ?? []) {
      lines.push(
        csvLine([
          q.id,
          q.disciplina_id ?? '',
          q.type,
          new Date(h.date).toISOString(),
          h.result,
          h.timeMs ?? '',
          h.confidence ?? '',
          h.quality ?? '',
        ])
      );
    }
  }
  return lines.join('\n');
}

export function downloadFile(content: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob(['﻿' + content], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
