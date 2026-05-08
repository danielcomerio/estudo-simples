'use client';

import { useMemo } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { useDisciplinas, useAllConcursoDisciplinas } from '@/lib/hierarchy';

/**
 * Badge "saúde" pra cada concurso. Score 0-100 baseado em:
 *  - Cobertura: % de disciplinas com >=10 questões no banco
 *  - Domínio: média ponderada de % acerto por peso da disciplina
 *
 * Score = 0.4*cobertura + 0.6*domínio (peso domínio > cobertura).
 *
 * Cor: verde >=70, amarelo 40-69, vermelho <40.
 */
export function ConcursoHealthBadge({ concursoId }: { concursoId: string }) {
  const questions = useStore(selectActiveQuestions);
  const { data: disciplinas } = useDisciplinas();
  const { data: cdLinks } = useAllConcursoDisciplinas();

  const stats = useMemo(() => {
    const links = (cdLinks ?? []).filter((l) => l.concurso_id === concursoId);
    if (links.length === 0) return null;

    const discNomes = links
      .map((l) => (disciplinas ?? []).find((d) => d.id === l.disciplina_id)?.nome)
      .filter((x): x is string => !!x);

    if (discNomes.length === 0) return null;

    const byDisc = new Map<string, { qts: number; tents: number; corr: number; peso: number }>();
    for (const l of links) {
      const d = (disciplinas ?? []).find((x) => x.id === l.disciplina_id);
      if (!d) continue;
      byDisc.set(d.nome, { qts: 0, tents: 0, corr: 0, peso: l.peso ?? 1 });
    }
    for (const q of questions) {
      const b = byDisc.get(q.disciplina_id ?? '');
      if (!b) continue;
      b.qts++;
      b.tents += q.stats?.attempts ?? 0;
      b.corr += q.stats?.correct ?? 0;
    }

    let cobertasComEstoque = 0;
    let pesoDom = 0;
    let pesoTotal = 0;
    for (const b of byDisc.values()) {
      if (b.qts >= 10) cobertasComEstoque++;
      if (b.tents > 0) {
        pesoDom += (b.corr / b.tents) * b.peso;
        pesoTotal += b.peso;
      }
    }
    const cobertura = (cobertasComEstoque / byDisc.size) * 100;
    const dominio = pesoTotal > 0 ? (pesoDom / pesoTotal) * 100 : 0;
    const score = Math.round(cobertura * 0.4 + dominio * 0.6);

    return { score, cobertura: Math.round(cobertura), dominio: Math.round(dominio), discCount: byDisc.size };
  }, [questions, disciplinas, cdLinks, concursoId]);

  if (!stats) return null;

  const cor =
    stats.score >= 70
      ? 'var(--primary)'
      : stats.score >= 40
        ? 'var(--warn, #d97706)'
        : 'var(--danger)';
  const label = stats.score >= 70 ? 'forte' : stats.score >= 40 ? 'parcial' : 'fraco';

  return (
    <span
      title={`Cobertura: ${stats.cobertura}% (disciplinas com ≥10 questões) · Domínio: ${stats.dominio}% (acerto ponderado por peso)`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        fontSize: '0.78rem',
        background: cor,
        color: '#fff',
        borderRadius: 999,
      }}
    >
      🩺 {stats.score}/100 · {label}
    </span>
  );
}
