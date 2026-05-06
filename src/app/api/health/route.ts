import { NextResponse } from 'next/server';

/**
 * Health check público. Útil pra:
 * - Vercel/uptime monitoring (uptime-kuma, betterstack, etc)
 * - Probes em load balancers
 * - Smoke test após deploy
 *
 * Não vaza informação sensível — retorna só status, version e timestamp.
 * Sem auth necessária. Cache desabilitado pra refletir state atual.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      app: 'estudo-simples',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
