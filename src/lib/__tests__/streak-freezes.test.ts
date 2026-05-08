import { describe, expect, it, beforeEach, beforeAll } from 'vitest';

// Mock localStorage e window (env node)
beforeAll(() => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  // @ts-expect-error mock
  globalThis.window = { localStorage: ls };
  // @ts-expect-error mock
  globalThis.localStorage = ls;
});

import {
  readFreezes,
  maybeEarnFromStreak,
  maybeEarnFromSimulado,
  consumeFreeze,
} from '../streak-freezes';

beforeEach(() => {
  localStorage.clear();
});

describe('maybeEarnFromStreak', () => {
  it('streak < 7 → não ganha', () => {
    expect(maybeEarnFromStreak(6)).toBe(0);
  });

  it('streak 7 → ganha 1 freeze', () => {
    expect(maybeEarnFromStreak(7)).toBe(1);
    expect(readFreezes().count).toBe(1);
  });

  it('streak 14 → ganha 2 freezes total (se chamado uma vez)', () => {
    expect(maybeEarnFromStreak(14)).toBe(2);
    expect(readFreezes().count).toBe(2);
  });

  it('idempotente — chamar 2x não duplica', () => {
    maybeEarnFromStreak(7);
    expect(maybeEarnFromStreak(7)).toBe(0);
    expect(readFreezes().count).toBe(1);
  });

  it('cap MAX=3 — streak alto não passa de 3', () => {
    expect(maybeEarnFromStreak(100)).toBe(3);
    expect(readFreezes().count).toBe(3);
  });
});

describe('maybeEarnFromSimulado', () => {
  it('ganha 1 freeze por simulado/dia', () => {
    expect(maybeEarnFromSimulado()).toBe(1);
    expect(readFreezes().count).toBe(1);
  });

  it('limite 1/dia — não ganha 2x no mesmo dia', () => {
    maybeEarnFromSimulado();
    expect(maybeEarnFromSimulado()).toBe(0);
  });

  it('respeita cap MAX=3', () => {
    maybeEarnFromStreak(21); // ganha 3
    expect(maybeEarnFromSimulado()).toBe(0);
  });
});

describe('consumeFreeze', () => {
  it('sem freezes → false', () => {
    expect(consumeFreeze('2026-05-08')).toBe(false);
  });

  it('com freeze → consome e decrementa', () => {
    maybeEarnFromStreak(7);
    expect(readFreezes().count).toBe(1);
    expect(consumeFreeze('2026-05-08')).toBe(true);
    expect(readFreezes().count).toBe(0);
  });

  it('mesma data 2x → segundo retorna false', () => {
    maybeEarnFromStreak(14);
    consumeFreeze('2026-05-08');
    expect(consumeFreeze('2026-05-08')).toBe(false);
  });
});
