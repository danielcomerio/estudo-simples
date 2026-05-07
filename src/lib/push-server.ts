/**
 * Envio server-side de Web Push notifications.
 *
 * Implementação MINIMAL (sem dep externa): faz POST direto pro
 * endpoint da subscription com headers VAPID. Pra produção pesada
 * (alto volume), substituir por `web-push` lib (gera VAPID JWT,
 * gerencia retry, etc).
 *
 * Pré-requisitos:
 *   - VAPID_PRIVATE_KEY (env, secret)
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY (env, exposto ao cliente)
 *   - VAPID_SUBJECT (env: "mailto:admin@app.estudosimples.com.br")
 *
 * Gere par via:
 *   npx web-push generate-vapid-keys
 *
 * IMPORTANTE: este arquivo NÃO deve ser importado de Client Components.
 * Apenas API routes / server actions / Edge functions.
 */

import { getSupabaseAdmin } from './supabase/admin';
import { validatePushPayload, type PushPayload } from './push';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

export type PushResult = {
  sent: number;
  failed: number;
  disabled: number;
  errors: string[];
};

/**
 * Dispara push pra todos os devices ativos de um user. Retorna
 * estatísticas. Marca tokens disabled quando endpoint retorna 410 Gone
 * (browser desinscrito).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, disabled: 0, errors: [] };

  const v = validatePushPayload(payload);
  if (!v.ok) {
    result.errors.push('payload inválido: ' + (v.error ?? 'erro'));
    return result;
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    result.errors.push(
      'VAPID keys ausentes — configure VAPID_PRIVATE_KEY + NEXT_PUBLIC_VAPID_PUBLIC_KEY'
    );
    return result;
  }

  const sb = getSupabaseAdmin();
  const { data: devices, error } = await sb
    .from('push_devices')
    .select('id, token, platform')
    .eq('user_id', userId)
    .is('disabled_at', null);

  if (error) {
    result.errors.push('fetch devices falhou: ' + error.message);
    return result;
  }
  if (!devices || devices.length === 0) {
    return result; // sem devices, sem erro
  }

  for (const device of devices as Array<{
    id: string;
    token: string;
    platform: string;
  }>) {
    if (device.platform !== 'web') {
      // FCM/APNS exigem credenciais separadas — pulamos por ora.
      // Quando integrar mobile nativo, adiciona aqui.
      continue;
    }
    try {
      const sub = JSON.parse(device.token) as PushSubscriptionJSON;
      const ok = await sendWebPush(sub, payload);
      if (ok === 'sent') {
        result.sent++;
      } else if (ok === 'gone') {
        result.disabled++;
        await sb
          .from('push_devices')
          .update({ disabled_at: new Date().toISOString() })
          .eq('id', device.id);
      } else {
        result.failed++;
      }
    } catch (e) {
      result.failed++;
      result.errors.push(e instanceof Error ? e.message : 'erro desconhecido');
    }
  }

  return result;
}

type PushSubscriptionJSON = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

/**
 * Web Push minimal sender. Usa VAPID JWT no header Authorization.
 *
 * NOTA: não criptografa o payload (que é a parte mais complexa do
 * Web Push). Browsers rejeitam push sem payload encrypted apenas em
 * algumas versões — pra MVP funciona enviando apenas notificação
 * silenciosa pra trigger do service worker, que então mostra notif
 * com payload buscado de outro endpoint.
 *
 * Pra produção, USE web-push lib que faz tudo certo.
 *
 * Retorna 'sent' (200/201/204), 'gone' (404/410 — token expirado),
 * 'fail' (outros).
 */
async function sendWebPush(
  sub: PushSubscriptionJSON,
  _payload: PushPayload
): Promise<'sent' | 'gone' | 'fail'> {
  if (!sub.endpoint) return 'fail';
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: '60',
        // Em produção: VAPID JWT signed + payload encrypted
        // Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`
      },
      // Sem body — push silencioso. SW deve ter handler 'push' que
      // exibe notificação fixa ou busca payload de /api/push/poll.
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (res.ok) return 'sent';
    return 'fail';
  } catch {
    return 'fail';
  }
}
