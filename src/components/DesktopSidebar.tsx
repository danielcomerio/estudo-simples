'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const KEY = 'estudo-simples:desktop-sidebar-collapsed';

const ITEMS = [
  { href: '/', label: 'Painel', icon: '🏠' },
  { href: '/hoje', label: 'Hoje', icon: '📅' },
  { href: '/revisoes', label: 'Revisões', icon: '🗓' },
  { href: '/banco', label: 'Banco', icon: '📚' },
  { href: '/estudar', label: 'Estudar', icon: '🎯' },
  { href: '/cards', label: 'Cards', icon: '🃏' },
  { href: '/discursivas', label: 'Discursivas', icon: '✍' },
  { href: '/simulado', label: 'Simulado', icon: '🧪' },
  { href: '/erros', label: 'Inimigas', icon: '👹' },
  { href: '/free-recall', label: 'Free recall', icon: '🧠' },
  { href: '/diario', label: 'Diário', icon: '📅' },
  { href: '/stats', label: 'Stats', icon: '📊' },
  { href: '/achievements', label: 'Conquistas', icon: '🏆' },
];

/**
 * Sidebar fixa lateral pra desktop (>= 1280px). Esconde em mobile.
 * Toggle colapsada (apenas ícones) persiste em localStorage.
 *
 * Aparece em qualquer rota — substitui ou complementa MobileBottomNav.
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(localStorage.getItem(KEY) === '1');
  }, []);

  const toggle = () => {
    setCollapsed((cur) => {
      const next = !cur;
      try {
        if (next) localStorage.setItem(KEY, '1');
        else localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const w = collapsed ? 56 : 180;

  return (
    <aside
      className="desktop-sidebar"
      style={{
        position: 'fixed',
        left: 0,
        top: 'calc(var(--topbar-height, 64px) + 8px)',
        bottom: 60,
        width: w,
        background: 'var(--bg-elev-2)',
        borderRight: '1px solid var(--border)',
        padding: '12px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        zIndex: 50,
        transition: 'width 0.2s',
        overflowY: 'auto',
      }}
    >
      {ITEMS.map((it) => {
        const active =
          it.href === '/' ? pathname === '/' : pathname?.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            title={collapsed ? it.label : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              fontSize: '0.88rem',
              background: active ? 'var(--primary-soft)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--text)',
              fontWeight: active ? 600 : 400,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{it.icon}</span>
            {!collapsed && <span>{it.label}</span>}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Expandir' : 'Colapsar'}
        style={{
          marginTop: 'auto',
          padding: '8px 10px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        {collapsed ? '→' : '←'}
      </button>
    </aside>
  );
}
