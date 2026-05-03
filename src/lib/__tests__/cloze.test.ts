import { describe, expect, it } from 'vitest';
import { parseCloze, renderClozeHTML } from '../cloze';

describe('parseCloze', () => {
  it('texto sem marcadores → 0 blanks', () => {
    const r = parseCloze('texto simples');
    expect(r.blanks).toEqual([]);
    expect(r.fullText).toBe('texto simples');
    expect(r.hiddenText).toBe('texto simples');
  });

  it('extrai 1 lacuna', () => {
    const r = parseCloze('Art. {{c1::5º}} da CF.');
    expect(r.blanks).toEqual([{ idx: 1, resposta: '5º', dica: undefined }]);
    expect(r.fullText).toBe('Art. 5º da CF.');
    expect(r.hiddenText).toBe('Art. ____ da CF.');
  });

  it('extrai múltiplas lacunas em ordem', () => {
    const r = parseCloze(
      '{{c1::Caput}}: {{c2::Todos}} são iguais perante a {{c3::lei}}.'
    );
    expect(r.blanks.map((b) => b.resposta)).toEqual(['Caput', 'Todos', 'lei']);
    expect(r.fullText).toBe('Caput: Todos são iguais perante a lei.');
  });

  it('aceita índices repetidos', () => {
    const r = parseCloze('{{c1::A}} e {{c1::B}}');
    expect(r.blanks).toHaveLength(2);
    expect(r.blanks[0].idx).toBe(1);
    expect(r.blanks[1].idx).toBe(1);
  });

  it('preserva dica em hiddenText', () => {
    const r = parseCloze('Lei {{c1::14.133/21::licitações}}');
    expect(r.blanks[0].dica).toBe('licitações');
    expect(r.hiddenText).toBe('Lei [licitações]');
    expect(r.fullText).toBe('Lei 14.133/21');
  });

  it('vazio → tudo vazio', () => {
    const r = parseCloze('');
    expect(r.blanks).toEqual([]);
    expect(r.fullText).toBe('');
  });
});

describe('renderClozeHTML', () => {
  it('mode hidden → ____', () => {
    const html = renderClozeHTML('Art. {{c1::5º}} da CF.', 'hidden');
    expect(html).toBe(
      'Art. <span class="cloze-hidden">____</span> da CF.'
    );
  });

  it('mode revealed → resposta em span', () => {
    const html = renderClozeHTML('Art. {{c1::5º}} da CF.', 'revealed');
    expect(html).toBe(
      'Art. <span class="cloze-revealed">5º</span> da CF.'
    );
  });

  it('escapa HTML do texto e da resposta', () => {
    const html = renderClozeHTML('<script>{{c1::<bad>}}</script>', 'revealed');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<span class="cloze-revealed">&lt;bad&gt;</span>');
  });

  it('quebras de linha viram <br>', () => {
    const html = renderClozeHTML('linha 1\nlinha 2', 'hidden');
    expect(html).toBe('linha 1<br>linha 2');
  });

  it('mostra dica entre colchetes em hidden', () => {
    const html = renderClozeHTML('A {{c1::x::dica}} B', 'hidden');
    expect(html).toBe('A <span class="cloze-hidden">[dica]</span> B');
  });
});
