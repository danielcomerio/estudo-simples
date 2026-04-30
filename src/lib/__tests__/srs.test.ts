import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  applySRS,
  isNew,
  isOverdue,
  newSRS,
  newStats,
  suggestQualityFromScore,
} from '../srs';
import type { SRS } from '../types';

describe('newSRS', () => {
  it('retorna estado inicial válido com dueDate ~agora', () => {
    const before = Date.now();
    const s = newSRS();
    const after = Date.now();
    expect(s.easeFactor).toBe(2.5);
    expect(s.interval).toBe(0);
    expect(s.repetitions).toBe(0);
    expect(s.lastReviewed).toBeNull();
    expect(s.dueDate).toBeGreaterThanOrEqual(before);
    expect(s.dueDate).toBeLessThanOrEqual(after);
  });
});

describe('newStats', () => {
  it('retorna stats zeradas com history vazio', () => {
    const s = newStats();
    expect(s).toEqual({ attempts: 0, correct: 0, wrong: 0, history: [] });
  });
});

describe('applySRS', () => {
  it('cria srs se card não tinha (segurança contra leitura de partial)', () => {
    const card: { srs?: SRS } = {};
    applySRS(card, 4);
    expect(card.srs).toBeDefined();
    expect(card.srs!.repetitions).toBe(1);
  });

  it('quality 0 zera repetições e interval mesmo após várias revisões', () => {
    const card: { srs?: SRS } = {};
    applySRS(card, 4);
    applySRS(card, 4);
    applySRS(card, 4);
    expect(card.srs!.repetitions).toBe(3);
    applySRS(card, 0);
    expect(card.srs!.repetitions).toBe(0);
    expect(card.srs!.interval).toBe(0);
  });

  it('progressão padrão: 1d → 6d na primeira sequência com quality 4', () => {
    const card: { srs?: SRS } = {};
    applySRS(card, 4);
    expect(card.srs!.interval).toBe(1);
    applySRS(card, 4);
    expect(card.srs!.interval).toBe(6);
  });

  it('quality 5 amplifica intervalo em 1.3×', () => {
    const card: { srs?: SRS } = {};
    applySRS(card, 4);
    applySRS(card, 4);
    const semFacil = card.srs!.interval;
    const card2: { srs?: SRS } = {};
    applySRS(card2, 4);
    applySRS(card2, 5);
    expect(card2.srs!.interval).toBeGreaterThanOrEqual(Math.round(semFacil * 1.3));
  });

  it('quality 3 progride mais devagar que quality 4 a partir da 3ª revisão', () => {
    const a: { srs?: SRS } = {};
    const b: { srs?: SRS } = {};
    applySRS(a, 4);
    applySRS(a, 4);
    applySRS(a, 4);
    applySRS(b, 4);
    applySRS(b, 4);
    applySRS(b, 3);
    expect(b.srs!.interval).toBeLessThan(a.srs!.interval);
  });

  it('easeFactor nunca cai abaixo de 1.3 mesmo com sequência de quality 0', () => {
    const card: { srs?: SRS } = {};
    for (let i = 0; i < 50; i++) applySRS(card, 0);
    expect(card.srs!.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('easeFactor cresce limitadamente com sequência de quality 5', () => {
    const card: { srs?: SRS } = {};
    for (let i = 0; i < 100; i++) applySRS(card, 5);
    // Fórmula clássica SM-2 cresce ~0.1 por quality 5; após 100 reviews fica
    // alto, mas o que importa pra segurança é que não vai pro infinito
    // nem NaN
    expect(Number.isFinite(card.srs!.easeFactor)).toBe(true);
    expect(card.srs!.easeFactor).toBeLessThan(100);
  });

  it('clampa quality fora de [0,5] (input não confiável de UI/JSON)', () => {
    const card1: { srs?: SRS } = {};
    const card2: { srs?: SRS } = {};
    applySRS(card1, -10);
    applySRS(card2, 0);
    expect(card1.srs!.repetitions).toBe(card2.srs!.repetitions);
    expect(card1.srs!.interval).toBe(card2.srs!.interval);

    const card3: { srs?: SRS } = {};
    const card4: { srs?: SRS } = {};
    applySRS(card3, 999);
    applySRS(card4, 5);
    expect(card3.srs!.interval).toBe(card4.srs!.interval);
  });

  it('dueDate avança proporcional ao interval', () => {
    const card: { srs?: SRS } = {};
    const before = Date.now();
    applySRS(card, 4);
    const due1 = card.srs!.dueDate;
    expect(due1 - before).toBeGreaterThanOrEqual(DAY_MS - 1000);
    expect(due1 - before).toBeLessThanOrEqual(DAY_MS + 1000);

    applySRS(card, 4);
    const due2 = card.srs!.dueDate;
    const now = Date.now();
    expect(due2 - now).toBeGreaterThanOrEqual(6 * DAY_MS - 1000);
  });
});

describe('suggestQualityFromScore', () => {
  it.each([
    [0.0, 0],
    [0.39, 0],
    [0.4, 3],
    [0.64, 3],
    [0.65, 4],
    [0.84, 4],
    [0.85, 5],
    [1.0, 5],
  ])('pct=%s → quality=%s', (pct, expected) => {
    expect(suggestQualityFromScore(pct)).toBe(expected);
  });

  it('aceita inputs fora de [0,1] sem quebrar (input não confiável)', () => {
    expect(suggestQualityFromScore(-1)).toBe(0);
    expect(suggestQualityFromScore(99)).toBe(5);
    expect(suggestQualityFromScore(NaN)).toBe(5); // NaN < x é false → cai em 5; comportamento documentado
  });
});

describe('isOverdue / isNew', () => {
  it('isNew: undefined ou sem lastReviewed', () => {
    expect(isNew(undefined)).toBe(true);
    expect(isNew({ ...newSRS() })).toBe(true);
  });

  it('isNew: false após primeira revisão', () => {
    const card: { srs?: SRS } = {};
    applySRS(card, 4);
    expect(isNew(card.srs)).toBe(false);
  });

  it('isOverdue: false para undefined (segurança — sem srs não é "atrasado")', () => {
    expect(isOverdue(undefined)).toBe(false);
  });

  it('isOverdue: true quando dueDate < ref', () => {
    const s: SRS = { ...newSRS(), dueDate: Date.now() - 1000 };
    expect(isOverdue(s)).toBe(true);
  });

  it('isOverdue: false quando dueDate >= ref', () => {
    const ref = Date.now();
    const s: SRS = { ...newSRS(), dueDate: ref + 1000 };
    expect(isOverdue(s, ref)).toBe(false);
  });
});
