/**
 * /admin/migrations — visualiza tabela applied_migrations.
 *
 * Não cruza com filesystem (servidor não tem fs sync confiável em
 * Vercel runtime). Pra cruzar, usar `npm run check:migrations` local
 * com SUPABASE_SERVICE_ROLE_KEY.
 *
 * Acesso: ADMIN_USER_IDS only.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Migrations · Admin' };

function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const list = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(userId);
}

export default async function AdminMigrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.id)) redirect('/');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('applied_migrations')
    .select('id, applied_at, notes')
    .order('id');

  if (error) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
        <h1>Migrations</h1>
        <p style={{ color: 'red' }}>
          Erro: {error.message}. A tabela <code>applied_migrations</code>{' '}
          existe? Aplique a migration 0025 primeiro.
        </p>
      </main>
    );
  }

  const items = data ?? [];

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 4px' }}>🗄 Migrations aplicadas</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          {items.length} migrations registradas em <code>applied_migrations</code>.
          Pra detectar pendentes vs disco, rode{' '}
          <code>npm run check:migrations</code> localmente.
        </p>
      </header>

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
              <th style={th}>ID</th>
              <th style={th}>Aplicada em</th>
              <th style={th}>Notas</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td
                  style={{
                    ...td,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}
                >
                  {m.id}
                </td>
                <td style={{ ...td, color: 'var(--muted)' }}>
                  {new Date(m.applied_at).toLocaleString('pt-BR')}
                </td>
                <td style={{ ...td, color: 'var(--muted)', fontSize: '0.78rem' }}>
                  {m.notes ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
