/**
 * GET /api/ics-token — retorna token atual do user (cria se não existe).
 * POST /api/ics-token — regenera token (invalida o anterior).
 * DELETE /api/ics-token — desabilita feed.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data } = await supabase
    .from('ics_tokens')
    .select('token, enabled, fetch_count, last_fetched_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (data) {
    return NextResponse.json({ token: data });
  }

  // Cria token novo
  const token = newToken();
  const { error } = await supabase
    .from('ics_tokens')
    .insert({ user_id: user.id, token });

  if (error) {
    return NextResponse.json(
      { error: 'create_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    token: { token, enabled: true, fetch_count: 0, last_fetched_at: null },
  });
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 5,
    windowMs: 60_000,
    keyPrefix: 'ics-regenerate',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const token = newToken();
  const { error } = await supabase
    .from('ics_tokens')
    .upsert(
      { user_id: user.id, token, enabled: true },
      { onConflict: 'user_id' }
    );

  if (error) {
    return NextResponse.json(
      { error: 'save_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ token });
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
    .from('ics_tokens')
    .update({ enabled: false })
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: 'disable_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
