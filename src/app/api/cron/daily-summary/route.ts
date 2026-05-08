/**
 * Cron diário — envia resumo do dia anterior pra cada user com webhook
 * Telegram/Discord vinculado.
 *
 * Schedule recomendado: 23h UTC (= ~20h BRT — final do dia útil).
 * Adicionar em vercel.json:
 *   { "path": "/api/cron/daily-summary", "schedule": "0 23 * * *" }
 *
 * Conteúdo do resumo:
 *  - Questões resolvidas hoje
 *  - % acerto
 *  - Streak atual (calculado do daily_question_attempts ou history)
 *  - Próximas N vencidas amanhã
 *
 * Sem IA — texto template puro. Economia de tokens.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

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
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();
  const endMs = startMs + DAY_MS;

  // Busca users com bindings (telegram OU discord)
  const { data: tgs } = await sb
    .from('telegram_bindings')
    .select('user_id, chat_id');
  const { data: dcs } = await sb
    .from('discord_webhooks')
    .select('user_id, webhook_url');

  const userIds = new Set<string>();
  const tgMap = new Map<string, number>();
  const dcMap = new Map<string, string>();
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

  let sentCount = 0;
  let errorCount = 0;

  for (const userId of userIds) {
    try {
      // Pega questões do user pra calcular stats do dia
      const { data: rows } = await sb
        .from('questions')
        .select('id, stats, srs')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .limit(5000); // safety cap

      if (!rows || rows.length === 0) continue;

      let resolvidasHoje = 0;
      let acertosHoje = 0;
      let proximasVencendo = 0;
      const tomorrowEnd = now + DAY_MS * 2;
      for (const r of rows) {
        const hist = (r.stats as { history?: Array<{ date: number; result: string }> } | null)
          ?.history;
        if (Array.isArray(hist)) {
          for (const h of hist) {
            if (h.date >= startMs && h.date < endMs) {
              resolvidasHoje++;
              if (h.result === 'correct') acertosHoje++;
            }
          }
        }
        const due = (r.srs as { dueDate?: number } | null)?.dueDate;
        if (typeof due === 'number' && due >= endMs && due < tomorrowEnd) {
          proximasVencendo++;
        }
      }

      if (resolvidasHoje === 0 && proximasVencendo === 0) continue;

      const pct =
        resolvidasHoje > 0
          ? Math.round((acertosHoje / resolvidasHoje) * 100)
          : 0;

      const lines: string[] = [
        '📊 *Resumo do dia* (Estudo Simples)',
        '',
      ];
      if (resolvidasHoje > 0) {
        lines.push(`✅ ${resolvidasHoje} questões respondidas (${pct}% acerto)`);
      } else {
        lines.push('🔕 Você não estudou hoje.');
      }
      if (proximasVencendo > 0) {
        lines.push(`⏰ ${proximasVencendo} vencendo amanhã.`);
      }
      lines.push('');
      lines.push('Estude amanhã: https://app.estudosimples.com.br');

      const text = lines.join('\n');

      const tgChat = tgMap.get(userId);
      if (tgChat) {
        try {
          await sendTelegramMessage(tgChat, text);
          sentCount++;
        } catch {
          errorCount++;
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
          if (r.ok) sentCount++;
          else errorCount++;
        } catch {
          errorCount++;
        }
      }
    } catch {
      errorCount++;
    }
  }

  return NextResponse.json({ ok: true, sent: sentCount, errors: errorCount });
}
