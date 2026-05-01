/**
 * Adapter FSRS-6 sobre o tipo SRS local. Convive com SM-2 sem
 * perder dados:
 *  - applyFSRS atualiza dueDate, interval (=scheduled_days), repetitions,
 *    lastReviewed, e os fields FSRS (stability, difficulty, state, lapses).
 *  - easeFactor (só usado pelo SM-2) é PRESERVADO — não diverge.
 *  - Quando user troca de SM-2 → FSRS no meio do caminho, o card é
 *    reinicializado pra primeira passada FSRS (createEmptyCard); a
 *    próxima revisão calibra os params FSRS naturalmente.
 *
 * applyReview() é o ponto de entrada que escolhe entre os dois
 * algoritmos baseado no parâmetro `algorithm`. Caller (UI ou flag) é
 * responsável por passar o valor certo.
 */

import {
  Rating,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRSParameters,
  type Grade,
} from 'ts-fsrs';
import { applySRS, DAY_MS, newSRS } from './srs';
import type { SRS } from './types';

export type SRSAlgorithm = 'sm2' | 'fsrs';

/** Retention alvo. 0.90 = ~10% de cards lembrados errado por revisão. */
export const DEFAULT_REQUEST_RETENTION = 0.9;

let cachedScheduler: ReturnType<typeof fsrs> | null = null;
let cachedParams: FSRSParameters | null = null;

function getScheduler(retention = DEFAULT_REQUEST_RETENTION) {
  if (
    cachedScheduler &&
    cachedParams &&
    cachedParams.request_retention === retention
  ) {
    return cachedScheduler;
  }
  cachedParams = generatorParameters({
    enable_fuzz: false, // determinístico — facilita testes e estabilidade
    request_retention: retention,
  });
  cachedScheduler = fsrs(cachedParams);
  return cachedScheduler;
}

/**
 * Mapeia quality SM-2 (0-5) pro Grade FSRS (Again|Hard|Good|Easy —
 * sem Manual). Clampa input fora de range (defesa contra UI/JSON
 * forjado). Tipo de retorno é Grade (não Rating) pra `scheduler.next`
 * aceitar — ts-fsrs distingue Manual de "graded review".
 */
export function mapQualityToRating(q: number): Grade {
  const c = Math.max(0, Math.min(5, q));
  if (c <= 1) return Rating.Again;
  if (c <= 3) return Rating.Hard;
  if (c === 4) return Rating.Good;
  return Rating.Easy;
}

/**
 * Reconstrói um Card FSRS a partir do estado SRS local. Se o card
 * ainda não tem dados FSRS (stability/difficulty undefined), retorna
 * um card novo (createEmptyCard) — primeira passada calibra.
 */
export function srsToFsrsCard(srs: SRS, now: Date): Card {
  if (
    typeof srs.stability !== 'number' ||
    typeof srs.difficulty !== 'number'
  ) {
    return createEmptyCard(now);
  }
  const lastReview = srs.lastReviewed ? new Date(srs.lastReviewed) : undefined;
  const elapsedDays = lastReview
    ? Math.max(0, (now.getTime() - lastReview.getTime()) / DAY_MS)
    : 0;
  return {
    due: new Date(srs.dueDate),
    stability: srs.stability,
    difficulty: srs.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: Math.max(0, srs.interval),
    learning_steps: 0,
    reps: Math.max(0, srs.repetitions),
    lapses: srs.lapses ?? 0,
    state: (srs.state ?? 0) as Card['state'],
    last_review: lastReview,
  };
}

/**
 * Funde o resultado FSRS no SRS local. Decisões:
 *  - easeFactor (SM-2) preservado intacto pra coexistir com troca de
 *    algoritmo sem perder dado.
 *  - repetitions = (prev ?? 0) + 1 — incremento monotônico.
 *    Razão: FSRS reseta card.reps quando o card vem de createEmptyCard
 *    (caso de migração SM-2 → FSRS), o que regrediria nosso contador.
 *    Mantemos `repetitions` no nosso SRS como "número total de revisões
 *    aplicadas a esta carta", invariante a troca de algoritmo.
 *  - Demais campos (stability, difficulty, state, lapses, dueDate,
 *    interval) vêm direto do card FSRS — são dele a responsabilidade.
 */
export function fsrsCardToSrs(card: Card, prev: SRS | undefined): SRS {
  return {
    easeFactor: prev?.easeFactor ?? 2.5,
    interval: card.scheduled_days,
    repetitions: (prev?.repetitions ?? 0) + 1,
    dueDate: card.due.getTime(),
    lastReviewed: card.last_review?.getTime() ?? Date.now(),
    stability: card.stability,
    difficulty: card.difficulty,
    state: card.state,
    lapses: card.lapses,
  };
}

/**
 * Aplica o algoritmo FSRS. Cria SRS se não existir. Retorna a SRS
 * atualizada também (conveniência).
 */
export function applyFSRS(
  card: { srs?: SRS },
  quality: number,
  now: Date = new Date(),
  retention = DEFAULT_REQUEST_RETENTION
): SRS {
  if (!card.srs) card.srs = newSRS();
  const rating = mapQualityToRating(quality);
  const scheduler = getScheduler(retention);
  const fsrsCard = srsToFsrsCard(card.srs, now);
  const result = scheduler.next(fsrsCard, now, rating);
  card.srs = fsrsCardToSrs(result.card, card.srs);
  return card.srs;
}

/**
 * Ponto de entrada único pra aplicar revisão. Caller passa o
 * algoritmo escolhido pelo user (default 'sm2' por enquanto).
 */
export function applyReview(
  card: { srs?: SRS },
  quality: number,
  algorithm: SRSAlgorithm = 'sm2'
): void {
  if (algorithm === 'fsrs') {
    applyFSRS(card, quality);
  } else {
    applySRS(card, quality);
  }
}
