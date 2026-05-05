import Link from 'next/link';
import { PlanosCheckout } from '@/components/PlanosCheckout';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-static';
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
          style={{ maxWidth: 520, margin: '0 auto', fontSize: '1rem' }}
        >
          Comece grátis (até 500 questões). Faça upgrade quando o banco crescer
          ou quiser features avançadas. Cancela a qualquer momento.
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 0,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            fontSize: '0.92rem',
          }}
        >
          <Cell strong>Feature</Cell>
          <Cell strong style={{ textAlign: 'center' }}>
            Grátis
          </Cell>
          <Cell strong style={{ textAlign: 'center' }}>
            Pro
          </Cell>

          <FeatureRow label="Questões personais" free="500" pro="Ilimitado" />
          <FeatureRow label="Concursos cadastrados" free="1" pro="Ilimitado" />
          <FeatureRow label="Repetição espaçada (SM-2)" free="✓" pro="✓" />
          <FeatureRow label="FSRS-6 (algoritmo moderno)" free="✓" pro="✓" />
          <FeatureRow label="Active recall" free="✓" pro="✓" />
          <FeatureRow label="Discursivas + autoavaliação" free="✓" pro="✓" />
          <FeatureRow label="Cloze + flashcards" free="✓" pro="✓" />
          <FeatureRow label="Simulado com cronômetro" free="✓" pro="✓" />
          <FeatureRow label="Estatísticas avançadas" free="Básico" pro="Completo" />
          <FeatureRow label="Predição de nota por concurso" free="—" pro="✓" />
          <FeatureRow label="Calibração metacognitiva" free="—" pro="✓" />
          <FeatureRow label="Export CSV" free="—" pro="✓" />
          <FeatureRow label="Backup completo" free="✓" pro="✓" />
          <FeatureRow label="Imagens em questões" free="—" pro="✓" />
          <FeatureRow label="Mnemônicos" free="—" pro="✓" />
          <FeatureRow label="Suporte prioritário" free="—" pro="✓" />
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

function FeatureRow({
  label,
  free,
  pro,
}: {
  label: string;
  free: string;
  pro: string;
}) {
  return (
    <>
      <Cell>{label}</Cell>
      <Cell style={{ textAlign: 'center', minWidth: 80 }}>{free}</Cell>
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
