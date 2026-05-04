import Link from 'next/link';
import { AlgorithmSection } from '@/components/AlgorithmSection';
import { BackupSection } from '@/components/BackupSection';
import { ThemeSection } from '@/components/ThemeSection';
import { DailyGoalSection } from '@/components/DailyGoalSection';

export default function ConfiguracoesPage() {
  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Configurações</h1>
        <p className="muted" style={{ margin: 0 }}>
          Preferências da sua conta. Cadastros (concursos, disciplinas,
          tópicos) ficam em páginas dedicadas.
        </p>
      </div>

      <AlgorithmSection />

      <DailyGoalSection />

      <ThemeSection />

      <BackupSection />

      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Cadastros</h2>
        <div className="row gap wrap">
          <Link href="/concursos" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            Concursos →
          </Link>
          <Link href="/disciplinas" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            Disciplinas →
          </Link>
        </div>
      </div>
    </>
  );
}
