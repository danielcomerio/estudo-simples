import { FreeRecallView } from '@/components/FreeRecallView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Free recall',
  description: 'Escreva tudo que você sabe — IA avalia cobertura.',
};

export default function FreeRecallPage() {
  return <FreeRecallView />;
}
