import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BrandLogo } from './BrandLogo';

/**
 * Header compartilhado entre páginas públicas. Logo sempre clicável
 * (volta pra /inicio). Nav inline. Botão de Login/Comece grátis no
 * canto direito.
 *
 * Em mobile, nav vira menu hambúrguer simples (só Login/Signup
 * visíveis). Sem JS — usa <details>/<summary> nativo.
 *
 * Auto-detecta usuário logado: se logged, não renderiza nada (o
 * RootLayout já mostra Topbar do app). Antes essas páginas tinham
 * 2 barras quando user logado entrava pra ver /planos, /sobre etc.
 *
 * Async porque lê cookies via supabase server client.
 */
export async function PublicHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Logged: Topbar do RootLayout cobre. Sem header próprio.
    return null;
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'color-mix(in srgb, var(--bg-elev) 92%, transparent)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Link
          href="/inicio"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          {/* SVG inline — evita quadrado vazio em localhost (cache). */}
          <BrandLogo size={28} idPrefix="es-ph" />
          <strong style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}>
            Estudo Simples
          </strong>
        </Link>

        <nav
          aria-label="Navegação pública"
          style={{
            display: 'flex',
            gap: 14,
            marginLeft: 'auto',
            alignItems: 'center',
            fontSize: '0.88rem',
          }}
          className="public-header-nav"
        >
          <Link href="/planos" className="public-header-link">
            Planos
          </Link>
          <Link href="/sobre" className="public-header-link">
            Sobre
          </Link>
          <Link href="/concursos-populares" className="public-header-link">
            Bancas
          </Link>
          <Link href="/manual" className="public-header-link">
            Manual
          </Link>
          <Link
            href="/login"
            style={{ color: 'var(--muted)', textDecoration: 'none' }}
          >
            Entrar
          </Link>
          <Link href="/signup">
            <button
              type="button"
              className="primary"
              style={{ padding: '6px 14px', fontSize: '0.88rem' }}
            >
              Começar
            </button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
