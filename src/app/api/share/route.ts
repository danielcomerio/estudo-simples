/**
 * POST /api/share — cria um link de compartilhamento (snapshot
 * filtrado, modelo C2).
 *
 * Segurança em camadas:
 *  - auth.getUser() obrigatório.
 *  - canShareDecks: só Pro/Master.
 *  - validateShareRequest: cap de 5000 questões, expiração 1-365 dias.
 *  - Rate limit: 10 links/min por IP.
 *  - assertSameOrigin: anti-CSRF.
 *  - Token gerado server-side (crypto.randomUUID), nunca pelo cliente.
 *  - Snapshot é cópia sanitizada (sem srs/stats do owner).
 *  - Verifica que TODAS as questões pertencem ao user (RLS já cobre,
 *    mas double-check anti-IDOR).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMyPlan, canShareDecks } from '@/lib/billing';
import {
  generateShareToken,
  maskEmail,
  sanitizeQuestionsForShare,
  validateShareRequest,
} from '@/lib/sharing';
import { assertSameOrigin, rateLimit } from '@/lib/security';
import type { Question } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Rate limit conservador — 10 links/min por IP.
  const rl = rateLimit(req, {
    max: 10,
    windowMs: 60_000,
    keyPrefix: 'share-create',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // GATE PRO: só Pro/Master pode compartilhar.
  const plan = await getMyPlan(supabase);
  if (!canShareDecks(plan)) {
    return NextResponse.json(
      {
        error: 'pro_required',
        message:
          'Compartilhar bancos é exclusivo do plano Pro. Faça upgrade pra desbloquear.',
      },
      { status: 403 }
    );
  }

  // Body: { questionIds: string[], expirationDays?: number }
  let body: {
    questionIds?: unknown;
    expirationDays?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const questionIds = Array.isArray(body.questionIds)
    ? (body.questionIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const expirationDays =
    typeof body.expirationDays === 'number' ? body.expirationDays : 30;

  const v = validateShareRequest({ questionIds, expirationDays });
  if (!v.ok) {
    return NextResponse.json({ error: 'invalid_input', message: v.error }, { status: 400 });
  }

  // Carrega as questões do user. RLS garante que só vê próprias —
  // duplo check abaixo (.eq user_id) por defesa em camadas.
  const { data: rows, error } = await supabase
    .from('questions')
    .select('*')
    .eq('user_id', user.id)
    .in('id', questionIds)
    .is('deleted_at', null);

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: 'no_questions_found' },
      { status: 404 }
    );
  }
  // Anti-IDOR: count das questões do user deve igualar o solicitado.
  // Se faltam, alguma id era de outro user (RLS filtrou) ou já foi
  // deletada — resposta clara de quantas faltaram.
  if (rows.length !== questionIds.length) {
    return NextResponse.json(
      {
        error: 'partial_fetch',
        message: `Encontradas ${rows.length} de ${questionIds.length} questões. Algumas podem ter sido deletadas ou não pertencem à sua conta.`,
      },
      { status: 400 }
    );
  }

  const snapshot = sanitizeQuestionsForShare(rows as Question[]);
  const token = generateShareToken();
  const expiresAt = new Date(
    Date.now() + expirationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: insErr } = await supabase.from('shared_decks').insert({
    token,
    owner_user_id: user.id,
    owner_display: maskEmail(user.email ?? null),
    filtro: {},
    snapshot,
    question_count: snapshot.length,
    expires_at: expiresAt,
  });

  if (insErr) {
    return NextResponse.json(
      { error: 'insert_failed', message: insErr.message },
      { status: 500 }
    );
  }

  // URL relativa — cliente compõe com origin atual
  return NextResponse.json({
    token,
    url: `/import/${token}`,
    expires_at: expiresAt,
    question_count: snapshot.length,
  });
}

/**
 * GET /api/share — lista links do owner (própria conta).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('shared_decks')
    .select(
      'id, token, question_count, created_at, expires_at, access_count, revoked_at, is_public, title, description'
    )
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ links: data ?? [] });
}
