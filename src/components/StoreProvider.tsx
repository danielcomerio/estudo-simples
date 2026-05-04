'use client';

import { useEffect } from 'react';
import { hydrate, migrateGuestToUser, resetStore } from '@/lib/store';
import { scheduleSync, startBackgroundSync, stopBackgroundSync } from '@/lib/sync';
import { clearHierarchyCache } from '@/lib/hierarchy';
import { applyTheme, getTheme, setActiveConcursoId } from '@/lib/settings';
import { clearSimuladosCache } from '@/lib/simulado-store';
import { toast } from './Toast';
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
      // Migração de visitante → conta recém-criada: cookie
      // 'es-migrate-guest=1' é setado pelo signup quando user pediu.
      // Roda ANTES de hydrate pra reescrever user_id em cada questão.
      const wantsMigrate =
        userId !== 'guest' &&
        document.cookie
          .split(';')
          .some((c) => c.trim().startsWith('es-migrate-guest=1'));
      if (wantsMigrate) {
        try {
          const { migrated } = await migrateGuestToUser(userId);
          if (migrated > 0) {
            toast(
              `${migrated} questão(ões) migradas pra sua nova conta.`,
              'success'
            );
            // Limpa o cookie marker e o de visitante
            document.cookie =
              'es-migrate-guest=; path=/; max-age=0; sameSite=lax';
            document.cookie = 'es-guest=; path=/; max-age=0; sameSite=lax';
            // Agenda push pra subir as questões
            scheduleSync(800);
          }
        } catch (e) {
          console.warn('Falha na migração de visitante:', e);
        }
      }
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
