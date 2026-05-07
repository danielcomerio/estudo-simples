/**
 * Helper pra postar mensagens em webhooks do Discord (server-side).
 *
 * Discord webhook URL é tipo:
 *   https://discord.com/api/webhooks/<channel_id>/<token>
 *
 * Aceitamos discord.com e discordapp.com (alias legado). Sem retry —
 * 1 tentativa simples; falhou, falhou.
 */

const URL_RE =
  /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isValidDiscordWebhookUrl(url: unknown): url is string {
  return typeof url === 'string' && URL_RE.test(url);
}

export type DiscordSendResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export async function sendDiscordMessage(
  webhookUrl: string,
  content: string,
  username = 'Estudo Simples'
): Promise<DiscordSendResult> {
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    return { ok: false, error: 'invalid_webhook_url' };
  }

  // Discord limita content a 2000 chars
  const safeContent = content.slice(0, 1900);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: safeContent,
        username,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text().catch(() => 'http_error') };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
