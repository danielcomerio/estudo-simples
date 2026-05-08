/**
 * GET /api/concurso-events?concurso_id=...&from=ISO&to=ISO — lista eventos.
 * POST /api/concurso-events — cria.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set([
  'inscricao_inicio',
  'inscricao_fim',
  'prova_objetiva',
  'prova_discursiva',
  'redacao',
  'taf',
  'simulado',
  'reuniao_estudo',
  'outro',
]);

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const concursoId = url.searchParams.get('concurso_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let q = supabase
    .from('concurso_events')
    .select(
      'id, concurso_id, type, title, starts_at, ends_at, notes, reminder_minutes_before, notified_at, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .order('starts_at', { ascending: true });

  if (concursoId) q = q.eq('concurso_id', concursoId);
  if (from) q = q.gte('starts_at', from);
  if (to) q = q.lte('starts_at', to);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 30,
    windowMs: 60_000,
    keyPrefix: 'events-create',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (typeof body.concurso_id !== 'string' || !body.concurso_id) {
    return NextResponse.json({ error: 'invalid_concurso_id' }, { status: 400 });
  }
  if (typeof body.type !== 'string' || !VALID_TYPES.has(body.type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  if (
    typeof body.title !== 'string' ||
    !body.title.trim() ||
    body.title.length > 200
  ) {
    return NextResponse.json({ error: 'invalid_title' }, { status: 400 });
  }
  if (typeof body.starts_at !== 'string' || isNaN(Date.parse(body.starts_at))) {
    return NextResponse.json({ error: 'invalid_starts_at' }, { status: 400 });
  }
  if (
    body.ends_at !== undefined &&
    body.ends_at !== null &&
    (typeof body.ends_at !== 'string' || isNaN(Date.parse(body.ends_at)))
  ) {
    return NextResponse.json({ error: 'invalid_ends_at' }, { status: 400 });
  }
  if (
    body.reminder_minutes_before !== undefined &&
    body.reminder_minutes_before !== null &&
    (typeof body.reminder_minutes_before !== 'number' ||
      body.reminder_minutes_before < 0 ||
      body.reminder_minutes_before > 43200)
  ) {
    return NextResponse.json(
      { error: 'invalid_reminder' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('concurso_events')
    .insert({
      user_id: user.id,
      concurso_id: body.concurso_id,
      type: body.type,
      title: (body.title as string).trim(),
      starts_at: body.starts_at,
      ends_at: body.ends_at ?? null,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null,
      reminder_minutes_before: body.reminder_minutes_before ?? null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'insert_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, id: data?.id });
}
