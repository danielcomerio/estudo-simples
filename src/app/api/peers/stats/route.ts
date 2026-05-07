/**
 * GET /api/peers/stats — agregado anônimo de desempenho da comunidade.
 *
 * Retorna distribuição de score_pct dos últimos 90 dias em
 * daily_question_attempts (todos users, anônimo via aggregate).
 *
 * Privacy: nada de user_id/email/etc. Só números agregados.
 *
 * Output:
 *   p25, p50, p75 — percentis de score_pct
 *   total_attempts — quantos attempts agregados
 *   active_users  — quantos users distintos contribuíram
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - NINETY_DAYS_MS).toISOString();

  // RLS de daily_question_attempts permite SELECT public (pra ranking).
  // Pull até 5000 rows recentes — suficiente pra agregação representativa
  // sem custar memória demais.
  const { data, error } = await supabase
    .from('daily_question_attempts')
    .select('user_id, score_pct')
    .gte('completed_at', cutoff)
    .limit(5000);

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({
      total_attempts: 0,
      active_users: 0,
      p25: null,
      p50: null,
      p75: null,
      user_avg: null,
    });
  }

  const scores = data.map((r) => r.score_pct).sort((a, b) => a - b);
  const userScores = data
    .filter((r) => r.user_id === user.id)
    .map((r) => r.score_pct);
  const userAvg =
    userScores.length > 0
      ? Math.round(
          userScores.reduce((s, v) => s + v, 0) / userScores.length
        )
      : null;

  return NextResponse.json({
    total_attempts: scores.length,
    active_users: new Set(data.map((r) => r.user_id)).size,
    p25: percentile(scores, 0.25),
    p50: percentile(scores, 0.5),
    p75: percentile(scores, 0.75),
    user_avg: userAvg,
  });
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}
