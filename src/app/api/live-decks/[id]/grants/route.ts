/**
 * POST /api/live-decks/[id]/grants — concede acesso ao deck via email.
 * GET /api/live-decks/[id]/grants — lista grants do deck (só owner).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Owner-only check via JOIN — a RLS já garante mas explicito por defesa.
  const { data: deck } = await supabase
    .from('live_decks')
    .select('id')
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (!deck) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('live_deck_grants')
    .select(
      'id, grantee_email, grantee_user_id, permission, created_at, revoked_at, frozen_share_token'
    )
    .eq('deck_id', params.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ grants: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 20,
    windowMs: 60_000,
    keyPrefix: 'grant-create',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { email?: string; permission?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@') || email.length > 320) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Email inválido.' },
      { status: 400 }
    );
  }
  if (email === user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Não pode compartilhar consigo mesmo.' },
      { status: 400 }
    );
  }

  // Permission: só 'read' por enquanto (Modelo A read-write fica pra futuro)
  const permission = body.permission === 'read_write' ? 'read_write' : 'read';

  // Verifica que deck é do user (RLS garante; double-check)
  const { data: deck } = await supabase
    .from('live_decks')
    .select('id')
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (!deck) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Tenta resolver grantee_user_id se já existe conta com esse email
  // (pre-grant funciona pra emails sem conta — handle_new_user resolve
  // depois)
  // Não temos auth.users via PostgREST normal — service role seria
  // overhead. Deixa null; trigger resolve se/quando user signup.

  const { error } = await supabase.from('live_deck_grants').insert({
    deck_id: params.id,
    owner_user_id: user.id,
    grantee_email: email,
    permission,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        {
          error: 'already_granted',
          message: 'Esse email já tem acesso a este deck.',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'insert_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
