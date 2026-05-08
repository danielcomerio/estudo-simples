import Link from 'next/link';
import { PlanosCheckout } from '@/components/PlanosCheckout';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicHeader } from '@/components/PublicHeader';

// 'force-dynamic' garante que o RootLayout (que depende de cookies pra
// renderizar Topbar/MobileBottomNav corretamente pra user logado) seja
// re-executado em cada request. Antes era 'force-static' — bug: user
// logado navegava pra cá via Link, RSC payload do build (sem cookies)
// suprimia Topbar, e ao voltar o cache do App Router preservava esse
// estado quebrado até refresh.
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Planos — Estudo Simples',
  description:
    'Grátis com 200 questões, Estudante R$ 9,90/mês ou Pro ilimitado R$ 19,90/mês. Trial 14 dias sem cartão.',
  openGraph: {
    title: 'Planos — Estudo Simples',
    description:
      'Grátis com 200 questões, Estudante R$ 9,90 ou Pro ilimitado R$ 19,90. Trial 14 dias sem cartão.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Estudo Simples',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Planos — Estudo Simples',
    description:
      'Grátis com 200 questões, Estudante R$ 9,90 ou Pro ilimitado R$ 19,90. Trial 14 dias sem cartão.',
  },
  alternates: {
    canonical: '/planos',
  },
};

export default function Planos() {
  return (
    <>
    <PublicHeader />
    <main
      style={{
        maxWidth: 1000,
        margin: '0 auto',
        padding: '40px 20px 80px',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            margin: '0 0 10px',
          }}
        >
          Planos
        </h1>
        <p
          className="muted"
          style={{ maxWidth: 540, margin: '0 auto', fontSize: '1rem' }}
        >
          Comece grátis (até 200 questões). Estudante a R$ 9,90 ou Pro
          ilimitado a R$ 19,90 — ambos com <strong>14 dias de trial</strong> e
          sem cartão pra testar.
        </p>
      </header>

      <PlanosCheckout />

      <section
        style={{
          marginTop: 28,
          padding: 16,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-elev-1)',
        }}
      >
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>
          💸 Anual e parcelamento
        </h2>
        <p className="muted" style={{ fontSize: '0.92rem', marginBottom: 8 }}>
          Pagando 12 meses adiantado:
        </p>
        <ul style={{ fontSize: '0.92rem', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>
            <strong>🎓 Estudante anual</strong> — R$ 99,00/ano (≈ R$ 8,25/mês,
            17% off vs mensal). Pode parcelar em até 12× R$ 8,25 sem juros.
          </li>
          <li>
            <strong>✨ Pro anual</strong> — R$ 199,00/ano (≈ R$ 16,58/mês, 17% off
            vs mensal). Pode parcelar em até 12× R$ 16,58 sem juros.
          </li>
        </ul>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 8 }}>
          Parcelamento processado pelo Stripe; cartões nacionais só.
          Cancele a qualquer momento — você mantém acesso até o fim do ciclo.
        </p>
      </section>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>
          📊 Vale a pena? (calculadora simples)
        </h2>
        <p style={{ fontSize: '0.92rem', lineHeight: 1.55 }}>
          Concurseiros médios passam <strong>2-4 anos</strong> estudando antes de
          aprovação. Em 24 meses:
        </p>
        <ul style={{ fontSize: '0.9rem', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>
            Pro mensal: 24 × R$ 19,90 = <strong>R$ 477,60</strong>
          </li>
          <li>
            Pro anual (2 anos): 2 × R$ 199 ={' '}
            <strong>R$ 398,00 (economia R$ 79,60)</strong>
          </li>
          <li>
            Cursinho presencial top:{' '}
            <strong className="muted">R$ 3.000 a R$ 6.000/ano</strong>
          </li>
        </ul>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 6 }}>
          O ROI é a aprovação. Salário inicial de Auditor Federal ≈ R$ 21k/mês —
          o app inteiro custa menos que 1% disso.
        </p>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2
          style={{
            fontSize: '1.15rem',
            marginBottom: 14,
            textAlign: 'center',
          }}
        >
          Comparativo de features
        </h2>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr auto auto auto',
            gap: 0,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            fontSize: '0.9rem',
            minWidth: 480,
          }}
        >
          <Cell strong>Feature</Cell>
          <Cell strong style={{ textAlign: 'center' }}>
            Grátis
          </Cell>
          <Cell strong style={{ textAlign: 'center' }}>
            🎓 Estudante
          </Cell>
          <Cell strong style={{ textAlign: 'center' }}>
            ✨ Pro
          </Cell>

          <Row3 label="Questões pessoais" free="200" est="2.000" pro="Ilimitado" />
          <Row3 label="Concursos ativos" free="1" est="3" pro="Ilimitado" />
          <Row3 label="SRS (SM-2 + FSRS-6)" free="✓" est="✓" pro="✓" />
          <Row3 label="Active recall" free="✓" est="✓" pro="✓" />
          <Row3 label="Discursivas + autoavaliação" free="✓" est="✓" pro="✓" />
          <Row3 label="Cloze + flashcards" free="✓" est="✓" pro="✓" />
          <Row3 label="Simulado com cronômetro" free="✓" est="✓" pro="✓" />
          <Row3 label="Estatísticas básicas" free="✓" est="✓" pro="✓" />
          <Row3 label="Predição de nota por concurso" free="—" est="✓" pro="✓" />
          <Row3 label="Calibração metacognitiva" free="—" est="✓" pro="✓" />
          <Row3 label="Export CSV" free="—" est="✓" pro="✓" />
          <Row3 label="Backup completo" free="✓" est="✓" pro="✓" />
          <Row3 label="Imagens em questões" free="—" est="—" pro="✓" />
          <Row3 label="Mnemônicos / dicas" free="—" est="—" pro="✓" />
          <Row3 label="Compartilhar bancos com colegas" free="—" est="—" pro="✓" />
          <Row3 label="Suporte prioritário" free="—" est="—" pro="✓" />
          <Row3 label="Acesso antecipado a novidades" free="—" est="—" pro="✓" />
        </div>
        </div>
      </section>

      <p
        className="muted"
        style={{
          textAlign: 'center',
          marginTop: 30,
          fontSize: '0.85rem',
          lineHeight: 1.6,
        }}
      >
        Pagamento processado com segurança pelo Stripe. <br />
        Não armazenamos dados de cartão.{' '}
        <Link href="/manual" style={{ color: 'var(--primary)' }}>
          Ver manual completo
        </Link>{' '}
        ·{' '}
        <Link href="/inicio" style={{ color: 'var(--primary)' }}>
          ← Voltar à página inicial
        </Link>
      </p>
    </main>
    <PublicFooter />
    </>
  );
}

function Cell({
  children,
  strong,
  style,
}: {
  children: React.ReactNode;
  strong?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: strong ? 'var(--bg-elev-2)' : undefined,
        borderBottom: '1px solid var(--border)',
        fontWeight: strong ? 600 : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Row3({
  label,
  free,
  est,
  pro,
}: {
  label: string;
  free: string;
  est: string;
  pro: string;
}) {
  return (
    <>
      <Cell>{label}</Cell>
      <Cell
        style={{
          textAlign: 'center',
          minWidth: 70,
          color: free === '—' ? 'var(--muted)' : undefined,
        }}
      >
        {free}
      </Cell>
      <Cell
        style={{
          textAlign: 'center',
          minWidth: 80,
          color: est === '—' ? 'var(--muted)' : undefined,
        }}
      >
        {est}
      </Cell>
      <Cell
        style={{
          textAlign: 'center',
          minWidth: 80,
          color: pro === '—' ? 'var(--muted)' : 'var(--primary)',
          fontWeight: pro === '—' ? undefined : 600,
        }}
      >
        {pro}
      </Cell>
    </>
  );
}
