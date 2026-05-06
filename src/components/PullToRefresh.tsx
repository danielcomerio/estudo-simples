'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh nativo (mobile-only). Detecta arrastar pra baixo
 * quando scroll está no topo, mostra indicador visual, e dispara
 * `onRefresh` ao soltar acima do threshold.
 *
 * Mobile-only: ignora se ponteiro não é touch.
 *
 * Args:
 *  - threshold: distância em px pra disparar (default 70)
 *  - onRefresh: callback async, mostra spinner enquanto pendente
 */
export function PullToRefresh({
  onRefresh,
  threshold = 70,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      // Só ativa se scrollTop=0 (topo da página)
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Resistência: dy real ÷ 2 pra dar feel "elástico"
      const adjusted = Math.min(120, dy / 2);
      setPull(adjusted);
      if (adjusted > 8 && e.cancelable) {
        e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (startY.current === null) return;
      const triggered = pull >= threshold;
      startY.current = null;
      if (triggered) {
        setRefreshing(true);
        setPull(threshold);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onRefresh, pull, threshold, refreshing]);

  const triggered = pull >= threshold;
  const indicatorOpacity = Math.min(1, pull / threshold);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -50,
          left: 0,
          right: 0,
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${pull}px)`,
          transition: refreshing ? 'none' : 'transform 0.18s ease-out',
          pointerEvents: 'none',
          opacity: indicatorOpacity,
          color: triggered || refreshing ? 'var(--primary)' : 'var(--muted)',
          fontSize: '1.4rem',
        }}
      >
        {refreshing ? (
          <span className="ptr-spinner" aria-label="Atualizando" />
        ) : triggered ? (
          '↻'
        ) : (
          '↓'
        )}
      </div>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: refreshing ? 'none' : 'transform 0.18s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
