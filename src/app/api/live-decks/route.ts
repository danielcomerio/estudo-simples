/**
 * GET /api/live-decks — lista decks (próprios + recebidos).
 * POST /api/live-decks — cria novo deck a partir de questões selecionadas.
 *
 * Gate Pro/Master via canShareDecks.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMyPlan, canShareDecks } from '@/lib/billing';
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

  // Decks próprios
  const { data: own, error: ownErr } = await supabase
    .from('live_decks')
    .select('id, name, description, created_at')
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (ownErr) {
    return NextResponse.json(
      { error: 'fetch_failed', message: ownErr.message },
      { status: 500 }
    );
  }

  // Grants recebidos (decks que outros donos compartilharam comigo)
  const { data: received, error: recErr } = await supabase
    .from('live_deck_grants')
    .select(
      'id, deck_id, owner_user_id, permission, created_at, revoked_at, frozen_share_token, live_decks(name, description)'
    )
    .eq('grantee_user_id', user.id);
  if (recErr) {
    return NextResponse.json(
      { error: 'fetch_failed', message: recErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    own: own ?? [],
    received: received ?? [],
  });
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 5,
    windowMs: 60_000,
    keyPrefix: 'live-deck-create',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const plan = await getMyPlan(supabase);
  if (!canShareDecks(plan)) {
    return NextResponse.json(
      { error: 'pro_required', message: 'Compartilhar bancos é exclusivo Pro.' },
      { status: 403 }
    );
  }

  let body: { name?: string; description?: string; questionIds?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 200)
      : null;
  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, 1000)
      : null;
  const questionIds = Array.isArray(body.questionIds)
    ? (body.questionIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  if (!name) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Nome obrigatório.' },
      { status: 400 }
    );
  }
  if (questionIds.length === 0) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Selecione ao menos 1 questão.' },
      { status: 400 }
    );
  }
  if (questionIds.length > 5000) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Máximo 5000 questões por deck.' },
      { status: 400 }
    );
  }

  // Cria deck
  const { data: deck, error: deckErr } = await supabase
    .from('live_decks')
    .insert({
      owner_user_id: user.id,
      name,
      description,
    })
    .select('id, name')
    .single();
  if (deckErr || !deck) {
    return NextResponse.json(
      { error: 'create_failed', message: deckErr?.message ?? 'erro' },
      { status: 500 }
    );
  }

  // Vincula questões (anti-IDOR: in() já filtra pelo user_id via RLS;
  // FK composta no DB rejeita questões de outro user).
  const { error: linkErr } = await supabase
    .from('live_deck_questions')
    .insert(
      questionIds.map((qid) => ({
        deck_id: deck.id,
        question_id: qid,
        user_id: user.id,
      }))
    );
  if (linkErr) {
    // Cleanup parcial: deleta o deck criado
    await supabase.from('live_decks').delete().eq('id', deck.id);
    return NextResponse.json(
      { error: 'link_failed', message: linkErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: deck.id, name: deck.name });
}
