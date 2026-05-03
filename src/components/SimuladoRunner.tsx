'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  abandonarSimulado,
  finalizarSimulado,
  marcarTempoExpirado,
  recordAnswer,
  todasRespondidas,
  toggleRevisar,
} from '@/lib/simulado';
import { confirmDialog } from './ConfirmDialog';
import { renderRichText, shuffle } from '@/lib/utils';
import type {
  Alternativa,
  ObjetivaPayload,
  Question,
  Simulado,
} from '@/lib/types';

export function SimuladoRunner({
  simulado,
  questions,
  onUpdate,
  onFinish,
}: {
  simulado: Simulado;
  questions: Question[];
  onUpdate: (next: Simulado) => void;
  onFinish: (final: Simulado) => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);
  const [now, setNow] = useState(Date.now());
  const questionStartRef = useRef(Date.now());

  // Lookup questão por id (filtra deletadas/inexistentes)
  const lookup = useMemo(
    () => new Map(questions.map((q) => [q.id, q] as const)),
    [questions]
  );

  // Lista alinhada com question_ids (alguns podem não existir mais — soft-deleted)
  const questoes = useMemo(
    () =>
      simulado.question_ids.map((id) => lookup.get(id) ?? null),
    [simulado.question_ids, lookup]
  );

  const currentQuestion = questoes[currentIdx];
  const currentResultado = simulado.resultados[currentIdx];

  // Embaralha alternativas só se config pediu, e estável por questão
  const alternativas = useMemo<Alternativa[]>(() => {
    if (!currentQuestion) return [];
    const p = currentQuestion.payload as ObjetivaPayload;
    const alts = p.alternativas ?? [];
    return simulado.config.embaralhar_alternativas ? shuffle(alts) : alts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, simulado.config.embaralhar_alternativas]);

  // Reseta cronômetro de questão ao trocar
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [currentIdx]);

  // ===== Cronômetro do simulado =====
  const tempoLimiteMs = simulado.config.tempo_limite_min * 60 * 1000;
  const isCronometrado = tempoLimiteMs > 0;
  const tempoExpirou = simulado.tempo_expirou_at !== null;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, []);

  // Detecta expiração e abre dialog uma vez
  useEffect(() => {
    if (!isCronometrado) return;
    if (tempoExpirou) return;
    const tempoCorrido = now - simulado.started_at;
    if (tempoCorrido >= tempoLimiteMs) {
      const next = marcarTempoExpirado(simulado, simulado.started_at + tempoLimiteMs);
      onUpdate(next);
      setShowTimeUpDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, isCronometrado, tempoExpirou, simulado.started_at, tempoLimiteMs]);

  // Tempo restante (negativo se em modo extra)
  const tempoCorridoTotal = now - simulado.started_at;
  const tempoRestanteMs = isCronometrado
    ? tempoLimiteMs - tempoCorridoTotal
    : -tempoCorridoTotal; // counter UP se sem limite
  const emTempoExtra = isCronometrado && tempoExpirou;

  // ===== Ações =====
  const responder = (letra: string) => {
    if (!currentQuestion) return;
    const ms = Date.now() - questionStartRef.current;
    const next = recordAnswer(
      simulado,
      currentQuestion.id,
      letra,
      currentQuestion,
      ms,
      emTempoExtra
    );
    onUpdate(next);
  };

  const limparResposta = () => {
    if (!currentQuestion) return;
    const next = recordAnswer(
      simulado,
      currentQuestion.id,
      null,
      currentQuestion,
      null,
      emTempoExtra
    );
    onUpdate(next);
  };

  const marcarRevisar = () => {
    if (!currentQuestion) return;
    onUpdate(toggleRevisar(simulado, currentQuestion.id));
  };

  const proxima = () => {
    if (currentIdx < questoes.length - 1) setCurrentIdx(currentIdx + 1);
  };
  const anterior = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };
  const irPara = (i: number) => {
    if (i >= 0 && i < questoes.length) setCurrentIdx(i);
  };

  const finalizar = async () => {
    const naoRespondidas = simulado.resultados.filter(
      (r) => r.letra_marcada === null
    ).length;
    const aviso =
      naoRespondidas > 0
        ? ` ${naoRespondidas} questão(ões) sem resposta serão marcadas como não concluídas.`
        : '';
    const ok = await confirmDialog({
      title: 'Finalizar simulado',
      message: `Encerrar e ver o relatório?${aviso}`,
      danger: false,
    });
    if (!ok) return;
    const motivo = emTempoExtra
      ? 'timeup_extra_finalizado'
      : todasRespondidas(simulado)
        ? 'completo'
        : 'voluntario_no_tempo';
    onFinish(finalizarSimulado(simulado, motivo));
  };

  const abandonar = async () => {
    const ok = await confirmDialog({
      title: 'Abandonar simulado',
      message:
        'Suas respostas ficam salvas mas o simulado é marcado como abandonado. Não gera relatório completo. Continuar?',
      danger: true,
    });
    if (!ok) return;
    onUpdate(abandonarSimulado(simulado));
  };

  // ===== Dialog de tempo expirou =====
  const handleEncerrarPorTempo = () => {
    setShowTimeUpDialog(false);
    onFinish(finalizarSimulado(simulado, 'timeup_stopped'));
  };
  const handleContinuarPorTempo = () => {
    setShowTimeUpDialog(false);
    // simulado já tem tempo_expirou_at marcado; novas respostas vão como
    // respondido_apos_tempo=true (controlado por emTempoExtra)
  };

  // ===== Atalhos de teclado =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showTimeUpDialog) return; // dialog modal absorve
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // A-Z pra alternativas
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        const letra = e.key.toUpperCase();
        const found = alternativas.find((a) => a.letra.toUpperCase() === letra);
        if (found) {
          e.preventDefault();
          responder(found.letra);
          return;
        }
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        proxima();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        anterior();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        marcarRevisar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alternativas, currentIdx, showTimeUpDialog, simulado.id]);

  if (!currentQuestion) {
    return (
      <div className="card">
        <p className="muted">
          Questão #{currentIdx + 1} não está mais disponível (foi excluída do
          banco?). Você pode pular pra próxima ou abandonar.
        </p>
        <div className="row gap" style={{ marginTop: 12 }}>
          <button type="button" onClick={proxima}>
            Próxima
          </button>
          <button type="button" className="danger" onClick={abandonar}>
            Abandonar
          </button>
        </div>
      </div>
    );
  }

  const payload = currentQuestion.payload as ObjetivaPayload;

  return (
    <>
      {/* Cronômetro + barra de progresso + botões de gestão */}
      <div className="card">
        <div className="row between gap wrap" style={{ marginBottom: 8 }}>
          <Cronometro
            tempoRestanteMs={tempoRestanteMs}
            isCronometrado={isCronometrado}
            emTempoExtra={emTempoExtra}
          />
          <div className="row gap">
            <button type="button" onClick={abandonar} className="ghost">
              Abandonar
            </button>
            <button type="button" onClick={finalizar} className="primary">
              Finalizar
            </button>
          </div>
        </div>
        <ProgressoBar
          atual={currentIdx + 1}
          total={questoes.length}
          respondidas={
            simulado.resultados.filter((r) => r.letra_marcada !== null).length
          }
          marcadas={
            simulado.resultados.filter((r) => r.marcado_revisar).length
          }
        />
      </div>

      {/* Grid de questões pra navegação rápida */}
      <div className="card">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))',
            gap: 4,
          }}
        >
          {simulado.resultados.map((r, i) => {
            const ativa = i === currentIdx;
            const respondida = r.letra_marcada !== null;
            const marcada = r.marcado_revisar;
            const extra = r.respondido_apos_tempo;
            let bg = 'var(--bg-elev-2)';
            let borderColor = 'var(--border)';
            if (ativa) borderColor = 'var(--primary)';
            if (respondida) bg = extra ? 'var(--primary-soft)' : 'var(--success-soft)';
            return (
              <button
                key={r.question_id}
                type="button"
                onClick={() => irPara(i)}
                title={
                  `Questão ${i + 1}` +
                  (respondida
                    ? ` (respondida${extra ? ', tempo extra' : ''})`
                    : '') +
                  (marcada ? ', marcada' : '')
                }
                style={{
                  padding: '6px 0',
                  background: bg,
                  borderColor,
                  borderWidth: ativa ? 2 : 1,
                  position: 'relative',
                  fontWeight: ativa ? 600 : 400,
                  fontSize: '0.85rem',
                }}
              >
                {i + 1}
                {marcada && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 2,
                      fontSize: '0.6rem',
                      color: 'var(--warning)',
                    }}
                  >
                    ●
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Questão */}
      <div className="card">
        <div className="row between gap" style={{ marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Questão {currentIdx + 1} de {questoes.length}
            {currentQuestion.disciplina_id && ` · ${currentQuestion.disciplina_id}`}
            {currentQuestion.banca_estilo && ` · ${currentQuestion.banca_estilo}`}
          </span>
          <button
            type="button"
            onClick={marcarRevisar}
            className={currentResultado.marcado_revisar ? 'primary' : 'ghost'}
            title="Marcar pra revisar (M)"
          >
            {currentResultado.marcado_revisar ? '★ Marcada' : '☆ Marcar'}
          </button>
        </div>

        <div
          style={{
            marginBottom: 14,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
          }}
          dangerouslySetInnerHTML={{
            __html: renderRichText(payload.enunciado),
          }}
        />

        <div
          className="alternativas"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {alternativas.map((a) => {
            const selected =
              currentResultado.letra_marcada?.toUpperCase() === a.letra.toUpperCase();
            return (
              <button
                key={a.letra}
                type="button"
                className="alt"
                onClick={() => responder(a.letra)}
                style={{
                  textAlign: 'left',
                  background: selected
                    ? 'var(--primary-soft)'
                    : 'var(--bg-elev-2)',
                  borderColor: selected ? 'var(--primary)' : 'var(--border)',
                  borderWidth: selected ? 2 : 1,
                  padding: '12px 14px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <strong style={{ marginRight: 8 }}>{a.letra}</strong>
                <span
                  dangerouslySetInnerHTML={{
                    __html: renderRichText(a.texto),
                  }}
                />
              </button>
            );
          })}
        </div>

        {currentResultado.letra_marcada !== null && (
          <button
            type="button"
            className="ghost"
            onClick={limparResposta}
            style={{ marginTop: 10, fontSize: '0.85rem' }}
          >
            Limpar resposta desta questão
          </button>
        )}
      </div>

      {/* Navegação */}
      <div className="card">
        <div className="row between gap">
          <button type="button" onClick={anterior} disabled={currentIdx === 0}>
            ← Anterior
          </button>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            ←/→ navegar · A-E responder · M marcar
          </span>
          <button
            type="button"
            onClick={proxima}
            disabled={currentIdx >= questoes.length - 1}
            className="primary"
          >
            Próxima →
          </button>
        </div>
      </div>

      {/* Dialog tempo encerrado */}
      {showTimeUpDialog && (
        <TimeUpDialog
          onContinuar={handleContinuarPorTempo}
          onEncerrar={handleEncerrarPorTempo}
        />
      )}
    </>
  );
}

function Cronometro({
  tempoRestanteMs,
  isCronometrado,
  emTempoExtra,
}: {
  tempoRestanteMs: number;
  isCronometrado: boolean;
  emTempoExtra: boolean;
}) {
  // Formatação MM:SS ou HH:MM:SS
  const absMs = Math.abs(tempoRestanteMs);
  const totalSec = Math.floor(absMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatado = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  let color = 'var(--text)';
  let label = '';
  if (!isCronometrado) {
    label = 'Tempo decorrido';
    color = 'var(--muted)';
  } else if (emTempoExtra) {
    label = 'Tempo extra';
    color = 'var(--primary)';
  } else if (tempoRestanteMs <= 60_000) {
    color = 'var(--danger)';
    label = 'Faltam';
  } else if (tempoRestanteMs <= 5 * 60_000) {
    color = 'var(--warning)';
    label = 'Faltam';
  } else {
    label = 'Faltam';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="muted" style={{ fontSize: '0.78rem' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '1.6rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color,
          letterSpacing: 1,
        }}
        aria-live="polite"
      >
        {emTempoExtra ? '+' : ''}
        {formatado}
      </span>
    </div>
  );
}

function ProgressoBar({
  atual,
  total,
  respondidas,
  marcadas,
}: {
  atual: number;
  total: number;
  respondidas: number;
  marcadas: number;
}) {
  const pct = Math.round((respondidas / total) * 100);
  return (
    <div>
      <div
        style={{
          background: 'var(--bg-elev-2)',
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--primary)',
            transition: 'width 200ms',
          }}
        />
      </div>
      <div
        className="muted"
        style={{
          marginTop: 4,
          fontSize: '0.82rem',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          Questão {atual} de {total}
        </span>
        <span>
          {respondidas} respondidas
          {marcadas > 0 && ` · ${marcadas} marcadas`}
        </span>
      </div>
    </div>
  );
}

function TimeUpDialog({
  onContinuar,
  onEncerrar,
}: {
  onContinuar: () => void;
  onEncerrar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timeup-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 520,
          width: '100%',
          background: 'var(--bg-elev)',
          margin: 0,
        }}
      >
        <h2 id="timeup-title" style={{ margin: '0 0 8px' }}>
          ⏰ Tempo encerrado
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Você pode encerrar agora e ver o relatório, ou continuar
          respondendo. As respostas dadas após este ponto serão
          contabilizadas como <strong>tempo extra</strong> em uma seção
          separada do relatório.
        </p>
        <div
          className="row gap"
          style={{ marginTop: 14, justifyContent: 'flex-end' }}
        >
          <button type="button" onClick={onContinuar}>
            Continuar (tempo extra)
          </button>
          <button type="button" className="primary" onClick={onEncerrar}>
            Encerrar agora
          </button>
        </div>
      </div>
    </div>
  );
}
