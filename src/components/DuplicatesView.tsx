'use client';

import { useState } from 'react';
import { deleteQuestionsBulk, selectActiveQuestions, useStore } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { findNearDuplicates, type DuplicatePair } from '@/lib/near-duplicates';
import type { ObjetivaPayload, DiscursivaPayload, Question } from '@/lib/types';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';
import { AIDuplicateRefineButton } from './AIDuplicateRefineButton';

/**
 * Página de detecção de quase-duplicatas: questões similares (Jaccard
 * >= threshold) na mesma disciplina que escaparam do dedup_hash exato.
 *
 * UX:
 *  - Slider de threshold (0.7 - 0.95)
 *  - Botão "Detectar" calcula sob demanda (custo O(N²) por disciplina)
 *  - Lista de pares com similaridade %; botão "Excluir esta" pra
 *    cada lado do par (você decide qual manter)
 *  - Filtra os já excluídos da lista após ação
 */
export function DuplicatesView() {
  const questions = useStore(selectActiveQuestions);
  const [threshold, setThreshold] = useState(0.8);
  const [pairs, setPairs] = useState<DuplicatePair[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const visiblePairs = pairs?.filter(
    (p) => !excluded.has(p.qa.id) && !excluded.has(p.qb.id)
  );

  const scan = () => {
    setScanning(true);
    setExcluded(new Set());
    // setTimeout 0 pra deixar o setState 'scanning' renderizar antes
    setTimeout(() => {
      try {
        const found = findNearDuplicates(questions, threshold);
        setPairs(found);
        toast(
          found.length === 0
            ? 'Nenhum par detectado nesse threshold.'
            : `${found.length} par(es) detectado(s).`,
          found.length === 0 ? '' : 'success'
        );
      } finally {
        setScanning(false);
      }
    }, 50);
  };

  const excluir = async (q: Question) => {
    const ok = await confirmDialog({
      title: 'Excluir questão',
      message: 'Esta ação remove a questão do banco. Continuar?',
      danger: true,
    });
    if (!ok) return;
    deleteQuestionsBulk([q.id]);
    setExcluded((cur) => new Set(cur).add(q.id));
    scheduleSync(500);
    toast('Questão excluída.', 'success');
  };

  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Quase-duplicatas</h1>
        <p className="muted" style={{ margin: 0 }}>
          Detecta questões com enunciado <strong>muito similar</strong>{' '}
          (mas não idêntico) dentro da mesma disciplina. Útil pra
          encontrar duplicatas que escaparam do dedup_hash do DB —
          ex: variantes com pontuação diferente, espaço extra, etc.
          Custo é O(N²) por disciplina — pode demorar 1-2s pra bancos
          grandes.
        </p>
      </div>

      <div className="card">
        <div className="row gap wrap" style={{ alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem' }}>
              Threshold: <strong>{threshold.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={0.7}
              max={0.95}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              disabled={scanning}
            />
          </label>
          <button
            type="button"
            className="primary"
            onClick={scan}
            disabled={scanning || questions.length === 0}
          >
            {scanning ? 'Calculando…' : 'Detectar similares'}
          </button>
          {pairs && pairs.length > 0 && (
            <AIDuplicateRefineButton
              pairs={pairs}
              onRefined={(filtered) => setPairs(filtered)}
            />
          )}
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            ({questions.length} questões no banco)
          </span>
        </div>
        <p
          className="muted"
          style={{ fontSize: '0.78rem', marginTop: 8, fontStyle: 'italic' }}
        >
          0.7 = bem permissivo (vai pegar variantes); 0.95 = quase
          idênticas. Default 0.8 é bom ponto de partida.
        </p>
      </div>

      {pairs !== null && visiblePairs && (
        <div className="card">
          <h2 style={{ margin: '0 0 12px' }}>
            {visiblePairs.length} par(es)
            {visiblePairs.length !== pairs.length &&
              ` (${pairs.length - visiblePairs.length} já tratados)`}
          </h2>

          {visiblePairs.length === 0 ? (
            <p className="muted">
              {pairs.length === 0
                ? 'Nenhum par encontrado nesse threshold.'
                : 'Todos os pares foram resolvidos.'}
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {visiblePairs.map((p, i) => (
                <PairCard
                  key={p.qa.id + '|' + p.qb.id + i}
                  pair={p}
                  onExcluir={excluir}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function PairCard({
  pair,
  onExcluir,
}: {
  pair: DuplicatePair;
  onExcluir: (q: Question) => Promise<void>;
}) {
  const enunOf = (q: Question): string => {
    if (q.type === 'objetiva') return (q.payload as ObjetivaPayload).enunciado || '';
    if (q.type === 'discursiva') {
      const p = q.payload as DiscursivaPayload;
      return p.enunciado_completo || p.enunciado || '';
    }
    if (q.type === 'cloze') return (q.payload as { texto?: string }).texto || '';
    if (q.type === 'flashcard') return (q.payload as { frente?: string }).frente || '';
    return '';
  };

  return (
    <li
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 12,
      }}
    >
      <div className="muted" style={{ fontSize: '0.82rem', marginBottom: 8 }}>
        Similaridade: <strong>{Math.round(pair.sim * 100)}%</strong> ·{' '}
        {pair.qa.disciplina_id ?? '(sem disciplina)'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div
          style={{
            background: 'var(--bg-elev)',
            padding: 10,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
            Questão A · #{pair.qa.id.slice(0, 6)}
          </div>
          <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
            {enunOf(pair.qa).slice(0, 280)}
            {enunOf(pair.qa).length > 280 && '…'}
          </div>
          <button
            type="button"
            className="danger"
            style={{ marginTop: 8 }}
            onClick={() => onExcluir(pair.qa)}
          >
            Excluir A
          </button>
        </div>
        <div
          style={{
            background: 'var(--bg-elev)',
            padding: 10,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
            Questão B · #{pair.qb.id.slice(0, 6)}
          </div>
          <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
            {enunOf(pair.qb).slice(0, 280)}
            {enunOf(pair.qb).length > 280 && '…'}
          </div>
          <button
            type="button"
            className="danger"
            style={{ marginTop: 8 }}
            onClick={() => onExcluir(pair.qb)}
          >
            Excluir B
          </button>
        </div>
      </div>
    </li>
  );
}
