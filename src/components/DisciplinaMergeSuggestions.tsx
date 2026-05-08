'use client';

/**
 * Card que aparece em /disciplinas quando detecta duplicatas exatas
 * (mesmo slug, ex: "Matemática" + "matematica") ou near-duplicatas
 * (slug similar, ex: "Direito Constitucional" + "direito const").
 *
 * Sugere merge: aplica updateQuestionLocal em todas as questões da
 * variante pra usar o canonical name. Tudo client-side via store.
 */

import { useMemo, useState } from 'react';
import {
  detectDuplicates,
  detectNearDuplicates,
  type DuplicateGroup,
} from '@/lib/normalize';
import {
  selectActiveQuestions,
  updateQuestionLocal,
  useStore,
} from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmDialog';

export function DisciplinaMergeSuggestions() {
  const questions = useStore(selectActiveQuestions);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState<string | null>(null);

  const groups = useMemo(() => {
    const names = Array.from(
      new Set(
        questions
          .map((q) => q.disciplina_id?.trim())
          .filter((d): d is string => !!d && d.length > 0)
      )
    );
    const exact = detectDuplicates(names);
    const fuzzy = detectNearDuplicates(names);
    // Combina sem duplicar (exact tem prioridade)
    const seen = new Set(exact.map((g) => g.slug));
    const fuzzyOnly = fuzzy.filter((g) => !seen.has(g.slug));
    return { exact, fuzzy: fuzzyOnly };
  }, [questions]);

  const visibleExact = groups.exact.filter((g) => !dismissed.has(`exact:${g.slug}`));
  const visibleFuzzy = groups.fuzzy.filter((g) => !dismissed.has(`fuzzy:${g.slug}`));

  if (visibleExact.length === 0 && visibleFuzzy.length === 0) return null;

  async function applyMerge(group: DuplicateGroup, kind: 'exact' | 'fuzzy') {
    const ok = await confirmDialog({
      title: `Mesclar em "${group.canonical}"?`,
      message: `Vai renomear ${group.variants.length} variante(s) (${group.variants.join(', ')}) pra "${group.canonical}". Aplica em TODAS as questões dessas disciplinas. Reversível questão por questão depois, mas demorado.`,
    });
    if (!ok) return;
    setMerging(`${kind}:${group.slug}`);
    try {
      const variantSet = new Set(group.variants);
      let count = 0;
      for (const q of questions) {
        if (q.disciplina_id && variantSet.has(q.disciplina_id)) {
          updateQuestionLocal(q.id, () => ({
            disciplina_id: group.canonical,
          }));
          count++;
        }
      }
      if (count > 0) {
        scheduleSync(500);
        toast(`✓ ${count} questão(ões) renomeada(s) pra "${group.canonical}"`, 'success');
        setDismissed((prev) => new Set(prev).add(`${kind}:${group.slug}`));
      } else {
        toast('Nenhuma questão afetada', 'warn');
      }
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setMerging(null);
    }
  }

  return (
    <div
      className="card"
      style={{
        borderLeft: '4px solid var(--warn, #f59e0b)',
      }}
    >
      <h2 style={{ margin: '0 0 6px' }}>🔍 Disciplinas duplicadas detectadas</h2>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
      >
        Mesma disciplina escrita de jeito diferente cria entries separadas
        e atrapalha filtros. Mescle em UM nome canônico.
      </p>

      {visibleExact.length > 0 && (
        <section style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>
            Variações idênticas (mesmo slug)
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visibleExact.map((g) => (
              <DupGroupRow
                key={`exact:${g.slug}`}
                group={g}
                kind="exact"
                merging={merging === `exact:${g.slug}`}
                onMerge={() => applyMerge(g, 'exact')}
                onDismiss={() =>
                  setDismissed((prev) =>
                    new Set(prev).add(`exact:${g.slug}`)
                  )
                }
              />
            ))}
          </ul>
        </section>
      )}

      {visibleFuzzy.length > 0 && (
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>
            Variações próximas (verifique antes)
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visibleFuzzy.map((g) => (
              <DupGroupRow
                key={`fuzzy:${g.slug}`}
                group={g}
                kind="fuzzy"
                merging={merging === `fuzzy:${g.slug}`}
                onMerge={() => applyMerge(g, 'fuzzy')}
                onDismiss={() =>
                  setDismissed((prev) =>
                    new Set(prev).add(`fuzzy:${g.slug}`)
                  )
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DupGroupRow({
  group,
  kind,
  merging,
  onMerge,
  onDismiss,
}: {
  group: DuplicateGroup;
  kind: 'exact' | 'fuzzy';
  merging: boolean;
  onMerge: () => void;
  onDismiss: () => void;
}) {
  return (
    <li
      style={{
        padding: 10,
        marginBottom: 6,
        background: 'var(--bg-elev-2)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: 1, minWidth: 200, fontSize: '0.88rem' }}>
        <strong>{group.canonical}</strong>
        <span className="muted" style={{ marginLeft: 8 }}>
          ← {group.variants.map((v) => `"${v}"`).join(', ')}
        </span>
        {kind === 'fuzzy' && (
          <span
            style={{
              marginLeft: 8,
              padding: '0 6px',
              fontSize: '0.72rem',
              background: 'var(--warn, #f59e0b)',
              color: '#fff',
              borderRadius: 3,
            }}
          >
            similar
          </span>
        )}
      </span>
      <button
        type="button"
        className="primary"
        onClick={onMerge}
        disabled={merging}
        style={{ padding: '4px 12px', fontSize: '0.82rem' }}
      >
        {merging ? 'Mesclando…' : '↗ Mesclar'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="ghost"
        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
        title="Ignorar nessa sessão"
      >
        ✕
      </button>
    </li>
  );
}
