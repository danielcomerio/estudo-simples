/**
 * GET /api/ics/[token] — retorna feed ICS pra apps de calendário.
 *
 * Anônimo (apps de calendário não autenticam). Resolve user_id via
 * RPC SECURITY DEFINER que valida token + incrementa fetch_count.
 *
 * Conteúdo: eventos de concurso (futuros) — SRS due dates ficam
 * de fora aqui pra performance, podem ser agregados depois.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateFullICS, type ConcursoEventLite } from '@/lib/ics-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return new Response('Invalid token format', { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Resolve user_id + incrementa fetch_count
  const { data: userId, error: rpcErr } = await sb.rpc(
    'ics_token_record_fetch',
    { p_token: token }
  );

  if (rpcErr || !userId) {
    return new Response('Token not found or disabled', { status: 404 });
  }

  // Busca eventos futuros (próximos 365 dias)
  const cutoff = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error } = await sb
    .from('concurso_events')
    .select('id, type, title, starts_at, ends_at, notes')
    .eq('user_id', userId)
    .gte('starts_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .lte('starts_at', cutoff)
    .order('starts_at');

  if (error) {
    return new Response('Failed to fetch events', { status: 500 });
  }

  const ics = generateFullICS((events ?? []) as ConcursoEventLite[]);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=600', // 10 min cache
      'Content-Disposition': 'inline; filename="estudo-simples.ics"',
    },
  });
}
