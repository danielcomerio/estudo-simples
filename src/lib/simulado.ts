/**
 * Lógica pura do modo Simulado. Sem IO — todas as funções recebem e
 * retornam objetos. Persistência (localStorage) e UI ficam fora deste
 * módulo. Permite testar com confiança o cálculo de score e regras de
 * "tempo extra".
 *
 * Conceitos:
 *  - "Dentro do tempo": resposta com `respondido_apos_tempo = false`.
 *  - "Tempo extra": resposta com `respondido_apos_tempo = true`. Só
 *    existe se o usuário escolheu "continuar" no dialog do cronômetro.
 *  - "Não respondida": `letra_marcada === null` no momento de finalizar.
 *
 * Regras invariantes:
 *  - `letra_marcada` em `null` significa não respondida; nunca string vazia.
 *  - `correto` é null se `letra_marcada` é null. Caso contrário,
 *    booleano calculado contra `payload.gabarito`.
 *  - `respondido_apos_tempo` só pode ser true se config tempo > 0 e
 *    `tempo_expirou_at` está setado e a resposta veio depois.
 */

import type {
  ObjetivaPayload,
  Question,
  Simulado,
  SimuladoConfig,
  SimuladoQuestionResult,
  SimuladoStatus,
} from './types';
import { shuffle } from './utils';

const VALID_STATUS_TIMEUP_FINISHED: SimuladoStatus[] = [
  'finalizado_timeup_stopped',
  'finalizado_extra',
];

// =====================================================================
// Validação de config
// =====================================================================

export class SimuladoValidationError extends Error {
  constructor(public field: string, msg: string) {
    super(`${field}: ${msg}`);
    this.name = 'SimuladoValidationError';
  }
}

export function validateSimuladoConfig(cfg: SimuladoConfig): void {
  if (!Number.isInteger(cfg.qtd) || cfg.qtd < 1 || cfg.qtd > 500) {
    throw new SimuladoValidationError('qtd', 'inteiro entre 1 e 500');
  }
  if (
    !Number.isFinite(cfg.tempo_limite_min) ||
    cfg.tempo_limite_min < 0 ||
    cfg.tempo_limite_min > 24 * 60
  ) {
    throw new SimuladoValidationError(
      'tempo_limite_min',
      'entre 0 (sem limite) e 1440 (24h)'
    );
  }
  if (!Array.isArray(cfg.disciplinas)) {
    throw new SimuladoValidationError('disciplinas', 'array obrigatório');
  }
  for (const d of cfg.disciplinas) {
    if (typeof d !== 'string') {
      throw new SimuladoValidationError(
        'disciplinas',
        'cada item deve ser string'
      );
    }
  }
  if (cfg.dif_min !== undefined) {
    if (
      !Number.isInteger(cfg.dif_min) ||
      cfg.dif_min < 1 ||
      cfg.dif_min > 5
    ) {
      throw new SimuladoValidationError('dif_min', 'inteiro 1-5');
    }
  }
  if (cfg.dif_max !== undefined) {
    if (
      !Number.isInteger(cfg.dif_max) ||
      cfg.dif_max < 1 ||
      cfg.dif_max > 5
    ) {
      throw new SimuladoValidationError('dif_max', 'inteiro 1-5');
    }
  }
  if (
    cfg.dif_min !== undefined &&
    cfg.dif_max !== undefined &&
    cfg.dif_min > cfg.dif_max
  ) {
    throw new SimuladoValidationError(
      'dif_min/dif_max',
      'min não pode ser maior que max'
    );
  }
}

// =====================================================================
// Construção do pool
// =====================================================================

/**
 * Filtra questões aplicáveis ao simulado. Só objetivas (discursivas
 * ficam pra etapa futura — exigem self-eval que não cabe em sessão
 * cronometrada).
 */
export function filterPoolForSimulado(
  all: Question[],
  cfg: SimuladoConfig
): Question[] {
  return all.filter((q) => {
    if (q.deleted_at) return false;
    if (q.type !== 'objetiva') return false;
    const p = q.payload as ObjetivaPayload;
    if (!p.gabarito && !p.alternativas?.some((a) => a.correta)) return false;
    if (cfg.disciplinas.length > 0) {
      if (!q.disciplina_id || !cfg.disciplinas.includes(q.disciplina_id)) {
        return false;
      }
    }
    if (cfg.banca_estilo && q.banca_estilo !== cfg.banca_estilo) return false;
    if (cfg.dif_min !== undefined && (q.dificuldade ?? 0) < cfg.dif_min)
      return false;
    if (cfg.dif_max !== undefined && (q.dificuldade ?? 5) > cfg.dif_max)
      return false;
    return true;
  });
}

/**
 * Escolhe `qtd` questões do pool, opcionalmente embaralhando.
 * Garante que sempre devolve no máximo `qtd` (e o pool inteiro se
 * menor).
 */
export function pickQuestionsForSimulado(
  pool: Question[],
  cfg: SimuladoConfig
): Question[] {
  const ordered = cfg.embaralhar ? shuffle(pool) : pool.slice();
  return ordered.slice(0, cfg.qtd);
}

/**
 * Cria um Simulado a partir de uma lista de Question. Não persiste —
 * caller (UI/store) é responsável.
 */
export function createSimulado(
  questions: Question[],
  config: SimuladoConfig,
  userId: string,
  now: number = Date.now()
): Simulado {
  validateSimuladoConfig(config);
  if (questions.length === 0) {
    throw new SimuladoValidationError('questions', 'pool vazio');
  }
  const ids = questions.map((q) => q.id);
  const resultados: SimuladoQuestionResult[] = ids.map((qid) => ({
    question_id: qid,
    letra_marcada: null,
    correto: null,
    ms_para_responder: null,
    respondido_apos_tempo: false,
    marcado_revisar: false,
  }));
  return {
    id: cryptoUuid(),
    user_id: userId,
    config,
    question_ids: ids,
    resultados,
    status: 'em_andamento',
    started_at: now,
    finished_at: null,
    tempo_expirou_at: null,
  };
}

function cryptoUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return (
    's_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 11)
  );
}

// =====================================================================
// Mutações imutáveis
// =====================================================================

/**
 * Marca uma resposta. Se `letra` é null, "limpa" a resposta (volta a
 * não respondida). Calcula `correto` contra o gabarito da questão.
 *
 * `afterTimeUp` deve ser true só se o caller garantiu que tempo
 * expirou (tipicamente: simulado.tempo_expirou_at !== null).
 */
export function recordAnswer(
  sim: Simulado,
  questionId: string,
  letra: string | null,
  question: Question,
  msParaResponder: number | null,
  afterTimeUp: boolean,
  now: number = Date.now()
): Simulado {
  if (sim.status !== 'em_andamento') return sim; // não modifica simulado já finalizado
  void now;

  const idx = sim.question_ids.indexOf(questionId);
  if (idx === -1) return sim;

  const payload = question.payload as ObjetivaPayload;
  const gabarito = payload.gabarito ??
    payload.alternativas?.find((a) => a.correta)?.letra ??
    null;

  const letraNorm = letra && letra.trim() ? letra.trim().toUpperCase() : null;
  const correto =
    letraNorm === null
      ? null
      : gabarito !== null && letraNorm === gabarito.toUpperCase();

  const resultados = sim.resultados.slice();
  resultados[idx] = {
    ...resultados[idx],
    letra_marcada: letraNorm,
    correto,
    ms_para_responder: msParaResponder,
    respondido_apos_tempo:
      letraNorm === null ? resultados[idx].respondido_apos_tempo : afterTimeUp,
  };

  return { ...sim, resultados };
}

/** Toggle do flag "marcar pra revisar" (estilo prova real). */
export function toggleRevisar(
  sim: Simulado,
  questionId: string
): Simulado {
  if (sim.status !== 'em_andamento') return sim;
  const idx = sim.question_ids.indexOf(questionId);
  if (idx === -1) return sim;
  const resultados = sim.resultados.slice();
  resultados[idx] = {
    ...resultados[idx],
    marcado_revisar: !resultados[idx].marcado_revisar,
  };
  return { ...sim, resultados };
}

/**
 * Sinaliza expiração do cronômetro. Não muda status (sim continua
 * 'em_andamento') — só seta `tempo_expirou_at`. UI mostra dialog com
 * 2 opções: continuar (chamar nada extra) ou encerrar (chamar
 * `finalizarSimulado`).
 */
export function marcarTempoExpirado(
  sim: Simulado,
  now: number = Date.now()
): Simulado {
  if (sim.status !== 'em_andamento') return sim;
  if (sim.tempo_expirou_at !== null) return sim; // já marcado
  return { ...sim, tempo_expirou_at: now };
}

/**
 * Finaliza o simulado. `motivo` determina o status final:
 *  - 'voluntario_no_tempo': user clicou finalizar antes do tempo expirar.
 *  - 'completo': todas as N questões foram respondidas (auto-finaliza).
 *  - 'timeup_stopped': tempo expirou e user escolheu encerrar.
 *  - 'timeup_extra_finalizado': user continuou após tempo, depois
 *     finalizou voluntariamente.
 */
export function finalizarSimulado(
  sim: Simulado,
  motivo:
    | 'voluntario_no_tempo'
    | 'completo'
    | 'timeup_stopped'
    | 'timeup_extra_finalizado',
  now: number = Date.now()
): Simulado {
  if (sim.status !== 'em_andamento') return sim;
  const status: SimuladoStatus =
    motivo === 'voluntario_no_tempo'
      ? 'finalizado_no_tempo'
      : motivo === 'completo'
        ? 'finalizado_completo'
        : motivo === 'timeup_stopped'
          ? 'finalizado_timeup_stopped'
          : 'finalizado_extra';
  return { ...sim, status, finished_at: now };
}

/** Marca como abandonado (caller decide quando — ex: usuário sai). */
export function abandonarSimulado(
  sim: Simulado,
  now: number = Date.now()
): Simulado {
  if (sim.status !== 'em_andamento') return sim;
  return { ...sim, status: 'abandonado', finished_at: now };
}

// =====================================================================
// Cálculo de resultado
// =====================================================================

export type DisciplinaBreakdown = {
  disciplina: string;
  total: number;
  certas_no_tempo: number;
  certas_extra: number;
  erradas_no_tempo: number;
  erradas_extra: number;
  nao_respondidas: number;
};

export type SimuladoResultado = {
  total: number;
  // Contagens globais
  respondidas_no_tempo: number;
  respondidas_extra: number;
  nao_respondidas: number;
  acertos_no_tempo: number;
  acertos_extra: number;
  // Percentuais (sobre o total, não sobre respondidas)
  pct_no_tempo: number;
  pct_geral: number;
  // Tempo
  tempo_total_ms: number;       // started_at → finished_at
  tempo_no_limite_ms: number;   // started_at → tempo_expirou_at OU finished_at se voluntário
  tempo_medio_por_resposta_ms: number;
  // Quebras por dimensão
  por_disciplina: DisciplinaBreakdown[];
  // Lista pra relatório completo
  questoes_erradas: SimuladoQuestionResult[];
  questoes_nao_respondidas: SimuladoQuestionResult[];
  // Marcadas pra revisar (independente de certas/erradas)
  questoes_marcadas: SimuladoQuestionResult[];
};

/**
 * Calcula o resultado consolidado. Só faz sentido pra simulados
 * finalizados, mas a função aceita 'em_andamento' também (útil pra
 * preview ao vivo).
 */
export function calcularResultado(
  sim: Simulado,
  questionLookup: Map<string, Question>
): SimuladoResultado {
  const total = sim.resultados.length;
  let respondidas_no_tempo = 0;
  let respondidas_extra = 0;
  let nao_respondidas = 0;
  let acertos_no_tempo = 0;
  let acertos_extra = 0;
  let soma_ms = 0;
  let count_ms = 0;

  const porDiscMap = new Map<string, DisciplinaBreakdown>();
  const erradas: SimuladoQuestionResult[] = [];
  const naoRespondidas: SimuladoQuestionResult[] = [];
  const marcadas: SimuladoQuestionResult[] = [];

  for (const r of sim.resultados) {
    const q = questionLookup.get(r.question_id);
    const disc = q?.disciplina_id ?? '(sem disciplina)';
    let breakdown = porDiscMap.get(disc);
    if (!breakdown) {
      breakdown = {
        disciplina: disc,
        total: 0,
        certas_no_tempo: 0,
        certas_extra: 0,
        erradas_no_tempo: 0,
        erradas_extra: 0,
        nao_respondidas: 0,
      };
      porDiscMap.set(disc, breakdown);
    }
    breakdown.total += 1;

    if (r.marcado_revisar) marcadas.push(r);

    if (r.letra_marcada === null) {
      nao_respondidas += 1;
      breakdown.nao_respondidas += 1;
      naoRespondidas.push(r);
      continue;
    }

    if (r.respondido_apos_tempo) respondidas_extra += 1;
    else respondidas_no_tempo += 1;

    if (r.ms_para_responder !== null) {
      soma_ms += r.ms_para_responder;
      count_ms += 1;
    }

    if (r.correto) {
      if (r.respondido_apos_tempo) {
        acertos_extra += 1;
        breakdown.certas_extra += 1;
      } else {
        acertos_no_tempo += 1;
        breakdown.certas_no_tempo += 1;
      }
    } else {
      if (r.respondido_apos_tempo) breakdown.erradas_extra += 1;
      else breakdown.erradas_no_tempo += 1;
      erradas.push(r);
    }
  }

  const finishedAt =
    sim.finished_at ?? (sim.tempo_expirou_at ?? Date.now());
  const tempo_total_ms = Math.max(0, finishedAt - sim.started_at);
  const tempo_no_limite_ms =
    sim.tempo_expirou_at !== null
      ? sim.tempo_expirou_at - sim.started_at
      : tempo_total_ms;
  const tempo_medio_por_resposta_ms = count_ms > 0 ? soma_ms / count_ms : 0;

  const pct_no_tempo = total > 0 ? acertos_no_tempo / total : 0;
  const pct_geral =
    total > 0 ? (acertos_no_tempo + acertos_extra) / total : 0;

  return {
    total,
    respondidas_no_tempo,
    respondidas_extra,
    nao_respondidas,
    acertos_no_tempo,
    acertos_extra,
    pct_no_tempo,
    pct_geral,
    tempo_total_ms,
    tempo_no_limite_ms,
    tempo_medio_por_resposta_ms,
    por_disciplina: Array.from(porDiscMap.values()).sort((a, b) =>
      a.disciplina.localeCompare(b.disciplina)
    ),
    questoes_erradas: erradas,
    questoes_nao_respondidas: naoRespondidas,
    questoes_marcadas: marcadas,
  };
}

// =====================================================================
// Helpers de status
// =====================================================================

export function isFinalized(sim: Simulado): boolean {
  return sim.status !== 'em_andamento';
}

export function isFinishedAfterTimeUp(sim: Simulado): boolean {
  return VALID_STATUS_TIMEUP_FINISHED.includes(sim.status);
}

export function todasRespondidas(sim: Simulado): boolean {
  return sim.resultados.every((r) => r.letra_marcada !== null);
}
