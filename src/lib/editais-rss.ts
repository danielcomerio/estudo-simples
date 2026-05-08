/**
 * Parser de RSS de editais (foco PCI Concursos) + inferência de
 * region/area a partir do título.
 *
 * Regex-based: simples, robusto pra mudanças menores no XML, não
 * depende de DOMParser (não disponível em Node sem dep extra).
 *
 * Pure functions — testáveis sem mocks.
 */

export type RawEdital = {
  source: 'pci';
  sourceId: string;
  title: string;
  link: string;
  description: string;
  pubDate: Date | null;
};

const STATE_ABBR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const STATE_NAMES: Array<[string, string]> = [
  ['SÃO PAULO', 'SP'],
  ['SAO PAULO', 'SP'],
  ['RIO DE JANEIRO', 'RJ'],
  ['MINAS GERAIS', 'MG'],
  ['DISTRITO FEDERAL', 'DF'],
  ['RIO GRANDE DO SUL', 'RS'],
  ['RIO GRANDE DO NORTE', 'RN'],
  ['ESPÍRITO SANTO', 'ES'],
  ['MATO GROSSO DO SUL', 'MS'],
  ['MATO GROSSO', 'MT'],
  ['SANTA CATARINA', 'SC'],
  ['BAHIA', 'BA'],
  ['CEARÁ', 'CE'],
  ['PARANÁ', 'PR'],
  ['PERNAMBUCO', 'PE'],
  ['GOIÁS', 'GO'],
  ['MARANHÃO', 'MA'],
  ['PARAÍBA', 'PB'],
  ['ALAGOAS', 'AL'],
  ['SERGIPE', 'SE'],
  ['AMAZONAS', 'AM'],
  ['PARÁ', 'PA'],
  ['PIAUÍ', 'PI'],
  ['ACRE', 'AC'],
  ['AMAPÁ', 'AP'],
  ['RONDÔNIA', 'RO'],
  ['RORAIMA', 'RR'],
  ['TOCANTINS', 'TO'],
];

const FEDERAL_KEYWORDS =
  /\b(FEDERAL|UNI[ÃA]O|BANCO CENTRAL|MINIST[ÉE]RIO|IBGE|IBAMA|ICMBIO|INSS|IFRS|IFSP|IFMG|IFRN|IFSC|RECEITA FEDERAL|POL[ÍI]CIA FEDERAL|POL[ÍI]CIA RODOVI[ÁA]RIA FEDERAL|TRIBUNAL DE CONTAS DA UNI[ÃA]O|TCU|CGU|AGU|ANATEL|ANP|ANEEL|ANVISA|ANS)\b/i;

// Sufixos pra cobrir flexões (-or, -ora, -ores, -oras): \w* devora.
// Mas \w não cobre acentos pt-BR, então uso [\wÀ-ÿ]* pra ser tolerante.
export const AREA_KEYWORDS: Record<string, RegExp> = {
  TI: /\b(T[ÉE]CNIC[OA] DA TECNOLOGIA|ANALISTA DE TI|ANALISTA DE SISTEMAS?|ANALISTA EM TECNOLOGIA|ANALISTA DE INFORM[ÁA]TICA|ENGENHEIRO DE SOFTWARE|DESENVOLVEDOR[A]?[ES]?|PROGRAMADOR[A]?[ES]?|CIENTISTA DE DADOS|TECNOLOGIA DA INFORMA[ÇC][ÃA]O|SEGURAN[ÇC]A DA INFORMA[ÇC][ÃA]O|REDES E TELECOM)\b/i,
  Direito: /\b(JU[ÍI]Z|PROCURADOR[A]?[ES]?|DEFENSOR P[ÚU]BLICO|DELEGAD[OA]|ESCRIV[ÃA]O|ADVOCAC[IÍ][AO]|JUR[ÍI]DIC[OA]|JUDICI[ÁA]RI[OA]|ANALISTA JUDICI[ÁA]RIO|T[ÉE]CNICO JUDICI[ÁA]RIO|TRIBUNAL|MINIST[ÉE]RIO P[ÚU]BLICO|MP\/[A-Z]{2})\b/i,
  Saude: /\b(M[ÉE]DIC[OA]|ENFERMEIR[OA]|FISIOTERAPEUT[AO]|FARMAC[ÊE]UTIC[OA]|NUTRICIONISTA|PSIC[ÓO]LOG[OA]|ODONT[ÓO]LOG[OA]|VIGIL[ÂA]NCIA SANIT[ÁA]RIA|HOSPITAL|SA[ÚU]DE)\b/i,
  Educacao: /\b(PROFESSOR[A]?[ES]?|DOCENTE[S]?|MAGIST[ÉE]RIO|PEDAGOG[IÍA]|UNIVERSID|EDUCA[ÇC][ÃA]O|UFRJ|UFMG|USP|UFRGS|IFRS|IFSP)\b/i,
  Policia: /\b(POL[ÍI]CIA|POLICIAL|GUARDA MUNICIPAL|AGENTE PENITENCI[ÁA]RIO|BOMBEIRO|MILITAR)\b/i,
  Adm: /\b(ASSISTENTE ADMINISTRATIV[OA]|AGENTE ADMINISTRATIV[OA]|AUXILIAR ADMINISTRATIV[OA]|T[ÉE]CNICO ADMINISTRATIV[OA]|ANALISTA ADMINISTRATIV[OA])\b/i,
};

/**
 * Parse RSS XML do PCI. Tolerante a CDATA e variações menores. Retorna
 * itens em ordem de aparição (PCI já entrega mais recentes primeiro).
 */
export function parsePciRSS(xml: string): RawEdital[] {
  const items: RawEdital[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = stripCdata(extractTag(block, 'title') ?? '');
    const link = stripCdata(extractTag(block, 'link') ?? '');
    const description = stripCdata(extractTag(block, 'description') ?? '');
    const guid = stripCdata(extractTag(block, 'guid') ?? '') || link;
    const pubDateStr = extractTag(block, 'pubDate');
    const pubDate = pubDateStr ? safeDate(pubDateStr) : null;
    if (!title || !link) continue;
    items.push({
      source: 'pci',
      sourceId: guid.slice(0, 500),
      title: title.slice(0, 500),
      link: link.slice(0, 1000),
      description: description.slice(0, 5000),
      pubDate,
    });
  }
  return items;
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function stripCdata(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .trim();
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Infere region a partir do título. Heurística (ordem importa —
 * específicos primeiro):
 *  1. Nome de estado por extenso (ex: "Distrito Federal" → DF). Roda
 *     ANTES de FEDERAL_KEYWORDS pra DF não cair em 'BR'.
 *     EXCEÇÃO: se o título ALSO tem indicador federal forte (Polícia
 *     Federal, Receita Federal etc) E o nome do estado é "Distrito
 *     Federal" sozinho, federal vence.
 *  2. Palavras-chave de federal → 'BR'
 *  3. Abrev de estado entre delimitadores → abbr
 *  4. null
 */
export function inferRegion(title: string): string | null {
  const t = title.toUpperCase();

  // Pula DISTRITO FEDERAL na primeira passada se houver outros sinais federais
  // (ex: "Polícia Federal — DF" deve ser BR, não DF).
  const hasOtherFederal =
    FEDERAL_KEYWORDS.test(t.replace(/DISTRITO FEDERAL/g, ''));

  for (const [name, abbr] of STATE_NAMES) {
    if (name === 'DISTRITO FEDERAL' && hasOtherFederal) continue;
    if (t.includes(name)) return abbr;
  }

  if (FEDERAL_KEYWORDS.test(t)) return 'BR';

  // Abrev entre delimitadores: " SP ", "(SP)", "/SP/", "-SP-", " SP-"
  const abbrRe = /[\s\-/(.—–](AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)[\s\-/).—–]/;
  const m = t.match(abbrRe);
  if (m && STATE_ABBR.includes(m[1])) return m[1];

  return null;
}

/**
 * Infere area a partir do título. Primeira regex que matchar ganha
 * (ordem do dict importa — específicos antes de genéricos).
 */
export function inferArea(title: string): string | null {
  for (const [area, re] of Object.entries(AREA_KEYWORDS)) {
    if (re.test(title)) return area;
  }
  return null;
}
