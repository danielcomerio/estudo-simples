import Link from 'next/link';

/**
 * Footer compartilhado entre páginas públicas (landing, planos, manual,
 * privacidade, termos). Não aparece em rotas internas (banco, estudar,
 * etc.) — lá quem dá orientação é o Topbar/MobileBottomNav.
 */
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        marginTop: 60,
        padding: '24px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-elev-2)',
        color: 'var(--muted)',
        fontSize: '0.85rem',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Estudo Simples
          </div>
          <div>© {year} · Repetição espaçada para concursos.</div>
        </div>
        <nav
          style={{
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
          aria-label="Links do rodapé"
        >
          <Link href="/inicio" style={{ color: 'inherit' }}>
            Início
          </Link>
          <Link href="/planos" style={{ color: 'inherit' }}>
            Planos
          </Link>
          <Link href="/manual" style={{ color: 'inherit' }}>
            Manual
          </Link>
          <Link href="/privacidade" style={{ color: 'inherit' }}>
            Privacidade
          </Link>
          <Link href="/termos" style={{ color: 'inherit' }}>
            Termos
          </Link>
          <Link href="/contato" style={{ color: 'inherit' }}>
            Contato
          </Link>
          <Link href="/login" style={{ color: 'inherit' }}>
            Entrar
          </Link>
        </nav>
      </div>
    </footer>
  );
}
