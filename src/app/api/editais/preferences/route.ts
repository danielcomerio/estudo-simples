/**
 * GET/PUT /api/editais/preferences — gerencia editais_preferences do user.
 *
 * GET: retorna prefs (defaults se não existir).
 * PUT: { regions?: string[], areas?: string[], enabled?: boolean }
 *      Valida regions contra whitelist (estados BR + 'BR'). Areas
 *      contra whitelist conhecida.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_REGIONS = new Set([
  'BR',
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const VALID_AREAS = new Set([
  'TI', 'Direito', 'Saude', 'Educacao', 'Policia', 'Adm',
]);

const DEFAULTS = {
  regions: [] as string[],
  areas: [] as string[],
  enabled: true,
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data } = await supabase
    .from('editais_preferences')
    .select('regions, areas, enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ prefs: data ?? DEFAULTS });
}

export async function PUT(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 30,
    windowMs: 60_000,
    keyPrefix: 'editais-prefs',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: {
    regions?: unknown;
    areas?: unknown;
    enabled?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const update: Record<string, unknown> = { user_id: user.id };

  if (body.regions !== undefined) {
    if (
      !Array.isArray(body.regions) ||
      body.regions.some(
        (r) => typeof r !== 'string' || !VALID_REGIONS.has(r)
      )
    ) {
      return NextResponse.json({ error: 'invalid_regions' }, { status: 400 });
    }
    update.regions = body.regions;
  }
  if (body.areas !== undefined) {
    if (
      !Array.isArray(body.areas) ||
      body.areas.some(
        (a) => typeof a !== 'string' || !VALID_AREAS.has(a)
      )
    ) {
      return NextResponse.json({ error: 'invalid_areas' }, { status: 400 });
    }
    update.areas = body.areas;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'invalid_enabled' }, { status: 400 });
    }
    update.enabled = body.enabled;
  }
  update.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('editais_preferences')
    .upsert(update, { onConflict: 'user_id' });

  if (error) {
    return NextResponse.json(
      { error: 'save_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
