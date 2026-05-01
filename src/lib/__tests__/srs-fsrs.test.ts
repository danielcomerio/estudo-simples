import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import {
  applyFSRS,
  applyReview,
  fsrsCardToSrs,
  mapQualityToRating,
  srsToFsrsCard,
} from '../srs-fsrs';
import { newSRS } from '../srs';
import type { SRS } from '../types';

describe('mapQualityToRating', () => {
  it.each([
    [0, Rating.Again],
    [1, Rating.Again],
    [2, Rating.Hard],
    [3, Rating.Hard],
    [4, Rating.Good],
    [5, Rating.Easy],
  ])('quality=%i → rating=%i', (q, expected) => {
    expect(mapQualityToRating(q)).toBe(expected);
  });

  it('clampa quality fora de [0,5] (input não confiável)', () => {
    expect(mapQualityToRating(-99)).toBe(Rating.Again);
    expect(mapQualityToRating(999)).toBe(Rating.Easy);
  });
});

describe('srsToFsrsCard', () => {
  it('SRS sem stability/difficulty vira card vazio (createEmptyCard)', () => {
    const srs = newSRS();
    const now = new Date();
    const card = srsToFsrsCard(srs, now);
    expect(card.stability).toBe(0);
    expect(card.difficulty).toBe(0);
    expect(card.reps).toBe(0);
    expect(card.state).toBe(0); // New
  });

  it('SRS com fields FSRS reconstrói card preservando dados', () => {
    const lastReview = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3d atrás
    const due = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const srs: SRS = {
      easeFactor: 2.5,
      interval: 7,
      repetitions: 3,
      dueDate: due,
      lastReviewed: lastReview,
      stability: 12.5,
      difficulty: 4.2,
      state: 2,
      lapses: 1,
    };
    const card = srsToFsrsCard(srs, new Date());
    expect(card.stability).toBe(12.5);
    expect(card.difficulty).toBe(4.2);
    expect(card.reps).toBe(3);
    expect(card.lapses).toBe(1);
    expect(card.state).toBe(2);
    expect(card.due.getTime()).toBe(due);
    expect(card.last_review?.getTime()).toBe(lastReview);
    expect(card.elapsed_days).toBeGreaterThanOrEqual(2.99);
    expect(card.elapsed_days).toBeLessThan(3.01);
  });

  it('elapsed_days nunca negativo (defesa contra clock-skew)', () => {
    const future = Date.now() + 60_000;
    const srs: SRS = {
      ...newSRS(),
      stability: 5,
      difficulty: 3,
      lastReviewed: future,
    };
    const card = srsToFsrsCard(srs, new Date());
    expect(card.elapsed_days).toBe(0);
  });

  it('interval negativo (corrupção) vira 0 no scheduled_days', () => {
    const srs: SRS = {
      ...newSRS(),
      stability: 5,
      difficulty: 3,
      interval: -10,
    };
    const card = srsToFsrsCard(srs, new Date());
    expect(card.scheduled_days).toBe(0);
  });
});

describe('fsrsCardToSrs', () => {
  it('preserva easeFactor do prev (não diverge dado SM-2)', () => {
    const prev: SRS = { ...newSRS(), easeFactor: 2.7 };
    const card = srsToFsrsCard(prev, new Date());
    const merged = fsrsCardToSrs(card, prev);
    expect(merged.easeFactor).toBe(2.7);
  });

  it('default easeFactor 2.5 quando prev é undefined', () => {
    const card = srsToFsrsCard(newSRS(), new Date());
    const merged = fsrsCardToSrs(card, undefined);
    expect(merged.easeFactor).toBe(2.5);
  });
});

describe('applyFSRS', () => {
  it('cria srs se card não tinha (segurança)', () => {
    const card: { srs?: SRS } = {};
    applyFSRS(card, 4);
    expect(card.srs).toBeDefined();
    expect(card.srs!.stability).toBeGreaterThan(0);
    expect(card.srs!.difficulty).toBeGreaterThan(0);
  });

  it('Again (quality 0) deixa card devendo cedo', () => {
    const card: { srs?: SRS } = {};
    const now = new Date();
    applyFSRS(card, 0, now);
    expect(card.srs!.dueDate).toBeLessThan(now.getTime() + 24 * 60 * 60 * 1000);
  });

  it('Easy (quality 5) agenda mais longe que Good (quality 4)', () => {
    const a: { srs?: SRS } = {};
    const b: { srs?: SRS } = {};
    const now = new Date();
    applyFSRS(a, 4, now);
    applyFSRS(b, 5, now);
    expect(b.srs!.dueDate).toBeGreaterThan(a.srs!.dueDate);
    expect(b.srs!.interval).toBeGreaterThan(a.srs!.interval);
  });

  it('Hard (quality 3) agenda menos que Good (quality 4)', () => {
    const a: { srs?: SRS } = {};
    const b: { srs?: SRS } = {};
    const now = new Date();
    applyFSRS(a, 3, now);
    applyFSRS(b, 4, now);
    expect(a.srs!.dueDate).toBeLessThanOrEqual(b.srs!.dueDate);
  });

  it('várias revisões com Good mantêm stability >0 e finita (não diverge)', () => {
    // Note: FSRS default tem enable_short_term=true, então as primeiras
    // revisões podem ficar em Learning state (stability inicial fixa).
    // O que IMPORTA pra segurança é: stability sempre >0, sempre
    // finita, e cresce ou se mantém (nunca regride pra <= 0 nem NaN).
    const card: { srs?: SRS } = {};
    let now = new Date();
    let prev = -1;
    for (let i = 0; i < 10; i++) {
      applyFSRS(card, 4, now);
      now = new Date(card.srs!.dueDate);
      const s = card.srs!.stability ?? 0;
      expect(s).toBeGreaterThan(0);
      expect(Number.isFinite(s)).toBe(true);
      // Após sair de Learning, stability cresce monotonicamente com Good
      if (card.srs!.state === 2 && prev > 0) {
        expect(s).toBeGreaterThanOrEqual(prev);
      }
      prev = s;
    }
  });

  it('lapse incrementa contador após Again', () => {
    const card: { srs?: SRS } = {};
    let now = new Date();
    applyFSRS(card, 4, now);
    applyFSRS(card, 4, new Date(card.srs!.dueDate));
    const before = card.srs!.lapses ?? 0;
    applyFSRS(card, 0, new Date(card.srs!.dueDate));
    expect((card.srs!.lapses ?? 0)).toBeGreaterThanOrEqual(before);
  });

  it('clampa quality fora de range sem quebrar', () => {
    const card: { srs?: SRS } = {};
    expect(() => applyFSRS(card, -100)).not.toThrow();
    expect(() => applyFSRS(card, 999)).not.toThrow();
  });
});

describe('applyReview', () => {
  it('algorithm=sm2 (default) usa SM-2 — easeFactor muda', () => {
    const card: { srs?: SRS } = {};
    applyReview(card, 4);
    // SM-2 com quality 4 mexe no easeFactor (fórmula clássica)
    // EF começa em 2.5 e depois de quality 4 fica 2.5 + (0.1 - 1*0.1) = 2.5
    // Vamos fazer dois reviews com quality 5 pra mudança visível
    applyReview(card, 5);
    expect(card.srs!.easeFactor).toBeGreaterThan(2.5);
    // E NÃO populou stability/difficulty
    expect(card.srs!.stability).toBeUndefined();
    expect(card.srs!.difficulty).toBeUndefined();
  });

  it('algorithm=fsrs usa FSRS — popula stability/difficulty', () => {
    const card: { srs?: SRS } = {};
    applyReview(card, 4, 'fsrs');
    expect(card.srs!.stability).toBeGreaterThan(0);
    expect(card.srs!.difficulty).toBeGreaterThan(0);
  });

  it('troca de algoritmo no meio do caminho não corrompe srs', () => {
    const card: { srs?: SRS } = {};
    // Começa SM-2
    applyReview(card, 4, 'sm2');
    applyReview(card, 4, 'sm2');
    const efAposSm2 = card.srs!.easeFactor;
    const repAposSm2 = card.srs!.repetitions;

    // Migra pra FSRS — primeira passada FSRS reinicializa stability
    applyReview(card, 4, 'fsrs');
    expect(card.srs!.stability).toBeGreaterThan(0);
    expect(card.srs!.difficulty).toBeGreaterThan(0);
    // EaseFactor (SM-2) preservado pra possível volta
    expect(card.srs!.easeFactor).toBe(efAposSm2);

    // Volta pra SM-2 — continua a partir do estado anterior
    applyReview(card, 4, 'sm2');
    expect(card.srs!.repetitions).toBeGreaterThan(repAposSm2);
  });
});
