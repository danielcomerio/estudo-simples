'use client';

import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useStore } from '@/lib/store';
import { saveGeneratedQuestions } from '@/lib/ai-save-generated';
import { scheduleSync } from '@/lib/sync';
import { toast } from './Toast';

/**
 * Modal global ativado por Ctrl+Shift+N. Permite criar 1 flashcard
 * ou anotação RÁPIDA sem ir ao /banco. Útil pra capturar dúvida do
 * dia ou conceito que viu numa aula.
 *
 * 2 modos:
 *  - Flashcard (default): frente/verso → cria card type='flashcard'.
 *  - Cloze: cola texto com {{c1::resposta}} → cria card type='cloze'.
 */
export function QuickCaptureModal() {
  const userId = useStore((s) => s.userId);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'flashcard' | 'cloze' | 'paste'>('flashcard');
  const [frente, setFrente] = useState('');
  const [verso, setVerso] = useState('');
  const [clozeText, setClozeText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [disciplina, setDisciplina] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        // evita se input em foco for textarea de outro modal
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT') {
          // ainda permite, gesto deliberado
        }
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const reset = () => {
    setFrente('');
    setVerso('');
    setClozeText('');
    setPasteText('');
  };

  const save = () => {
    if (!userId) {
      toast('Sem usuário', 'error');
      return;
    }
    const disc = disciplina.trim() || 'sem-disciplina';
    if (mode === 'flashcard') {
      if (!frente.trim() || !verso.trim()) {
        toast('Preencha frente e verso', 'warn');
        return;
      }
      const r = saveGeneratedQuestions(
        [
          {
            type: 'flashcard',
            disciplina_id: disc,
            payload: { frente: frente.trim(), verso: verso.trim() },
          },
        ],
        userId
      );
      scheduleSync();
      toast(r.added > 0 ? '✅ Flashcard salvo' : '❌ Falha', r.added > 0 ? 'success' : 'error');
    } else if (mode === 'cloze') {
      if (!clozeText.trim() || !/\{\{c\d+::[^}]+\}\}/.test(clozeText)) {
        toast('Cloze precisa ter ao menos um {{c1::resposta}}', 'warn');
        return;
      }
      const r = saveGeneratedQuestions(
        [
          {
            type: 'cloze',
            disciplina_id: disc,
            payload: { texto: clozeText.trim() },
          },
        ],
        userId
      );
      scheduleSync();
      toast(r.added > 0 ? '✅ Cloze salvo' : '❌ Falha', r.added > 0 ? 'success' : 'error');
    } else {
      // mode === 'paste' — parser heurístico
      if (!pasteText.trim()) {
        toast('Cole texto bruto (questão+alternativas)', 'warn');
        return;
      }
      void (async () => {
        const { parsePastedText, pastedToImportItem } = await import('@/lib/parse-pasted-text');
        const parsed = parsePastedText(pasteText);
        if (!parsed) {
          toast(
            'Não consegui detectar formato. Use A) B) C) e marque "Gabarito: X" no fim.',
            'error'
          );
          return;
        }
        const item = pastedToImportItem(parsed, disc);
        const r = saveGeneratedQuestions(
          [
            {
              type: 'objetiva',
              disciplina_id: item.disciplina_id,
              payload: {
                enunciado: item.enunciado,
                alternativas: item.alternativas,
                gabarito: item.gabarito,
                explicacao_geral: item.explicacao_geral,
              },
            },
          ],
          userId
        );
        scheduleSync();
        toast(
          r.added > 0
            ? `✅ Objetiva salva (${parsed.alternativas.length} alts${parsed.gabarito ? ', gabarito ' + parsed.gabarito : ''})`
            : '❌ Falha',
          r.added > 0 ? 'success' : 'error'
        );
        reset();
        setOpen(false);
      })();
      return;
    }
    reset();
    setOpen(false);
  };

  if (!open) return null;
  return (
    <Modal onClose={() => setOpen(false)} ariaLabel="Captura rápida">
      <div style={{ padding: 14, minWidth: 320 }}>
        <h3 style={{ margin: '0 0 12px' }}>⚡ Captura rápida</h3>
        <div className="row gap" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={mode === 'flashcard' ? 'primary' : 'ghost'}
            onClick={() => setMode('flashcard')}
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
          >
            Flashcard
          </button>
          <button
            type="button"
            className={mode === 'cloze' ? 'primary' : 'ghost'}
            onClick={() => setMode('cloze')}
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
          >
            Cloze
          </button>
          <button
            type="button"
            className={mode === 'paste' ? 'primary' : 'ghost'}
            onClick={() => setMode('paste')}
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
            title="Cole texto bruto e o app detecta enunciado/alternativas/gabarito"
          >
            📋 Cole texto
          </button>
        </div>

        <input
          type="text"
          placeholder="Disciplina (opcional)"
          value={disciplina}
          onChange={(e) => setDisciplina(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />

        {mode === 'flashcard' ? (
          <>
            <textarea
              placeholder="Frente (pergunta)"
              value={frente}
              onChange={(e) => setFrente(e.target.value)}
              rows={2}
              style={{ width: '100%', marginBottom: 8 }}
              autoFocus
            />
            <textarea
              placeholder="Verso (resposta)"
              value={verso}
              onChange={(e) => setVerso(e.target.value)}
              rows={3}
              style={{ width: '100%', marginBottom: 10 }}
            />
          </>
        ) : mode === 'cloze' ? (
          <textarea
            placeholder='Texto com {{c1::lacunas}} marcadas. Ex: "Capital do Brasil é {{c1::Brasília}}."'
            value={clozeText}
            onChange={(e) => setClozeText(e.target.value)}
            rows={5}
            style={{ width: '100%', marginBottom: 10 }}
            autoFocus
          />
        ) : (
          <textarea
            placeholder={`Cole o texto bruto da questão. Ex:\n\nQual é a capital?\n\nA) Rio\nB) Brasília\nC) SP\n\nGabarito: B\nComentário: ...`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            style={{ width: '100%', marginBottom: 10 }}
            autoFocus
          />
        )}

        <div className="row gap right">
          <button type="button" className="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button type="button" className="primary" onClick={save}>
            Salvar (Ctrl+Enter)
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>
          Atalho: <kbd>Ctrl+Shift+N</kbd> abre este modal de qualquer rota.
        </p>
      </div>
    </Modal>
  );
}
