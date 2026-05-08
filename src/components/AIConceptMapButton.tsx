'use client';

import { useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { Modal } from './Modal';
import { toast } from './Toast';

type Node = {
  titulo: string;
  filhos?: Node[];
};

function parseTree(text: string): Node[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr.filter((n): n is Node => !!n && typeof n.titulo === 'string').slice(0, 20);
  } catch {
    return [];
  }
}

function TreeView({ nodes, depth = 0 }: { nodes: Node[]; depth?: number }) {
  return (
    <ul style={{ listStyle: 'none', paddingLeft: depth === 0 ? 0 : 16, margin: 0 }}>
      {nodes.map((n, i) => (
        <li
          key={i}
          style={{
            padding: '4px 0',
            fontSize: depth === 0 ? '0.95rem' : '0.88rem',
            fontWeight: depth === 0 ? 600 : depth === 1 ? 500 : 400,
          }}
        >
          {depth === 0 ? '🟢 ' : depth === 1 ? '🔹 ' : '· '}
          {n.titulo}
          {n.filhos && n.filhos.length > 0 && (
            <TreeView nodes={n.filhos} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function AIConceptMapButton({ disciplinaNome }: { disciplinaNome: string }) {
  const provider = getDefaultProvider();
  const all = useStore(selectActiveQuestions);
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<Node[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const generate = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);

    const sample = all
      .filter((q) => q.disciplina_id === disciplinaNome)
      .filter((q) => q.type === 'objetiva')
      .sort(() => Math.random() - 0.5)
      .slice(0, 30);

    if (sample.length < 3) {
      toast('Disciplina precisa de mais questões pra mapa', 'warn');
      setLoading(false);
      return;
    }

    const ctx = sample
      .map((q, i) => {
        const p = q.payload as { enunciado?: string };
        return `${i + 1}. ${(p.enunciado ?? '').slice(0, 200)}`;
      })
      .join('\n');

    const promptBase = `Analise estas questões da disciplina "${disciplinaNome}" e produza um MAPA HIERÁRQUICO de conceitos (3 níveis: tópico → subtópico → conceito).

QUESTÕES:
${ctx}

Responda APENAS com JSON neste formato (array de até 8 tópicos raiz):
[
  {"titulo": "Tópico A", "filhos": [
    {"titulo": "Subtópico A.1", "filhos": [
      {"titulo": "Conceito específico"}
    ]}
  ]}
]

Sem markdown extra. pt-BR.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'concept-map',
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        setLoading(false);
        return;
      }
      const parsed = parseTree((j as { text: string }).text ?? '');
      if (parsed.length === 0) {
        toast('IA não retornou estrutura válida', 'warn');
        setLoading(false);
        return;
      }
      setTree(parsed);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setOpen(true);
          if (!tree) void generate();
        }}
        title={`Mapa mental gerado por ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '4px 10px', fontSize: '0.82rem' }}
      >
        🌳 Mapa mental
      </button>
      {open && (
        <Modal
          onClose={() => setOpen(false)}
          ariaLabel={`Mapa mental de ${disciplinaNome}`}
          maxWidth="640px"
        >
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>🌳 {disciplinaNome} — mapa mental</h3>
            {loading && <p>Gerando…</p>}
            {tree && tree.length > 0 && (
              <div
                style={{
                  padding: 12,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  maxHeight: '60vh',
                  overflowY: 'auto',
                }}
              >
                <TreeView nodes={tree} />
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
