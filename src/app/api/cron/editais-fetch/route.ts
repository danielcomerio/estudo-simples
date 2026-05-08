/**
 * GET /api/cron/editais-fetch — busca RSS do PCI Concursos, parseia,
 * dedupa, salva em public.editais.
 *
 * Auth: Bearer ${CRON_SECRET}.
 *
 * Estratégia:
 *  1. Fetch com User-Agent identificável + timeout 15s.
 *  2. Parse via regex (lib/editais-rss).
 *  3. Upsert por (source, source_id) — RSS pode trazer mesmo item
 *     em múltiplas runs.
 *  4. Falha de fetch = 502 mas NÃO trava o cron (registra erro).
 *
 * Cadência recomendada: 1×/dia (vercel.json). PCI atualiza diariamente.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { inferArea, inferRegion, parsePciRSS } from '@/lib/editais-rss';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PCI_RSS_URL = 'https://www.pciconcursos.com.br/concursos/rss';
const USER_AGENT =
  'EstudoSimplesBot/1.0 (+https://app.estudosimples.com.br/sobre)';

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let xml = '';
  try {
    const res = await fetch(PCI_RSS_URL, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'fetch_failed', status: res.status },
        { status: 502 }
      );
    }
    xml = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: 'fetch_exception', message: (e as Error).message },
      { status: 502 }
    );
  }

  const raw = parsePciRSS(xml);
  if (raw.length === 0) {
    return NextResponse.json(
      { ok: true, parsed: 0, inserted: 0, note: 'feed vazio ou parser falhou' }
    );
  }

  const sb = getSupabaseAdmin();
  let inserted = 0;
  let errors = 0;

  for (const item of raw) {
    const region = inferRegion(item.title);
    const area = inferArea(item.title);
    const { error } = await sb.from('editais').upsert(
      {
        source: item.source,
        source_id: item.sourceId,
        title: item.title,
        link: item.link,
        description: item.description || null,
        region,
        area,
        pub_date: item.pubDate?.toISOString() ?? null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'source,source_id' }
    );
    if (error) errors++;
    else inserted++;
  }

  return NextResponse.json({
    ok: true,
    parsed: raw.length,
    inserted,
    errors,
    timestamp: new Date().toISOString(),
  });
}
