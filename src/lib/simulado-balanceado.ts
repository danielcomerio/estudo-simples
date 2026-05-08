/**
 * Picker de simulado balanceado: pega N questões respeitando peso de
 * disciplina × fraqueza do user × spread de tipo.
 *
 * Algoritmo:
 * 1. Pra cada disciplina vinculada ao concurso, calcula quota:
 *    quota = round(N × peso / pesoTotal)
 * 2. Aplica BIAS de fraqueza: disciplinas com <40% acerto recebem +20% quota
 *    (extras compensados de disciplinas com >70%).
 * 3. Pra cada disciplina, pega quota questões priorizando:
 *    - 50% das questões com tentativas+wrong (revisão)
 *    - 30% das novas (introduzir)
 *    - 20% aleatórias da disciplina
 * 4. Mistura final.
 *
 * Sem IA — determinístico, sem gasto de tokens.
 */

import type { Question } from './types';

export type DiscWeight = { disciplina: string; peso: number };

export function pickBalancedSimulado(
  questions: Question[],
  weights: DiscWeight[],
  totalN: number
): Question[] {
  if (weights.length === 0 || questions.length === 0 || totalN === 0) {
    return [];
  }

  const pesoTotal = weights.reduce((a, w) => a + Math.max(1, w.peso), 0);

  // Stats por disciplina
  type Stat = { tentativas: number; acertos: number };
  const stats = new Map<string, Stat>();
  for (const q of questions) {
    const d = q.disciplina_id ?? '';
    if (!d) continue;
    const s = stats.get(d) ?? { tentativas: 0, acertos: 0 };
    s.tentativas += q.stats?.attempts ?? 0;
    s.acertos += q.stats?.correct ?? 0;
    stats.set(d, s);
  }

  const result: Question[] = [];
  let used = new Set<string>();

  for (const w of weights) {
    let quota = Math.round((totalN * Math.max(1, w.peso)) / pesoTotal);
    const s = stats.get(w.disciplina) ?? { tentativas: 0, acertos: 0 };
    const acerto = s.tentativas > 0 ? s.acertos / s.tentativas : 0.5;
    if (acerto < 0.4) quota = Math.round(quota * 1.2);
    else if (acerto > 0.7) quota = Math.round(quota * 0.85);
    quota = Math.max(1, quota);

    const pool = questions.filter(
      (q) => q.disciplina_id === w.disciplina && q.type === 'objetiva' && !used.has(q.id)
    );
    if (pool.length === 0) continue;

    const erradas = pool
      .filter((q) => (q.stats?.wrong ?? 0) > 0)
      .sort((a, b) => (b.stats?.wrong ?? 0) - (a.stats?.wrong ?? 0));
    const novas = pool.filter((q) => (q.stats?.attempts ?? 0) === 0);
    const random = pool.slice().sort(() => Math.random() - 0.5);

    const slots = {
      revisao: Math.round(quota * 0.5),
      novas: Math.round(quota * 0.3),
      random: Math.max(0, quota - Math.round(quota * 0.5) - Math.round(quota * 0.3)),
    };

    const pick = (arr: Question[], n: number) => {
      const got: Question[] = [];
      for (const q of arr) {
        if (got.length >= n) break;
        if (used.has(q.id)) continue;
        got.push(q);
        used.add(q.id);
      }
      return got;
    };

    result.push(...pick(erradas, slots.revisao));
    result.push(...pick(novas, slots.novas));
    result.push(...pick(random, slots.random));
  }

  // Mistura aleatória final
  return result.slice(0, totalN).sort(() => Math.random() - 0.5);
}
