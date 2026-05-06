'use client';

import { useState } from 'react';
import { updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import type { Question } from '@/lib/types';

const CAUSES = [
  { v: 'concept' as const, label: '🧠 Não sabia', tip: 'Gap de conhecimento — estudar o assunto.' },
  { v: 'careless' as const, label: '🤦 Atenção', tip: 'Sabia mas marquei errado.' },
  { v: 'interpret' as const, label: '📖 Leitura', tip: 'Interpretei mal o enunciado.' },
  { v: 'time' as const, label: '⏱ Tempo', tip: 'Pressão de tempo / timeout.' },
  { v: 'tricky' as const, label: '🎩 Pegadinha', tip: 'Pegadinha da banca / detalhe sutil.' },
] as const;

type Cause = (typeof CAUSES)[number]['v'];

/**
 * Picker que aparece após errar uma questão. Anota a causa do erro
 * na ÚLTIMA entry do history. Opcional — user pode ignorar.
 *
 * Stats agregam por causa em /stats pra mostrar padrão de erro do
 * usuário (ex: "70% dos seus erros são de leitura — leia mais
 * devagar").
 */
export function ErrorCausePicker({ q }: { q: Question }) {
  const [picked, setPicked] = useState<Cause | null>(() => {
    const last = (q.stats?.history ?? []).at(-1);
    return last?.errorCause ?? null;
  });

  const choose = (cause: Cause) => {
    setPicked(cause);
    updateQuestionLocal(q.id, (cur) => {
      const hist = cur.stats?.history ?? [];
      if (hist.length === 0) return {};
      const last = hist[hist.length - 1];
      const next = [...hist.slice(0, -1), { ...last, errorCause: cause }];
      return { stats: { ...cur.stats, history: next } };
    });
    scheduleSync(800);
  };

  return (
    <div
      className="feedback-block"
      style={{
        background: 'var(--bg-elev-2)',
        borderLeft: '3px solid var(--warn, #d97706)',
        paddingLeft: 12,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 6, fontSize: '0.92rem' }}>
        🤔 Por que errou? (opcional)
      </strong>
      <p
        className="muted"
        style={{ margin: '0 0 8px', fontSize: '0.78rem' }}
      >
        Ajuda o app a mostrar padrões e direcionar estudo.
      </p>
      <div className="row gap wrap" style={{ gap: 6 }}>
        {CAUSES.map((c) => {
          const isOn = picked === c.v;
          return (
            <button
              key={c.v}
              type="button"
              onClick={() => choose(c.v)}
              title={c.tip}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius)',
                border: '1px solid ' + (isOn ? 'var(--primary)' : 'var(--border)'),
                background: isOn ? 'var(--primary-soft)' : 'transparent',
                cursor: 'pointer',
                fontSize: '0.82rem',
                color: 'var(--text)',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
