'use client';

import { useEffect, useState } from 'react';
import { isSoundsEnabled, setSoundsEnabled, playSound } from '@/lib/sounds';

/**
 * Toggle de sons curtos em acerto/erro. Off por default — alguns
 * users preferem silêncio (estudar em ambientes públicos, ou só
 * acharem chato). Som é gerado via Web Audio API (sem assets).
 */
export function SoundsSection() {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEnabled(isSoundsEnabled());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const toggle = () => {
    const next = !enabled;
    setSoundsEnabled(next);
    setEnabled(next);
    if (next) {
      // Toca som de teste pra user confirmar que funciona
      playSound('success');
    }
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>🔊 Sons</h2>
      <p
        className="muted"
        style={{ margin: '0 0 12px', fontSize: '0.9rem', lineHeight: 1.5 }}
      >
        Som curto ao acertar/errar nas sessões. Off por default — útil
        em ambientes silenciosos ou pra quem prefere foco visual.
      </p>
      <button
        type="button"
        className={enabled ? 'primary' : 'ghost'}
        onClick={toggle}
        style={{ padding: '8px 16px' }}
      >
        {enabled ? '🔊 Sons ativados' : '🔇 Sons desativados'}
      </button>
      {enabled && (
        <div className="row gap" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="ghost"
            onClick={() => playSound('success')}
            style={{ fontSize: '0.85rem' }}
          >
            ▶ Testar acerto
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => playSound('error')}
            style={{ fontSize: '0.85rem' }}
          >
            ▶ Testar erro
          </button>
        </div>
      )}
    </div>
  );
}
