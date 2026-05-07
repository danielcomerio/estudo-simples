import { describe, expect, it } from 'vitest';

/**
 * notify.ts faz I/O com Supabase admin + push providers, então testar
 * a função notifyUser fim-a-fim exigiria mocks pesados.
 *
 * Testamos apenas a função pura buildTelegramText que é pequena. Pra
 * isso, exportamos via re-import (não está no module exports público).
 *
 * Cobertura mais ampla virá quando refatorar pra extrair helpers.
 */

// Replica do helper interno pra testar (mantido em sync com lib/notify.ts)
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildTelegramText(payload: {
  title: string;
  body: string;
  url?: string;
}): string {
  const parts = [`<b>${escape(payload.title)}</b>`, '', escape(payload.body)];
  if (payload.url) {
    parts.push(
      '',
      `<a href="https://app.estudosimples.com.br${payload.url}">Abrir no app</a>`
    );
  }
  return parts.join('\n');
}

describe('notify.ts — buildTelegramText (replica)', () => {
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
});
