'use client';

import { useMemo } from 'react';
import { calcularResultado } from '@/lib/simulado';
import type { Question, Simulado } from '@/lib/types';

/**
 * Placeholder — sub-etapa 1.1.4 vai implementar:
 *  - resumo (acertos no tempo / extra / não respondidas, % e tempo)
 *  - tabela por disciplina
 *  - lista de erradas com explicação geral expandida
 *  - botão pra rate em SRS as questões depois (opcional)
 */
export function SimuladoReport({
  simulado,
  questions,
  onBack,
}: {
  simulado: Simulado;
  questions: Question[];
  onBack: () => void;
}) {
  const lookup = useMemo(
    () => new Map(questions.map((q) => [q.id, q] as const)),
    [questions]
  );
  const resultado = useMemo(
    () => calcularResultado(simulado, lookup),
    [simulado, lookup]
  );

  return (
    <div className="card">
      <h2>Relatório (placeholder)</h2>
      <p className="muted">UI completa virá na sub-etapa 1.1.4.</p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <strong>{resultado.acertos_no_tempo}</strong> /{' '}
          {resultado.total} certas no tempo (
          {(resultado.pct_no_tempo * 100).toFixed(1)}%)
        </li>
        <li>
          <strong>{resultado.acertos_extra}</strong> certas em tempo extra
        </li>
        <li>
          <strong>{resultado.nao_respondidas}</strong> não respondidas
        </li>
        <li>
          Pct geral: {(resultado.pct_geral * 100).toFixed(1)}%
        </li>
      </ul>
      <div className="row gap right" style={{ marginTop: 14 }}>
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      </div>
    </div>
  );
}
