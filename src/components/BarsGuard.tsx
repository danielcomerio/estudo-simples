'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Defesa global: garante que `body.focus-mode` é removido toda vez que
 * o pathname muda. Sem isso, se o user ativa modo foco em /estudar e
 * navega pra outra rota antes de desativar, as barras (topbar +
 * mobile-bottom-nav) ficavam escondidas até refresh.
 *
 * O QuestionRunner já tem cleanup no unmount, mas em transições de
 * rota rápidas (especialmente em mobile com prefetch + navegação por
 * link) pode haver race. Esse hook é a defesa final.
 */
export function BarsGuard() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('focus-mode');
    }
  }, [pathname]);
  return null;
}
