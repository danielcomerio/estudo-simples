'use client';

import { useEffect, useState } from 'react';
import { readSessions, type SessionLogEntry } from '@/lib/sessions-log';

/**
 * Linha do tempo de simulados — últimas 20 sessões kind='simulado'.
 * Mostra: data, % acerto, total. Sparkline visual.
 */
export function SimuladoTimeline() {
  const [sessions, setSessions] = useState<SessionLogEntry[]>([]);

  useEffect(() => {
    const all = readSessions();
    setSessions(all.filter((s) => s.kind === 'simulado').slice(0, 20));
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>
          🧪 Histórico de simulados
        </h2>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Nenhum simulado finalizado ainda. Vá em <a href="/simulado">/simulado</a>{' '}
          pra começar.
        </p>
      </div>
    );
  }

  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const max = Math.max(...ordered.map((s) => 1));

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>
        🧪 Histórico de simulados ({sessions.length})
      </h2>

      {/* Sparkline */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          alignItems: 'flex-end',
          height: 50,
          marginBottom: 12,
        }}
      >
        {ordered.map((s) => {
          const pct = s.total > 0 ? s.correct / s.total : 0;
          return (
            <div
              key={s.id}
              title={`${new Date(s.startedAt).toLocaleDateString('pt-BR')}: ${Math.round(pct * 100)}%`}
              style={{
                flex: 1,
                height: `${pct * 100}%`,
                background:
                  pct >= 0.7
                    ? 'var(--primary)'
                    : pct >= 0.5
                      ? 'var(--warn, #d97706)'
                      : 'var(--danger)',
                minWidth: 6,
                borderRadius: 2,
              }}
            />
          );
        })}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
        {sessions.slice(0, 10).map((s) => {
          const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          const min = Math.round(s.durationMs / 60000);
          return (
            <li
              key={s.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span className="muted" style={{ minWidth: 100 }}>
                {new Date(s.startedAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                })}
              </span>
              <span>
                <strong>{pct}%</strong>
              </span>
              <span className="muted">
                ({s.correct}/{s.total})
              </span>
              <span className="muted" style={{ marginLeft: 'auto' }}>
                {min}min
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
