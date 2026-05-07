/**
 * POST /api/question-rating — UPSERT rating do user pra uma questão.
 * Body: { question_id, rating: 1 | -1, comment?: string }
 *
 * GET /api/question-rating?question_id=xxx — total de ups/downs + meu rating.
 *
 * DELETE /api/question-rating?question_id=xxx — remove meu rating.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 60,
    windowMs: 60_000,
    keyPrefix: 'rating',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { question_id?: string; rating?: number; comment?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (typeof body.question_id !== 'string') {
    return NextResponse.json({ error: 'invalid_question_id' }, { status: 400 });
  }
  if (body.rating !== 1 && body.rating !== -1) {
    return NextResponse.json({ error: 'invalid_rating' }, { status: 400 });
  }
  const comment =
    typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : null;

  const { error } = await supabase.from('question_ratings').upsert(
    {
      user_id: user.id,
      question_id: body.question_id,
      rating: body.rating,
      comment,
    },
    { onConflict: 'user_id,question_id' }
  );

  if (error) {
    return NextResponse.json(
      { error: 'upsert_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const url = new URL(req.url);
  const qid = url.searchParams.get('question_id');
  if (!qid) {
    return NextResponse.json({ error: 'question_id_required' }, { status: 400 });
  }

  const { data: all } = await supabase
    .from('question_ratings')
    .select('user_id, rating')
    .eq('question_id', qid);

  const ups = (all ?? []).filter((r) => r.rating === 1).length;
  const downs = (all ?? []).filter((r) => r.rating === -1).length;
  const my =
    (all ?? []).find((r) => (r as { user_id: string }).user_id === user.id)
      ?.rating ?? null;

  return NextResponse.json({ ups, downs, my });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const url = new URL(req.url);
  const qid = url.searchParams.get('question_id');
  if (!qid) {
    return NextResponse.json({ error: 'question_id_required' }, { status: 400 });
  }
  const { error } = await supabase
    .from('question_ratings')
    .delete()
    .eq('user_id', user.id)
    .eq('question_id', qid);
  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
