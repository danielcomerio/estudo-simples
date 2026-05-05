import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-static';
export const metadata = {
  title: 'Contato — Estudo Simples',
  description: 'Canais de suporte do Estudo Simples.',
};

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contato@estudosimples.app';

export default function Contato() {
  return (
    <>
      <main
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '40px 20px 60px',
        }}
      >
        <header style={{ marginBottom: 30 }}>
          <h1 style={{ margin: '0 0 8px' }}>Contato</h1>
          <p className="muted" style={{ margin: 0 }}>
            Dúvidas, bugs, pedidos LGPD, sugestões — todos os canais abaixo.
          </p>
        </header>

        <Section
          icon="📧"
          title="E-mail geral"
          desc={
            <>
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              <br />
              <span className="muted">Resposta em até 3 dias úteis.</span>
            </>
          }
        />

        <Section
          icon="🐛"
          title="Reportar bug"
          desc={
            <>
              Antes de reportar, tente: limpar localStorage no console (
              <code>localStorage.clear()</code> + F5) ou recarregar todo o cache em{' '}
              <Link href="/configuracoes">/configuracoes</Link>.
              <br />
              <br />
              Se persistir, envie pra{' '}
              <a
                href={`mailto:${contactEmail}?subject=%5BBUG%5D%20`}
              >
                {contactEmail}
              </a>{' '}
              com prefixo <code>[BUG]</code> no assunto. Inclua: navegador,
              passos pra reproduzir, e qualquer mensagem de erro do console
              (F12).
            </>
          }
        />

        <Section
          icon="🔒"
          title="Pedidos LGPD"
          desc={
            <>
              Para acessar, corrigir, exportar ou excluir seus dados conforme
              LGPD art. 18, escreva pra{' '}
              <a
                href={`mailto:${contactEmail}?subject=%5BLGPD%5D%20`}
              >
                {contactEmail}
              </a>{' '}
              com prefixo <code>[LGPD]</code>. Resposta em até 15 dias úteis.
              <br />
              <br />
              Para excluir conta diretamente, use o botão "🗑 Excluir minha conta"
              em <Link href="/configuracoes">/configuracoes</Link>.
            </>
          }
        />

        <Section
          icon="💳"
          title="Faturamento e cobrança"
          desc={
            <>
              Cancelar assinatura, atualizar cartão, baixar fatura: use o
              <strong> Customer Portal</strong> direto pelo botão "⚙ Gerenciar
              assinatura" em{' '}
              <Link href="/configuracoes">/configuracoes</Link>.
              <br />
              <br />
              Disputas de cobrança ou solicitação de reembolso (até 7 dias após
              primeira cobrança):{' '}
              <a
                href={`mailto:${contactEmail}?subject=%5BBILLING%5D%20`}
              >
                {contactEmail}
              </a>{' '}
              com prefixo <code>[BILLING]</code>.
            </>
          }
        />

        <Section
          icon="💡"
          title="Sugestões e feedback"
          desc={
            <>
              Tudo é bem-vindo. Recursos pedidos, ajustes de UX, ideias.
              <br />
              <a
                href={`mailto:${contactEmail}?subject=%5BFEEDBACK%5D%20`}
              >
                {contactEmail}
              </a>{' '}
              com prefixo <code>[FEEDBACK]</code>.
            </>
          }
        />

        <p
          className="muted"
          style={{ marginTop: 32, fontSize: '0.85rem', textAlign: 'center' }}
        >
          <Link href="/manual" style={{ color: 'var(--muted)' }}>
            Manual
          </Link>{' '}
          ·{' '}
          <Link href="/privacidade" style={{ color: 'var(--muted)' }}>
            Privacidade
          </Link>{' '}
          ·{' '}
          <Link href="/termos" style={{ color: 'var(--muted)' }}>
            Termos
          </Link>
        </p>
      </main>
      <PublicFooter />
    </>
  );
}

function Section({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        marginBottom: 14,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>{title}</h3>
        <div style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}
