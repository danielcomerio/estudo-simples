/**
 * POST /api/ai/search — busca semântica em questões via IA.
 *
 * Body: {
 *   provider, apiKey,
 *   query: string,           — pergunta natural ("questões sobre arts da CF")
 *   questions: Array<{ id, enunciado, disciplina, tags }>,  — pool a filtrar
 *   limit?: number           — max IDs retornados (default 20)
 * }
 *
 * Response: { ids: string[] }  — IDs das questões mais relevantes,
 *                                ordenados por relevância semântica.
 *
 * Custo: 1 call por busca. Cap em 200 questões no pool (truncate),
 * senão prompt fica gigante.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimit } from '@/lib/security';
import { recordAIUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_POOL = 200;

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
    keyPrefix: 'ai-search',
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
    provider?: 'openai' | 'anthropic' | 'gemini';
    apiKey?: string;
    query?: string;
    questions?: Array<{
      id: string;
      enunciado?: string;
      disciplina?: string;
      tags?: string[];
    }>;
    limit?: number;
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
    typeof body.query !== 'string' ||
    !body.query.trim() ||
    body.query.length > 500
  ) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    return NextResponse.json({ error: 'empty_pool' }, { status: 400 });
  }

  const provider = body.provider;
  const apiKey = body.apiKey;
  const query = body.query.trim();
  const limit = Math.max(1, Math.min(100, body.limit ?? 20));
  const model = DEFAULTS[provider];

  // Trunca pool e enunciados pra não estourar prompt
  const pool = body.questions.slice(0, MAX_POOL).map((q) => ({
    id: q.id,
    e: (q.enunciado ?? '').slice(0, 200),
    d: q.disciplina ?? '',
    t: (q.tags ?? []).slice(0, 5).join(','),
  }));

  const prompt = `Você é um motor de busca semântica de questões de concurso. Receba a query do usuário e a lista de questões abaixo. Retorne APENAS um array JSON com os IDs das questões mais relevantes pra query, ordenados por relevância (mais relevante primeiro). Max ${limit} IDs.

REGRAS:
1. Responda APENAS com array JSON. Sem texto antes/depois.
2. Use só IDs que aparecem na lista.
3. Se nada for relevante, retorne [].
4. Considere sinônimos, conceitos relacionados, não só keyword matching.

QUERY: ${query}

QUESTÕES:
${pool.map((q) => `- ${q.id}: [${q.d}] ${q.e}${q.t ? ` (tags: ${q.t})` : ''}`).join('\n')}

Comece direto com [`;

  try {
    const text = await callProvider(provider, model, apiKey, prompt);
    void recordAIUsage({
      userId: user.id,
      provider,
      model,
      promptChars: prompt.length,
      responseChars: text.length,
      cached: false,
      kind: 'search',
    });
    const ids = parseIds(text, body.questions.map((q) => q.id));
    return NextResponse.json({ ids });
  } catch (e) {
    return NextResponse.json(
      { error: 'search_failed', message: e instanceof Error ? e.message : 'erro' },
      { status: 500 }
    );
  }
}

async function callProvider(
  provider: 'openai' | 'anthropic' | 'gemini',
  model: string,
  apiKey: string,
  prompt: string
): Promise<string> {
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
      }),
    });
    const j = await r.json();
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
    const j = await r.json();
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
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseIds(raw: string, validIds: string[]): string[] {
  let s = raw.trim();
  // Strip fence
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  // Aceita array OR primeira linha JSON
  if (!s.endsWith(']')) {
    const last = s.lastIndexOf(']');
    if (last > 0) s = s.slice(0, last + 1);
  }
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    const validSet = new Set(validIds);
    return parsed.filter(
      (id): id is string => typeof id === 'string' && validSet.has(id)
    );
  } catch {
    return [];
  }
}
