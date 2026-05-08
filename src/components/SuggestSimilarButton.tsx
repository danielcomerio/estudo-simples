'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import type { Question } from '@/lib/types';

/**
 * Botão "🔁 Mais 3 desse tipo" pós-erro. Heurística determinística
 * (sem IA, sem custo): mesma disciplina + max overlap de tags +
 * exclui a própria questão. Top 3 random.
 */
export function SuggestSimilarButton({ question }: { question: Question }) {
  const all = useStore(selectActiveQuestions);
  const [open, setOpen] = useState(false);

  const similars = useMemo(() => {
    const tags = new Set(question.tags ?? []);
    return all
      .filter((q) => q.id !== question.id)
      .filter((q) => q.type === 'objetiva')
      .filter((q) => q.disciplina_id === question.disciplina_id)
      .map((q) => {
        const overlap = (q.tags ?? []).filter((t) => tags.has(t)).length;
        return { q, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap || Math.random() - 0.5)
      .slice(0, 5)
      .map((x) => x.q);
  }, [all, question]);

  if (similars.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen((o) => !o)}
        title="Mostra outras questões da mesma disciplina e tags"
        style={{ padding: '4px 10px', fontSize: '0.82rem', marginTop: 6 }}
      >
        {open ? '▼ Esconder similares' : `🔁 Mais ${similars.length} desse tipo`}
      </button>
      {open && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '8px 0 0',
            fontSize: '0.85rem',
          }}
        >
          {similars.map((q) => {
            const enun = (q.payload as { enunciado?: string }).enunciado ?? '';
            return (
              <li
                key={q.id}
                style={{
                  padding: '6px 10px',
                  marginBottom: 6,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  borderLeft: '3px solid var(--primary)',
                }}
              >
                <Link
                  href={`/banco?id=${q.id.slice(0, 8)}`}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {enun.slice(0, 200)}
                  {enun.length > 200 ? '…' : ''}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
