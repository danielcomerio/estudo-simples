'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  // Smart hide: esconde ao scrollar pra baixo (libera espaço de leitura),
  // volta ao scrollar pra cima ou parar. Padrão de apps modernos.
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const diff = y - lastY.current;
        // Threshold pra evitar tremor por micro-rolagem
        if (Math.abs(diff) < 8) return;
        if (diff > 0 && y > 80) {
          setHidden(true); // scroll pra baixo, longe do topo
        } else {
          setHidden(false); // scroll pra cima ou perto do topo
        }
        lastY.current = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const dueByType = useMemo(() => {
    const tomorrow = startOfDay(Date.now()) + DAY_MS;
    let obj = 0;
    let cards = 0;
    for (const q of questions) {
      if ((q.srs?.dueDate ?? 0) >= tomorrow) continue;
      if (q.type === 'objetiva') obj++;
      else if (q.type === 'cloze' || q.type === 'flashcard') cards++;
    }
    return { obj, cards };
  }, [questions]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  const badgeFor = (href: string): number => {
    if (href === '/estudar') return dueByType.obj;
    if (href === '/cards') return dueByType.cards;
    return 0;
  };

  return (
    <nav
      className={'mobile-bottom-nav' + (hidden ? ' hidden' : '')}
      role="navigation"
      aria-label="Navegação principal"
    >
      {TABS.map((t) => {
        const active = isActive(t.href);
        const badge = badgeFor(t.href);
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
              {badge > 0 && (
                <span className="mbn-badge" aria-label={`${badge} vencendo`}>
                  {badge > 9 ? '9+' : badge}
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
