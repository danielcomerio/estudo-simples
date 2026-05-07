/**
 * GET/PUT/DELETE /api/discord — gerencia webhook Discord do user.
 *
 * GET: retorna { configured: boolean, enabled: boolean }
 *      (NUNCA retorna a URL — é secret).
 * PUT: { webhook_url } configura/substitui.
 * DELETE: remove.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';
import { isValidDiscordWebhookUrl, sendDiscordMessage } from '@/lib/discord';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('discord_webhooks')
    .select('enabled, last_used_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    configured: !!data,
    enabled: data?.enabled ?? false,
    last_used_at: data?.last_used_at ?? null,
    created_at: data?.created_at ?? null,
  });
}

export async function PUT(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 5,
    windowMs: 60_000,
    keyPrefix: 'discord-config',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { webhook_url?: unknown; enabled?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!isValidDiscordWebhookUrl(body.webhook_url)) {
    return NextResponse.json(
      { error: 'invalid_webhook_url' },
      { status: 400 }
    );
  }

  // Test ping pra validar a URL realmente funciona antes de salvar
  const ping = await sendDiscordMessage(
    body.webhook_url,
    '✓ Webhook conectado ao Estudo Simples!'
  );
  if (!ping.ok) {
    return NextResponse.json(
      { error: 'ping_failed', message: ping.error ?? 'unreachable' },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('discord_webhooks').upsert(
    {
      user_id: user.id,
      webhook_url: body.webhook_url,
      enabled: body.enabled !== false,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return NextResponse.json(
      { error: 'save_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { error } = await supabase
    .from('discord_webhooks')
    .delete()
    .eq('user_id', user.id);
  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
