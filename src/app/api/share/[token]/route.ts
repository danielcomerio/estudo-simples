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
