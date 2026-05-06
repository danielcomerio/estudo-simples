import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearSearchHistory,
  loadSearchHistory,
  saveSearchHistory,
} from '../search-history';

const KEY = 'estudo-simples:banco:search-history';

// Mock localStorage + window pra ambiente node do Vitest
beforeAll(() => {
  if (typeof window === 'undefined') {
    const store: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    };
    (globalThis as Record<string, unknown>).localStorage = ls;
    (globalThis as Record<string, unknown>).window = { localStorage: ls };
  }
});

beforeEach(() => {
  localStorage.removeItem(KEY);
});
afterEach(() => {
  localStorage.removeItem(KEY);
});

describe('search-history', () => {
  it('vazio quando nada salvo', () => {
    expect(loadSearchHistory()).toEqual([]);
  });

  it('save + load round-trip', () => {
    saveSearchHistory('busca 1');
    saveSearchHistory('busca 2');
    expect(loadSearchHistory()).toEqual(['busca 2', 'busca 1']);
  });

  it('dedup: repete vai pro topo, não duplica', () => {
    saveSearchHistory('busca 1');
    saveSearchHistory('busca 2');
    saveSearchHistory('busca 1');
    expect(loadSearchHistory()).toEqual(['busca 1', 'busca 2']);
  });

  it('cap em 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      saveSearchHistory(`busca ${i}`);
    }
    const h = loadSearchHistory();
    expect(h.length).toBe(10);
    expect(h[0]).toBe('busca 14');
  });

  it('skip se < 3 chars', () => {
    saveSearchHistory('ab');
    expect(loadSearchHistory()).toEqual([]);
  });

  it('skip se for só prefixos', () => {
    saveSearchHistory('tag:foo disc:bar');
    saveSearchHistory('bookmark:1');
    expect(loadSearchHistory()).toEqual([]);
  });

  it('aceita prefixo + texto livre', () => {
    saveSearchHistory('tag:foo direito');
    expect(loadSearchHistory()).toEqual(['tag:foo direito']);
  });

  it('clearSearchHistory remove tudo', () => {
    saveSearchHistory('teste');
    saveSearchHistory('outro');
    clearSearchHistory();
    expect(loadSearchHistory()).toEqual([]);
  });

  it('trim espaços', () => {
    saveSearchHistory('  busca   ');
    expect(loadSearchHistory()).toEqual(['busca']);
  });

  it('JSON corrompido devolve vazio', () => {
    localStorage.setItem(KEY, '{invalid');
    expect(loadSearchHistory()).toEqual([]);
  });
});
