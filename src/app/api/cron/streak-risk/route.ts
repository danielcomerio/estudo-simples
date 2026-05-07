/**
 * Cron 22h UTC (~19h Brasil) — avisa users com streak ativo que ainda
 * não estudaram hoje. Empurra eles a manter a sequência.
 *
 * MVP: stub — implementação real depende de tracking de "estudou
 * hoje" que está no client (sessions-log). Pra fazer server-side
 * precisa criar tabela `daily_activity` ou similar. Este endpoint
 * existe pra Vercel cron schedule não falhar.
 */

import { NextResponse } from 'next/server';

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
  // TODO: implementar quando tiver server-side tracking de daily activity
  return NextResponse.json({ ok: true, processed: 0, note: 'stub' });
}
