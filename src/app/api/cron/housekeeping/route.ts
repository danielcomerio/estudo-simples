/**
 * GET /api/cron/housekeeping — limpa dados antigos pra controlar storage.
 *
 * Operações:
 *  1. analytics_events > 180 dias → DELETE
 *  2. shared_decks expirados há > 90 dias → DELETE (já estavam inativos)
 *  3. telegram_bindings com bind_token expirado e não bindados > 24h → DELETE
 *
 * Roda 1x/dia (cron Vercel). Auth via CRON_SECRET no header.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const now = Date.now();

  const results: Record<string, number | string> = {};

  // 1. analytics_events > 180 dias
  try {
    const cutoff = new Date(now - 180 * DAY_MS).toISOString();
    const { error, count } = await sb
      .from('analytics_events')
      .delete({ count: 'estimated' })
      .lt('created_at', cutoff);
    results.analytics_events = error ? `error: ${error.message}` : (count ?? 0);
  } catch (e) {
    results.analytics_events = `exception: ${(e as Error).message}`;
  }

  // 2. shared_decks expirados há mais de 90 dias
  try {
    const cutoff = new Date(now - 90 * DAY_MS).toISOString();
    const { error, count } = await sb
      .from('shared_decks')
      .delete({ count: 'estimated' })
      .lt('expires_at', cutoff);
    results.shared_decks = error ? `error: ${error.message}` : (count ?? 0);
  } catch (e) {
    results.shared_decks = `exception: ${(e as Error).message}`;
  }

  // 3. telegram_bindings pending (bind_token TTL = 1h, mas damos 24h
  // pra ser seguro pra users lentos)
  try {
    const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { error, count } = await sb
      .from('telegram_bindings')
      .delete({ count: 'estimated' })
      .is('bound_at', null)
      .lt('created_at', cutoff);
    results.telegram_pending = error ? `error: ${error.message}` : (count ?? 0);
  } catch (e) {
    results.telegram_pending = `exception: ${(e as Error).message}`;
  }

  return NextResponse.json({
    ok: true,
    deleted: results,
    timestamp: new Date().toISOString(),
  });
}
