import type { SRS } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function newSRS(): SRS {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: Date.now(),
    lastReviewed: null,
  };
}

export function newStats() {
  return { attempts: 0, correct: 0, wrong: 0, history: [] as never[] };
}

/**
 * SM-2 melhorado, no estilo Anki:
 * - quality 0 = "De novo": reseta repetições, agenda no mesmo dia.
 * - quality 3 = "Difícil": progride mais devagar (EF reduzido na multiplicação).
 * - quality 4 = "Bom": progressão padrão.
 * - quality 5 = "Fácil": amplifica o intervalo em 1.3×.
 * Ease factor mantido entre 1.3 e ~3.0 com a fórmula clássica.
 */
export function applySRS(card: { srs?: SRS }, quality: number): void {
  if (!card.srs) card.srs = newSRS();
  const s = card.srs;
  const q = Math.max(0, Math.min(5, quality));

  if (q < 3) {
    s.repetitions = 0;
    s.interval = 0;
  } else {
    if (s.repetitions === 0) {
      s.interval = 1;
    } else if (s.repetitions === 1) {
      s.interval = q === 3 ? 3 : 6;
    } else {
      const factor = q === 3 ? Math.max(1.2, s.easeFactor - 0.15) : s.easeFactor;
      s.interval = Math.max(1, Math.round(s.interval * factor));
    }
    if (q === 5) s.interval = Math.round(s.interval * 1.3);
    s.repetitions += 1;
  }

  // Atualiza ease factor (fórmula SM-2 clássica)
  s.easeFactor = Math.max(
    1.3,
    s.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  const now = Date.now();
  s.dueDate = now + s.interval * DAY_MS;
  s.lastReviewed = now;
}

/**
 * Sugere uma quality de SRS a partir de uma autoavaliação por percentual (0..1).
 * Usado em discursivas se o usuário não escolher manualmente.
 */
export function suggestQualityFromScore(pct: number): number {
  if (pct < 0.4) return 0;
  if (pct < 0.65) return 3;
  if (pct < 0.85) return 4;
  return 5;
}

export function isOverdue(srs: SRS | undefined, ref = Date.now()): boolean {
  return !!srs && srs.dueDate < ref;
}

export function isNew(srs: SRS | undefined): boolean {
  return !srs || !srs.lastReviewed;
}
