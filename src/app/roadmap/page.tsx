import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicHeader } from '@/components/PublicHeader';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Roadmap — Estudo Simples',
  description: 'O que estamos construindo. Transparente, vivo, baseado em feedback real.',
};

const SHIPPED = [
  'Repetição espaçada SM-2 + FSRS-6',
  'Suporte a objetivas, discursivas, cloze, flashcards',
  'Simulado com cronômetro e relatório completo',
  'Active recall (esconde alternativas) opt-in',
  'Predição de nota por concurso',
  'Calibração metacognitiva',
  'Heatmap de atividade 90 dias clicável',
  'Streak com freeze automático (1 dia/semana)',
  'Plano da semana + previsão 30 dias',
  'Modo "Revisão pré-prova" (mistura SRS + inimigas + recém-aprendidas)',
  'Mobile bottom nav + swipe gestures',
  'Vim-jump + global search (Ctrl+F)',
  'Backup completo + restore',
  'CSV export (questões + histórico)',
  'Trial 14 dias sem cartão',
  'LGPD compliant + account deletion',
];

const IN_PROGRESS = [
  'Coletar feedback de primeiros usuários',
  'Curadoria do banco de questões público',
  'Anki .apkg export/import',
];

const NEXT = [
  'Email de boas-vindas + reminders de estudo',
  'Pix anual à vista (Stripe BR recurring é só cartão hoje)',
  'Integração Telegram pra revisões diárias',
  'Modo "concurso x" — landing dedicada por banca/cargo',
  'OCR pra capturar questão por foto (Tesseract.js)',
  'Comparativo entre seus simulados ao longo do tempo',
  'Marketplace público de decks compartilhados',
  'Importação Quizlet',
];

const CONSIDERING = [
  'Live study rooms (estudo síncrono em grupo)',
  'Correção automatizada de discursivas via IA (opt-in, BYO key)',
  'Notion sync (export questões pra Notion DB)',
  'Plano "estudo grupo" (compartilhar progresso entre colegas)',
  'White-label pra cursinhos',
];

const RECENTLY_SHIPPED = [
  '✅ Sharing C2/C3 — snapshot links + live decks',
  '✅ Origem do gabarito (oficial/IA/crowd) com badge visual',
  '✅ AI Tutor BYO key (OpenAI/Anthropic/Gemini)',
  '✅ Mobile via Capacitor (config pronta)',
  '✅ Web Push notifications + cron diário',
  '✅ TTS leitura de enunciados (Web Speech API)',
  '✅ Concurso countdown global na Topbar',
  '✅ Conta Master (admin/dono permanente)',
  '✅ Tier Estudante (R$ 9,90/mês)',
];

const NOT_PLANNED = [
  'Notificações push agressivas',
  'Engagement hacks que viciam sem ajudar',
  'Anúncios',
  'Venda de dados (NUNCA)',
];

export default function Roadmap() {
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
        <header style={{ marginBottom: 30 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
            Roadmap
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            O que está pronto, em construção, próximo e considerando. Atualizado
            sempre que algo muda.
          </p>
        </header>

        <Section
          title="🆕 Lançado recentemente (2026-05)"
          color="var(--primary)"
          items={RECENTLY_SHIPPED}
          subtitle="Últimas features adicionadas."
        />

        <Section
          title="✅ Pronto (geral)"
          color="#22c55e"
          items={SHIPPED}
          subtitle="Já está no app, em produção."
        />

        <Section
          title="🛠 Em construção"
          color="var(--primary)"
          items={IN_PROGRESS}
          subtitle="Trabalhando agora."
        />

        <Section
          title="📋 Próximo"
          color="var(--warn, #d97706)"
          items={NEXT}
          subtitle="Planejado pros próximos meses, sem data fixa."
        />

        <Section
          title="🤔 Considerando"
          color="var(--muted)"
          items={CONSIDERING}
          subtitle="Ideias que avaliamos. Feedback altera prioridade."
        />

        <Section
          title="🚫 Não planejamos fazer"
          color="var(--danger, #ef4444)"
          items={NOT_PLANNED}
          subtitle="Princípios. Coisas que escolhemos NÃO ter."
        />

        <section
          style={{
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            textAlign: 'center',
            marginTop: 40,
          }}
        >
          <h3 style={{ margin: '0 0 8px' }}>
            Tem sugestão de feature?
          </h3>
          <p
            className="muted"
            style={{ margin: '0 0 12px', fontSize: '0.92rem' }}
          >
            Pedidos pesam mais quando vêm de usuários ativos. Manda pelo{' '}
            <Link href="/contato" style={{ color: 'var(--primary)' }}>
              canal de feedback
            </Link>
            .
          </p>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

function Section({
  title,
  color,
  items,
  subtitle,
}: {
  title: string;
  color: string;
  items: string[];
  subtitle: string;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          margin: '0 0 4px',
          fontSize: '1.1rem',
          color,
        }}
      >
        {title}
      </h2>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.85rem' }}>
        {subtitle}
      </p>
      <ul style={{ paddingLeft: 22, margin: 0, fontSize: '0.95rem' }}>
        {items.map((it) => (
          <li key={it} style={{ marginBottom: 4 }}>
            {it}
          </li>
        ))}
      </ul>
    </section>
  );
}
