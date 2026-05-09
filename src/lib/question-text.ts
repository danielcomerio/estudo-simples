/**
 * Helper unificado pra extrair texto principal da questão por tipo.
 * Centraliza pattern repetido em N componentes.
 */

import type { Question } from './types';

/**
 * Retorna texto "leitor" da questão — o que mostrar como preview/título:
 *  - objetiva/discursiva: enunciado
 *  - cloze: texto
 *  - flashcard: frente
 *  - soma: enunciado
 *
 * Fallback chain pra robustez (alguns formatos legacy podem ter campos
 * diferentes).
 */
export function getQuestionText(q: Question): string {
  const p = q.payload as Record<string, unknown>;
  const fields = ['enunciado', 'enunciado_completo', 'frente', 'texto'];
  for (const f of fields) {
    const v = p[f];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return '';
}

/** Texto de "resposta/feedback" — o que mostrar quando user revela. */
export function getQuestionAnswer(q: Question): string | null {
  const p = q.payload as Record<string, unknown>;
  if (q.type === 'flashcard' && typeof p.verso === 'string') return p.verso;
  if (q.type === 'discursiva' && typeof p.espelho_resposta === 'string')
    return p.espelho_resposta;
  if (q.type === 'objetiva') {
    const alts = p.alternativas as Array<{ letra: string; texto: string; correta?: boolean }> | undefined;
    const correta = alts?.find((a) => a.correta);
    if (correta) return `${correta.letra}) ${correta.texto}`;
    if (typeof p.gabarito === 'string') return `Gabarito: ${p.gabarito}`;
  }
  if (typeof p.explicacao_geral === 'string') return p.explicacao_geral;
  return null;
}

/** Truncate inteligente — usa boundary de palavra quando possível. */
export function truncateText(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > max * 0.7) return slice.slice(0, lastSpace) + '…';
  return slice + '…';
}
