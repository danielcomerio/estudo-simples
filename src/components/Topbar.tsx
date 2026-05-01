'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { logout } from '@/app/auth/actions';
import { logoutAndReset } from './StoreProvider';
import { syncNow } from '@/lib/sync';
import { ActiveConcursoSelector } from './ActiveConcursoSelector';

const TABS = [
  { href: '/', label: 'Painel' },
  { href: '/banco', label: 'Banco' },
  { href: '/estudar', label: 'Estudar' },
  { href: '/discursivas', label: 'Discursivas' },
  { href: '/simulado', label: 'Simulado' },
  { href: '/stats', label: 'Estatísticas' },
  { href: '/configuracoes', label: 'Configurações' },
];

export function Topbar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const syncStatus = useStore((s) => s.syncStatus);
  const syncError = useStore((s) => s.syncError);
  const pendingCount = useStore((s) => Object.keys(s.pendingSync).length);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

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
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden />
        <h1>Estudo Simples</h1>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={'tab' + (isActive(t.href) ? ' active' : '')}
            role="tab"
            aria-selected={isActive(t.href)}
            prefetch
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="right">
        <ActiveConcursoSelector />

        <button
          type="button"
          className={'sync-pill ' + syncStatus}
          onClick={() => void syncNow()}
          title={syncError || 'Sincronizar agora'}
        >
          <span className="dot" />
          {syncLabel}
        </button>

        {email && <span className="user-mail" title={email}>{email}</span>}

        <form
          action={async () => {
            logoutAndReset();
            await logout();
          }}
        >
          <button type="submit" className="ghost icon" title="Sair" aria-label="Sair">
            ↪
          </button>
        </form>
      </div>
    </header>
  );
}
