'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Renderiza children só quando o wrapper está próximo do viewport
 * (Intersection Observer). Antes disso, mostra um placeholder com
 * altura mínima pra preservar scroll position.
 *
 * Uso típico em /stats: ~20 sections cada uma com useMemos pesados.
 * Sem isso, mount inicial faz todas (centenas de ms). Com lazy mount,
 * só as visíveis montam — resto monta on-demand quando scrolla.
 *
 * Args:
 *  - rootMargin: distância antes do viewport pra começar a montar.
 *    Default '300px' = monta um pouco antes do user ver, evitando
 *    flash de placeholder.
 *  - minHeight: altura do placeholder pra reservar espaço.
 */
export function LazyMount({
  children,
  rootMargin = '300px',
  minHeight = 120,
}: {
  children: React.ReactNode;
  rootMargin?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Browser sem IO: monta direto
      setMounted(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setMounted(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div ref={ref}>
      {mounted ? (
        children
      ) : (
        <div
          aria-hidden
          style={{
            minHeight,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            marginBottom: 16,
            opacity: 0.4,
          }}
        />
      )}
    </div>
  );
}
