/**
 * Defesas server-side compartilhadas pelas API routes.
 *
 * 1. CSRF/origin check: garante que o request vem do nosso domínio
 *    (mesmo origin do server). Sem isso, um site malicioso poderia
 *    fazer browser autenticado disparar POST nos nossos endpoints.
 *
 * 2. Rate limit em memória: simple bucket por IP. Pra deploy em
 *    serverless (Vercel), o estado vive na instância — escalado
 *    mas não compartilhado entre regiões. Combina com Vercel WAF/
 *    Edge Config pra defesa em camada.
 *
 * Nada disso é à prova de DoS distribuído (use Vercel WAF ou
 * Cloudflare na frente). É defesa razoável contra abuso de baixa
 * sofisticação e tampering trivial.
 */

import { NextResponse } from 'next/server';

/** Verifica que a origem do request bate com o host do server.
 *  Aceita Origin ou Referer (alguns browsers/proxies só mandam um).
 *  POST sem nenhum dos dois = rejeitado.
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  const host = req.headers.get('host');
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (!host) {
    return NextResponse.json({ error: 'no_host' }, { status: 400 });
  }
  // Production atrás do Vercel: x-forwarded-host pode ser usado pelo
  // host se necessário. Mas geralmente `host` já é o público.
  const expected = `${host}`;

  const valid = (urlStr: string | null): boolean => {
    if (!urlStr) return false;
    try {
      const u = new URL(urlStr);
      return u.host === expected;
    } catch {
      return false;
    }
  };
  if (valid(origin) || valid(referer)) return null;
  return NextResponse.json(
    { error: 'invalid_origin' },
    { status: 403 }
  );
}

// ---------------------------------------------------------------------
// Rate limit simples (token bucket por IP). Em-memória — bom o
// suficiente pra abuse de baixo volume. Pra defesa séria use Vercel
// WAF / Cloudflare Rate Limiting.
// ---------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  req: Request,
  opts: { max: number; windowMs: number; keyPrefix?: string }
): NextResponse | null {
  // Tenta IP via Forwarded headers; cai em x-real-ip; cai em
  // 'unknown' (que ainda divide carga global).
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const key = `${opts.keyPrefix ?? 'default'}:${ip}`;
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }
  if (cur.count >= opts.max) {
    const retryAfter = Math.ceil((cur.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }
  cur.count++;
  return null;
}

// Limpeza periódica do map pra não vazar memória em runtime longo.
// Roda passivo: a cada inserção limpa entries expiradas se o map ficar
// grande. Sem timer setInterval (que não ativa bem em serverless).
const MAX_BUCKETS = 10_000;
function maybeCleanup() {
  if (buckets.size < MAX_BUCKETS) return;
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}
const _origSet = buckets.set.bind(buckets);
buckets.set = (key: string, value: Bucket) => {
  maybeCleanup();
  return _origSet(key, value);
};
