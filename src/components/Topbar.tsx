'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { logout } from '@/app/auth/actions';
import { logoutAndReset } from './StoreProvider';
import { syncNow } from '@/lib/sync';
import { setTheme, useTheme } from '@/lib/settings';
import { ActiveConcursoSelector } from './ActiveConcursoSelector';
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

export function Topbar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const syncStatus = useStore((s) => s.syncStatus);
  const syncError = useStore((s) => s.syncError);
  const pendingCount = useStore((s) => Object.keys(s.pendingSync).length);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLElement>(null);

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
        <h1>Estudo Simples</h1>
      </div>

      <nav
        className={'tabs' + (mobileOpen ? ' tabs-open' : '')}
        role="tablist"
      >
        {TABS.map((t) => (
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
          </Link>
        ))}
      </nav>

      <div className="right">
        <ShortcutsHelp />

        <ThemeToggleQuick />

        <ActiveConcursoSelector />

        <button
          type="button"
          className={'sync-pill ' + syncStatus}
          onClick={() => void syncNow()}
          title={syncError || 'Sincronizar agora'}
        >
          <span className="dot" />
          <span className="sync-label">{syncLabel}</span>
        </button>

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
            className="ghost icon"
            title="Sair"
            aria-label="Sair"
          >
            ↪
          </button>
        </form>
      </div>
    </header>
  );
}

function ThemeToggleQuick() {
  const t = useTheme();
  const next = t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto';
  const icon = t === 'auto' ? '🖥' : t === 'light' ? '☀️' : '🌙';
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
