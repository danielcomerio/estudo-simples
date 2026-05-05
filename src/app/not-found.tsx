import Link from 'next/link';

export const metadata = {
  title: 'Página não encontrada — Estudo Simples',
};

export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '80px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '5rem', lineHeight: 1, marginBottom: 14 }}>🧭</div>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 10px' }}>
        Página não encontrada
      </h1>
      <p
        className="muted"
        style={{ margin: '0 0 28px', fontSize: '1rem', lineHeight: 1.5 }}
      >
        O caminho que você tentou acessar não existe ou foi movido.
      </p>
      <div
        className="row gap"
        style={{ justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <Link href="/">
          <button type="button" className="primary">
            🏠 Painel
          </button>
        </Link>
        <Link href="/banco">
          <button type="button">📚 Banco</button>
        </Link>
        <Link href="/inicio">
          <button type="button" className="ghost">
            Site
          </button>
        </Link>
      </div>
    </main>
  );
}
