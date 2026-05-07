/**
 * POST /api/ai/chat — proxy pra OpenAI/Anthropic/Gemini.
 *
 * Modelo BYO (Bring Your Own): user envia a chave própria. App passa
 * pra provider. NUNCA armazena a chave no server (mesmo em logs).
 *
 * Body: {
 *   provider: 'openai' | 'anthropic' | 'gemini',
 *   apiKey: string,
 *   prompt: string,
 *   model?: string (opcional, default razoável por provider)
 * }
 *
 * Response: { text: string } ou { error, message }.
 *
 * Auth: usuário do app deve estar logado (evita uso anônimo do nosso
 * proxy pra fazer pass-through de chaves de outros).
 *
 * Rate limit: 30/min por user.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULTS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.0-flash-exp',
};

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, {
    max: 30,
    windowMs: 60_000,
    keyPrefix: 'ai-chat',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: {
    provider?: string;
    apiKey?: string;
    prompt?: string;
    model?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (
    body.provider !== 'openai' &&
    body.provider !== 'anthropic' &&
    body.provider !== 'gemini'
  ) {
    return NextResponse.json(
      { error: 'invalid_provider' },
      { status: 400 }
    );
  }
  if (
    typeof body.apiKey !== 'string' ||
    body.apiKey.length < 20 ||
    body.apiKey.length > 500
  ) {
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 400 });
  }
  if (
    typeof body.prompt !== 'string' ||
    body.prompt.length < 1 ||
    body.prompt.length > 10000
  ) {
    return NextResponse.json({ error: 'invalid_prompt' }, { status: 400 });
  }

  const model = body.model || DEFAULTS[body.provider];
  const provider = body.provider;
  const apiKey = body.apiKey;
  const prompt = body.prompt;

  try {
    let text = '';
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        return NextResponse.json(
          { error: 'provider_error', message: j?.error?.message ?? 'erro' },
          { status: r.status }
        );
      }
      text = j?.choices?.[0]?.message?.content ?? '';
    } else if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        return NextResponse.json(
          { error: 'provider_error', message: j?.error?.message ?? 'erro' },
          { status: r.status }
        );
      }
      text = j?.content?.[0]?.text ?? '';
    } else {
      // gemini
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        return NextResponse.json(
          { error: 'provider_error', message: j?.error?.message ?? 'erro' },
          { status: r.status }
        );
      }
      text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      {
        error: 'request_failed',
        message: e instanceof Error ? e.message : 'erro',
      },
      { status: 500 }
    );
  }
}
