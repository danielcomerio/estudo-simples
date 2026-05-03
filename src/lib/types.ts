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
  /** Nota livre da revisão específica (ex: "errei por leitura, não conteúdo"). */
  notes?: string;
  /** Confidence rating informado ANTES de revelar gabarito.
   *  1 = chutei, 2 = incerto, 3 = confiante.
   *  Usado pra calibração metacognitiva: errar uma "confiante"
   *  é sinal de overconfidence; acertar uma "chutei" é sorte. */
  confidence?: 1 | 2 | 3;
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
  /** Anotações pessoais do user sobre essa questão (não vem do JSON original). */
  notes_user?: string;
  /** URLs públicas de imagens (Supabase Storage). Renderizadas no
   *  enunciado em ordem. Útil pra questões de prova com gráfico/tabela. */
  imagens?: string[];
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
  /** Anotações pessoais do user sobre essa questão (não vem do JSON original). */
  notes_user?: string;
  /** URLs públicas de imagens (Supabase Storage). */
  imagens?: string[];
  [k: string]: unknown;
};

export type QuestionType = 'objetiva' | 'discursiva';

// =====================================================================
// Origem / Fonte / Verificação (migration 0003)
// =====================================================================

/** De onde a questão veio:
 *  - 'real': prova oficial (banca + ano obrigatórios em fonte)
 *  - 'autoral': criada pelo user/IA
 *  - 'adaptada': baseada em real mas modificada
 *  - undefined/null: legado, antes da migration 0003 */
export type QuestionOrigem = 'real' | 'autoral' | 'adaptada';

/** Estado de revisão da questão. Útil pra triagem:
 *  - 'verificada': user revisou e confirmou que tá certa
 *  - 'pendente': importada mas precisa edição (ex: gabarito faltando)
 *  - 'duvidosa': pode ter problema (ex: enunciado menciona imagem ausente) */
export type QuestionVerificacao = 'verificada' | 'pendente' | 'duvidosa';

/** Metadata da fonte original. Preservado em jsonb pra evoluir sem
 *  migration. Quando origem='real', `banca` (string) e `ano` (number)
 *  são obrigatórios — DB CHECK valida. */
export type QuestionFonte = {
  banca?: string;
  ano?: number;
  prova?: string;
  orgao?: string;
  orgao_nome?: string;
  cargo?: string;
  /** Id da questão no sistema de origem (QConcursos etc) — útil pra
   *  evitar reimport silencioso e debugar conflitos. */
  external_id?: string | number;
  link?: string;
  [k: string]: unknown;
};

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
  // ===== Campos da migration 0003 (origem/fonte/verificação) =====
  /** Origem: real | autoral | adaptada. Null = legado. */
  origem?: QuestionOrigem | null;
  /** Metadata da fonte (banca, ano, etc.). Vazio = {}. */
  fonte?: QuestionFonte;
  /** Estado de revisão (verificada/pendente/duvidosa). Null = não revisada. */
  verificacao?: QuestionVerificacao | null;
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
  /** Intercala disciplinas em vez de blocos por disciplina. Estudo
   *  comprovado: melhora retenção e discriminação (Rohrer 2012). */
  interleaving?: boolean;
};

export type DiscSessionConfig = {
  disciplinas: string[];
  qtd: number;
  modo: 'srs' | 'aleatorio' | 'novas';
  interleaving?: boolean;
};

// =====================================================================
// Simulado (Onda 1)
// =====================================================================

export type SimuladoConfig = {
  /** Strings de disciplina_id (vazio = todas). */
  disciplinas: string[];
  /** Número de questões alvo. */
  qtd: number;
  /** Limite em minutos. 0 = sem limite (cronômetro só conta tempo). */
  tempo_limite_min: number;
  /** Embaralhar ordem de questões. */
  embaralhar: boolean;
  /** Embaralhar ordem das alternativas dentro de cada questão. */
  embaralhar_alternativas: boolean;
  /** Filtra só questões de uma banca específica. Vazio = qualquer. */
  banca_estilo?: string;
  /** Faixa de dificuldade (inclusive). */
  dif_min?: number;
  dif_max?: number;
};

export type SimuladoStatus =
  | 'em_andamento'
  | 'finalizado_no_tempo'        // user finalizou voluntariamente antes do tempo
  | 'finalizado_completo'         // todas as questões respondidas dentro ou fora
  | 'finalizado_timeup_stopped'   // tempo acabou e user escolheu encerrar
  | 'finalizado_extra'            // tempo acabou, user continuou, depois finalizou
  | 'abandonado';                 // user fechou sem finalizar (não chegou pro relatório)

export type SimuladoQuestionResult = {
  question_id: string;
  /** Letra marcada pelo user. null = não respondida. */
  letra_marcada: string | null;
  /** Calculado contra payload.gabarito quando respondida. */
  correto: boolean | null;
  /** Tempo (ms) gasto desde mostrar a questão até responder. */
  ms_para_responder: number | null;
  /** True se respondida APÓS o cronômetro chegar a zero (modo extra). */
  respondido_apos_tempo: boolean;
  /** Sinaliza pra revisar depois (igual prova real). */
  marcado_revisar: boolean;
};

export type Simulado = {
  /** UUID local. */
  id: string;
  user_id: string;
  config: SimuladoConfig;
  /** Ordem fixa estabelecida no início (após embaralhar se houver). */
  question_ids: string[];
  /** Mesma ordem de question_ids; índice i refere q[i]. */
  resultados: SimuladoQuestionResult[];
  status: SimuladoStatus;
  /** Epoch ms quando o usuário clicou "Iniciar". */
  started_at: number;
  /** Epoch ms quando finalizou (ou null se em andamento/abandonado). */
  finished_at: number | null;
  /**
   * Tempo (ms) em que o cronômetro chegou a 0. Null se finalizou
   * voluntariamente antes do tempo, ou se config.tempo_limite_min=0.
   */
  tempo_expirou_at: number | null;
  /** Nome opcional para o user identificar o simulado depois. */
  nome?: string;
};
