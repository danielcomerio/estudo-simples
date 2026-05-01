'use client';

import { useEffect } from 'react';
import { hydrate, resetStore } from '@/lib/store';
import { startBackgroundSync, stopBackgroundSync } from '@/lib/sync';
import { clearHierarchyCache } from '@/lib/hierarchy';
import { setActiveConcursoId } from '@/lib/settings';
import { clearSimuladosCache } from '@/lib/simulado-store';
import { ConfirmHost } from './ConfirmDialog';

export function StoreProvider({
  userId,
  userEmail: _userEmail,
  children,
}: {
  userId: string;
  userEmail: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    hydrate(userId);
    startBackgroundSync();

    const onBeforeUnload = () => {
      // Best-effort: estado foi persistido a cada mutação, então só garantia.
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
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
