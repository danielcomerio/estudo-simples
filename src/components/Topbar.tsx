'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { DAY_MS } from '@/lib/srs';
import { startOfDay } from '@/lib/utils';
import { exitGuest } from '@/app/auth/actions';
import { logout } from '@/app/auth/actions';
import { logoutAndReset } from './StoreProvider';
import { syncNow } from '@/lib/sync';
import { setTheme, useTheme } from '@/lib/settings';
import { ActiveConcursoSelector } from './ActiveConcursoSelector';
import { InstallPWAButton } from './InstallPWAButton';
import { ShortcutsHelp } from './ShortcutsHelp';

const TABS = [
  { href: '/', label: 'Painel' },
  { href: '/banco', label: 'Banco' },
  { href: '/estudar', label: 'Estudar' },
  { href: '/discursivas', label: 'Discursivas' },
  { href: '/cards', label: 'Cards' },
  { href: '/simulado', label: 'Simulado' },
  { href: '/stats', label: 'Estatísticas' },
  { href: '/concursos', label: 'Concursos' },
  { href: '/configuracoes', label: 'Configurações' },
];

export function Topbar({
  email,
  isGuest = false,
}: {
  email: string | null;
  isGuest?: boolean;
}) {
  const pathname = usePathname();
  const syncStatus = useStore((s) => s.syncStatus);
  const syncError = useStore((s) => s.syncError);
  const pendingCount = useStore((s) => Object.keys(s.pendingSync).length);
  const questions = useStore(selectActiveQuestions);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLElement>(null);

  const dueObjetivas = useMemo(() => {
    const tomorrow = startOfDay(Date.now()) + DAY_MS;
    return questions.filter(
      (q) => q.type === 'objetiva' && (q.srs?.dueDate ?? 0) < tomorrow
    ).length;
  }, [questions]);

  // Atualiza document.title com prefixo "(N)" quando há vencendo e a aba
  // não está focada — visibilidade quando user está em outras abas.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const baseTitle = 'Estudo Simples';
    const update = () => {
      if (dueObjetivas > 0 && document.hidden) {
        document.title = `(${dueObjetivas > 99 ? '99+' : dueObjetivas}) ${baseTitle}`;
      } else {
        document.title = baseTitle;
      }
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [dueObjetivas]);

  // Fecha menu mobile ao mudar de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Click-outside fecha menu mobile
  useEffect(() => {
    if (!mobileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [mobileOpen]);

  // Páginas /disciplinas e /topicos são sub-rotas conceituais de
  // Concursos — destacam essa tab.
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/concursos') {
      return (
        pathname?.startsWith('/concursos') ||
        pathname?.startsWith('/disciplinas') ||
        pathname?.startsWith('/topicos')
      );
    }
    return pathname?.startsWith(href);
  };

  const syncLabel =
    syncStatus === 'syncing'
      ? 'sincronizando…'
      : syncStatus === 'error'
        ? 'erro de sincronização'
        : syncStatus === 'offline'
          ? 'offline'
          : pendingCount > 0
            ? `${pendingCount} pendente(s)`
            : 'sincronizado';

  return (
    <header className="topbar" ref={mobileRef}>
      <div className="brand">
        <button
          type="button"
          className="ghost icon hamburger"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
        <span className="logo" aria-hidden />
        <h1 className="topbar-brand-text">Estudo Simples</h1>
      </div>

      <nav
        className={'tabs' + (mobileOpen ? ' tabs-open' : '')}
        role="tablist"
      >
        {TABS.map((t) => {
          const showBadge = t.href === '/estudar' && dueObjetivas > 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={'tab' + (isActive(t.href) ? ' active' : '')}
              role="tab"
              aria-selected={isActive(t.href)}
              prefetch
              onClick={() => setMobileOpen(false)}
            >
              {t.label}
              {showBadge && (
                <span
                  className="tab-badge"
                  aria-label={`${dueObjetivas} questões vencendo`}
                  title={`${dueObjetivas} vencendo`}
                >
                  {dueObjetivas > 9 ? '9+' : dueObjetivas}
                </span>
              )}
            </Link>
          );
        })}

        {/* Drawer mobile: extras que ficam fora da topbar visível em
            mobile (concurso, sair, criar conta) — só aparecem aqui
            dentro do hamburger menu. Em desktop ficam escondidos. */}
        <div className="topbar-mobile-drawer-extras">
          <div className="topbar-mobile-divider" aria-hidden />
          <div className="topbar-mobile-row">
            <ActiveConcursoSelector />
          </div>
          <div
            className="topbar-mobile-row"
            style={{ flexWrap: 'wrap', gap: 8 }}
          >
            <Link
              href="/conquistas"
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: '0.88rem',
              }}
            >
              🏆 Conquistas
            </Link>
            <Link
              href="/configuracoes"
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: '0.88rem',
              }}
            >
              ⚙ Configurações
            </Link>
            <Link
              href="/manual"
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: '0.88rem',
              }}
            >
              📖 Manual
            </Link>
          </div>
          {isGuest ? (
            <div className="topbar-mobile-row">
              <span style={{ color: 'var(--warn, #d97706)', fontWeight: 500 }}>
                👤 Modo visitante
              </span>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--primary)',
                  color: 'var(--primary)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Criar conta
              </Link>
              <form
                action={async () => {
                  logoutAndReset();
                  await exitGuest();
                }}
              >
                <button
                  type="submit"
                  className="ghost"
                  style={{ padding: '8px 14px' }}
                >
                  ↪ Sair do modo visitante
                </button>
              </form>
            </div>
          ) : (
            <div className="topbar-mobile-row">
              {email && (
                <span
                  style={{ color: 'var(--muted)', fontSize: '0.9rem' }}
                  title={email}
                >
                  👤 {email}
                </span>
              )}
              <form
                action={async () => {
                  logoutAndReset();
                  await logout();
                }}
              >
                <button
                  type="submit"
                  className="ghost"
                  style={{ padding: '8px 14px' }}
                >
                  ↪ Sair
                </button>
              </form>
            </div>
          )}
        </div>
      </nav>

      <div className="right">
        <span className="topbar-desktop-only">
          <InstallPWAButton />
        </span>

        <span className="topbar-desktop-only">
          <ShortcutsHelp />
        </span>

        <ThemeToggleQuick />

        <span className="topbar-desktop-only">
          <ActiveConcursoSelector />
        </span>

        {!isGuest && (
          <button
            type="button"
            className={'sync-pill ' + syncStatus}
            onClick={() => void syncNow()}
            title={syncError || 'Sincronizar agora'}
          >
            <span className="dot" />
            <span className="sync-label">{syncLabel}</span>
          </button>
        )}

        <div className="topbar-desktop-only" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {isGuest ? (
          <>
            <span
              className="user-mail"
              title="Modo visitante — dados ficam só neste navegador"
              style={{ color: 'var(--warn, #d97706)', fontWeight: 500 }}
            >
              👤 visitante
            </span>
            <Link
              href="/signup"
              className="ghost"
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--primary)',
                color: 'var(--primary)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
              title="Criar conta pra sincronizar entre dispositivos"
            >
              Criar conta
            </Link>
            <form
              action={async () => {
                logoutAndReset();
                await exitGuest();
              }}
            >
              <button
                type="submit"
                className="ghost"
                title="Sair do modo visitante (apaga dados locais)"
                aria-label="Sair"
                style={{ padding: '6px 14px' }}
              >
                ↪ Sair
              </button>
            </form>
          </>
        ) : (
          <>
            {email && (
              <span className="user-mail" title={email}>
                {email}
              </span>
            )}

            <form
              action={async () => {
                logoutAndReset();
                await logout();
              }}
            >
              <button
                type="submit"
                className="ghost"
                title="Desconectar"
                aria-label="Desconectar"
                style={{ padding: '6px 14px' }}
              >
                ↪ Sair
              </button>
            </form>
          </>
        )}
        </div>
      </div>
    </header>
  );
}

function ThemeToggleQuick() {
  const t = useTheme();
  // Cycle: auto → light → dark → amoled → auto
  const next =
    t === 'auto' ? 'light' : t === 'light' ? 'dark' : t === 'dark' ? 'amoled' : 'auto';
  const icon =
    t === 'auto' ? '🖥' : t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '⚫';
  return (
    <button
      type="button"
      className="ghost icon"
      onClick={() => setTheme(next)}
      title={`Tema: ${t} (clique pra ${next})`}
      aria-label="Alternar tema"
      style={{ fontSize: '1rem' }}
    >
      {icon}
    </button>
  );
}
