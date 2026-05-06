import Link from 'next/link';

/**
 * Header compartilhado entre páginas públicas. Logo sempre clicável
 * (volta pra /inicio). Nav inline. Botão de Login/Comece grátis no
 * canto direito.
 *
 * Em mobile, nav vira menu hambúrguer simples (só Login/Signup
 * visíveis). Sem JS — usa <details>/<summary> nativo.
 */
export function PublicHeader() {
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
          <span
            aria-hidden
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: '0 0 0 3px rgba(34,197,94,0.18)',
              flexShrink: 0,
            }}
          />
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
