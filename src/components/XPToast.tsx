'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Pequeno indicador "+10 XP" que sobe + fade-out quando o user completa
 * uma sessão. Disparado por `triggerXP(amount, label?)`. Respeita
 * prefers-reduced-motion (não anima — toast estático por 1.5s).
 *
 * Não é um sistema de XP real (sem persist) — só visual feedback.
 */

type XPEvent = { id: number; amount: number; label: string };

let eid = 0;

export function XPToast() {
  const [items, setItems] = useState<XPEvent[]>([]);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onXP = (e: Event) => {
      const ce = e as CustomEvent<{ amount: number; label?: string }>;
      const item: XPEvent = {
        id: eid++,
        amount: ce.detail.amount,
        label: ce.detail.label ?? 'XP',
      };
      setItems((prev) => [...prev, item]);
      setTimeout(
        () => {
          setItems((prev) => prev.filter((p) => p.id !== item.id));
        },
        reducedRef.current ? 1500 : 1800
      );
    };

    window.addEventListener('estudo:xp', onXP);
    return () => window.removeEventListener('estudo:xp', onXP);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        bottom: 100,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 9998,
        gap: 6,
      }}
    >
      {items.map((it) => (
        <div
          key={it.id}
          className={reducedRef.current ? 'xp-toast-static' : 'xp-toast-anim'}
          style={{
            background: 'linear-gradient(135deg, #facc15, #f59e0b)',
            color: '#0b1220',
            padding: '8px 18px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: '1.05rem',
            boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
            border: '2px solid #f59e0b',
          }}
        >
          +{it.amount} {it.label}
        </div>
      ))}
    </div>
  );
}

export function triggerXP(amount: number, label = 'XP'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('estudo:xp', { detail: { amount, label } })
  );
}
