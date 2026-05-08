'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useStore,
  selectActiveQuestions,
  selectDisciplinas,
  deleteQuestionsBulk,
  updateQuestionLocal,
} from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import Link from 'next/link';
import { fmtRelative } from '@/lib/format';
import { DAY_MS } from '@/lib/srs';
import { hasMath, startOfDay } from '@/lib/utils';
import {
  matchActiveConcursoFull,
  useActiveConcursoFilter,
  useConcursos,
  useDisciplinas,
  useTopicos,
} from '@/lib/hierarchy';
import { useQuestionConcursoLinks } from '@/lib/question-concursos';
import { setActiveConcursoId } from '@/lib/settings';
import { saveQueue } from '@/lib/study-queue';
import { PlanLimitBanner } from './PlanLimitBanner';
import { confirmDialog } from './ConfirmDialog';
import { QuestionCreateDrawer } from './QuestionCreateDrawer';
import { VoiceSearchButton } from './VoiceSearchButton';
import { QuestionQuickActions } from './QuestionQuickActions';
import { useLongPress } from '@/lib/use-long-press';
import { BookmarkButton } from './BookmarkButton';
import { GabaritoSourceBadge } from './GabaritoSourceBadge';
import { SearchHistoryDropdown } from './SearchHistoryDropdown';
import { saveSearchHistory } from '@/lib/search-history';
import { BancoItemSkeleton } from './BancoItemSkeleton';
import { ShareDeckButton } from './ShareDeckButton';
import { AIGenerateButton } from './AIGenerateButton';
import { AIClozeFromTextButton } from './AIClozeFromTextButton';
import { AIOCRButton } from './AIOCRButton';
import { AIToolbarFallback } from './AIToolbarFallback';
import { TagMergeDialog } from './TagMergeDialog';
import { BancoBrowse } from './BancoBrowse';
import { QuestionEditDrawer } from './QuestionEditDrawer';
import { toast } from './Toast';
import type { ObjetivaPayload, DiscursivaPayload, Question } from '@/lib/types';

/**
 * Destaca termos da busca no preview. Tokens com prefixos
 * (tag:foo / disc:bar / banca:FGV) NÃO são highlighted no enunciado
 * — só os termos livres. Escapa HTML antes de inserir mark.
 */
function highlightSearch(text: string, search: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const tokens = search
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (t) =>
        !t.startsWith('tag:') && !t.startsWith('disc:') && !t.startsWith('banca:')
    );
  if (tokens.length === 0) return escaped;
  // Regex case-insensitive com todos os termos
  const escapedTokens = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);
  if (escapedTokens.length === 0) return escaped;
  const re = new RegExp('(' + escapedTokens.join('|') + ')', 'gi');
  return escaped.replace(
    re,
    '<mark style="background:var(--primary-soft);color:var(--primary);padding:0 2px;border-radius:2px;">$1</mark>'
  );
}

function previewOf(q: Question): string {
  if (q.type === 'objetiva') return (q.payload as ObjetivaPayload).enunciado || '';
  if (q.type === 'discursiva') {
    const p = q.payload as DiscursivaPayload;
    return p.enunciado_completo || p.enunciado || p.comando || '';
  }
  if (q.type === 'cloze') {
    const p = q.payload as { texto?: string };
    return (p.texto ?? '').replace(/\{\{c\d+::([^}]+?)(?:::[^}]+?)?\}\}/g, '$1');
  }
  if (q.type === 'flashcard') {
    const p = q.payload as { frente?: string };
    return p.frente ?? '';
  }
  return '';
}

export function BancoList() {
  const questions = useStore(selectActiveQuestions);
  const disciplinas = useStore(selectDisciplinas);
  const { data: discMeta } = useDisciplinas();
  const hydrated = useStore((s) => s.hydrated);
  // Delay igual ao Dashboard pra não flashar empty state durante seed
  const [emptyAllowed, setEmptyAllowed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEmptyAllowed(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const syncStatus = useStore((s) => s.syncStatus);
  const lastPullAt = useStore((s) => s.lastPullAt);
  const firstSyncInFlight = syncStatus === 'syncing' && !lastPullAt;
  const router = useRouter();
  const params = useSearchParams();
  // Aplica filtros vindos da URL na primeira render. Idempotente — só
  // seta uma vez (initialApplied), pra não atropelar mudanças do user.
  const initialAppliedRef = useRef(false);

  // Mapa nome → cor pra color-coding rápido nos itens
  const discCorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of discMeta ?? []) {
      if (d.cor) m.set(d.nome.toLowerCase(), d.cor);
    }
    return m;
  }, [discMeta]);

  const [search, setSearch] = useState('');
  const [disc, setDisc] = useState('');
  const [tipo, setTipo] = useState<'' | 'objetiva' | 'discursiva'>('');
  const [origem, setOrigem] = useState<'' | 'real' | 'autoral' | 'adaptada'>('');
  const [verif, setVerif] = useState<'' | 'verificada' | 'pendente' | 'duvidosa' | 'sem_verif'>('');
  const [gabSourceFilter, setGabSourceFilter] = useState<
    '' | 'ia' | 'oficial' | 'crowd' | 'sem_source'
  >('');
  const [srsFilter, setSrsFilter] = useState<
    '' | 'atrasadas' | 'hoje' | 'novas' | 'recentes' | 'sem_estudo' | 'dominadas' | 'inimigas'
  >('');
  const [imgFilter, setImgFilter] = useState<'' | 'com' | 'sem'>('');
  const [notasFilter, setNotasFilter] = useState<'' | 'com' | 'sem'>('');
  const [mnemoFilter, setMnemoFilter] = useState<'' | 'com' | 'sem'>('');
  const [latexFilter, setLatexFilter] = useState<'' | 'com' | 'sem'>('');
  const [tempoFilter, setTempoFilter] = useState<
    '' | 'hoje' | 'ontem' | 'semana' | 'nunca'
  >('');
  const [favFilter, setFavFilter] = useState<boolean>(false);
  type SortBy =
    | 'recente'
    | 'antiga'
    | 'atualizada'
    | 'due_asc'
    | 'attempts_desc'
    | 'acerto_asc'
    | 'dificuldade_desc'
    | 'last_reviewed_asc';
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    if (typeof window === 'undefined') return 'recente';
    try {
      const v = localStorage.getItem('estudo-simples:banco:sort');
      const valid: SortBy[] = [
        'recente',
        'antiga',
        'atualizada',
        'due_asc',
        'attempts_desc',
        'acerto_asc',
        'dificuldade_desc',
        'last_reviewed_asc',
      ];
      if (v && (valid as string[]).includes(v)) return v as SortBy;
    } catch {}
    return 'recente';
  });
  useEffect(() => {
    try {
      localStorage.setItem('estudo-simples:banco:sort', sortBy);
    } catch {}
  }, [sortBy]);
  const [compact, setCompact] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('estudo-simples:banco:compact') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        'estudo-simples:banco:compact',
        compact ? '1' : '0'
      );
    } catch {}
  }, [compact]);

  // Persiste e restaura scroll position do /banco entre navegações.
  // Salva sempre que o user rola; restaura ao montar (uma vez).
  useEffect(() => {
    const KEY = 'estudo-simples:banco:scrollY';
    const onScroll = () => {
      try {
        sessionStorage.setItem(KEY, String(window.scrollY));
      } catch {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Restaura na próxima frame (após o layout estabilizar)
    requestAnimationFrame(() => {
      try {
        const v = sessionStorage.getItem(KEY);
        if (v) window.scrollTo(0, parseInt(v, 10));
      } catch {}
    });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Aplica filtros via URL query (?search=foo, ?srs=inimigas, etc.)
  useEffect(() => {
    if (initialAppliedRef.current) return;
    initialAppliedRef.current = true;
    const s = params.get('search');
    if (s) setSearch(s);
    const qid = params.get('qid');
    if (qid) {
      // Abre o drawer da questão. Necessário aguardar hydrate.
      setTimeout(() => setEditingId(qid), 100);
    }
    const srs = params.get('srs');
    if (srs && ['atrasadas', 'hoje', 'novas', 'recentes', 'sem_estudo', 'dominadas', 'inimigas'].includes(srs)) {
      setSrsFilter(srs as typeof srsFilter);
    }
    const tipoP = params.get('tipo');
    if (tipoP && ['objetiva', 'discursiva'].includes(tipoP)) {
      setTipo(tipoP as typeof tipo);
    }
    const discP = params.get('disc');
    if (discP) setDisc(discP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  // Filtros salvos como preset (localStorage). Não sincroniza entre
  // dispositivos — preferência local.
  type Preset = {
    nome: string;
    search: string;
    disc: string;
    tipo: typeof tipo;
    origem: typeof origem;
    verif: typeof verif;
    srsFilter: typeof srsFilter;
    imgFilter: typeof imgFilter;
  };
  const PRESET_KEY = 'estudo-simples:banco:presets';
  const [presets, setPresets] = useState<Preset[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return [];
  });
  const persistPresets = (next: Preset[]) => {
    setPresets(next);
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    } catch {}
  };
  const saveCurrentAsPreset = () => {
    const nome = window.prompt('Nome do preset:', '');
    if (!nome || !nome.trim()) return;
    const novo: Preset = {
      nome: nome.trim(),
      search,
      disc,
      tipo,
      origem,
      verif,
      srsFilter,
      imgFilter,
    };
    persistPresets([...presets.filter((p) => p.nome !== novo.nome), novo]);
    toast(`Preset "${novo.nome}" salvo.`, 'success');
  };
  const applyPreset = (p: Preset) => {
    setSearch(p.search);
    setDisc(p.disc);
    setTipo(p.tipo);
    setOrigem(p.origem);
    setVerif(p.verif);
    setSrsFilter(p.srsFilter);
    setImgFilter(p.imgFilter);
  };
  const removePreset = (nome: string) => {
    persistPresets(presets.filter((p) => p.nome !== nome));
  };
  // Atalhos de teclado: índice da questão "focada" na lista filtrada.
  // -1 = sem foco. j/k navega, Enter edita, espaço seleciona, x exclui.
  const [focusedIdx, setFocusedIdx] = useState(-1);
  // Long-press no /banco mobile abre menu rápido de ações
  const [quickActionsQ, setQuickActionsQ] = useState<Question | null>(null);
  // Search history: salva 1.5s após user parar de digitar (debounce)
  const [searchHistoryRefresh, setSearchHistoryRefresh] = useState(0);
  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(() => {
      saveSearchHistory(search);
      setSearchHistoryRefresh((n) => n + 1);
    }, 1500);
    return () => clearTimeout(t);
  }, [search]);
  const longPress = useLongPress((target) => {
    const id = target.getAttribute('data-banco-qid');
    if (!id) return;
    const q = questions.find((x) => x.id === id);
    if (q) setQuickActionsQ(q);
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Paginação visual: render só os primeiros N pra evitar travar com
  // milhares de cards. Mobile: 25 (telas menores rolam mais);
  // desktop: 100. User pode "carregar mais" pra estender.
  const [pageSize, setPageSize] = useState(100);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const isMobile = window.matchMedia('(max-width: 759px)').matches;
      setPageSize(isMobile ? 25 : 100);
    };
    sync();
    const mq = window.matchMedia('(max-width: 759px)');
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const [visibleCount, setVisibleCount] = useState(100);
  // Re-sync visibleCount quando pageSize muda (boot mobile)
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize]);
  // Toggle pra colapsar filtros em mobile (default fechado)
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Em desktop, filtros sempre abertos por default
    const isMobile = window.matchMedia('(max-width: 759px)').matches;
    setFiltersOpen(!isMobile);
  }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tagMergeOpen, setTagMergeOpen] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const editingQuestion = useMemo(
    () => (editingId ? questions.find((q) => q.id === editingId) ?? null : null),
    [questions, editingId]
  );

  const { concurso: activeConcurso, disciplinaNomes: concursoDiscNomes } =
    useActiveConcursoFilter();
  const questionLinks = useQuestionConcursoLinks();

  // Reset paginação + foco quando filtros mudam
  const filtersKey = `${search}|${disc}|${tipo}|${origem}|${verif}|${srsFilter}|${imgFilter}|${notasFilter}|${latexFilter}|${tempoFilter}|${favFilter}`;
  useMemo(() => {
    setVisibleCount(pageSize);
    setFocusedIdx(-1);
  }, [filtersKey]);

  const filtered = useMemo(() => {
    // Parse prefixos: "tag:foo disc:bar banca:FGV resto livre"
    // Texto livre (sem prefixo) vai pra full-text search.
    const tokens = search.trim().split(/\s+/).filter(Boolean);
    const tagFilters: string[] = [];
    const discFilters: string[] = [];
    const bancaFilters: string[] = [];
    const idFilters: string[] = [];
    let dueWithinDays: number | null = null; // due:7d → 7
    let onlyBookmarked = false;
    const freeTextParts: string[] = [];
    for (const tok of tokens) {
      const lower = tok.toLowerCase();
      if (lower.startsWith('tag:')) tagFilters.push(tok.slice(4).toLowerCase());
      else if (lower.startsWith('disc:')) discFilters.push(tok.slice(5).toLowerCase());
      else if (lower.startsWith('banca:')) bancaFilters.push(tok.slice(6).toLowerCase());
      else if (lower.startsWith('id:')) idFilters.push(tok.slice(3));
      else if (lower.startsWith('due:')) {
        const v = lower.slice(4);
        const m = /^(\d+)d?$/.exec(v);
        if (m) dueWithinDays = parseInt(m[1], 10);
      } else if (lower === 'bookmark:1' || lower === 'fav:1' || lower === '⭐') {
        onlyBookmarked = true;
      } else freeTextParts.push(tok.toLowerCase());
    }
    const txt = freeTextParts.join(' ');

    const now = Date.now();
    const tomorrow = startOfDay(now) + DAY_MS;
    const sevenDaysAgo = now - 7 * DAY_MS;
    return questions.filter((q) => {
      if (
        !matchActiveConcursoFull(
          q,
          activeConcurso?.id ?? null,
          concursoDiscNomes,
          questionLinks
        )
      )
        return false;
      if (disc && q.disciplina_id !== disc) return false;
      if (tipo && q.type !== tipo) return false;
      if (onlyBookmarked) {
        const p = q.payload as Record<string, unknown>;
        if (p.bookmarked !== true) return false;
      }
      // id:XYZ filtra a questão específica
      if (idFilters.length > 0) {
        if (!idFilters.some((id) => q.id.startsWith(id))) return false;
      }
      // due:Xd filtra questões com dueDate dentro dos próximos X dias
      if (dueWithinDays !== null) {
        const due = q.srs?.dueDate ?? Infinity;
        const limit = now + dueWithinDays * DAY_MS;
        if (due > limit) return false;
      }
      // Prefixos
      if (tagFilters.length > 0) {
        const tagsLower = (q.tags ?? []).map((t) => t.toLowerCase());
        const allMatch = tagFilters.every((tf) =>
          tagsLower.some((t) => t.includes(tf))
        );
        if (!allMatch) return false;
      }
      if (discFilters.length > 0) {
        const dLower = (q.disciplina_id ?? '').toLowerCase();
        const allMatch = discFilters.every((df) => dLower.includes(df));
        if (!allMatch) return false;
      }
      if (bancaFilters.length > 0) {
        const bancaLower = (
          (typeof q.fonte?.banca === 'string' && q.fonte.banca) ||
          q.banca_estilo ||
          ''
        ).toLowerCase();
        const allMatch = bancaFilters.every((bf) => bancaLower.includes(bf));
        if (!allMatch) return false;
      }
      if (imgFilter) {
        const imgs = (q.payload as { imagens?: string[] }).imagens;
        const has = Array.isArray(imgs) && imgs.length > 0;
        if (imgFilter === 'com' && !has) return false;
        if (imgFilter === 'sem' && has) return false;
      }
      if (mnemoFilter) {
        const has = !!(q.payload as { mnemonic?: string }).mnemonic;
        if (mnemoFilter === 'com' && !has) return false;
        if (mnemoFilter === 'sem' && has) return false;
      }
      if (notasFilter) {
        const notas = (q.payload as { notes_user?: string }).notes_user;
        const has = typeof notas === 'string' && notas.trim().length > 0;
        if (notasFilter === 'com' && !has) return false;
        if (notasFilter === 'sem' && has) return false;
      }
      if (latexFilter) {
        const has = hasMath(previewOf(q));
        if (latexFilter === 'com' && !has) return false;
        if (latexFilter === 'sem' && has) return false;
      }
      if (srsFilter) {
        const due = q.srs?.dueDate ?? 0;
        const lastReviewed = q.srs?.lastReviewed;
        const createdAt = q.created_at ? new Date(q.created_at).getTime() : 0;
        if (srsFilter === 'atrasadas') {
          if (due >= startOfDay(now)) return false;
        } else if (srsFilter === 'hoje') {
          if (due >= tomorrow || due < startOfDay(now)) return false;
        } else if (srsFilter === 'novas') {
          if (lastReviewed) return false;
        } else if (srsFilter === 'recentes') {
          if (createdAt < sevenDaysAgo) return false;
        } else if (srsFilter === 'sem_estudo') {
          if ((q.stats?.attempts ?? 0) > 0) return false;
        } else if (srsFilter === 'dominadas') {
          // 5+ acertos consecutivos no fim do histórico = memorizada
          const h = q.stats?.history || [];
          if (h.length < 5) return false;
          const ok = h
            .slice(-5)
            .every((r) => r.result === 'correct' || r.result === 'self_pass');
          if (!ok) return false;
        } else if (srsFilter === 'inimigas') {
          // >=3 tentativas E acerto < 30% = persiste errando
          const a = q.stats?.attempts ?? 0;
          const c = q.stats?.correct ?? 0;
          if (a < 3) return false;
          if (c / a >= 0.3) return false;
        }
      }
      if (favFilter && !isFav(q)) return false;
      if (tempoFilter) {
        const lastReviewed = q.srs?.lastReviewed ?? 0;
        const today0 = startOfDay(now);
        const yest0 = today0 - 24 * 60 * 60 * 1000;
        const week0 = today0 - 7 * 24 * 60 * 60 * 1000;
        if (tempoFilter === 'hoje') {
          if (lastReviewed < today0) return false;
        } else if (tempoFilter === 'ontem') {
          if (lastReviewed < yest0 || lastReviewed >= today0) return false;
        } else if (tempoFilter === 'semana') {
          if (lastReviewed < week0) return false;
        } else if (tempoFilter === 'nunca') {
          if (lastReviewed > 0) return false;
        }
      }
      if (origem) {
        // 'autoral' inclui legado (sem campo origem) — questões pré-migration
        // 0003 foram todas criadas pelo user, então conceitualmente autorais.
        if (origem === 'autoral') {
          if (q.origem && q.origem !== 'autoral') return false;
        } else {
          if (q.origem !== origem) return false;
        }
      }
      if (verif) {
        if (verif === 'sem_verif') {
          if (q.verificacao) return false;
        } else {
          if (q.verificacao !== verif) return false;
        }
      }
      if (gabSourceFilter) {
        const src = q.fonte?.gabarito_source ?? null;
        if (gabSourceFilter === 'sem_source') {
          if (src) return false;
        } else {
          if (src !== gabSourceFilter) return false;
        }
      }
      if (txt) {
        const hay = [
          q.tema,
          q.disciplina_id,
          q.banca_estilo,
          previewOf(q),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(txt)) return false;
      }
      return true;
    });
  }, [questions, search, disc, tipo, origem, verif, gabSourceFilter, srsFilter, imgFilter, notasFilter, mnemoFilter, latexFilter, tempoFilter, favFilter, activeConcurso, concursoDiscNomes, questionLinks]);

  // Aplica ordenação ao filtered (separado pra evitar re-trigger filter)
  const sorted = useMemo(() => {
    const arr = filtered.slice();
    const ts = (s: string) => (s ? new Date(s).getTime() : 0);
    switch (sortBy) {
      case 'recente':
        arr.sort((a, b) => ts(b.created_at) - ts(a.created_at));
        break;
      case 'antiga':
        arr.sort((a, b) => ts(a.created_at) - ts(b.created_at));
        break;
      case 'atualizada':
        arr.sort((a, b) => ts(b.updated_at) - ts(a.updated_at));
        break;
      case 'due_asc':
        arr.sort((a, b) => (a.srs?.dueDate ?? Infinity) - (b.srs?.dueDate ?? Infinity));
        break;
      case 'attempts_desc':
        arr.sort((a, b) => (b.stats?.attempts ?? 0) - (a.stats?.attempts ?? 0));
        break;
      case 'acerto_asc': {
        const pct = (q: typeof arr[number]) => {
          const a = q.stats?.attempts ?? 0;
          const c = q.stats?.correct ?? 0;
          return a > 0 ? c / a : 1.1; // sem tentativas vai pro fim
        };
        arr.sort((a, b) => pct(a) - pct(b));
        break;
      }
      case 'dificuldade_desc':
        arr.sort((a, b) => (b.dificuldade ?? 0) - (a.dificuldade ?? 0));
        break;
      case 'last_reviewed_asc':
        // Mais negligenciadas primeiro (sem revisão = -Infinity = topo).
        arr.sort(
          (a, b) =>
            (a.srs?.lastReviewed ?? -Infinity) -
            (b.srs?.lastReviewed ?? -Infinity)
        );
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  const toggle = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((cur) => {
      const next = new Set(cur);
      for (const q of filtered) next.add(q.id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((cur) => {
      const next = new Set(cur);
      for (const q of sorted.slice(0, visibleCount)) next.add(q.id);
      return next;
    });
  };

  const deleteOne = async (id: string) => {
    const ok = await confirmDialog({
      title: 'Excluir questão',
      message: 'Esta ação remove a questão do banco. Continuar?',
      danger: true,
    });
    if (!ok) return;
    deleteQuestionsBulk([id]);
    setSelected((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
    scheduleSync(500);
    toast('Questão excluída.', 'success');
  };

  const deleteSelected = async () => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const ok = await confirmDialog({
      title: 'Excluir selecionadas',
      message: `Remover ${selected.size} questão(ões) selecionada(s)?`,
      danger: true,
    });
    if (!ok) return;
    const ids = Array.from(selected);
    deleteQuestionsBulk(ids);
    setSelected(new Set());
    scheduleSync(500);
    toast(
      `${ids.length} excluída(s).`,
      'success',
      8000,
      {
        label: 'Desfazer',
        onClick: () => {
          for (const id of ids) {
            updateQuestionLocal(id, { deleted_at: null });
          }
          scheduleSync(500);
          toast(`${ids.length} restaurada(s).`, 'success');
        },
      }
    );
  };

  const bulkAddTags = async (tagsRaw: string) => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) {
      toast('Nenhuma tag válida.', 'warn');
      return;
    }
    let updated = 0;
    for (const id of selected) {
      const q = questions.find((x) => x.id === id);
      if (!q) continue;
      const existing = new Set((q.tags ?? []).map((t) => t.toLowerCase()));
      const novas: string[] = [...(q.tags ?? [])];
      for (const t of tags) {
        if (!existing.has(t.toLowerCase())) {
          novas.push(t);
          existing.add(t.toLowerCase());
        }
      }
      if (novas.length > 30) {
        toast(
          `Pulou ${q.id.slice(0, 6)}: ultrapassaria 30 tags`,
          'warn'
        );
        continue;
      }
      updateQuestionLocal(id, { tags: novas });
      updated++;
    }
    scheduleSync(500);
    toast(`Tags adicionadas a ${updated} questão(ões).`, 'success');
  };

  const bulkRemoveTags = async (tagsRaw: string) => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const tagsLower = new Set(
      tagsRaw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    );
    if (tagsLower.size === 0) {
      toast('Nenhuma tag válida.', 'warn');
      return;
    }
    let updated = 0;
    for (const id of selected) {
      const q = questions.find((x) => x.id === id);
      if (!q || !q.tags?.length) continue;
      const filtered = q.tags.filter((t) => !tagsLower.has(t.toLowerCase()));
      if (filtered.length === q.tags.length) continue;
      updateQuestionLocal(id, { tags: filtered });
      updated++;
    }
    scheduleSync(500);
    toast(`Tags removidas de ${updated} questão(ões).`, 'success');
  };

  // Sistema unificado de favorita usa payload.bookmarked (em vez de
  // tag '★' legado). Migra '★' do tags pra bookmarked ao tocar.
  const isFav = (q: {
    tags?: string[] | null;
    payload?: Record<string, unknown>;
  }) =>
    (q.payload?.bookmarked === true) ||
    !!q.tags?.includes('★');

  // Leech: questão errada 8+ vezes total. Anki-style — sinal forte
  // de que precisa abordagem diferente (rever fundamentos, mnemônico
  // específico, etc.).
  const isLeech = (q: { stats?: { wrong?: number } }) =>
    (q.stats?.wrong ?? 0) >= 8;

  const toggleFav = (id: string) => {
    const q = questions.find((x) => x.id === id);
    if (!q) return;
    const wasFav = isFav(q);
    const next = !wasFav;
    const cleanTags = (q.tags ?? []).filter((t) => t !== '★'); // migra
    updateQuestionLocal(id, (cur) => ({
      tags: cleanTags,
      payload: {
        ...(cur.payload as Record<string, unknown>),
        bookmarked: next,
      },
    }));
    scheduleSync(500);
  };

  const bulkSetDificuldade = async (valor: 1 | 2 | 3 | 4 | 5 | null) => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const label = valor === null ? 'sem dificuldade' : `dificuldade ${valor}`;
    const ok = await confirmDialog({
      title: 'Definir dificuldade em lote',
      message: `Marcar ${selected.size} questão(ões) com ${label}?`,
    });
    if (!ok) return;
    for (const id of selected) {
      updateQuestionLocal(id, { dificuldade: valor });
    }
    setSelected(new Set());
    scheduleSync(500);
    toast(`${selected.size} marcada(s) com ${label}.`, 'success');
  };

  const bulkSetVerificacao = async (
    valor: 'verificada' | 'pendente' | 'duvidosa' | null
  ) => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const label = valor ?? 'sem status';
    const ok = await confirmDialog({
      title: 'Marcar verificação em lote',
      message: `Marcar ${selected.size} questão(ões) como "${label}"?`,
    });
    if (!ok) return;
    for (const id of selected) {
      updateQuestionLocal(id, { verificacao: valor });
    }
    setSelected(new Set());
    scheduleSync(500);
    toast(`${selected.size} marcada(s) como ${label}.`, 'success');
  };

  /**
   * Bulk action otimizado pra "validar gabarito como oficial". Faz 3
   * mudanças atômicas em cada questão selecionada:
   *  1. fonte.gabarito_source = 'oficial'
   *  2. verificacao = 'verificada'
   *  3. tags: remove 'gabarito-ia' se presente (sincronia com source)
   *
   * Atalho pro workflow: importou IA → validou contra fonte oficial →
   * agora confirma que está certo. Sem esse bulk seria 3 cliques por
   * questão no editor, pra centenas de questões.
   */
  const bulkMarkGabaritoOficial = async () => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const ok = await confirmDialog({
      title: 'Marcar como gabarito oficial',
      message: `Marcar ${selected.size} questão(ões) como gabarito oficial verificado? Isso significa que você validou contra a fonte oficial e o gabarito está correto.`,
    });
    if (!ok) return;
    for (const id of selected) {
      const q = questions.find((qq) => qq.id === id);
      if (!q) continue;
      const newTags = (q.tags ?? []).filter((t) => t !== 'gabarito-ia');
      const newFonte = {
        ...(q.fonte ?? {}),
        gabarito_source: 'oficial' as const,
      };
      updateQuestionLocal(id, {
        verificacao: 'verificada',
        fonte: newFonte,
        tags: newTags,
      });
    }
    setSelected(new Set());
    scheduleSync(500);
    toast(`${selected.size} marcada(s) como oficiais.`, 'success');
  };

  const bulkSetBookmark = async (bookmarked: boolean) => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const label = bookmarked ? 'favoritar' : 'desfavoritar';
    const ok = await confirmDialog({
      title: bookmarked ? 'Favoritar em lote' : 'Desfavoritar em lote',
      message: `${bookmarked ? 'Marcar' : 'Desmarcar'} ${selected.size} questão(ões) como favorita?`,
    });
    if (!ok) return;
    for (const id of selected) {
      updateQuestionLocal(id, (q) => ({
        payload: {
          ...(q.payload as Record<string, unknown>),
          bookmarked,
        },
      }));
    }
    setSelected(new Set());
    scheduleSync(500);
    toast(`${selected.size} ${label}.`, 'success');
  };

  const bulkResetSrs = async () => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const ok = await confirmDialog({
      title: 'Limpar histórico de revisões',
      message: `Vai resetar SRS e stats de ${selected.size} questão(ões) — começam do zero. As questões em si permanecem. Continuar?`,
      danger: true,
    });
    if (!ok) return;
    const now = Date.now();
    const cleanSrs = {
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      dueDate: now,
      lastReviewed: null,
    };
    const cleanStats = {
      attempts: 0,
      correct: 0,
      wrong: 0,
      history: [],
    };
    for (const id of selected) {
      updateQuestionLocal(id, { srs: cleanSrs, stats: cleanStats });
    }
    setSelected(new Set());
    scheduleSync(500);
    toast(`Histórico resetado em ${selected.size} questão(ões).`, 'success');
  };

  const bulkSetConcurso = async (concursoId: string | null) => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const label = concursoId ? 'concurso selecionado' : 'sem concurso';
    const ok = await confirmDialog({
      title: 'Vincular ao concurso em lote',
      message: `Vincular ${selected.size} questão(ões) ao ${label}?`,
    });
    if (!ok) return;
    for (const id of selected) {
      updateQuestionLocal(id, { concurso_id: concursoId });
    }
    setSelected(new Set());
    scheduleSync(500);
    toast(`${selected.size} vinculada(s).`, 'success');
  };

  const deleteAllFiltered = async () => {
    if (filtered.length === 0) {
      toast('Filtro vazio.', 'warn');
      return;
    }
    const ok = await confirmDialog({
      title: 'Excluir TUDO no filtro',
      message: `Esta ação removerá ${filtered.length} questão(ões) que correspondem ao filtro atual. Continuar?`,
      danger: true,
    });
    if (!ok) return;
    deleteQuestionsBulk(filtered.map((q) => q.id));
    setSelected(new Set());
    scheduleSync(500);
    toast(`${filtered.length} excluída(s).`, 'success');
  };

  const exportQuestions = (qs: Question[], filename: string) => {
    const data = JSON.stringify(
      qs.map((q) => {
        return {
          ...q.payload,
          disciplina_id: q.disciplina_id,
          tema: q.tema,
          banca_estilo: q.banca_estilo,
          dificuldade: q.dificuldade,
          _meta: {
            id: q.id,
            type: q.type,
            srs: q.srs,
            stats: q.stats,
            origem: q.origem,
            fonte: q.fonte,
            verificacao: q.verificacao,
            tags: q.tags,
            created_at: q.created_at,
            updated_at: q.updated_at,
          },
        };
      }),
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportAllJSON = () => {
    if (questions.length === 0) {
      toast('Nada pra exportar.', 'warn');
      return;
    }
    exportQuestions(
      questions,
      `estudo-simples-export-${new Date().toISOString().slice(0, 10)}.json`
    );
    toast(`${questions.length} questão(ões) exportada(s).`, 'success');
  };

  const exportFilteredJSON = () => {
    if (filtered.length === 0) {
      toast('Filtro vazio — nada pra exportar.', 'warn');
      return;
    }
    if (filtered.length === questions.length) {
      // Sem filtro ativo — equivale ao export completo, evita confusão
      exportAllJSON();
      return;
    }
    exportQuestions(
      filtered,
      `estudo-simples-export-filtrado-${filtered.length}q-${new Date().toISOString().slice(0, 10)}.json`
    );
    toast(`${filtered.length} questão(ões) exportada(s) (filtro aplicado).`, 'success');
  };

  // Atalhos de teclado globais na página
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      // / sempre foca a busca da app
      if (e.key === '/' && !inField) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      // Removido: Ctrl+F local conflitava com GlobalSearch + browser
      // find-in-page nativo. Devolvido ao default do browser.
      // Atalho do app pra busca: '/' (apenas dentro do /banco).
      // n cria nova questão
      if ((e.key === 'n' || e.key === 'N') && !inField) {
        e.preventDefault();
        setCreating(true);
        return;
      }
      // r vai pra /revisar (bulk-fill de gabarito pendentes)
      if ((e.key === 'r' || e.key === 'R') && !inField) {
        e.preventDefault();
        window.location.href = '/revisar';
        return;
      }
      if (inField) return;
      if (editingId) return; // drawer aberto

      const visible = Math.min(sorted.length, visibleCount);
      if (visible === 0) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIdx((i) => Math.min(visible - 1, i + 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIdx((i) => Math.max(0, i < 0 ? 0 : i - 1));
          break;
        case 'g': // gg → topo (Vim-like)
          e.preventDefault();
          setFocusedIdx(0);
          break;
        case 'G':
          e.preventDefault();
          setFocusedIdx(visible - 1);
          break;
        case 'Enter': {
          if (focusedIdx < 0 || focusedIdx >= visible) return;
          e.preventDefault();
          setEditingId(sorted[focusedIdx].id);
          break;
        }
        case ' ': // espaço seleciona
          if (focusedIdx < 0 || focusedIdx >= visible) return;
          e.preventDefault();
          toggle(sorted[focusedIdx].id);
          break;
        case 'x':
        case 'Delete': {
          if (focusedIdx < 0 || focusedIdx >= visible) return;
          e.preventDefault();
          const q = sorted[focusedIdx];
          void deleteOne(q.id);
          break;
        }
        case 'F': {
          // Capital F = alterna favorito da focada (minúsculo já é livre)
          if (focusedIdx < 0 || focusedIdx >= visible) return;
          e.preventDefault();
          toggleFav(sorted[focusedIdx].id);
          break;
        }
        case 'V': {
          // Capital V = alterna verificacao da focada (verificada ↔ null).
          // Dá pra varrer um bloco rapidão enquanto navega com j/k.
          if (focusedIdx < 0 || focusedIdx >= visible) return;
          e.preventDefault();
          const cur = sorted[focusedIdx].verificacao;
          const next = cur === 'verificada' ? null : 'verificada';
          updateQuestionLocal(sorted[focusedIdx].id, { verificacao: next });
          scheduleSync(500);
          toast(
            next === 'verificada' ? '✓ Verificada' : 'Verificação removida',
            'success'
          );
          break;
        }
        case 'R': {
          // Capital R: 1 questão aleatória do filtro atual → /estudar
          if (sorted.length === 0) return;
          e.preventDefault();
          const candidatos = sorted.filter(
            (qq) =>
              qq.type === 'objetiva' ||
              qq.type === 'cloze' ||
              qq.type === 'flashcard'
          );
          if (candidatos.length === 0) {
            toast('Sem questões estudáveis no filtro', 'warn');
            return;
          }
          const random = candidatos[Math.floor(Math.random() * candidatos.length)];
          const path =
            random.type === 'objetiva'
              ? `/estudar?qid=${random.id}`
              : `/cards?qid=${random.id}`;
          router.push(path);
          break;
        }
        case '1':
        case '2':
        case '3':
        case '4':
        case '5': {
          // Sem modifiers: número seta dificuldade da focada (1-5)
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (focusedIdx < 0 || focusedIdx >= visible) return;
          e.preventDefault();
          const dif = parseInt(e.key, 10) as 1 | 2 | 3 | 4 | 5;
          updateQuestionLocal(sorted[focusedIdx].id, { dificuldade: dif });
          scheduleSync(500);
          toast(`Dificuldade ${dif} aplicada`, 'success');
          break;
        }
        case 'Escape':
          if (focusedIdx >= 0) {
            e.preventDefault();
            setFocusedIdx(-1);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, visibleCount, focusedIdx, editingId]);

  // Scroll automático pra manter o item focado visível
  useEffect(() => {
    if (focusedIdx < 0) return;
    const el = document.querySelector(
      `[data-banco-idx="${focusedIdx}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  const exportSelectedJSON = () => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const qs = questions.filter((q) => selected.has(q.id));
    exportQuestions(
      qs,
      `estudo-simples-export-selecionadas-${qs.length}q-${new Date().toISOString().slice(0, 10)}.json`
    );
    toast(`${qs.length} selecionada(s) exportada(s).`, 'success');
  };

  const exportSelectedCSV = () => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const qs = questions.filter((q) => selected.has(q.id));
    void import('@/lib/stats-export').then(
      ({ buildQuestionsCSV, downloadFile }) => {
        const csv = buildQuestionsCSV(qs);
        downloadFile(
          csv,
          `estudo-simples-export-selecionadas-${qs.length}q-${new Date().toISOString().slice(0, 10)}.csv`
        );
        toast(`${qs.length} selecionada(s) em CSV.`, 'success');
      }
    );
  };

  /**
   * Export pra TSV compatível com Anki (File > Import). Cobre objetiva,
   * cloze, flashcard, discursiva. Tags: disciplina + tema + banca + tags
   * (separadas por _ porque Anki não aceita espaço em tag).
   */
  const exportSelectedAnki = () => {
    const qs =
      selected.size > 0
        ? questions.filter((q) => selected.has(q.id))
        : sorted;
    if (qs.length === 0) {
      toast('Nada pra exportar.', 'warn');
      return;
    }
    void import('@/lib/anki-export').then(
      ({ questionsToAnkiCsv, downloadAnkiCsv }) => {
        const csv = questionsToAnkiCsv(qs);
        downloadAnkiCsv(
          csv,
          `estudo-simples-anki-${qs.length}q-${new Date().toISOString().slice(0, 10)}.csv`
        );
        toast(
          `${qs.length} questão(ões) exportada(s) em formato Anki.`,
          'success'
        );
      }
    );
  };

  return (
    <div className="card">
      {activeConcurso && (
        <div
          role="status"
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>
            🎯 Filtrando por concurso <strong>{activeConcurso.nome}</strong>
            {concursoDiscNomes && concursoDiscNomes.length > 0
              ? ` · ${concursoDiscNomes.length} disciplina(s) vinculada(s)`
              : ' · sem disciplinas vinculadas (vai mostrar 0 questões)'}
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => setActiveConcursoId(null)}
            style={{ fontSize: '0.85rem' }}
          >
            Ver tudo
          </button>
        </div>
      )}

      {(() => {
        const ativos: string[] = [];
        if (search) ativos.push('busca');
        if (disc) ativos.push('disciplina');
        if (tipo) ativos.push('tipo');
        if (origem) ativos.push('origem');
        if (verif) ativos.push('verificação');
        if (srsFilter) ativos.push('SRS');
        if (imgFilter) ativos.push('imagem');
        if (notasFilter) ativos.push('notas');
        if (latexFilter) ativos.push('LaTeX');
        if (tempoFilter) ativos.push('última revisão');
        if (favFilter) ativos.push('favoritas');
        const hasAtivos = ativos.length > 0;
        const hasPresets = presets.length > 0;
        if (!hasAtivos && !hasPresets) return null;
        return (
          <div
            style={{
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: '0.85rem',
            }}
          >
            {hasAtivos && (
              <>
                <span className="muted">
                  {ativos.length} filtro(s) ativo(s): {ativos.join(', ')}
                </span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setSearch('');
                    setDisc('');
                    setTipo('');
                    setOrigem('');
                    setVerif('');
                    setSrsFilter('');
                    setImgFilter('');
                    setNotasFilter('');
                    setLatexFilter('');
                    setTempoFilter('');
                    setFavFilter(false);
                  }}
                >
                  🧹 Limpar todos
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={saveCurrentAsPreset}
                  title="Salvar combinação atual de filtros como preset"
                >
                  💾 Salvar como preset
                </button>
                <span className="muted">
                  ({filtered.length} de {questions.length})
                </span>
              </>
            )}
            {hasPresets && (
              <>
                <span className="muted">Presets:</span>
                {presets.map((p) => (
                  <span
                    key={p.nome}
                    style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}
                  >
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => applyPreset(p)}
                      style={{ padding: '2px 8px', fontSize: '0.82rem' }}
                    >
                      {p.nome}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => removePreset(p.nome)}
                      title={`Remover preset "${p.nome}"`}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.78rem',
                        opacity: 0.6,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {(() => {
        // Chips de filtro rápido. Counts globais (não filtrados) pra dar
        // sensação de panorama. Click toggla — repetir desativa.
        const nowMs = Date.now();
        const tomorrow0 = startOfDay(nowMs) + DAY_MS;
        let cAtrasadas = 0;
        let cHoje = 0;
        let cInimigas = 0;
        let cDominadas = 0;
        let cNovas = 0;
        let cFavoritas = 0;
        let cLeech = 0;
        for (const q of questions) {
          if ((q.payload as Record<string, unknown>).bookmarked === true) cFavoritas++;
          if ((q.stats?.wrong ?? 0) >= 8) cLeech++;
          const due = q.srs?.dueDate ?? 0;
          if (due < startOfDay(nowMs)) cAtrasadas++;
          else if (due < tomorrow0) cHoje++;
          if (!q.srs?.lastReviewed) cNovas++;
          const a = q.stats?.attempts ?? 0;
          const c = q.stats?.correct ?? 0;
          if (a >= 3 && c / a < 0.3) cInimigas++;
          const h = q.stats?.history || [];
          if (
            h.length >= 5 &&
            h.slice(-5).every(
              (r) => r.result === 'correct' || r.result === 'self_pass'
            )
          ) {
            cDominadas++;
          }
        }
        const chips: {
          key: typeof srsFilter;
          label: string;
          n: number;
          color?: string;
        }[] = [
          { key: 'atrasadas', label: '🔴 Atrasadas', n: cAtrasadas, color: 'var(--danger)' },
          { key: 'hoje', label: '📅 Hoje', n: cHoje },
          { key: 'novas', label: '✨ Novas', n: cNovas },
          { key: 'inimigas', label: '⚔ Inimigas', n: cInimigas, color: 'var(--danger)' },
          { key: 'dominadas', label: '🏆 Dominadas', n: cDominadas },
        ];
        const favActive = search.toLowerCase().includes('bookmark:1');
        return (
          <div
            className="row gap wrap"
            style={{ marginBottom: 10, fontSize: '0.85rem' }}
          >
            {chips.map((c) => {
              const active = srsFilter === c.key;
              if (c.n === 0 && !active) return null;
              return (
                <button
                  key={c.key}
                  type="button"
                  className="chip"
                  onClick={() => setSrsFilter(active ? '' : c.key)}
                  title={
                    active
                      ? 'Clique de novo pra remover esse filtro'
                      : `Filtrar: ${c.label.replace(/^\S+\s/, '')}`
                  }
                  style={{
                    cursor: 'pointer',
                    background: active ? 'var(--primary-soft)' : undefined,
                    borderColor: active ? 'var(--primary)' : undefined,
                    color: active ? 'var(--primary)' : c.color,
                    fontWeight: active ? 600 : undefined,
                  }}
                >
                  {c.label} <strong>· {c.n}</strong>
                </button>
              );
            })}
            {(cFavoritas > 0 || favActive) && (
              <button
                type="button"
                className="chip"
                onClick={() => {
                  if (favActive) {
                    // Remove bookmark:1 da query
                    const next = search
                      .split(/\s+/)
                      .filter((tok) => tok.toLowerCase() !== 'bookmark:1')
                      .join(' ')
                      .trim();
                    setSearch(next);
                  } else {
                    setSearch((search ? search + ' ' : '') + 'bookmark:1');
                  }
                }}
                title={
                  favActive
                    ? 'Remover filtro de favoritas'
                    : 'Mostrar só questões marcadas com ⭐'
                }
                style={{
                  cursor: 'pointer',
                  background: favActive ? 'var(--primary-soft)' : undefined,
                  borderColor: favActive ? 'var(--primary)' : undefined,
                  color: favActive ? 'var(--primary)' : '#facc15',
                  fontWeight: favActive ? 600 : undefined,
                }}
              >
                ⭐ Favoritas <strong>· {cFavoritas}</strong>
              </button>
            )}
            {cLeech > 0 && (
              <button
                type="button"
                className="chip"
                onClick={() => {
                  // Leech filter via search livre não tem prefixo —
                  // vamos usar inimigas como aproximação (similar)
                  toast(
                    `${cLeech} questão(ões) com 8+ erros. Procure por "🐌 leech" nos cards ou use ⚔ Inimigas pra atacar.`,
                    'warn'
                  );
                }}
                title={`${cLeech} questão(ões) com 8 ou mais erros — leeches`}
                style={{
                  cursor: 'pointer',
                  color: 'var(--danger)',
                }}
              >
                🐌 Leech <strong>· {cLeech}</strong>
              </button>
            )}
            {(() => {
              // Chip "sem origem definida": questões sem fonte.gabarito_source
              // setado. Útil pra revisar e categorizar em massa.
              const cSemSource = questions.filter((q) => {
                if (q.deleted_at) return false;
                return !q.fonte?.gabarito_source;
              }).length;
              const semSrcActive = gabSourceFilter === 'sem_source';
              if (cSemSource === 0 && !semSrcActive) return null;
              return (
                <button
                  type="button"
                  className="chip"
                  onClick={() =>
                    setGabSourceFilter(semSrcActive ? '' : 'sem_source')
                  }
                  title={
                    semSrcActive
                      ? 'Remover filtro'
                      : 'Questões sem origem do gabarito definida — categorize'
                  }
                  style={{
                    cursor: 'pointer',
                    background: semSrcActive ? 'var(--bg-elev-2)' : undefined,
                    borderColor: semSrcActive ? 'var(--muted)' : undefined,
                    fontWeight: semSrcActive ? 600 : undefined,
                  }}
                >
                  📌 Sem origem <strong>· {cSemSource}</strong>
                </button>
              );
            })()}
            {(() => {
              // Chip combinado: questões com gabarito IA-pendente.
              // Atalho rápido pra "validar contra fonte oficial".
              const cIaPendente = questions.filter((q) => {
                if (q.deleted_at) return false;
                if (q.fonte?.gabarito_source !== 'ia') return false;
                if (q.verificacao !== 'pendente') return false;
                return true;
              }).length;
              const iaPendActive =
                gabSourceFilter === 'ia' && verif === 'pendente';
              if (cIaPendente === 0 && !iaPendActive) return null;
              return (
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    if (iaPendActive) {
                      setGabSourceFilter('');
                      setVerif('');
                    } else {
                      setGabSourceFilter('ia');
                      setVerif('pendente');
                    }
                  }}
                  title={
                    iaPendActive
                      ? 'Remover filtro IA-pendente'
                      : 'Questões com gabarito de IA aguardando validação contra fonte oficial'
                  }
                  style={{
                    cursor: 'pointer',
                    background: iaPendActive
                      ? 'var(--warn-bg, rgba(217,119,6,0.12))'
                      : undefined,
                    borderColor: iaPendActive
                      ? 'var(--warn, #d97706)'
                      : undefined,
                    color: iaPendActive
                      ? 'var(--warn, #d97706)'
                      : 'var(--warn, #d97706)',
                    fontWeight: iaPendActive ? 600 : undefined,
                  }}
                >
                  🤖 IA p/ validar <strong>· {cIaPendente}</strong>
                </button>
              );
            })()}
          </div>
        );
      })()}

      <PlanLimitBanner />

      <div
        className="row between"
        style={{
          alignItems: 'baseline',
          marginBottom: 10,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>
          Banco
          <span
            className="muted"
            style={{
              marginLeft: 8,
              fontSize: '0.85rem',
              fontWeight: 400,
            }}
          >
            · {filtered.length}
            {filtered.length !== questions.length &&
              ` de ${questions.length}`}
          </span>
          {selected.size > 0 && (
            <span
              style={{
                marginLeft: 10,
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'var(--primary)',
                background: 'var(--primary-soft)',
                padding: '2px 8px',
                borderRadius: 999,
                verticalAlign: 'middle',
              }}
            >
              {selected.size} selecionada{selected.size === 1 ? '' : 's'}
            </span>
          )}
        </h2>
      </div>

      {/* Botão "Filtros" mobile-only que toggle os filtros adicionais */}
      <button
        type="button"
        className="ghost banco-filters-toggle"
        onClick={() => setFiltersOpen((v) => !v)}
        aria-expanded={filtersOpen}
        style={{
          width: '100%',
          padding: '10px 14px',
          marginBottom: 10,
          textAlign: 'left',
          display: 'none', // visível só em mobile (CSS)
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>🔧 Filtros e ordenação</span>
        <span style={{ fontSize: '0.85em', opacity: 0.7 }}>
          {filtersOpen ? '▲' : '▼'}
        </span>
      </button>
      <div
        className={
          'row gap wrap banco-filters' +
          (filtersOpen ? ' filters-open' : ' filters-collapsed')
        }
        style={{
          marginBottom: 14,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flex: '1 1 auto',
            maxWidth: 360,
            position: 'relative',
          }}
        >
          <input
            ref={searchRef}
            type="search"
            placeholder="Buscar (atalho: /). Prefixos: tag:x disc:y banca:z due:7d bookmark:1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
            title="Prefixos: tag:foo · disc:bar · banca:FGV · due:7d (vencendo em até 7 dias) · bookmark:1 (favoritas) · id:abc (ID exato/prefix). Atalhos: / busca · j/k navega · Enter edita · espaço seleciona · x exclui · R aleatório"
          />
          <VoiceSearchButton onTranscript={(t) => setSearch(t)} />
          <SearchHistoryDropdown
            inputRef={searchRef}
            currentValue={search}
            onPick={(entry) => {
              setSearch(entry);
              searchRef.current?.focus();
            }}
            refreshKey={searchHistoryRefresh}
          />
        </div>
        <select
          value={disc}
          onChange={(e) => setDisc(e.target.value)}
          aria-label="Filtrar por disciplina"
        >
          <option value="">Todas as disciplinas</option>
          {disciplinas.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
          aria-label="Filtrar por tipo de questão"
        >
          <option value="">Todos os tipos</option>
          <option value="objetiva">Objetivas</option>
          <option value="discursiva">Discursivas</option>
        </select>
        <select
          value={origem}
          onChange={(e) => setOrigem(e.target.value as typeof origem)}
          title="Filtrar por origem"
          aria-label="Filtrar por origem"
        >
          <option value="">Toda origem</option>
          <option value="real">📋 Reais</option>
          <option value="autoral">✏️ Autorais</option>
        </select>
        <select
          value={verif}
          onChange={(e) => setVerif(e.target.value as typeof verif)}
          title="Filtrar por verificação"
          aria-label="Filtrar por verificação"
        >
          <option value="">Toda verificação</option>
          <option value="verificada">✅ Verificadas</option>
          <option value="pendente">⏳ Pendentes</option>
          <option value="duvidosa">⚠️ Duvidosas</option>
          <option value="sem_verif">— Sem status</option>
        </select>
        <select
          value={gabSourceFilter}
          onChange={(e) =>
            setGabSourceFilter(e.target.value as typeof gabSourceFilter)
          }
          title="Filtrar por origem do gabarito"
          aria-label="Filtrar por origem do gabarito"
        >
          <option value="">Toda origem de gabarito</option>
          <option value="oficial">✓ Oficial (banca)</option>
          <option value="ia">🤖 IA (pendente oficialização)</option>
          <option value="crowd">👥 Crowd</option>
          <option value="sem_source">— Sem origem definida</option>
        </select>
        <select
          value={srsFilter}
          onChange={(e) => setSrsFilter(e.target.value as typeof srsFilter)}
          title="Filtrar por estado de revisão (SRS)"
          aria-label="Filtrar por estado de revisão"
        >
          <option value="">Todo estado SRS</option>
          <option value="atrasadas">🔴 Atrasadas</option>
          <option value="hoje">📅 Vencendo hoje</option>
          <option value="novas">✨ Nunca estudadas</option>
          <option value="sem_estudo">○ Zero tentativas</option>
          <option value="recentes">🆕 Importadas últimos 7d</option>
          <option value="dominadas">🏆 Dominadas (5+ acertos seguidos)</option>
          <option value="inimigas">⚔ Inimigas (≥3 tentativas, &lt;30%)</option>
        </select>
        <select
          value={imgFilter}
          onChange={(e) => setImgFilter(e.target.value as typeof imgFilter)}
          title="Filtrar por presença de imagens"
          aria-label="Filtrar por presença de imagens"
        >
          <option value="">Imagens (qualquer)</option>
          <option value="com">🖼 Com imagem</option>
          <option value="sem">— Sem imagem</option>
        </select>
        <select
          value={notasFilter}
          onChange={(e) => setNotasFilter(e.target.value as typeof notasFilter)}
          title="Filtrar por anotação pessoal"
          aria-label="Filtrar por anotação pessoal"
        >
          <option value="">Notas (qualquer)</option>
          <option value="com">📝 Com anotação</option>
          <option value="sem">— Sem anotação</option>
        </select>
        <select
          value={mnemoFilter}
          onChange={(e) => setMnemoFilter(e.target.value as typeof mnemoFilter)}
          title="Filtrar por mnemônico/dica de memorização"
          aria-label="Filtrar por mnemônico"
        >
          <option value="">Mnemônico (qualquer)</option>
          <option value="com">🧠 Com mnemônico</option>
          <option value="sem">— Sem mnemônico</option>
        </select>
        <select
          value={latexFilter}
          onChange={(e) => setLatexFilter(e.target.value as typeof latexFilter)}
          title="Filtrar por presença de fórmulas LaTeX"
          aria-label="Filtrar por LaTeX"
        >
          <option value="">LaTeX (qualquer)</option>
          <option value="com">∑ Com LaTeX</option>
          <option value="sem">— Sem LaTeX</option>
        </select>
        <select
          value={tempoFilter}
          onChange={(e) => setTempoFilter(e.target.value as typeof tempoFilter)}
          title="Filtrar pela última revisão"
          aria-label="Filtrar por última revisão"
        >
          <option value="">Última revisão (qualquer)</option>
          <option value="hoje">📅 Estudadas hoje</option>
          <option value="ontem">⏪ Estudadas ontem</option>
          <option value="semana">7d Esta semana</option>
          <option value="nunca">— Nunca revisadas</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          title="Ordenar lista"
          aria-label="Ordenar lista"
        >
          <option value="recente">↓ Mais recentes (import)</option>
          <option value="antiga">↑ Mais antigas (import)</option>
          <option value="atualizada">↓ Atualizadas há menos</option>
          <option value="due_asc">🔴 Atrasadas/vencendo primeiro</option>
          <option value="attempts_desc">↓ Mais estudadas</option>
          <option value="acerto_asc">↑ Menor % acerto</option>
          <option value="dificuldade_desc">↓ Mais difíceis</option>
          <option value="last_reviewed_asc">💤 Mais negligenciadas</option>
        </select>
        <button
          type="button"
          className={favFilter ? 'primary' : 'ghost'}
          onClick={() => setFavFilter((v) => !v)}
          title="Mostrar só favoritas (★)"
          aria-pressed={favFilter}
        >
          {favFilter ? '★ Favoritas' : '☆ Favoritas'}
        </button>
        <button
          type="button"
          className={compact ? 'primary' : 'ghost'}
          onClick={() => setCompact((v) => !v)}
          title={compact ? 'Sair do modo compacto' : 'Ativar modo compacto (mais itens por tela)'}
          aria-pressed={compact}
        >
          {compact ? '⊞ Compacto' : '⊟ Compacto'}
        </button>
      </div>

      <div className="row gap wrap" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="primary"
          onClick={() => setCreating(true)}
          title="Criar questão objetiva manualmente"
        >
          + Nova
        </button>
        <AIGenerateButton />
        <AIClozeFromTextButton />
        <AIOCRButton />
        <AIToolbarFallback />
        <button
          type="button"
          onClick={() => setBrowsing(true)}
          disabled={sorted.length === 0}
          title="Navegar pelas questões filtradas como flashcard, sem afetar SRS"
        >
          📖 Modo leitura
        </button>
        <button
          type="button"
          onClick={() => setTagMergeOpen(true)}
          disabled={questions.length === 0}
          title="Renomear ou unificar tags em massa"
        >
          🏷 Mesclar tags
        </button>
        <button
          type="button"
          onClick={() => {
            // Decide pra onde mandar com base no tipo dominante.
            // Se selecionou: usa selecionadas; senão: filtradas (até 200).
            const baseList = selected.size > 0
              ? sorted.filter((q) => selected.has(q.id))
              : sorted.slice(0, 200);
            const objs = baseList.filter((q) => q.type === 'objetiva');
            const cards = baseList.filter(
              (q) => q.type === 'cloze' || q.type === 'flashcard'
            );
            // Se misturou, prioriza objetiva (caminho mais comum)
            if (objs.length === 0 && cards.length === 0) {
              toast('Nenhuma questão estudável no filtro', 'warn');
              return;
            }
            if (objs.length >= cards.length) {
              saveQueue(objs.map((q) => q.id), 'objetiva');
              router.push('/estudar?queue=1');
            } else {
              saveQueue(cards.map((q) => q.id), 'cards');
              router.push('/cards?queue=1');
            }
          }}
          disabled={sorted.length === 0}
          title={
            selected.size > 0
              ? `Estudar as ${selected.size} selecionadas`
              : `Estudar até 200 das filtradas (${sorted.length} no filtro)`
          }
        >
          ▶ Estudar {selected.size > 0 ? `${selected.size} selecionada(s)` : 'filtradas'}
        </button>
        <button type="button" onClick={selectAllFiltered}>
          Selecionar tudo (filtrado)
        </button>
        <button
          type="button"
          onClick={selectAllVisible}
          title="Seleciona apenas as questões atualmente visíveis (página)"
        >
          Selecionar visíveis
        </button>
        <button type="button" onClick={() => setSelected(new Set())}>
          Limpar seleção
        </button>
        <BulkAssignTopico
          selectedIds={selected}
          onApplied={() => setSelected(new Set())}
        />
        {/* Compartilhar: posicionado cedo pra não perder no wrap em
            telas estreitas, e antes do destrutivo "Excluir" pra evitar
            cliques acidentais. */}
        <ShareDeckButton selectedIds={selected} />
        <button type="button" className="danger" onClick={deleteSelected}>
          Excluir selecionadas
        </button>
        <BulkVerificacaoMenu
          disabled={selected.size === 0}
          onPick={bulkSetVerificacao}
        />
        <BulkDificuldadeMenu
          disabled={selected.size === 0}
          onPick={bulkSetDificuldade}
        />
        <BulkTagsMenu
          disabled={selected.size === 0}
          onAdd={bulkAddTags}
          onRemove={bulkRemoveTags}
        />
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => void bulkSetBookmark(true)}
          title="Favoritar selecionadas"
        >
          ⭐ Favoritar
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => void bulkSetBookmark(false)}
          title="Desfavoritar selecionadas"
        >
          ☆ Desfavoritar
        </button>
        <BulkConcursoMenu
          disabled={selected.size === 0}
          onPick={bulkSetConcurso}
        />
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => void bulkMarkGabaritoOficial()}
          title="Marcar selecionadas como gabarito oficial verificado (atalho IA→Oficial)"
          aria-label="Marcar como gabarito oficial"
        >
          ✓ Marcar oficial
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => bulkAddTags('platform')}
          title="Adiciona tag 'platform' às selecionadas (vão pro seed na próxima export)"
        >
          🌐 Marcar como plataforma
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => bulkRemoveTags('platform')}
          title="Remove tag 'platform' das selecionadas"
        >
          🚫 Tirar da plataforma
        </button>
        <button
          type="button"
          className="danger"
          disabled={selected.size === 0}
          onClick={bulkResetSrs}
          title="Zera SRS e stats das selecionadas"
        >
          🧹 Limpar histórico
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={exportSelectedCSV}
          title="Exportar selecionadas em CSV (1 linha por questão)"
        >
          📥 CSV selecionadas
        </button>
        <button type="button" className="danger" onClick={deleteAllFiltered}>
          Excluir TUDO no filtro
        </button>
        <ExportMenu
          totalCount={questions.length}
          filteredCount={filtered.length}
          selectedCount={selected.size}
          onExportAll={exportAllJSON}
          onExportFiltered={exportFilteredJSON}
          onExportSelected={exportSelectedJSON}
        />
        <button
          type="button"
          onClick={exportSelectedAnki}
          title={
            selected.size > 0
              ? `Exportar ${selected.size} selecionadas pra Anki (TSV)`
              : `Exportar ${sorted.length} filtradas pra Anki (TSV)`
          }
          aria-label="Exportar pra Anki"
        >
          🎴 Exportar Anki
        </button>
        {(() => {
          // Conta só questões REALMENTE sem gabarito (alvo do /revisar).
          // Questões com gabarito + verificacao=pendente (oficialização)
          // não entram aqui — usuário valida pelo editor.
          const pendentesCount = questions.filter((q) => {
            if (q.type !== 'objetiva') return false;
            if (q.verificacao !== 'pendente') return false;
            const p = q.payload as { gabarito?: string };
            const g = (p.gabarito ?? '').trim();
            return !g || g === '?' || g.toUpperCase() === 'NULL';
          }).length;
          if (pendentesCount === 0) return null;
          return (
            <Link
              href="/revisar"
              className="ghost"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                fontSize: '0.88rem',
              }}
              title="Questões sem gabarito — preencher via IA"
            >
              ⏳ Preencher {pendentesCount} gabarito(s)
            </Link>
          );
        })()}
        <Link
          href="/duplicatas"
          className="ghost"
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            fontSize: '0.88rem',
          }}
        >
          🔍 Buscar duplicatas
        </Link>
      </div>

      {editingQuestion && (
        <QuestionEditDrawer
          question={editingQuestion}
          onClose={() => setEditingId(null)}
        />
      )}

      <QuestionQuickActions
        question={quickActionsQ}
        onClose={() => setQuickActionsQ(null)}
        onEdit={(q) => setEditingId(q.id)}
      />

      {creating && (
        <QuestionCreateDrawer onClose={() => setCreating(false)} />
      )}

      {tagMergeOpen && (
        <TagMergeDialog onClose={() => setTagMergeOpen(false)} />
      )}

      {browsing && sorted.length > 0 && (
        <BancoBrowse
          questions={sorted}
          onClose={() => setBrowsing(false)}
        />
      )}

      <div className="banco-list">
        {!hydrated || firstSyncInFlight || (!emptyAllowed && questions.length === 0) ? (
          <>
            <BancoItemSkeleton rows={5} />
            <p className="muted" style={{ marginTop: 14, textAlign: 'center' }}>
              Carregando suas questões…
            </p>
          </>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="big">∅</div>
            {questions.length === 0 ? (
              <>
                <p style={{ fontSize: '1rem', marginBottom: 6 }}>
                  Sua base ainda está vazia.
                </p>
                <p
                  className="muted"
                  style={{ fontSize: '0.9rem', marginTop: 0, marginBottom: 18 }}
                >
                  3 caminhos pra popular:
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                    maxWidth: 720,
                    margin: '0 auto',
                  }}
                >
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setCreating(true)}
                    style={{ padding: 16, fontSize: '0.92rem' }}
                  >
                    ✏️ Criar manualmente
                    <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 4, fontWeight: 400 }}>
                      Drawer com campos guiados
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const dz = document.querySelector('.dropzone') as HTMLElement | null;
                      dz?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{ padding: 16, fontSize: '0.92rem' }}
                  >
                    📤 Importar JSON / CSV
                    <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 4, fontWeight: 400 }}>
                      Cole na área acima ou arraste arquivo
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ai = document.querySelector('[data-ai-prompt-trigger]') as HTMLElement | null;
                      ai?.click();
                    }}
                    style={{ padding: 16, fontSize: '0.92rem' }}
                  >
                    🤖 Gerar com IA
                    <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 4, fontWeight: 400 }}>
                      Prompt pra Claude/ChatGPT/Gemini
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <p>Nenhuma questão corresponde aos filtros.</p>
            )}
          </div>
        ) : (
          sorted.slice(0, visibleCount).map((q, i) => {
            const enun = previewOf(q);
            const isFocused = i === focusedIdx;
            return (
              <div
                key={q.id}
                className={'banco-item' + (compact ? ' compact' : '')}
                data-banco-idx={i}
                data-banco-qid={q.id}
                onTouchStart={longPress.onTouchStart}
                onTouchMove={longPress.onTouchMove}
                onTouchEnd={longPress.onTouchEnd}
                onTouchCancel={longPress.onTouchCancel}
                style={{
                  ...(isFocused
                    ? {
                        outline: '2px solid var(--primary)',
                        outlineOffset: 2,
                        background: 'var(--bg-elev)',
                      }
                    : {}),
                  ...(q.disciplina_id &&
                  discCorMap.get(q.disciplina_id.toLowerCase())
                    ? {
                        borderLeft: `3px solid ${discCorMap.get(
                          q.disciplina_id.toLowerCase()
                        )}`,
                      }
                    : {}),
                }}
                onClick={(e) => {
                  // Click na linha (fora dos botões/checkbox) move foco
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('input')) return;
                  setFocusedIdx(i);
                }}
              >
                {/* Hitbox aumentada via label wrapper: o user clica em
                    qualquer pixel da área 32x32 e o checkbox dispara.
                    Antes o checkbox 13×13 nativo era difícil de acertar,
                    especialmente porque o item se move quando a lista
                    re-renderiza. stopPropagation evita que o click
                    propague pro onClick do item (que move focus). */}
                <label
                  className="banco-checkbox-hitbox"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Selecionar questão ${i + 1}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(q.id)}
                    onChange={() => toggle(q.id)}
                  />
                </label>
                <div>
                  <div
                    className="preview"
                    dangerouslySetInnerHTML={{
                      __html: highlightSearch(
                        enun.slice(0, compact ? 100 : 240) +
                          (enun.length > (compact ? 100 : 240) ? '…' : ''),
                        search
                      ),
                    }}
                  />
                  <div className="meta">
                    <BookmarkButton question={q} size="small" />
                    {isLeech(q) && (
                      <span
                        title={`Errou ${q.stats?.wrong ?? 0} vezes — leech (precisa estratégia diferente)`}
                        style={{
                          background: 'var(--danger-soft)',
                          color: 'var(--danger)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        🐌 leech
                      </span>
                    )}
                    {q.origem === 'real' && (
                      <span
                        title={`Questão real: ${q.fonte?.banca ?? '?'} ${q.fonte?.ano ?? ''} ${q.fonte?.orgao ?? ''}`}
                        style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}
                      >
                        📋 {q.fonte?.banca ?? 'real'}
                        {q.fonte?.ano ? ` ${q.fonte.ano}` : ''}
                        {q.fonte?.orgao ? ` · ${q.fonte.orgao}` : ''}
                      </span>
                    )}
                    {q.origem === 'autoral' && (
                      <span title="Autoral" style={{ opacity: 0.7 }}>✏️ autoral</span>
                    )}
                    {q.origem === 'adaptada' && (
                      <span title="Adaptada" style={{ opacity: 0.7 }}>🔧 adaptada</span>
                    )}
                    {q.verificacao === 'verificada' && (
                      <span title="Verificada">✅</span>
                    )}
                    {q.verificacao === 'pendente' && (
                      <span title="Pendente de revisão" style={{ color: 'var(--warn, #d97706)' }}>⏳</span>
                    )}
                    {q.fonte?.gabarito_source && (
                      <GabaritoSourceBadge source={q.fonte.gabarito_source} />
                    )}
                    {q.verificacao === 'duvidosa' && (
                      <span title="Marcada como duvidosa (revisar antes de estudar)" style={{ color: 'var(--danger)' }}>⚠️</span>
                    )}
                    {q.disciplina_id && (
                      <button
                        type="button"
                        title="Filtrar por essa disciplina"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDisc(q.disciplina_id ?? '');
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: 'inherit',
                          cursor: 'pointer',
                          textDecoration: 'underline dotted',
                        }}
                      >
                        {q.disciplina_id}
                      </button>
                    )}
                    {q.tema && (
                      <button
                        type="button"
                        title="Buscar por esse tema"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (q.tema) setSearch(q.tema);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: 'inherit',
                          cursor: 'pointer',
                          textDecoration: 'underline dotted',
                        }}
                      >
                        {q.tema}
                      </button>
                    )}
                    <span>{q.type}</span>
                    {q.banca_estilo && !q.origem && <span>{q.banca_estilo}</span>}
                    {q.dificuldade != null && <span>dif {q.dificuldade}</span>}
                    {q.payload.notes_user && (
                      <span title="Tem anotações pessoais" aria-label="Tem anotações">
                        📝
                      </span>
                    )}
                    {(q.payload as { mnemonic?: string }).mnemonic && (
                      <span title="Tem mnemônico" aria-label="Tem mnemônico">
                        🧠
                      </span>
                    )}
                    {Array.isArray((q.payload as { imagens?: string[] }).imagens) &&
                      ((q.payload as { imagens?: string[] }).imagens?.length ?? 0) > 0 && (
                        <span title="Tem imagem" aria-label="Tem imagem">
                          🖼
                        </span>
                      )}
                    {(() => {
                      // Importada nas últimas 24h — chip "✨ recém"
                      const created = q.created_at ? new Date(q.created_at).getTime() : 0;
                      if (!created) return null;
                      const ageMs = Date.now() - created;
                      if (ageMs > 24 * 60 * 60 * 1000) return null;
                      return (
                        <span
                          title="Importada há menos de 24h"
                          style={{ color: 'var(--primary)', fontSize: '0.72rem' }}
                        >
                          ✨ recém
                        </span>
                      );
                    })()}
                    {(() => {
                      // Indicador de fase SRS (Anki-style):
                      //   nova (sem rev) | aprendendo (<1d) | jovem (<21d) | madura (>=21d)
                      const lastReviewed = q.srs?.lastReviewed ?? 0;
                      if (!lastReviewed) {
                        return (
                          <span
                            title="Nova (nunca revisada)"
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--muted)',
                            }}
                          >
                            ✨ nova
                          </span>
                        );
                      }
                      const interval = q.srs?.interval ?? 0;
                      if (interval < 1) {
                        return (
                          <span
                            title="Aprendendo (intervalo &lt; 1d)"
                            style={{
                              fontSize: '0.72rem',
                              color: '#f59e0b',
                            }}
                          >
                            📖 aprendendo
                          </span>
                        );
                      }
                      if (interval < 21) {
                        return (
                          <span
                            title={`Jovem (intervalo ${Math.round(interval)}d)`}
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--primary)',
                            }}
                          >
                            🌱 jovem
                          </span>
                        );
                      }
                      return (
                        <span
                          title={`Madura (intervalo ${Math.round(interval)}d)`}
                          style={{
                            fontSize: '0.72rem',
                            color: '#22c55e',
                          }}
                        >
                          🌳 madura
                        </span>
                      );
                    })()}
                    {hasMath(enun) && (
                      <span title="Tem fórmulas LaTeX" aria-label="Tem LaTeX">
                        𝓛
                      </span>
                    )}
                    {q.tags && q.tags.length > 0 && (
                      <span title={q.tags.join(', ')}>
                        🏷 {q.tags.length}
                      </span>
                    )}
                    {q.stats?.history && q.stats.history.length > 0 && (() => {
                      // Progress dots: últimas 5 tentativas como pontinhos
                      const last5 = (q.stats?.history ?? []).slice(-5);
                      return (
                        <span
                          title={`Últimas ${last5.length} tentativas — verde=acerto, vermelho=erro`}
                          style={{
                            display: 'inline-flex',
                            gap: 2,
                            alignItems: 'center',
                            padding: '0 4px',
                          }}
                        >
                          {last5.map((h, i) => {
                            const ok = h.result === 'correct' || h.result === 'self_pass';
                            const tout = h.result === 'timeout';
                            return (
                              <span
                                key={i}
                                aria-hidden
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: ok
                                    ? 'var(--primary)'
                                    : tout
                                      ? 'var(--warn, #d97706)'
                                      : 'var(--danger)',
                                  display: 'inline-block',
                                }}
                              />
                            );
                          })}
                        </span>
                      );
                    })()}
                    {q.stats?.history && q.stats.history.length >= 2 && (() => {
                      // Tempo médio das tentativas que registraram timeMs
                      const times = q.stats.history
                        .map((h) => h.timeMs)
                        .filter((t): t is number => typeof t === 'number' && t > 0);
                      if (times.length === 0) return null;
                      const avg = times.reduce((a, b) => a + b, 0) / times.length;
                      const sec = Math.round(avg / 1000);
                      if (sec < 1) return null;
                      return (
                        <span
                          title={`Tempo médio nas últimas tentativas`}
                          className="muted"
                        >
                          ⏱ {sec}s
                        </span>
                      );
                    })()}
                    {(q.stats?.attempts ?? 0) >= 3 && (() => {
                      const a = q.stats!.attempts;
                      const c = q.stats!.correct ?? 0;
                      const pct = Math.round((c / a) * 100);
                      const cor =
                        pct >= 70
                          ? '#22c55e'
                          : pct >= 40
                            ? '#f59e0b'
                            : '#ef4444';
                      return (
                        <span
                          title={`${c}/${a} acertos`}
                          style={{
                            color: cor,
                            fontWeight: 500,
                            background: 'transparent',
                            border: `1px solid ${cor}`,
                          }}
                        >
                          {pct}%
                        </span>
                      );
                    })()}
                    {q.stats?.history && q.stats.history.length >= 5 && (() => {
                      // Indicador de domínio: 5+ acertos consecutivos no fim
                      // do histórico = memorizada com força. Pequeno troféu.
                      const last5 = q.stats.history.slice(-5);
                      const ok = last5.every(
                        (r) => r.result === 'correct' || r.result === 'self_pass'
                      );
                      if (!ok) return null;
                      return (
                        <span title="Dominada (5+ acertos seguidos)">🏆</span>
                      );
                    })()}
                    {(() => {
                      // Indicador "tempo morto": vencida há 30+ dias e não
                      // revisada nesse período. Sinal de que está sendo
                      // ignorada e a memória provavelmente já caiu.
                      const due = q.srs?.dueDate ?? 0;
                      const last = q.srs?.lastReviewed ?? 0;
                      const now = Date.now();
                      if (!due || due > now) return null;
                      const daysOverdue = Math.floor(
                        (now - due) / (24 * 60 * 60 * 1000)
                      );
                      if (daysOverdue < 30) return null;
                      const sinceLast = last
                        ? Math.floor((now - last) / (24 * 60 * 60 * 1000))
                        : 999;
                      if (sinceLast < 30) return null;
                      return (
                        <span
                          title={`Vencida há ${daysOverdue}d, não revisada há ${sinceLast}d. Memória provavelmente já caiu.`}
                          style={{ color: 'var(--muted)' }}
                        >
                          💤 {daysOverdue}d
                        </span>
                      );
                    })()}
                    {(q.stats?.attempts ?? 0) >= 3 && (() => {
                      // Inimiga: ≥3 tentativas, acerto < 30%
                      const a = q.stats!.attempts;
                      const c = q.stats!.correct ?? 0;
                      if (c / a >= 0.3) return null;
                      return (
                        <span
                          title="Inimiga (≥3 tentativas, <30% acerto)"
                          style={{ color: 'var(--danger)' }}
                        >
                          ⚔
                        </span>
                      );
                    })()}
                    {q.stats?.history && q.stats.history.length > 0 && (
                      <span
                        className="mini-spark"
                        title={`Últimas ${Math.min(5, q.stats.history.length)} respostas`}
                        aria-hidden
                      >
                        {q.stats.history.slice(-5).map((h, idx) => {
                          const r = h.result;
                          const cor =
                            r === 'correct' || r === 'self_pass'
                              ? '#22c55e'
                              : r === 'wrong'
                                ? '#ef4444'
                                : r === 'timeout'
                                  ? '#f59e0b'
                                  : 'var(--muted)';
                          return (
                            <span
                              key={idx}
                              style={{
                                display: 'inline-block',
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: cor,
                                marginRight: 2,
                              }}
                            />
                          );
                        })}
                      </span>
                    )}
                    {q.srs?.lastReviewed && (
                      <span
                        className="muted"
                        title={`Última revisão: ${new Date(q.srs.lastReviewed).toLocaleString('pt-BR')}`}
                      >
                        ✓ {fmtRelative(q.srs.lastReviewed)}
                      </span>
                    )}
                    {q.srs?.dueDate && (() => {
                      const due = q.srs.dueDate;
                      const now = Date.now();
                      const diffMs = due - now;
                      const diffDays = Math.round(diffMs / DAY_MS);
                      let cor: string | undefined;
                      let icon: string;
                      let title: string;
                      if (diffMs < 0) {
                        cor = 'var(--danger)';
                        icon = '🔴';
                        title = `Atrasada · vencia ${fmtRelative(due)}`;
                      } else if (diffDays === 0) {
                        cor = 'var(--warn, #d97706)';
                        icon = '📅';
                        title = `Vence hoje`;
                      } else {
                        icon = '↻';
                        title = `Próxima revisão`;
                      }
                      return (
                        <span title={title} style={cor ? { color: cor, fontWeight: 500 } : undefined}>
                          {icon} {fmtRelative(due)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="actions row gap">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => toggleFav(q.id)}
                    title={isFav(q) ? 'Desmarcar favorita' : 'Marcar como favorita'}
                    aria-label={isFav(q) ? 'Desmarcar favorita' : 'Marcar favorita'}
                    aria-pressed={isFav(q)}
                    style={{
                      color: isFav(q) ? '#f59e0b' : 'var(--muted)',
                      fontSize: '1.05rem',
                    }}
                  >
                    {isFav(q) ? '★' : '☆'}
                  </button>
                  {(q.type === 'objetiva' ||
                    q.type === 'cloze' ||
                    q.type === 'flashcard') && (
                    <Link
                      href={
                        q.type === 'objetiva'
                          ? `/estudar?qid=${q.id}`
                          : `/cards?qid=${q.id}`
                      }
                      title="Estudar só esta"
                      aria-label="Estudar só esta"
                    >
                      <button type="button" className="ghost">
                        ▶
                      </button>
                    </Link>
                  )}
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setEditingId(q.id)}
                    aria-label="Editar"
                    title="Editar"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => deleteOne(q.id)}
                    aria-label="Excluir"
                    title="Excluir"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > visibleCount && (
        <div
          className="row gap"
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 12,
            padding: 12,
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
          }}
        >
          <span className="muted" style={{ fontSize: '0.88rem' }}>
            Mostrando {visibleCount} de {filtered.length} questão(ões)
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => setVisibleCount((c) => c + pageSize)}
          >
            Carregar mais {Math.min(pageSize, filtered.length - visibleCount)}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => setVisibleCount(filtered.length)}
            title="Pode travar a página com muitas"
          >
            Ver tudo
          </button>
        </div>
      )}

      {filtered.length > 0 && (() => {
        // Quick-stats footer baseado no filtro atual: dominadas, inimigas,
        // vencendo hoje, novas. Útil pra ter pulse rápido de um filtro.
        const nowMs = Date.now();
        const tomorrow = startOfDay(nowMs) + DAY_MS;
        let dominadas = 0;
        let inimigas = 0;
        let vencendo = 0;
        let novas = 0;
        for (const q of filtered) {
          const h = q.stats?.history || [];
          if (
            h.length >= 5 &&
            h.slice(-5).every(
              (r) => r.result === 'correct' || r.result === 'self_pass'
            )
          ) {
            dominadas++;
          }
          const a = q.stats?.attempts ?? 0;
          const c = q.stats?.correct ?? 0;
          if (a >= 3 && c / a < 0.3) inimigas++;
          if ((q.srs?.dueDate ?? 0) < tomorrow) vencendo++;
          if (!q.srs?.lastReviewed) novas++;
        }
        return (
          <div
            className="row gap wrap"
            style={{
              marginTop: 12,
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span className="muted">📊 No filtro:</span>
            <span title="Questões com 5+ acertos seguidos">🏆 {dominadas} dominadas</span>
            <span
              title="Questões com ≥3 tentativas e &lt;30% acerto"
              style={{ color: 'var(--danger)' }}
            >
              ⚔ {inimigas} inimigas
            </span>
            <span title="Vencendo até amanhã">📅 {vencendo} vencendo</span>
            <span title="Sem nenhuma revisão registrada">✨ {novas} novas</span>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Menu dropdown pra setar dificuldade em massa.
 */
/**
 * Menu de bulk pra atribuir concurso a um conjunto de questões.
 * Lista os concursos do user via useConcursos. Opção "—" desvincula.
 */
function BulkConcursoMenu({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (concursoId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: concursos } = useConcursos();
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Vincular ao concurso em lote"
      >
        Concurso… ▾
      </button>
      {open && (
        <ul
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            listStyle: 'none',
            margin: 0,
            padding: 4,
            zIndex: 30,
            minWidth: 220,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {(concursos ?? []).length === 0 ? (
            <li
              style={{
                padding: '6px 10px',
                fontSize: '0.85rem',
                color: 'var(--muted)',
              }}
            >
              Nenhum concurso. Cadastre em /concursos.
            </li>
          ) : (
            (concursos ?? []).map((c) => (
              <li key={c.id} role="presentation">
                <button
                  type="button"
                  className="ghost"
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                  }}
                  onClick={() => {
                    setOpen(false);
                    void onPick(c.id);
                  }}
                >
                  🎯 {c.nome}
                </button>
              </li>
            ))
          )}
          <li role="presentation">
            <button
              type="button"
              className="ghost"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                color: 'var(--muted)',
              }}
              onClick={() => {
                setOpen(false);
                void onPick(null);
              }}
            >
              — Desvincular
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function BulkDificuldadeMenu({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (valor: 1 | 2 | 3 | 4 | 5 | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const opcoes: Array<{
    label: string;
    valor: 1 | 2 | 3 | 4 | 5 | null;
  }> = [
    { label: '1 — muito fácil', valor: 1 },
    { label: '2 — fácil', valor: 2 },
    { label: '3 — médio', valor: 3 },
    { label: '4 — difícil', valor: 4 },
    { label: '5 — muito difícil', valor: 5 },
    { label: '— Limpar', valor: null },
  ];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}>
        Dificuldade ▾
      </button>
      {open && (
        <ul role="menu" style={menuListStyle}>
          {opcoes.map((opt) => (
            <li key={opt.label}>
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setOpen(false);
                  await onPick(opt.valor);
                }}
                style={menuItemStyle}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const menuListStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  background: 'var(--bg-elev-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
  listStyle: 'none',
  margin: 0,
  padding: 4,
  minWidth: 180,
  zIndex: 50,
};

/**
 * Menu dropdown pra adicionar/remover tags em massa nas selecionadas.
 * Cada operação abre prompt simples (cola lista de tags separadas por vírgula).
 */
function BulkTagsMenu({
  disabled,
  onAdd,
  onRemove,
}: {
  disabled: boolean;
  onAdd: (raw: string) => Promise<void>;
  onRemove: (raw: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleAdd = () => {
    setOpen(false);
    const raw = window.prompt(
      'Tags a ADICIONAR (separadas por vírgula):',
      ''
    );
    if (raw && raw.trim()) void onAdd(raw);
  };
  const handleRemove = () => {
    setOpen(false);
    const raw = window.prompt(
      'Tags a REMOVER (separadas por vírgula, case-insensitive):',
      ''
    );
    if (raw && raw.trim()) void onRemove(raw);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Tags em massa"
      >
        🏷 Tags ▾
      </button>
      {open && (
        <ul
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            listStyle: 'none',
            margin: 0,
            padding: 4,
            minWidth: 180,
            zIndex: 50,
          }}
        >
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={handleAdd}
              style={menuItemStyle}
            >
              + Adicionar tags
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={handleRemove}
              style={menuItemStyle}
            >
              − Remover tags
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text)',
  borderRadius: 'var(--radius)',
};

/**
 * Menu dropdown de export — Tudo / Filtro atual / Selecionadas.
 * Cada opção tem contagem e desabilita quando 0.
 */
function ExportMenu({
  totalCount,
  filteredCount,
  selectedCount,
  onExportAll,
  onExportFiltered,
  onExportSelected,
}: {
  totalCount: number;
  filteredCount: number;
  selectedCount: number;
  onExportAll: () => void;
  onExportFiltered: () => void;
  onExportSelected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        disabled={totalCount === 0}
        onClick={() => setOpen((v) => !v)}
      >
        Exportar JSON ▾
      </button>
      {open && (
        <ul
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            listStyle: 'none',
            margin: 0,
            padding: 4,
            minWidth: 220,
            zIndex: 50,
          }}
        >
          <ExportMenuItem
            label={`Todas as ${totalCount} questões`}
            onClick={() => {
              setOpen(false);
              onExportAll();
            }}
          />
          <ExportMenuItem
            label={`Filtro atual (${filteredCount})`}
            disabled={filteredCount === 0 || filteredCount === totalCount}
            onClick={() => {
              setOpen(false);
              onExportFiltered();
            }}
          />
          <ExportMenuItem
            label={`Selecionadas (${selectedCount})`}
            disabled={selectedCount === 0}
            onClick={() => {
              setOpen(false);
              onExportSelected();
            }}
          />
        </ul>
      )}
    </div>
  );
}

function ExportMenuItem({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? 'var(--muted)' : 'var(--text)',
          borderRadius: 'var(--radius)',
        }}
      >
        {label}
      </button>
    </li>
  );
}

/**
 * Dropdown pra marcar verificação em lote nas questões selecionadas.
 * Cada opção abre confirmDialog antes de aplicar.
 */
function BulkVerificacaoMenu({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (
    valor: 'verificada' | 'pendente' | 'duvidosa' | null
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const opcoes: Array<{
    label: string;
    valor: 'verificada' | 'pendente' | 'duvidosa' | null;
  }> = [
    { label: '✅ Verificada', valor: 'verificada' },
    { label: '⏳ Pendente', valor: 'pendente' },
    { label: '⚠️ Duvidosa', valor: 'duvidosa' },
    { label: '— Sem status', valor: null },
  ];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Marcar verificação em lote"
      >
        Marcar como… ▾
      </button>
      {open && (
        <ul
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            listStyle: 'none',
            margin: 0,
            padding: 4,
            minWidth: 180,
            zIndex: 50,
          }}
        >
          {opcoes.map((opt) => (
            <li key={opt.label}>
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setOpen(false);
                  await onPick(opt.valor);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Bulk-assign de tópico a um conjunto de questões selecionadas.
 *
 * Comportamento:
 *  - Botão fica desabilitado se não há seleção.
 *  - Ao abrir, mostra select de disciplina (dos topicos cadastrados)
 *    e select de tópico (filtrado pela disciplina).
 *  - Confirma: itera sobre selectedIds, chama updateQuestionLocal
 *    com `{ topico_id }` (e `disciplina_id` derivado do tópico, pra
 *    manter compat com filtro string atual). Pendente é marcado pelo
 *    store; o sync push manda em chunks de 100.
 *  - Permite "remover tópico" (topico_id = null) via opção dedicada.
 */
function BulkAssignTopico({
  selectedIds,
  onApplied,
}: {
  selectedIds: Set<string>;
  onApplied: () => void;
}) {
  const { data: topicos } = useTopicos();
  const { data: disciplinas } = useDisciplinas();
  const [open, setOpen] = useState(false);
  const [discId, setDiscId] = useState('');
  const [topicoId, setTopicoId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const disabled = selectedIds.size === 0;
  const topicosFiltrados = useMemo(
    () =>
      (topicos ?? [])
        .filter((t) => !discId || t.disciplina_id === discId)
        .filter((t) => !t.deleted_at),
    [topicos, discId]
  );

  const apply = async (mode: 'set' | 'clear') => {
    if (submitting) return;
    if (mode === 'set' && !topicoId) {
      toast('Escolha um tópico', 'warn');
      return;
    }
    setSubmitting(true);

    let novoTopicoId: string | null = null;
    let novaDiscId: string | null = null;
    if (mode === 'set') {
      const t = topicos?.find((x) => x.id === topicoId);
      if (!t) {
        toast('Tópico inválido', 'error');
        setSubmitting(false);
        return;
      }
      const d = disciplinas?.find((x) => x.id === t.disciplina_id);
      novoTopicoId = t.id;
      // Sincroniza disciplina_id (string) com nome da disciplina, pra
      // manter o filtro existente coerente com a hierarquia nova.
      novaDiscId = d?.nome ?? null;
    }

    const ids = Array.from(selectedIds);
    for (const id of ids) {
      updateQuestionLocal(id, (q) => {
        const patch: Partial<typeof q> = { topico_id: novoTopicoId };
        // Só sobrescreve disciplina_id se estamos atribuindo (mode=set)
        // e a questão estava sem disciplina ou tinha string diferente.
        if (mode === 'set' && novaDiscId) {
          patch.disciplina_id = novaDiscId;
        }
        return patch;
      });
    }
    scheduleSync(500);

    toast(
      mode === 'set'
        ? `Tópico atribuído a ${ids.length} questão(ões)`
        : `Tópico removido de ${ids.length} questão(ões)`,
      'success'
    );
    setOpen(false);
    setTopicoId('');
    setDiscId('');
    onApplied();
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          disabled
            ? 'Selecione questões pra atribuir tópico'
            : `Atribuir tópico a ${selectedIds.size} questão(ões)`
        }
      >
        Atribuir tópico…
      </button>
    );
  }

  const semHierarquia =
    (disciplinas?.length ?? 0) === 0 || (topicos?.length ?? 0) === 0;

  return (
    <div
      className="row gap wrap"
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 10,
        flexBasis: '100%',
      }}
    >
      {semHierarquia ? (
        <span className="muted">
          Crie disciplinas e tópicos em Configurações antes de atribuir.
        </span>
      ) : (
        <>
          <select
            value={discId}
            onChange={(e) => {
              setDiscId(e.target.value);
              setTopicoId('');
            }}
            style={{ maxWidth: 220 }}
          >
            <option value="">Todas as disciplinas</option>
            {disciplinas?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
          <select
            value={topicoId}
            onChange={(e) => setTopicoId(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            <option value="">— Selecionar tópico —</option>
            {topicosFiltrados.map((t) => {
              const d = disciplinas?.find((x) => x.id === t.disciplina_id);
              const prefix = d && !discId ? `${d.nome} · ` : '';
              return (
                <option key={t.id} value={t.id}>
                  {prefix}
                  {t.nome}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            className="primary"
            onClick={() => apply('set')}
            disabled={submitting || !topicoId}
          >
            Atribuir
          </button>
          <button
            type="button"
            onClick={() => apply('clear')}
            disabled={submitting}
            title="Remover tópico das questões selecionadas"
          >
            Remover tópico
          </button>
        </>
      )}
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setOpen(false);
          setTopicoId('');
          setDiscId('');
        }}
      >
        Fechar
      </button>
    </div>
  );
}
