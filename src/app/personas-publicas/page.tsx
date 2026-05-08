import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PublicPersonasMarketplace } from '@/components/PublicPersonasMarketplace';

export const metadata = { title: 'Personas públicas · Estudo Simples' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <PublicPersonasMarketplace />;
}
