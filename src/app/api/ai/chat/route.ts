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
 *   model?: string (opcional, default razoável por provider),
 *   stream?: boolean (default false; quando true retorna text/event-stream)
 * }
 *
 * Response:
 *   - JSON: { text: string } ou { error, message } (mode default)
 *   - SSE: linhas `data: <chunk>\n\n`, terminado com `data: [DONE]\n\n`.
 *          Erros viram `event: error\ndata: <msg>\n\n`.
 *
 * Auth: usuário do app deve estar logado (evita uso anônimo do nosso
 * proxy pra fazer pass-through de chaves de outros).
 *
 * Rate limit: 30/min por user.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { assertSameOrigin, rateLimit } from '@/lib/security';
import { buildCacheKey } from '@/lib/ai-cache';
import { recordAIUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULTS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.0-flash-exp',
};

type Provider = 'openai' | 'anthropic' | 'gemini';

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
    stream?: boolean;
    cacheable?: boolean;
    kind?: string;
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
    return NextResponse.json({ error: 'invalid_provider' }, { status: 400 });
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

  const provider = body.provider as Provider;
  const model = body.model || DEFAULTS[provider];
  const apiKey = body.apiKey;
  const prompt = body.prompt;
  const wantStream = body.stream === true;
  const cacheable = body.cacheable === true;
  const kind = typeof body.kind === 'string' ? body.kind.slice(0, 32) : undefined;

  // Cache lookup (só quando user marcou cacheable=true).
  // Cacheable é determinístico: prompt sem turn dinâmico (ex: "explica
  // questão X" sim; "chat com histórico Y" não).
  let cacheKey: string | null = null;
  if (cacheable) {
    cacheKey = await buildCacheKey(provider, model, prompt);
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('ai_response_cache')
      .select('response')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (data?.response) {
      // Hit — incrementa contador + registra uso (cached:true, sem custo)
      sb.rpc('ai_cache_record_hit', { p_cache_key: cacheKey }).then(() => {});
      void recordAIUsage({
        userId: user.id,
        provider,
        model,
        promptChars: prompt.length,
        responseChars: data.response.length,
        cached: true,
        kind,
      });
      if (wantStream) {
        return streamCached(data.response);
      }
      return NextResponse.json({ text: data.response, cached: true });
    }
  }

  if (wantStream) {
    return streamResponse(provider, model, apiKey, prompt, cacheKey, {
      userId: user.id,
      kind,
    });
  }

  // Non-streaming: comportamento original (não-breaking pra clients atuais).
  try {
    const text = await callNonStream(provider, model, apiKey, prompt);
    if (cacheKey) {
      void storeInCache(cacheKey, provider, model, text);
    }
    void recordAIUsage({
      userId: user.id,
      provider,
      model,
      promptChars: prompt.length,
      responseChars: text.length,
      cached: false,
      kind,
    });
    return NextResponse.json({ text, cached: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return NextResponse.json(
      { error: 'request_failed', message: msg },
      { status: 500 }
    );
  }
}

async function storeInCache(
  cacheKey: string,
  provider: Provider,
  model: string,
  text: string
): Promise<void> {
  if (!text || text.length < 10) return; // não cacheia respostas vazias/lixo
  try {
    const sb = getSupabaseAdmin();
    await sb.from('ai_response_cache').upsert(
      {
        cache_key: cacheKey,
        provider,
        model,
        response: text,
        tokens_estimated: Math.ceil(text.length / 4), // rough estimate
      },
      { onConflict: 'cache_key' }
    );
  } catch (e) {
    console.warn('[ai-cache] store failed', e);
  }
}

/**
 * Stream uma resposta cacheada já completa (palavra por palavra com
 * pequeno delay pra UX consistente — sem isso o cache fica visualmente
 * brusco vs uma chamada real).
 */
function streamCached(cachedText: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Quebra em chunks de ~30 chars pra simular streaming sem ser muito lento
      const CHUNK_SIZE = 30;
      for (let i = 0; i < cachedText.length; i += CHUNK_SIZE) {
        const piece = cachedText.slice(i, i + CHUNK_SIZE);
        controller.enqueue(encoder.encode(`data: ${piece}\n\n`));
        // Pequeno delay pra UX (não trava o usuário)
        await new Promise((r) => setTimeout(r, 8));
      }
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Cache': 'HIT',
    },
  });
}

async function callNonStream(
  provider: Provider,
  model: string,
  apiKey: string,
  prompt: string
): Promise<string> {
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
    if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
    return j?.choices?.[0]?.message?.content ?? '';
  }
  if (provider === 'anthropic') {
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
    if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
    return j?.content?.[0]?.text ?? '';
  }
  // gemini
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * Retorna ReadableStream SSE com chunks de texto. Cada provider tem seu
 * próprio formato — abstraímos pra `text/event-stream` uniforme:
 *   data: <chunk>\n\n          (cada delta de texto)
 *   data: [DONE]\n\n            (terminador)
 *   event: error\ndata: msg\n\n (em caso de falha)
 */
function streamResponse(
  provider: Provider,
  model: string,
  apiKey: string,
  prompt: string,
  cacheKey: string | null = null,
  usage?: { userId: string; kind?: string }
): Response {
  const encoder = new TextEncoder();
  const accumulated: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        accumulated.push(chunk);
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      };
      const error = (msg: string) =>
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${msg}\n\n`)
        );

      try {
        if (provider === 'openai') {
          await streamOpenAI(model, apiKey, prompt, send);
        } else if (provider === 'anthropic') {
          await streamAnthropic(model, apiKey, prompt, send);
        } else {
          await streamGemini(model, apiKey, prompt, send);
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        const fullText = accumulated.join('');
        if (cacheKey && fullText.length > 0) {
          void storeInCache(cacheKey, provider, model, fullText);
        }
        if (usage) {
          void recordAIUsage({
            userId: usage.userId,
            provider,
            model,
            promptChars: prompt.length,
            responseChars: fullText.length,
            cached: false,
            kind: usage.kind,
          });
        }
      } catch (e) {
        error(e instanceof Error ? e.message : 'erro de stream');
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ---------- Provider-specific streaming readers ----------

/**
 * Lê linhas SSE da resposta. OpenAI e Anthropic usam SSE; Gemini usa
 * NDJSON. `parseLine` recebe a linha sem o prefixo "data: " e devolve
 * o texto delta (ou null se a linha não tem texto).
 */
async function pumpSSE(
  res: Response,
  parseLine: (data: string) => string | null,
  send: (chunk: string) => void
): Promise<void> {
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      const text = parseLine(payload);
      if (text) send(text);
    }
  }
}

async function streamOpenAI(
  model: string,
  apiKey: string,
  prompt: string,
  send: (chunk: string) => void
): Promise<void> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      stream: true,
    }),
  });
  await pumpSSE(
    res,
    (data) => {
      try {
        const j = JSON.parse(data);
        return j?.choices?.[0]?.delta?.content ?? null;
      } catch {
        return null;
      }
    },
    send
  );
}

async function streamAnthropic(
  model: string,
  apiKey: string,
  prompt: string,
  send: (chunk: string) => void
): Promise<void> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  await pumpSSE(
    res,
    (data) => {
      try {
        const j = JSON.parse(data);
        // content_block_delta: { delta: { type: 'text_delta', text: '...' } }
        if (j?.type === 'content_block_delta' && j?.delta?.text) {
          return j.delta.text;
        }
        return null;
      } catch {
        return null;
      }
    },
    send
  );
}

async function streamGemini(
  model: string,
  apiKey: string,
  prompt: string,
  send: (chunk: string) => void
): Promise<void> {
  // Gemini: streamGenerateContent retorna NDJSON (não SSE).
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  // Com `alt=sse`, Gemini retorna SSE — mesmo formato `data: {...}` por chunk
  await pumpSSE(
    res,
    (data) => {
      try {
        const j = JSON.parse(data);
        return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      } catch {
        return null;
      }
    },
    send
  );
}
