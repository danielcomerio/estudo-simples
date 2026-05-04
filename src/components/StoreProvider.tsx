'use client';

import { useEffect } from 'react';
import { hydrate, resetStore } from '@/lib/store';
import { startBackgroundSync, stopBackgroundSync } from '@/lib/sync';
import { clearHierarchyCache } from '@/lib/hierarchy';
import { applyTheme, getTheme, setActiveConcursoId } from '@/lib/settings';
import { clearSimuladosCache } from '@/lib/simulado-store';
import { CommandPalette } from './CommandPalette';
import { ConfirmHost } from './ConfirmDialog';

export function StoreProvider({
  userId,
  userEmail: _userEmail,
  isGuest: _isGuest,
  children,
}: {
  userId: string;
  userEmail: string | null;
  isGuest?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Aplica tema o mais cedo possível pra reduzir flash. (Idealmente
    // seria via <script> inline pré-React, mas useEffect roda quase
    // imediatamente após hydrate.)
    applyTheme(getTheme());

    // hydrate é async desde a migração pra IndexedDB. Espera carregar
    // o estado persistido ANTES de iniciar background sync — sem isso,
    // a primeira tentativa de pull pode usar lastPullAt obsoleto (do
    // initial state), refazendo trabalho.
    let cancelled = false;
    void (async () => {
      await hydrate(userId);
      if (cancelled) return;
      startBackgroundSync();
    })();

    const onBeforeUnload = () => {
      // Best-effort: estado foi persistido a cada mutação, então só garantia.
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      cancelled = true;
      stopBackgroundSync();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [userId]);

  // Se trocar de usuário (rota → outro user), reseta cache.
  useEffect(() => {
    return () => {
      // Não reseta no unmount comum; reset só ao logout (ver Topbar).
    };
  }, []);

  return (
    <>
      {children}
      <ConfirmHost />
      <CommandPalette />
    </>
  );
}

export function logoutAndReset() {
  resetStore();
  clearHierarchyCache();
  clearSimuladosCache();
  // Concurso ativo é per-user; resetar evita o próximo user logando ver
  // filtro residual do user anterior.
  setActiveConcursoId(null);
}
