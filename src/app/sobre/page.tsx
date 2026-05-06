import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';

export const dynamic = 'force-static';
export const metadata = {
  title: 'Sobre — Estudo Simples',
  description:
    'Por que o Estudo Simples existe. Princípios, valores e como funciona por dentro.',
  openGraph: {
    title: 'Sobre — Estudo Simples',
    description:
      'Construído por concurseiro, pra concurseiros. Repetição espaçada baseada em ciência.',
    type: 'article',
    locale: 'pt_BR',
  },
};

export default function Sobre() {
  return (
    <>
      <main
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '40px 20px 60px',
          lineHeight: 1.6,
        }}
      >
        <header style={{ marginBottom: 30 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
            Por que o Estudo Simples existe
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '1.05rem' }}>
            Spoiler: porque concurso público dói diferente.
          </p>
        </header>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{ marginBottom: 10 }}>O problema</h2>
          <p>
            Quem estuda pra concurso enfrenta o mesmo dilema: <strong>volume gigante de
            conteúdo</strong>, <strong>tempo limitado</strong>, e a memória esquecendo
            mais rápido do que a gente repõe.
          </p>
          <p>
            O Anki é poderoso mas não foi feito pra concursos brasileiros — sem
            integração com bancas, sem simulado, sem predição de nota. Sites de
            questões têm bons bancos mas treinamento mecânico, sem repetição
            espaçada inteligente. Acabamos misturando 3-4 ferramentas, perdendo
            tempo e foco.
          </p>
          <p>
            <strong>Faltava uma ferramenta única, focada, brasileira.</strong>
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{ marginBottom: 10 }}>O que a gente faz diferente</h2>
          <ul style={{ paddingLeft: 20 }}>
            <li>
              <strong>Foco específico em concursos</strong>: integração com bancas
              (FGV, Cebraspe, FCC, etc.), predição de nota por concurso, perfil
              de prova com data, contagem regressiva e recomendações ajustadas.
            </li>
            <li>
              <strong>Algoritmos modernos</strong>: SM-2 (clássico, previsível) e
              FSRS-6 (otimizado por ML, mais eficiente). Você escolhe.
            </li>
            <li>
              <strong>Tudo no mesmo lugar</strong>: objetivas, discursivas, cloze,
              flashcards, simulado. Sem trocar de ferramenta no meio do dia.
            </li>
            <li>
              <strong>Funciona offline</strong>: estuda no metrô, no avião, na
              fila do banco. Sincroniza quando volta a ter rede.
            </li>
            <li>
              <strong>Sem distração</strong>: zero notificações abusivas, zero
              "engagement hacks". Só o que ajuda você a aprender.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{ marginBottom: 10 }}>Princípios</h2>
          <Principle
            title="1. Ciência cognitiva, não palpite"
            desc={
              <>
                Active recall, spaced repetition, interleaving, self-explanation —
                tudo aplicado conforme literatura (Roediger, Bjork, Karpicke).
                Cada feature tem razão de ser.
              </>
            }
          />
          <Principle
            title="2. Sua memória, seus dados"
            desc={
              <>
                Você baixa um backup completo a qualquer hora. Cancela e leva
                tudo embora num JSON. Sem vendor lock-in. Privacidade LGPD-first
                — não vendemos, não compartilhamos.
              </>
            }
          />
          <Principle
            title="3. Foco no que importa"
            desc={
              <>
                Aprovação. Não estamos aqui pra te entreter ou te viciar. Você
                paga (ou não) pelo que economiza tempo de estudo. Se não ajudar,
                cancela em 1 clique.
              </>
            }
          />
          <Principle
            title="4. Open spirit, dependências mínimas"
            desc={
              <>
                Stack simples (Next + Supabase + Stripe), sem CMS pesado, sem
                bibliotecas que vão sumir em 2 anos. Backup self-hostable
                facilitado se um dia quiser sair.
              </>
            }
          />
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{ marginBottom: 10 }}>Como sustentar</h2>
          <p>
            Plano grátis com 500 questões pessoais cobre quem quer testar e quem
            tem demanda pequena. Plano Pro (R$ 19,90/mês) sustenta a
            infraestrutura (Supabase, Vercel, Stripe) e o desenvolvimento
            contínuo. Sem investidor, sem pressão de hipergrowth — produto a longo
            prazo, no ritmo que faz sentido.
          </p>
          <p>
            Se você é concurseiro e o app te ajuda, considera virar Pro. É a
            forma mais direta de garantir que ele continue evoluindo.
          </p>
        </section>

        <section
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: '0 0 8px' }}>Bora começar?</h3>
          <p
            className="muted"
            style={{ margin: '0 0 14px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}
          >
            14 dias de Pro grátis pra testar tudo. Sem cartão. Cancela quando quiser.
          </p>
          <div className="row gap" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup">
              <button type="button" className="primary">
                Criar conta grátis
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

function Principle({ title, desc }: { title: string; desc: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem' }}>
        {desc}
      </p>
    </div>
  );
}
