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
import { StreakBadge } from './StreakBadge';

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
        <img
          src="/icon.svg"
          alt=""
          aria-hidden
          width={26}
          height={26}
          className="topbar-logo"
        />
        <h1 className="topbar-brand-text">Estudo Simples</h1>
      </div>

      {/* Backdrop dim do drawer mobile. Click fecha. */}
      {mobileOpen && (
        <div
          className="topbar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

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

        {/* Drawer mobile: extras agrupados por seção com hierarquia
            visual clara. Cada section tem label discreto + items
            uniformes. Escondido em desktop. */}
        <div className="topbar-mobile-drawer-extras">
          <div className="drawer-section">
            <div className="drawer-section-label">Concurso ativo</div>
            <ActiveConcursoSelector />
          </div>

          <div className="drawer-section">
            <div className="drawer-section-label">Outras páginas</div>
            <div className="drawer-links">
              <Link
                href="/conquistas"
                onClick={() => setMobileOpen(false)}
                className="drawer-link"
              >
                <span aria-hidden>🏆</span>
                <span>Conquistas</span>
              </Link>
              <Link
                href="/configuracoes"
                onClick={() => setMobileOpen(false)}
                className="drawer-link"
              >
                <span aria-hidden>⚙</span>
                <span>Configurações</span>
              </Link>
              <Link
                href="/manual"
                onClick={() => setMobileOpen(false)}
                className="drawer-link"
              >
                <span aria-hidden>📖</span>
                <span>Manual</span>
              </Link>
              <Link
                href="/sobre"
                onClick={() => setMobileOpen(false)}
                className="drawer-link"
              >
                <span aria-hidden>ℹ️</span>
                <span>Sobre</span>
              </Link>
              <Link
                href="/contato"
                onClick={() => setMobileOpen(false)}
                className="drawer-link"
              >
                <span aria-hidden>✉️</span>
                <span>Contato</span>
              </Link>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section-label">Conta</div>
            {isGuest ? (
              <div className="drawer-account">
                <div className="drawer-user-info">
                  <span aria-hidden>👤</span>
                  <span style={{ color: 'var(--warn, #d97706)' }}>
                    Modo visitante
                  </span>
                </div>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="drawer-account-cta"
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
                    className="drawer-logout-btn"
                  >
                    ↪ Sair do modo visitante
                  </button>
                </form>
              </div>
            ) : (
              <div className="drawer-account">
                {email && (
                  <div className="drawer-user-info" title={email}>
                    <span aria-hidden>👤</span>
                    <span className="drawer-user-email">{email}</span>
                  </div>
                )}
                <form
                  action={async () => {
                    logoutAndReset();
                    await logout();
                  }}
                >
                  <button
                    type="submit"
                    className="drawer-logout-btn"
                  >
                    ↪ Desconectar
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="right">
        {/* Grupo 1: streak (info pessoal de progresso) */}
        <StreakBadge />

        <span className="topbar-sep topbar-desktop-only" aria-hidden />

        {/* Grupo 2: utility icons (install, tema, atalhos) */}
        <span className="topbar-desktop-only">
          <InstallPWAButton />
        </span>

        <ThemeToggleQuick />

        <span className="topbar-desktop-only">
          <ShortcutsHelp />
        </span>

        <span className="topbar-sep topbar-desktop-only" aria-hidden />

        {/* Grupo 3: contexto (concurso ativo) */}
        <span className="topbar-desktop-only">
          <ActiveConcursoSelector />
        </span>

        {/* Grupo 4: status de sync (info técnica) */}
        {!isGuest && (
          <button
            type="button"
            className={'sync-pill ' + syncStatus}
            onClick={() => void syncNow()}
            title={syncError || 'Sincronizar agora'}
            aria-label={syncError || 'Sincronizar agora'}
          >
            <span className="dot" aria-hidden />
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
  // SVG inline pra renderização consistente entre Windows/Mac/Linux/iOS/Android.
  // Antes 🖥 (desktop computer) era um monitor velho em alguns sistemas.
  const renderIcon = () => {
    if (t === 'auto') {
      // Lua/sol meio-meio (segue OS — visualmente representa "automático")
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
             strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18" />
          <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" stroke="none" />
        </svg>
      );
    }
    if (t === 'light') return '☀️';
    if (t === 'dark') return '🌙';
    return '⚫'; // amoled
  };
  return (
    <button
      type="button"
      className="ghost icon"
      onClick={() => setTheme(next)}
      title={`Tema: ${t} (clique pra ${next})`}
      aria-label="Alternar tema"
      style={{
        fontSize: '1rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderIcon()}
    </button>
  );
}
