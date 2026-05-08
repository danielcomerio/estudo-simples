'use client';

import { useEffect } from 'react';

/**
 * Mede a altura real da Topbar e injeta numa CSS variable
 * --topbar-height. Usada pelo `scroll-padding-top` do html e pelo
 * `scroll-margin-top` de cards alvo de âncora pra ficarem perfeitamente
 * posicionados abaixo da Topbar (sem ser cortados nem ficar muito longe).
 *
 * Re-mede quando Topbar mudar de altura (drawer mobile abre, viewport
 * resize, etc) via ResizeObserver.
 */
export function TopbarHeightTracker() {
  useEffect(() => {
    const topbar = document.querySelector('.topbar') as HTMLElement | null;
    if (!topbar) return;

    const update = () => {
      const h = topbar.offsetHeight;
      if (h > 0) {
        document.documentElement.style.setProperty(
          '--topbar-height',
          `${h}px`
        );
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(topbar);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return null;
}
