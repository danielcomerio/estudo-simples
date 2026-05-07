/**
 * GET /api/daily/ranking?set_id=xxx — top N do set atual.
 *
 * Mostra display anônimo (mascarado) — não vaza emails.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { maskEmail } from '@/lib/sharing';

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
  const setId = url.searchParams.get('set_id');
  if (!setId) {
    return NextResponse.json({ error: 'set_id required' }, { status: 400 });
  }

  // Busca attempts ordenados por score desc + duration asc (top 50)
  const { data: attempts } = await supabase
    .from('daily_question_attempts')
    .select('user_id, score_pct, correct_count, total_questions, duration_s, completed_at')
    .eq('set_id', setId)
    .order('score_pct', { ascending: false })
    .order('duration_s', { ascending: true })
    .limit(50);

  if (!attempts || attempts.length === 0) {
    return NextResponse.json({ ranking: [], total: 0, your_rank: null });
  }

  // Resolve emails via service role (mascarados)
  const sb = getSupabaseAdmin();
  const userIds = attempts.map((a) => (a as { user_id: string }).user_id);
  const { data: users } = await sb
    .from('profiles')
    .select('user_id')
    .in('user_id', userIds);

  // PostgREST não retorna email direto via profiles. Usa auth.admin.
  const emailMap = new Map<string, string>();
  // Workaround: usa service role pra ler auth.users.email
  const { data: authUsers } = await sb
    .schema('auth')
    .from('users')
    .select('id, email')
    .in('id', userIds);
  for (const u of (authUsers ?? []) as Array<{ id: string; email: string | null }>) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  const ranking = attempts.map((a, idx) => {
    const aTyped = a as {
      user_id: string;
      score_pct: number;
      correct_count: number;
      total_questions: number;
      duration_s: number;
      completed_at: string;
    };
    return {
      rank: idx + 1,
      display: maskEmail(emailMap.get(aTyped.user_id)),
      score_pct: aTyped.score_pct,
      correct: aTyped.correct_count,
      total: aTyped.total_questions,
      duration_s: aTyped.duration_s,
      is_you: aTyped.user_id === user.id,
    };
  });

  const yourRank = ranking.find((r) => r.is_you)?.rank ?? null;

  return NextResponse.json({
    ranking,
    total: attempts.length,
    your_rank: yourRank,
  });
  // suppress unused warning
  void users;
}
