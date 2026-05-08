import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Health check público. Útil pra:
 * - Vercel/uptime monitoring (uptime-kuma, betterstack, etc)
 * - Probes em load balancers
 * - Smoke test após deploy
 *
 * Não vaza informação sensível — retorna só status, version, checks
 * booleanos (não revela URLs/keys).
 *
 * Faz check leve do DB (1 query simples). Falha de DB → status 'degraded'
 * mas ainda 200 (uptime monitor decide alertar baseado no body).
 *
 * Sem auth necessária. Cache desabilitado pra refletir state atual.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const startTime = Date.now();
  const url = new URL(req.url);
  const wantMetrics = url.searchParams.get('metrics') === '1';

  // Check DB ping (não retorna dados, só verifica conexão).
  let dbOk = false;
  let dbLatencyMs = -1;
  try {
    const supabase = await createClient();
    const t0 = Date.now();
    // Query trivial — não exige RLS, não retorna dados sensíveis.
    const { error } = await supabase
      .from('profiles')
      .select('user_id', { head: true, count: 'exact' })
      .limit(0);
    dbLatencyMs = Date.now() - t0;
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  // Checks de configuração (não vaza valores, só boolean).
  const config = {
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    vapid: !!(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ),
    cron_secret: !!process.env.CRON_SECRET,
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
  };

  // Check Telegram (getMe — endpoint barato, valida token sem efeitos).
  let tgOk: boolean | null = null;
  let tgLatencyMs = -1;
  if (config.telegram) {
    try {
      const t0 = Date.now();
      const res = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
        { signal: AbortSignal.timeout(3000) }
      );
      tgLatencyMs = Date.now() - t0;
      tgOk = res.ok;
    } catch {
      tgOk = false;
    }
  }

  const overall = dbOk && config.supabase ? 'ok' : 'degraded';

  // Counts agregados (anônimo, opt-in via ?metrics=1 pra não alongar
  // request comum de uptime monitor).
  let metrics: { questions_total?: number; profiles_total?: number } | null = null;
  if (wantMetrics && dbOk) {
    try {
      const supabase = await createClient();
      const [{ count: qCount }, { count: pCount }] = await Promise.all([
        supabase
          .from('questions')
          .select('id', { head: true, count: 'exact' })
          .is('deleted_at', null),
        supabase.from('profiles').select('user_id', { head: true, count: 'exact' }),
      ]);
      metrics = {
        questions_total: qCount ?? 0,
        profiles_total: pCount ?? 0,
      };
    } catch {
      metrics = null;
    }
  }

  return NextResponse.json(
    {
      status: overall,
      app: 'estudo-simples',
      version: '0.1.0',
      // SHA do build (Vercel injeta automaticamente em VERCEL_GIT_COMMIT_SHA)
      git_sha:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      timestamp: new Date().toISOString(),
      response_ms: Date.now() - startTime,
      checks: {
        db: { ok: dbOk, latency_ms: dbLatencyMs },
        telegram:
          tgOk === null
            ? { configured: false }
            : { configured: true, ok: tgOk, latency_ms: tgLatencyMs },
        config,
      },
      ...(metrics ? { metrics } : {}),
    },
    {
      // Sempre 200 — uptime monitor decide alertar baseado no body
      // (status: 'ok' vs 'degraded'). Evita ruído de "API down" só
      // pq DB ficou lento.
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
