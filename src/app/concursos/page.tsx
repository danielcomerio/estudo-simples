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
        <h2 style={{ margin: '0 0 8px' }}>Gerenciamento avançado</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Disciplinas e tópicos existem independentes dos concursos — uma
          disciplina pode ser usada em vários concursos. Use as páginas
          dedicadas pra gerenciar listas globais.
        </p>
        <div className="row gap wrap">
          <Link href="/disciplinas" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            Gerenciar disciplinas →
          </Link>
          <Link href="/topicos" className="ghost" style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            Gerenciar tópicos →
          </Link>
        </div>
      </div>
    </>
  );
}
