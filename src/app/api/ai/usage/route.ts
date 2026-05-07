/**
 * GET /api/ai/usage — agregado de uso de IA do user (últimos 30 dias).
 *
 * Output:
 *   total_calls, total_chars_in, total_chars_out, cached_calls,
 *   estimated_cost_cents, by_provider [], by_kind []
 *
 * Cost estimation usa pricing público dos providers + token counts
 * reais quando disponíveis, fallback chars/4.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { estimateCostCents } from '@/lib/ai-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const { data, error } = await supabase
    .from('ai_usage')
    .select(
      'provider, model, prompt_chars, response_chars, prompt_tokens, completion_tokens, cached, kind'
    )
    .eq('user_id', user.id)
    .gte('created_at', cutoff)
    .limit(5000);

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error.message },
      { status: 500 }
    );
  }

  const rows = data ?? [];
  let totalCalls = 0;
  let cachedCalls = 0;
  let totalCharsIn = 0;
  let totalCharsOut = 0;
  let totalCostCents = 0;

  const byProvider = new Map<
    string,
    { calls: number; cost_cents: number; chars_in: number; chars_out: number }
  >();
  const byKind = new Map<string, number>();

  for (const r of rows) {
    totalCalls++;
    if (r.cached) cachedCalls++;
    totalCharsIn += r.prompt_chars ?? 0;
    totalCharsOut += r.response_chars ?? 0;

    const promptTokens = r.prompt_tokens ?? Math.ceil((r.prompt_chars ?? 0) / 4);
    const completionTokens =
      r.completion_tokens ?? Math.ceil((r.response_chars ?? 0) / 4);

    // Cached não cobra (resposta veio do nosso cache)
    const cost = r.cached ? 0 : estimateCostCents(r.model, promptTokens, completionTokens);
    totalCostCents += cost;

    const p = byProvider.get(r.provider) ?? {
      calls: 0,
      cost_cents: 0,
      chars_in: 0,
      chars_out: 0,
    };
    p.calls++;
    p.cost_cents += cost;
    p.chars_in += r.prompt_chars ?? 0;
    p.chars_out += r.response_chars ?? 0;
    byProvider.set(r.provider, p);

    if (r.kind) {
      byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    period_days: 30,
    total_calls: totalCalls,
    cached_calls: cachedCalls,
    total_chars_in: totalCharsIn,
    total_chars_out: totalCharsOut,
    estimated_cost_cents: Math.round(totalCostCents * 100) / 100,
    by_provider: Array.from(byProvider.entries()).map(([provider, v]) => ({
      provider,
      ...v,
      cost_cents: Math.round(v.cost_cents * 100) / 100,
    })),
    by_kind: Array.from(byKind.entries()).map(([kind, calls]) => ({
      kind,
      calls,
    })),
  });
}
