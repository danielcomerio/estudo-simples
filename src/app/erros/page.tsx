import { ErrosView } from '@/components/ErrosView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inimigas',
  description: 'Questões com baixa taxa de acerto e padrões de erro.',
};

export default function ErrosPage() {
  return <ErrosView />;
}
