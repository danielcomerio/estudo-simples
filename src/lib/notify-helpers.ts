/**
 * Helpers PUROS extraídos de lib/notify.ts pra serem testáveis sem
 * stubs de Supabase/network.
 *
 * Tudo que faz I/O continua em notify.ts.
 */

import type { PushPayload } from './push';

const APP_BASE_URL = 'https://app.estudosimples.com.br';

/** Escape mínimo pra HTML do Telegram (parse_mode=HTML). */
export function escapeTelegramHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Formata payload de push pra mensagem Telegram (HTML).
 * Inclui:
 *  - <b>title</b>
 *  - body
 *  - link "Abrir no app" (se payload.url)
 */
export function buildTelegramText(payload: PushPayload): string {
  const parts = [
    `<b>${escapeTelegramHtml(payload.title)}</b>`,
    '',
    escapeTelegramHtml(payload.body),
  ];
  if (payload.url) {
    parts.push('', `<a href="${APP_BASE_URL}${payload.url}">Abrir no app</a>`);
  }
  return parts.join('\n');
}

/**
 * Decide se deve tentar Telegram (push falhou OU não há devices).
 * Decision input: número de devices que receberam push com sucesso.
 */
export function shouldFallbackToTelegram(pushSent: number): boolean {
  return pushSent === 0;
}
