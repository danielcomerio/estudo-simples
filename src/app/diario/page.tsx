import { DailyChallengeView } from '@/components/DailyChallengeView';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Questões do Dia — Estudo Simples',
  description:
    'Desafio diário comunitário: mesmo set pra todos, ranking competitivo.',
};

export default function DiarioPage() {
  return <DailyChallengeView />;
}
