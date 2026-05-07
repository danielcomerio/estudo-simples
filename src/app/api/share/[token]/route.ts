/**
 * GET /api/share/[token] — preview público do snapshot (sem importar).
 * DELETE /api/share/[token] — revoga link (só owner).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  if (!token || token.length < 16 || token.length > 64) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  // Rate limit por IP — anti-scan.
  const rl = rateLimit(req, {
    max: 60,
    windowMs: 60_000,
    keyPrefix: 'share-get',
  });
  if (rl) return rl;

  // Usa service role pra bypass RLS (recipient pode ser anon ou
  // user diferente do owner). Token é o controle de acesso.
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('shared_decks')
    .select(
      'token, owner_display, snapshot, question_count, filtro, created_at, expires_at, access_count, revoked_at'
    )
    .eq('token', token)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (data.revoked_at) {
    return NextResponse.json(
      { error: 'revoked', message: 'Link revogado pelo dono.' },
      { status: 410 } // Gone
    );
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'expired', message: 'Link expirado.' },
      { status: 410 }
    );
  }

  // Incrementa access_count (best-effort — não bloqueia resposta).
  void sb.rpc('shared_deck_increment_access', { p_token: token });

  return NextResponse.json({
    owner_display: data.owner_display,
    question_count: data.question_count,
    filtro: data.filtro,
    created_at: data.created_at,
    expires_at: data.expires_at,
    snapshot: data.snapshot,
  });
}

/**
 * PATCH — owner atualiza metadata do deck (incl. is_public + title/desc
 * pra marketplace).
 */
export async function PATCH(
  req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: {
    is_public?: boolean;
    title?: string | null;
    description?: string | null;
    category?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Validação leve
  const update: Record<string, unknown> = {};
  if (typeof body.is_public === 'boolean') update.is_public = body.is_public;
  if (typeof body.title === 'string' || body.title === null) {
    if (typeof body.title === 'string' && body.title.length > 200) {
      return NextResponse.json({ error: 'title_too_long' }, { status: 400 });
    }
    update.title = body.title;
  }
  if (typeof body.description === 'string' || body.description === null) {
    if (typeof body.description === 'string' && body.description.length > 2000) {
      return NextResponse.json(
        { error: 'description_too_long' },
        { status: 400 }
      );
    }
    update.description = body.description;
  }
  if (typeof body.category === 'string' || body.category === null) {
    update.category = body.category;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 });
  }

  const { error } = await supabase
    .from('shared_decks')
    .update(update)
    .eq('token', params.token)
    .eq('owner_user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: 'update_failed', message: error.message },
      { status: 500 }
    );
  }

  if (typeof body.is_public === 'boolean') {
    const { audit } = await import('@/lib/audit');
    void audit({
      userId: user.id,
      action: body.is_public
        ? 'sharing.public_enabled'
        : 'sharing.public_disabled',
      meta: { token: params.token },
      req,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Marca revoked_at em vez de DELETE — preserva histórico de
  // access_count e permite owner ver "esse link foi acessado N vezes".
  const { error } = await supabase
    .from('shared_decks')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)
    .eq('owner_user_id', user.id) // double-check (RLS já filtra)
    .is('revoked_at', null); // idempotência

  if (error) {
    return NextResponse.json(
      { error: 'revoke_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
