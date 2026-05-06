import { useEffect, useRef } from 'react';

/**
 * Hook de long-press. Dispara `onLongPress(target)` após `delay`ms de
 * touch contínuo num elemento. Cancela se mover dedo > 10px ou soltar.
 *
 * Retorna handlers pra spread em qualquer elemento.
 *
 * Uso:
 *   const handlers = useLongPress((target) => openMenu(target), 500);
 *   <div {...handlers}>...</div>
 */
export function useLongPress(
  onLongPress: (target: HTMLElement) => void,
  delay = 500
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const fired = useRef(false);
  const targetRef = useRef<HTMLElement | null>(null);

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    targetRef.current = null;
  };

  useEffect(() => () => cancel(), []);

  const onTouchStart = (e: React.TouchEvent) => {
    fired.current = false;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    targetRef.current = e.currentTarget as HTMLElement;
    timer.current = setTimeout(() => {
      fired.current = true;
      if (targetRef.current) {
        // Vibração se disponível pra confirmar
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20);
          }
        } catch {}
        onLongPress(targetRef.current);
      }
    }, delay);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (Math.hypot(dx, dy) > 10) cancel();
  };

  const onTouchEnd = () => cancel();
  const onTouchCancel = () => cancel();

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    /** Para callers que precisam saber se o último gesto foi long-press */
    didFire: () => fired.current,
  };
}
