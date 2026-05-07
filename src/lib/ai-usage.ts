/**
 * Helper server-side pra registrar uso de IA na tabela ai_usage.
 *
 * Best-effort: falha NÃO trava o flow principal. Console.warn e segue.
 */

import { getSupabaseAdmin } from './supabase/admin';

export type AIUsageInput = {
  userId: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  promptChars: number;
  responseChars: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  cached?: boolean;
  kind?: string;
};

export async function recordAIUsage(input: AIUsageInput): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from('ai_usage').insert({
      user_id: input.userId,
      provider: input.provider,
      model: input.model,
      prompt_chars: input.promptChars,
      response_chars: input.responseChars,
      prompt_tokens: input.promptTokens ?? null,
      completion_tokens: input.completionTokens ?? null,
      cached: input.cached ?? false,
      kind: input.kind ?? null,
    });
  } catch (e) {
    console.warn('[ai-usage] insert failed:', e);
  }
}

/**
 * Cálculo de custo estimado baseado em pricing público dos providers
 * (atualizado em 2026-05). Retorna em centavos de USD pra evitar FP issues.
 *
 * Quando token counts reais não disponíveis, usa chars/4 como proxy.
 */
const PRICING_CENTS_PER_MTOK: Record<
  string,
  { input: number; output: number }
> = {
  // OpenAI
  'gpt-4o-mini': { input: 15, output: 60 },
  'gpt-4o': { input: 250, output: 1000 },
  // Anthropic
  'claude-haiku-4-5-20251001': { input: 25, output: 125 },
  'claude-sonnet-4-6': { input: 300, output: 1500 },
  // Gemini
  'gemini-2.0-flash-exp': { input: 0, output: 0 }, // experimental — free
  'gemini-1.5-flash': { input: 7.5, output: 30 },
  'gemini-1.5-pro': { input: 125, output: 500 },
};

export function estimateCostCents(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const p = PRICING_CENTS_PER_MTOK[model];
  if (!p) return 0;
  return (
    (promptTokens / 1_000_000) * p.input +
    (completionTokens / 1_000_000) * p.output
  );
}
