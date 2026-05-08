'use client';

import { useRouter } from 'next/navigation';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { isOverdue } from '@/lib/srs';

/**
 * "🎯 Decidir por mim" — heurística determinística (sem IA, sem custo)
 * que escolhe modo+qtd ideal baseado no estado:
 *  - >=10 vencidas → SRS 15
 *  - >=5 inimigas → modo erros 10
 *  - tem novas e nada vencendo → novas 10
 *  - resto → aleatório 10
 *
 * Inicia direto, sem perguntar.
 */
export function AIOneClickDeciderButton() {
  const router = useRouter();
  const all = useStore(selectActiveQuestions);

  const objetivas = all.filter((q) => q.type === 'objetiva');
  if (objetivas.length === 0) return null;

  const decide = () => {
    const now = Date.now();
    const vencidas = objetivas.filter((q) => isOverdue(q.srs, now)).length;
    const inimigas = objetivas.filter((q) => {
      const t = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      return t >= 3 && c / t < 0.4;
    }).length;
    const novas = objetivas.filter((q) => (q.srs?.repetitions ?? 0) === 0).length;

    let modo: string;
    let qtd: number;
    if (vencidas >= 10) {
      modo = 'srs';
      qtd = 15;
    } else if (inimigas >= 5) {
      modo = 'inimigas';
      qtd = 10;
    } else if (novas >= 5 && vencidas === 0) {
      modo = 'novas';
      qtd = 10;
    } else if (vencidas > 0) {
      modo = 'srs';
      qtd = vencidas;
    } else {
      modo = 'aleatorio';
      qtd = 10;
    }

    router.push(`/estudar?modo=${modo}&qtd=${qtd}&auto=1`);
  };

  return (
    <button
      type="button"
      className="primary"
      onClick={decide}
      title="Heurística automática escolhe modo + quantidade ideal"
      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
    >
      🎯 Decidir por mim
    </button>
  );
}
