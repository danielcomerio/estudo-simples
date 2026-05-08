import { describe, expect, it } from 'vitest';
import { inferArea, inferRegion, parsePciRSS } from '../editais-rss';

describe('parsePciRSS', () => {
  it('parse 1 item simples', () => {
    const xml = `
<rss>
  <channel>
    <item>
      <title>Concurso Polícia Federal — 1500 vagas</title>
      <link>https://www.pciconcursos.com.br/x/123</link>
      <description>Edital aberto até 30/06</description>
      <guid>pci-123</guid>
      <pubDate>Wed, 01 May 2026 12:00:00 -0300</pubDate>
    </item>
  </channel>
</rss>`;
    const items = parsePciRSS(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('Polícia Federal');
    expect(items[0].sourceId).toBe('pci-123');
    expect(items[0].pubDate).toBeInstanceOf(Date);
  });

  it('múltiplos itens', () => {
    const xml = `
<rss><channel>
  <item><title>A</title><link>http://x/a</link><guid>1</guid></item>
  <item><title>B</title><link>http://x/b</link><guid>2</guid></item>
  <item><title>C</title><link>http://x/c</link><guid>3</guid></item>
</channel></rss>`;
    expect(parsePciRSS(xml)).toHaveLength(3);
  });

  it('strip CDATA', () => {
    const xml = `
<rss><item>
  <title><![CDATA[Concurso & Vagas]]></title>
  <link><![CDATA[https://x.com/a?b=1&c=2]]></link>
  <guid>g1</guid>
</item></rss>`;
    const items = parsePciRSS(xml);
    expect(items[0].title).toBe('Concurso & Vagas');
    expect(items[0].link).toBe('https://x.com/a?b=1&c=2');
  });

  it('item sem title ou link → ignorado', () => {
    const xml = `
<rss><channel>
  <item><title>OK</title><link>http://x/a</link><guid>1</guid></item>
  <item><link>http://x/b</link><guid>2</guid></item>
  <item><title>Sem link</title><guid>3</guid></item>
</channel></rss>`;
    expect(parsePciRSS(xml)).toHaveLength(1);
  });

  it('pubDate inválida → null', () => {
    const xml = `
<rss><item>
  <title>X</title><link>http://x</link><guid>1</guid>
  <pubDate>data inválida</pubDate>
</item></rss>`;
    expect(parsePciRSS(xml)[0].pubDate).toBe(null);
  });

  it('XML vazio → []', () => {
    expect(parsePciRSS('<rss></rss>')).toEqual([]);
    expect(parsePciRSS('')).toEqual([]);
  });

  it('truncate title > 500 chars', () => {
    const longTitle = 'A'.repeat(600);
    const xml = `<rss><item><title>${longTitle}</title><link>http://x</link><guid>1</guid></item></rss>`;
    expect(parsePciRSS(xml)[0].title.length).toBe(500);
  });
});

describe('inferRegion', () => {
  it('palavras de federal → BR', () => {
    expect(inferRegion('Concurso Polícia Federal — 1500 vagas')).toBe('BR');
    expect(inferRegion('TCU — analista')).toBe('BR');
    expect(inferRegion('Receita Federal: 700 vagas')).toBe('BR');
    expect(inferRegion('Ministério da Saúde')).toBe('BR');
    expect(inferRegion('IBGE - 1300 vagas')).toBe('BR');
  });

  it('estado por extenso', () => {
    expect(inferRegion('TJ São Paulo - escrevente')).toBe('SP');
    expect(inferRegion('Polícia Civil de Minas Gerais')).toBe('MG');
    expect(inferRegion('Concurso Distrito Federal')).toBe('DF');
  });

  it('abrev entre delimitadores', () => {
    expect(inferRegion('Câmara — RJ — 50 vagas')).toBe('RJ');
    expect(inferRegion('Prefeitura de Campinas/SP/2026')).toBe('SP');
    expect(inferRegion('Concurso (BA): 100 vagas')).toBe('BA');
  });

  it('sem indicador → null', () => {
    expect(inferRegion('Algum concurso genérico')).toBe(null);
  });

  it('federal tem prioridade sobre estado', () => {
    // "Federal" + "SP" no título: federal vence
    expect(inferRegion('Polícia Federal SP — 100 vagas')).toBe('BR');
  });
});

describe('inferArea', () => {
  it('TI', () => {
    expect(inferArea('Analista de Sistemas — TJ-SP')).toBe('TI');
    expect(inferArea('Tecnologia da Informação — IBGE')).toBe('TI');
    expect(inferArea('Desenvolvedor Python — Petrobras')).toBe('TI');
  });

  it('Direito', () => {
    expect(inferArea('Juiz Federal — TRF1')).toBe('Direito');
    expect(inferArea('Procurador do Estado SP')).toBe('Direito');
    expect(inferArea('Analista Judiciário — STJ')).toBe('Direito');
  });

  it('Saude', () => {
    expect(inferArea('Médico — Hospital de Base')).toBe('Saude');
    expect(inferArea('Enfermeiro — Saúde MG')).toBe('Saude');
  });

  it('Educacao', () => {
    expect(inferArea('Professor de Matemática — Rede Estadual')).toBe(
      'Educacao'
    );
    expect(inferArea('Docente UFRJ')).toBe('Educacao');
  });

  it('Policia', () => {
    expect(inferArea('Agente Penitenciário — RS')).toBe('Policia');
    expect(inferArea('Polícia Civil PR')).toBe('Policia');
  });

  it('Adm', () => {
    expect(inferArea('Assistente Administrativo — Prefeitura X')).toBe('Adm');
  });

  it('sem keyword → null', () => {
    expect(inferArea('Concurso para algo desconhecido')).toBe(null);
  });
});
