import Link from 'next/link';
import { BANCAS } from '@/lib/concursos-data';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-static';
export const metadata = {
  title: 'Concursos populares — Estudo Simples',
  description:
    'Aprenda a estudar para FGV, Cebraspe, FCC e mais. Dicas específicas por banca, integração total com o Estudo Simples.',
  openGraph: {
    title: 'Concursos populares — Estudo Simples',
    description:
      'Estratégias e dicas por banca. FGV, Cebraspe, FCC, IBFC.',
    locale: 'pt_BR',
  },
};

export default function ConcursosPopulares() {
  return (
    <>
      <main
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: '40px 20px 60px',
        }}
      >
        <header style={{ marginBottom: 30, textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
            Concursos populares por banca
          </h1>
          <p
            className="muted"
            style={{ margin: '0 auto', maxWidth: 600, lineHeight: 1.5 }}
          >
            Cada banca cobra de um jeito diferente. Veja as dicas específicas e
            comece a estudar focado nela.
          </p>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          {BANCAS.map((b) => (
            <Link
              key={b.slug}
              href={`/concursos-populares/${b.slug}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <article
                className="card"
                style={{
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  cursor: 'pointer',
                  transition: 'border-color 0.18s, transform 80ms',
                }}
              >
                <div style={{ fontSize: '2rem', lineHeight: 1 }}>{b.emoji}</div>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{b.nome}</h2>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--muted)',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                  }}
                >
                  {b.descricao.slice(0, 140)}…
                </p>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--primary)',
                    marginTop: 6,
                  }}
                >
                  Ver detalhes →
                </div>
              </article>
            </Link>
          ))}
        </section>

        <section
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            textAlign: 'center',
            marginTop: 40,
          }}
        >
          <h3 style={{ margin: '0 0 8px' }}>Estuda independente da banca</h3>
          <p
            className="muted"
            style={{ margin: '0 0 14px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}
          >
            O Estudo Simples ajusta automaticamente as recomendações conforme você
            usa. Importe questões de qualquer banca e o app cuida da repetição.
          </p>
          <div className="row gap" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup">
              <button type="button" className="primary">
                Começar grátis →
              </button>
            </Link>
            <Link href="/inicio">
              <button type="button">Voltar</button>
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
