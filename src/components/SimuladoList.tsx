'use client';

import { deleteSimulado } from '@/lib/simulado-store';
import type { Simulado, SimuladoStatus } from '@/lib/types';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

const STATUS_LABEL: Record<SimuladoStatus, string> = {
  em_andamento: 'Em andamento',
  finalizado_no_tempo: 'Concluído (dentro do tempo)',
  finalizado_completo: 'Concluído (todas respondidas)',
  finalizado_timeup_stopped: 'Encerrado quando tempo acabou',
  finalizado_extra: 'Concluído (com tempo extra)',
  abandonado: 'Abandonado',
};

const STATUS_COLOR: Record<SimuladoStatus, string> = {
  em_andamento: 'var(--warning)',
  finalizado_no_tempo: 'var(--success)',
  finalizado_completo: 'var(--success)',
  finalizado_timeup_stopped: 'var(--muted)',
  finalizado_extra: 'var(--primary)',
  abandonado: 'var(--danger)',
};

export function SimuladoList({
  simulados,
  onNovo,
  onView,
  onResume,
}: {
  simulados: Simulado[];
  onNovo: () => void;
  onView: (sim: Simulado) => void;
  onResume: (sim: Simulado) => void;
}) {
  const ativos = simulados.filter((s) => s.status === 'em_andamento');
  const finalizados = simulados.filter((s) => s.status !== 'em_andamento');

  const handleDelete = async (sim: Simulado) => {
    const ok = await confirmDialog({
      title: 'Excluir simulado',
      message: `Excluir simulado de ${new Date(sim.started_at).toLocaleString('pt-BR')}? Histórico não pode ser recuperado.`,
      danger: true,
    });
    if (!ok) return;
    deleteSimulado(sim.id);
    toast('Simulado excluído', 'success');
  };

  return (
    <>
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Simulados</h2>
          <button
            type="button"
            className="primary"
            onClick={onNovo}
            disabled={ativos.length > 0}
            title={
              ativos.length > 0
                ? 'Termine o simulado em andamento antes de criar outro'
                : 'Iniciar novo simulado'
            }
          >
            + Novo simulado
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Modo de prova: cronômetro, sem feedback durante. Ao final, gera
          relatório com performance por disciplina e lista das erradas pra
          revisar.
        </p>
      </div>

      {ativos.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 10px' }}>Em andamento</h3>
          {ativos.map((sim) => (
            <SimuladoRow
              key={sim.id}
              sim={sim}
              onClick={() => onResume(sim)}
              onDelete={() => handleDelete(sim)}
              ctaLabel="Continuar"
            />
          ))}
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: '0 0 10px' }}>
          Histórico {finalizados.length > 0 && `(${finalizados.length})`}
        </h3>
        {finalizados.length === 0 ? (
          <p className="empty">
            Nenhum simulado realizado ainda. Clique em &ldquo;+ Novo simulado&rdquo;
            pra começar.
          </p>
        ) : (
          finalizados.map((sim) => (
            <SimuladoRow
              key={sim.id}
              sim={sim}
              onClick={() => onView(sim)}
              onDelete={() => handleDelete(sim)}
              ctaLabel="Ver relatório"
            />
          ))
        )}
      </div>
    </>
  );
}

function SimuladoRow({
  sim,
  onClick,
  onDelete,
  ctaLabel,
}: {
  sim: Simulado;
  onClick: () => void;
  onDelete: () => void;
  ctaLabel: string;
}) {
  const nQuestoes = sim.question_ids.length;
  const respondidas = sim.resultados.filter((r) => r.letra_marcada !== null).length;
  const dataStr = new Date(sim.started_at).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
        marginBottom: 8,
      }}
    >
      <div className="row between gap wrap">
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ fontWeight: 600 }}>
            {sim.nome ?? `Simulado de ${dataStr}`}
          </div>
          <div className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
            {nQuestoes} questões · {respondidas} respondidas ·{' '}
            {sim.config.tempo_limite_min === 0
              ? 'sem limite'
              : `${sim.config.tempo_limite_min}min`}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: '0.82rem',
              color: STATUS_COLOR[sim.status],
            }}
          >
            ● {STATUS_LABEL[sim.status]}
          </div>
        </div>
        <div className="row gap">
          <button type="button" className="primary" onClick={onClick}>
            {ctaLabel}
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
