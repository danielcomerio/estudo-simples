/**
 * GET/PUT /api/daily/preferences — gerencia daily_preferences do user.
 *
 * GET: retorna prefs (ou defaults se não existir).
 * PUT: upsert. Body parcial — só atualiza campos enviados.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set(['objetiva', 'discursiva', 'cloze', 'flashcard']);

type Prefs = {
  community_enabled: boolean;
  personal_enabled: boolean;
  personal_qtd: number;
  personal_types: string[];
  personal_disciplinas: string[];
  notify_hour: number;
  notify_minute: number;
};

const DEFAULTS: Prefs = {
  community_enabled: true,
  personal_enabled: false,
  personal_qtd: 10,
  personal_types: ['objetiva'],
  personal_disciplinas: [],
  notify_hour: 9,
  notify_minute: 0,
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('daily_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ prefs: data ?? DEFAULTS });
}

export async function PUT(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 30,
    windowMs: 60_000,
    keyPrefix: 'daily-prefs',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: Partial<Prefs> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Defense in depth: validar antes de bater no DB CHECK
  if (
    body.personal_qtd !== undefined &&
    (typeof body.personal_qtd !== 'number' ||
      body.personal_qtd < 1 ||
      body.personal_qtd > 50)
  ) {
    return NextResponse.json(
      { error: 'invalid_qtd' },
      { status: 400 }
    );
  }

  if (
    body.notify_hour !== undefined &&
    (typeof body.notify_hour !== 'number' ||
      body.notify_hour < 0 ||
      body.notify_hour > 23)
  ) {
    return NextResponse.json(
      { error: 'invalid_hour' },
      { status: 400 }
    );
  }

  if (
    body.notify_minute !== undefined &&
    (typeof body.notify_minute !== 'number' ||
      body.notify_minute < 0 ||
      body.notify_minute > 59)
  ) {
    return NextResponse.json(
      { error: 'invalid_minute' },
      { status: 400 }
    );
  }

  if (
    body.personal_types !== undefined &&
    (!Array.isArray(body.personal_types) ||
      body.personal_types.some(
        (t) => typeof t !== 'string' || !VALID_TYPES.has(t)
      ))
  ) {
    return NextResponse.json({ error: 'invalid_types' }, { status: 400 });
  }

  const { error } = await supabase.from('daily_preferences').upsert(
    {
      user_id: user.id,
      ...body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return NextResponse.json(
      { error: 'update_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
