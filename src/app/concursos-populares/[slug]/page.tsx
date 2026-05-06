import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BANCAS, getBancaBySlug } from '@/lib/concursos-data';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicHeader } from '@/components/PublicHeader';

export const dynamic = 'force-dynamic';

// Mantém generateStaticParams pra Next conhecer rotas válidas, mas
// força-dynamic faz cada request server-renderizar (Topbar funcional
// pra user logado).
export function generateStaticParams() {
  return BANCAS.map((b) => ({ slug: b.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const banca = getBancaBySlug(slug);
  if (!banca) return { title: 'Banca não encontrada — Estudo Simples' };
  return {
    title: `${banca.nome} — estratégias e dicas — Estudo Simples`,
    description: `Como estudar pra ${banca.nome}. ${banca.descricao.slice(0, 140)}`,
    openGraph: {
      title: `${banca.nome} — estratégias e dicas`,
      description: banca.descricao,
      locale: 'pt_BR',
    },
  };
}

export default async function BancaDetail({ params }: Params) {
  const { slug } = await params;
  const banca = getBancaBySlug(slug);
  if (!banca) {
    notFound();
  }

  return (
    <>
      <PublicHeader />
      <main
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '40px 20px 60px',
          lineHeight: 1.6,
        }}
      >
        <p
          className="muted"
          style={{ margin: '0 0 6px', fontSize: '0.85rem' }}
        >
          <Link href="/concursos-populares" style={{ color: 'var(--muted)' }}>
            ← Concursos populares
          </Link>
        </p>

        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '3rem', lineHeight: 1, marginBottom: 8 }}>
            {banca.emoji}
          </div>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            }}
          >
            Como estudar para {banca.nome}
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            {banca.descricao}
          </p>
        </header>

        <section style={{ marginBottom: 26 }}>
          <h2 style={{ marginBottom: 8 }}>Estilo da banca</h2>
          <p style={{ margin: 0 }}>{banca.estilo}</p>
        </section>

        <section style={{ marginBottom: 26 }}>
          <h2 style={{ marginBottom: 8 }}>Concursos típicos</h2>
          <ul style={{ paddingLeft: 22, margin: 0 }}>
            {banca.concursosExemplo.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: 26 }}>
          <h2 style={{ marginBottom: 8 }}>
            Dicas pra estudar com o Estudo Simples
          </h2>
          <ul style={{ paddingLeft: 22, margin: 0 }}>
            {banca.dicas.map((d) => (
              <li key={d} style={{ marginBottom: 6 }}>
                {d}
              </li>
            ))}
          </ul>
        </section>

        <section
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            textAlign: 'center',
            marginTop: 30,
          }}
        >
          <h3 style={{ margin: '0 0 8px' }}>
            Comece a estudar pra {banca.nome}
          </h3>
          <p
            className="muted"
            style={{
              margin: '0 0 14px',
              maxWidth: 480,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Crie conta grátis, importe ou crie questões dessa banca, marque com a
            tag <code>banca:{banca.slug}</code> e deixe o app cuidar da
            repetição.
          </p>
          <div
            className="row gap"
            style={{ justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <Link href="/signup">
              <button type="button" className="primary">
                Começar grátis →
              </button>
            </Link>
            <Link href="/planos">
              <button type="button">Ver planos</button>
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
