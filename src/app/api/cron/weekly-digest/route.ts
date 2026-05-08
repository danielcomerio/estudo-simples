/**
 * Cron domingo 18h UTC — envia weekly digest pra Telegram/Discord
 * vinculados.
 *
 * Schedule: "0 18 * * 0" (domingo às 18h UTC ≈ 15h BRT).
 *
 * Conteúdo:
 *  - Total de questões resolvidas na semana
 *  - % acerto médio
 *  - Melhor disciplina (maior % acerto)
 *  - Disciplina pra focar (menor % acerto, mín 5 tentativas)
 *  - Próximos eventos do concurso ativo
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const sb = getSupabaseAdmin();
  const now = Date.now();
  const weekStartMs = now - WEEK_MS;

  const { data: tgs } = await sb
    .from('telegram_bindings')
    .select('user_id, chat_id');
  const { data: dcs } = await sb
    .from('discord_webhooks')
    .select('user_id, webhook_url');

  const tgMap = new Map<string, number>();
  const dcMap = new Map<string, string>();
  const userIds = new Set<string>();
  (tgs ?? []).forEach((r) => {
    if (r.user_id && r.chat_id != null) {
      userIds.add(r.user_id);
      tgMap.set(r.user_id, r.chat_id);
    }
  });
  (dcs ?? []).forEach((r) => {
    if (r.user_id && r.webhook_url) {
      userIds.add(r.user_id);
      dcMap.set(r.user_id, r.webhook_url);
    }
  });

  if (userIds.size === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no_bindings' });
  }

  let sent = 0;
  let errors = 0;

  for (const userId of userIds) {
    try {
      const { data: rows } = await sb
        .from('questions')
        .select('id, disciplina_id, stats')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .limit(5000);

      if (!rows || rows.length === 0) continue;

      type Bucket = { tentativas: number; acertos: number };
      const byDisc = new Map<string, Bucket>();
      let totalT = 0;
      let totalA = 0;
      let diasComEstudo = new Set<string>();

      for (const r of rows) {
        const hist = (r.stats as { history?: Array<{ date: number; result: string }> } | null)
          ?.history;
        if (!Array.isArray(hist)) continue;
        for (const h of hist) {
          if (h.date < weekStartMs) continue;
          totalT++;
          if (h.result === 'correct') totalA++;
          const d = r.disciplina_id ?? 'sem-disciplina';
          const b = byDisc.get(d) ?? { tentativas: 0, acertos: 0 };
          b.tentativas++;
          if (h.result === 'correct') b.acertos++;
          byDisc.set(d, b);
          diasComEstudo.add(new Date(h.date).toISOString().slice(0, 10));
        }
      }

      if (totalT === 0) continue;

      const pct = Math.round((totalA / totalT) * 100);
      const ranked = Array.from(byDisc.entries())
        .filter(([, b]) => b.tentativas >= 5)
        .map(([d, b]) => ({ d, pct: Math.round((b.acertos / b.tentativas) * 100), n: b.tentativas }));
      const melhor = [...ranked].sort((a, b) => b.pct - a.pct)[0];
      const fraca = [...ranked].sort((a, b) => a.pct - b.pct)[0];

      const lines = [
        '📅 *Resumo semanal* (Estudo Simples)',
        '',
        `📊 ${totalT} questões em ${diasComEstudo.size} dia(s) (${pct}% acerto)`,
      ];
      if (melhor && melhor !== fraca) {
        lines.push(`🌟 Mais forte: ${melhor.d} (${melhor.pct}%)`);
      }
      if (fraca && fraca !== melhor) {
        lines.push(`📉 Pra focar: ${fraca.d} (${fraca.pct}%)`);
      }
      lines.push('');
      lines.push('Próxima semana → https://app.estudosimples.com.br');
      const text = lines.join('\n');

      const tgChat = tgMap.get(userId);
      if (tgChat) {
        try {
          await sendTelegramMessage(tgChat, text);
          sent++;
        } catch {
          errors++;
        }
      }
      const dcUrl = dcMap.get(userId);
      if (dcUrl) {
        try {
          const r = await fetch(dcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: text }),
          });
          if (r.ok) sent++;
          else errors++;
        } catch {
          errors++;
        }
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}
