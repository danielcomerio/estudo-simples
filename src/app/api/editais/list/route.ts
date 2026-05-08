/**
 * GET /api/editais/list — lista editais agregados do PCI Concursos.
 *
 * Query params:
 *   ?regions=BR,SP,RJ
 *   ?areas=TI,Direito
 *   ?limit=20  (max 50)
 *
 * Sem prefs setadas = mostra tudo (limit padrão 20).
 *
 * Auth obrigatória (evita scraping anônimo do nosso cache).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const regions = url.searchParams
    .get('regions')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const areas = url.searchParams
    .get('areas')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));

  let q = supabase
    .from('editais')
    .select('id, title, link, region, area, pub_date, fetched_at')
    .order('pub_date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (regions && regions.length > 0) q = q.in('region', regions);
  if (areas && areas.length > 0) q = q.in('area', areas);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: data ?? [],
    filters: { regions: regions ?? [], areas: areas ?? [] },
  });
}
