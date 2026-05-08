import Link from 'next/link';
import { DisciplinasSection } from '@/components/DisciplinasSection';
import { DisciplinaMergeSuggestions } from '@/components/DisciplinaMergeSuggestions';
import { GuestNotice } from '@/components/GuestNotice';

export default function DisciplinasPage() {
  return (
    <>
      <GuestNotice feature="Editar metadata de disciplinas" />
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Disciplinas</h1>
        <p className="muted" style={{ margin: 0 }}>
          Detectadas automaticamente das questões importadas. Você só
          edita metadata visual (cor, peso default) — não cria nem
          exclui aqui. Pra remover uma disciplina, exclua as questões
          que apontam pra ela em <code>/banco</code>.
        </p>
      </div>

      <DisciplinaMergeSuggestions />

      <DisciplinasSection />

      <div className="card">
        <Link href="/concursos" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          ← Voltar para concursos
        </Link>
      </div>
    </>
  );
}
