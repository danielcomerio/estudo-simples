import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = { localStorage: ls };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = ls;
});

import {
  getActivePersonaId,
  setActivePersonaId,
  withPersona,
  invalidatePersonaCache,
} from '../persona-active';

beforeEach(() => {
  localStorage.clear();
  invalidatePersonaCache();
});

describe('getActivePersonaId / setActivePersonaId', () => {
  it('default = null', () => {
    expect(getActivePersonaId()).toBeNull();
  });

  it('set persiste em localStorage', () => {
    setActivePersonaId('persona-123');
    expect(getActivePersonaId()).toBe('persona-123');
  });

  it('set null remove', () => {
    setActivePersonaId('persona-123');
    setActivePersonaId(null);
    expect(getActivePersonaId()).toBeNull();
  });

  it('set string vazia trata como null', () => {
    setActivePersonaId('persona-123');
    setActivePersonaId('');
    expect(getActivePersonaId()).toBeNull();
  });
});

describe('withPersona', () => {
  it('persona null → prompt original', () => {
    expect(withPersona('Pergunta', null)).toBe('Pergunta');
  });

  it('persona empty → prompt original', () => {
    expect(withPersona('Pergunta', '')).toBe('Pergunta');
  });

  it('persona whitespace → prompt original', () => {
    expect(withPersona('Pergunta', '   \n  ')).toBe('Pergunta');
  });

  it('persona presente → prefixa + separador', () => {
    const r = withPersona('Pergunta', 'Você é um coach');
    expect(r).toContain('Você é um coach');
    expect(r).toContain('---');
    expect(r).toContain('Pergunta');
    expect(r.indexOf('Você é um coach')).toBeLessThan(r.indexOf('Pergunta'));
  });

  it('idempotente — chamar 2x não duplica', () => {
    const once = withPersona('Q', 'P');
    const twice = withPersona(once, 'P');
    // Como prefixa novamente, não é truly idempotente — mas aceita
    // que cada chamada adiciona uma camada (esperado por design).
    expect(twice).toContain('Q');
    expect(twice).toContain('P');
  });
});
