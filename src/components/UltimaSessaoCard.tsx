'use client';

import { useEffect, useState } from 'react';
import { readSessions, type SessionLogEntry } from '@/lib/sessions-log';
import { fmtRelative } from '@/lib/format';

const KIND_LABEL: Record<SessionLogEntry['kind'], string> = {
  estudar: 'Estudar',
  discursivas: 'Discursivas',
  cards: 'Cards',
  simulado: 'Simulado',
};

/**
 * Card "Última sessão" — mostra resumo da sessão mais recente. Aparece
 * só se houver alguma. Cap em 30d (sessões muito antigas viram ruído).
 */
export function UltimaSessaoCard() {
  const [last, setLast] = useState<SessionLogEntry | null>(null);

  useEffect(() => {
    const all = readSessions();
    if (all.length === 0) {
      setLast(null);
      return;
    }
    const recent = [...all].sort((a, b) => b.endedAt - a.endedAt)[0];
    if (Date.now() - recent.endedAt > 30 * 86_400_000) {
      setLast(null);
      return;
    }
    setLast(recent);
  }, []);

  if (!last) return null;

  const total = last.correct + last.wrong;
  const pct = total > 0 ? Math.round((100 * last.correct) / total) : 0;
  const min = Math.round(last.durationMs / 60_000);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.4rem' }} aria-hidden>
          📊
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: '0.95rem' }}>
            Última sessão · {KIND_LABEL[last.kind]}
          </strong>
          <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
            {fmtRelative(last.endedAt)} · <strong>{pct}%</strong> ({last.correct}/{total}) · {min}min
          </div>
        </div>
      </div>
    </div>
  );
}
