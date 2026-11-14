const MotorRegras = {

  equipeAtiva: (typeof ConfigEquipe !== "undefined" ? ConfigEquipe.carregar().filter((t) => t.visivel !== false).map((t) => t.nome) : [])
    .sort((a, b) => a.localeCompare(b, "pt-BR")),

  equipeOculta: (typeof ConfigEquipe !== "undefined" ? ConfigEquipe.carregar().filter((t) => t.visivel === false).map((t) => t.nome) : []),

  rotulosEquipe: function (lista) {
    const primeiroNome = {};
    lista.forEach((nome) => {
      const p = String(nome || "").trim().split(/\s+/)[0] || nome;
      primeiroNome[p] = (primeiroNome[p] || 0) + 1;
    });
    return lista.map((nome) => {
      const partes = String(nome || "").trim().split(/\s+/);
      const p = partes[0] || nome;
      return primeiroNome[p] > 1 && partes[1] ? `${p} ${partes[1]}` : p;
    });
  },

  equipeComDados: function (dados) {
    const lista = [...this.equipeAtiva];
    if (
      dados &&
      dados.empresas &&
      dados.empresas["SEM ANALISTA"] &&
      dados.empresas["SEM ANALISTA"].total > 0
    ) {
      lista.push("SEM ANALISTA");
    }
    return lista;
  },

  limparAcentos: function (texto) {
    if (!texto) return "";
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  },

  normalizarDataParaChave: function (rawDate) {
    if (!rawDate || !rawDate.includes("/")) return null;
    const semHora = rawDate.split(" ")[0];
    return semHora.substring(0, 5);
  },

  csvParaTabela: function (csvCru) {
    return FileProcessor.csvParaTabela(csvCru);
  },

  _converterDataBR: function (dataStr) {
    if (!dataStr || dataStr.trim() === "" || dataStr === "-") return null;
    const partes = dataStr.split("/");
    if (partes.length !== 3) return null;
    return new Date(partes[2], partes[1] - 1, partes[0]);
  },

  _formatarDataBR: function (dataObj) {
    const dia = String(dataObj.getDate()).padStart(2, "0");
    const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
    const ano = dataObj.getFullYear();
    return `${dia}/${mes}/${ano}`;
  },

  _aplicarDataAcordoReal: function (baseEmpresas, relatorioEmails) {
    if (!relatorioEmails || relatorioEmails.length === 0) return baseEmpresas;

    const dicionarioEmails = {};

    relatorioEmails.forEach((linha) => {

      const raizCnpj = String(linha.CNPJRAIZ || "").trim();
      const dataEmailStr = linha.ENVIADOEM;
      const status = String(linha.STATUSEMAIL || "").toUpperCase();

      if (!status.includes("ENVIADO")) return;

      const dataAtual = this._converterDataBR(dataEmailStr);
      if (!dataAtual) return;

      if (!dicionarioEmails[raizCnpj]) {
        dicionarioEmails[raizCnpj] = dataAtual;
      } else {
        if (dataAtual < dicionarioEmails[raizCnpj]) {
          dicionarioEmails[raizCnpj] = dataAtual;
        }
      }
    });

    baseEmpresas.forEach((empresa) => {
      const cnpjLimpo = String(empresa.CNPJ || "").replace(/\D/g, "");
      const raizCnpj = cnpjLimpo.substring(0, 8);

      const dataNoDicionario = dicionarioEmails[raizCnpj];
      const dataProvisoria = empresa.DATAENVIO;
      const comEmail = String(empresa.POSSUIEMAIL || "")
        .trim()
        .toUpperCase();

      if (comEmail === "NÃO" || comEmail === "NAO") {
        empresa.DataAcordoReal = dataProvisoria;
      } else {
        if (dataNoDicionario) {
          empresa.DataAcordoReal = this._formatarDataBR(dataNoDicionario);
        } else {
          empresa.DataAcordoReal = dataProvisoria;
        }
      }

      if (empresa.DataAcordoReal) {
        empresa.DATAENVIO = empresa.DataAcordoReal;
      }
    });

    return baseEmpresas;
  },

  codigoOc: function (oc) {
    return CatalogoOcorrencias.codigo(oc.OC || oc.CODIGOOC || oc.COD || "");
  },

  ocConcluida: function (oc) {
    const kStatus = Object.keys(oc).find((k) => k === "STATUS");
    const s = kStatus ? this.limparAcentos(oc[kStatus]) : "";
    return s.includes("CONCLUIDA") || s.includes("FINALIZADA") || s.includes("OK");
  },

  ocEfetiva: function (oc) {
    const cod = this.codigoOc(oc);
    if (cod === null || !this.ocConcluida(oc)) return false;
    return CatalogoOcorrencias.resolve(cod);
  },

  ocEmTransito: function (oc) {
    const cod = this.codigoOc(oc);
    return cod !== null && CatalogoOcorrencias.emTransito(cod);
  },

  _ocEfetiva: function (oc) {
    return this.ocEfetiva(oc);
  },

  _nomeBateComoPalavra: function (valor, nome) {
    const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("(^|[^A-Z0-9])" + escapado + "($|[^A-Z0-9])");
    return re.test(valor);
  },

  analistaDaOc: function (oc) {
    const chaves = Object.keys(oc);
    const kCriacao = chaves.find((k) => k === "ABERTAPOR");
    if (kCriacao && this.limparAcentos(oc[kCriacao] || "") === "SISTEMA") return null;
    const candidatas = [
      kCriacao,
      chaves.find((k) => k === "ANALISTAOC"),
      chaves.find((k) => k.includes("ANALISTA")),
    ].filter(Boolean);
    for (const k of candidatas) {
      const val = String(oc[k] || "").toUpperCase();
      const t = this.equipeAtiva.find((t) => this._nomeBateComoPalavra(val, t.toUpperCase()));
      if (t) return t;
    }
    return null;
  },

  analistaDaEmpresa: function (emp) {
    const chaves = Object.keys(emp);
    const kResposta = chaves.find((k) => k === "ANALISTARESPONSAVEL");
    const kContato = chaves.find((k) => k === "ANALISTACONTATO");
    const rResposta = kResposta ? String(emp[kResposta] || "") : "";
    const rContato = kContato ? String(emp[kContato] || "") : "";
    const alvo = (rResposta.trim() !== "" ? rResposta : rContato).toUpperCase();
    return this.equipeAtiva.find((t) => this._nomeBateComoPalavra(alvo, t.toUpperCase())) || null;
  },

  empresaDeAnalistaOculto: function (emp) {
    if (!this.equipeOculta.length) return false;
    const chaves = Object.keys(emp);
    const kResposta = chaves.find((k) => k === "ANALISTARESPONSAVEL");
    const kContato = chaves.find((k) => k === "ANALISTACONTATO");
    const rResposta = kResposta ? String(emp[kResposta] || "") : "";
    const rContato = kContato ? String(emp[kContato] || "") : "";
    const alvo = (rResposta.trim() !== "" ? rResposta : rContato).toUpperCase();
    return this.equipeOculta.some((t) => this._nomeBateComoPalavra(alvo, t.toUpperCase()));
  },

  _dataMsDeString: function (raw) {
    const s = String(raw || "").trim();
    if (!s) return -Infinity;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}|\d{2})/);
    if (m) {
      const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      return Date.UTC(ano, +m[2] - 1, +m[1]);
    }
    const t = Date.parse(s);
    return isNaN(t) ? -Infinity : t;
  },

  _dataMsOc: function (oc) {
    return this._dataMsDeString(oc.ATUALIZADAEM || oc.ABERTAEM);
  },

  ocsUnicas: function (baseOcs) {
    const porEmpresa = {};
    baseOcs.forEach((oc) => {
      const cnpj = String(oc.CNPJEMPRESA || oc.CNPJ || "").replace(/\D/g, "");
      if (!cnpj) return;
      const dataMs = this._dataMsOc(oc);
      const atual = porEmpresa[cnpj];
      if (!atual || dataMs >= atual.dataMs) porEmpresa[cnpj] = { oc, dataMs };
    });
    return Object.values(porEmpresa).map((e) => e.oc);
  },

  raizCnpj: function (valor) {
    return String(valor || "").replace(/\D/g, "").slice(0, 8);
  },

  transferenciasUnicas: function (baseTransferencias) {
    const porChave = {};
    baseTransferencias.forEach((t) => {
      const raiz = this.raizCnpj(t.CNPJTRANSFERIDO);
      if (!raiz) return;
      const chave = raiz + "|" + (t.OC || "");
      const dataMs = this._dataMsDeString(t.DATAOC);
      const atual = porChave[chave];
      if (!atual || dataMs >= atual.dataMs) porChave[chave] = { t, dataMs };
    });
    return Object.values(porChave).map((e) => e.t);
  },

  ehTransferenciaParaUnidade: function (t, nomeUnidade) {
    const dest = this.limparAcentos(t.UNIDADEDESTINO || "");
    const nome = this.limparAcentos(nomeUnidade || "");
    if (!nome) return false;
    return dest.includes(nome);
  },

  processar: async function () {
    const [csvEmpresas, csvOcs, csvEmails] = await Promise.all([
      StorageManager.lerAsync("nexo_csv_Empresas"),
      StorageManager.lerAsync("nexo_csv_Ocs"),
      StorageManager.lerAsync("nexo_csv_Emails"),
    ]);

    if (!csvEmpresas) return null;

    let baseEmpresas = FileProcessor.csvParaTabela(csvEmpresas);
    const baseOcs = csvOcs ? FileProcessor.csvParaTabela(csvOcs) : [];
    const relatorioEmails = csvEmails
      ? FileProcessor.csvParaTabela(csvEmails)
      : [];

    baseEmpresas = this._aplicarDataAcordoReal(baseEmpresas, relatorioEmails);

    let tabEmpresas = {};
    let tabCalendarioContato = { GERAL: {} };
    let tabCalendarioContatoReal = { GERAL: {} };
    let tabCalendarioResposta = { GERAL: {} };

    [...this.equipeAtiva, "SEM ANALISTA"].forEach((nome) => {
      tabEmpresas[nome] = {
        total: 0,
        semContato: 0,
        contatoEmAndamento: 0,
        contatada: 0,
        agendada: 0,
        estendida: 0,
        lembrete: 0,
        formalizada: 0,
        prazoVencido: 0,
        respondida: 0,
        associadas: 0,

        associadasRepresentante: 0,
        associadasGrupo: 0,
      };
      tabCalendarioContato[nome] = {};
      tabCalendarioContatoReal[nome] = {};
      tabCalendarioResposta[nome] = {};
    });

    baseEmpresas.forEach((empresa) => {
      let chave = this.analistaDaEmpresa(empresa) || "SEM ANALISTA";

      let kStatus =
        Object.keys(empresa).find(
          (k) => k === "SITUACAO",
        ) || Object.keys(empresa).find((k) => k === "STATUS");
      let status = kStatus ? empresa[kStatus].toUpperCase() : "";

      tabEmpresas[chave].total++;
      if (status.includes("SEM CONTATO")) tabEmpresas[chave].semContato++;
      else if (status.includes("CONTATO EM ANDAMENTO"))
        tabEmpresas[chave].contatoEmAndamento++;
      else if (status.includes("CONTATADA")) tabEmpresas[chave].contatada++;
      else if (status.includes("AGENDADA")) tabEmpresas[chave].agendada++;
      else if (status.includes("PRAZO ESTENDIDO")) tabEmpresas[chave].estendida++;
      else if (status.includes("LEMBRETE ENVIADO")) tabEmpresas[chave].lembrete++;
      else if (status.includes("FORMALIZADA")) tabEmpresas[chave].formalizada++;
      else if (status.includes("VENCIDO")) tabEmpresas[chave].prazoVencido++;
      else if (status.includes("RESPONDIDA")) tabEmpresas[chave].respondida++;

      const kDestMat = Object.keys(empresa).find((k) => k === "CANALENVIO");
      let destMat = kDestMat ? this.limparAcentos(empresa[kDestMat]) : "";
      const ehRepresentante = destMat.includes("REPRESENTANTE");
      const ehGrupoEmp = destMat.includes("GRUPO EMPRESARIAL");
      if (ehRepresentante || ehGrupoEmp) {
        tabEmpresas[chave].associadas++;
        if (ehRepresentante) tabEmpresas[chave].associadasRepresentante++;
        if (ehGrupoEmp) tabEmpresas[chave].associadasGrupo++;
      }

      let colEntrega = Object.keys(empresa).find(
        (k) => k === "DATAENVIO",
      );
      let colContatoReal = Object.keys(empresa).find(
        (k) => k === "DATACONTATO",
      );
      let colDevolucao = Object.keys(empresa).find(
        (k) => k === "DATARETORNO",
      );

      if (colEntrega && empresa[colEntrega]) {
        let d = this.normalizarDataParaChave(empresa[colEntrega]);
        if (d) this.somarNoCalendario(tabCalendarioContato, chave, d);
      }
      if (colContatoReal && empresa[colContatoReal]) {
        let d = this.normalizarDataParaChave(empresa[colContatoReal]);
        if (d) this.somarNoCalendario(tabCalendarioContatoReal, chave, d);
      }

      if (status.includes("RESPONDIDA")) {
        const dataRespostaRaw =
          (colDevolucao && empresa[colDevolucao]) ||
          (colEntrega && empresa[colEntrega]) ||
          null;
        if (dataRespostaRaw) {
          let d = this.normalizarDataParaChave(dataRespostaRaw);
          if (d) this.somarNoCalendario(tabCalendarioResposta, chave, d);
        }
      }
    });

    let tabOcs = {};
    [...this.equipeAtiva, "SEM ANALISTA"].forEach((nome) => {
      tabOcs[nome] = {
        iniciada: 0,
        analise: 0,
        rejeitada: 0,
        concluida: 0,
        concTotal: 0,
        concEfetiva: 0,
      };
    });

    this.ocsUnicas(baseOcs).forEach((oc) => {
      let chave = this.analistaDaOc(oc) || "SEM ANALISTA";

      let kStatusOc = Object.keys(oc).find((k) => k === "STATUS");

      let statusOc = kStatusOc ? this.limparAcentos(oc[kStatusOc]) : "";

      if (statusOc.includes("INICIADA")) tabOcs[chave].iniciada++;
      if (statusOc.includes("ANALISE"))
        tabOcs[chave].analise++;
      if (statusOc.includes("REJEITADA")) tabOcs[chave].rejeitada++;
      if (this.ocConcluida(oc)) {
        tabOcs[chave].concluida++;
        tabOcs[chave].concTotal++;
        if (this.ocEfetiva(oc)) tabOcs[chave].concEfetiva++;
      }
    });

    return {
      empresas: tabEmpresas,
      ocs: tabOcs,
      calContato: tabCalendarioContato,
      calContatoReal: tabCalendarioContatoReal,
      calResposta: tabCalendarioResposta,
    };
  },

  somarNoCalendario: function (objeto, analista, data) {
    if (!objeto["GERAL"][data]) objeto["GERAL"][data] = 0;
    objeto["GERAL"][data]++;
    if (!objeto[analista][data]) objeto[analista][data] = 0;
    objeto[analista][data]++;
  },
};
