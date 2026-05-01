'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore, selectActiveQuestions } from '@/lib/store';
import {
  matchActiveConcurso,
  useActiveConcursoFilter,
} from '@/lib/hierarchy';
import {
  getSimuladoEmAndamento,
  saveSimulado,
  useSimuladosForUser,
} from '@/lib/simulado-store';
import {
  SimuladoValidationError,
  createSimulado,
  filterPoolForSimulado,
  pickQuestionsForSimulado,
} from '@/lib/simulado';
import type { Simulado, SimuladoConfig } from '@/lib/types';
import { SimuladoConfigForm } from './SimuladoConfigForm';
import { SimuladoList } from './SimuladoList';
import { SimuladoRunner } from './SimuladoRunner';
import { SimuladoReport } from './SimuladoReport';
import { toast } from './Toast';

type Phase = 'list' | 'config' | 'running' | 'report';

export function SimuladoView() {
  const userId = useStore((s) => s.userId);
  const allRaw = useStore(selectActiveQuestions);
  const { disciplinaNomes: concursoDiscNomes } = useActiveConcursoFilter();

  // Filtra antes do pool — config form só vê questões/disciplinas do concurso
  // ativo. Simulado em andamento NÃO é refiltrado (já foi montado).
  const all = useMemo(
    () =>
      concursoDiscNomes === null
        ? allRaw
        : allRaw.filter((q) =>
            matchActiveConcurso(q.disciplina_id, concursoDiscNomes)
          ),
    [allRaw, concursoDiscNomes]
  );

  // Render-time `all` é filtrado, mas o questions usado em running/report
  // precisa ser amplo (questões do simulado podem ter sido montadas antes
  // do concurso ser selecionado). Usa allRaw nessas fases.
  const allForLookup = allRaw;

  const simulados = useSimuladosForUser(userId);

  const [phase, setPhase] = useState<Phase>('list');
  const [activeSim, setActiveSim] = useState<Simulado | null>(null);

  // Detecta simulado em andamento ao entrar (refresh-safe)
  useEffect(() => {
    if (!userId) return;
    if (activeSim) return;
    const emAndamento = getSimuladoEmAndamento(userId);
    if (emAndamento) {
      setActiveSim(emAndamento);
      setPhase('running');
    }
  }, [userId, activeSim]);

  const objetivasCount = useMemo(
    () => all.filter((q) => q.type === 'objetiva').length,
    [all]
  );

  const startSimulado = (cfg: SimuladoConfig) => {
    if (!userId) {
      toast('Não autenticado', 'error');
      return;
    }
    try {
      const pool = filterPoolForSimulado(all, cfg);
      const picked = pickQuestionsForSimulado(pool, cfg);
      if (picked.length === 0) {
        toast(
          'Nenhuma questão objetiva atende aos filtros. Ajuste e tente de novo.',
          'warn'
        );
        return;
      }
      if (picked.length < cfg.qtd) {
        toast(
          `Apenas ${picked.length} questão(ões) atendem ao filtro (pediu ${cfg.qtd}). Vou usar ${picked.length}.`,
          'warn'
        );
      }
      const sim = createSimulado(picked, cfg, userId);
      saveSimulado(sim);
      setActiveSim(sim);
      setPhase('running');
    } catch (e: unknown) {
      const msg =
        e instanceof SimuladoValidationError
          ? `Validação: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Erro desconhecido';
      toast(msg, 'error');
    }
  };

  const updateSim = (next: Simulado) => {
    saveSimulado(next);
    setActiveSim(next);
    // Quando o user abandona, o status sai de 'em_andamento'. Sem essa
    // checagem o runner continua renderizando o simulado já finalizado
    // — bug detectado no teste do user (clicava "Abandonar" e nada
    // acontecia). Abandonado volta pra lista; finalizado_* vai pro
    // relatório (mas esse fluxo passa por onFinish, não por onUpdate).
    if (next.status === 'abandonado') {
      toast('Simulado abandonado.', 'warn');
      setActiveSim(null);
      setPhase('list');
    }
  };

  const onFinish = (final: Simulado) => {
    saveSimulado(final);
    setActiveSim(final);
    setPhase('report');
  };

  const viewReport = (sim: Simulado) => {
    setActiveSim(sim);
    setPhase('report');
  };

  const backToList = () => {
    setActiveSim(null);
    setPhase('list');
  };

  if (phase === 'config') {
    return (
      <SimuladoConfigForm
        objetivasDisponiveis={objetivasCount}
        onSubmit={startSimulado}
        onCancel={() => setPhase('list')}
      />
    );
  }

  if (phase === 'running' && activeSim) {
    return (
      <SimuladoRunner
        simulado={activeSim}
        questions={allForLookup}
        onUpdate={updateSim}
        onFinish={onFinish}
      />
    );
  }

  if (phase === 'report' && activeSim) {
    return (
      <SimuladoReport
        simulado={activeSim}
        questions={allForLookup}
        onBack={backToList}
      />
    );
  }

  return (
    <SimuladoList
      simulados={simulados}
      onNovo={() => setPhase('config')}
      onView={viewReport}
      onResume={(sim) => {
        setActiveSim(sim);
        setPhase('running');
      }}
    />
  );
}
