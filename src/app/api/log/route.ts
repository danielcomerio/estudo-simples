/**
 * POST /api/log — recebe error logs do client (ErrorLogger).
 * Grava em analytics_events com user_id (se logged) ou null.
 *
 * Rate limit alto pra evitar flood (caso bug em loop dispare 1000x).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Rate limit conservador — error logs em loop podem disparar muitos
  const rl = rateLimit(req, {
    max: 30,
    windowMs: 60_000,
    keyPrefix: 'client-log',
  });
  if (rl) return rl;

  let body: { event?: string; props?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (typeof body.event !== 'string' || body.event.length === 0 || body.event.length > 64) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }

  // Cap props pra não estourar CHECK do DB (4000 chars)
  let props = body.props ?? {};
  try {
    const propsStr = JSON.stringify(props);
    if (propsStr.length > 3500) {
      props = { truncated: true, original_length: propsStr.length };
    }
  } catch {
    props = { error: 'invalid_props' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('analytics_events').insert({
    event: body.event,
    user_id: user?.id ?? null,
    props,
  });

  if (error) {
    return NextResponse.json(
      { error: 'log_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
