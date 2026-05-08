'use client';

/**
 * Estimativas de custo IA por provider/model. Aproximadas — preços
 * mudam, esses valores são pra UX informativa, não billing.
 *
 * Atualizadas: 2026-05.
 *
 * Uso:
 *   const est = estimateCost('anthropic', 1500); // 1500 chars de prompt
 *   console.log(est.usd, est.cents); // ~0.0006 USD = ~0.06 cents
 */

import type { AIProvider } from './ai-keys';

// Preços em USD por 1K tokens. Approx tokens = chars / 4 pra PT-BR.
// Modelos default por provider (sync com /api/ai/chat DEFAULTS).
const PRICES = {
  openai: { in: 0.000_15, out: 0.000_6 }, // gpt-4o-mini per 1K tokens
  anthropic: { in: 0.000_25, out: 0.001_25 }, // claude-haiku-4-5 approx
  gemini: { in: 0, out: 0 }, // gemini-2.0-flash-exp gratuito tier
};

const USD_TO_BRL = 5.5; // approx, varia diariamente

export type CostEstimate = {
  usd: number;
  brl: number;
  cents: number;
  inputTokens: number;
  outputTokensEstimate: number;
};

/**
 * Estima custo de chamada com prompt de N chars. Output estimado em
 * 30% do input (heurística — varia muito).
 */
export function estimateCost(
  provider: AIProvider,
  inputChars: number,
  expectedOutputChars?: number
): CostEstimate {
  const inputTokens = Math.ceil(inputChars / 4);
  const outputTokensEstimate = expectedOutputChars
    ? Math.ceil(expectedOutputChars / 4)
    : Math.ceil(inputTokens * 0.3);
  const p = PRICES[provider];
  const usd =
    (inputTokens / 1000) * p.in + (outputTokensEstimate / 1000) * p.out;
  const brl = usd * USD_TO_BRL;
  const cents = Math.round(brl * 100);
  return { usd, brl, cents, inputTokens, outputTokensEstimate };
}

/**
 * Formata estimativa pra display. Retorna "grátis", "<R$ 0,01" ou
 * "R$ X,YY".
 */
export function formatCost(est: CostEstimate): string {
  if (est.cents <= 0) return 'grátis';
  if (est.cents === 1) return '~R$ 0,01';
  if (est.cents < 100) return `~R$ 0,${est.cents.toString().padStart(2, '0')}`;
  return `~R$ ${(est.cents / 100).toFixed(2).replace('.', ',')}`;
}
