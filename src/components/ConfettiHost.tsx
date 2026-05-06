'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Confetti CSS-only ativado por custom event 'estudo:celebrate'.
 *
 * Uso: chame `triggerConfetti('streak')` em qualquer lugar — o host
 * ouve e renderiza ~40 partículas que caem por 2s. Respeita
 * `prefers-reduced-motion` (no-op se ativo).
 */

type Particle = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
  drift: number;
};

const COLORS = ['#22c55e', '#16a34a', '#facc15', '#3b82f6', '#a855f7', '#f97316'];

let pid = 0;

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    id: pid++,
    left: Math.random() * 100,
    delay: Math.random() * 200,
    duration: 1500 + Math.random() * 1100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 6,
    rotate: Math.random() * 720,
    drift: (Math.random() - 0.5) * 200,
  }));
}

export function ConfettiHost() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onCelebrate = () => {
      if (reduced) return;
      setParticles(makeParticles(40));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setParticles([]), 3000);
    };

    window.addEventListener('estudo:celebrate', onCelebrate);
    return () => {
      window.removeEventListener('estudo:celebrate', onCelebrate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (particles.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.size,
            height: p.size,
            ['--drift' as string]: `${p.drift}px`,
            ['--rotate' as string]: `${p.rotate}deg`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function triggerConfetti(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('estudo:celebrate'));
}
