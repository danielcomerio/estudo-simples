import { describe, expect, it } from 'vitest';
import {
  buildTelegramText,
  escapeTelegramHtml,
  shouldFallbackToTelegram,
} from '../notify-helpers';

describe('escapeTelegramHtml', () => {
  it('escapa &, <, >', () => {
    expect(escapeTelegramHtml('a & b < c > d')).toBe(
      'a &amp; b &lt; c &gt; d'
    );
  });

  it('texto sem chars especiais inalterado', () => {
    expect(escapeTelegramHtml('hello world')).toBe('hello world');
  });

  it('idempotente quando já escapado uma vez', () => {
    const once = escapeTelegramHtml('<a>');
    const twice = escapeTelegramHtml(once);
    // & vira &amp;, então uma 2ª escapada vira &amp;amp; — comportamento
    // esperado, mas confirma intencionalmente:
    expect(twice).toContain('&amp;lt;');
  });

  it('aspas e quotes não escapados (Telegram aceita)', () => {
    expect(escapeTelegramHtml(`"quotes" e 'aspas'`)).toBe(
      `"quotes" e 'aspas'`
    );
  });
});

describe('buildTelegramText', () => {
  it('formata title bold + body sem url', () => {
    const out = buildTelegramText({
      title: 'Vencendo',
      body: '5 questões',
    });
    expect(out).toContain('<b>Vencendo</b>');
    expect(out).toContain('5 questões');
    expect(out).not.toContain('<a href');
  });

  it('inclui link "Abrir no app" se url presente', () => {
    const out = buildTelegramText({
      title: 't',
      body: 'b',
      url: '/estudar',
    });
    expect(out).toContain(
      '<a href="https://app.estudosimples.com.br/estudar">'
    );
    expect(out).toContain('Abrir no app');
  });

  it('escapa HTML pra evitar injection no Telegram', () => {
    const out = buildTelegramText({
      title: '<script>alert(1)</script>',
      body: 'a & b > c',
    });
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&amp;');
    expect(out).not.toContain('<script>');
  });

  it('separação correta com \\n duplo entre seções', () => {
    const out = buildTelegramText({
      title: 'T',
      body: 'B',
      url: '/x',
    });
    const lines = out.split('\n');
    expect(lines[0]).toBe('<b>T</b>');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('B');
    expect(lines[3]).toBe('');
    expect(lines[4]).toContain('<a href');
  });

  it('payload com title vazio não quebra', () => {
    const out = buildTelegramText({ title: '', body: 'msg' });
    expect(out).toContain('<b></b>');
  });
});

describe('shouldFallbackToTelegram', () => {
  it('0 push enviados → fallback', () => {
    expect(shouldFallbackToTelegram(0)).toBe(true);
  });

  it('>= 1 push enviado → não fallback', () => {
    expect(shouldFallbackToTelegram(1)).toBe(false);
    expect(shouldFallbackToTelegram(5)).toBe(false);
    expect(shouldFallbackToTelegram(100)).toBe(false);
  });
});
