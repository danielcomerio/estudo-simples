# ADR 0003 — AI Tutor BYO key (não managed)

## Status

Aceito (2026-05-07).

## Contexto

Feature de IA explicando questões erradas é diferencial competitivo
forte. 2 modelos:
1. **Managed**: app paga API call, gate por plano.
2. **BYO**: user pluga sua chave, paga direto no provider.

## Decisão

BYO. Razões:
- Custo zero pro app (escala sem teto financeiro).
- User tem controle (escolhe modelo, vê billing).
- Pro users provavelmente já têm conta nesses providers.

## Consequências

- + Sem custo escala
- + User decide modelo (gpt-4 vs haiku)
- − Fricção pro user comum (precisa criar conta no provider)
- − Suporte mais difícil (debug requer "qual chave você usou?")

## Mitigações

- Tutorial inline de como pegar chave (link direto pra console).
- Defaults inteligentes (haiku/mini = $0.001 por uso).
- Validação client-side de prefix da chave.

## Reavaliação

Se BYO ficar muito limitante, considerar managed pra Pro com cap de uso
(ex: 100 req/mês).
