/**
 * POST /api/telegram/webhook — recebe updates do Telegram Bot API.
 *
 * Setup (admin):
 *   curl https://api.telegram.org/botTOKEN/setWebhook?url=https://app.estudosimples.com.br/api/telegram/webhook
 *
 * Tratamos só /start TOKEN — usado pra confirmar binding.
 *
 * Segurança: Telegram exige HTTPS. Idealmente também secret_token
 * via header X-Telegram-Bot-Api-Secret-Token (config no setWebhook).
 * Aqui implementamos o secret check opcional.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(req: Request) {
  // Secret check (opcional — config via setWebhook secret_token=)
  if (WEBHOOK_SECRET) {
    const got = req.headers.get('x-telegram-bot-api-secret-token');
    if (got !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'invalid_secret' }, { status: 401 });
    }
  }

  let body: {
    update_id?: number;
    message?: {
      chat?: { id?: number; first_name?: string; username?: string };
      text?: string;
    };
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = body.message;
  if (!msg?.chat?.id || !msg.text) {
    return NextResponse.json({ ok: true });
  }
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Suportamos só /start TOKEN
  if (!text.startsWith('/start ')) {
    if (text === '/start' || text === '/help') {
      await sendTelegramMessage(
        chatId,
        '👋 Bem-vindo ao bot do <b>Estudo Simples</b>!\n\nPra vincular sua conta, vá em <a href="https://app.estudosimples.com.br/configuracoes">/configuracoes</a> no app, encontre a seção Telegram e clique no link de vinculação.'
      );
    }
    return NextResponse.json({ ok: true });
  }

  const token = text.slice(7).trim();
  if (!token || token.length < 16 || token.length > 64) {
    return NextResponse.json({ ok: true });
  }

  // Procura binding pendente
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('telegram_bindings')
    .select('id, user_id, bind_token_expires_at, bound_at')
    .eq('bind_token', token)
    .maybeSingle();

  if (error || !data) {
    await sendTelegramMessage(
      chatId,
      '❌ Token inválido ou expirado. Gere um novo no app em <i>Configurações → Telegram</i>.'
    );
    return NextResponse.json({ ok: true });
  }

  if (data.bound_at) {
    await sendTelegramMessage(
      chatId,
      '✅ Sua conta já está vinculada! Receba avisos de revisão e estatísticas semanais aqui.'
    );
    return NextResponse.json({ ok: true });
  }

  if (
    data.bind_token_expires_at &&
    new Date(data.bind_token_expires_at).getTime() < Date.now()
  ) {
    await sendTelegramMessage(
      chatId,
      '⏰ Token expirado. Gere um novo no app em <i>Configurações → Telegram</i>.'
    );
    return NextResponse.json({ ok: true });
  }

  // Confirma binding
  const display =
    msg.chat.first_name ||
    (msg.chat.username ? `@${msg.chat.username}` : null);

  await sb
    .from('telegram_bindings')
    .update({
      chat_id: chatId,
      display,
      bound_at: new Date().toISOString(),
      bind_token: null, // limpa token (one-shot)
    })
    .eq('id', data.id);

  await sendTelegramMessage(
    chatId,
    `🎯 Vinculação concluída, ${display ?? 'concurseiro'}!\n\nVocê receberá:\n• Lembretes diários de revisão\n• Streak em risco\n• Resumo semanal\n\nManage em <a href="https://app.estudosimples.com.br/configuracoes">/configuracoes</a>.`
  );

  return NextResponse.json({ ok: true });
}
