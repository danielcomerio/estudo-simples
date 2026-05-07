import { PublicDecksMarketplace } from '@/components/PublicDecksMarketplace';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Decks públicos — Estudo Simples',
  description:
    'Decks compartilhados pela comunidade. Importe pra sua conta.',
};

export default function DecksPublicosPage() {
  return <PublicDecksMarketplace />;
}
