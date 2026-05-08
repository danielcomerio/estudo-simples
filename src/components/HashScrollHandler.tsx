'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Anchor scroll: quando rota tem hash, espera o elemento existir e
 * faz UM scroll instantâneo (sem animação, sem re-aplicação).
 *
 * Sem retries depois do primeiro acerto — evita chacoalhada quando
 * cards acima do alvo continuam hidratando. Se o alvo deslocar
 * depois, paciência: a página fica próxima do certo e o user usa
 * o scroll natural se precisar.
 */
export function HashScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    let cancelled = false;
    let elapsed = 0;

    function getOffset(): number {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue('--topbar-height')
        .trim();
      const px = parseFloat(v) || 72;
      return px + 12;
    }

    function attempt() {
      if (cancelled) return;
      const el = document.getElementById(hash);
      if (el) {
        const rect = el.getBoundingClientRect();
        const targetY = Math.max(0, rect.top + window.scrollY - getOffset());
        window.scrollTo({ top: targetY, behavior: 'auto' });
        return;
      }
      if (elapsed >= 1000) return;
      elapsed += 50;
      window.setTimeout(attempt, 50);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(attempt);
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
