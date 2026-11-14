// Motor de geocodificação do NEXO (versão do demo). A versão mantida e
// documentada deste motor é a biblioteca Candeia:
// https://github.com/LucasRikelmi/candeia

const _UN  = ["", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const _DEZ = {
  10: "dez", 11: "onze", 12: "doze", 13: "treze", 14: "quatorze",
  15: "quinze", 16: "dezesseis", 17: "dezessete", 18: "dezoito", 19: "dezenove",
};
const _TEN = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const _CEN = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

const EXTENSO_PARA_NUM = {};

(function _buildExtMap() {
  function _n(n) {
    if (n === 0) return "zero";
    let parts = [];
    const c = Math.floor(n / 100), r = n % 100;
    if (c > 0) parts.push(c === 1 && r > 0 ? "cento" : _CEN[c]);
    if (r > 0) {
      if (r < 10) parts.push(_UN[r]);
      else if (r < 20) parts.push(_DEZ[r]);
      else {
        const t = Math.floor(r / 10), u = r % 10;
        parts.push(_TEN[t]);
        if (u > 0) parts.push(_UN[u]);
      }
    }
    return parts.join(" e ");
  }
  for (let i = 1; i <= 999; i++) EXTENSO_PARA_NUM[_n(i)] = String(i);
})();

const _EXTENSO_ORDENADO = Object.keys(EXTENSO_PARA_NUM).sort((a, b) => b.length - a.length);
const _STEMS_NUM = new Set();
for (const k of Object.keys(EXTENSO_PARA_NUM))
  for (const tok of k.split(" ")) if (tok !== "e") _STEMS_NUM.add(tok);
const _RE_STEM = new RegExp(
  "\\b(" + [..._STEMS_NUM].sort((a, b) => b.length - a.length).join("|") + ")\\b",
);

const _EXTENSO_REGEXES = _EXTENSO_ORDENADO.map((ext) => [
  new RegExp("\\b" + ext.replace(/\s+/g, "\\s+") + "\\b", "g"),
  EXTENSO_PARA_NUM[ext],
]);

function extensoParaNumeral(texto) {
  if (!_RE_STEM.test(texto)) return texto;
  let t = texto;
  for (const [re, num] of _EXTENSO_REGEXES) {
    t = t.replace(re, num);
  }
  return t.replace(/\s+/g, " ").trim();
}

const TIPOS_VIA = new Set([
  "rua", "avenida", "alameda", "travessa", "praca", "rodovia", "via",
  "estrada", "area", "viela", "conjunto", "modulo", "setor",
  "primeira", "segunda", "terceira", "quarta", "quinta",

  "favela", "comunidade", "nucleo", "gleba", "loteamento", "residencial",
  "sitio", "chacara", "fazenda", "assentamento",
]);

const TIPOS_RODOVIA = new Set(["br", "go", "mg"]);

const RE_PREFIXO_RODOVIA = /\b(br|go|mg)[\s-]*(\d{2,3})\b/g;
function normalizarPrefixoRodovia(texto) {
  return texto.replace(RE_PREFIXO_RODOVIA, "$1 $2");
}

const RUIDO_COMPLEMENTO = new Set([
  "sl", "sala", "salas", "casa", "cs", "galpao", "gp", "mod", "modulo",
  "andar", "bloco", "bl", "ap", "apto", "apartamento", "esq", "esquina",
  "com", "ex", "primario", "fundos", "frente", "portao", "sobrado", "sobreloja",
]);

const RE_COMPL_GLUED = /^(?:sl|cs|sala|casa|gp|galpao|mod|bl|ap|apto|loja|lj|suite)\d*$/;

const ABREV = [
  [/\bav\b/g,  "avenida"],
  [/\brod\b/g, "rodovia"],
  [/\btv\b/g,  "travessa"],
  [/\bvl\b/g,  "vila"],
  [/\bjd\b/g,  "jardim"],
  [/\bpq\b/g,  "parque"],
  [/\bpca\b/g, "praca"],
];

const _RE_COM_CRUZAMENTO = new RegExp(
  `^(.*?)\\s+com\\s+((?:${[...TIPOS_VIA, ...TIPOS_RODOVIA].join("|")})\\b.*)$`,
);

function normalizeBase(texto) {
  if (!texto) return "";
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normNum(raw) {
  if (raw == null) return null;
  const m = String(raw).toLowerCase().match(/^0*([0-9]+[a-z]?)/);
  return m ? m[1] : null;
}

const _RE_QUADRA_EXT   = /\b(?:quadra\s*|qd\s*|q\s+)0*([0-9]+[a-z]?)\b/g;
const _RE_LOTE_EXT     = /\b(?:lote\s*|lt\s*|l\s+)0*([0-9]+[a-z]?(?:-[0-9]+)?)\b/g;
const _RE_QUADRA_CLEAN = /\b(?:quadra\s*|qd\s*|q\s+)0*[0-9]+[a-z]?\b/g;
const _RE_LOTE_CLEAN   = /\b(?:lote\s*|lt\s*|l\s+)0*[0-9]+[a-z]?(?:-[0-9]+)?\b/g;

const _RE_KM_CLEAN = /\bkm\.?[\s-]*[0-9]+(?:[.,\s][0-9]+)?\b/gi;

function _extrairViaDeBloco(bloco) {
  let b = bloco
    .replace(_RE_QUADRA_CLEAN, " ")
    .replace(_RE_LOTE_CLEAN, " ")
    .replace(_RE_KM_CLEAN, " ")
    .replace(/\bs\s*\/?\s*n\b/g, " ")
    .replace(/\bsem numero\b/g, " ");
  _RE_QUADRA_CLEAN.lastIndex = 0;
  _RE_LOTE_CLEAN.lastIndex  = 0;
  _RE_KM_CLEAN.lastIndex    = 0;
  let tokens = b.split(/\s+/).filter(Boolean);
  tokens = tokens.filter((tok, i) => tok !== tokens[i - 1]);
  let tipo = null;
  if (tokens.length && (TIPOS_VIA.has(tokens[0]) || TIPOS_RODOVIA.has(tokens[0]))) {
    tipo = tokens[0];
    tokens = tokens.slice(1);
  }
  return { tipo, tokens };
}

function _extrairQLDeBairro(bairroNorm) {
  let quadra = null, lote = null;
  bairroNorm.replace(_RE_QUADRA_EXT, (_, n) => { if (quadra == null) quadra = normNum(n); });
  _RE_QUADRA_EXT.lastIndex = 0;
  bairroNorm.replace(_RE_LOTE_EXT, (_, n) => { if (lote == null) lote = normNum(n); });
  _RE_LOTE_EXT.lastIndex = 0;
  return { quadra, lote };
}

function extrairEntidades(enderecoCru) {
  const cru = String(enderecoCru || "");

  let numero = null;
  const idxVirg = cru.indexOf(",");
  if (idxVirg >= 0) {
    const pos = cru.slice(idxVirg + 1).trim().split(/[\s,]+/)[0] || "";
    if (/^\d{1,5}$/.test(pos)) numero = pos.replace(/^0+/, "") || "0";
  }

  let km = null;
  const mKm = cru.match(/\bkm\.?[\s-]*(\d+(?:[.,]\d+)?)/i);
  if (mKm) km = mKm[1].replace(",", ".");

  let base = normalizeBase(idxVirg >= 0 ? cru.slice(0, idxVirg) : cru);
  for (const [re, rep] of ABREV) base = base.replace(re, rep);
  base = normalizarPrefixoRodovia(base);

  const partesCruzamento = base.split(/\s+(?:c\/\s*|esq\s+|esquina\s+)/);
  base = partesCruzamento[0];
  let blocoCruzamento = partesCruzamento[1] || null;

  if (!blocoCruzamento) {
    const mCom = base.match(_RE_COM_CRUZAMENTO);
    if (mCom) {
      base = mCom[1];
      blocoCruzamento = mCom[2];
    }
  }

  if (blocoCruzamento) {

    const RUIDO_CRUZAMENTO = new Set(["com", "c/", "c", "esq", "esquina"]);
    let tokensCruz = blocoCruzamento.split(/\s+/).filter(Boolean);
    while (tokensCruz.length > 1 && RUIDO_CRUZAMENTO.has(tokensCruz[0])) {
      tokensCruz = tokensCruz.slice(1);
    }
    blocoCruzamento = tokensCruz.join(" ");
  }

  let full = normalizeBase(cru);
  for (const [re, rep] of ABREV) full = full.replace(re, rep);
  full = normalizarPrefixoRodovia(full);

  let quadra = null;
  full.replace(_RE_QUADRA_EXT, (_, n) => { if (quadra == null) quadra = normNum(n); });
  _RE_QUADRA_EXT.lastIndex = 0;
  let lote = null;
  full.replace(_RE_LOTE_EXT, (_, n) => { if (lote == null) lote = normNum(n); });
  _RE_LOTE_EXT.lastIndex = 0;

  if (numero == null) {
    const mN = full.match(/\bn[°o.]?\s*(\d{1,5})\b/);
    if (mN) numero = mN[1].replace(/^0+/, "") || "0";
  }

  if (numero == null && km != null) {
    const kmInt = Math.round(parseFloat(km));
    if (!isNaN(kmInt)) numero = String(kmInt);
  }

  let { tipo, tokens } = _extrairViaDeBloco(base);

  if (!tokens.length && idxVirg >= 0) {
    let altBase = normalizeBase(cru.slice(idxVirg + 1));
    for (const [re, rep] of ABREV) altBase = altBase.replace(re, rep);
    altBase = normalizarPrefixoRodovia(altBase);
    const alt = _extrairViaDeBloco(altBase);
    if (alt.tokens.length) { tipo = alt.tipo; tokens = alt.tokens; }
  }

  const via0 = tokens
    .filter((tok) => !RUIDO_COMPLEMENTO.has(tok) && !RE_COMPL_GLUED.test(tok))
    .join(" ")
    .trim();
  const via = extensoParaNumeral(via0);

  let viaCruzamento = null;
  if (blocoCruzamento) {
    const alt = _extrairViaDeBloco(blocoCruzamento);
    const viaCruzamento0 = alt.tokens
      .filter((tok) => !RUIDO_COMPLEMENTO.has(tok) && !RE_COMPL_GLUED.test(tok))
      .join(" ")
      .trim();
    if (viaCruzamento0) viaCruzamento = extensoParaNumeral(viaCruzamento0);
  }

  return { tipo, via, viaCruzamento, quadra, lote, numero, km };
}

function parseGeoBaseLonLat(raw) {
  const s = String(raw || "").trim().replace(",", ".");
  const pts = s.split(".");
  if (pts.length === 1) return parseFloat(s);
  if (pts.length === 2) return parseFloat(s);
  if (pts.length === 3) return parseFloat(pts[0] + "." + pts[1] + pts[2]);
  return NaN;
}

function extrairCompGeoBase(row) {
  let quadra = null, lote = null;
  for (let i = 1; i <= 5; i++) {
    const nome = String(row[`NOM_COMP_ELEM${i}`] || "").toUpperCase().trim();
    const val  = String(row[`VAL_COMP_ELEM${i}`] || "").trim();
    if (nome === "QUADRA" && quadra == null) quadra = normNum(val);
    if (nome === "LOTE"   && lote   == null) lote   = normNum(val);
  }
  return { quadra, lote };
}

function entradaDeLinhaGeoBase(row) {
  const g = parseInt(row.NV_GEO_COORD, 10);

  if (g >= 5) return null;

  const lat = parseGeoBaseLonLat(row.LATITUDE);
  const lon = parseGeoBaseLonLat(row.LONGITUDE);
  if (isNaN(lat) || isNaN(lon)) return null;

  const viaRaw = normalizeBase(
    [row.NOM_TITULO_SEGLOGR, row.NOM_SEGLOGR].filter(Boolean).join(" "),
  );
  const via = extensoParaNumeral(viaRaw).replace(/\s+/g, " ").trim();
  if (!via) return null;

  const tipo = normalizeBase(row.NOM_TIPO_SEGLOGR || "");

  const numBruto    = String(row.NUM_ENDERECO || "").trim();
  const modificador = String(row.DSC_MODIFICADOR || "").toUpperCase().trim();
  const numero =
    modificador === "SN" || numBruto === "0" || !numBruto ? null : normNum(numBruto);

  const { quadra, lote } = extrairCompGeoBase(row);

  return {
    codMunicipio: String(row.COD_MUNICIPIO || "").trim(),
    via,
    entry: {
      tp: tipo,
      n:  numero,
      q:  quadra,
      l:  lote,
      b:  normalizeBase(row.DSC_LOCALIDADE || ""),
      c:  String(row.CEP || "").replace(/\D/g, ""),
      la: lat,
      lo: lon,
      g,
    },
  };
}

function construirIndiceGeoBase(linhasGeoBase) {
  const idx = {};
  for (const row of linhasGeoBase) {
    const r = entradaDeLinhaGeoBase(row);
    if (!r || !r.via) continue;
    idx[r.codMunicipio] ??= {};
    (idx[r.codMunicipio][r.via] ??= []).push(r.entry);
  }
  return idx;
}

function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1;
  const l1 = s1.length, l2 = s2.length;
  if (!l1 || !l2) return 0;
  const dist = Math.max(0, Math.floor(Math.max(l1, l2) / 2) - 1);
  const m1 = new Array(l1).fill(false), m2 = new Array(l2).fill(false);
  let matches = 0;
  for (let i = 0; i < l1; i++) {
    for (let j = Math.max(0, i - dist); j < Math.min(i + dist + 1, l2); j++) {
      if (!m2[j] && s1[i] === s2[j]) {
        m1[i] = m2[j] = true;
        matches++;
        break;
      }
    }
  }
  if (!matches) return 0;
  let k = 0, t = 0;
  for (let i = 0; i < l1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  const jaro = (matches / l1 + matches / l2 + (matches - t / 2) / matches) / 3;
  let p = 0;
  for (let i = 0; i < Math.min(4, l1, l2); i++) {
    if (s1[i] === s2[i]) p++;
    else break;
  }
  return jaro + p * 0.1 * (1 - jaro);
}

function jaccardTokens(a, b) {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function _terminalNum(s) {
  const m = s && s.match(/(\d+)\s*$/);
  return m ? m[1].replace(/^0+/, "") || "0" : null;
}

function viaSimilarity(a, b) {
  if (!a || !b) return 0;

  const na = _terminalNum(a), nb = _terminalNum(b);
  if (na !== null && nb !== null && na !== nb) return 0;
  return Math.max(jaccardTokens(a, b), jaroWinkler(a, b));
}

const BAIRRO_PREFIXOS = new Set([
  "setor", "vila", "jardim", "parque", "residencial", "distrito",
  "condominio", "loteamento", "chacara", "sitio", "povoado", "nucleo",
  "conjunto", "fazenda", "recanto", "colonia", "granja", "bairro", "cidade",
  "zona",
]);

function _nucleoBairro(s) {
  let tokens = s.split(" ").filter(Boolean);
  let removidos = 0;
  while (tokens.length > 1 && removidos < 2 && BAIRRO_PREFIXOS.has(tokens[0])) {
    tokens = tokens.slice(1);
    removidos++;
  }
  return tokens.join(" ");
}

const _ROMANO_PARA_NUM = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5",
  vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
};
function _normalizarNumeralFinalBairro(s) {
  const tokens = s.split(" ");
  const ultimo = tokens[tokens.length - 1];
  if (_ROMANO_PARA_NUM[ultimo]) tokens[tokens.length - 1] = _ROMANO_PARA_NUM[ultimo];
  return tokens.join(" ");
}

function bairroSimilarity(a, b) {
  if (!a || !b) return 0;
  const an = _normalizarNumeralFinalBairro(a);
  const bn = _normalizarNumeralFinalBairro(b);
  if (an === bn) return 1;
  const nucA = _nucleoBairro(an), nucB = _nucleoBairro(bn);
  if (!nucA || !nucB) return jaroWinkler(an, bn);
  if (nucA === nucB) return 1;

  const curto = nucA.length <= nucB.length ? nucA : nucB;
  const longo = nucA.length <= nucB.length ? nucB : nucA;
  if (curto.length >= 6 && longo.startsWith(curto)) return 0.9;
  return Math.max(jaroWinkler(nucA, nucB), jaccardTokens(nucA, nucB));
}

function construirBlockingIndex(indiceMunicipios) {
  const bl = {};
  for (const cod in indiceMunicipios) {
    const m = {};
    for (const via in indiceMunicipios[cod]) {
      for (const tok of via.split(" ")) {
        if (tok && !TIPOS_VIA.has(tok) && !TIPOS_RODOVIA.has(tok)) (m[tok] ??= []).push(via);
      }
    }
    bl[cod] = m;
  }
  return bl;
}

function construirIndiceCep(indiceMunicipios) {
  const idx = {};
  for (const cod in indiceMunicipios) {
    const porCep = {};
    for (const via in indiceMunicipios[cod]) {
      for (const entry of indiceMunicipios[cod][via]) {
        if (entry.c) (porCep[entry.c] ??= []).push(entry);
      }
    }
    idx[cod] = porCep;
  }
  return idx;
}

function construirIndiceCepBairro(indiceMunicipios, cepIndexPronto) {
  const cepIdx = cepIndexPronto || construirIndiceCep(indiceMunicipios);
  const idx = {};
  for (const cod in cepIdx) {
    const porCep = {};
    for (const cep in cepIdx[cod]) {
      const contagem = {};
      for (const entry of cepIdx[cod][cep]) {
        if (entry.b) contagem[entry.b] = (contagem[entry.b] || 0) + 1;
      }
      let melhor = null, melhorN = 0;
      for (const b in contagem) {
        if (contagem[b] > melhorN) { melhor = b; melhorN = contagem[b]; }
      }
      if (melhor) porCep[cep] = melhor;
    }
    idx[cod] = porCep;
  }
  return idx;
}

const GATE_EXATO = 0.92;
const GATE_FORTE = 0.85;
const GATE_FUZZY = 0.7;
const LOTE_ADJ   = 2;

const G_COLOR_CAP    = { 3: "azul", 4: "amarelo" };
const _COLOR_ORDER   = ["verde", "azul", "amarelo", "laranja", "vermelho"];

function centroide(lista) {
  let la = 0, lo = 0, w = 0;
  for (const e of lista) {
    const peso = e.k || 1;
    const a = e.la ?? e.lat, b = e.lo ?? e.lon;
    if (typeof a === "number" && typeof b === "number") {
      la += a * peso; lo += b * peso; w += peso;
    }
  }
  return w ? { lat: la / w, lon: lo / w } : null;
}

function _haversine(la1, lo1, la2, lo2) {
  const R  = 6371000;
  const φ1 = (la1 * Math.PI) / 180, φ2 = (la2 * Math.PI) / 180;
  const Δφ = ((la2 - la1) * Math.PI) / 180;
  const Δλ = ((lo2 - lo1) * Math.PI) / 180;
  const a  =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const OUTLIER_M = 1500;
const OUTLIER_M_RODOVIA = 50000;
function outlierParaVia(ehRodovia) {
  return ehRodovia ? OUTLIER_M_RODOVIA : OUTLIER_M;
}

function geomedoid(candidatos, bairroNorm, quadra, ehRodovia, numeroAlvo) {

  let pool = candidatos.filter((c) => {
    const la = c.la ?? c.lat, lo = c.lo ?? c.lon;
    return typeof la === "number" && typeof lo === "number";
  });

  if (bairroNorm) {
    const fb = pool.filter((c) => c.b && bairroSimilarity(c.b, bairroNorm) >= 0.85);
    if (fb.length >= 1) pool = fb;
  }

  if (ehRodovia && numeroAlvo != null) {
    const alvoNum = parseInt(numeroAlvo, 10);
    if (!isNaN(alvoNum)) {
      const comN = pool
        .map((c) => ({ c, n: parseInt(c.n, 10) }))
        .filter((x) => !isNaN(x.n));
      if (comN.length) {
        comN.sort((a, b) => Math.abs(a.n - alvoNum) - Math.abs(b.n - alvoNum));
        const menorDist = Math.abs(comN[0].n - alvoNum);
        const tolerancia = Math.max(menorDist * 1.5, 5);
        const perto = comN.filter((x) => Math.abs(x.n - alvoNum) <= tolerancia);
        pool = (perto.length ? perto : comN).map((x) => x.c);
      }
    }
  }

  if (quadra != null) {
    const fq = pool.filter((c) => c.q === quadra);
    if (fq.length >= 1) pool = fq;
  }
  if (!pool.length) return null;
  if (pool.length === 1)
    return { lat: pool[0].la ?? pool[0].lat, lon: pool[0].lo ?? pool[0].lon };

  const sortLat = pool.map((c) => c.la ?? c.lat).slice().sort((a, b) => a - b);
  const sortLon = pool.map((c) => c.lo ?? c.lon).slice().sort((a, b) => a - b);
  const medLat  = sortLat[Math.floor(sortLat.length / 2)];
  const medLon  = sortLon[Math.floor(sortLon.length / 2)];
  const raioOutlier = outlierParaVia(ehRodovia);
  const semOut  = pool.filter(
    (c) => _haversine(c.la ?? c.lat, c.lo ?? c.lon, medLat, medLon) <= raioOutlier,
  );
  const cluster = semOut.length >= 2 ? semOut : pool;

  let la = 0, lo = 0, w = 0;
  for (const c of cluster) {
    const peso = c.k || 1;
    la += (c.la ?? c.lat) * peso;
    lo += (c.lo ?? c.lon) * peso;
    w += peso;
  }
  const cLat = la / w, cLon = lo / w;

  let best = null, bestDist = Infinity;
  for (const c of cluster) {
    const d = _haversine(c.la ?? c.lat, c.lo ?? c.lon, cLat, cLon);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best ? { lat: best.la ?? best.lat, lon: best.lo ?? best.lon } : null;
}

function _resolverVia(viaAlvo, ruas, codMunicipio, opts) {
  if (!viaAlvo) return { viaKey: null, viaScore: 0 };
  if (ruas[viaAlvo]) return { viaKey: viaAlvo, viaScore: 1 };

  const cache = opts.cache || null;
  const ck    = String(codMunicipio) + "|" + viaAlvo;
  if (cache && cache.has(ck)) return cache.get(ck);

  let viaKey = null, viaScore = 0;

  let candidatas = null;
  const bl = opts.blocking ? opts.blocking[String(codMunicipio)] : null;
  if (bl) {
    const set = new Set();
    for (const tok of viaAlvo.split(" ")) {

      if (!TIPOS_VIA.has(tok) && !TIPOS_RODOVIA.has(tok)) {
        const lst = bl[tok];
        if (lst) for (const v of lst) set.add(v);
      }
    }
    if (set.size) candidatas = [...set];
  }

  if (candidatas) {
    for (const key of candidatas) {
      const s = viaSimilarity(viaAlvo, key);
      if (s > viaScore) { viaScore = s; viaKey = key; }
    }
  }

  if (viaScore < GATE_FORTE) {
    for (const key in ruas) {
      const s = viaSimilarity(viaAlvo, key);
      if (s > viaScore) { viaScore = s; viaKey = key; }
    }
  }
  const resultado = { viaKey, viaScore };
  if (cache) cache.set(ck, resultado);
  return resultado;
}

function geocodificar(consulta, indiceMunicipios, opts = {}) {
  const { codMunicipio, enderecoCru, bairro, cepConsulta } = consulta;
  const centMun = opts.centroideMunicipio || null;

  const falha = (status, motivo) => ({
    status, viaScore: 0, via: null, viaKey: null,
    quadra: null, lote: null, numero: null, km: null, ehRodovia: false,
    coord: centMun, motivo, bairroMatch: false, cepMatch: false,
    candidatosNaRua: 0, _q: null,
  });

  const ruas = codMunicipio ? indiceMunicipios[String(codMunicipio)] : null;
  if (!ruas) return falha("vermelho", "Município não indexado");

  const q = extrairEntidades(enderecoCru);
  if (!q.via) return falha("vermelho", "Via não extraída da consulta");

  const primeiroTokenVia = q.via ? q.via.split(" ")[0] : null;
  const ehRodovia =
    TIPOS_RODOVIA.has(q.tipo) || q.tipo === "rodovia" || TIPOS_RODOVIA.has(primeiroTokenVia);

  let bairroNorm = normalizeBase(bairro || "");
  for (const [re, rep] of ABREV) bairroNorm = bairroNorm.replace(re, rep);
  const cepNorm  = String(cepConsulta || "").replace(/\D/g, "");

  let bairroReaproveitadoQL = false;
  if (bairroNorm) {
    _RE_QUADRA_EXT.lastIndex = 0;
    _RE_LOTE_EXT.lastIndex = 0;
    const pareceQL = _RE_QUADRA_EXT.test(bairroNorm) || _RE_LOTE_EXT.test(bairroNorm);
    _RE_QUADRA_EXT.lastIndex = 0;
    _RE_LOTE_EXT.lastIndex = 0;
    if (pareceQL) {
      const ql = _extrairQLDeBairro(bairroNorm);
      if (q.quadra == null && ql.quadra != null) { q.quadra = ql.quadra; bairroReaproveitadoQL = true; }
      if (q.lote == null && ql.lote != null) { q.lote = ql.lote; bairroReaproveitadoQL = true; }
      bairroNorm = "";
    }
  }

  let { viaKey, viaScore } = _resolverVia(q.via, ruas, codMunicipio, opts);
  let cruzamentoUsado = false;

  if ((!viaKey || viaScore < GATE_FUZZY) && q.viaCruzamento) {
    const alt = _resolverVia(q.viaCruzamento, ruas, codMunicipio, opts);
    if (alt.viaKey && alt.viaScore >= GATE_FUZZY) {
      viaKey = alt.viaKey;
      viaScore = alt.viaScore;
      cruzamentoUsado = true;
    }
  }

  if (!viaKey || viaScore < GATE_FUZZY) {
    if (cepNorm) {
      const porCep = [];
      const idxCep = opts.cepIndex ? opts.cepIndex[String(codMunicipio)] : null;
      if (idxCep && idxCep[cepNorm]) {
        porCep.push(...idxCep[cepNorm]);
      } else if (!opts.cepIndex) {

        for (const via in ruas) {
          for (const c of ruas[via]) if (c.c === cepNorm) porCep.push(c);
        }
      }
      if (porCep.length) {
        const coordCep = geomedoid(porCep, bairroNorm, q.quadra, false, null);
        if (coordCep) {
          return {
            status: "laranja",
            motivo: `Via não encontrada; ${porCep.length} ponto(s) do mesmo CEP (${cepNorm}) usado(s) como proxy`,
            viaScore: 0, viaKey: null,
            via: q.via, quadra: q.quadra, lote: q.lote, numero: q.numero, km: q.km,
            ehRodovia: false,
            coord: coordCep, bairroMatch: false, cepMatch: true,
            bairroIndexado: "", candidatosNaRua: porCep.length, _q: q,
          };
        }
      }
    }
    return falha("vermelho", `Via sem correspondência (max=${viaScore.toFixed(2)})`);
  }

  const candidatos = ruas[viaKey];

  let poolDesempate = candidatos;
  let bairroInferidoPorCep = null;
  if (bairroNorm) {
    const temSinalNumerico = candidatos.some(
      (c) =>
        (q.quadra != null && c.q != null && q.quadra === c.q) ||
        (q.lote != null && c.l != null && q.lote === c.l) ||
        (q.numero != null && c.n != null && q.numero === c.n),
    );
    if (!temSinalNumerico) {
      const porBairro = candidatos.filter(
        (c) => c.b && bairroSimilarity(c.b, bairroNorm) >= 0.85,
      );
      if (porBairro.length) {
        poolDesempate = porBairro;
      } else if (cepNorm && opts.cepBairroIndex) {

        const idxCB = opts.cepBairroIndex[String(codMunicipio)];
        const inferido = idxCB ? idxCB[cepNorm] : null;
        if (inferido) {
          const porCep = candidatos.filter((c) => c.b === inferido);
          if (porCep.length) { poolDesempate = porCep; bairroInferidoPorCep = inferido; }
        }
      }
    }
  }

  let melhor = null, melhorPeso = -1;
  for (const c of poolDesempate) {
    const qMatch = q.quadra != null && c.q != null && q.quadra === c.q;
    const lMatch = q.lote   != null && c.l != null && q.lote   === c.l;
    const nMatch = q.numero != null && c.n != null && q.numero === c.n;
    const bMatch = !!(bairroNorm && c.b && bairroSimilarity(c.b, bairroNorm) >= 0.85);
    const cMatch = !!(cepNorm    && c.c && cepNorm    === c.c);
    let lAdj = false;
    if (!lMatch && q.lote != null && c.l != null) {
      const a = parseInt(q.lote, 10), b = parseInt(c.l, 10);
      if (!isNaN(a) && !isNaN(b)) lAdj = Math.abs(a - b) <= LOTE_ADJ;
    }

    const gBonus = c.g ? Math.max(0, (5 - c.g) * 0.05) : 0;
    const peso =
      (qMatch ? 4 : 0) + (lMatch ? 4 : 0) + (nMatch ? 5 : 0) +
      (lAdj   ? 2 : 0) + (bMatch ? 1 : 0) + (cMatch ? 1 : 0) +
      gBonus +
      Math.min((c.k || 1) * 0.01, 0.9);
    if (peso > melhorPeso) {
      melhorPeso = peso;
      melhor = { c, qMatch, lMatch, nMatch, bMatch, cMatch, lAdj };
    }
  }

  const exata = viaScore >= GATE_EXATO;
  const forte = viaScore >= GATE_FORTE;
  const m = melhor;
  let status, motivo;

  if (exata && ((m.qMatch && m.lMatch) || m.nMatch)) {
    status = "verde";
    motivo = m.nMatch ? "Via + número exato" : "Via + quadra + lote";
  } else if (exata && m.qMatch) {
    status = "azul";
    motivo = m.lMatch  ? "Via + quadra + lote parcial"
           : m.lAdj   ? "Via + quadra; lote adjacente"
           : m.cMatch ? "Via + quadra + CEP confirmado"
           :             "Via + quadra";
  } else if (forte) {
    status = "amarelo";
    motivo = "Via confirmada; sem quadra — eixo da rua";
  } else {
    status = "laranja";
    motivo = `Via similar (${viaScore.toFixed(2)}); confiança baixa`;
  }

  const gBest = m.c.g || 1;
  const gCap  = G_COLOR_CAP[gBest];
  if (gCap) {
    const capIdx = _COLOR_ORDER.indexOf(gCap);
    const curIdx = _COLOR_ORDER.indexOf(status);
    if (curIdx < capIdx) {
      status = gCap;
      motivo += ` [coord ${gBest === 3 ? "estimada" : "face de quadra"}: teto ${gCap}]`;
    }
  }

  if (cruzamentoUsado) {
    const capIdx = _COLOR_ORDER.indexOf("laranja");
    if (_COLOR_ORDER.indexOf(status) < capIdx) status = "laranja";
    motivo = `Via "${q.via}" não encontrada; usando o cruzamento "${q.viaCruzamento}" como proxy — ${motivo}`;
  }

  if (bairroReaproveitadoQL) {
    motivo += " [quadra/lote reaproveitados do campo Bairro]";
  }
  if (bairroInferidoPorCep) {
    motivo += ` [bairro declarado não bateu; "${bairroInferidoPorCep}" inferido pelo CEP ${cepNorm}]`;
  }

  let coord;
  if (status === "verde" || status === "azul") {

    coord = { lat: m.c.la ?? m.c.lat, lon: m.c.lo ?? m.c.lon };
  } else {

    coord = geomedoid(candidatos, bairroNorm, q.quadra, ehRodovia, q.numero);
    if (!coord) coord = { lat: m.c.la ?? m.c.lat, lon: m.c.lo ?? m.c.lon };
  }

  const LIMIAR_CEP_GENERICO = 0.1;
  let bairroMatchFinal = m.bMatch;
  let bairroIndexadoFinal = m.c?.b || "";
  let candidatosNaRuaFinal = candidatos.length;
  if ((status === "amarelo" || status === "laranja") && !m.bMatch &&
      cepNorm && bairroNorm && opts.cepIndex && opts.cepBairroIndex && opts.totalPontosPorMunicipio) {
    const pontosCep = ((opts.cepIndex[String(codMunicipio)] || {})[cepNorm]) || [];
    const totalMun  = opts.totalPontosPorMunicipio[String(codMunicipio)] || 0;
    const fracaoCep = totalMun ? pontosCep.length / totalMun : 1;
    if (pontosCep.length && fracaoCep <= LIMIAR_CEP_GENERICO) {
      const bairroGeralPorCep = ((opts.cepBairroIndex[String(codMunicipio)] || {})[cepNorm]) || null;
      if (bairroGeralPorCep && bairroSimilarity(bairroGeralPorCep, bairroNorm) >= GATE_FORTE) {
        const coordCep = geomedoid(pontosCep, bairroNorm, q.quadra, false, null);
        if (coordCep) {
          coord = coordCep;
          status = "laranja";
          bairroMatchFinal = true;
          bairroIndexadoFinal = bairroGeralPorCep;
          candidatosNaRuaFinal = pontosCep.length;
          motivo = `Via "${viaKey}" aceita por score mas bairro não confere; ${pontosCep.length} ponto(s) do CEP ${cepNorm} (bairro "${bairroGeralPorCep}") usado(s) como proxy — ${motivo}`;
        }
      }
    }
  }

  return {
    status, motivo, viaScore, viaKey,
    via: q.via, quadra: q.quadra, lote: q.lote, numero: q.numero, km: q.km,
    ehRodovia,
    coord, bairroMatch: bairroMatchFinal, cepMatch: m.cMatch,
    bairroIndexado: bairroIndexadoFinal,
    candidatosNaRua: candidatosNaRuaFinal, _q: q,
  };
}

const SCORE_MAP = {
  verde: 0.95, azul: 0.87, amarelo: 0.6, laranja: 0.4, vermelho: 0.1,
};
const QUAL_MAP = {
  verde:    "🟢 Exato (via+quadra+lote / número)",
  azul:     "🔵 Bom (via+quadra confirmados)",
  amarelo:  "🟡 Aproximado (eixo da via)",
  laranja:  "🟠 Duvidoso (via similar; baixa confiança)",
  vermelho: "🔴 Não encontrado (centroide do município)",
};

function adaptarParaKML(emp, indiceMunicipios, mapaMunicipio, opts = {}) {
  const nomeMun    = normalizeBase(emp.MUNICIPIO || emp.MUNICIPIO || "");
  const cod        = mapaMunicipio[nomeMun] || null;
  const centroides = opts.centroides || null;
  const r = geocodificar(
    {
      codMunicipio: cod,
      enderecoCru:  emp.ENDERECO || "",
      bairro:       emp.BAIRRO || "",
      cepConsulta:  emp.CEP || "",
    },
    indiceMunicipios,
    {
      blocking: opts.blocking || null,
      cepIndex: opts.cepIndex || null,
      cepBairroIndex: opts.cepBairroIndex || null,
      totalPontosPorMunicipio: opts.totalPontosPorMunicipio || null,
      cache:    opts.cache    || null,
      centroideMunicipio: centroides && cod ? centroides[cod] : null,
    },
  );
  if (!r.coord) return null;
  return {
    lat: r.coord.lat,
    lon: r.coord.lon,
    status:       r.status,
    score:        SCORE_MAP[r.status] ?? 0,
    origem:       "🏛️ GeoBase (índice estruturado V2)",
    qualidade:    QUAL_MAP[r.status] || r.motivo,
    enderecoGeoBase: r.viaKey
      ? `${r.viaKey.toUpperCase()}${r.quadra ? " Q" + r.quadra : ""}${r.lote ? " L" + r.lote : ""}`
      : "N/A",
    _debug: r,
  };
}

function construirMapaMunicipio(pares) {
  const m = {};
  for (const [nome, cod] of pares) m[normalizeBase(nome)] = String(cod).trim();
  return m;
}

const _exports = {
  normalizeBase,
  normNum,
  extrairEntidades,
  extensoParaNumeral,
  entradaDeLinhaGeoBase,
  construirIndiceGeoBase,
  parseGeoBaseLonLat,
  extrairCompGeoBase,
  jaroWinkler,
  jaccardTokens,
  viaSimilarity,
  bairroSimilarity,
  geocodificar,
  adaptarParaKML,
  construirMapaMunicipio,
  construirBlockingIndex,
  construirIndiceCep,
  construirIndiceCepBairro,
  centroide,
  geomedoid,
  _haversine,
  GATE_EXATO,
  GATE_FORTE,
  GATE_FUZZY,
  LOTE_ADJ,
  OUTLIER_M,
  G_COLOR_CAP,
  EXTENSO_PARA_NUM,
  SCORE_MAP,
  QUAL_MAP,
};
if (typeof module !== "undefined") module.exports = _exports;
else if (typeof window !== "undefined") window.GeoCore = _exports;
