'use client';

import { useMemo } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';

/**
 * Treemap simples (squarified) das disciplinas mais estudadas. Cada
 * retângulo = disciplina, área proporcional ao tempo total estudado.
 * Cor = % acerto.
 *
 * Implementação determinística sem dep externa: agrupa por linha
 * horizontal (não treemap "verdadeiro" mas leitura visual ok).
 */
type Cell = {
  disc: string;
  timeMs: number;
  acerto: number;
  attempts: number;
};

export function DisciplinaTreemapCard() {
  const all = useStore(selectActiveQuestions);

  const cells = useMemo<Cell[]>(() => {
    const m = new Map<string, Cell>();
    for (const q of all) {
      const d = q.disciplina_id;
      if (!d) continue;
      const c = m.get(d) ?? { disc: d, timeMs: 0, acerto: 0, attempts: 0 };
      c.attempts += q.stats?.attempts ?? 0;
      c.acerto += q.stats?.correct ?? 0;
      for (const h of q.stats?.history ?? []) {
        if (typeof h.timeMs === 'number' && h.timeMs > 0 && h.timeMs < 5 * 60_000) {
          c.timeMs += h.timeMs;
        }
      }
      m.set(d, c);
    }
    return Array.from(m.values())
      .filter((c) => c.timeMs > 60_000)
      .sort((a, b) => b.timeMs - a.timeMs)
      .slice(0, 12);
  }, [all]);

  if (cells.length === 0) return null;

  const total = cells.reduce((a, c) => a + c.timeMs, 0);

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>
        🗺 Mapa do tempo por disciplina
      </h2>
      <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
        Tamanho = tempo investido. Cor = % acerto (verde alto, vermelho baixo).
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          minHeight: 180,
        }}
      >
        {cells.map((c) => {
          const pctTime = c.timeMs / total;
          const pctCorrect =
            c.attempts > 0 ? Math.round((c.acerto / c.attempts) * 100) : 0;
          const cor =
            pctCorrect >= 70
              ? 'var(--primary, #22c55e)'
              : pctCorrect >= 50
                ? 'var(--warn, #d97706)'
                : 'var(--danger, #dc2626)';
          // Largura mínima 80px, máxima 100% — proporcional ao tempo
          const width = `calc(${Math.max(8, pctTime * 100)}% - 4px)`;
          const heightPx = Math.max(60, Math.min(120, 200 * pctTime));
          return (
            <div
              key={c.disc}
              title={`${c.disc}: ${Math.round(c.timeMs / 60000)}min, ${pctCorrect}% acerto`}
              style={{
                width,
                minWidth: 80,
                height: heightPx,
                background: cor,
                borderRadius: 4,
                padding: 6,
                color: '#fff',
                fontSize: '0.78rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.disc}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 400, marginTop: 2 }}>
                {Math.round(c.timeMs / 60000)}min · {pctCorrect}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
