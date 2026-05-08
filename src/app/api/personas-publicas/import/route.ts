/**
 * POST /api/personas-publicas/import — importa persona pública pro user.
 *
 * Body: { source_id: string }
 *
 * Cria cópia da persona pra conta do user. Pode editar livremente depois.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 10,
    windowMs: 60_000,
    keyPrefix: 'personas-import',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { source_id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (typeof body.source_id !== 'string') {
    return NextResponse.json({ error: 'invalid_source_id' }, { status: 400 });
  }

  // Busca persona pública (RLS permite SELECT em is_public=true)
  const { data: src, error: fetchErr } = await supabase
    .from('ai_personas')
    .select('name, description, emoji, system_prompt')
    .eq('id', body.source_id)
    .eq('is_public', true)
    .maybeSingle();

  if (fetchErr || !src) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('ai_personas')
    .insert({
      user_id: user.id,
      name: src.name,
      description: src.description,
      system_prompt: src.system_prompt,
      emoji: src.emoji,
      // Cópia importada começa privada
      is_public: false,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'import_failed', message: error.message },
      { status: 500 }
    );
  }

  // Incrementa use_count na persona original (best-effort)
  await supabase
    .from('ai_personas')
    .update({ use_count: 1 }) // placeholder — sem RPC ainda, increment seria ideal
    .eq('id', body.source_id);

  return NextResponse.json({ ok: true, id: data?.id });
}
