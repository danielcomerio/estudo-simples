'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Mitiga bug de "página esticada / sem topbar" quando o user navega
 * pra rota pública (que renderiza só PublicHeader) e volta via back
 * do browser pra rota do app.
 *
 * Causa raiz: browsers modernos têm back-forward cache (bfcache) que
 * restaura snapshot do DOM da página anterior INSTANTANEAMENTE, sem
 * re-executar JS nem re-fetchar RSC payload do Next. Isso é ótimo
 * pra performance, mas se entre as 2 navegações o RSC do layout
 * mudou (ex: cookie de sessão expirou ou auth state diferente), o
 * snapshot mostra um estado inconsistente: página renderizada como
 * deslogado mesmo que o user esteja logado.
 *
 * Fix: escutar `pageshow` com `event.persisted=true` (sinal definitivo
 * de bfcache restore) e chamar router.refresh() — isso re-busca o RSC
 * payload do server sem reload completo, mantendo state client (store
 * IDB, scroll, etc).
 *
 * Custo: 1 round-trip extra por bfcache restore. Vale: garante UI
 * consistente independente de quando o user voltar.
 *
 * Sem cleanup explícito porque listener de janela tem lifecycle do
 * componente (que vive enquanto o user estiver no app).
 */
export function BFCacheGuard() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Bfcache restore — re-fetch RSC do server pra garantir layout
        // coerente (Topbar, MobileBottomNav, dados de auth, etc).
        router.refresh();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [router]);

  return null;
}
