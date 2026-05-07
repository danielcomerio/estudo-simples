/**
 * POST /api/daily/attempt — registra resultado do user no set do dia.
 * Body: { set_id, score_pct, correct_count, total_questions, duration_s }
 *
 * Idempotente: UPSERT por (user_id, set_id) — re-submit substitui.
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
    max: 10,
    windowMs: 60_000,
    keyPrefix: 'daily-attempt',
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
    set_id?: string;
    score_pct?: number;
    correct_count?: number;
    total_questions?: number;
    duration_s?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (
    typeof body.set_id !== 'string' ||
    typeof body.score_pct !== 'number' ||
    typeof body.correct_count !== 'number' ||
    typeof body.total_questions !== 'number'
  ) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  if (
    body.score_pct < 0 ||
    body.score_pct > 100 ||
    body.correct_count < 0 ||
    body.total_questions < 1
  ) {
    return NextResponse.json({ error: 'invalid_values' }, { status: 400 });
  }

  const { error } = await supabase.from('daily_question_attempts').upsert(
    {
      user_id: user.id,
      set_id: body.set_id,
      score_pct: Math.round(body.score_pct),
      correct_count: Math.round(body.correct_count),
      total_questions: Math.round(body.total_questions),
      duration_s: Math.max(0, Math.round(body.duration_s ?? 0)),
    },
    { onConflict: 'user_id,set_id' }
  );

  if (error) {
    return NextResponse.json(
      { error: 'insert_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
