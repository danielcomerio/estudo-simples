/**
 * DELETE /api/live-decks/[id]/grants/[grantId] — revoga acesso.
 * Trigger DB freeze_grant_on_revoke gera snapshot via shared_decks
 * (Fase C2) automaticamente — grantee perde acesso live mas recebe
 * link permanente readonly do estado naquele momento.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; grantId: string } }
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

  // UPDATE em vez de DELETE — preserva histórico + dispara trigger
  // de freeze_grant_on_revoke (gera snapshot Fase C2).
  const { data, error } = await supabase
    .from('live_deck_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', params.grantId)
    .eq('deck_id', params.id)
    .eq('owner_user_id', user.id)
    .is('revoked_at', null)
    .select('frozen_share_token')
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'revoke_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    frozen_share_token: data?.frozen_share_token ?? null,
  });
}
