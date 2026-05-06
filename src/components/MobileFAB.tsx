'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { DAY_MS } from '@/lib/srs';
import { startOfDay } from '@/lib/utils';

/**
 * Floating Action Button (mobile-only). Atalho polegar pra "Estudar
 * agora" — leva direto pra sessão SRS automática com 10 questões.
 *
 * Aparece em qualquer rota fora de /estudar, /discursivas, /cards,
 * /simulado (rotas de sessão ativa onde o FAB seria ruído). Esconde
 * em focus-mode.
 *
 * Badge mostra qtd de objetivas vencidas. CSS `display: none` em
 * desktop (>=760px) — só pra mobile.
 */

const HIDE_ON = ['/estudar', '/discursivas', '/cards', '/simulado'];

export function MobileFAB() {
  const pathname = usePathname();
  const questions = useStore(selectActiveQuestions);

  const due = useMemo(() => {
    const tomorrow = startOfDay(Date.now()) + DAY_MS;
    return questions.filter(
      (q) => q.type === 'objetiva' && (q.srs?.dueDate ?? 0) < tomorrow
    ).length;
  }, [questions]);

  if (HIDE_ON.some((p) => pathname?.startsWith(p))) return null;
  if (questions.length === 0) return null;

  const hasDue = due > 0;
  const href = hasDue
    ? '/estudar?modo=srs&qtd=10&auto=1'
    : '/estudar?modo=aleatorio&qtd=10&auto=1';

  return (
    <Link
      href={href}
      className="mobile-fab"
      aria-label={hasDue ? `Estudar ${due} vencendo` : 'Estudar agora'}
      title={hasDue ? `${due} vencendo` : 'Estudar 10 aleatórias'}
    >
      <span aria-hidden style={{ fontSize: '1.45rem', lineHeight: 1 }}>🎯</span>
      {hasDue && (
        <span className="mobile-fab-badge" aria-hidden>
          {due > 99 ? '99+' : due}
        </span>
      )}
    </Link>
  );
}
