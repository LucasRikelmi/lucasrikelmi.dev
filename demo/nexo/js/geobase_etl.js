// ETL no navegador: lê o CSV da base de endereços em streaming e gera o
// dicionário por município usado pelo geo_core.js.

const GeoBaseEtl = {

  async buscarMunicipiosUF(uf) {
    const sigla = String(uf || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(sigla)) {
      throw new Error("UF inválida — configure a UF da unidade na aba Geral antes de continuar.");
    }
    if (typeof MUNICIPIOS_BR === "undefined") {
      throw new Error("Base de municípios (js/bases/municipios_br.js) não carregada.");
    }
    const lista = MUNICIPIOS_BR[sigla];
    if (!lista) throw new Error(`UF "${sigla}" não encontrada na base de municípios.`);
    return lista;
  },

  _COLUNAS: [
    "COD_MUNICIPIO", "LATITUDE", "LONGITUDE",
    "NOM_TITULO_SEGLOGR", "NOM_SEGLOGR", "NOM_TIPO_SEGLOGR",
    "NUM_ENDERECO", "DSC_MODIFICADOR", "DSC_LOCALIDADE", "CEP", "NV_GEO_COORD",
    "NOM_COMP_ELEM1", "VAL_COMP_ELEM1", "NOM_COMP_ELEM2", "VAL_COMP_ELEM2",
    "NOM_COMP_ELEM3", "VAL_COMP_ELEM3", "NOM_COMP_ELEM4", "VAL_COMP_ELEM4",
    "NOM_COMP_ELEM5", "VAL_COMP_ELEM5",
  ],

  _chaveDedup(e) {
    return [e.tp, e.n, e.q, e.l, e.b, e.c, e.la, e.lo].join("|");
  },

  async rodarETL(arquivo, municipiosAlvo, opts = {}) {
    if (typeof GeoCore === "undefined") {
      throw new Error("geo_core.js não carregado — o ETL depende de GeoCore.entradaDeLinhaGeoBase.");
    }
    const sep = opts.sep || ";";
    const encoding = opts.encoding || "iso-8859-1";
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
    const alvo = new Set((municipiosAlvo || []).map((c) => String(c).trim()));
    if (!alvo.size) throw new Error("Nenhum município selecionado.");

    const idx = {};
    let colIdx = null;
    let idxCodMunicipio = -1;
    let lidas = 0;
    let aproveitadas = 0;
    let primeiraLinha = true;
    let sobra = "";

    const processarLinha = (linhaCrua) => {
      const linha = linhaCrua.endsWith("\r") ? linhaCrua.slice(0, -1) : linhaCrua;
      if (!linha) return;

      if (primeiraLinha) {
        primeiraLinha = false;
        const cabecalho = linha.split(sep).map((c) => c.trim());
        colIdx = {};
        cabecalho.forEach((nome, i) => { colIdx[nome] = i; });
        const faltando = this._COLUNAS.filter((nome) => colIdx[nome] == null);
        if (faltando.length) {
          throw new Error(
            `CSV não está no formato esperado do GeoBase — coluna(s) ausente(s): ${faltando.join(", ")}. ` +
            `Verifique o separador (padrão ';') e se o arquivo não foi aberto/salvo em Excel ou LibreOffice Calc (eles truncam o arquivo e podem corromper o cabeçalho).`,
          );
        }
        idxCodMunicipio = colIdx.COD_MUNICIPIO;
        return;
      }

      lidas++;
      const campos = linha.split(sep);
      if (campos[idxCodMunicipio] === undefined) return;
      const cod = campos[idxCodMunicipio].trim();
      if (!alvo.has(cod)) return;

      const row = {};
      for (const nome of this._COLUNAS) {
        const i = colIdx[nome];
        row[nome] = i != null ? campos[i] : "";
      }

      const res = GeoCore.entradaDeLinhaGeoBase(row);
      if (!res || !res.via) return;

      const { codMunicipio, via, entry } = res;
      const bucketMun = (idx[codMunicipio] ??= {});
      const bucketVia = (bucketMun[via] ??= new Map());
      const chave = this._chaveDedup(entry);
      const existente = bucketVia.get(chave);
      if (existente) {
        existente.k += 1;
      } else {
        entry.k = 1;
        bucketVia.set(chave, entry);
      }
      aproveitadas++;
    };

    const stream = arquivo.stream().pipeThrough(new TextDecoderStream(encoding));
    const reader = stream.getReader();
    let ultimoProgresso = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      sobra += value;
      const linhas = sobra.split("\n");
      sobra = linhas.pop();
      for (const linha of linhas) processarLinha(linha);

      if (lidas - ultimoProgresso >= 50000) {
        ultimoProgresso = lidas;
        onProgress({ lidas, aproveitadas, concluido: false });

        await new Promise((r) => setTimeout(r, 0));
      }
    }
    if (sobra) processarLinha(sobra);

    const dicionario = {};
    let totalPontos = 0;
    let totalMunicipios = 0;
    for (const cod in idx) {
      dicionario[cod] = {};
      totalMunicipios++;
      for (const via in idx[cod]) {
        const lista = [...idx[cod][via].values()];
        dicionario[cod][via] = lista;
        totalPontos += lista.length;
      }
    }

    const stats = { lidas, aproveitadas, municipios: totalMunicipios, pontosUnicos: totalPontos, concluido: true };
    onProgress(stats);
    return { dicionario, stats };
  },
};

if (typeof window !== "undefined") window.GeoBaseEtl = GeoBaseEtl;
