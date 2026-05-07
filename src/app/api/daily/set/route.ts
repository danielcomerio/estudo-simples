/**
 * GET /api/daily/set — retorna o set comunitário do dia atual.
 * Resposta inclui as questões snapshotted (caso questão original mude).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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

  // Hoje em UTC
  const today = new Date().toISOString().slice(0, 10);

  const { data: set } = await supabase
    .from('daily_question_sets')
    .select('id, date, question_ids, title, description, publish_at')
    .eq('date', today)
    .lte('publish_at', new Date().toISOString())
    .maybeSingle();

  if (!set) {
    return NextResponse.json({ available: false });
  }

  // Carrega as questões via service role (pode ser de outros users)
  const sb = getSupabaseAdmin();
  const { data: questions } = await sb
    .from('questions')
    .select(
      'id, type, disciplina_id, tema, banca_estilo, dificuldade, payload, fonte'
    )
    .in('id', set.question_ids as string[])
    .is('deleted_at', null);

  // Verifica se user já fez
  const { data: attempt } = await supabase
    .from('daily_question_attempts')
    .select('score_pct, correct_count, total_questions, completed_at, duration_s')
    .eq('user_id', user.id)
    .eq('set_id', set.id)
    .maybeSingle();

  return NextResponse.json({
    available: true,
    set: {
      id: set.id,
      date: set.date,
      title: set.title,
      description: set.description,
      questions: questions ?? [],
    },
    attempt: attempt ?? null,
  });
}
