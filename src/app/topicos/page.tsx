import Link from 'next/link';
import { TopicosSection } from '@/components/TopicosSection';

export default function TopicosPage() {
  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Tópicos</h1>
        <p className="muted" style={{ margin: 0 }}>
          Tópicos sub-dividem disciplinas pra estatística mais fina e
          filtros (ex: Português → Concordância, Crase, Regência). Quando
          você atribuir tópicos às questões, o /stats vai mostrar acerto
          por tópico em vez de só por disciplina.
        </p>
      </div>

      <TopicosSection />

      <div className="card">
        <Link href="/concursos" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          ← Voltar para concursos
        </Link>
      </div>
    </>
  );
}
