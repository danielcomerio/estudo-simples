/**
 * PATCH/DELETE /api/concurso-events/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/security';

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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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

  const update: Record<string, unknown> = {};
  if (typeof body.type === 'string' && VALID_TYPES.has(body.type))
    update.type = body.type;
  if (typeof body.title === 'string' && body.title.trim())
    update.title = body.title.trim().slice(0, 200);
  if (typeof body.starts_at === 'string' && !isNaN(Date.parse(body.starts_at)))
    update.starts_at = body.starts_at;
  if (body.ends_at === null || (typeof body.ends_at === 'string' && !isNaN(Date.parse(body.ends_at))))
    update.ends_at = body.ends_at;
  if (typeof body.notes === 'string' || body.notes === null)
    update.notes = body.notes === null ? null : (body.notes as string).slice(0, 2000);
  if (
    body.reminder_minutes_before === null ||
    (typeof body.reminder_minutes_before === 'number' &&
      body.reminder_minutes_before >= 0 &&
      body.reminder_minutes_before <= 43200)
  ) {
    update.reminder_minutes_before = body.reminder_minutes_before;
    // Reset notified_at se reminder mudou (cron pode disparar de novo)
    update.notified_at = null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 });
  }

  const { error } = await supabase
    .from('concurso_events')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: 'update_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { error } = await supabase
    .from('concurso_events')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);
  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
