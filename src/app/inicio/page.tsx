import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicHeader } from '@/components/PublicHeader';
import { NewsletterForm } from '@/components/NewsletterForm';

// dynamic: RootLayout depende de cookies (Topbar) — força-static
// fazia o build prerenderizar sem cookies, quebrando shell autenticado.
export const dynamic = 'force-dynamic';
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
      description: 'Até 200 questões pessoais e 1 concurso ativo.',
    },
    {
      '@type': 'Offer',
      name: 'Estudante',
      price: '9.90',
      priceCurrency: 'BRL',
      priceValidUntil: '2026-12-31',
      description: '2.000 questões, 3 concursos, predição de nota, calibração metacognitiva, export CSV.',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '19.90',
      priceCurrency: 'BRL',
      priceValidUntil: '2026-12-31',
      description: 'Tudo ilimitado, imagens, mnemônicos, suporte prioritário, acesso antecipado.',
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
    <PublicHeader />
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
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            background: 'var(--primary-soft)',
            color: 'var(--primary)',
            borderRadius: 999,
            fontSize: '0.82rem',
            fontWeight: 500,
            marginBottom: 18,
          }}
        >
          🎁 14 dias grátis · sem cartão pra começar
        </div>
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
            fontSize: '1.15rem',
            color: 'var(--muted)',
            maxWidth: 680,
            margin: '0 auto 28px',
            lineHeight: 1.5,
          }}
        >
          Repetição espaçada que decide pra você o que revisar e quando.
          Importe questões de FGV, Cebraspe, FCC ou crie suas próprias.
          Simulados, métricas e foco no que realmente importa: <strong>passar</strong>.
        </p>
        <div
          className="row gap"
          style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}
        >
          <Link href="/signup">
            <button
              type="button"
              className="primary"
              style={{ padding: '14px 28px', fontSize: '1rem' }}
            >
              Começar grátis →
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
          Sem cartão · cancela quando quiser · ou{' '}
          <Link href="/login" style={{ color: 'var(--primary)' }}>
            entre como visitante
          </Link>{' '}
          pra testar.
        </p>

        {/* Trust strip */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            flexWrap: 'wrap',
            marginTop: 30,
            fontSize: '0.82rem',
            color: 'var(--muted)',
          }}
        >
          <span>🔒 Pagamento Stripe (PCI-DSS)</span>
          <span>🇧🇷 LGPD compliant</span>
          <span>📱 Funciona offline</span>
          <span>♾ Backup completo a qualquer hora</span>
        </div>
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

      {/* Comparison table */}
      <section style={{ margin: '60px 0' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 8 }}>
          Onde nos posicionamos
        </h2>
        <p
          className="muted"
          style={{
            textAlign: 'center',
            marginBottom: 24,
            maxWidth: 600,
            margin: '0 auto 24px',
          }}
        >
          Resumo honesto. Cada ferramenta tem seu lugar — escolhe a que casa com
          seu fluxo.
        </p>
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
              fontSize: '0.88rem',
              minWidth: 640,
            }}
          >
            <CompareCell strong>Critério</CompareCell>
            <CompareCell strong center accent>
              Estudo Simples
            </CompareCell>
            <CompareCell strong center>
              Anki
            </CompareCell>
            <CompareCell strong center>
              QConcursos
            </CompareCell>

            <CompareRow label="Foco em concursos BR" us="✓" anki="—" qc="✓" />
            <CompareRow
              label="Repetição espaçada moderna (FSRS)"
              us="✓"
              anki="✓"
              qc="—"
            />
            <CompareRow label="Simulado com cronômetro" us="✓" anki="—" qc="✓" />
            <CompareRow
              label="Calibração metacognitiva"
              us="✓"
              anki="—"
              qc="—"
            />
            <CompareRow label="Predição de nota por concurso" us="✓" anki="—" qc="—" />
            <CompareRow label="Funciona offline" us="✓" anki="✓" qc="—" />
            <CompareRow
              label="Importa banca QConcursos"
              us="✓"
              anki="—"
              qc="(nativo)"
            />
            <CompareRow label="Mobile + sincronizado" us="✓" anki="✓ (pago)" qc="✓" />
            <CompareRow
              label="Preço inicial"
              us="Grátis · R$ 19,90/mês"
              anki="Grátis (PC) · iOS pago"
              qc="A partir de R$ 39"
            />
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section style={{ margin: '60px 0' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 8 }}>
          Quem está usando
        </h2>
        <p
          className="muted"
          style={{ textAlign: 'center', marginBottom: 24, fontSize: '0.92rem' }}
        >
          Estamos coletando os primeiros depoimentos. Aprovações chegando aos poucos.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          <Testimonial
            quote="Mudei do Anki pro Estudo Simples porque o foco em concursos brasileiros e a integração com bancas como FGV faz diferença real."
            author="Daniel C."
            role="Concurseiro · TI"
          />
          <Testimonial
            quote="O active recall + simulado integrado economizou muito tempo de troca de ferramenta. E a predição de nota me deu clareza do que faltava."
            author="Em breve"
            role="Aprovação 2026"
            placeholder
          />
          <Testimonial
            quote="Funcionar offline foi decisivo. Estudo no transporte público sem perder o ritmo."
            author="Em breve"
            role="Aprovação 2026"
            placeholder
          />
        </div>
      </section>

      {/* Pricing teaser */}
      <section
        style={{
          background: 'var(--bg-elev-2)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          margin: '40px 0',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <h2 style={{ margin: '0 0 10px' }}>3 planos, sem amarras</h2>
          <p
            className="muted"
            style={{
              margin: '0 auto',
              maxWidth: 540,
            }}
          >
            Comece grátis. Sobe pra Estudante (R$ 9,90) ou Pro (R$ 19,90)
            quando precisar de mais. <strong>14 dias de trial</strong> nos
            planos pagos sem cartão.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <PriceMini
            label="Grátis"
            price="R$ 0"
            sub="200 questões, 1 concurso"
          />
          <PriceMini
            label="🎓 Estudante"
            price="R$ 9,90"
            sub="2.000 questões, 3 concursos"
            unit="/mês"
          />
          <PriceMini
            label="✨ Pro"
            price="R$ 19,90"
            sub="Tudo ilimitado"
            unit="/mês"
            accent
          />
        </div>
        <div
          className="row gap"
          style={{ justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <Link href="/planos">
            <button type="button" className="primary">
              Ver detalhes dos planos →
            </button>
          </Link>
          <Link href="/signup">
            <button type="button">Começar grátis</button>
          </Link>
        </div>
      </section>

      {/* Newsletter */}
      <section
        style={{
          textAlign: 'center',
          margin: '40px 0',
          padding: 24,
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>
          Sem pressa pra criar conta?
        </h2>
        <p
          className="muted"
          style={{ margin: '0 0 14px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}
        >
          Deixe seu email e te avisamos das novidades — releases importantes,
          nada de spam. Sem cobrança.
        </p>
        <NewsletterForm source="landing-pre-faq" />
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

function CompareCell({
  children,
  strong,
  center,
  accent,
}: {
  children: React.ReactNode;
  strong?: boolean;
  center?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: strong
          ? 'var(--bg-elev-2)'
          : accent
            ? 'var(--primary-soft)'
            : undefined,
        borderBottom: '1px solid var(--border)',
        fontWeight: strong ? 600 : undefined,
        color: accent && strong ? 'var(--primary)' : undefined,
        textAlign: center ? 'center' : undefined,
      }}
    >
      {children}
    </div>
  );
}

function CompareRow({
  label,
  us,
  anki,
  qc,
}: {
  label: string;
  us: string;
  anki: string;
  qc: string;
}) {
  return (
    <>
      <CompareCell>{label}</CompareCell>
      <CompareCell center accent strong>
        {us}
      </CompareCell>
      <CompareCell center>{anki}</CompareCell>
      <CompareCell center>{qc}</CompareCell>
    </>
  );
}

function Testimonial({
  quote,
  author,
  role,
  placeholder,
}: {
  quote: string;
  author: string;
  role: string;
  placeholder?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        opacity: placeholder ? 0.5 : 1,
        background: placeholder ? 'transparent' : undefined,
        border: placeholder ? '1px dashed var(--border)' : undefined,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: 8 }}>
        💬
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.95rem', lineHeight: 1.5 }}>
        {placeholder ? <em>{quote}</em> : quote}
      </p>
      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{author}</div>
        <div className="muted" style={{ fontSize: '0.78rem' }}>
          {role}
        </div>
      </div>
    </div>
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

function PriceMini({
  label,
  price,
  unit,
  sub,
  accent,
}: {
  label: string;
  price: string;
  unit?: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? 'var(--primary-soft)' : 'var(--bg-elev)',
        border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 4,
        minHeight: 110,
        justifyContent: 'center',
      }}
    >
      <strong style={{ fontSize: '0.92rem' }}>{label}</strong>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 2,
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>{price}</span>
        {unit && (
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            {unit}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: '0.78rem',
          color: 'var(--muted)',
          lineHeight: 1.35,
        }}
      >
        {sub}
      </span>
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
