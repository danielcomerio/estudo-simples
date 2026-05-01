import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAlgorithm, setAlgorithm } from '../settings';

const KEY = 'estudo-simples:settings:algorithm';

// JSDOM não está habilitado (vitest config = node), então mockamos
// localStorage manualmente. Garantimos que window existe pra que o
// código não caia no early-return de SSR.
beforeEach(() => {
  const store: Record<string, string> = {};
  const mockLs = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
  // @ts-expect-error: setup de teste cria window/localStorage
  globalThis.window = { localStorage: mockLs };
  // @ts-expect-error: idem
  globalThis.localStorage = mockLs;
});

afterEach(() => {
  // @ts-expect-error: cleanup
  delete globalThis.window;
  // @ts-expect-error: cleanup
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

describe('getAlgorithm / setAlgorithm', () => {
  it('default sm2 quando nada salvo', () => {
    expect(getAlgorithm()).toBe('sm2');
  });

  it('persiste e lê fsrs', () => {
    setAlgorithm('fsrs');
    expect(getAlgorithm()).toBe('fsrs');
  });

  it('persiste e lê sm2 (round-trip)', () => {
    setAlgorithm('sm2');
    expect(getAlgorithm()).toBe('sm2');
  });

  it('rejeita algoritmo inválido (input não confiável de chamador)', () => {
    expect(() =>
      setAlgorithm('admin' as unknown as 'sm2')
    ).toThrow();
  });

  it('valida valor lido — localStorage adulterado retorna default', () => {
    localStorage.setItem(KEY, 'hacked');
    expect(getAlgorithm()).toBe('sm2');
  });

  it('localStorage com string vazia retorna default', () => {
    localStorage.setItem(KEY, '');
    expect(getAlgorithm()).toBe('sm2');
  });
});
