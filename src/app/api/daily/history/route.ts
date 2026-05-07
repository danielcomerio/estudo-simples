/**
 * GET /api/daily/history — retorna lista de set_dates onde user fez attempt.
 *
 * Usado pra calcular streak do desafio diário em ConquistasView.
 * Retorna até 365 attempts mais recentes.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    .from('daily_question_attempts')
    .select(
      'set_id, score_pct, correct_count, total_questions, completed_at, daily_question_sets!inner(date)'
    )
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })
    .limit(365);

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  const items = (data ?? []).map((row) => {
    const sets = row.daily_question_sets as
      | { date: string }
      | { date: string }[]
      | null;
    const setDate = Array.isArray(sets) ? sets[0]?.date : sets?.date;
    return {
      set_id: row.set_id,
      set_date: setDate ?? null,
      score_pct: row.score_pct,
      correct_count: row.correct_count,
      total_questions: row.total_questions,
    };
  });

  return NextResponse.json({ items });
}
