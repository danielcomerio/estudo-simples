'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Barra fina de progresso durante navegação client-side. Anima ao entrar
 * em rota nova e some quando termina.
 *
 * Next 14 App Router não expõe router events (estão prometidos mas não
 * shipped). Heurística: detecta clique em <a> dentro do app e mostra a
 * barra até o pathname mudar.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  // Quando pathname muda, esconde a barra
  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setActive(false), 180);
      return () => clearTimeout(t);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detecta clique em <a> com mesmo origin pra mostrar a barra
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Só botão esquerdo, sem modificadores
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const link = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      // Same-origin client navigation: começa com /, não tem target nem download
      if (!href.startsWith('/')) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      // Mesma rota: ignora
      if (href === pathname) return;
      setActive(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      <div className="nav-progress-bar" />
    </div>
  );
}
