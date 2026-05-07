/**
 * Helper pra gravar audit log de ações sensíveis.
 *
 * Usage (em server actions / API routes):
 *
 *   await audit({
 *     userId: user.id,
 *     action: 'plan.changed',
 *     meta: { from: 'free', to: 'pro' },
 *     req,  // opcional — extrai IP + UA
 *   });
 *
 * Falha do audit NÃO deve quebrar o fluxo principal — log e segue.
 */

import { getSupabaseAdmin } from './supabase/admin';

export type AuditAction =
  | 'plan.changed'
  | 'plan.canceled'
  | 'account.deleted'
  | 'account.signup'
  | 'sharing.created'
  | 'sharing.public_enabled'
  | 'sharing.revoked'
  | 'password.changed'
  | 'admin.master_promoted'
  | 'admin.deck_curated';

export type AuditInput = {
  userId: string | null;
  actorUserId?: string | null;
  action: AuditAction | string;
  meta?: Record<string, unknown>;
  req?: Request;
};

export async function audit(input: AuditInput): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    let ip: string | null = null;
    let ua: string | null = null;
    if (input.req) {
      ip =
        input.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        input.req.headers.get('x-real-ip') ??
        null;
      ua = input.req.headers.get('user-agent') ?? null;
      // Cap UA pra evitar payload absurdo
      if (ua && ua.length > 500) ua = ua.slice(0, 500);
    }
    await sb.from('audit_log').insert({
      user_id: input.userId,
      actor_user_id: input.actorUserId ?? input.userId,
      action: input.action,
      meta: input.meta ?? {},
      ip,
      user_agent: ua,
    });
  } catch (e) {
    // Log mas não throw — audit é best-effort
    console.error('[audit] insert failed:', e);
  }
}
