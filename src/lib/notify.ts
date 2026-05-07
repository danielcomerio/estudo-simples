/**
 * Helper unificado pra notificar user via canal disponível.
 *
 * Estratégia:
 *   1. Tenta Web Push (todos devices ativos do user)
 *   2. Tenta Telegram (se vinculado)
 *
 * Não duplica entre canais — se Web Push enviou >0, NÃO manda Telegram.
 * Lógica: push é mais imediato; Telegram é fallback pra users que não
 * têm browser ativo.
 *
 * Use em cron jobs e webhooks server-side. NÃO importar de Client
 * Components.
 */

import { getSupabaseAdmin } from './supabase/admin';
import { sendPushToUser } from './push-server';
import { sendTelegramMessage } from './telegram';
import type { PushPayload } from './push';
import { buildTelegramText, shouldFallbackToTelegram } from './notify-helpers';

export type NotifyResult = {
  channel: 'push' | 'telegram' | 'none';
  success: boolean;
  details?: string;
};

/**
 * Notifica user. Tenta push primeiro, Telegram como fallback.
 */
export async function notifyUser(
  userId: string,
  payload: PushPayload
): Promise<NotifyResult> {
  // Tenta Web Push
  const pushResult = await sendPushToUser(userId, payload);
  if (!shouldFallbackToTelegram(pushResult.sent)) {
    return {
      channel: 'push',
      success: true,
      details: `${pushResult.sent} device(s)`,
    };
  }

  // Fallback: Telegram
  const sb = getSupabaseAdmin();
  const { data: tg } = await sb
    .from('telegram_bindings')
    .select('chat_id')
    .eq('user_id', userId)
    .not('bound_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (tg?.chat_id) {
    const text = buildTelegramText(payload);
    const r = await sendTelegramMessage(tg.chat_id, text, 'HTML');
    if (r.ok) {
      return {
        channel: 'telegram',
        success: true,
        details: `chat ${tg.chat_id}`,
      };
    }
    return {
      channel: 'telegram',
      success: false,
      details: r.error,
    };
  }

  return { channel: 'none', success: false, details: 'sem canais ativos' };
}

// buildTelegramText/escape extraídos pra ./notify-helpers (testáveis).
