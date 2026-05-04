'use client';

/**
 * Detector de quase-duplicatas: questões com mesmo enunciado em níveis
 * NÃO exatos (escapariam do dedup_hash do DB).
 *
 * Algoritmo: Jaccard de tokens (lowercase + sem pontuação + sem
 * stopwords + ≥3 chars). Limitado por disciplina pra reduzir custo
 * O(N²) — 1000 questões na mesma disc = 500k comparações.
 *
 * Threshold default 0.8 — só "muito similar". Pode subir pra 0.9 se
 * gerar falso positivo demais.
 */

import type { ObjetivaPayload, Question } from './types';

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'e', 'ou', 'mas', 'que', 'se', 'por', 'para', 'com', 'sem',
  'ao', 'aos', 'à', 'às', 'pela', 'pelo',
  'é', 'são', 'foi', 'ser', 'ter', 'há', 'havia',
  'esse', 'essa', 'esses', 'essas', 'este', 'esta', 'estes', 'estas',
  'isso', 'isto', 'aquilo',
  'quando', 'onde', 'como', 'porque', 'qual', 'quais',
]);

function enunciadoOf(q: Question): string {
  if (q.type === 'objetiva') {
    return (q.payload as ObjetivaPayload).enunciado || '';
  }
  if (q.type === 'discursiva') {
    const p = q.payload as { enunciado_completo?: string; enunciado?: string };
    return p.enunciado_completo || p.enunciado || '';
  }
  if (q.type === 'cloze') {
    return (q.payload as { texto?: string }).texto || '';
  }
  if (q.type === 'flashcard') {
    return (q.payload as { frente?: string }).frente || '';
  }
  return '';
}

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  if (!text) return tokens;
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  for (const tok of normalized.split(/\s+/)) {
    if (tok.length < 3) continue;
    if (STOPWORDS.has(tok)) continue;
    tokens.add(tok);
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export type DuplicatePair = {
  qa: Question;
  qb: Question;
  sim: number;
};

/**
 * Encontra pares de questões quase-idênticas. Limita escopo a mesma
 * disciplina pra reduzir custo (cross-disc já é coberto pelo wizard
 * de import).
 */
export function findNearDuplicates(
  questions: Question[],
  threshold = 0.8
): DuplicatePair[] {
  const porDisc = new Map<string, Question[]>();
  for (const q of questions) {
    const d = q.disciplina_id ?? '';
    if (!porDisc.has(d)) porDisc.set(d, []);
    porDisc.get(d)!.push(q);
  }

  const pairs: DuplicatePair[] = [];
  for (const qs of porDisc.values()) {
    if (qs.length < 2) continue;
    const tokens = qs.map((q) => tokenize(enunciadoOf(q)));
    for (let i = 0; i < qs.length; i++) {
      const a = tokens[i];
      if (a.size === 0) continue;
      for (let j = i + 1; j < qs.length; j++) {
        const sim = jaccard(a, tokens[j]);
        if (sim >= threshold) {
          pairs.push({ qa: qs[i], qb: qs[j], sim });
        }
      }
    }
  }

  return pairs.sort((a, b) => b.sim - a.sim);
}
