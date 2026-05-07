'use client';

import { useEffect, useState } from 'react';

/**
 * Toast persistente (5s) com efeito celebração quando user desbloqueia
 * uma conquista. Disparado por triggerAchievement(emoji, label).
 *
 * Diferente do XPToast (efêmero, +N XP, 1.8s) — este permanece, tem
 * aria-live=polite, e foca no nome da conquista.
 *
 * Detecção de unlock fica em quem chama (Dashboard, ConquistasView,
 * etc.) — esse componente só renderiza.
 */

type AEvent = { id: number; emoji: string; label: string };

let aid = 0;

export function AchievementToast() {
  const [items, setItems] = useState<AEvent[]>([]);

  useEffect(() => {
    const onAch = (e: Event) => {
      const ce = e as CustomEvent<{ emoji: string; label: string }>;
      const item: AEvent = {
        id: aid++,
        emoji: ce.detail.emoji,
        label: ce.detail.label,
      };
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((p) => p.id !== item.id));
      }, 5000);
    };
    window.addEventListener('estudo:achievement', onAch);
    return () => window.removeEventListener('estudo:achievement', onAch);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'max(80px, env(safe-area-inset-top, 80px))',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 9998,
        gap: 8,
      }}
    >
      {items.map((it) => (
        <div
          key={it.id}
          className="achievement-pop"
          style={{
            background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
            color: '#0b1220',
            padding: '12px 20px',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            border: '2px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 'calc(100% - 32px)',
          }}
        >
          <span style={{ fontSize: '2rem' }} aria-hidden>
            {it.emoji}
          </span>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.7 }}>
              CONQUISTA DESBLOQUEADA
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function triggerAchievement(emoji: string, label: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('estudo:achievement', { detail: { emoji, label } })
  );
}
