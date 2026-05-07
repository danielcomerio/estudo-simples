import { describe, expect, it } from 'vitest';

/**
 * Replica do helper inline em /api/peers/stats. Mantém em sync.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

describe('percentile', () => {
  it('lista vazia → 0', () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it('mediana de [1..10]', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(arr, 0.5)).toBe(6);
  });

  it('p25 de [1..100]', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(arr, 0.25)).toBe(26);
  });

  it('p75 de [1..100]', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(arr, 0.75)).toBe(76);
  });

  it('p100 cap no último elemento', () => {
    expect(percentile([1, 2, 3], 1.0)).toBe(3);
  });

  it('p0 = primeiro elemento', () => {
    expect(percentile([10, 20, 30], 0)).toBe(10);
  });
});
