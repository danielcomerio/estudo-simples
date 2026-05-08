import { RevisoesView } from '@/components/RevisoesView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Calendário de revisões',
  description: 'Quantas questões SRS vencem por dia nos próximos 30 dias.',
};

export default function RevisoesPage() {
  return <RevisoesView />;
}
