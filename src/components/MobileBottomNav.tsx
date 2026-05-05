'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { DAY_MS } from '@/lib/srs';
import { startOfDay } from '@/lib/utils';

/**
 * Barra fixa de navegação inferior — somente mobile (CSS hide >=760).
 * Atalhos polegar-friendly pras rotas mais usadas. Esconde em modo
 * focus pra não atrapalhar sessão de estudo.
 */
const TABS = [
  { href: '/', label: 'Painel', icon: '🏠' },
  { href: '/banco', label: 'Banco', icon: '📚' },
  { href: '/estudar', label: 'Estudar', icon: '🎯' },
  { href: '/cards', label: 'Cards', icon: '🃏' },
  { href: '/stats', label: 'Stats', icon: '📊' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const questions = useStore(selectActiveQuestions);

  const dueObjetivas = useMemo(() => {
    const tomorrow = startOfDay(Date.now()) + DAY_MS;
    return questions.filter(
      (q) => q.type === 'objetiva' && (q.srs?.dueDate ?? 0) < tomorrow
    ).length;
  }, [questions]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="Navegação principal">
      {TABS.map((t) => {
        const active = isActive(t.href);
        const showBadge = t.href === '/estudar' && dueObjetivas > 0;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={'mbn-item' + (active ? ' active' : '')}
            aria-current={active ? 'page' : undefined}
            prefetch
          >
            <span className="mbn-icon" aria-hidden>
              {t.icon}
              {showBadge && (
                <span className="mbn-badge" aria-label={`${dueObjetivas} vencendo`}>
                  {dueObjetivas > 9 ? '9+' : dueObjetivas}
                </span>
              )}
            </span>
            <span className="mbn-label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
