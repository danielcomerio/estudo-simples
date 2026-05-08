'use client';

import { useMemo, useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  useConcursos,
  useDisciplinas,
  useAllConcursoDisciplinas,
} from '@/lib/hierarchy';

/**
 * Card "Comparar concursos" no /concursos. User seleciona 2-3 concursos
 * e o app calcula:
 *  - Sobreposição de disciplinas (% comum)
 *  - Saúde individual (cobertura × domínio)
 *  - Recomendação: foco em qual primeiro?
 */
export function ConcursoComparisonCard() {
  const { data: concursos } = useConcursos();
  const { data: disciplinas } = useDisciplinas();
  const { data: cdLinks } = useAllConcursoDisciplinas();
  const questions = useStore(selectActiveQuestions);

  const [sel, setSel] = useState<string[]>([]);

  const ativos = (concursos ?? []).filter(
    (c) => !c.deleted_at && c.status === 'ativo'
  );

  const comparison = useMemo(() => {
    if (sel.length < 2) return null;
    type Block = {
      id: string;
      nome: string;
      discNomes: Set<string>;
      saude: number;
      pesoTotal: number;
    };
    const blocks: Block[] = [];
    for (const id of sel) {
      const c = ativos.find((x) => x.id === id);
      if (!c) continue;
      const links = (cdLinks ?? []).filter((l) => l.concurso_id === id);
      const discNomes = new Set<string>();
      let pesoTotal = 0;
      let pesoDom = 0;
      let coberturaCount = 0;
      for (const l of links) {
        const d = (disciplinas ?? []).find((x) => x.id === l.disciplina_id);
        if (!d) continue;
        discNomes.add(d.nome);
        pesoTotal += l.peso ?? 1;
        const qts = questions.filter((q) => q.disciplina_id === d.nome);
        if (qts.length >= 10) coberturaCount++;
        const tents = qts.reduce((a, q) => a + (q.stats?.attempts ?? 0), 0);
        const corrects = qts.reduce((a, q) => a + (q.stats?.correct ?? 0), 0);
        if (tents > 0) pesoDom += (corrects / tents) * (l.peso ?? 1);
      }
      const cobertura = links.length > 0 ? (coberturaCount / links.length) * 100 : 0;
      const dominio = pesoTotal > 0 ? (pesoDom / pesoTotal) * 100 : 0;
      const saude = Math.round(cobertura * 0.4 + dominio * 0.6);
      blocks.push({ id, nome: c.nome, discNomes, saude, pesoTotal });
    }

    // Sobreposição: interseção de disc nomes
    const allDiscs = new Set<string>();
    for (const b of blocks) for (const d of b.discNomes) allDiscs.add(d);
    const overlapMatrix: Record<string, Record<string, number>> = {};
    for (const a of blocks) {
      overlapMatrix[a.id] = {};
      for (const b of blocks) {
        if (a.id === b.id) continue;
        let inter = 0;
        for (const d of a.discNomes) if (b.discNomes.has(d)) inter++;
        const pct = a.discNomes.size > 0 ? Math.round((inter / a.discNomes.size) * 100) : 0;
        overlapMatrix[a.id][b.id] = pct;
      }
    }

    // Recomendação: maior saúde + maior peso = ataque primeiro
    const ranked = [...blocks].sort((x, y) => y.saude - x.saude);
    const recomendado = ranked[0];

    return { blocks, overlapMatrix, recomendado };
  }, [sel, ativos, cdLinks, disciplinas, questions]);

  if (ativos.length < 2) return null;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>
        ⚖️ Comparar concursos
      </h2>
      <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
        Selecione 2-3 concursos pra ver sobreposição de disciplinas + saúde
        relativa. Ajuda a decidir qual atacar primeiro.
      </p>
      <div className="row gap wrap" style={{ marginBottom: 12 }}>
        {ativos.map((c) => {
          const checked = sel.includes(c.id);
          return (
            <label
              key={c.id}
              style={{
                padding: '4px 10px',
                fontSize: '0.85rem',
                background: checked ? 'var(--primary)' : 'var(--bg-elev-2)',
                color: checked ? '#fff' : 'var(--text)',
                borderRadius: 999,
                cursor: 'pointer',
                border: '1px solid var(--border)',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  setSel((cur) => {
                    if (cur.includes(c.id)) return cur.filter((x) => x !== c.id);
                    if (cur.length >= 3) return cur;
                    return [...cur, c.id];
                  });
                }}
                style={{ marginRight: 4 }}
              />
              {c.nome}
            </label>
          );
        })}
      </div>

      {comparison && (
        <div>
          <table
            style={{
              width: '100%',
              fontSize: '0.85rem',
              borderCollapse: 'collapse',
              marginBottom: 10,
            }}
          >
            <thead>
              <tr>
                <th style={cellStyle}>Concurso</th>
                <th style={cellStyle}>Saúde</th>
                <th style={cellStyle}>Disc.</th>
                <th style={cellStyle}>Peso total</th>
              </tr>
            </thead>
            <tbody>
              {comparison.blocks.map((b) => (
                <tr key={b.id}>
                  <td style={cellStyle}>{b.nome}</td>
                  <td style={cellStyle}>
                    <strong>{b.saude}/100</strong>
                  </td>
                  <td style={cellStyle}>{b.discNomes.size}</td>
                  <td style={cellStyle}>{b.pesoTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ fontSize: '0.85rem' }}>
            <strong>Sobreposição de disciplinas:</strong>
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              {comparison.blocks.map((a) =>
                comparison.blocks
                  .filter((b) => b.id !== a.id)
                  .map((b) => (
                    <li key={`${a.id}-${b.id}`}>
                      {a.nome} → {b.nome}:{' '}
                      <strong>{comparison.overlapMatrix[a.id]?.[b.id] ?? 0}%</strong>{' '}
                      das disciplinas em comum
                    </li>
                  ))
              )}
            </ul>
          </div>

          <p
            style={{
              marginTop: 10,
              padding: 10,
              background: 'var(--primary-soft)',
              borderRadius: 'var(--radius)',
              fontSize: '0.9rem',
            }}
          >
            🎯 Recomendado priorizar: <strong>{comparison.recomendado.nome}</strong> (saúde{' '}
            {comparison.recomendado.saude}/100). Você está mais preparado pra
            ele agora; capitalize.
          </p>
        </div>
      )}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
};
