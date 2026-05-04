'use client';

import Link from 'next/link';
import { useIsGuest } from '@/lib/settings';

/**
 * Aviso de "feature indisponível no modo visitante" pra páginas que
 * dependem de tabelas server-side (concursos, disciplinas, tópicos).
 * No-op se usuário autenticado real.
 */
export function GuestNotice({ feature }: { feature: string }) {
  const guest = useIsGuest();
  if (!guest) return null;

  return (
    <div
      className="card"
      style={{
        background: 'var(--warn-bg, #4a3a1a)',
        border: '1px solid var(--warn, #d97706)',
        marginBottom: 12,
      }}
    >
      <strong>👤 Modo visitante</strong> — {feature} requer conta criada
      (precisa de servidor pra persistir).
      <div style={{ marginTop: 8 }}>
        <Link
          href="/signup"
          className="primary"
          style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: 'var(--radius)',
            background: 'var(--primary)',
            color: 'var(--primary-fg, #fff)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Criar conta grátis
        </Link>
      </div>
    </div>
  );
}
