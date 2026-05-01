import { describe, expect, it } from 'vitest';
import {
  SimuladoValidationError,
  abandonarSimulado,
  calcularResultado,
  createSimulado,
  filterPoolForSimulado,
  finalizarSimulado,
  isFinalized,
  isFinishedAfterTimeUp,
  marcarTempoExpirado,
  pickQuestionsForSimulado,
  recordAnswer,
  todasRespondidas,
  toggleRevisar,
  validateSimuladoConfig,
} from '../simulado';
import { newSRS, newStats } from '../srs';
import type {
  ObjetivaPayload,
  Question,
  SimuladoConfig,
} from '../types';

const baseCfg: SimuladoConfig = {
  disciplinas: [],
  qtd: 10,
  tempo_limite_min: 60,
  embaralhar: false,
  embaralhar_alternativas: false,
};

let questionCounter = 0;
function mkQuestion(opts: {
  disciplina?: string;
  banca?: string;
  dif?: number;
  type?: 'objetiva' | 'discursiva';
  gabarito?: string;
  noGabarito?: boolean;
  deleted?: boolean;
} = {}): Question {
  questionCounter++;
  const isObj = (opts.type ?? 'objetiva') === 'objetiva';
  const payload: ObjetivaPayload = {
    enunciado: `Q${questionCounter}`,
    alternativas: [
      { letra: 'A', texto: 'a' },
      { letra: 'B', texto: 'b', correta: opts.gabarito === 'B' },
      { letra: 'C', texto: 'c' },
    ],
    gabarito: opts.noGabarito ? undefined : opts.gabarito ?? 'B',
  };
  return {
    id: `q-${questionCounter}`,
    user_id: 'u1',
    type: isObj ? 'objetiva' : 'discursiva',
    disciplina_id: opts.disciplina ?? 'portugues',
    tema: null,
    banca_estilo: opts.banca ?? null,
    dificuldade: opts.dif ?? null,
    payload,
    srs: newSRS(),
    stats: newStats(),
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: opts.deleted ? '2026-01-02' : null,
  };
}

function lookup(qs: Question[]) {
  return new Map(qs.map((q) => [q.id, q] as const));
}

describe('validateSimuladoConfig', () => {
  it('aceita config válida', () => {
    expect(() => validateSimuladoConfig(baseCfg)).not.toThrow();
  });

  it('rejeita qtd <= 0 ou > 500 (defesa contra abuso)', () => {
    expect(() => validateSimuladoConfig({ ...baseCfg, qtd: 0 })).toThrow(
      SimuladoValidationError
    );
    expect(() =>
      validateSimuladoConfig({ ...baseCfg, qtd: 501 })
    ).toThrow(/qtd/);
    expect(() =>
      validateSimuladoConfig({ ...baseCfg, qtd: 1.5 })
    ).toThrow(/qtd/);
  });

  it('rejeita tempo > 24h ou negativo', () => {
    expect(() =>
      validateSimuladoConfig({ ...baseCfg, tempo_limite_min: -1 })
    ).toThrow(/tempo_limite/);
    expect(() =>
      validateSimuladoConfig({ ...baseCfg, tempo_limite_min: 1500 })
    ).toThrow(/tempo_limite/);
  });

  it('aceita tempo_limite_min=0 (sem limite)', () => {
    expect(() =>
      validateSimuladoConfig({ ...baseCfg, tempo_limite_min: 0 })
    ).not.toThrow();
  });

  it('rejeita disciplinas com itens não-string (input forjado)', () => {
    expect(() =>
      validateSimuladoConfig({
        ...baseCfg,
        disciplinas: [42 as unknown as string],
      })
    ).toThrow(/disciplinas/);
  });

  it('rejeita dif fora de [1,5]', () => {
    expect(() =>
      validateSimuladoConfig({ ...baseCfg, dif_min: 0 })
    ).toThrow(/dif_min/);
    expect(() =>
      validateSimuladoConfig({ ...baseCfg, dif_max: 6 })
    ).toThrow(/dif_max/);
  });

  it('rejeita dif_min > dif_max', () => {
    expect(() =>
      validateSimuladoConfig({ ...baseCfg, dif_min: 4, dif_max: 2 })
    ).toThrow(/dif_min/);
  });
});

describe('filterPoolForSimulado', () => {
  it('exclui discursivas, soft-deleted e sem gabarito', () => {
    const qs = [
      mkQuestion(),
      mkQuestion({ type: 'discursiva' }),
      mkQuestion({ deleted: true }),
      mkQuestion({ noGabarito: true, gabarito: undefined }),
    ];
    // Forçar última a não ter alternativa correta também
    (qs[3].payload as ObjetivaPayload).alternativas = [
      { letra: 'A', texto: 'a' },
      { letra: 'B', texto: 'b' },
    ];
    const out = filterPoolForSimulado(qs, baseCfg);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(qs[0].id);
  });

  it('filtra por disciplinas', () => {
    const qs = [
      mkQuestion({ disciplina: 'a' }),
      mkQuestion({ disciplina: 'b' }),
      mkQuestion({ disciplina: 'c' }),
    ];
    const out = filterPoolForSimulado(qs, {
      ...baseCfg,
      disciplinas: ['a', 'b'],
    });
    expect(out.map((q) => q.disciplina_id).sort()).toEqual(['a', 'b']);
  });

  it('filtra por banca_estilo', () => {
    const qs = [
      mkQuestion({ banca: 'FGV' }),
      mkQuestion({ banca: 'CESPE' }),
    ];
    const out = filterPoolForSimulado(qs, {
      ...baseCfg,
      banca_estilo: 'FGV',
    });
    expect(out.map((q) => q.banca_estilo)).toEqual(['FGV']);
  });

  it('filtra por dif_min/dif_max', () => {
    const qs = [
      mkQuestion({ dif: 1 }),
      mkQuestion({ dif: 3 }),
      mkQuestion({ dif: 5 }),
    ];
    const out = filterPoolForSimulado(qs, {
      ...baseCfg,
      dif_min: 2,
      dif_max: 4,
    });
    expect(out.map((q) => q.dificuldade)).toEqual([3]);
  });
});

describe('pickQuestionsForSimulado', () => {
  it('respeita qtd e ordem (sem embaralhar)', () => {
    const qs = [mkQuestion(), mkQuestion(), mkQuestion(), mkQuestion()];
    const out = pickQuestionsForSimulado(qs, { ...baseCfg, qtd: 2 });
    expect(out).toEqual(qs.slice(0, 2));
  });

  it('pool menor que qtd retorna pool inteiro', () => {
    const qs = [mkQuestion(), mkQuestion()];
    const out = pickQuestionsForSimulado(qs, { ...baseCfg, qtd: 5 });
    expect(out).toHaveLength(2);
  });

  it('embaralha quando solicitado (ordem provavelmente diferente)', () => {
    const qs = Array.from({ length: 50 }, () => mkQuestion());
    const a = pickQuestionsForSimulado(qs, {
      ...baseCfg,
      qtd: 50,
      embaralhar: true,
    });
    const b = pickQuestionsForSimulado(qs, {
      ...baseCfg,
      qtd: 50,
      embaralhar: true,
    });
    // Probabilisticamente, duas embaralhadas de 50 itens não vão coincidir
    const igual = a.every((q, i) => q.id === b[i].id);
    expect(igual).toBe(false);
  });
});

describe('createSimulado', () => {
  it('cria simulado em_andamento com resultados vazios alinhados', () => {
    const qs = [mkQuestion(), mkQuestion(), mkQuestion()];
    const sim = createSimulado(qs, baseCfg, 'u1');
    expect(sim.status).toBe('em_andamento');
    expect(sim.question_ids).toEqual(qs.map((q) => q.id));
    expect(sim.resultados).toHaveLength(3);
    for (const r of sim.resultados) {
      expect(r.letra_marcada).toBeNull();
      expect(r.correto).toBeNull();
      expect(r.respondido_apos_tempo).toBe(false);
      expect(r.marcado_revisar).toBe(false);
    }
    expect(sim.tempo_expirou_at).toBeNull();
    expect(sim.finished_at).toBeNull();
  });

  it('rejeita pool vazio (sem questões pra rodar)', () => {
    expect(() => createSimulado([], baseCfg, 'u1')).toThrow(
      SimuladoValidationError
    );
  });
});

describe('recordAnswer', () => {
  it('marca letra correta e calcula correto=true', () => {
    const q = mkQuestion({ gabarito: 'B' });
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = recordAnswer(sim, q.id, 'B', q, 5000, false);
    expect(sim.resultados[0].letra_marcada).toBe('B');
    expect(sim.resultados[0].correto).toBe(true);
    expect(sim.resultados[0].ms_para_responder).toBe(5000);
    expect(sim.resultados[0].respondido_apos_tempo).toBe(false);
  });

  it('letra errada → correto=false', () => {
    const q = mkQuestion({ gabarito: 'B' });
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = recordAnswer(sim, q.id, 'A', q, 1000, false);
    expect(sim.resultados[0].correto).toBe(false);
  });

  it('letra null limpa resposta (volta a não respondida)', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = recordAnswer(sim, q.id, 'B', q, 1000, false);
    sim = recordAnswer(sim, q.id, null, q, null, false);
    expect(sim.resultados[0].letra_marcada).toBeNull();
    expect(sim.resultados[0].correto).toBeNull();
  });

  it('case-insensitive: "b" e "B" tratados igual', () => {
    const q = mkQuestion({ gabarito: 'B' });
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = recordAnswer(sim, q.id, 'b', q, 1000, false);
    expect(sim.resultados[0].letra_marcada).toBe('B');
    expect(sim.resultados[0].correto).toBe(true);
  });

  it('respondido_apos_tempo flag respeitada (tempo extra)', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = recordAnswer(sim, q.id, 'B', q, 1000, true);
    expect(sim.resultados[0].respondido_apos_tempo).toBe(true);
  });

  it('não modifica simulado finalizado (segurança contra race)', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = finalizarSimulado(sim, 'voluntario_no_tempo');
    const out = recordAnswer(sim, q.id, 'B', q, 1000, false);
    expect(out).toBe(sim); // mesma referência → ignorado
  });

  it('ignora questão fora do pool (defesa contra UI inconsistente)', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    const out = recordAnswer(sim, 'inexistente', 'B', q, 1000, false);
    expect(out).toBe(sim);
  });
});

describe('toggleRevisar', () => {
  it('alterna o flag', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = toggleRevisar(sim, q.id);
    expect(sim.resultados[0].marcado_revisar).toBe(true);
    sim = toggleRevisar(sim, q.id);
    expect(sim.resultados[0].marcado_revisar).toBe(false);
  });
});

describe('marcarTempoExpirado', () => {
  it('seta tempo_expirou_at sem mudar status', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = marcarTempoExpirado(sim, 12345);
    expect(sim.tempo_expirou_at).toBe(12345);
    expect(sim.status).toBe('em_andamento');
  });

  it('não re-marca se já expirou (idempotente)', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = marcarTempoExpirado(sim, 100);
    const ref = sim;
    sim = marcarTempoExpirado(sim, 999);
    expect(sim).toBe(ref); // ignorado
  });
});

describe('finalizarSimulado', () => {
  it.each([
    ['voluntario_no_tempo' as const, 'finalizado_no_tempo'],
    ['completo' as const, 'finalizado_completo'],
    ['timeup_stopped' as const, 'finalizado_timeup_stopped'],
    ['timeup_extra_finalizado' as const, 'finalizado_extra'],
  ])('motivo %s → status %s', (motivo, status) => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = finalizarSimulado(sim, motivo, 5000);
    expect(sim.status).toBe(status);
    expect(sim.finished_at).toBe(5000);
  });

  it('idempotente: re-finalizar não muda', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = finalizarSimulado(sim, 'voluntario_no_tempo', 100);
    const ref = sim;
    sim = finalizarSimulado(sim, 'completo', 999);
    expect(sim).toBe(ref);
  });
});

describe('abandonarSimulado', () => {
  it('marca como abandonado', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    sim = abandonarSimulado(sim, 100);
    expect(sim.status).toBe('abandonado');
    expect(sim.finished_at).toBe(100);
  });
});

describe('helpers', () => {
  it('isFinalized: true pra qualquer status != em_andamento', () => {
    const q = mkQuestion();
    let sim = createSimulado([q], baseCfg, 'u1');
    expect(isFinalized(sim)).toBe(false);
    sim = finalizarSimulado(sim, 'completo');
    expect(isFinalized(sim)).toBe(true);
  });

  it('isFinishedAfterTimeUp: só timeup_stopped e finalizado_extra', () => {
    const q = mkQuestion();
    let sim1 = createSimulado([q], baseCfg, 'u1');
    sim1 = finalizarSimulado(sim1, 'voluntario_no_tempo');
    expect(isFinishedAfterTimeUp(sim1)).toBe(false);

    let sim2 = createSimulado([q], baseCfg, 'u1');
    sim2 = finalizarSimulado(sim2, 'timeup_stopped');
    expect(isFinishedAfterTimeUp(sim2)).toBe(true);

    let sim3 = createSimulado([q], baseCfg, 'u1');
    sim3 = finalizarSimulado(sim3, 'timeup_extra_finalizado');
    expect(isFinishedAfterTimeUp(sim3)).toBe(true);
  });

  it('todasRespondidas: true só quando todas têm letra', () => {
    const qs = [mkQuestion(), mkQuestion()];
    let sim = createSimulado(qs, baseCfg, 'u1');
    expect(todasRespondidas(sim)).toBe(false);
    sim = recordAnswer(sim, qs[0].id, 'B', qs[0], 100, false);
    expect(todasRespondidas(sim)).toBe(false);
    sim = recordAnswer(sim, qs[1].id, 'A', qs[1], 100, false);
    expect(todasRespondidas(sim)).toBe(true);
  });
});

describe('calcularResultado — cenários completos', () => {
  it('cenário 1: tudo dentro do tempo, mistura de certas/erradas/em-branco', () => {
    const qs = [
      mkQuestion({ disciplina: 'port', gabarito: 'B' }), // certa
      mkQuestion({ disciplina: 'port', gabarito: 'A' }), // errada
      mkQuestion({ disciplina: 'mat', gabarito: 'C' }),  // em branco
    ];
    let sim = createSimulado(qs, baseCfg, 'u1');
    sim = recordAnswer(sim, qs[0].id, 'B', qs[0], 5000, false);
    sim = recordAnswer(sim, qs[1].id, 'B', qs[1], 4000, false); // errada
    sim = finalizarSimulado(sim, 'voluntario_no_tempo', sim.started_at + 10_000);

    const r = calcularResultado(sim, lookup(qs));
    expect(r.total).toBe(3);
    expect(r.respondidas_no_tempo).toBe(2);
    expect(r.respondidas_extra).toBe(0);
    expect(r.nao_respondidas).toBe(1);
    expect(r.acertos_no_tempo).toBe(1);
    expect(r.acertos_extra).toBe(0);
    expect(r.pct_no_tempo).toBeCloseTo(1 / 3);
    expect(r.pct_geral).toBeCloseTo(1 / 3);
    expect(r.tempo_total_ms).toBe(10_000);
    expect(r.por_disciplina).toHaveLength(2);
    const port = r.por_disciplina.find((d) => d.disciplina === 'port')!;
    expect(port.total).toBe(2);
    expect(port.certas_no_tempo).toBe(1);
    expect(port.erradas_no_tempo).toBe(1);
    expect(r.questoes_erradas).toHaveLength(1);
    expect(r.questoes_nao_respondidas).toHaveLength(1);
  });

  it('cenário 2: tempo expirou, user continuou e respondeu mais → tempo extra contabilizado separado', () => {
    const qs = [mkQuestion(), mkQuestion(), mkQuestion()];
    const t0 = 1_000_000;
    let sim = createSimulado(qs, baseCfg, 'u1', t0);

    // Respondeu 1 dentro do tempo
    sim = recordAnswer(sim, qs[0].id, 'B', qs[0], 5000, false, t0 + 5000);
    // Tempo acabou
    sim = marcarTempoExpirado(sim, t0 + 60_000);
    // User continuou e respondeu 2 mais (tempo extra)
    sim = recordAnswer(sim, qs[1].id, 'B', qs[1], 3000, true, t0 + 65_000);
    sim = recordAnswer(sim, qs[2].id, 'A', qs[2], 4000, true, t0 + 70_000);
    sim = finalizarSimulado(sim, 'timeup_extra_finalizado', t0 + 70_000);

    const r = calcularResultado(sim, lookup(qs));
    expect(r.respondidas_no_tempo).toBe(1);
    expect(r.respondidas_extra).toBe(2);
    expect(r.nao_respondidas).toBe(0);
    expect(r.acertos_no_tempo).toBe(1);
    expect(r.acertos_extra).toBe(1); // qs[1] gabarito B, marcou B
    expect(r.tempo_total_ms).toBe(70_000);
    expect(r.tempo_no_limite_ms).toBe(60_000);
    expect(r.pct_no_tempo).toBeCloseTo(1 / 3);
    expect(r.pct_geral).toBeCloseTo(2 / 3);
  });

  it('cenário 3: tempo expirou e user encerrou na hora → não respondidas contam', () => {
    const qs = [mkQuestion(), mkQuestion(), mkQuestion()];
    const t0 = 1_000_000;
    let sim = createSimulado(qs, baseCfg, 'u1', t0);
    sim = recordAnswer(sim, qs[0].id, 'B', qs[0], 5000, false, t0 + 5000);
    sim = marcarTempoExpirado(sim, t0 + 60_000);
    sim = finalizarSimulado(sim, 'timeup_stopped', t0 + 60_000);

    const r = calcularResultado(sim, lookup(qs));
    expect(r.respondidas_no_tempo).toBe(1);
    expect(r.respondidas_extra).toBe(0);
    expect(r.nao_respondidas).toBe(2);
    expect(r.questoes_nao_respondidas).toHaveLength(2);
  });

  it('cenário 4: marcadas pra revisar listadas separadamente', () => {
    const qs = [mkQuestion(), mkQuestion()];
    let sim = createSimulado(qs, baseCfg, 'u1');
    sim = toggleRevisar(sim, qs[0].id);
    sim = recordAnswer(sim, qs[0].id, 'B', qs[0], 100, false);
    sim = finalizarSimulado(sim, 'voluntario_no_tempo');
    const r = calcularResultado(sim, lookup(qs));
    expect(r.questoes_marcadas).toHaveLength(1);
    expect(r.questoes_marcadas[0].question_id).toBe(qs[0].id);
  });

  it('tempo médio por resposta ignora não respondidas', () => {
    const qs = [mkQuestion(), mkQuestion(), mkQuestion()];
    let sim = createSimulado(qs, baseCfg, 'u1');
    sim = recordAnswer(sim, qs[0].id, 'B', qs[0], 6000, false);
    sim = recordAnswer(sim, qs[1].id, 'A', qs[1], 4000, false);
    // qs[2] não respondida
    sim = finalizarSimulado(sim, 'voluntario_no_tempo');
    const r = calcularResultado(sim, lookup(qs));
    expect(r.tempo_medio_por_resposta_ms).toBe(5000);
  });
});
