import { AchievementsView } from '@/components/AchievementsView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Conquistas',
  description: 'Suas badges e conquistas no app.',
};

export default function AchievementsPage() {
  return <AchievementsView />;
}
