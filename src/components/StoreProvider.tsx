'use client';

import { useEffect } from 'react';
import { hydrate, resetStore } from '@/lib/store';
import { startBackgroundSync, stopBackgroundSync } from '@/lib/sync';
import { clearHierarchyCache } from '@/lib/hierarchy';
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
}
