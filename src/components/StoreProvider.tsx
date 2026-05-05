'use client';

import { useEffect, useRef } from 'react';
import { hydrate, migrateGuestToUser, resetStore, useStore } from '@/lib/store';
import { scheduleSync, startBackgroundSync, stopBackgroundSync } from '@/lib/sync';
import { clearHierarchyCache } from '@/lib/hierarchy';
import { applyTheme, getTheme, setActiveConcursoId } from '@/lib/settings';
import { clearSimuladosCache } from '@/lib/simulado-store';
import { clearSeedFlag, loadPlatformSeed } from '@/lib/platform-seed';
import { toast } from './Toast';
import { CommandPalette } from './CommandPalette';
import { ConfirmHost } from './ConfirmDialog';
import { GlobalSearch } from './GlobalSearch';
import { GoalCelebration } from './GoalCelebration';
import { VimNav } from './VimNav';

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

  // Carrega seed da plataforma quando apropriado:
  //  - guest: assim que hydrate completa e banco está vazio
  //  - autenticado: após primeiro pull (lastPullAt setado) E banco vazio
  //
  // O flag em localStorage garante que cada user só recebe seed 1x.
  // Pra forçar recarga depois (atualização da plataforma), use
  // `clearSeedFlag(userId)` via /configuracoes.
  const hydrated = useStore((s) => s.hydrated);
  const lastPullAt = useStore((s) => s.lastPullAt);
  // Conta SÓ as ativas (sem soft-deleted) — alinha com o que UI exibe.
  // Se contássemos `s.questions.length` cru, lixo deletado preso na IDB
  // mascararia "banco vazio" e o seed nunca carregaria.
  const activeQuestionsCount = useStore(
    (s) => s.questions.filter((q) => !q.deleted_at).length
  );
  const seedTriedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || seedTriedRef.current) return;
    // Quando o banco está vazio, sempre tenta carregar o seed —
    // limpamos o flag primeiro pra recuperar de qualquer estado "preso"
    // (flag em LS sobreviveu mas IDB perdeu os dados, bug antigo, etc.).
    // Se banco não-vazio, o effect nem chega aqui (gate abaixo).
    const tryLoadSeed = () => {
      seedTriedRef.current = true;
      clearSeedFlag(userId);
      void loadPlatformSeed(userId).then((n) => {
        if (n > 0) {
          toast(`📦 ${n} questão(ões) da plataforma carregadas.`, 'success');
          if (userId !== 'guest') scheduleSync(800);
        }
      });
    };
    if (userId === 'guest') {
      if (activeQuestionsCount === 0) tryLoadSeed();
      return;
    }
    // Autenticado: espera primeiro pull pra evitar duplicar com dados
    // já no servidor (caso usuário esteja entrando em outro device).
    if (!lastPullAt) return;
    if (activeQuestionsCount === 0) tryLoadSeed();
  }, [hydrated, userId, lastPullAt, activeQuestionsCount]);

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
      <GlobalSearch />
      <VimNav />
      <GoalCelebration />
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
