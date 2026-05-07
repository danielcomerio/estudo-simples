import { describe, expect, it, beforeEach } from 'vitest';
import {
  getAIKey,
  setAIKey,
  hasAnyAIKey,
  getDefaultProvider,
  maskKey,
  PROVIDER_LABELS,
} from '../ai-keys';

// Mock localStorage pra testes
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(k: string): string | null {
    return this.store[k] ?? null;
  }
  setItem(k: string, v: string): void {
    this.store[k] = v;
  }
  removeItem(k: string): void {
    delete this.store[k];
  }
  clear(): void {
    this.store = {};
  }
}

beforeEach(() => {
  // @ts-expect-error - mock global
  global.localStorage = new LocalStorageMock();
});

describe('setAIKey + getAIKey', () => {
  it('salva e recupera chave válida OpenAI', () => {
    setAIKey('openai', 'sk-' + 'a'.repeat(40));
    expect(getAIKey('openai')).toBe('sk-' + 'a'.repeat(40));
  });

  it('rejeita chave OpenAI sem prefix sk-', () => {
    expect(() =>
      setAIKey('openai', 'invalid-' + 'a'.repeat(40))
    ).toThrow(/sk-/);
  });

  it('rejeita chave Anthropic sem prefix sk-ant-', () => {
    expect(() =>
      setAIKey('anthropic', 'sk-' + 'a'.repeat(40))
    ).toThrow(/sk-ant-/);
  });

  it('aceita Gemini sem prefix obrigatório', () => {
    setAIKey('gemini', 'AIzaSyA' + 'b'.repeat(33));
    expect(getAIKey('gemini')).toBeTruthy();
  });

  it('rejeita chave muito curta', () => {
    expect(() => setAIKey('openai', 'sk-short')).toThrow(/tamanho/);
  });

  it('null/empty: remove a chave', () => {
    setAIKey('openai', 'sk-' + 'a'.repeat(40));
    expect(getAIKey('openai')).toBeTruthy();
    setAIKey('openai', null);
    expect(getAIKey('openai')).toBeNull();
    setAIKey('openai', 'sk-' + 'a'.repeat(40));
    setAIKey('openai', '');
    expect(getAIKey('openai')).toBeNull();
  });

  it('trim whitespace', () => {
    setAIKey('openai', '  sk-' + 'a'.repeat(40) + '  ');
    expect(getAIKey('openai')).toBe('sk-' + 'a'.repeat(40));
  });
});

describe('hasAnyAIKey', () => {
  it('false quando vazio', () => {
    expect(hasAnyAIKey()).toBe(false);
  });
  it('true após salvar qualquer', () => {
    setAIKey('anthropic', 'sk-ant-' + 'a'.repeat(40));
    expect(hasAnyAIKey()).toBe(true);
  });
});

describe('getDefaultProvider', () => {
  it('null sem nenhum', () => {
    expect(getDefaultProvider()).toBeNull();
  });
  it('prioriza anthropic > openai > gemini', () => {
    setAIKey('gemini', 'AIzaSy' + 'g'.repeat(34));
    expect(getDefaultProvider()).toBe('gemini');
    setAIKey('openai', 'sk-' + 'o'.repeat(40));
    expect(getDefaultProvider()).toBe('openai');
    setAIKey('anthropic', 'sk-ant-' + 'a'.repeat(40));
    expect(getDefaultProvider()).toBe('anthropic');
  });
});

describe('maskKey', () => {
  it('mascara prefixo + sufixo, esconde meio', () => {
    expect(maskKey('sk-abc123def456')).toBe('sk-a****f456');
  });
  it('chave muito curta vira ****', () => {
    expect(maskKey('abc')).toBe('****');
    expect(maskKey('12345678')).toBe('****');
  });
});

describe('PROVIDER_LABELS', () => {
  it('contém todas as labels', () => {
    expect(PROVIDER_LABELS.openai).toContain('OpenAI');
    expect(PROVIDER_LABELS.anthropic).toContain('Anthropic');
    expect(PROVIDER_LABELS.gemini).toContain('Gemini');
  });
});
