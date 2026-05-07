/**
 * Cron diário (12h UTC) — dispara push pra users com revisões SRS
 * vencendo. Vercel cron header verificado pra evitar abuso.
 *
 * Schedule definido em vercel.json (0 12 * * *).
 *
 * Implementation MVP: usa service role pra ler all questions vencendo,
 * agrupa por user, envia 1 push por user resumindo o total.
 *
 * Pra escala maior: paginar + queue (Upstash, Inngest). Pra MVP basta.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { notifyUser } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Vercel cron envia header authorization "Bearer ${CRON_SECRET}".
  // Sem CRON_SECRET configurado, qualquer GET dispara — em dev é OK,
  // em produção CONFIGURE.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const sb = getSupabaseAdmin();

  // Query: questões vencidas ou vencendo hoje (srs.dueDate <= EOD).
  // jsonb path: srs->>'dueDate' é string do ms; comparamos via ::bigint.
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndMs = todayEnd.getTime();

  // Pega user_ids com >0 questões vencendo, contadas. Limit conservador
  // pra evitar timeout (10s na Vercel Hobby; 60s no Pro).
  const { data, error } = await sb.rpc('count_due_per_user', {
    p_due_before_ms: todayEndMs,
  });

  if (error) {
    // Função RPC não existe ainda — fallback graceful.
    if (/function .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'count_due_per_user RPC não criada — ver migration futura ou usar query manual.',
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  const users = (data ?? []) as Array<{ user_id: string; due_count: number }>;
  const results = { processed: 0, sent: 0, failed: 0 };

  for (const u of users) {
    if (u.due_count === 0) continue;
    results.processed++;
    const r = await notifyUser(u.user_id, {
      title: '⏰ Estudo Simples',
      body:
        u.due_count === 1
          ? '1 questão vencendo hoje. Estude pra manter o ritmo.'
          : `${u.due_count} questões vencendo hoje. Estude agora!`,
      url: '/estudar?modo=srs',
      tag: 'srs-due',
    });
    if (r.success) results.sent++;
    else results.failed++;
  }

  return NextResponse.json({ ok: true, ...results });
}
