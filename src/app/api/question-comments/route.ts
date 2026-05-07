/**
 * GET /api/question-comments?question_id=...
 *   → lista comentários de uma questão (todos users).
 * POST { question_id, body }
 *   → adiciona comentário (rate limit 5/min).
 * DELETE ?id=...
 *   → remove (RLS valida author OU owner da questão).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    return NextResponse.json({ error: 'missing_question_id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('question_comments')
    .select('id, author_id, body, created_at')
    .eq('question_id', qid)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  // Mascara author_id (não expõe UUIDs raw — usa hash visual de 6 chars)
  const items = (data ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    is_mine: c.author_id === user.id,
    author_short: c.author_id.slice(0, 6),
  }));

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 5,
    windowMs: 60_000,
    keyPrefix: 'qc-add',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { question_id?: unknown; body?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (typeof body.question_id !== 'string' || !body.question_id) {
    return NextResponse.json({ error: 'invalid_question_id' }, { status: 400 });
  }
  if (typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'empty_body' }, { status: 400 });
  }
  if (body.body.length > 2000) {
    return NextResponse.json({ error: 'body_too_long' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('question_comments')
    .insert({
      question_id: body.question_id,
      author_id: user.id,
      body: body.body.trim(),
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'insert_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: data?.id });
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
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  // RLS valida author OR owner-of-question
  const { error } = await supabase
    .from('question_comments')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
