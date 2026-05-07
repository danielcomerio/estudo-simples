import { ImportSharedDeck } from '@/components/ImportSharedDeck';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Importar banco compartilhado — Estudo Simples',
};

export default function ImportSharedPage({
  params,
}: {
  params: { token: string };
}) {
  return <ImportSharedDeck token={params.token} />;
}
