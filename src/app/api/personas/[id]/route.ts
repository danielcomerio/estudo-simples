/**
 * PATCH /api/personas/[id] — atualiza persona (campos parciais).
 * DELETE /api/personas/[id] — remove.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PROVIDER = ['openai', 'anthropic', 'gemini'];

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
  if (typeof body.name === 'string' && body.name.trim()) {
    if (body.name.length > 80) {
      return NextResponse.json({ error: 'name_too_long' }, { status: 400 });
    }
    update.name = body.name.trim();
  }
  if (typeof body.description === 'string' || body.description === null) {
    if (typeof body.description === 'string' && body.description.length > 500) {
      return NextResponse.json({ error: 'desc_too_long' }, { status: 400 });
    }
    update.description = body.description;
  }
  if (typeof body.system_prompt === 'string') {
    if (body.system_prompt.length < 10 || body.system_prompt.length > 4000) {
      return NextResponse.json(
        { error: 'invalid_system_prompt' },
        { status: 400 }
      );
    }
    update.system_prompt = body.system_prompt;
  }
  if (typeof body.emoji === 'string') {
    update.emoji = body.emoji.slice(0, 8);
  }
  if (body.concurso_id === null || typeof body.concurso_id === 'string') {
    update.concurso_id = body.concurso_id;
  }
  if (
    body.preferred_provider === null ||
    (typeof body.preferred_provider === 'string' &&
      VALID_PROVIDER.includes(body.preferred_provider))
  ) {
    update.preferred_provider = body.preferred_provider;
  }
  if (typeof body.preferred_model === 'string' || body.preferred_model === null) {
    update.preferred_model = body.preferred_model;
  }
  if (typeof body.is_public === 'boolean') {
    update.is_public = body.is_public;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 });
  }

  const { error } = await supabase
    .from('ai_personas')
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
    .from('ai_personas')
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
