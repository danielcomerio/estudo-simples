'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Question } from '@/lib/types';
import { startOfDay } from '@/lib/utils';

const KEY = 'estudo-simples:primeiros-passos:dismissed';

/**
 * Checklist de "Primeiros passos" pra users novos. Aparece no Dashboard
 * com até 5 passos. Dispense fecha pra sempre. Auto-some quando todos
 * completados.
 *
 * Cada passo é detectado dinamicamente do estado atual (não persiste
 * "feito" — recomputa). Isso faz o checklist sempre fiel à realidade.
 */
export function PrimeirosPassos({ questions }: { questions: Question[] }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(localStorage.getItem(KEY) === '1');
    } catch {
      setDismissed(true);
    }
  }, []);

  if (dismissed === null) return null;
  if (dismissed) return null;

  const total = questions.length;
  const stats = questions.reduce(
    (s, q) => {
      const a = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      s.totalAttempts += a;
      s.totalCorrect += c;
      if ((q.payload as Record<string, unknown>).bookmarked === true) s.fav++;
      return s;
    },
    { totalAttempts: 0, totalCorrect: 0, fav: 0 }
  );

  // Calcula reviewsToday
  const today = startOfDay(Date.now());
  let reviewsToday = 0;
  for (const q of questions) {
    for (const h of q.stats?.history ?? []) {
      if (h.date >= today) reviewsToday++;
    }
  }

  const passos = [
    {
      id: 'importar',
      label: 'Adicionar suas primeiras questões',
      done: total > 0,
      cta: { href: '/banco', label: '→ Banco' },
    },
    {
      id: 'concurso',
      label: 'Criar um concurso (opcional, foca o estudo)',
      // Heurística: se há questão com concurso_id setado
      done: questions.some((q) => q.concurso_id),
      cta: { href: '/concursos', label: '→ Concursos' },
    },
    {
      id: 'estudar',
      label: 'Responder 10 questões',
      done: stats.totalAttempts >= 10,
      cta: { href: '/estudar?modo=srs&qtd=10&auto=1', label: '▶ Estudar 10' },
    },
    {
      id: 'meta',
      label: 'Bater meta diária pelo menos uma vez',
      // Approximation: ≥30 reviews em algum dia (default goal)
      done: reviewsToday >= 30 || stats.totalAttempts >= 30,
      cta: { href: '/estudar?modo=srs&qtd=10&auto=1', label: '▶ Continuar' },
    },
    {
      id: 'favorita',
      label: 'Favoritar uma questão importante',
      done: stats.fav > 0,
      cta: { href: '/banco', label: '→ Marcar ⭐' },
    },
  ];

  const completados = passos.filter((p) => p.done).length;
  // Auto-some quando todos completados (sem precisar dispense manual)
  if (completados === passos.length) {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    return null;
  }

  const dispense = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
  };

  return (
    <div
      className="card"
      style={{
        background: 'var(--primary-soft)',
        border: '1px solid var(--primary)',
      }}
    >
      <div
        className="row between"
        style={{
          alignItems: 'center',
          marginBottom: 8,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <strong style={{ fontSize: '1rem' }}>
          🚀 Primeiros passos · {completados}/{passos.length}
        </strong>
        <button
          type="button"
          className="ghost"
          onClick={dispense}
          aria-label="Fechar checklist pra sempre"
          title="Não mostrar mais"
          style={{ padding: '2px 10px', fontSize: '0.78rem' }}
        >
          Fechar
        </button>
      </div>
      <div
        aria-hidden
        style={{
          height: 4,
          background: 'var(--bg-elev)',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(100 * completados) / passos.length}%`,
            background: 'var(--primary)',
            transition: 'width 0.4s',
          }}
        />
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {passos.map((p) => (
          <li
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              background: p.done ? 'rgba(34,197,94,0.08)' : 'transparent',
              opacity: p.done ? 0.85 : 1,
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: '1.1rem',
                color: p.done ? 'var(--primary)' : 'var(--muted)',
              }}
            >
              {p.done ? '✓' : '○'}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: '0.92rem',
                textDecoration: p.done ? 'line-through' : undefined,
                color: p.done ? 'var(--muted)' : 'var(--text)',
              }}
            >
              {p.label}
            </span>
            {!p.done && p.cta && (
              <Link
                href={p.cta.href}
                style={{
                  color: 'var(--primary)',
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                }}
              >
                {p.cta.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
