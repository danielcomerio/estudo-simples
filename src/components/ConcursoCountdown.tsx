'use client';

import Link from 'next/link';
import { useActiveConcursoFilter } from '@/lib/hierarchy';

/**
 * Badge de countdown do concurso ativo. Aparece SE há concurso ativo
 * com data_prova futura. Toca a urgência conforme aproxima:
 *  - >60 dias: discreto azul
 *  - 30-60: amarelo
 *  - 7-30: laranja
 *  - <7: vermelho pulsante
 *  - <0 (passou): some
 *
 * Click navega pra /concursos.
 */
export function ConcursoCountdown() {
  const { concurso } = useActiveConcursoFilter();
  if (!concurso?.data_prova) return null;

  const provaDate = new Date(concurso.data_prova);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = provaDate.getTime() - today.getTime();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (days < 0) return null; // já passou

  let color = 'var(--primary)';
  let bg = 'var(--primary-soft)';
  let urgent = false;
  if (days <= 7) {
    color = 'var(--danger)';
    bg = 'var(--danger-soft)';
    urgent = true;
  } else if (days <= 30) {
    color = 'var(--warn, #d97706)';
    bg = 'var(--warn-bg, rgba(217, 119, 6, 0.12))';
  } else if (days <= 60) {
    color = '#eab308';
    bg = 'rgba(234, 179, 8, 0.12)';
  }

  const label =
    days === 0
      ? 'PROVA HOJE'
      : days === 1
        ? 'amanhã'
        : `${days}d`;

  return (
    <Link
      href="/concursos"
      className="topbar-countdown"
      title={`Prova de ${concurso.nome} em ${days} dia${days === 1 ? '' : 's'}`}
      aria-label={`Countdown: ${days} dias até a prova de ${concurso.nome}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${color}`,
        color: color,
        fontSize: '0.78rem',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        animation: urgent ? 'pulse-danger 1.5s ease-in-out infinite' : undefined,
      }}
    >
      <span aria-hidden>📅</span>
      {label}
    </Link>
  );
}
