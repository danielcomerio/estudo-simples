/**
 * Helpers pra integração com Telegram Bot API.
 *
 * Setup (admin):
 *   1. /newbot no @BotFather → recebe TELEGRAM_BOT_TOKEN.
 *   2. Setar webhook: setWebhook url=https://app.estudosimples.com.br/api/telegram/webhook
 *   3. ENV TELEGRAM_BOT_TOKEN + TELEGRAM_BOT_USERNAME.
 *
 * Custo: zero. Telegram Bot API é grátis ilimitado.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? 'estudosimplesbot';

const API = (method: string) =>
  `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

/**
 * Envia mensagem pra um chat. Retorna ok/error.
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  parseMode: 'HTML' | 'MarkdownV2' | null = 'HTML'
): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN ausente' };
  }
  try {
    const res = await fetch(API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096), // Telegram cap
        parse_mode: parseMode ?? undefined,
        disable_web_page_preview: true,
      }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) {
      return { ok: false, error: j?.description ?? 'erro' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'erro' };
  }
}

/**
 * Gera URL de bind pra o user clicar e iniciar conversa com bot.
 * Token é one-shot, valida até 1 hora.
 */
export function generateBindUrl(token: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(token)}`;
}

/**
 * Token bind: 24 chars hex (curto pra caber em deeplink mas seguro
 * o suficiente pra não brute-force).
 */
export function generateBindToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
