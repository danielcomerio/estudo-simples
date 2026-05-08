'use client';

import { useMemo, useState } from 'react';
import { selectActiveQuestions, useStore, selectDisciplinas } from '@/lib/store';
import { rankAllDisciplinas } from '@/lib/disciplina-mastery';
import { readSessions } from '@/lib/sessions-log';
import { computeDailyStreak } from '@/lib/daily-streak';
import { Modal } from './Modal';

/**
 * Modal "🏆 Conquistas" — agrega achievements do user em uma tela.
 * Útil pra motivação e pra share futuro.
 */
export function ConquistasButton() {
  const [open, setOpen] = useState(false);
  const all = useStore(selectActiveQuestions);
  const disc = useStore(selectDisciplinas);

  const stats = useMemo(() => {
    const totalQuestoes = all.length;
    const totalRespondidas = all.filter((q) => (q.stats?.attempts ?? 0) > 0).length;
    const totalAcertos = all.reduce((a, q) => a + (q.stats?.correct ?? 0), 0);
    const totalTentativas = all.reduce((a, q) => a + (q.stats?.attempts ?? 0), 0);
    const pctMedio = totalTentativas > 0 ? Math.round((totalAcertos / totalTentativas) * 100) : 0;
    const masteries = rankAllDisciplinas(disc, all);
    const dominadas = masteries.filter((m) => m.score >= 80).length;
    const sessoes = readSessions();
    const sessoesEstudo = sessoes.filter((s) => s.kind === 'estudar').length;
    const sessoesSimulado = sessoes.filter((s) => s.kind === 'simulado').length;

    // Streak
    const dates = new Set<string>();
    for (const q of all) {
      for (const h of q.stats?.history ?? []) {
        dates.add(new Date(h.date).toISOString().slice(0, 10));
      }
    }
    const { currentStreak, bestStreak } = computeDailyStreak(Array.from(dates));

    return {
      totalQuestoes,
      totalRespondidas,
      totalTentativas,
      pctMedio,
      dominadas,
      masteryTopo: masteries.slice(0, 3),
      sessoesEstudo,
      sessoesSimulado,
      currentStreak,
      bestStreak,
    };
  }, [all, disc]);

  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen(true)}
        title="Veja suas conquistas no app"
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
      >
        🏆 Conquistas
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Conquistas" maxWidth="640px">
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>🏆 Suas conquistas</h3>

            <div className="grid-cards" style={{ marginBottom: 14 }}>
              <Stat label="Questões no banco" value={stats.totalQuestoes} />
              <Stat label="Respondidas" value={stats.totalRespondidas} />
              <Stat label="Total de tentativas" value={stats.totalTentativas} />
              <Stat label="% acerto médio" value={`${stats.pctMedio}%`} />
              <Stat label="Disciplinas dominadas" value={stats.dominadas} />
              <Stat label="Sessões /estudar" value={stats.sessoesEstudo} />
              <Stat label="Simulados feitos" value={stats.sessoesSimulado} />
              <Stat label="Streak atual" value={`${stats.currentStreak}d`} />
              <Stat label="Melhor streak" value={`${stats.bestStreak}d`} />
            </div>

            {stats.masteryTopo.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>
                  🌟 Top 3 disciplinas
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.92rem' }}>
                  {stats.masteryTopo.map((m) => (
                    <li
                      key={m.disciplina}
                      style={{
                        padding: '6px 8px',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {m.badge} <strong>{m.disciplina}</strong> — {m.score}/100
                      <span className="muted" style={{ marginLeft: 6, fontSize: '0.82rem' }}>
                        ({m.acerto}% acerto)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card stat" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 600 }}>{value}</div>
      <div className="muted" style={{ fontSize: '0.78rem' }}>
        {label}
      </div>
    </div>
  );
}
