'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { updateQuestionLocal, useStore, selectActiveQuestions } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { dedupeKey } from '@/lib/validation';
import type {
  Alternativa,
  DiscursivaPayload,
  ObjetivaPayload,
  Question,
  QuestionFonte,
  QuestionOrigem,
  QuestionVerificacao,
} from '@/lib/types';
import { toast } from './Toast';

/**
 * Drawer modal pra edição inline de questão.
 *
 * Validação:
 *  - Campos top-level (disciplina_id, tema, banca_estilo, dificuldade,
 *    tags) sempre disponíveis.
 *  - Payload editado por tipo (objetiva tem alternativas/gabarito;
 *    discursiva tem enunciado_completo + espelho_resposta).
 *  - Dedup-aware: ao salvar, calcula dedupeKey do estado novo e
 *    compara com as outras questões. Se colidir, avisa o user e
 *    NÃO salva. Idempotente: editar e re-salvar sem mudar enunciado
 *    não é colisão (compara contra ela mesma).
 *
 * Segurança:
 *  - Limites de comprimento espelham CHECK constraints da migration
 *    0002 (e validation.ts).
 *  - Tags: input freeform com vírgula como separador, normalizado
 *    em trim + dedup case-insensitive + max 30 (DB enforcement
 *    reforça).
 *  - Não toca em srs/stats/history/dedup_hash (estes são derivados
 *    ou propriedade do sistema).
 */
export function QuestionEditDrawer({
  question,
  onClose,
}: {
  question: Question;
  onClose: () => void;
}) {
  const allActive = useStore(selectActiveQuestions);
  const dlgRef = useRef<HTMLDialogElement>(null);

  // Top-level
  const [discId, setDiscId] = useState(question.disciplina_id ?? '');
  const [tema, setTema] = useState(question.tema ?? '');
  const [banca, setBanca] = useState(question.banca_estilo ?? '');
  const [dif, setDif] = useState(
    question.dificuldade != null ? String(question.dificuldade) : ''
  );
  const [tagsStr, setTagsStr] = useState((question.tags ?? []).join(', '));

  // Payload (typed via discriminator)
  const [enun, setEnun] = useState(() => extractEnunciado(question));
  const [explicacao, setExplicacao] = useState(() => {
    if (question.type === 'objetiva')
      return (question.payload as ObjetivaPayload).explicacao_geral ?? '';
    return '';
  });
  const [espelho, setEspelho] = useState(() => {
    if (question.type === 'discursiva')
      return (question.payload as DiscursivaPayload).espelho_resposta ?? '';
    return '';
  });
  const [notesUser, setNotesUser] = useState(
    question.payload.notes_user ?? ''
  );
  const [alts, setAlts] = useState<EditableAlt[]>(() => {
    if (question.type !== 'objetiva') return [];
    const p = question.payload as ObjetivaPayload;
    return (p.alternativas ?? []).map((a) => ({
      letra: a.letra,
      texto: a.texto,
      correta: !!a.correta,
      explicacao: a.explicacao ?? '',
    }));
  });

  // Origem / fonte / verificação (migration 0003)
  const [origem, setOrigem] = useState<'' | QuestionOrigem>(question.origem ?? '');
  const [verif, setVerif] = useState<'' | QuestionVerificacao>(
    question.verificacao ?? ''
  );
  const initialFonte = question.fonte ?? {};
  const [fBanca, setFBanca] = useState(
    typeof initialFonte.banca === 'string' ? initialFonte.banca : ''
  );
  const [fAno, setFAno] = useState(
    typeof initialFonte.ano === 'number' ? String(initialFonte.ano) : ''
  );
  const [fOrgao, setFOrgao] = useState(
    typeof initialFonte.orgao === 'string' ? initialFonte.orgao : ''
  );
  const [fOrgaoNome, setFOrgaoNome] = useState(
    typeof initialFonte.orgao_nome === 'string' ? initialFonte.orgao_nome : ''
  );
  const [fCargo, setFCargo] = useState(
    typeof initialFonte.cargo === 'string' ? initialFonte.cargo : ''
  );
  const [fProva, setFProva] = useState(
    typeof initialFonte.prova === 'string' ? initialFonte.prova : ''
  );
  const [fLink, setFLink] = useState(
    typeof initialFonte.link === 'string' ? initialFonte.link : ''
  );

  const [submitting, setSubmitting] = useState(false);

  // Abre o dialog (showModal só funciona após mount)
  useEffect(() => {
    if (dlgRef.current && !dlgRef.current.open) {
      try {
        dlgRef.current.showModal();
      } catch {
        onClose();
      }
    }
  }, [onClose]);

  // Outras questões pra checagem de dedup (excluindo a própria)
  const outrasKeys = useMemo(() => {
    const set = new Set<string>();
    for (const q of allActive) {
      if (q.id !== question.id) set.add(dedupeKey(q));
    }
    return set;
  }, [allActive, question.id]);

  const close = (saved: boolean) => {
    if (dlgRef.current?.open) dlgRef.current.close();
    onClose();
    if (saved) toast('Questão atualizada', 'success');
  };

  const validateAndBuildPatch = (): {
    patch: Partial<Question>;
    error: string | null;
  } => {
    const trim = (s: string) => s.trim();

    if (trim(discId).length > 200)
      return { patch: {}, error: 'disciplina_id: máximo 200 caracteres' };
    if (trim(tema).length > 200)
      return { patch: {}, error: 'tema: máximo 200 caracteres' };
    if (trim(banca).length > 100)
      return { patch: {}, error: 'banca: máximo 100 caracteres' };

    let dificuldade: number | null = null;
    if (dif.trim()) {
      const n = Number(dif);
      if (!Number.isInteger(n) || n < 1 || n > 5)
        return { patch: {}, error: 'dificuldade: inteiro entre 1 e 5' };
      dificuldade = n;
    }

    // Tags: split por vírgula, trim, remove vazias, dedup case-insensitive, cap 30
    const tagsRaw = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const tagsLower = new Map<string, string>();
    for (const t of tagsRaw) {
      const k = t.toLowerCase();
      if (!tagsLower.has(k)) tagsLower.set(k, t);
    }
    const tags = Array.from(tagsLower.values());
    if (tags.length > 30)
      return { patch: {}, error: 'tags: máximo 30 (DB cap)' };
    for (const t of tags) {
      if (t.length > 100)
        return { patch: {}, error: `tag "${t.slice(0, 20)}…" muito longa (max 100)` };
    }

    if (!trim(enun))
      return { patch: {}, error: 'enunciado: obrigatório' };
    if (trim(enun).length > 50_000)
      return { patch: {}, error: 'enunciado: máximo 50.000 caracteres' };

    if (notesUser.length > 10_000)
      return { patch: {}, error: 'notas: máximo 10.000 caracteres' };

    const notesNorm = notesUser.trim() || undefined;

    let payload: ObjetivaPayload | DiscursivaPayload;
    if (question.type === 'objetiva') {
      // Validação de alternativas
      const altsClean = alts
        .map((a) => ({
          letra: trim(a.letra),
          texto: a.texto, // não trim — pode ter quebra de linha intencional
          correta: !!a.correta,
          explicacao: a.explicacao,
        }))
        .filter((a) => a.letra && a.texto.trim());
      if (altsClean.length < 2)
        return { patch: {}, error: 'alternativas: mínimo 2' };
      const letras = new Set<string>();
      for (const a of altsClean) {
        const k = a.letra.toUpperCase();
        if (letras.has(k))
          return { patch: {}, error: `letra "${a.letra}" repetida` };
        letras.add(k);
      }
      const corretas = altsClean.filter((a) => a.correta);
      if (corretas.length === 0)
        return {
          patch: {},
          error: 'marque ao menos uma alternativa correta',
        };
      if (corretas.length > 1)
        return { patch: {}, error: 'apenas uma alternativa pode ser correta' };

      const prevPayload = question.payload as ObjetivaPayload;
      payload = {
        ...prevPayload,
        enunciado: enun,
        alternativas: altsClean,
        gabarito: corretas[0].letra,
        explicacao_geral: explicacao || undefined,
        notes_user: notesNorm,
      };
    } else {
      const prevPayload = question.payload as DiscursivaPayload;
      payload = {
        ...prevPayload,
        enunciado_completo: enun,
        espelho_resposta: espelho || prevPayload.espelho_resposta,
        notes_user: notesNorm,
      };
    }

    // Origem / fonte / verificação
    let fonte: QuestionFonte = { ...(question.fonte ?? {}) };
    // Limpa campos que o user pode ter esvaziado e re-popula com inputs
    delete fonte.banca;
    delete fonte.ano;
    delete fonte.orgao;
    delete fonte.orgao_nome;
    delete fonte.cargo;
    delete fonte.prova;
    delete fonte.link;
    if (trim(fBanca)) fonte.banca = trim(fBanca);
    if (fAno.trim()) {
      const n = Number(fAno);
      if (!Number.isInteger(n) || n < 1980 || n > 2100)
        return { patch: {}, error: 'fonte.ano: inteiro entre 1980 e 2100' };
      fonte.ano = n;
    }
    if (trim(fOrgao)) fonte.orgao = trim(fOrgao);
    if (trim(fOrgaoNome)) fonte.orgao_nome = trim(fOrgaoNome);
    if (trim(fCargo)) fonte.cargo = trim(fCargo);
    if (trim(fProva)) fonte.prova = trim(fProva);
    if (trim(fLink)) {
      if (!/^https?:\/\/.+/i.test(trim(fLink)))
        return { patch: {}, error: 'fonte.link: deve começar com http:// ou https://' };
      fonte.link = trim(fLink);
    }
    if (origem === 'real') {
      if (!fonte.banca)
        return { patch: {}, error: 'origem real exige fonte.banca' };
      if (typeof fonte.ano !== 'number')
        return { patch: {}, error: 'origem real exige fonte.ano (número)' };
    }

    const patch: Partial<Question> = {
      disciplina_id: trim(discId) || null,
      tema: trim(tema) || null,
      banca_estilo: trim(banca) || null,
      dificuldade,
      tags,
      payload,
      origem: origem || null,
      fonte,
      verificacao: verif || null,
    };

    // Dedup check
    const newKey = dedupeKey({
      type: question.type,
      disciplina_id: patch.disciplina_id ?? null,
      payload: patch.payload!,
    });
    if (outrasKeys.has(newKey)) {
      return {
        patch: {},
        error:
          'Outra questão com mesmo enunciado e disciplina já existe. Mude um dos dois pra evitar duplicata.',
      };
    }

    return { patch, error: null };
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const { patch, error } = validateAndBuildPatch();
    if (error) {
      toast(error, 'error');
      setSubmitting(false);
      return;
    }
    updateQuestionLocal(question.id, patch);
    scheduleSync(500);
    setSubmitting(false);
    close(true);
  };

  const addAlt = () => {
    const usedLetras = new Set(alts.map((a) => a.letra.toUpperCase()));
    const candidato = 'ABCDEFGHIJK'
      .split('')
      .find((l) => !usedLetras.has(l));
    setAlts([
      ...alts,
      { letra: candidato ?? String(alts.length + 1), texto: '', correta: false, explicacao: '' },
    ]);
  };

  const removeAlt = (i: number) => setAlts(alts.filter((_, idx) => idx !== i));

  const updateAlt = <K extends keyof EditableAlt>(
    i: number,
    field: K,
    value: EditableAlt[K]
  ) => {
    setAlts((cur) =>
      cur.map((a, idx) => {
        if (idx !== i) return a;
        // Garantir só 1 correta
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

  return (
    <dialog
      ref={dlgRef}
      onClose={() => close(false)}
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
          <h2 style={{ margin: 0 }}>
            Editar questão{' '}
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              ({question.type})
            </span>
          </h2>
          <button
            type="button"
            className="ghost icon"
            onClick={() => close(false)}
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Top-level */}
        <div className="form-grid">
          <label>
            <span>Disciplina (string)</span>
            <input
              type="text"
              value={discId}
              onChange={(e) => setDiscId(e.target.value)}
              maxLength={200}
              placeholder="ex: Português"
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
          <span style={{ fontSize: '0.85rem' }}>
            Tags (separadas por vírgula, max 30)
          </span>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="ex: pegadinha-FGV, art.5-CF, súmula-vinculante-13"
          />
        </label>

        {/* Enunciado */}
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
          />
        </label>

        {/* Específico por tipo */}
        {question.type === 'objetiva' ? (
          <ObjetivaEditor
            alts={alts}
            explicacao={explicacao}
            setExplicacao={setExplicacao}
            addAlt={addAlt}
            removeAlt={removeAlt}
            updateAlt={updateAlt}
          />
        ) : (
          <DiscursivaEditor espelho={espelho} setEspelho={setEspelho} />
        )}

        {/* Origem / Fonte / Verificação — colapsável */}
        <details
          style={{
            marginBottom: 14,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            background: 'var(--bg-elev-2)',
          }}
          open={origem === 'real' || !!verif}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            Origem & verificação
            {origem && (
              <span className="muted" style={{ marginLeft: 8, fontSize: '0.85rem' }}>
                — {origem}{verif ? ` · ${verif}` : ''}
              </span>
            )}
          </summary>
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <label>
                <span>Origem</span>
                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value as typeof origem)}
                >
                  <option value="">— não classificada —</option>
                  <option value="real">📋 Real (de prova oficial)</option>
                  <option value="autoral">✏️ Autoral (criada por mim/IA)</option>
                  <option value="adaptada">🔧 Adaptada (real modificada)</option>
                </select>
              </label>
              <label>
                <span>Verificação</span>
                <select
                  value={verif}
                  onChange={(e) => setVerif(e.target.value as typeof verif)}
                >
                  <option value="">— sem status —</option>
                  <option value="verificada">✅ Verificada</option>
                  <option value="pendente">⏳ Pendente</option>
                  <option value="duvidosa">⚠️ Duvidosa</option>
                </select>
              </label>
            </div>

            {(origem === 'real' || origem === 'adaptada' || fBanca || fAno) && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: 'var(--bg-elev)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <p
                  className="muted"
                  style={{ margin: '0 0 8px', fontSize: '0.82rem' }}
                >
                  Fonte da prova
                  {origem === 'real' && (
                    <strong> — banca e ano são obrigatórios pra origem real</strong>
                  )}
                </p>
                <div className="form-grid">
                  <label>
                    <span>Banca {origem === 'real' && '*'}</span>
                    <input
                      type="text"
                      value={fBanca}
                      onChange={(e) => setFBanca(e.target.value)}
                      maxLength={100}
                      placeholder="ex: FGV, CESPE, FCC"
                    />
                  </label>
                  <label>
                    <span>Ano {origem === 'real' && '*'}</span>
                    <input
                      type="number"
                      min={1980}
                      max={2100}
                      step={1}
                      value={fAno}
                      onChange={(e) => setFAno(e.target.value)}
                      placeholder="ex: 2025"
                    />
                  </label>
                  <label>
                    <span>Órgão (sigla)</span>
                    <input
                      type="text"
                      value={fOrgao}
                      onChange={(e) => setFOrgao(e.target.value)}
                      maxLength={200}
                      placeholder="ex: MPE RJ"
                    />
                  </label>
                  <label>
                    <span>Cargo</span>
                    <input
                      type="text"
                      value={fCargo}
                      onChange={(e) => setFCargo(e.target.value)}
                      maxLength={200}
                      placeholder="ex: Analista"
                    />
                  </label>
                </div>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>Órgão (nome completo)</span>
                  <input
                    type="text"
                    value={fOrgaoNome}
                    onChange={(e) => setFOrgaoNome(e.target.value)}
                    maxLength={300}
                    placeholder="ex: Ministério Público do Estado do Rio de Janeiro"
                  />
                </label>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>Prova / área</span>
                  <input
                    type="text"
                    value={fProva}
                    onChange={(e) => setFProva(e.target.value)}
                    maxLength={300}
                    placeholder="ex: Tecnologia da Informação"
                  />
                </label>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>Link (opcional)</span>
                  <input
                    type="url"
                    value={fLink}
                    onChange={(e) => setFLink(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </div>
            )}
          </div>
        </details>

        {/* Anotações pessoais — sempre disponível */}
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: '0.85rem' }}>
            Suas anotações (privadas, max 10k chars)
          </span>
          <textarea
            value={notesUser}
            onChange={(e) => setNotesUser(e.target.value)}
            rows={3}
            maxLength={10_000}
            placeholder="Ex: pegadinha — FGV troca 'sempre' por 'na maioria dos casos'"
          />
        </label>

        <div className="row gap right" style={{ marginTop: 18 }}>
          <button type="button" className="ghost" onClick={() => close(false)}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

type EditableAlt = {
  letra: string;
  texto: string;
  correta: boolean;
  explicacao: string;
};

function ObjetivaEditor({
  alts,
  explicacao,
  setExplicacao,
  addAlt,
  removeAlt,
  updateAlt,
}: {
  alts: EditableAlt[];
  explicacao: string;
  setExplicacao: (s: string) => void;
  addAlt: () => void;
  removeAlt: (i: number) => void;
  updateAlt: <K extends keyof EditableAlt>(
    i: number,
    field: K,
    value: EditableAlt[K]
  ) => void;
}) {
  return (
    <>
      <fieldset
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 12,
          marginBottom: 14,
        }}
      >
        <legend
          style={{ padding: '0 6px', fontSize: '0.88rem' }}
          className="muted"
        >
          Alternativas (marque uma como correta)
        </legend>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {alts.map((a, i) => (
            <div
              key={i}
              className="row gap"
              style={{ alignItems: 'flex-start' }}
            >
              <input
                type="radio"
                name="alt-correta"
                checked={a.correta}
                onChange={(e) => updateAlt(i, 'correta', e.target.checked)}
                style={{ marginTop: 10, flexShrink: 0 }}
                title="Marcar como correta"
              />
              <input
                type="text"
                value={a.letra}
                onChange={(e) => updateAlt(i, 'letra', e.target.value)}
                maxLength={5}
                placeholder="A"
                style={{ width: 56, flexShrink: 0 }}
              />
              <textarea
                value={a.texto}
                onChange={(e) => updateAlt(i, 'texto', e.target.value)}
                rows={2}
                style={{ flex: 1 }}
                placeholder="Texto da alternativa"
              />
              <button
                type="button"
                className="danger"
                onClick={() => removeAlt(i)}
                aria-label="Remover alternativa"
                title="Remover"
                style={{ marginTop: 6 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="ghost"
          onClick={addAlt}
          style={{ marginTop: 10 }}
          disabled={alts.length >= 8}
        >
          + Adicionar alternativa
        </button>
      </fieldset>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>Explicação geral (opcional)</span>
        <textarea
          value={explicacao}
          onChange={(e) => setExplicacao(e.target.value)}
          rows={4}
        />
      </label>
    </>
  );
}

function DiscursivaEditor({
  espelho,
  setEspelho,
}: {
  espelho: string;
  setEspelho: (s: string) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 14,
      }}
    >
      <span style={{ fontSize: '0.85rem' }}>
        Espelho de resposta (referência pra autoavaliação)
      </span>
      <textarea
        value={espelho}
        onChange={(e) => setEspelho(e.target.value)}
        rows={6}
      />
      <span className="muted" style={{ fontSize: '0.78rem' }}>
        Quesitos, rubrica, conceitos-chave etc. permanecem como estão (edição
        avançada virá em etapa futura).
      </span>
    </label>
  );
}

function extractEnunciado(q: Question): string {
  if (q.type === 'objetiva') {
    return (q.payload as ObjetivaPayload).enunciado ?? '';
  }
  const p = q.payload as DiscursivaPayload;
  return p.enunciado_completo ?? p.enunciado ?? p.comando ?? '';
}
