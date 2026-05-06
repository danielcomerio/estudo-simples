import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exportSettings, importSettings } from '../settings-export';

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
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('settings-export', () => {
  describe('exportSettings', () => {
    it('exporta com app + version + prefs', () => {
      localStorage.setItem('estudo-simples:settings:theme', 'dark');
      const r = exportSettings();
      expect(r.app).toBe('estudo-simples');
      expect(r.version).toBe(1);
      expect(r.prefs['estudo-simples:settings:theme']).toBe('dark');
      expect(typeof r.exportedAt).toBe('string');
    });

    it('vazio quando nada salvo', () => {
      const r = exportSettings();
      expect(Object.keys(r.prefs).length).toBe(0);
    });

    it('inclui múltiplas prefs', () => {
      localStorage.setItem('estudo-simples:settings:theme', 'light');
      localStorage.setItem('estudo-simples:settings:dailyGoal', '50');
      localStorage.setItem('estudo-simples:sounds:enabled', '1');
      const r = exportSettings();
      expect(r.prefs['estudo-simples:settings:theme']).toBe('light');
      expect(r.prefs['estudo-simples:settings:dailyGoal']).toBe('50');
      expect(r.prefs['estudo-simples:sounds:enabled']).toBe('1');
    });

    it('ignora prefs fora da lista', () => {
      localStorage.setItem('outra-app:config', 'x');
      const r = exportSettings();
      expect(r.prefs['outra-app:config']).toBeUndefined();
    });
  });

  describe('importSettings', () => {
    it('rejeita data null', () => {
      const r = importSettings(null);
      expect(r.ok).toBe(false);
    });

    it('rejeita app errado', () => {
      const r = importSettings({
        app: 'outro-app',
        version: 1,
        prefs: {},
        exportedAt: '',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Estudo Simples/);
    });

    it('rejeita versão maior', () => {
      const r = importSettings({
        app: 'estudo-simples',
        version: 99,
        prefs: {},
        exportedAt: '',
      });
      expect(r.ok).toBe(false);
    });

    it('importa prefs válidas', () => {
      const data = {
        app: 'estudo-simples',
        version: 1,
        exportedAt: '2026-01-01',
        prefs: {
          'estudo-simples:settings:theme': 'amoled',
          'estudo-simples:settings:dailyGoal': '40',
        },
      };
      const r = importSettings(data);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.restored).toBe(2);
      expect(localStorage.getItem('estudo-simples:settings:theme')).toBe('amoled');
      expect(localStorage.getItem('estudo-simples:settings:dailyGoal')).toBe('40');
    });

    it('rejeita keys sem prefixo (sandbox)', () => {
      const data = {
        app: 'estudo-simples',
        version: 1,
        exportedAt: '',
        prefs: {
          'malicious:key': 'evil',
          'estudo-simples:settings:theme': 'dark',
        },
      };
      const r = importSettings(data);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.restored).toBe(1);
      expect(localStorage.getItem('malicious:key')).toBeNull();
    });

    it('rejeita valores muito grandes (>100KB)', () => {
      const big = 'x'.repeat(200_000);
      const data = {
        app: 'estudo-simples',
        version: 1,
        exportedAt: '',
        prefs: { 'estudo-simples:big': big },
      };
      const r = importSettings(data);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.restored).toBe(0);
    });

    it('round-trip completo', () => {
      localStorage.setItem('estudo-simples:settings:theme', 'dark');
      localStorage.setItem('estudo-simples:settings:fontSize', 'large');
      const exp = exportSettings();
      localStorage.clear();
      const imp = importSettings(exp);
      expect(imp.ok).toBe(true);
      expect(localStorage.getItem('estudo-simples:settings:theme')).toBe('dark');
      expect(localStorage.getItem('estudo-simples:settings:fontSize')).toBe('large');
    });
  });
});
