/**
 * /admin/errors — Sentry-lite dashboard pra agregação de erros.
 *
 * Lista os top errors dos últimos 7 dias agrupados por message+path,
 * com contagem e last seen. Use pra detectar regressões pós-deploy.
 *
 * Acesso: ADMIN_USER_IDS only (mesma proteção de /admin).
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Errors · Admin' };

function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const list = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(userId);
}

type Group = {
  message: string;
  path: string;
  count: number;
  last_at: string;
};

export default async function AdminErrorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.id)) redirect('/');

  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await admin
    .from('analytics_events')
    .select('props, created_at')
    .eq('event', 'client.error')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
        <h1>Errors</h1>
        <p style={{ color: 'red' }}>Erro: {error.message}</p>
      </main>
    );
  }

  // Agrupa por message+path
  const groups = new Map<string, Group>();
  for (const ev of events ?? []) {
    const props = (ev.props ?? {}) as {
      message?: string;
      path?: string;
    };
    const message = (props.message ?? 'unknown').slice(0, 200);
    const path = props.path ?? '/';
    const key = `${message}__${path}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      if (ev.created_at > existing.last_at) existing.last_at = ev.created_at;
    } else {
      groups.set(key, {
        message,
        path,
        count: 1,
        last_at: ev.created_at,
      });
    }
  }

  const top = Array.from(groups.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 4px' }}>🐛 Errors (7d)</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          Top {top.length} grupos · {events?.length ?? 0} eventos no período
          (sample 10%).
        </p>
      </header>

      {top.length === 0 ? (
        <div className="card">
          <p className="muted">Nenhum erro nos últimos 7 dias 🎉</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.88rem',
            }}
          >
            <thead>
              <tr style={{ background: 'var(--bg-elev-2)' }}>
                <th style={th}>Count</th>
                <th style={th}>Message</th>
                <th style={th}>Path</th>
                <th style={th}>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {top.map((g) => (
                <tr key={`${g.message}__${g.path}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{g.count}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {g.message}
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace', color: 'var(--muted)' }}>
                    {g.path}
                  </td>
                  <td style={{ ...td, color: 'var(--muted)', fontSize: '0.78rem' }}>
                    {new Date(g.last_at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '0.82rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const td: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
};
