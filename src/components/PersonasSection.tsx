'use client';

import { useEffect, useState } from 'react';
import { useConcursos } from '@/lib/hierarchy';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';

type Persona = {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  emoji: string;
  concurso_id: string | null;
  is_public: boolean;
  use_count: number;
};

const TEMPLATE_PROMPTS: Array<{
  name: string;
  emoji: string;
  prompt: string;
  description: string;
}> = [
  {
    name: 'Prof. Direito FGV',
    emoji: '⚖️',
    description: 'Foco em estilo FGV, jurisprudência, pegadinhas',
    prompt:
      'Você é um professor de Direito especialista em provas da FGV. Conhece o estilo da banca, pegadinhas comuns, jurisprudências mais cobradas. Foque em precisão técnica, cite leis literalmente quando souber, e aponte armadilhas. Em pt-BR, didático mas sem floreios. Max 250 palavras por resposta.',
  },
  {
    name: 'Coach motivacional',
    emoji: '🔥',
    description: 'Encoraja, monta planos, lembra de você quando enfraquecer',
    prompt:
      'Você é um coach de estudos motivacional. Seu papel: manter o aluno focado, sugerir planos práticos, celebrar conquistas e acolher quando ele está desanimado. Tom: caloroso, direto, prático. Sugira ações concretas (não vagas). Em pt-BR. Max 250 palavras.',
  },
  {
    name: 'Revisor crítico',
    emoji: '🔍',
    description: 'Analisa redação, aponta erros sem dó, sugere reescritas',
    prompt:
      'Você é um revisor crítico de redações de concurso. Analisa textos com olhar afiado: aponta erros gramaticais, falhas de coesão, argumentos fracos, e sugere reescritas concretas. Tom: rigoroso mas construtivo. Em pt-BR. Estrutura: pontos fortes (1-2), pontos a melhorar (3-5), sugestão de reescrita (1 trecho).',
  },
];

export function PersonasSection() {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [editing, setEditing] = useState<Persona | 'new' | null>(null);
  const { data: concursos } = useConcursos();

  async function reload() {
    const r = await fetch('/api/personas');
    if (r.ok) {
      const j = await r.json();
      setPersonas(j.items ?? []);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: 'Remover persona?',
      message: 'A persona será apagada permanentemente.',
      danger: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/personas/${id}`, { method: 'DELETE' });
    if (r.ok) {
      toast('Persona removida.', 'success');
      void reload();
    } else {
      toast('Falha ao remover.', 'error');
    }
  }

  return (
    <div className="card" id="personas">
      <h2 style={{ margin: '0 0 8px' }}>🎭 Personas IA</h2>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
      >
        Crie "professores" customizados pro AI Coach. Cada persona tem
        seu system prompt — define tom, foco, banca preferida, etc. Pode
        vincular a um concurso específico.
      </p>

      {personas === null ? (
        <p className="muted">Carregando…</p>
      ) : personas.length === 0 ? (
        <div
          style={{
            padding: 16,
            background: 'var(--bg-elev-2)',
            borderRadius: 8,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          <div className="muted" style={{ marginBottom: 10, fontSize: '0.88rem' }}>
            Nenhuma persona ainda. Comece com um template:
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {TEMPLATE_PROMPTS.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() =>
                  setEditing({
                    id: '',
                    name: t.name,
                    description: t.description,
                    system_prompt: t.prompt,
                    emoji: t.emoji,
                    concurso_id: null,
                    is_public: false,
                    use_count: 0,
                  })
                }
                style={{ padding: '4px 10px', fontSize: '0.82rem' }}
              >
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
          {personas.map((p) => (
            <li
              key={p.id}
              style={{
                padding: 10,
                marginBottom: 8,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-elev-2)',
              }}
            >
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>
                    {p.emoji} {p.name}
                  </strong>
                  {p.concurso_id && (
                    <span
                      className="muted"
                      style={{ fontSize: '0.75rem', marginLeft: 8 }}
                    >
                      ·{' '}
                      {concursos?.find((c) => c.id === p.concurso_id)?.nome ??
                        'concurso'}
                    </span>
                  )}
                  {p.description && (
                    <div
                      className="muted"
                      style={{ fontSize: '0.82rem', marginTop: 2 }}
                    >
                      {p.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="ghost"
                    style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setEditing('new')}>
        + Nova persona
      </button>

      {editing && (
        <PersonaEditor
          initial={editing === 'new' ? null : editing}
          concursos={(concursos ?? []).map((c) => ({ id: c.id, nome: c.nome }))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function PersonaEditor({
  initial,
  concursos,
  onClose,
  onSaved,
}: {
  initial: Persona | null;
  concursos: Array<{ id: string; nome: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🤖');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? '');
  const [concursoId, setConcursoId] = useState<string | null>(
    initial?.concurso_id ?? null
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast('Nome é obrigatório', 'error');
      return;
    }
    if (systemPrompt.length < 10) {
      toast('System prompt muito curto (min 10 chars)', 'error');
      return;
    }
    setSaving(true);
    const body = {
      name: name.trim(),
      emoji,
      description: description.trim() || null,
      system_prompt: systemPrompt,
      concurso_id: concursoId,
    };
    const url = initial?.id ? `/api/personas/${initial.id}` : '/api/personas';
    const method = initial?.id ? 'PATCH' : 'POST';
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      toast('Persona salva.', 'success');
      onSaved();
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} ariaLabel="Editar persona" maxWidth={580}>
      <h2 style={{ margin: '0 0 12px' }}>
        {initial?.id ? 'Editar persona' : 'Nova persona'}
      </h2>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ flex: '0 0 80px' }}>
            <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>Emoji</div>
            <input
              type="text"
              value={emoji}
              maxLength={4}
              onChange={(e) => setEmoji(e.target.value)}
              style={{ width: '100%', textAlign: 'center', fontSize: '1.2rem' }}
            />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>Nome</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="Ex: Prof. Direito FGV"
            />
          </label>
        </div>

        <label>
          <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
            Descrição (opcional)
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="O que essa persona faz bem"
          />
        </label>

        <label>
          <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
            Concurso vinculado (opcional)
          </div>
          <select
            value={concursoId ?? ''}
            onChange={(e) =>
              setConcursoId(e.target.value === '' ? null : e.target.value)
            }
          >
            <option value="">— Nenhum (global) —</option>
            {concursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
            System prompt ({systemPrompt.length}/4000 chars)
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value.slice(0, 4000))}
            rows={8}
            placeholder="Você é... Foque em... Tom..."
            style={{
              fontFamily: 'inherit',
              fontSize: '0.88rem',
              resize: 'vertical',
            }}
          />
        </label>
      </div>

      <div className="row gap" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={saving || !name.trim() || systemPrompt.length < 10}
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
