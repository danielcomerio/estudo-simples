import { describe, expect, it } from 'vitest';
import { estimateCostCents } from '../ai-usage';

describe('estimateCostCents', () => {
  it('modelo desconhecido → 0', () => {
    expect(estimateCostCents('modelo-x', 1000, 500)).toBe(0);
  });

  it('gpt-4o-mini: 1M in + 1M out', () => {
    // pricing: 15 cents/Mtok input, 60 cents/Mtok output
    const c = estimateCostCents('gpt-4o-mini', 1_000_000, 1_000_000);
    expect(c).toBeCloseTo(15 + 60, 5);
  });

  it('claude-haiku-4-5: proporção menor', () => {
    // 1k tokens cada
    const c = estimateCostCents('claude-haiku-4-5-20251001', 1000, 1000);
    expect(c).toBeCloseTo(0.025 + 0.125, 5);
  });

  it('gemini-2.0-flash-exp: free → 0', () => {
    expect(estimateCostCents('gemini-2.0-flash-exp', 1_000_000, 1_000_000)).toBe(
      0
    );
  });

  it('zero tokens → 0', () => {
    expect(estimateCostCents('gpt-4o-mini', 0, 0)).toBe(0);
  });

  it('input apenas conta input pricing', () => {
    const c = estimateCostCents('gpt-4o', 1_000_000, 0);
    expect(c).toBeCloseTo(250, 5);
  });
});
