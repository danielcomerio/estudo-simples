/**
 * Mastery score por disciplina — calculado on-the-fly a partir das
 * questões. Sem persistência (deriva do estado atual).
 *
 * Score 0-100:
 *  - 70% baseado em % acerto (peso maior)
 *  - 30% baseado em cobertura de SRS (% questões com >=2 revisões)
 *
 * Badges:
 *  - 🥉 Bronze: 50-64
 *  - 🥈 Prata: 65-79
 *  - 🥇 Ouro: 80-94
 *  - 💎 Diamante: 95+
 */

import type { Question } from './types';

export type DisciplinaMastery = {
  disciplina: string;
  score: number;
  badge: '' | '🥉' | '🥈' | '🥇' | '💎';
  badgeName: string;
  qts: number;
  acerto: number;
  cobertura: number;
};

export function computeMastery(
  disciplina: string,
  questions: Question[]
): DisciplinaMastery {
  const qts = questions.filter((q) => q.disciplina_id === disciplina);
  const tents = qts.reduce((a, q) => a + (q.stats?.attempts ?? 0), 0);
  const corrects = qts.reduce((a, q) => a + (q.stats?.correct ?? 0), 0);
  const revisadas = qts.filter(
    (q) => (q.srs?.repetitions ?? 0) >= 2
  ).length;

  const acerto = tents > 0 ? (corrects / tents) * 100 : 0;
  const cobertura = qts.length > 0 ? (revisadas / qts.length) * 100 : 0;
  const score = Math.round(acerto * 0.7 + cobertura * 0.3);

  const badge: DisciplinaMastery['badge'] =
    score >= 95 ? '💎' : score >= 80 ? '🥇' : score >= 65 ? '🥈' : score >= 50 ? '🥉' : '';
  const badgeName =
    score >= 95
      ? 'Diamante'
      : score >= 80
        ? 'Ouro'
        : score >= 65
          ? 'Prata'
          : score >= 50
            ? 'Bronze'
            : 'Iniciante';

  return {
    disciplina,
    score,
    badge,
    badgeName,
    qts: qts.length,
    acerto: Math.round(acerto),
    cobertura: Math.round(cobertura),
  };
}

export function rankAllDisciplinas(
  disciplinas: string[],
  questions: Question[]
): DisciplinaMastery[] {
  return disciplinas
    .map((d) => computeMastery(d, questions))
    .sort((a, b) => b.score - a.score);
}
