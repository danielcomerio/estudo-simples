'use client';

import { useEffect, useRef, useState } from 'react';
import { addQuestionLocal, useStore } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { newSRS, newStats } from '@/lib/srs';
import type { ObjetivaPayload } from '@/lib/types';
import { toast } from './Toast';

/**
 * Drawer pra criar questão objetiva manualmente, sem precisar
 * importar JSON. Forma simplificada — só campos essenciais.
 *
 * Salva como autoral. Usuário pode depois editar metadata avançada
 * (tags, fonte, verificacao) via QuestionEditDrawer.
 */
export function QuestionCreateDrawer({ onClose }: { onClose: () => void }) {
  const userId = useStore((s) => s.userId);
  const dlgRef = useRef<HTMLDialogElement>(null);

  const [discId, setDiscId] = useState('');
  const [tema, setTema] = useState('');
  const [banca, setBanca] = useState('');
  const [dif, setDif] = useState('');
  const [enun, setEnun] = useState('');
  const [explicacao, setExplicacao] = useState('');
  const [alts, setAlts] = useState<
    Array<{ letra: string; texto: string; correta: boolean }>
  >([
    { letra: 'A', texto: '', correta: false },
    { letra: 'B', texto: '', correta: false },
    { letra: 'C', texto: '', correta: false },
    { letra: 'D', texto: '', correta: false },
    { letra: 'E', texto: '', correta: false },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (dlgRef.current && !dlgRef.current.open) {
      try {
        dlgRef.current.showModal();
      } catch {
        onClose();
      }
    }
  }, [onClose]);

  const updateAlt = (i: number, field: 'letra' | 'texto' | 'correta', value: string | boolean) => {
    setAlts((cur) =>
      cur.map((a, idx) => {
        if (idx !== i) return a;
        if (field === 'correta' && value) {
          return { ...a, correta: true };
        }
        return { ...a, [field]: value };
      })
    );
    if (field === 'correta' && value) {
      setAlts((cur) => cur.map((a, idx) => (idx === i ? a : { ...a, correta: false })));
    }
  };

  const close = () => {
    if (dlgRef.current?.open) dlgRef.current.close();
    onClose();
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    if (!userId) {
      toast('Não autenticado', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const altsClean = alts
        .filter((a) => a.letra.trim() && a.texto.trim())
        .map((a) => ({
          letra: a.letra.toUpperCase(),
          texto: a.texto,
          correta: !!a.correta,
        }));
      if (altsClean.length < 2) {
        toast('Informe pelo menos 2 alternativas com texto', 'error');
        return;
      }
      const corretas = altsClean.filter((a) => a.correta);
      if (corretas.length !== 1) {
        toast('Marque exatamente 1 alternativa como correta', 'error');
        return;
      }
      if (!enun.trim()) {
        toast('Enunciado obrigatório', 'error');
        return;
      }
      const payload: ObjetivaPayload = {
        enunciado: enun,
        alternativas: altsClean,
        gabarito: corretas[0].letra,
      };
      if (explicacao.trim()) payload.explicacao_geral = explicacao;

      let dificuldade: number | null = null;
      if (dif.trim()) {
        const n = Number(dif);
        if (Number.isInteger(n) && n >= 1 && n <= 5) dificuldade = n;
      }

      addQuestionLocal(
        {
          type: 'objetiva',
          disciplina_id: discId.trim() || null,
          tema: tema.trim() || null,
          banca_estilo: banca.trim() || null,
          dificuldade,
          payload,
          srs: newSRS(),
          stats: newStats(),
          deleted_at: null,
          origem: 'autoral',
          fonte: {},
          verificacao: 'verificada', // criada manualmente, assume validada
        },
        userId
      );
      scheduleSync(500);
      toast('Questão criada.', 'success');
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dlgRef}
      onClose={close}
      style={{
        maxWidth: 760,
        width: '95vw',
        padding: 0,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-elev)',
        color: 'var(--text)',
      }}
    >
      <form onSubmit={save} style={{ padding: 22 }}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Criar questão (objetiva)</h2>
          <button
            type="button"
            className="ghost icon"
            onClick={close}
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="form-grid">
          <label>
            <span>Disciplina</span>
            <input
              type="text"
              value={discId}
              onChange={(e) => setDiscId(e.target.value)}
              maxLength={200}
              placeholder="ex: portugues"
              autoFocus
            />
          </label>
          <label>
            <span>Tema</span>
            <input
              type="text"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            <span>Banca / estilo</span>
            <input
              type="text"
              value={banca}
              onChange={(e) => setBanca(e.target.value)}
              maxLength={100}
              placeholder="ex: FGV"
            />
          </label>
          <label>
            <span>Dificuldade (1-5)</span>
            <input
              type="number"
              min={1}
              max={5}
              step={1}
              value={dif}
              onChange={(e) => setDif(e.target.value)}
            />
          </label>
        </div>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: '0.85rem' }}>Enunciado *</span>
          <textarea
            value={enun}
            onChange={(e) => setEnun(e.target.value)}
            rows={5}
            maxLength={50_000}
            required
          />
        </label>

        <h3 style={{ margin: '16px 0 8px' }}>Alternativas</h3>
        {alts.map((a, i) => (
          <div
            key={i}
            className="row gap"
            style={{
              alignItems: 'flex-start',
              marginBottom: 8,
            }}
          >
            <input
              type="radio"
              name="correta"
              checked={a.correta}
              onChange={(e) => updateAlt(i, 'correta', e.target.checked)}
              title="Marcar como correta"
              style={{ marginTop: 10, flexShrink: 0 }}
            />
            <input
              type="text"
              value={a.letra}
              onChange={(e) => updateAlt(i, 'letra', e.target.value)}
              maxLength={3}
              style={{ width: 48, flexShrink: 0 }}
              placeholder="A"
            />
            <textarea
              value={a.texto}
              onChange={(e) => updateAlt(i, 'texto', e.target.value)}
              rows={2}
              style={{ flex: 1 }}
              placeholder="texto da alternativa"
            />
          </div>
        ))}

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginTop: 14,
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: '0.85rem' }}>
            Explicação geral (opcional)
          </span>
          <textarea
            value={explicacao}
            onChange={(e) => setExplicacao(e.target.value)}
            rows={3}
            placeholder="Por que a correta é correta, contexto..."
          />
        </label>

        <div className="row gap right" style={{ marginTop: 18 }}>
          <button type="button" className="ghost" onClick={close}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Criar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
