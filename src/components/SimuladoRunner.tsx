'use client';

import type { Question, Simulado } from '@/lib/types';
import {
  abandonarSimulado,
  finalizarSimulado,
} from '@/lib/simulado';

/**
 * Placeholder — sub-etapa 1.1.3 vai implementar:
 *  - cronômetro proeminente
 *  - render de questão sem feedback durante (estilo prova)
 *  - navegação livre entre questões + marca pra revisar
 *  - dialog "tempo encerrado" com 2 opções (continuar/encerrar)
 */
export function SimuladoRunner({
  simulado,
  onUpdate,
  onFinish,
}: {
  simulado: Simulado;
  questions: Question[];
  onUpdate: (next: Simulado) => void;
  onFinish: (final: Simulado) => void;
}) {
  return (
    <div className="card">
      <h2>Simulado em andamento</h2>
      <p className="muted">
        UI de prova ainda não implementada (sub-etapa 1.1.3).
      </p>
      <div className="row gap" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="primary"
          onClick={() => onFinish(finalizarSimulado(simulado, 'voluntario_no_tempo'))}
        >
          Finalizar (placeholder)
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => onUpdate(abandonarSimulado(simulado))}
        >
          Abandonar
        </button>
      </div>
    </div>
  );
}
