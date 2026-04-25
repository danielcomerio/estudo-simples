export type SRS = {
  easeFactor: number;
  interval: number;       // dias
  repetitions: number;
  dueDate: number;        // epoch ms
  lastReviewed: number | null;
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
