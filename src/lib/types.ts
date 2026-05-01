export type SRS = {
  // ===== SM-2 (algoritmo padrão hoje) =====
  easeFactor: number;
  interval: number;       // dias
  repetitions: number;
  dueDate: number;        // epoch ms
  lastReviewed: number | null;
  // ===== FSRS (etapa 0.5; opcional, populado quando o user opta por
  //         fsrs como algoritmo). Convive com SM-2 sem perda de dados. =====
  /** Estabilidade FSRS — quanto tempo a memória persiste sem revisão. */
  stability?: number;
  /** Dificuldade FSRS [1, 10] — quão difícil o card é pro user. */
  difficulty?: number;
  /** Estado FSRS: 0 New, 1 Learning, 2 Review, 3 Relearning. */
  state?: number;
  /** Contador de lapses (vezes que foi para Relearning). */
  lapses?: number;
};

export type HistoryEntry = {
  date: number;
  result: 'correct' | 'wrong' | 'timeout' | 'self_pass' | 'self_fail';
  answer?: string | null;
  timeMs?: number;
  quality?: number;
  selfScore?: number;
  selfMax?: number;
};

export type Stats = {
  attempts: number;
  correct: number;
  wrong: number;
  history: HistoryEntry[];
};

export type Alternativa = {
  letra: string;
  texto: string;
  correta?: boolean;
  explicacao?: string;
};

export type Quesito = {
  numero?: number;
  pergunta?: string;
  pontos_max?: number;
  criterio?: string;
};

export type RubricaItem = {
  criterio: string;
  pontos: number;
  detalhamento?: string;
};

export type ObjetivaPayload = {
  enunciado: string;
  alternativas: Alternativa[];
  gabarito?: string;
  explicacao_geral?: string;
  pegadinhas?: string[];
  [k: string]: unknown;
};

export type DiscursivaPayload = {
  tipo?: string;
  tipo_discursiva?: string;
  numero_ordem?: number;
  bloco_plano?: string;
  enunciado_completo?: string;
  enunciado?: string;
  texto_base?: string;
  comando?: string;
  quesitos?: Quesito[];
  rubrica?: RubricaItem[];
  espelho_resposta?: string;
  conceitos_chave?: string[];
  pegadinhas_esperadas?: string[];
  estrategia_redacao?: string;
  observacoes_corretor?: string;
  apostas_relacionadas?: string[];
  [k: string]: unknown;
};

export type QuestionType = 'objetiva' | 'discursiva';

export type Question = {
  id: string;
  user_id: string;
  type: QuestionType;
  disciplina_id: string | null;
  tema: string | null;
  banca_estilo: string | null;
  dificuldade: number | null;
  payload: ObjetivaPayload | DiscursivaPayload;
  srs: SRS;
  stats: Stats;
  created_at: string;       // ISO
  updated_at: string;       // ISO
  deleted_at: string | null; // ISO (soft delete)
  /** Marcado quando há mutações locais não sincronizadas. */
  _dirty?: boolean;
  // ===== Campos da migration 0002 (hierarquia) =====
  // Opcionais aqui pra não quebrar leitura de localStorage antigo nem
  // de rows sincronizadas antes da 0002 ter sido aplicada. Server tem
  // default '[]' pra tags; topico_id e concurso_id ficam null.
  /** UUID do tópico (referencia public.topicos.id). Null = sem tópico. */
  topico_id?: string | null;
  /** UUID do concurso ao qual esta questão está vinculada. */
  concurso_id?: string | null;
  /** Tags livres pra cortes ortogonais à hierarquia. */
  tags?: string[];
};

// =====================================================================
// Hierarquia (migration 0002)
// =====================================================================

export type ConcursoStatus = 'ativo' | 'arquivado' | 'concluido';

export type Concurso = {
  id: string;
  user_id: string;
  nome: string;
  banca: string | null;
  orgao: string | null;
  cargo: string | null;
  /** ISO date YYYY-MM-DD (sem hora). */
  data_prova: string | null;
  status: ConcursoStatus;
  edital_url: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  _dirty?: boolean;
};

export type Disciplina = {
  id: string;
  user_id: string;
  nome: string;
  /** Peso default da disciplina (sobrescrito por concurso_disciplinas.peso). */
  peso_default: number | null;
  /** Cor hex `#rrggbb` ou null. Validado no DB. */
  cor: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  _dirty?: boolean;
};

export type ConcursoDisciplina = {
  id: string;
  user_id: string;
  concurso_id: string;
  disciplina_id: string;
  peso: number;
  qtd_questoes_prova: number | null;
  created_at: string;
  updated_at: string;
  _dirty?: boolean;
};

export type Topico = {
  id: string;
  user_id: string;
  disciplina_id: string;
  /** Tópico pai (hierárquico). Null = raiz da disciplina. */
  parent_topico_id: string | null;
  nome: string;
  ordem: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  _dirty?: boolean;
};

export type EditalItem = {
  id: string;
  user_id: string;
  concurso_id: string;
  /** Tópico ao qual este item do edital foi mapeado. */
  topico_id: string | null;
  texto_original: string;
  ordem: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  _dirty?: boolean;
};

export type StudyMode = 'srs' | 'aleatorio' | 'dificuldade' | 'erros' | 'novas';

export type SessionConfig = {
  disciplinas: string[];
  qtd: number;
  modo: StudyMode;
  tempo: number;
  difMin: number;
  difMax: number;
  embaralhar: boolean;
};

export type DiscSessionConfig = {
  disciplinas: string[];
  qtd: number;
  modo: 'srs' | 'aleatorio' | 'novas';
};
