/**
 * POST /api/telegram/bind — gera bind token pro user atual.
 * Frontend usa pra construir deeplink t.me/bot?start=TOKEN.
 *
 * GET /api/telegram/bind — verifica status do binding (frontend
 * pode polling após user clicar no deeplink).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateBindToken, generateBindUrl } from '@/lib/telegram';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 5,
    windowMs: 60_000,
    keyPrefix: 'tg-bind',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Cleanup tokens expirados/anteriores não-bindados pro user
  await supabase
    .from('telegram_bindings')
    .delete()
    .eq('user_id', user.id)
    .is('bound_at', null);

  const token = generateBindToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

  // Insere registro pendente — chat_id placeholder até bind. Como
  // unique(user_id, chat_id), uso 0 temporário (cleanup acima evita
  // duplicidade).
  const { error } = await supabase.from('telegram_bindings').insert({
    user_id: user.id,
    chat_id: 0,
    bind_token: token,
    bind_token_expires_at: expires,
  });
  if (error) {
    return NextResponse.json(
      { error: 'insert_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    token,
    deeplink: generateBindUrl(token),
    expires_at: expires,
  });
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
    .from('telegram_bindings')
    .select('chat_id, display, bound_at')
    .eq('user_id', user.id)
    .not('bound_at', 'is', null)
    .order('bound_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ bound: false });
  }
  return NextResponse.json({
    bound: true,
    display: data.display,
    chat_id: data.chat_id,
    bound_at: data.bound_at,
  });
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
    .from('telegram_bindings')
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
