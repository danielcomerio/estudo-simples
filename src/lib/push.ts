/**
 * Helpers puros pra push notifications. Lib de cliente sem network —
 * só validação e shape. Disparo é server-side via lib/push-server.ts
 * (a criar quando integrar FCM/APNS de fato).
 */

export type PushPlatform = 'fcm' | 'apns' | 'web';

export type PushPayload = {
  /** Título curto, max 60 chars (visual cap, não DB). */
  title: string;
  /** Corpo, max 200 chars. */
  body: string;
  /** URL alvo ao clicar (deep link). Default: '/'. */
  url?: string;
  /** Tag pra agregação (Android substitui notif anterior com mesma tag). */
  tag?: string;
  /** Ícone opcional (URL absoluta). FCM/APNS usam o do app por default. */
  icon?: string;
};

/**
 * Valida payload antes de enviar. FCM/APNS rejeitam se title/body
 * vazios; melhor falhar rápido localmente.
 */
export function validatePushPayload(p: unknown): {
  ok: boolean;
  error?: string;
} {
  if (!p || typeof p !== 'object') return { ok: false, error: 'payload inválido' };
  const x = p as Record<string, unknown>;
  if (typeof x.title !== 'string' || !x.title.trim()) {
    return { ok: false, error: 'title obrigatório' };
  }
  if (typeof x.body !== 'string' || !x.body.trim()) {
    return { ok: false, error: 'body obrigatório' };
  }
  if (x.title.length > 200) return { ok: false, error: 'title muito longo (max 200)' };
  if (x.body.length > 1000) return { ok: false, error: 'body muito longo (max 1000)' };
  if (x.url !== undefined && typeof x.url !== 'string') {
    return { ok: false, error: 'url deve ser string' };
  }
  if (x.tag !== undefined && typeof x.tag !== 'string') {
    return { ok: false, error: 'tag deve ser string' };
  }
  return { ok: true };
}

/**
 * Pega user-agent e tenta inferir um label amigável. Não confia em
 * UA pra security — só pra display ("iPhone do João" tipo).
 */
export function inferDeviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Dispositivo desconhecido';
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('linux')) return 'Linux';
  return 'Navegador';
}

/**
 * Detecta plataforma. Caller passa userAgent (browser) ou hint
 * explícito (Capacitor).
 */
export function detectPlatform(input: {
  userAgent?: string | null;
  capacitorPlatform?: string | null;
}): PushPlatform {
  if (input.capacitorPlatform === 'ios') return 'apns';
  if (input.capacitorPlatform === 'android') return 'fcm';
  return 'web';
}
