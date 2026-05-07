import { describe, expect, it } from 'vitest';
import { buildCacheKey } from '../ai-cache';

describe('buildCacheKey', () => {
  it('determinístico: mesmo input → mesmo hash', async () => {
    const a = await buildCacheKey('openai', 'gpt-4o-mini', 'oi mundo');
    const b = await buildCacheKey('openai', 'gpt-4o-mini', 'oi mundo');
    expect(a).toBe(b);
  });

  it('hash hex de 64 chars (sha256)', async () => {
    const k = await buildCacheKey('openai', 'gpt-4o-mini', 'x');
    expect(k).toMatch(/^[a-f0-9]{64}$/);
  });

  it('provider diferente → hash diferente', async () => {
    const a = await buildCacheKey('openai', 'gpt-4o-mini', 'p');
    const b = await buildCacheKey('anthropic', 'gpt-4o-mini', 'p');
    expect(a).not.toBe(b);
  });

  it('model diferente → hash diferente', async () => {
    const a = await buildCacheKey('openai', 'gpt-4o-mini', 'p');
    const b = await buildCacheKey('openai', 'gpt-4o', 'p');
    expect(a).not.toBe(b);
  });

  it('prompt diferente → hash diferente', async () => {
    const a = await buildCacheKey('openai', 'gpt-4o-mini', 'p');
    const b = await buildCacheKey('openai', 'gpt-4o-mini', 'q');
    expect(a).not.toBe(b);
  });

  it('handle UTF-8 (acentos, emojis)', async () => {
    const k = await buildCacheKey('openai', 'gpt-4o-mini', 'olá 🎉 ção');
    expect(k).toMatch(/^[a-f0-9]{64}$/);
  });

  it('prompt vazio funciona', async () => {
    const k = await buildCacheKey('openai', 'gpt-4o-mini', '');
    expect(k).toMatch(/^[a-f0-9]{64}$/);
  });
});
