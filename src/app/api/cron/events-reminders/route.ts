/**
 * GET /api/cron/events-reminders — dispara notificações pra eventos
 * próximos do horário (reminder_minutes_before).
 *
 * Lógica:
 *  1. Busca eventos com notified_at IS NULL e reminder_minutes_before
 *     setado.
 *  2. Pra cada um, calcula reminderTime = starts_at - reminder_minutes
 *     (em minutos).
 *  3. Se now >= reminderTime, dispara notifyUser e marca notified_at.
 *
 * Roda 5×/dia (a cada 4h) — granularidade boa o suficiente pra
 * lembrete de evento de prova/redação. Pra timing fino (<1h),
 * recomendar push direto.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { notifyUser } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  inscricao_inicio: '📋 Inscrições abrem',
  inscricao_fim: '⏰ Inscrições fecham',
  prova_objetiva: '📝 Prova objetiva',
  prova_discursiva: '✍️ Prova discursiva',
  redacao: '📄 Redação',
  taf: '🏃 TAF',
  simulado: '🎯 Simulado',
  reuniao_estudo: '👥 Reunião de estudo',
  outro: '📅 Evento',
};

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const now = Date.now();

  // Janela: eventos cujo reminder JÁ VENCEU (sem ter sido notificado)
  // mas cujo evento ainda não passou (sem sentido lembrar do passado).
  // Calcular reminder_time no SQL é caro; fazemos no app pra simplicidade.
  const { data: events, error } = await sb
    .from('concurso_events')
    .select(
      'id, user_id, type, title, starts_at, reminder_minutes_before'
    )
    .is('notified_at', null)
    .not('reminder_minutes_before', 'is', null)
    .gte('starts_at', new Date(now).toISOString())
    .lte('starts_at', new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(500);

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  let sent = 0;
  let skipped = 0;

  for (const ev of events ?? []) {
    const startTs = Date.parse(ev.starts_at);
    const reminderTs = startTs - (ev.reminder_minutes_before ?? 0) * 60_000;
    if (reminderTs > now) {
      skipped++;
      continue;
    }

    const minutesUntil = Math.round((startTs - now) / 60_000);
    const inText =
      minutesUntil < 60
        ? `em ${minutesUntil} min`
        : minutesUntil < 1440
          ? `em ${Math.round(minutesUntil / 60)}h`
          : `em ${Math.round(minutesUntil / 1440)} dias`;

    const result = await notifyUser(ev.user_id, {
      title: `${TYPE_LABEL[ev.type] ?? '📅 Evento'}: ${ev.title}`,
      body: `Acontece ${inText}`,
      url: '/concursos',
    });

    if (result.success) {
      await sb
        .from('concurso_events')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', ev.id);
      sent++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: events?.length ?? 0,
    sent,
    skipped,
    timestamp: new Date().toISOString(),
  });
}
