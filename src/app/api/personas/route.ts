/**
 * GET /api/personas — lista personas do user (próprias).
 * POST /api/personas — cria persona.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PROVIDER = ['openai', 'anthropic', 'gemini'] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { data, error } = await supabase
    .from('ai_personas')
    .select(
      'id, name, description, system_prompt, emoji, concurso_id, preferred_provider, preferred_model, is_public, use_count, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
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
    keyPrefix: 'personas-create',
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
    name?: unknown;
    description?: unknown;
    system_prompt?: unknown;
    emoji?: unknown;
    concurso_id?: unknown;
    preferred_provider?: unknown;
    preferred_model?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (
    typeof body.name !== 'string' ||
    body.name.trim().length === 0 ||
    body.name.length > 80
  ) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  if (
    typeof body.system_prompt !== 'string' ||
    body.system_prompt.length < 10 ||
    body.system_prompt.length > 4000
  ) {
    return NextResponse.json(
      { error: 'invalid_system_prompt' },
      { status: 400 }
    );
  }
  if (
    body.preferred_provider !== undefined &&
    body.preferred_provider !== null &&
    !VALID_PROVIDER.includes(body.preferred_provider as 'openai')
  ) {
    return NextResponse.json(
      { error: 'invalid_provider' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('ai_personas')
    .insert({
      user_id: user.id,
      name: (body.name as string).trim(),
      description:
        typeof body.description === 'string'
          ? body.description.slice(0, 500)
          : null,
      system_prompt: body.system_prompt as string,
      emoji: typeof body.emoji === 'string' ? body.emoji.slice(0, 8) : '🤖',
      concurso_id:
        typeof body.concurso_id === 'string' ? body.concurso_id : null,
      preferred_provider:
        typeof body.preferred_provider === 'string'
          ? body.preferred_provider
          : null,
      preferred_model:
        typeof body.preferred_model === 'string'
          ? body.preferred_model.slice(0, 100)
          : null,
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
