'use client';

import { useMemo, useState } from 'react';
import { calcularResultado, isFinishedAfterTimeUp } from '@/lib/simulado';
import { renderRichText } from '@/lib/utils';
import { updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { useAlgorithm } from '@/lib/settings';
import { applyReview } from '@/lib/srs-fsrs';
import type {
  ObjetivaPayload,
  Question,
  Simulado,
  SimuladoQuestionResult,
  SimuladoStatus,
} from '@/lib/types';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

const STATUS_LABEL: Record<SimuladoStatus, string> = {
  em_andamento: 'Em andamento',
  finalizado_no_tempo: 'Finalizado dentro do tempo',
  finalizado_completo: 'Finalizado (todas respondidas)',
  finalizado_timeup_stopped: 'Tempo acabou — encerrado',
  finalizado_extra: 'Finalizado com tempo extra',
  abandonado: 'Abandonado',
};

export function SimuladoReport({
  simulado,
  questions,
  onBack,
}: {
  simulado: Simulado;
  questions: Question[];
  onBack: () => void;
}) {
  const algorithm = useAlgorithm();
  const lookup = useMemo(
    () => new Map(questions.map((q) => [q.id, q] as const)),
    [questions]
  );
  const r = useMemo(
    () => calcularResultado(simulado, lookup),
    [simulado, lookup]
  );
  const [srsAplicado, setSrsAplicado] = useState(false);

  const teveTempoExtra =
    r.respondidas_extra > 0 || isFinishedAfterTimeUp(simulado);

  // Aplica SRS em batch: corretas → quality 4 (Good), erradas → quality 0
  // (Again). Não respondidas: não toca. Não respondidas em tempo extra:
  // tratadas como não respondidas. Atualiza stats.history também.
  const aplicarSRS = async () => {
    if (srsAplicado) return;
    const ok = await confirmDialog({
      title: 'Aplicar à revisão espaçada',
      message: `Atualizar o agendamento SRS de ${
        r.respondidas_no_tempo + r.respondidas_extra
      } questão(ões) respondida(s) baseado no resultado deste simulado? Não respondidas ficam intactas.`,
      danger: false,
    });
    if (!ok) return;

    let aplicadas = 0;
    for (const res of simulado.resultados) {
      if (res.letra_marcada === null) continue;
      const q = lookup.get(res.question_id);
      if (!q) continue;
      const quality = res.correto ? 4 : 0;
      const card: { srs: typeof q.srs } = { srs: { ...q.srs } };
      applyReview(card, quality, algorithm);
      const novoHistory = [
        ...(q.stats?.history ?? []).slice(-49),
        {
          date: Date.now(),
          result: (res.correto ? 'correct' : 'wrong') as 'correct' | 'wrong',
          answer: res.letra_marcada,
          timeMs: res.ms_para_responder ?? undefined,
          quality,
          notes: `simulado:${simulado.id.slice(0, 8)}`,
        },
      ];
      updateQuestionLocal(q.id, {
        srs: card.srs,
        stats: {
          attempts: (q.stats?.attempts ?? 0) + 1,
          correct: (q.stats?.correct ?? 0) + (res.correto ? 1 : 0),
          wrong: (q.stats?.wrong ?? 0) + (res.correto ? 0 : 1),
          history: novoHistory,
        },
      });
      aplicadas++;
    }
    scheduleSync(800);
    setSrsAplicado(true);
    toast(`SRS atualizado em ${aplicadas} questão(ões)`, 'success');
  };

  return (
    <>
      {/* Header + status */}
      <div className="card">
        <div className="row between gap wrap">
          <div>
            <h2 style={{ margin: 0 }}>
              Relatório do simulado
            </h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Iniciado em{' '}
              {new Date(simulado.started_at).toLocaleString('pt-BR')} ·{' '}
              {STATUS_LABEL[simulado.status]}
            </p>
          </div>
          <button type="button" onClick={onBack}>
            ← Voltar
          </button>
        </div>
      </div>

      {/* Resumo de pontuação */}
      <div className="card">
        <h3 style={{ margin: '0 0 12px' }}>Resumo</h3>

        <div
          className="grid-cards"
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <ScoreCard
            label="Pontuação no tempo"
            value={`${(r.pct_no_tempo * 100).toFixed(1)}%`}
            sub={`${r.acertos_no_tempo} / ${r.total} certas`}
            highlight
          />
          {teveTempoExtra && (
            <ScoreCard
              label="Pontuação geral"
              value={`${(r.pct_geral * 100).toFixed(1)}%`}
              sub={`incluindo +${r.acertos_extra} no tempo extra`}
            />
          )}
          <ScoreCard
            label="Respondidas no tempo"
            value={String(r.respondidas_no_tempo)}
            sub={`de ${r.total} questões`}
          />
          {teveTempoExtra && (
            <ScoreCard
              label="Em tempo extra"
              value={String(r.respondidas_extra)}
              sub={`${r.acertos_extra} certas`}
            />
          )}
          <ScoreCard
            label="Não concluídas"
            value={String(r.nao_respondidas)}
            sub={r.nao_respondidas > 0 ? 'em branco' : 'todas respondidas'}
          />
          <ScoreCard
            label="Tempo total"
            value={fmtDuration(r.tempo_total_ms)}
            sub={
              r.tempo_no_limite_ms !== r.tempo_total_ms
                ? `dentro do prazo: ${fmtDuration(r.tempo_no_limite_ms)}`
                : 'dentro do prazo'
            }
          />
          {r.tempo_medio_por_resposta_ms > 0 && (
            <ScoreCard
              label="Tempo médio/questão"
              value={fmtSeconds(r.tempo_medio_por_resposta_ms / 1000)}
            />
          )}
        </div>

        {!srsAplicado && (
          <div className="row gap" style={{ marginTop: 4 }}>
            <button type="button" className="primary" onClick={aplicarSRS}>
              Aplicar resultado à revisão espaçada (SRS)
            </button>
            <span
              className="muted"
              style={{ alignSelf: 'center', fontSize: '0.82rem' }}
            >
              Acertos viram &ldquo;Bom&rdquo;, erros viram &ldquo;De
              novo&rdquo;. Não respondidas ficam intactas.
            </span>
          </div>
        )}
        {srsAplicado && (
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            ✓ SRS aplicado a este simulado.
          </p>
        )}
      </div>

      {/* Relatório por disciplina */}
      <div className="card">
        <h3 style={{ margin: '0 0 10px' }}>Por disciplina</h3>
        {r.por_disciplina.length === 0 ? (
          <p className="muted">Sem dados.</p>
        ) : (
          <table
            className="stats-table"
            style={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Disciplina</th>
                <th>Total</th>
                <th>✓ no tempo</th>
                <th>✗ no tempo</th>
                {teveTempoExtra && <th>✓ extra</th>}
                {teveTempoExtra && <th>✗ extra</th>}
                <th>Em branco</th>
                <th>% no tempo</th>
              </tr>
            </thead>
            <tbody>
              {r.por_disciplina.map((d) => {
                const pct =
                  d.total > 0 ? (d.certas_no_tempo / d.total) * 100 : 0;
                return (
                  <tr key={d.disciplina}>
                    <td style={{ textAlign: 'left' }}>{d.disciplina}</td>
                    <td>{d.total}</td>
                    <td>{d.certas_no_tempo}</td>
                    <td>{d.erradas_no_tempo}</td>
                    {teveTempoExtra && <td>{d.certas_extra}</td>}
                    {teveTempoExtra && <td>{d.erradas_extra}</td>}
                    <td>{d.nao_respondidas}</td>
                    <td>
                      <strong>{pct.toFixed(0)}%</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Erradas — relatório completo */}
      <details className="card" open={r.questoes_erradas.length <= 5}>
        <summary
          style={{
            cursor: 'pointer',
            padding: 8,
            margin: -8,
            fontWeight: 600,
            fontSize: '1.05rem',
          }}
        >
          Questões erradas{' '}
          <span className="muted">({r.questoes_erradas.length})</span>
        </summary>
        <div style={{ marginTop: 14 }}>
          {r.questoes_erradas.length === 0 ? (
            <p className="muted">Nenhuma errada. 🎯</p>
          ) : (
            r.questoes_erradas.map((res) => (
              <ErradaCard
                key={res.question_id}
                resultado={res}
                question={lookup.get(res.question_id) ?? null}
              />
            ))
          )}
        </div>
      </details>

      {/* Não respondidas */}
      {r.questoes_nao_respondidas.length > 0 && (
        <details className="card">
          <summary
            style={{
              cursor: 'pointer',
              padding: 8,
              margin: -8,
              fontWeight: 600,
              fontSize: '1.05rem',
            }}
          >
            Não concluídas{' '}
            <span className="muted">
              ({r.questoes_nao_respondidas.length})
            </span>
          </summary>
          <div style={{ marginTop: 14 }}>
            {r.questoes_nao_respondidas.map((res) => (
              <NaoRespondidaItem
                key={res.question_id}
                question={lookup.get(res.question_id) ?? null}
              />
            ))}
          </div>
        </details>
      )}

      {/* Marcadas pra revisar (independente de certas/erradas) */}
      {r.questoes_marcadas.length > 0 && (
        <details className="card">
          <summary
            style={{
              cursor: 'pointer',
              padding: 8,
              margin: -8,
              fontWeight: 600,
              fontSize: '1.05rem',
            }}
          >
            Marcadas para revisar{' '}
            <span className="muted">({r.questoes_marcadas.length})</span>
          </summary>
          <div style={{ marginTop: 14 }}>
            {r.questoes_marcadas.map((res) => {
              const q = lookup.get(res.question_id);
              if (!q) return null;
              const p = q.payload as ObjetivaPayload;
              return (
                <div
                  key={res.question_id}
                  style={{
                    background: 'var(--bg-elev-2)',
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--warning)',
                    borderRadius: 'var(--radius)',
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {q.disciplina_id ?? '(sem disciplina)'} · marcada
                    {res.letra_marcada !== null
                      ? ` · marcou ${res.letra_marcada}${res.correto ? ' ✓' : ' ✗'}`
                      : ' · não respondida'}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {(p.enunciado ?? '').slice(0, 200)}
                    {(p.enunciado ?? '').length > 200 ? '…' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </>
  );
}

function ScoreCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? 'var(--primary-soft)' : 'var(--bg-elev-2)',
        border: highlight
          ? '1px solid var(--primary)'
          : '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 12,
      }}
    >
      <div
        className="muted"
        style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '1.6rem',
          fontWeight: 600,
          marginTop: 2,
          color: highlight ? 'var(--primary)' : 'var(--text)',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="muted"
          style={{ fontSize: '0.8rem', marginTop: 2 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function ErradaCard({
  resultado,
  question,
}: {
  resultado: SimuladoQuestionResult;
  question: Question | null;
}) {
  if (!question) {
    return (
      <div
        style={{
          background: 'var(--bg-elev-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 12,
          marginBottom: 10,
        }}
      >
        <p className="muted">Questão não está mais disponível no banco.</p>
      </div>
    );
  }
  const p = question.payload as ObjetivaPayload;
  const gabarito = p.gabarito ??
    p.alternativas?.find((a) => a.correta)?.letra ??
    null;
  return (
    <div
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--danger)',
        borderRadius: 'var(--radius)',
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div className="muted" style={{ fontSize: '0.82rem', marginBottom: 6 }}>
        {question.disciplina_id ?? '(sem disciplina)'}
        {question.banca_estilo && ` · ${question.banca_estilo}`}
        {resultado.respondido_apos_tempo && (
          <span
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              background: 'var(--primary-soft)',
              borderRadius: 12,
              fontSize: '0.72rem',
            }}
          >
            tempo extra
          </span>
        )}
      </div>
      <div
        style={{ marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
        dangerouslySetInnerHTML={{
          __html: renderRichText(p.enunciado),
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
          marginBottom: 10,
        }}
      >
        {p.alternativas?.map((a) => {
          const isCorreta =
            gabarito && a.letra.toUpperCase() === gabarito.toUpperCase();
          const isMarcada =
            resultado.letra_marcada &&
            a.letra.toUpperCase() === resultado.letra_marcada.toUpperCase();
          let bg = 'var(--bg-elev)';
          let color = 'var(--text)';
          if (isCorreta) {
            bg = 'var(--correct-bg)';
            color = 'var(--success)';
          } else if (isMarcada) {
            bg = 'var(--wrong-bg)';
            color = 'var(--danger)';
          }
          return (
            <div
              key={a.letra}
              style={{
                background: bg,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '0.88rem',
              }}
            >
              <strong style={{ color }}>{a.letra}</strong>
              {isMarcada && !isCorreta && (
                <span
                  style={{ marginLeft: 6, fontSize: '0.78rem' }}
                  className="muted"
                >
                  (sua resposta)
                </span>
              )}
              {isCorreta && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: '0.78rem',
                    color: 'var(--success)',
                  }}
                >
                  (gabarito)
                </span>
              )}
              <div style={{ marginTop: 4 }}>{a.texto}</div>
            </div>
          );
        })}
      </div>
      {p.explicacao_geral && (
        <div
          style={{
            background: 'var(--bg-elev)',
            borderLeft: '3px solid var(--primary)',
            paddingLeft: 12,
            paddingTop: 8,
            paddingBottom: 8,
            marginTop: 4,
          }}
        >
          <strong>Explicação:</strong>
          <div
            style={{ marginTop: 4 }}
            dangerouslySetInnerHTML={{
              __html: renderRichText(p.explicacao_geral),
            }}
          />
        </div>
      )}
      {p.notes_user && (
        <div
          style={{
            background: 'var(--primary-soft)',
            borderLeft: '3px solid var(--primary)',
            paddingLeft: 12,
            paddingTop: 8,
            paddingBottom: 8,
            marginTop: 8,
          }}
        >
          <strong>Suas anotações:</strong>
          <div
            style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{
              __html: renderRichText(p.notes_user),
            }}
          />
        </div>
      )}
    </div>
  );
}

function NaoRespondidaItem({ question }: { question: Question | null }) {
  if (!question) return null;
  const p = question.payload as ObjetivaPayload;
  return (
    <div
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--muted)',
        borderRadius: 'var(--radius)',
        padding: 10,
        marginBottom: 8,
      }}
    >
      <div className="muted" style={{ fontSize: '0.8rem' }}>
        {question.disciplina_id ?? '(sem disciplina)'}
      </div>
      <div style={{ marginTop: 4 }}>
        {(p.enunciado ?? '').slice(0, 200)}
        {(p.enunciado ?? '').length > 200 ? '…' : ''}
      </div>
    </div>
  );
}

function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}min ${sec.toFixed(0)}s`;
}
