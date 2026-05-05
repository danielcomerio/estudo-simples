import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Estudo Simples' };

/**
 * Painel admin com KPIs de produto: usuários, MAU, conversão, churn, MRR.
 *
 * Acesso: somente UUIDs listados em `ADMIN_USER_IDS` (env, comma-separated).
 * Não autorizado redireciona pra /. Sem revelar a existência da rota — pra
 * curioso comum aparece como 404 (redirect = visualização equivalente).
 *
 * Queries via service role (bypass RLS) — são agregações, não retornam
 * dados de usuários individuais.
 */

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
  const month0 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Counts
  const [
    { count: totalUsers },
    { count: proActive },
    { count: trialing },
    { count: canceled },
    { count: pastDue },
    { count: signups30d },
    { count: questionsTotal },
    { count: events30d },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
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
      .eq('subscription_status', 'past_due'),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', month0),
    admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null),
    admin
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', month0),
  ]);

  // MRR estimado: pro_active × 19.90 (não diferencia mensal/anual aqui)
  const mrr = (proActive ?? 0) * 19.9;
  const arr = mrr * 12;
  const conversion =
    totalUsers && totalUsers > 0
      ? (((proActive ?? 0) + (trialing ?? 0)) / totalUsers) * 100
      : 0;

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px' }}>Admin · KPIs</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          Snapshot agora. Queries via service role.
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi label="Usuários totais" value={totalUsers ?? 0} />
        <Kpi
          label="Pro ativos"
          value={proActive ?? 0}
          hint={
            totalUsers
              ? `${Math.round(((proActive ?? 0) / totalUsers) * 100)}% do total`
              : undefined
          }
        />
        <Kpi label="Em trial" value={trialing ?? 0} accent="primary" />
        <Kpi label="Cancelados" value={canceled ?? 0} />
        <Kpi label="Past-due (cobrança falhou)" value={pastDue ?? 0} accent="warn" />
        <Kpi label="Signups últimos 30d" value={signups30d ?? 0} />
        <Kpi label="Questões ativas (todas contas)" value={questionsTotal ?? 0} />
        <Kpi label="Eventos analytics 30d" value={events30d ?? 0} />
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi
          label="MRR estimado"
          value={`R$ ${mrr.toFixed(2).replace('.', ',')}`}
          accent="primary"
          hint="× 19,90 simplificado"
        />
        <Kpi
          label="ARR estimado"
          value={`R$ ${arr.toFixed(0).replace('.', ',')}`}
          accent="primary"
        />
        <Kpi
          label="Conversão (pro+trial)"
          value={`${conversion.toFixed(1)}%`}
          hint="dos usuários totais"
        />
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Notas</h2>
        <ul
          className="muted"
          style={{ paddingLeft: 18, fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}
        >
          <li>
            MRR/ARR usam preço simplificado (R$ 19,90/mês). Pra precisão real,
            integrar com Stripe Reporting API.
          </li>
          <li>
            Past-due é grace period — Stripe re-tenta cobrar antes de cancelar.
          </li>
          <li>
            Conversão inclui trial (que ainda não converteu em pagamento).
          </li>
        </ul>
      </section>
    </main>
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
