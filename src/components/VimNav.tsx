'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from './Toast';

/**
 * Atalhos vim-like de navegação: G seguido de uma letra abre rota.
 * Combos:
 *  - G H = / (home / painel)
 *  - G B = /banco
 *  - G E = /estudar
 *  - G C = /cards
 *  - G D = /discursivas
 *  - G S = /stats
 *  - G M = /simulado
 *  - G K = /concursos
 *  - G O = /configuracoes
 *
 * Se você apertar G e demorar > 1.2s pra apertar a 2ª tecla, o combo
 * cancela. Se apertar G de novo dentro do tempo, reinicia o timer.
 */

const COMBOS: Record<string, string> = {
  H: '/',
  B: '/banco',
  E: '/estudar',
  C: '/cards',
  D: '/discursivas',
  S: '/stats',
  M: '/simulado',
  K: '/concursos',
  O: '/configuracoes',
};

const TIMEOUT_MS = 1200;

export function VimNav() {
  const router = useRouter();
  const armedRef = useRef<number | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const cancel = () => {
      if (armedRef.current !== null) {
        window.clearTimeout(armedRef.current);
        armedRef.current = null;
      }
      setArmed(false);
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Guard adicional: contentEditable (rich textareas), role="textbox"
      // (custom inputs via aria), e elementos focados em modo edição.
      if (target?.isContentEditable) return;
      if (target?.getAttribute('role') === 'textbox') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      if (e.key === 'g' || e.key === 'G') {
        // arma o combo
        if (armedRef.current !== null) {
          window.clearTimeout(armedRef.current);
        }
        armedRef.current = window.setTimeout(() => {
          armedRef.current = null;
          setArmed(false);
        }, TIMEOUT_MS);
        setArmed(true);
        return;
      }

      if (armedRef.current !== null) {
        const k = e.key.toUpperCase();
        const route = COMBOS[k];
        cancel();
        if (route) {
          e.preventDefault();
          router.push(route);
          toast(`→ ${route}`, '', 1200);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (armedRef.current !== null) window.clearTimeout(armedRef.current);
    };
  }, [router]);

  if (!armed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-elev)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--radius)',
        padding: '8px 14px',
        zIndex: 100,
        fontSize: '0.85rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
      aria-live="polite"
    >
      ⌨ <kbd>g</kbd> armado · <kbd>h</kbd> painel · <kbd>b</kbd> banco ·{' '}
      <kbd>e</kbd> estudar · <kbd>c</kbd> cards · <kbd>d</kbd> discursivas ·{' '}
      <kbd>s</kbd> stats · <kbd>m</kbd> simulado · <kbd>k</kbd> concursos ·{' '}
      <kbd>o</kbd> opções
    </div>
  );
}
