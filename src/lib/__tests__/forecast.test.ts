import { describe, expect, it } from 'vitest';
import { computeForecast } from '../forecast';

const DAY_MS = 86400000;
const NOW = new Date('2026-05-07T12:00:00Z').getTime();

function dailyDates(daysBack: number, perDay: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < daysBack; d++) {
    for (let i = 0; i < perDay; i++) {
      out.push(NOW - d * DAY_MS - i * 1000);
    }
  }
  return out;
}

describe('computeForecast', () => {
  it('meta já atingida → 0 dias', () => {
    const r = computeForecast({
      reviewDates: [],
      currentCount: 100,
      targetCount: 100,
      now: NOW,
    });
    expect(r.daysToTarget).toBe(0);
    expect(r.summary).toMatch(/atingida/i);
  });

  it('sem revisões na janela → null', () => {
    const r = computeForecast({
      reviewDates: [],
      currentCount: 0,
      targetCount: 100,
      now: NOW,
    });
    expect(r.daysToTarget).toBe(null);
    expect(r.targetDate).toBe(null);
  });

  it('media 10/dia, falta 100 → 10 dias', () => {
    const r = computeForecast({
      reviewDates: dailyDates(14, 10),
      currentCount: 0,
      targetCount: 100,
      windowDays: 14,
      now: NOW,
    });
    expect(r.avgPerDay).toBeCloseTo(10, 1);
    expect(r.daysToTarget).toBe(10);
  });

  it('media 5/dia, falta 100 → 20 dias', () => {
    const r = computeForecast({
      reviewDates: dailyDates(14, 5),
      currentCount: 0,
      targetCount: 100,
      windowDays: 14,
      now: NOW,
    });
    expect(r.daysToTarget).toBe(20);
  });

  it('janela menor → usa apenas reviews recentes', () => {
    const r7 = computeForecast({
      reviewDates: dailyDates(14, 10),
      currentCount: 0,
      targetCount: 50,
      windowDays: 7,
      now: NOW,
    });
    const r14 = computeForecast({
      reviewDates: dailyDates(14, 10),
      currentCount: 0,
      targetCount: 50,
      windowDays: 14,
      now: NOW,
    });
    // ambos atingem ~10/dia mas r7 conta só os mais recentes
    expect(r7.avgPerDay).toBeGreaterThan(0);
    expect(r14.avgPerDay).toBeGreaterThan(0);
  });

  it('targetDate em formato YYYY-MM-DD', () => {
    const r = computeForecast({
      reviewDates: dailyDates(14, 10),
      currentCount: 0,
      targetCount: 100,
      now: NOW,
    });
    expect(r.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('summary curto pra <= 7 dias', () => {
    const r = computeForecast({
      reviewDates: dailyDates(14, 20),
      currentCount: 100,
      targetCount: 110,
      now: NOW,
    });
    expect(r.summary).toContain('1 dia');
  });

  it('summary longo pra > 90 dias sugere aumentar ritmo', () => {
    const r = computeForecast({
      reviewDates: dailyDates(14, 1),
      currentCount: 0,
      targetCount: 200,
      now: NOW,
    });
    expect(r.summary).toMatch(/cortaria pela metade/);
  });

  it('arredonda pra cima (ceil)', () => {
    // 3/dia, falta 10 → 10/3 = 3.33 → 4 dias
    const r = computeForecast({
      reviewDates: dailyDates(14, 3),
      currentCount: 0,
      targetCount: 10,
      now: NOW,
    });
    expect(r.daysToTarget).toBe(4);
  });

  it('ignora dates futuras (out of window)', () => {
    const futureDates = [NOW + 5 * DAY_MS]; // futuro
    const r = computeForecast({
      reviewDates: [...dailyDates(14, 5), ...futureDates],
      currentCount: 0,
      targetCount: 100,
      now: NOW,
    });
    // future ignorado, avg = 5
    expect(r.avgPerDay).toBeCloseTo(5, 1);
  });
});
