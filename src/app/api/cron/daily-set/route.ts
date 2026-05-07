/**
 * Cron diário (5h UTC) — gera daily_question_set automaticamente
 * baseado em ranking de questões mais votadas.
 *
 * Estratégia:
 *  - Pega top 20 questões objetivas oficiais com melhor rating
 *    (ups - downs).
 *  - Skip se já tem set do dia (idempotente).
 *  - Random tie-break.
 *
 * USER ACTION (admin):
 *  - Adicionar schedule em vercel.json: '/api/cron/daily-set' '0 5 * * *'
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { notifyUser } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // Skip se já tem
  const { data: existing } = await sb
    .from('daily_question_sets')
    .select('id')
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'set already exists for ' + today,
    });
  }

  // RPC SQL pra ranking — fallback gracioso se falhar
  const { data: ranked } = await sb
    .from('questions')
    .select('id')
    .is('deleted_at', null)
    .eq('type', 'objetiva')
    // .eq('fonte->>gabarito_source', 'oficial') — adicionar quando bank tiver
    .limit(100); // Pega 100 candidatas

  if (!ranked || ranked.length === 0) {
    return NextResponse.json({
      ok: false,
      reason: 'no questions available',
    });
  }

  // Random pick 20 do top 100 (Fisher-Yates)
  const ids = (ranked as Array<{ id: string }>).map((r) => r.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const picked = ids.slice(0, Math.min(20, ids.length));

  const { error } = await sb.from('daily_question_sets').insert({
    date: today,
    question_ids: picked,
    title: `Desafio Diário — ${today}`,
    description: `${picked.length} questões objetivas. Boa sorte!`,
    publish_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'insert_failed', message: error.message },
      { status: 500 }
    );
  }

  // Notifica users que querem receber community daily.
  // Best-effort, não bloqueia retorno.
  const { data: prefs } = await sb
    .from('daily_preferences')
    .select('user_id')
    .eq('community_enabled', true);

  let notified = 0;
  let notifyFailed = 0;
  if (prefs && prefs.length > 0) {
    for (const p of prefs as Array<{ user_id: string }>) {
      const r = await notifyUser(p.user_id, {
        title: '📅 Desafio do dia disponível!',
        body: `${picked.length} questões pra você competir. Top 50 entram no ranking.`,
        url: '/diario',
        tag: 'daily-set',
      });
      if (r.success) notified++;
      else notifyFailed++;
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    count: picked.length,
    notified,
    notify_failed: notifyFailed,
  });
}
