/**
 * GET/POST/DELETE /api/deck-favorites — gerencia favoritos do user.
 *
 * GET: lista deck_ids que user favoritou.
 * POST: { deck_id } adiciona favorito (idempotente).
 * DELETE: ?deck_id=... remove favorito.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

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
    .from('deck_favorites')
    .select('deck_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 30,
    windowMs: 60_000,
    keyPrefix: 'deck-fav-add',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { deck_id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (typeof body.deck_id !== 'string' || !body.deck_id) {
    return NextResponse.json(
      { error: 'invalid_deck_id' },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('deck_favorites').upsert(
    {
      user_id: user.id,
      deck_id: body.deck_id,
    },
    { onConflict: 'user_id,deck_id' }
  );

  if (error) {
    return NextResponse.json(
      { error: 'add_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const deckId = url.searchParams.get('deck_id');
  if (!deckId) {
    return NextResponse.json({ error: 'missing_deck_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('deck_favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('deck_id', deckId);

  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
