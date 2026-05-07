'use client';

import { useEffect, useRef, useState } from 'react';
import { TextareaWithPreview } from './TextareaWithPreview';
import {
  addQuestionLocal,
  updateQuestionLocal,
  useStore,
  selectActiveQuestions,
} from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { newSRS, newStats } from '@/lib/srs';
import type { ClozePayload, FlashcardPayload, ObjetivaPayload } from '@/lib/types';
import { toast } from './Toast';
import { uploadQuestionImage, IMAGE_LIMITS } from '@/lib/storage';
import { useDisciplinas } from '@/lib/hierarchy';
import { normalizeDisplayName, normalizeTagList } from '@/lib/normalize';

/**
 * Drawer pra criar questão (objetiva, cloze ou flashcard)
 * manualmente, sem precisar importar JSON. Forma simplificada — só
 * campos essenciais.
 *
 * Salva como autoral + verificacao='verificada' (criada
 * intencionalmente). Usuário pode depois editar metadata avançada
 * (tags, fonte) via QuestionEditDrawer.
 */
type CreateKind = 'objetiva' | 'cloze' | 'flashcard';

export function QuestionCreateDrawer({
  onClose,
  initialKind = 'objetiva',
}: {
  onClose: () => void;
  initialKind?: CreateKind;
}) {
  const userId = useStore((s) => s.userId);
  const questions = useStore(selectActiveQuestions);
  const disciplinasCache = useDisciplinas();
  const disciplinas = disciplinasCache.data ?? [];
  const dlgRef = useRef<HTMLDialogElement>(null);

  const [kind, setKind] = useState<CreateKind>(initialKind);
  const [discId, setDiscId] = useState('');
  const [tema, setTema] = useState('');
  const [banca, setBanca] = useState('');
  const [dif, setDif] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  // Objetiva
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
  // Cloze
  const [clozeTexto, setClozeTexto] = useState('');
  // Flashcard
  const [frente, setFrente] = useState('');
  const [verso, setVerso] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // Imagens pendentes — coletadas antes de salvar, uploaded após
  // questão receber id via addQuestionLocal
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save draft a cada 1.5s. Restaura ao montar se houver. Apaga
  // após save bem-sucedido. Útil pra users mobile (toque acidental no
  // backdrop fecha o drawer e perderia tudo).
  const DRAFT_KEY = 'estudo-simples:question-draft:v1';

  useEffect(() => {
    // Tenta restaurar draft ao abrir
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && typeof d === 'object') {
        if (typeof d.kind === 'string') setKind(d.kind);
        if (typeof d.discId === 'string') setDiscId(d.discId);
        if (typeof d.tema === 'string') setTema(d.tema);
        if (typeof d.banca === 'string') setBanca(d.banca);
        if (typeof d.dif === 'string') setDif(d.dif);
        if (typeof d.enun === 'string') setEnun(d.enun);
        if (typeof d.explicacao === 'string') setExplicacao(d.explicacao);
        if (Array.isArray(d.alts) && d.alts.length === 5) setAlts(d.alts);
        if (typeof d.clozeTexto === 'string') setClozeTexto(d.clozeTexto);
        if (typeof d.frente === 'string') setFrente(d.frente);
        if (typeof d.verso === 'string') setVerso(d.verso);
        if (typeof d.tagsInput === 'string') setTagsInput(d.tagsInput);
        setDraftRestored(true);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save debounced
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        // Não salva draft vazio
        const hasContent =
          enun.trim() || clozeTexto.trim() || frente.trim() || verso.trim();
        if (!hasContent) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            kind,
            discId,
            tema,
            banca,
            dif,
            enun,
            explicacao,
            alts,
            clozeTexto,
            frente,
            verso,
            tagsInput,
          })
        );
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [kind, discId, tema, banca, dif, enun, explicacao, alts, clozeTexto, frente, verso, tagsInput]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

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

  // Helpers de imagens (drag-drop / file input)
  const addImages = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) {
      toast('Apenas arquivos de imagem (PNG/JPEG/WEBP/GIF)', 'error');
      return;
    }
    // Cap maxPerQuestion imagens
    const remaining = IMAGE_LIMITS.maxPerQuestion - pendingImages.length;
    if (arr.length > remaining) {
      toast(`Máximo ${IMAGE_LIMITS.maxPerQuestion} imagens — sobraram ${remaining} slots`, 'warn');
    }
    const accepted = arr.slice(0, remaining).filter((f) => {
      if (f.size > IMAGE_LIMITS.maxSizeBytes) {
        toast(
          `${f.name}: maior que ${Math.round(IMAGE_LIMITS.maxSizeBytes / 1024 / 1024)}MB`,
          'error'
        );
        return false;
      }
      return true;
    });
    if (accepted.length > 0) {
      setPendingImages((prev) => [...prev, ...accepted]);
    }
  };
  const removeImage = (i: number) => {
    setPendingImages((prev) => prev.filter((_, idx) => idx !== i));
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
      let dificuldade: number | null = null;
      if (dif.trim()) {
        const n = Number(dif);
        if (Number.isInteger(n) && n >= 1 && n <= 5) dificuldade = n;
      }

      let payload: ObjetivaPayload | ClozePayload | FlashcardPayload;
      let type: 'objetiva' | 'cloze' | 'flashcard';

      if (kind === 'cloze') {
        if (!clozeTexto.trim()) {
          toast('Texto do cloze obrigatório', 'error');
          return;
        }
        if (!/\{\{c\d+::/.test(clozeTexto)) {
          toast(
            'Cloze precisa de ao menos uma lacuna {{c1::resposta}}',
            'error'
          );
          return;
        }
        payload = {
          texto: clozeTexto,
          ...(explicacao.trim() ? { explicacao } : {}),
        } as ClozePayload;
        type = 'cloze';
      } else if (kind === 'flashcard') {
        if (!frente.trim() || !verso.trim()) {
          toast('Frente e verso obrigatórios', 'error');
          return;
        }
        payload = { frente, verso } as FlashcardPayload;
        type = 'flashcard';
      } else {
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
        const obj: ObjetivaPayload = {
          enunciado: enun,
          alternativas: altsClean,
          gabarito: corretas[0].letra,
        };
        if (explicacao.trim()) obj.explicacao_geral = explicacao;
        payload = obj;
        type = 'objetiva';
      }

      const tagsList = normalizeTagList(tagsInput);
      const created = addQuestionLocal(
        {
          type,
          disciplina_id: normalizeDisplayName(discId) || null,
          tema: normalizeDisplayName(tema) || null,
          banca_estilo: normalizeDisplayName(banca) || null,
          dificuldade,
          payload,
          srs: newSRS(),
          stats: newStats(),
          deleted_at: null,
          origem: 'autoral',
          fonte: {},
          verificacao: 'verificada',
          ...(tagsList.length > 0 ? { tags: tagsList } : {}),
        },
        userId
      );

      // Upload imagens pendentes (se houver) e atualiza payload.imagens.
      // Storage path usa o id real da questão criada (composite FK respeitado).
      if (pendingImages.length > 0) {
        toast(
          `📤 Enviando ${pendingImages.length} imagem(ns)…`,
          '',
          3000
        );
        const uploadedUrls: string[] = [];
        for (const file of pendingImages) {
          try {
            const url = await uploadQuestionImage(file, created.id, userId);
            uploadedUrls.push(url);
          } catch (e) {
            toast(
              `Falha em ${file.name}: ${
                e instanceof Error ? e.message : 'erro'
              }`,
              'error'
            );
          }
        }
        if (uploadedUrls.length > 0) {
          updateQuestionLocal(created.id, (cur) => ({
            payload: {
              ...(cur.payload as Record<string, unknown>),
              imagens: uploadedUrls,
            },
          }));
        }
      }

      scheduleSync(500);
      clearDraft();
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
      aria-labelledby="create-drawer-title"
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
          <h2 id="create-drawer-title" style={{ margin: 0 }}>
            Criar questão{' '}
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              ({kind})
            </span>
          </h2>
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

        {draftRestored && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span>📝 Draft restaurado.</span>
            <button
              type="button"
              className="ghost"
              style={{ padding: '2px 10px', fontSize: '0.82rem' }}
              onClick={() => {
                clearDraft();
                setKind(initialKind);
                setDiscId('');
                setTema('');
                setBanca('');
                setDif('');
                setEnun('');
                setExplicacao('');
                setAlts([
                  { letra: 'A', texto: '', correta: false },
                  { letra: 'B', texto: '', correta: false },
                  { letra: 'C', texto: '', correta: false },
                  { letra: 'D', texto: '', correta: false },
                  { letra: 'E', texto: '', correta: false },
                ]);
                setClozeTexto('');
                setFrente('');
                setVerso('');
                setTagsInput('');
                setDraftRestored(false);
              }}
            >
              Descartar
            </button>
          </div>
        )}

        <div className="row gap" style={{ marginBottom: 14 }}>
          <label>
            <span style={{ marginRight: 6, fontSize: '0.85rem' }}>Tipo:</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CreateKind)}
            >
              <option value="objetiva">Objetiva (alternativas)</option>
              <option value="cloze">Cloze (texto com lacunas)</option>
              <option value="flashcard">Flashcard (frente/verso)</option>
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label>
            <span>Disciplina</span>
            <input
              type="text"
              value={discId}
              onChange={(e) => setDiscId(e.target.value)}
              maxLength={200}
              placeholder="ex: Português"
              list="create-disc-list"
              autoFocus
            />
            <datalist id="create-disc-list">
              {disciplinas.map((d) => (
                <option key={d.id} value={d.nome} />
              ))}
            </datalist>
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
          <label style={{ gridColumn: '1 / -1' }}>
            <span>
              Tags{' '}
              <span className="muted" style={{ fontWeight: 400 }}>
                (separadas por vírgula — viram kebab-case automaticamente)
              </span>
            </span>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="ex: art-5, banca-fgv, ano-2024"
              list="create-tags-list"
            />
            <datalist id="create-tags-list">
              {Array.from(
                new Set(questions.flatMap((q) => q.tags ?? []))
              )
                .sort()
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </label>
        </div>

        {kind === 'objetiva' && (
          <>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>Enunciado *</span>
              <TextareaWithPreview
                value={enun}
                onChange={setEnun}
                rows={5}
                maxLength={50_000}
              />
            </label>

            <h3 style={{ margin: '16px 0 8px' }}>Alternativas</h3>
          </>
        )}

        {kind === 'cloze' && (
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>
              Texto com lacunas * — use{' '}
              <code>{'{{c1::resposta}}'}</code>
            </span>
            <textarea
              value={clozeTexto}
              onChange={(e) => setClozeTexto(e.target.value)}
              rows={6}
              placeholder='Ex: A {{c1::Lei 14.133/21}} dispõe sobre {{c2::licitações}}.'
            />
          </label>
        )}

        {kind === 'flashcard' && (
          <>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>Frente *</span>
              <textarea
                value={frente}
                onChange={(e) => setFrente(e.target.value)}
                rows={3}
                placeholder="Pergunta / termo"
              />
            </label>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>Verso *</span>
              <textarea
                value={verso}
                onChange={(e) => setVerso(e.target.value)}
                rows={4}
                placeholder="Resposta / definição"
              />
            </label>
          </>
        )}

        {kind === 'objetiva' && alts.map((a, i) => (
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
          <TextareaWithPreview
            value={explicacao}
            onChange={setExplicacao}
            rows={3}
            placeholder="Por que a correta é correta, contexto..."
          />
        </label>

        {/* Imagens (drag-drop ou click) — opcional. Upload acontece
            após save, com path baseado no id da questão criada. */}
        <div style={{ marginTop: 14 }}>
          <span style={{ fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
            Imagens (opcional, máx {IMAGE_LIMITS.maxPerQuestion})
          </span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length > 0) {
                addImages(e.dataTransfer.files);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
              background: dragOver ? 'var(--primary-soft)' : 'var(--bg-elev-2)',
              borderRadius: 'var(--radius)',
              padding: '14px',
              textAlign: 'center',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: 'var(--muted)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            🖼 Arraste imagens aqui ou clique pra selecionar
            <br />
            <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>
              PNG, JPEG, WEBP, GIF — máx {Math.round(IMAGE_LIMITS.maxSizeBytes / 1024 / 1024)}MB cada
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={(e) => {
              if (e.target.files) addImages(e.target.files);
              e.target.value = ''; // reset pra permitir re-upload do mesmo arquivo
            }}
            style={{ display: 'none' }}
          />
          {pendingImages.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 8,
                marginTop: 10,
              }}
            >
              {pendingImages.map((file, i) => {
                const url = URL.createObjectURL(file);
                return (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elev)',
                    }}
                  >
                    <img
                      src={url}
                      alt={`pré-visualização ${i + 1}`}
                      onLoad={() => URL.revokeObjectURL(url)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label="Remover imagem"
                      title="Remover"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="row gap right" style={{ marginTop: 18 }}>
          <button type="button" className="ghost" onClick={close}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting
              ? 'Salvando…'
              : pendingImages.length > 0
                ? `Criar + ${pendingImages.length} img`
                : 'Criar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
