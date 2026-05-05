import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-static';
export const metadata = {
  title: 'Estudo Simples — repetição espaçada para concursos',
  description:
    'App de repetição espaçada (SRS) para concursos públicos. Estude com SM-2 ou FSRS, importe questões de qualquer banca, faça simulados, e maximize sua aprovação.',
  keywords: [
    'concurso público',
    'repetição espaçada',
    'SRS',
    'FSRS',
    'questões',
    'simulado',
    'flashcards',
    'memorização',
    'FGV',
    'CESPE',
    'Cebraspe',
  ],
  openGraph: {
    title: 'Estudo Simples — repetição espaçada para concursos',
    description:
      'Repetição espaçada inteligente. Banco unificado pra qualquer banca. Active recall, simulados, calibração metacognitiva. Comece grátis.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Estudo Simples',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Estudo Simples — repetição espaçada para concursos',
    description:
      'Repetição espaçada inteligente. Banco unificado pra qualquer banca. Comece grátis.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Estudo Simples',
  description:
    'App de repetição espaçada (SRS) para concursos públicos. SM-2 e FSRS, simulados, banco unificado.',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  inLanguage: 'pt-BR',
  offers: [
    {
      '@type': 'Offer',
      name: 'Grátis',
      price: '0',
      priceCurrency: 'BRL',
      description: 'Até 500 questões pessoais e 1 concurso ativo.',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '19.90',
      priceCurrency: 'BRL',
      priceValidUntil: '2026-12-31',
      description: 'Plano completo: questões e concursos ilimitados, imagens, mnemônicos, predição de nota.',
    },
  ],
};

export default function Home() {
  return (
    <>
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- payload server-side controlado, sem PII
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <main
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '40px 20px 80px',
      }}
    >
      {/* Hero */}
      <section
        style={{
          textAlign: 'center',
          padding: '40px 0 20px',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2rem, 6vw, 3.4rem)',
            margin: '0 0 18px',
            lineHeight: 1.1,
          }}
        >
          Estude com inteligência. <br />
          <span style={{ color: 'var(--primary)' }}>
            Aprove no concurso.
          </span>
        </h1>
        <p
          style={{
            fontSize: '1.1rem',
            color: 'var(--muted)',
            maxWidth: 640,
            margin: '0 auto 28px',
            lineHeight: 1.5,
          }}
        >
          Repetição espaçada (SM-2 e FSRS), banco unificado pra qualquer banca,
          simulados, calibração metacognitiva. O essencial pra estudar menos e
          aprender mais — sem distração.
        </p>
        <div
          className="row gap"
          style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}
        >
          <Link href="/login">
            <button
              type="button"
              className="primary"
              style={{ padding: '14px 28px', fontSize: '1rem' }}
            >
              Começar grátis
            </button>
          </Link>
          <Link href="/planos">
            <button
              type="button"
              style={{ padding: '14px 28px', fontSize: '1rem' }}
            >
              Ver planos
            </button>
          </Link>
        </div>
        <p
          className="muted"
          style={{ fontSize: '0.85rem', marginTop: 14 }}
        >
          Ou{' '}
          <Link href="/login" style={{ color: 'var(--primary)' }}>
            entre como visitante
          </Link>{' '}
          (sem cadastro) pra testar.
        </p>
      </section>

      {/* Features */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 18,
          margin: '40px 0',
        }}
      >
        <FeatureCard
          icon="🧠"
          title="Repetição espaçada"
          desc="Algoritmos SM-2 e FSRS-6 calculam exatamente quando revisar cada questão pra fixar na memória de longo prazo. Tempo gasto = aprendizado real."
        />
        <FeatureCard
          icon="🎯"
          title="Active recall"
          desc="Modo opcional que esconde alternativas até você revelar — força lembrar antes de ver opções. Memorização cientificamente comprovada."
        />
        <FeatureCard
          icon="📚"
          title="Banco flexível"
          desc="Importa JSON de qualquer banca (FGV, CESPE, FCC, etc.) ou QConcursos. Cloze e flashcards no mesmo lugar das objetivas."
        />
        <FeatureCard
          icon="📊"
          title="Estatísticas reais"
          desc="Acerto por disciplina, tag, dia da semana, hora. Calibração metacognitiva, predição de nota por concurso, heatmap de 90 dias."
        />
        <FeatureCard
          icon="📅"
          title="Foco em aprovação"
          desc="Conte com data da prova. App ajusta recomendações: 30 dias antes vs 7 dias antes vs 1 dia antes — guia diferente em cada janela."
        />
        <FeatureCard
          icon="📱"
          title="Mobile + offline"
          desc="Funciona offline (IndexedDB) e sincroniza quando online. Bottom navbar polegar-friendly. Sem distração."
        />
      </section>

      {/* Pricing teaser */}
      <section
        style={{
          textAlign: 'center',
          background: 'var(--bg-elev-2)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          margin: '40px 0',
        }}
      >
        <h2 style={{ margin: '0 0 10px' }}>Planos simples</h2>
        <p
          className="muted"
          style={{ margin: '0 0 18px', maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}
        >
          Comece grátis. Faz upgrade quando precisar de mais. Sem amarras —
          cancela a qualquer momento.
        </p>
        <Link href="/planos">
          <button type="button" className="primary">
            Ver planos →
          </button>
        </Link>
      </section>

      {/* FAQ resumido */}
      <section style={{ margin: '40px 0' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 18 }}>Perguntas comuns</h2>
        <FaqItem
          q="Funciona offline?"
          a="Sim. As questões ficam no navegador (IndexedDB). Você pode estudar no metrô, avião, etc. Sincroniza automaticamente quando volta a ter conexão."
        />
        <FaqItem
          q="Posso importar do QConcursos?"
          a="Sim. O wizard de import detecta automaticamente o formato e mapeia disciplinas via fuzzy match. Suporta JSON autoral também."
        />
        <FaqItem
          q="Qual a diferença pro Anki?"
          a="Foco específico em concursos brasileiros: integração com bancas, modo simulado completo, cards e objetivas no mesmo lugar, predição de nota por concurso, calibração metacognitiva."
        />
        <FaqItem
          q="Posso cancelar a qualquer momento?"
          a="Sim. Pelo Stripe Customer Portal — direto na app. Sem letras miúdas."
        />
        <FaqItem
          q="Meus dados ficam seguros?"
          a="Tudo trafega via HTTPS, autenticação Supabase, RLS no banco isola cada usuário. Pagamento via Stripe (não armazenamos dados de cartão). Você pode exportar tudo a qualquer momento (backup completo)."
        />
      </section>

    </main>
    <PublicFooter />
    </>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
        {desc}
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        marginBottom: 8,
      }}
    >
      <summary
        style={{
          fontWeight: 500,
          cursor: 'pointer',
          listStyle: 'none',
        }}
      >
        {q}
      </summary>
      <p style={{ margin: '8px 0 0', color: 'var(--muted)', lineHeight: 1.5 }}>
        {a}
      </p>
    </details>
  );
}
