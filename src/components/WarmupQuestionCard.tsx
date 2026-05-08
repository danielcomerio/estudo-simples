'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { renderRichText } from '@/lib/utils';

/**
 * Card "Warmup" no Painel: mostra UMA questão random pra "esquentar".
 * Exibe enunciado + alternativas (se objetiva) + botão de revelar +
 * link pra ir pro /estudar com essa específica.
 *
 * Random fixo por sessão (memo único do array de questions).
 */
export function WarmupQuestionCard() {
  const questions = useStore(selectActiveQuestions);
  const [revealed, setRevealed] = useState(false);

  const q = useMemo(() => {
    const objetivas = questions.filter((x) => x.type === 'objetiva');
    if (objetivas.length === 0) return null;
    return objetivas[Math.floor(Math.random() * objetivas.length)];
  }, [questions.length]); // muda só quando count muda

  if (!q) return null;
  const p = q.payload as {
    enunciado?: string;
    alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
    explicacao_geral?: string;
  };
  if (!p.enunciado) return null;

  const correta = p.alternativas?.find((a) => a.correta);

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row gap" style={{ alignItems: 'center', marginBottom: 6 }}>
        <strong>🔥 Warmup random</strong>
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          {q.disciplina_id ?? '—'}
        </span>
        <span style={{ flex: 1 }} />
        <Link
          href={`/banco?id=${q.id.slice(0, 8)}`}
          style={{ fontSize: '0.78rem' }}
        >
          Abrir
        </Link>
      </div>
      <div
        style={{ fontSize: '0.92rem', lineHeight: 1.5 }}
        dangerouslySetInnerHTML={{
          __html: renderRichText(p.enunciado.slice(0, 400)) + (p.enunciado.length > 400 ? '…' : ''),
        }}
      />
      {Array.isArray(p.alternativas) && p.alternativas.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', fontSize: '0.88rem' }}>
          {p.alternativas.map((a) => (
            <li key={a.letra} style={{ padding: '2px 0' }}>
              <strong>{a.letra})</strong> {a.texto.slice(0, 120)}
              {a.texto.length > 120 ? '…' : ''}
            </li>
          ))}
        </ul>
      )}
      {!revealed && (
        <button
          type="button"
          className="ghost"
          onClick={() => setRevealed(true)}
          style={{ padding: '4px 10px', fontSize: '0.85rem', marginTop: 6 }}
        >
          👁 Revelar gabarito
        </button>
      )}
      {revealed && correta && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: 'var(--primary-soft)',
            borderRadius: 'var(--radius)',
            fontSize: '0.88rem',
          }}
        >
          ✅ Resposta: <strong>{correta.letra}) {correta.texto.slice(0, 120)}</strong>
          {p.explicacao_geral && (
            <div className="muted" style={{ marginTop: 4 }}>
              {p.explicacao_geral.slice(0, 200)}
            </div>
          )}
        </div>
      )}
      <p className="muted" style={{ fontSize: '0.72rem', marginTop: 8 }}>
        Não conta SRS — só pra esquentar a cabeça.
      </p>
    </div>
  );
}
