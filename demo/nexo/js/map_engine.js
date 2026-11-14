const MapEngine = {

  dicionarioCoord: {},

  normalizarTexto: function (texto) {
    if (!texto) return "";
    let t = String(texto).toLowerCase().trim();
    t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    t = t.replace(/[^a-z0-9\s]/g, " ");
    t = t.replace(/\bav\b/g, "avenida");
    t = t.replace(/\br\b/g, "rua");
    t = t.replace(/\bqd\b/g, "quadra");
    t = t.replace(/\blt\b/g, "lote");
    t = t.replace(/\bsn\b/g, "sem numero");
    t = t.replace(/\bs\s*n\b/g, "sem numero");
    t = t.replace(/\bvl\b/g, "vila");
    t = t.replace(/\bjd\b/g, "jardim");
    t = t.replace(/\bpq\b/g, "parque");
    return t.replace(/\s+/g, " ").trim();
  },

  escaparXML: function (str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  limparParaCSV: function (str) {
    if (!str) return "";
    return String(str).replace(/;/g, ",").replace(/\n/g, " ").trim();
  },

  carregarCoordenadas: async function () {
    this.dicionarioCoord = {};

    let chaveStorage = "nexo_csv_Coordenadas";
    if (
      typeof ContratosArquivo !== "undefined" &&
      ContratosArquivo.Coordenadas
    ) {
      chaveStorage = ContratosArquivo.Coordenadas.chaveStorage;
    }

    let csvCru =
      typeof StorageManager !== "undefined"
        ? await StorageManager.lerAsync(chaveStorage)
        : null;

    if (!csvCru) {
      console.warn(
        "[Map Engine] Arquivo de Localizações Confirmadas não encontrado no Storage. Apenas GeoBase será usado.",
      );
      return;
    }

    if (typeof FileProcessor === "undefined") {
      console.error(
        "[Map Engine] FileProcessor não carregado. Impossível converter Localizações Confirmadas.",
      );
      return;
    }

    const dadosCoordConvertidos = FileProcessor.csvParaTabela(csvCru);
    let coordenadasValidas = 0;

    dadosCoordConvertidos.forEach((linha) => {
      if (!linha.CNPJ) return;
      const cnpjLimpo = String(linha.CNPJ).replace(/\D/g, "");
      const coord = linha.COORDENADA ? String(linha.COORDENADA).trim() : "";

      if (
        coord !== "" &&
        coord !== "1,1" &&
        coord !== "1" &&
        coord.includes(",")
      ) {
        const partes = coord.split(",");
        const lat = parseFloat(partes[0].trim().replace(",", "."));
        const lon = parseFloat(partes[1].trim().replace(",", "."));

        if (!isNaN(lat) && !isNaN(lon)) {
          this.dicionarioCoord[cnpjLimpo] = { lat: lat, lon: lon };
          coordenadasValidas++;
        }
      }
    });

    console.log(
      `[Map Engine] Localizações Confirmadas carregadas com sucesso! ${coordenadasValidas} coordenadas prontas na memória.`,
    );
  },

  buscarCoordenada: function (empresa) {
    const cnpjLimpo = String(empresa.CNPJ || empresa.cnpj || "").replace(
      /\D/g,
      "",
    );

    if (this.dicionarioCoord[cnpjLimpo]) {
      return {
        lat: this.dicionarioCoord[cnpjLimpo].lat,
        lon: this.dicionarioCoord[cnpjLimpo].lon,
        status: "roxo",
        score: 1.0,
        origem: "🎯 Localizações Confirmadas",
        qualidade: "🟣 Validado Manualmente",
        enderecoGeoBase: "N/A (Coordenada Importada das Localizações Confirmadas)",
      };
    }

    if (
      empresa.LATITUDE &&
      empresa.LONGITUDE &&
      empresa.LATITUDE !== "" &&
      empresa.LONGITUDE !== ""
    ) {
      return {
        lat: parseFloat(String(empresa.LATITUDE).replace(",", ".")),
        lon: parseFloat(String(empresa.LONGITUDE).replace(",", ".")),
        status: "roxo",
        score: 1.0,
        origem: "🎯 Base Principal (Embutido)",
        qualidade: "🟣 Validado Manualmente",
        enderecoGeoBase: "N/A (Coordenada Importada Diretamente)",
      };
    }

    let dicionarioAtivo =
      window.DICIONARIO_GeoBase ||
      (typeof DICIONARIO_GeoBase !== "undefined" ? DICIONARIO_GeoBase : null);

    if (!dicionarioAtivo) return null;

    if (typeof GeoCore === "undefined") {
      console.error(
        "[Map Engine] geo_core.js não carregado nesta página — impossível " +
        "casar endereços do GeoBase (ver <script src=\"js/geo_core.js\"> no HTML).",
      );
      return null;
    }

    const aux = this._prepararAuxGeoBase(dicionarioAtivo);
    return GeoCore.adaptarParaKML(empresa, dicionarioAtivo, aux.mapaMunicipio, {
      blocking: aux.blocking,
      cepIndex: aux.cepIndex,
      cepBairroIndex: aux.cepBairroIndex,
      cache: aux.cache,
      centroides: aux.centroides,
      totalPontosPorMunicipio: aux.totalPontosPorMunicipio,
    });
  },

  _auxGeoBase: null,

  _prepararAuxGeoBase: function (dicionario) {
    if (this._auxGeoBase && this._auxGeoBase._fonte === dicionario) {
      return this._auxGeoBase;
    }

    const blocking = GeoCore.construirBlockingIndex(dicionario);
    const cepIndex = GeoCore.construirIndiceCep(dicionario);
    const cepBairroIndex = GeoCore.construirIndiceCepBairro(dicionario, cepIndex);

    const centroides = {};
    const totalPontosPorMunicipio = {};
    for (const cod in dicionario) {
      const todos = [];
      for (const via in dicionario[cod]) todos.push(...dicionario[cod][via]);
      centroides[cod] = GeoCore.centroide(todos);
      totalPontosPorMunicipio[cod] = todos.length;
    }

    const pares = [];
    if (typeof MUNICIPIOS_BR !== "undefined") {
      const codigosNoDicionario = new Set(Object.keys(dicionario));
      for (const uf in MUNICIPIOS_BR) {
        for (const m of MUNICIPIOS_BR[uf]) {
          if (codigosNoDicionario.has(String(m.codigo))) pares.push([m.nome, m.codigo]);
        }
      }
    } else {
      console.warn(
        "[Map Engine] js/bases/municipios_br.js não carregado — " +
        "não será possível resolver nome de município → código do GeoBase.",
      );
    }

    this._auxGeoBase = {
      _fonte: dicionario,
      mapaMunicipio: GeoCore.construirMapaMunicipio(pares),
      blocking,
      cepIndex,
      cepBairroIndex,
      centroides,
      totalPontosPorMunicipio,
      cache: new Map(),
    };
    return this._auxGeoBase;
  },

  carregarDicionario: async function () {

    if (typeof DICIONARIO_GeoBase !== "undefined" || window.DICIONARIO_GeoBase) {
      return;
    }

    const registro = await this._lerDicionarioIndexedDB();
    if (registro && registro.dicionario) {
      window.DICIONARIO_GeoBase = registro.dicionario;
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "js/bases/dicionario_geobase.js";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Erro ao carregar o dicionário GeoBase."));
      document.body.appendChild(script);
    });
  },

  _DB_NOME: "nexo_map_engine",
  _DB_VERSAO: 1,
  _DB_STORE: "geobase_override",
  _DB_CHAVE: "atual",

  _abrirDB: function () {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB não disponível neste navegador."));
        return;
      }
      const req = indexedDB.open(this._DB_NOME, this._DB_VERSAO);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(this._DB_STORE)) {
          req.result.createObjectStore(this._DB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(req.error || new Error("Erro ao abrir o IndexedDB."));
    });
  },

  _salvarDicionarioIndexedDB: async function (registro) {
    const db = await this._abrirDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this._DB_STORE, "readwrite");
        tx.objectStore(this._DB_STORE).put(registro, this._DB_CHAVE);
        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(tx.error || new Error("Erro ao gravar no IndexedDB."));
      });
    } finally {
      db.close();
    }
  },

  _lerDicionarioIndexedDB: async function () {
    let db;
    try {
      db = await this._abrirDB();
    } catch (_) {
      return null;
    }
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(this._DB_STORE, "readonly");
        const req = tx.objectStore(this._DB_STORE).get(this._DB_CHAVE);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () =>
          reject(req.error || new Error("Erro ao ler do IndexedDB."));
      });
    } catch (_) {
      return null;
    } finally {
      db.close();
    }
  },

  _removerDicionarioIndexedDB: async function () {
    let db;
    try {
      db = await this._abrirDB();
    } catch (_) {
      return;
    }
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this._DB_STORE, "readwrite");
        tx.objectStore(this._DB_STORE).delete(this._DB_CHAVE);
        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(tx.error || new Error("Erro ao remover do IndexedDB."));
      });
    } finally {
      db.close();
    }
  },

  importarDicionario: async function (fileOrBlob, versaoLabel) {
    if (!fileOrBlob) throw new Error("Nenhum arquivo fornecido.");

    let texto;
    try {
      texto =
        typeof fileOrBlob.text === "function"
          ? await fileOrBlob.text()
          : await new Response(fileOrBlob).text();
    } catch (e) {
      throw new Error("Não foi possível ler o arquivo: " + e.message);
    }

    let dicionario;
    try {
      dicionario = JSON.parse(texto);
    } catch (e) {
      throw new Error("Arquivo não é um JSON válido: " + e.message);
    }

    if (
      !dicionario ||
      typeof dicionario !== "object" ||
      Array.isArray(dicionario)
    ) {
      throw new Error(
        "Formato inválido: esperado um objeto { <código do município>: {...} }.",
      );
    }

    const municipios = Object.keys(dicionario).length;
    if (municipios === 0) {
      throw new Error("O dicionário importado está vazio.");
    }

    const versao = versaoLabel || new Date().toISOString();
    const registro = { versao, dicionario, municipios, criadoEm: Date.now() };

    await this._salvarDicionarioIndexedDB(registro);
    window.DICIONARIO_GeoBase = dicionario;

    return { municipios, versao };
  },

  invalidarCache: async function () {
    await this._removerDicionarioIndexedDB();
    delete window.DICIONARIO_GeoBase;
    this._auxGeoBase = null;
  },

  statusDicionario: async function () {
    const registro = await this._lerDicionarioIndexedDB();
    if (registro && registro.dicionario) {
      return {
        fonte: "json",
        versao: registro.versao || null,
        municipios: registro.municipios ?? Object.keys(registro.dicionario).length,
        quando: registro.criadoEm ? new Date(registro.criadoEm) : null,
      };
    }
    return { fonte: "sistema", versao: null, municipios: null, quando: null };
  },

  gerarPDFRelatorio: function (listaDados) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.warn("jsPDF não carregado.");
      return null;
    }

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const MARGIN = 10;
    const PAGE_H = 210;
    const HDR_H = 9;
    const ROW_H = 6.5;

    const COLS = [
      { title: "CNPJ", w: 34 },
      { title: "Razao Social", w: 62 },
      { title: "Mapeamento", w: 22 },
      { title: "Qualidade", w: 32 },
      { title: "Origem", w: 24 },
      { title: "Endereco sistema de origem", w: 72 },
      { title: "End. BASE", w: 27 },
    ];

    const strip = (s) =>
      String(s || "")
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
        .trim();

    const abrevQld = (s) => {
      const r = String(s || "");
      if (r.includes("Muito Bom")) return "Muito Bom";
      if (r.includes("Bom")) return "Bom (Q/F)";
      if (r.includes("Regular")) return "Regular";
      if (r.includes("Ruim")) return "Ruim";
      if (r.includes("ritico")) return "Critico";
      if (r.includes("alidado")) return "Validado (L.C.)";
      if (r.includes("Encontrado") || r.includes("CEP") || r === "")
        return "N/encontrado";
      return strip(r).slice(0, 18);
    };

    const abrevOrigem = (s) => {
      const r = String(s || "");
      if (
        r.includes("Base de Localiza") ||
        r.includes("Base Principal") ||
        r.includes("Localiza")
      )
        return "Loc. Conf.";
      if (r.includes("GeoBase")) return "GeoBase";
      if (r === "N/A" || !r.trim()) return "Nao encontrado";
      return strip(r).slice(0, 15);
    };

    const fmtCNPJ = (c) => {
      const n = String(c || "").replace(/\D/g, "");
      if (n.length !== 14) return c;
      return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
    };

    const trunc = (s, colW) => {
      const lim = Math.floor(colW / 1.55);
      const str = strip(String(s || "-"));
      return str.length > lim ? str.slice(0, lim - 2) + ".." : str;
    };

    let y = MARGIN;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 138);
    doc.text("Auditoria Geografica - NEXO", MARGIN, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Emitido em ${new Date().toLocaleString("pt-BR")}   |   ${listaDados.length} empresa(s)`,
      MARGIN,
      y + 14,
    );
    y += 22;

    const drawTableHeader = () => {
      doc.setFillColor(30, 58, 138);
      let x = MARGIN;
      COLS.forEach((col) => {
        doc.rect(x, y, col.w, HDR_H, "F");
        x += col.w;
      });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      x = MARGIN;
      COLS.forEach((col) => {
        doc.text(col.title, x + 1.5, y + HDR_H / 2 + 2.8);
        x += col.w;
      });
      doc.setTextColor(51, 65, 85);
      y += HDR_H;
    };

    drawTableHeader();

    listaDados.forEach((linha, rowNum) => {
      if (y + ROW_H > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
        drawTableHeader();
      }

      if (rowNum % 2 === 1) {
        doc.setFillColor(241, 245, 249);
        let x = MARGIN;
        COLS.forEach((col) => {
          doc.rect(x, y, col.w, ROW_H, "F");
          x += col.w;
        });
      }

      doc.setDrawColor(220, 228, 240);
      let x = MARGIN;
      COLS.forEach((col) => {
        doc.rect(x, y, col.w, ROW_H);
        x += col.w;
      });

      const mapStr = linha.mapeamento || "";
      const incluido = mapStr.toUpperCase().includes("INCLU");

      const cells = [
        fmtCNPJ(linha.cnpj),
        linha.nome,
        incluido ? "Incluido" : "Descartado",
        abrevQld(linha.status),
        abrevOrigem(linha.origem),
        linha.endDeclarado,
        linha.endBase && linha.endBase !== "N/A" ? linha.endBase : "-",
      ];

      doc.setFontSize(6.5);
      x = MARGIN;
      cells.forEach((val, i) => {
        if (i === 2) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(
            incluido ? 16 : 220,
            incluido ? 185 : 38,
            incluido ? 129 : 38,
          );
        } else {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(51, 65, 85);
        }
        doc.text(trunc(val, COLS[i].w), x + 1.5, y + ROW_H / 2 + 2.2);
        x += COLS[i].w;
      });

      y += ROW_H;
    });

    return doc.output("blob");
  },

  _deslocarCoord: function (lat, lon, distanciaM, anguloGraus) {
    const R = 6371000;
    const anguloRad = (anguloGraus * Math.PI) / 180;
    const dLat = ((distanciaM * Math.cos(anguloRad)) / R) * (180 / Math.PI);
    const dLon =
      ((distanciaM * Math.sin(anguloRad)) /
        (R * Math.cos((lat * Math.PI) / 180))) *
      (180 / Math.PI);
    return { lat: lat + dLat, lon: lon + dLon };
  },

  _marcarColisoes: function (sucessos) {
    const RAIO_OFFSET_M = 10;
    const grupos = new Map();
    sucessos.forEach((item) => {
      const chave = `${item.geo.lat.toFixed(6)},${item.geo.lon.toFixed(6)}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(item);
    });
    for (const grupo of grupos.values()) {
      if (grupo.length < 2) continue;
      grupo.forEach((item, idx) => {
        const anguloGraus = (360 / grupo.length) * idx;
        item.geo._pino = this._deslocarCoord(
          item.geo.lat,
          item.geo.lon,
          RAIO_OFFSET_M,
          anguloGraus,
        );
        item.geo._colisaoCom = grupo
          .filter((outro) => outro !== item)
          .map((outro) => outro.emp.RAZAOSOCIAL || "Empresa Sem Nome");
      });
    }
  },

  gerarKML: async function (empresasSelecionadas, config) {
    if (!empresasSelecionadas || empresasSelecionadas.length === 0) return;

    await this.carregarCoordenadas();
    await this.carregarDicionario();

    const sucessos = [];
    const pendencias = [];

    let csvRelatorio =
      "CNPJ;RAZAO_SOCIAL;ENDERECO_DECLARADO;BAIRRO_DECLARADO;STATUS_MAPEAMENTO;GRAU_QUALIDADE;ORIGEM_COORDENADA\n";
    const listaPdf = [];

    for (let _i = 0; _i < empresasSelecionadas.length; _i++) {
      const emp = empresasSelecionadas[_i];
      if (_i > 0 && _i % 50 === 0) await new Promise((r) => setTimeout(r, 0));

      const geo = this.buscarCoordenada(emp);
      let statusMapa = "Não Mapeado";
      let qld = "Não Encontrado no CEP";
      let origem = "N/A";

      const passaFiltro =
        config.statusPermitidos && config.statusPermitidos.length
          ? geo && config.statusPermitidos.includes(geo.status)
          : geo && geo.score >= (config.scoreMinimo ?? 0);

      if (passaFiltro) {
        sucessos.push({ emp, geo });
        statusMapa = "INCLUÍDO NO MAPA";
        qld = geo.qualidade;
        origem = geo.origem;
      } else {
        pendencias.push(emp);
        if (geo) {
          statusMapa = "DESCARTADO (Filtro)";
          qld = geo.qualidade;
          origem = geo.origem;
        }
      }

      csvRelatorio += `${emp.CNPJ || ""};${this.limparParaCSV(emp.RAZAOSOCIAL)};${this.limparParaCSV(emp.ENDERECO)};${this.limparParaCSV(emp.BAIRRO)};${statusMapa};${qld};${origem}\n`;

      listaPdf.push({
        cnpj: emp.CNPJ || "S/N",
        nome: emp.RAZAOSOCIAL || "Empresa Sem Nome",
        mapeamento: statusMapa,
        status: qld,
        origem: origem,
        endDeclarado: `${emp.ENDERECO || ""} - ${emp.BAIRRO || ""}`,
        endBase: geo ? geo.enderecoGeoBase : "N/A",
      });
    }

    if (sucessos.length === 0 && !config.gerarRelatorio) {
      mostrarToast(
        "Nenhuma empresa atendeu ao critério geográfico.",
        "warning",
      );
      if (pendencias.length > 0) this.gerarCSVPendencias(pendencias);
      return;
    }

    let camposAtivos = 0;
    for (let key in config) {
      if (config[key] === true && key !== "gerarRelatorio") camposAtivos++;
    }

    let LIMITE_MY_MAPS = 800;
    if (camposAtivos > 5) LIMITE_MY_MAPS = 500;
    if (camposAtivos > 10) LIMITE_MY_MAPS = 300;

    const qtdMapeadas = sucessos.length;
    const qtdPartes = Math.ceil(qtdMapeadas / LIMITE_MY_MAPS);
    const dataHoje = new Date().toLocaleDateString("pt-BR");

    const nomeBaseArquivo = `Rotas_NEXO_${qtdMapeadas}_Empresas_${dataHoje.replace(/\//g, "-")}`;

    let _incluirPendencias = false;
    if (pendencias.length > 0) {
      _incluirPendencias = await (typeof _confirmar === "function"
        ? _confirmar(
            `${pendencias.length} empresa(s) não foram encontradas na base geográfica e não serão incluídas no mapa.\n\nDeseja gerar um arquivo CSV exclusivamente com essas empresas para revisão posterior?`,
            "Empresas não mapeadas",
            "question",
            "Sim, incluir no resultado",
            "Nao, ignorar",
          )
        : Promise.resolve(false));
    }

    const zip = new JSZip();
    let precisaZip =
      qtdPartes > 1 || config.gerarRelatorio || _incluirPendencias;

    if (_incluirPendencias) {
      let csvPend = "CNPJ;RAZAO_SOCIAL;CEP;BAIRRO;ENDERECO\n";
      pendencias.forEach((emp) => {
        csvPend += `${emp.CNPJ || ""};${this.limparParaCSV(emp.RAZAOSOCIAL)};${emp.CEP || ""};${this.limparParaCSV(emp.BAIRRO)};${this.limparParaCSV(emp.ENDERECO)}\n`;
      });
      zip.file(
        `Pendencias_Geograficas_${dataHoje.replace(/\//g, "-")}.csv`,
        "﻿" + csvPend,
      );
    }

    if (config.gerarRelatorio) {
      zip.file(
        `Auditoria_Geografica_${dataHoje.replace(/\//g, "-")}.csv`,
        "\uFEFF" + csvRelatorio,
      );
      const blobPdf = this.gerarPDFRelatorio(listaPdf);
      if (blobPdf)
        zip.file(
          `Auditoria_Geografica_${dataHoje.replace(/\//g, "-")}.pdf`,
          blobPdf,
        );
    }

    const kmlStyles = `
    <Style id="marcador_roxo">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/purple-dot.png</href></Icon></IconStyle>
    </Style>
    <Style id="marcador_verde">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/green-dot.png</href></Icon></IconStyle>
    </Style>
    <Style id="marcador_azul">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png</href></Icon></IconStyle>
    </Style>
    <Style id="marcador_amarelo">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/yellow-dot.png</href></Icon></IconStyle>
    </Style>
    <Style id="marcador_laranja">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/orange-dot.png</href></Icon></IconStyle>
    </Style>
    <Style id="marcador_vermelho">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/red-dot.png</href></Icon></IconStyle>
    </Style>`;

    const ORDEM_STATUS = { verde: 0, azul: 1, amarelo: 2, laranja: 3, vermelho: 4, roxo: 5 };
    sucessos.sort((a, b) => (ORDEM_STATUS[a.geo.status] ?? 3) - (ORDEM_STATUS[b.geo.status] ?? 3));

    this._marcarColisoes(sucessos);

    for (let i = 0; i < qtdPartes; i++) {
      let placemarksString = "";
      const lote = sucessos.slice(i * LIMITE_MY_MAPS, (i + 1) * LIMITE_MY_MAPS);

      lote.forEach((item) => {
        const emp = item.emp;
        const geo = item.geo;
        const nomeSeguro = this.escaparXML(
          emp.RAZAOSOCIAL || "Empresa Sem Nome",
        );

        let blocosHTML = `
                    <h3 style="margin-top:0; color:#005A9C;">${nomeSeguro}</h3>
                    <p><b>Endereço (sistema de origem):</b> ${this.escaparXML(emp.ENDERECO || "")} - ${this.escaparXML(emp.BAIRRO || "")}, ${this.escaparXML(emp.MUNICIPIO || "")}</p>
                    <p><b>CEP:</b> ${this.escaparXML(emp.CEP || "")}</p>`;

        let perfil = "";

        if (config.nomeFantasia && emp.NOMEFANTASIA)
          perfil += `<br><b>Fantasia:</b> ${this.escaparXML(emp.NOMEFANTASIA)}`;
        if (config.categoria && emp.CATEGORIA)
          perfil += `<br><b>Categoria:</b> ${this.escaparXML(emp.CATEGORIA)}`;
        if (config.empresaNova && String(emp.CLIENTENOVO).toUpperCase() === "S")
          perfil += `<br><b>Novata:</b> Sim`;
        if (config.vip && String(emp.PRIORITARIA).toUpperCase().startsWith("S"))
          perfil += `<br><b>Prioritária:</b> Sim`;
        if (config.cnae && emp.CNAE)
          perfil += `<br><b>CNAE:</b> ${this.escaparXML(emp.CNAE)}`;

        if (perfil)
          blocosHTML += `<hr><h4 style="margin:5px 0;">Perfil</h4><p style="margin:0;">${perfil.substring(4)}</p>`;

        let contato = "";
        if (config.contato && emp.CONTATONOME)
          contato += `<br><b>Contato:</b> ${this.escaparXML(emp.CONTATONOME)}`;
        if (config.telefone)
          contato += `<br><b>Tel:</b> ${this.escaparXML(emp.CONTATOTELEFONE || "-")} | <b>Email:</b> ${this.escaparXML(emp.CONTATOEMAIL || "-")}`;
        if (config.representante)
          contato += `<br><b>Representante:</b> ${this.escaparXML(emp.REPRESENTANTENOME || "-")} (Doc: ${this.escaparXML(emp.REPRESENTANTEDOCUMENTO || "-")})`;

        if (contato)
          blocosHTML += `<hr><h4 style="margin:5px 0;">Contatos</h4><p style="margin:0;">${contato.substring(4)}</p>`;

        let operacao = "";
        if (config.status && emp.SITUACAO)
          operacao += `<br><b>Status:</b> ${this.escaparXML(emp.SITUACAO)}`;
        if (config.oc && emp.OC)
          operacao += `<br><b>OC:</b> ${this.escaparXML(emp.OC)} (${this.escaparXML(emp.OCSTATUS || "")})`;
        if (config.analistas)
          operacao += `<br><b>Contato:</b> ${this.escaparXML(emp.ANALISTACONTATO || "-")}<br><b>Resposta:</b> ${this.escaparXML(emp.ANALISTARESPONSAVEL || "-")}`;

        if (operacao)
          blocosHTML += `<hr><h4 style="margin:5px 0;">Operacional</h4><p style="margin:0;">${operacao.substring(4)}</p>`;

        if (geo._colisaoCom && geo._colisaoCom.length) {
          const nomesColisao = geo._colisaoCom
            .slice(0, 5)
            .map((n) => this.escaparXML(n))
            .join(", ");
          const sobra =
            geo._colisaoCom.length > 5
              ? ` e mais ${geo._colisaoCom.length - 5}`
              : "";
          blocosHTML += `
                    <p style="background:#fff3cd; border:1px solid #ffeeba; border-radius:4px; padding:6px 8px; margin:8px 0; font-size:0.85em;">
                      ⚠️ <b>${geo._colisaoCom.length} outra(s) empresa(s)</b> nesta mesma coordenada: ${nomesColisao}${sobra}
                    </p>`;
        }

        blocosHTML += `
                    <hr>
                    <p style="margin-bottom:0;"><b>Origem Coordenada:</b> ${geo.origem}</p>
                    <p style="margin-top:2px;"><b>Qualidade:</b> ${geo.qualidade}</p>
                    <p style="font-size:0.85em; color:#555;"><i>Indexado: ${this.escaparXML(geo.enderecoGeoBase)}</i></p>
                    <p style="margin-top:6px;"><a href="https://www.google.com/maps?q=${geo.lat},${geo.lon}" target="_blank" style="color:#1a73e8; text-decoration:none;">📍 Abrir esta coordenada no Google Maps</a></p>`;

        const descricaoFinal = `<![CDATA[<div style="font-family: Arial, sans-serif; font-size: 13px;">${blocosHTML}</div>]]>`;

        const pinoLat = geo._pino ? geo._pino.lat : geo.lat;
        const pinoLon = geo._pino ? geo._pino.lon : geo.lon;
        const nomeFinal = geo._colisaoCom && geo._colisaoCom.length
          ? `${nomeSeguro} ⚠️`
          : nomeSeguro;

        placemarksString += `
    <Placemark>
      <name>${nomeFinal}</name>
      <styleUrl>#marcador_${geo.status}</styleUrl>
      <description>${descricaoFinal}</description>
      <Point>
        <coordinates>${pinoLon},${pinoLat},0</coordinates>
      </Point>
    </Placemark>`;
      });

      const sufixo = qtdPartes > 1 ? ` - Parte ${i + 1}` : "";

      const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>🗺️ Rotas NEXO (${lote.length} Empresas)${sufixo} - ${dataHoje}</name>
    <description><![CDATA[Mapa gerado pelo NEXO.<br><b>Empresas nesta camada:</b> ${lote.length}]]></description>
    ${kmlStyles}
    ${placemarksString}
  </Document>
</kml>`;

      const _prefKml = (typeof ConfigManager !== "undefined") ? ConfigManager.prefixoArquivo() : "";
      if (precisaZip) {
        zip.file(
          `${nomeBaseArquivo}${_prefKml}${sufixo.replace(/ /g, "")}.kml`,
          kmlContent,
        );
      } else {
        this.baixarArquivo(
          `${nomeBaseArquivo}${_prefKml}.kml`,
          kmlContent,
          "application/vnd.google-earth.kml+xml",
        );
      }
    }

    if (precisaZip) {
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      const _prefZip = (typeof ConfigManager !== "undefined") ? ConfigManager.prefixoArquivo() : "";
      a.download = `Pacote_Mapeamento${_prefZip}_${dataHoje.replace(/\//g, "-")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    if (config.gerarRelatorio && _incluirPendencias) {
      mostrarToast(
        `ZIP gerado: ${qtdMapeadas} mapeadas + auditoria + ${pendencias.length} pendencias.`,
        "success",
      );
    } else if (config.gerarRelatorio) {
      mostrarToast(
        `ZIP gerado com ${qtdMapeadas} empresa(s) mapeadas e Relatorios de Auditoria.`,
        "success",
      );
    } else if (_incluirPendencias) {
      mostrarToast(
        `ZIP gerado: ${qtdMapeadas} mapeadas + ${pendencias.length} pendencia(s) incluidas.`,
        "success",
      );
    } else if (pendencias.length > 0) {
      mostrarToast(
        `Gerado com ${qtdMapeadas} empresa(s) mapeadas. ${pendencias.length} nao encontradas foram ignoradas.`,
        "warning",
      );
    } else {
      mostrarToast(
        `Sucesso! Todas as ${qtdMapeadas} empresas foram mapeadas.`,
        "success",
      );
    }
  },

  baixarArquivo: function (nomeArquivo, conteudo, tipoMime) {
    const blob = new Blob([conteudo], { type: tipoMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  gerarCSVPendencias: function (pendencias) {
    let csv = "CNPJ;RAZAO_SOCIAL;CEP;BAIRRO;ENDERECO\n";
    pendencias.forEach((emp) => {
      csv += `${emp.CNPJ || ""};${this.limparParaCSV(emp.RAZAOSOCIAL)};${emp.CEP || ""};${this.limparParaCSV(emp.BAIRRO)};${this.limparParaCSV(emp.ENDERECO)}\n`;
    });
    this.baixarArquivo(
      "Pendencias_Geograficas.csv",
      "\uFEFF" + csv,
      "text/csv;charset=utf-8;",
    );
  },
};
