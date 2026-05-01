import Link from 'next/link';
import { DisciplinasSection } from '@/components/DisciplinasSection';

export default function DisciplinasPage() {
  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Disciplinas</h1>
        <p className="muted" style={{ margin: 0 }}>
          Disciplinas são globais — uma vez criadas, podem ser vinculadas a
          qualquer concurso (com peso e qtd de questões diferentes em cada).
          Aqui você gerencia a lista geral.
        </p>
      </div>

      <DisciplinasSection />

      <div className="card">
        <Link href="/concursos" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          ← Voltar para concursos
        </Link>
      </div>
    </>
  );
}
