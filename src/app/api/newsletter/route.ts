/**
 * POST /api/newsletter — captura de email pra lead nurture.
 *
 * Segurança:
 *  - CSRF (origin check)
 *  - Rate limit estrito (3/min/IP — evita spam)
 *  - Email validado server-side
 *  - Token de unsubscribe gerado server-side
 *  - Service role pra contornar RLS no INSERT (anon pode inserir
 *    via policy mas service role permite gerar token).
 *
 * Sem necessidade de envio de e-mail de confirmação na fase atual —
 * adicionamos quando integrarmos provider (Resend/SendGrid/etc).
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidEmail(s: string): boolean {
  // Validação simples (RFC 5322 completo é overkill — provider vai validar
  // de novo no envio). Bloqueia obvio inválido + cap de tamanho.
  if (typeof s !== 'string') return false;
  if (s.length < 3 || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function genToken(): string {
  // 32 bytes hex pra unsubscribe — suficiente entropia, nada sensível.
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, { max: 3, windowMs: 60_000, keyPrefix: 'newsletter' });
  if (rl) return rl;

  let body: { email?: string; source?: string } = {};
  try {
    body = await req.json();
  } catch {}

  const email = (body.email ?? '').trim().toLowerCase();
  const source = (body.source ?? '').slice(0, 64);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  // Insert idempotente: se email já está ativo, retorna sucesso sem
  // duplicar (unique index parcial garante).
  const token = genToken();
  const { error } = await admin
    .from('newsletter_signups')
    .insert({
      email,
      source: source || null,
      unsubscribe_token: token,
    });
  if (error) {
    if (error.code === '23505') {
      // duplicate key — já cadastrado e ativo
      return NextResponse.json({ ok: true, already: true });
    }
    console.error('[newsletter] insert failed', error);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
