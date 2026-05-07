import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LATEST_VERSION,
  WHATS_NEW,
  getLastSeenVersion,
  hasUnseenChanges,
  markVersionSeen,
} from '../whats-new';

describe('WHATS_NEW', () => {
  it('LATEST_VERSION existe na lista', () => {
    const found = WHATS_NEW.find((e) => e.version === LATEST_VERSION);
    expect(found).toBeDefined();
  });

  it('cada entry tem version, date, highlights', () => {
    for (const e of WHATS_NEW) {
      expect(e.version).toBeTruthy();
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(e.highlights)).toBe(true);
      expect(e.highlights.length).toBeGreaterThan(0);
    }
  });

  it('LATEST_VERSION é o primeiro (mais recente)', () => {
    expect(WHATS_NEW[0].version).toBe(LATEST_VERSION);
  });
});

describe('localStorage helpers', () => {
  let store: Record<string, string> = {};
  beforeEach(() => {
    store = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getLastSeenVersion: null inicialmente', () => {
    expect(getLastSeenVersion()).toBe(null);
  });

  it('markVersionSeen + getLastSeenVersion roundtrip', () => {
    markVersionSeen('v1');
    expect(getLastSeenVersion()).toBe('v1');
  });

  it('markVersionSeen sem arg usa LATEST_VERSION', () => {
    markVersionSeen();
    expect(getLastSeenVersion()).toBe(LATEST_VERSION);
  });

  it('hasUnseenChanges: true quando nunca visto', () => {
    expect(hasUnseenChanges()).toBe(true);
  });

  it('hasUnseenChanges: false após mark', () => {
    markVersionSeen();
    expect(hasUnseenChanges()).toBe(false);
  });

  it('hasUnseenChanges: true se versão antiga vista', () => {
    markVersionSeen('versao-antiga');
    expect(hasUnseenChanges()).toBe(true);
  });
});
