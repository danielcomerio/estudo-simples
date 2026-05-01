import Link from 'next/link';

export default function TopicosPage() {
  return (
    <div className="card">
      <h1 style={{ margin: '0 0 8px' }}>Tópicos</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Funcionalidade em revisão. Tópicos viam ser sub-divisões
        manuais de disciplinas (ex: Português → Concordância, Crase),
        mas o JSON importado não traz essa hierarquia. Está em
        avaliação se vão virar tags livres derivadas do campo{' '}
        <code>tema</code> ou se permanecem manuais.
      </p>
      <p className="muted">
        Por enquanto, organize as questões por <strong>disciplina</strong>{' '}
        e use o campo <code>tema</code> para sub-tópicos.
      </p>
      <Link
        href="/concursos"
        className="ghost"
        style={{
          padding: '6px 12px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}
      >
        ← Voltar para concursos
      </Link>
    </div>
  );
}
