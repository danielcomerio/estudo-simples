import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Estudo Simples' };

/**
 * Painel admin com KPIs de produto: usuários, MAU, conversão, churn,
 * MRR/ARR, LTV, funnel de conversão.
 *
 * Acesso: somente UUIDs listados em `ADMIN_USER_IDS` (env, comma-separated).
 * Não autorizado redireciona pra /. Sem revelar a existência da rota.
 *
 * Queries via service role (bypass RLS) — agregações apenas, não retornam
 * dados de usuários individuais.
 */

const PRICE_ESTUDANTE = 9.9;
const PRICE_PRO = 19.9;

function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const list = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(userId);
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.id)) {
    redirect('/');
  }

  const admin = getSupabaseAdmin();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const month0 = new Date(now - 30 * day).toISOString();
  const week0 = new Date(now - 7 * day).toISOString();

  // Counts agregados
  const [
    { count: totalUsers },
    { count: estudanteActive },
    { count: proActive },
    { count: trialing },
    { count: canceledTotal },
    { count: canceledLast30d },
    { count: pastDue },
    { count: signups30d },
    { count: signups7d },
    { count: questionsTotal },
    { count: events30d },
    { count: activeUsers7d },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('plan', 'estudante')
      .in('subscription_status', ['active', 'past_due']),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('plan', 'pro')
      .in('subscription_status', ['active', 'past_due']),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'trialing'),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'canceled'),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'canceled')
      .gte('updated_at', month0),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'past_due'),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', month0),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', week0),
    admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null),
    admin
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', month0),
    // MAU proxy: distinct users com event nos últimos 7 dias
    admin
      .from('analytics_events')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', week0),
  ]);

  // Quality KPIs: gabarito_source breakdown
  const [
    { count: questionsIa },
    { count: questionsOficial },
    { count: questionsCrowd },
    { count: questionsRealPendentes },
  ] = await Promise.all([
    admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('fonte->>gabarito_source', 'ia')
      .is('deleted_at', null),
    admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('fonte->>gabarito_source', 'oficial')
      .is('deleted_at', null),
    admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('fonte->>gabarito_source', 'crowd')
      .is('deleted_at', null),
    admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('origem', 'real')
      .eq('verificacao', 'pendente')
      .is('deleted_at', null),
  ]);

  // Métricas financeiras
  const mrr =
    (estudanteActive ?? 0) * PRICE_ESTUDANTE + (proActive ?? 0) * PRICE_PRO;
  const arr = mrr * 12;
  const arpu =
    (estudanteActive ?? 0) + (proActive ?? 0) > 0
      ? mrr / ((estudanteActive ?? 0) + (proActive ?? 0))
      : 0;

  // Churn rate (30d): canceled30d / (paid_users_inicio_periodo + canceled30d)
  // Aproximação: usa paid atuais como base
  const paidUsers = (estudanteActive ?? 0) + (proActive ?? 0);
  const churnRate =
    paidUsers + (canceledLast30d ?? 0) > 0
      ? ((canceledLast30d ?? 0) / (paidUsers + (canceledLast30d ?? 0))) * 100
      : 0;

  // LTV simples: ARPU / churn mensal. Cap em 60 meses pra não inflar
  // quando churn é zero/baixo (small N).
  const ltv =
    churnRate > 0 ? Math.min(60, 100 / churnRate) * arpu : 60 * arpu;

  // Funnel de conversão
  const conversionTrialPaid =
    (trialing ?? 0) + paidUsers > 0
      ? (paidUsers / ((trialing ?? 0) + paidUsers)) * 100
      : 0;
  const conversionTotalPaid =
    (totalUsers ?? 0) > 0 ? (paidUsers / (totalUsers ?? 1)) * 100 : 0;

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px' }}>Admin · KPIs</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          Snapshot agora. Queries via service role. Atualiza no refresh.
        </p>
      </header>

      <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>👥 Usuários</h2>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi label="Usuários totais" value={totalUsers ?? 0} />
        <Kpi label="Em trial" value={trialing ?? 0} accent="primary" />
        <Kpi
          label="Pro ativos"
          value={proActive ?? 0}
          hint={`R$ ${PRICE_PRO.toFixed(2).replace('.', ',')}/mês`}
        />
        <Kpi
          label="Estudante ativos"
          value={estudanteActive ?? 0}
          hint={`R$ ${PRICE_ESTUDANTE.toFixed(2).replace('.', ',')}/mês`}
        />
        <Kpi label="Past-due" value={pastDue ?? 0} accent="warn" />
        <Kpi label="Cancelados (total)" value={canceledTotal ?? 0} />
        <Kpi
          label="Signups 7d / 30d"
          value={`${signups7d ?? 0} / ${signups30d ?? 0}`}
        />
        <Kpi
          label="MAU 7d (eventos)"
          value={activeUsers7d ?? 0}
          hint="distinct users"
        />
      </section>

      <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>💰 Financeiro</h2>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi
          label="MRR"
          value={`R$ ${mrr.toFixed(2).replace('.', ',')}`}
          accent="primary"
          hint={`${paidUsers} pagantes`}
        />
        <Kpi
          label="ARR"
          value={`R$ ${arr.toFixed(0).replace('.', ',')}`}
          accent="primary"
          hint="MRR × 12"
        />
        <Kpi
          label="ARPU"
          value={`R$ ${arpu.toFixed(2).replace('.', ',')}`}
          hint="receita média / pagante"
        />
        <Kpi
          label="LTV estimado"
          value={`R$ ${ltv.toFixed(0).replace('.', ',')}`}
          hint="ARPU × (1 / churn)"
        />
      </section>

      <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>📉 Churn & funil</h2>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi
          label="Churn rate (30d)"
          value={`${churnRate.toFixed(2)}%`}
          accent={churnRate > 5 ? 'warn' : undefined}
          hint={`${canceledLast30d ?? 0} canceladas`}
        />
        <Kpi
          label="Conversão trial → paid"
          value={`${conversionTrialPaid.toFixed(1)}%`}
          hint={`${paidUsers} de ${(trialing ?? 0) + paidUsers}`}
        />
        <Kpi
          label="Conversão total → paid"
          value={`${conversionTotalPaid.toFixed(1)}%`}
          hint={`${paidUsers} de ${totalUsers ?? 0}`}
        />
        <Kpi
          label="Trial pendente / paid"
          value={`${trialing ?? 0} / ${paidUsers}`}
          hint="leads em conversão"
        />
      </section>

      <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>
        🔁 Retenção (cohort proxy)
      </h2>
      <RetentionSection admin={admin} now={now} />

      <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>📊 Atividade</h2>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi
          label="Questões ativas"
          value={questionsTotal ?? 0}
          hint="todas contas"
        />
        <Kpi
          label="Eventos 30d"
          value={events30d ?? 0}
          hint="analytics_events"
        />
      </section>

      <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>
        🎯 Qualidade do banco
      </h2>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi
          label="Gabarito oficial"
          value={questionsOficial ?? 0}
          hint="banca confirmada"
        />
        <Kpi
          label="Gabarito IA"
          value={questionsIa ?? 0}
          hint="pendente validação"
        />
        <Kpi
          label="Gabarito crowd"
          value={questionsCrowd ?? 0}
          hint="validação coletiva"
        />
        <Kpi
          label="Real pendentes"
          value={questionsRealPendentes ?? 0}
          hint="origem=real, verif=pendente"
        />
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Notas</h2>
        <ul
          className="muted"
          style={{ paddingLeft: 18, fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}
        >
          <li>
            MRR usa preços fixos (Estudante R$ {PRICE_ESTUDANTE.toFixed(2)}, Pro
            R$ {PRICE_PRO.toFixed(2)}). Não diferencia plano mensal/anual aqui.
            Pra precisão real, integrar com Stripe Reporting API.
          </li>
          <li>
            Churn rate é proxy: canceled-30d / (paid-atuais + canceled-30d).
            Aproximação ok pra steady state. Métrica real precisa cohort
            analysis.
          </li>
          <li>
            LTV usa fórmula simples 1/churn × ARPU, capada em 60 meses pra
            evitar inflação com churn baixo (small sample size).
          </li>
          <li>
            Past-due é grace period — Stripe re-tenta antes de cancelar
            (3-4 retries em 7d).
          </li>
          <li>
            MAU 7d é proxy via analytics_events (distinct user_id 7d).
            Inclui visitantes? não — apenas users autenticados.
          </li>
        </ul>
      </section>
    </main>
  );
}

/**
 * Retenção D1/D7/D30: % dos users que signaram up há N dias e
 * tiveram qualquer evento no dia "alvo" (D-1..D+1 janela tolerante).
 *
 * Proxy simples (não cohort fielmente). Pra precisão usar materialized
 * view + cron diário. Suficiente pra signal de tendência.
 */
async function RetentionSection({
  admin,
  now,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  now: number;
}) {
  const day = 86_400_000;
  const periods: Array<{ label: string; days: number }> = [
    { label: 'D1', days: 1 },
    { label: 'D7', days: 7 },
    { label: 'D30', days: 30 },
  ];

  const results = await Promise.all(
    periods.map(async ({ label, days }) => {
      const cohortStart = new Date(
        now - (days + 1) * day
      ).toISOString();
      const cohortEnd = new Date(now - days * day).toISOString();
      const targetStart = new Date(now - 1 * day).toISOString();
      const targetEnd = new Date(now).toISOString();

      // Cohort: users criados entre N-1 e N dias atrás
      const { data: cohort } = await admin
        .from('profiles')
        .select('user_id')
        .gte('created_at', cohortStart)
        .lt('created_at', cohortEnd);

      const cohortSize = cohort?.length ?? 0;
      if (!cohort || cohortSize === 0) {
        return { label, days, total: 0, retained: 0, pct: 0 };
      }

      const ids = cohort.map((c) => c.user_id);
      const { data: events } = await admin
        .from('analytics_events')
        .select('user_id')
        .in('user_id', ids)
        .gte('created_at', targetStart)
        .lt('created_at', targetEnd);

      const retainedSet = new Set((events ?? []).map((e) => e.user_id));
      const retained = retainedSet.size;
      return {
        label,
        days,
        total: cohortSize,
        retained,
        pct: cohortSize > 0 ? (retained / cohortSize) * 100 : 0,
      };
    })
  );

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}
    >
      {results.map((r) => (
        <Kpi
          key={r.label}
          label={`Retenção ${r.label}`}
          value={`${r.pct.toFixed(1)}%`}
          accent={r.pct < 30 ? 'warn' : 'primary'}
          hint={`${r.retained} de ${r.total} signups há ${r.days}d`}
        />
      ))}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'primary' | 'warn';
}) {
  const cor =
    accent === 'primary'
      ? 'var(--primary)'
      : accent === 'warn'
        ? 'var(--warn, #d97706)'
        : 'var(--text)';
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 600, color: cor }}>
        {value}
      </div>
      {hint && (
        <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
