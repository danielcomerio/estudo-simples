import { HojeView } from '@/components/HojeView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Hoje',
  description: 'Tudo o que importa agora — vencidas, briefing, próximos passos.',
};

export default function HojePage() {
  return <HojeView />;
}
