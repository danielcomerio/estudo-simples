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
  description: 'Plano grátis ou Pro com tudo liberado. Cancele a qualquer momento.',
  openGraph: {
    title: 'Planos — Estudo Simples',
    description:
      'Grátis com 500 questões, ou Pro ilimitado a partir de R$ 19,90/mês. Cancela quando quiser.',
    type: 'website',
    locale: 'pt_BR',
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
