import { describe, expect, it } from 'vitest';
import { generateBindToken, generateBindUrl } from '../telegram';

describe('generateBindToken', () => {
  it('gera 24 chars hex', () => {
    const t = generateBindToken();
    expect(t).toHaveLength(24);
    expect(t).toMatch(/^[a-z0-9]+$/);
  });

  it('é único entre chamadas', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateBindToken());
    expect(tokens.size).toBe(100);
  });
});

describe('generateBindUrl', () => {
  it('formato t.me/BOT?start=TOKEN', () => {
    const url = generateBindUrl('abc123');
    expect(url).toMatch(/^https:\/\/t\.me\/[^?]+\?start=abc123$/);
  });

  it('encode tokens com chars especiais', () => {
    const url = generateBindUrl('a&b=c');
    expect(url).toContain('?start=a%26b%3Dc');
  });
});
