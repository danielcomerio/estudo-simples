'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook de swipe horizontal pra navegação entre questões/cards no mobile.
 *
 * Critérios pra disparar:
 * - distância horizontal > 60px
 * - distância horizontal > 1.8 * vertical (gesto majoritariamente horizontal)
 * - duração < 600ms (descarta scroll lento)
 *
 * Ignora swipes que começam em input/textarea/select/[contenteditable] pra
 * não atrapalhar seleção de texto. Também ignora se o alvo está dentro de
 * elemento marcado com `data-no-swipe`.
 */
export function useSwipe(opts: {
  onLeft?: () => void;
  onRight?: () => void;
  enabled?: boolean;
}) {
  const { onLeft, onRight, enabled = true } = opts;
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    const isExempt = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return false;
      const tag = el.tagName.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        tag === 'button'
      )
        return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return !!el.closest('[data-no-swipe]');
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        startRef.current = null;
        return;
      }
      if (isExempt(e.target)) {
        startRef.current = null;
        return;
      }
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };

    const onEnd = (e: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.t;
      if (dt > 600) return;
      if (Math.abs(dx) < 60) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.8) return;
      if (dx < 0) onLeft?.();
      else onRight?.();
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [enabled, onLeft, onRight]);
}
