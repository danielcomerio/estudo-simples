/**
 * POST /api/push/register — registra device token pra push notifications.
 *
 * Body: { token: string, platform: 'fcm' | 'apns' | 'web', label?: string }
 *
 * Idempotente — re-register com mesmo (user, token) atualiza last_seen_at.
 *
 * Sem rate limit agressivo (registros são raros — só ao instalar/login).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';
import { detectPlatform, inferDeviceLabel } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 30,
    windowMs: 60_000,
    keyPrefix: 'push-register',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: {
    token?: string;
    platform?: string;
    label?: string;
    capacitor_platform?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (typeof body.token !== 'string' || body.token.length < 32 || body.token.length > 2048) {
    return NextResponse.json(
      { error: 'invalid_token' },
      { status: 400 }
    );
  }

  // Auto-detecta platform se cliente não passou explicitamente.
  const platform =
    body.platform === 'fcm' || body.platform === 'apns' || body.platform === 'web'
      ? body.platform
      : detectPlatform({
          userAgent: req.headers.get('user-agent'),
          capacitorPlatform: body.capacitor_platform,
        });

  const label =
    typeof body.label === 'string' && body.label.trim()
      ? body.label.trim().slice(0, 200)
      : inferDeviceLabel(req.headers.get('user-agent'));

  // Upsert: atualiza last_seen_at se token já existe pro user.
  const { error } = await supabase
    .from('push_devices')
    .upsert(
      {
        user_id: user.id,
        token: body.token,
        platform,
        device_label: label,
        last_seen_at: new Date().toISOString(),
        disabled_at: null,
      },
      { onConflict: 'user_id,token' }
    );

  if (error) {
    return NextResponse.json(
      { error: 'register_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, platform, label });
}

/**
 * DELETE /api/push/register?token=xxx — remove (ou desabilita) device
 * token. Idempotente.
 */
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('push_devices')
    .delete()
    .eq('user_id', user.id)
    .eq('token', token);

  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
