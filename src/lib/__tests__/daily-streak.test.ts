import { describe, expect, it } from 'vitest';
import { computeDailyStreak } from '../daily-streak';

const NOW = new Date('2026-05-07T12:00:00Z');

describe('computeDailyStreak', () => {
  it('lista vazia → 0/0', () => {
    expect(computeDailyStreak([], NOW)).toEqual({
      currentStreak: 0,
      bestStreak: 0,
    });
  });

  it('1 dia hoje → 1/1', () => {
    expect(computeDailyStreak(['2026-05-07'], NOW)).toEqual({
      currentStreak: 1,
      bestStreak: 1,
    });
  });

  it('1 dia ontem → 1/1 (não quebra streak imediato)', () => {
    expect(computeDailyStreak(['2026-05-06'], NOW)).toEqual({
      currentStreak: 1,
      bestStreak: 1,
    });
  });

  it('1 dia anteontem → 0/1 (streak quebrou)', () => {
    expect(computeDailyStreak(['2026-05-05'], NOW)).toEqual({
      currentStreak: 0,
      bestStreak: 1,
    });
  });

  it('3 dias consecutivos terminando hoje → 3/3', () => {
    expect(
      computeDailyStreak(['2026-05-05', '2026-05-06', '2026-05-07'], NOW)
    ).toEqual({ currentStreak: 3, bestStreak: 3 });
  });

  it('streak quebra mas best preserva', () => {
    const dates = [
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-04',
      '2026-04-05',
      '2026-05-07',
    ];
    expect(computeDailyStreak(dates, NOW)).toEqual({
      currentStreak: 1,
      bestStreak: 5,
    });
  });

  it('duplicatas ignoradas', () => {
    expect(
      computeDailyStreak(['2026-05-07', '2026-05-07', '2026-05-06'], NOW)
    ).toEqual({ currentStreak: 2, bestStreak: 2 });
  });

  it('inválidos filtrados', () => {
    expect(
      computeDailyStreak(['2026-05-07', 'invalid', '2026-05-06'], NOW)
    ).toEqual({ currentStreak: 2, bestStreak: 2 });
  });

  it('365 dias consecutivos', () => {
    const dates: string[] = [];
    const start = new Date('2025-05-08T00:00:00Z');
    for (let i = 0; i < 365; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      dates.push(d.toISOString().slice(0, 10));
    }
    expect(computeDailyStreak(dates, NOW)).toEqual({
      currentStreak: 365,
      bestStreak: 365,
    });
  });

  it('atravessa virada de mês', () => {
    expect(
      computeDailyStreak(['2026-04-30', '2026-05-01'], new Date('2026-05-01T12:00:00Z'))
    ).toEqual({ currentStreak: 2, bestStreak: 2 });
  });

  it('atravessa virada de ano', () => {
    expect(
      computeDailyStreak(
        ['2025-12-31', '2026-01-01'],
        new Date('2026-01-01T12:00:00Z')
      )
    ).toEqual({ currentStreak: 2, bestStreak: 2 });
  });
});
