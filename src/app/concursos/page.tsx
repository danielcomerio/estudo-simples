import Link from 'next/link';
import { ConcursosSection } from '@/components/ConcursosSection';

export default function ConcursosPage() {
  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Concursos</h1>
        <p className="muted" style={{ margin: 0 }}>
          Cadastre cada concurso que está estudando, vincule as disciplinas
          que vão cair na prova (com peso e quantidade de questões esperadas)
          e selecione um como ativo no menu superior pra filtrar banco,
          estudo e estatísticas.
        </p>
      </div>

      <ConcursosSection />

      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Disciplinas</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Disciplinas são detectadas automaticamente das suas questões.
          Aqui você só edita metadata visual (cor, peso). Para vincular ao
          concurso, expanda o concurso acima.
        </p>
        <Link href="/disciplinas" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          Ver lista de disciplinas →
        </Link>
      </div>
    </>
  );
}
