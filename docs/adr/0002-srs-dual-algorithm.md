# ADR 0002 — SRS dual SM-2 + FSRS-6

## Status

Aceito (2026-04-29).

## Contexto

SM-2 (algoritmo do Anki clássico) tem comportamento previsível mas não é
state-of-art. FSRS-6 é mais cientificamente embasado, mas mais complexo.

Migração entre algoritmos exigia decisão.

## Decisão

Suportar AMBOS, opt-in via `/configuracoes`. SM-2 como default
(compatibilidade + simplicidade); FSRS-6 como evolução opcional.

## Implementação

- `lib/srs.ts` — SM-2.
- `lib/srs-fsrs.ts` — wrapper sobre `ts-fsrs` lib.
- Ponto de entrada único: `applyReview(card, quality, algorithm)`.
- SRS struct ganhou fields opcionais (`stability`, `difficulty`, `state`,
  `lapses`) sem corromper SM-2.

## Consequências

- + Usuários novos podem testar FSRS sem perder SM-2.
- + Migração entre algoritmos preserva histórico.
- − Manutenção de 2 paths.
