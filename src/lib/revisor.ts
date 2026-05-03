/**
 * Helpers para o fluxo de bulk-fill de gabarito (revisar questões
 * pendentes em lote).
 *
 * Ciclo:
 *  1. App seleciona N questões pendentes (verificacao='pendente').
 *  2. formatBatchForAI gera um texto formatado pro user colar na IA.
 *  3. IA responde com "Q1: C, Q2: A, ...".
 *  4. parseAIResponse extrai { idx -> letra }.
 *  5. App aplica em lote: gabarito + alternativa[X].correta=true +
 *     verificacao='verificada'.
 *
 * Decisões:
 *  - Numeração começa em 1 (Q1, Q2, ...) — natural pra prompt humano.
 *  - Idx no resultado é zero-based (interface limpa pra slicing).
 *  - Parser tolerante: aceita "Q1: C", "1) C", "1. C", "1=C", "1 C".
 *  - Letras case-insensitive na entrada; normalizadas pra UPPERCASE.
 */

import type { ObjetivaPayload, Question } from './types';

export type BatchEntry = {
  idx: number; // zero-based
  questionId: string;
  letras: string[]; // letras válidas (A-E geralmente)
};

/**
 * Gera texto formatado pra colar na IA. Inclui instrução clara no
 * topo, separador entre questões pra IA não confundir, e ID local
 * suprimido (não polui o prompt).
 */
export function formatBatchForAI(questions: Question[]): string {
  if (questions.length === 0) return '';
  const lines: string[] = [];
  lines.push(
    'Responda apenas com a letra correta de cada questão, no formato:',
    'Q1: X',
    'Q2: X',
    '...',
    '',
    `Total de questões: ${questions.length}`,
    '',
    '---',
    ''
  );
  questions.forEach((q, i) => {
    const p = q.payload as ObjetivaPayload;
    lines.push(`Q${i + 1}) ${(p.enunciado ?? '').trim()}`);
    lines.push('');
    for (const alt of p.alternativas ?? []) {
      lines.push(`${alt.letra}) ${alt.texto}`);
    }
    lines.push('');
    if (i < questions.length - 1) {
      lines.push('---');
      lines.push('');
    }
  });
  return lines.join('\n');
}

export type ParsedAnswers = Map<number, string>; // idx (1-based) -> letra UPPERCASE

/**
 * Parse tolerante de resposta da IA. Aceita formatos comuns:
 *  - "Q1: C"  "Q1 = C"  "Q1) C"  "Q1. C"
 *  - "1: C"   "1) C"    "1. C"   "1 - C"
 *  - "1) Letra: C" → captura "C" (extrai a última letra na linha)
 *
 * Linha por linha. Múltiplas respostas na mesma linha também ok
 * via regex global. Rejeita letras fora de A-Z.
 *
 * Retorno: Map de número(1-based) → letra(UPPERCASE).
 */
export function parseAIResponse(text: string): ParsedAnswers {
  const result: ParsedAnswers = new Map();
  if (!text) return result;
  // Pattern: "Q"? + digits + separador (:=)-.) + opcional "Letra " + LETRA
  // Captura cada match na string toda (multiline)
  const pattern = /Q?\s*(\d+)\s*[:=.\-)]+\s*(?:letra\s+)?\b([A-Za-z])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const num = Number(m[1]);
    if (!Number.isInteger(num) || num <= 0) continue;
    const letra = m[2].toUpperCase();
    // Aceita A-Z mas filtros típicos são A-E. Não bloqueia aqui;
    // chamador valida contra alternativas reais da questão.
    if (!/^[A-Z]$/.test(letra)) continue;
    // Última ocorrência da mesma questão ganha (sobrescreve)
    result.set(num, letra);
  }
  return result;
}

/**
 * Aplica resposta da IA a uma questão. Retorna o novo payload com
 * gabarito setado + alternativa marcada correta. Não muda outros
 * campos do payload.
 *
 * Retorna null se a letra não corresponde a nenhuma alternativa
 * (chamador trata erro).
 */
export function applyAnswer(
  question: Question,
  letra: string
): ObjetivaPayload | null {
  const p = question.payload as ObjetivaPayload;
  const alts = p.alternativas ?? [];
  const upper = letra.toUpperCase();
  if (!alts.some((a) => a.letra.toUpperCase() === upper)) return null;
  return {
    ...p,
    alternativas: alts.map((a) => ({
      ...a,
      correta: a.letra.toUpperCase() === upper,
    })),
    gabarito: upper,
  };
}
