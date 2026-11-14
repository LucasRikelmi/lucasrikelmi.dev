const NEXO_DEMO = {
  SENHA: "nexo-demo-portfolio",

  VERSAO: "10",

  _migrarVersao() {
    try {
      if (localStorage.getItem("nexo_demo_versao") === this.VERSAO) return;
      Object.keys(localStorage)
        .filter((k) => k.startsWith("nexo_") && k !== "nexo_demo_sem_faixa")
        .forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
      localStorage.setItem("nexo_demo_versao", this.VERSAO);
    } catch (_) {  }
  },
  URL_PORTFOLIO: "../../index.html#projetos",

  UNIDADE: {
    nome: "Unidade Triângulo",
    uf: "MG",
    estado: "Minas Gerais",
    municipioSede: "Uberlândia",
    cep: "38400-000",
    logradouro: "Rua Exemplo, 100, Sala 1",
    bairro: "Centro",
    chefe: "Responsável Exemplo",
    telefoneFixo: "(34) 0000-4100",
    telefoneCelular: "(34) 09000-4100",
    email: "triangulo@meridiano.example",
    gerenteArea: "Gerente Exemplo",
  },

  async _desbloquear(cm) {
    const sessao = await cm._restaurarSessao();
    if (sessao) return sessao;

    const saltB64 = localStorage.getItem(cm._SALT_KEY);
    if (saltB64) {
      const algoritmo = localStorage.getItem(cm._ALGORITMO_KEY) || "pbkdf2";
      const chave = await cm._derivarChave(this.SENHA, cm._deBase64(saltB64), algoritmo);
      if (await cm._validarSenha(chave)) return chave;
      cm._zerarTudo();
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const chave = await cm._derivarChave(this.SENHA, salt, cm._ALGORITMO_PADRAO);
    localStorage.setItem(cm._SALT_KEY, cm._paraBase64(salt));
    localStorage.setItem(cm._ALGORITMO_KEY, cm._ALGORITMO_PADRAO);
    await cm._criarVerificador(chave);
    return chave;
  },

  _carregarScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  },

  async _garantirMock() {
    if (localStorage.getItem("nexo_modo_mock") === "1") return;
    if (typeof MockManager === "undefined") {
      await this._carregarScript("js/importacao/mock_manager.js");
    }
    await MockManager.ativar();
    if (typeof ConfigUnidade !== "undefined") ConfigUnidade.salvar(this.UNIDADE);

    location.reload();
    await new Promise(() => {});
  },

  _SELETOR_TRAVADO: [
    "#btnMock", "#btnLimparTudo", ".sync-card-clear-btn",
    "input.file-input-hidden", 'label[for^="file_"]', ".sync-card .btn-upload", ".btn-import",
  ].join(","),

  _travarBase() {
    document.querySelectorAll(this._SELETOR_TRAVADO).forEach((el) => {
      el.classList.add("nexo-demo-travado");
      el.setAttribute("title", "Desativado na demonstração: a base de exemplo é fixa");
      if (el.tagName === "INPUT") el.disabled = true;
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(this._SELETOR_TRAVADO)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const msg = "Na demonstração a base de exemplo é fixa: importar, trocar ou apagar dados está desativado.";
      if (typeof NexoModal !== "undefined" && NexoModal.alert) NexoModal.alert("Base de demonstração", msg, "info");
      else alert(msg);
    }, true);
  },

  _faixa() {
    if (document.getElementById("nexoDemoFaixa")) return;
    try { if (localStorage.getItem("nexo_demo_sem_faixa") === "1") return; } catch (_) {  }
    const el = document.createElement("div");
    el.id = "nexoDemoFaixa";
    el.innerHTML =
      '<span><i class="fas fa-flask"></i> Ambiente de demonstração · dados 100% fictícios</span>' +
      `<a href="${this.URL_PORTFOLIO}"><i class="fas fa-arrow-left"></i> Voltar ao portfólio</a>`;
    document.body.appendChild(el);
  },
};

if (typeof CryptoManager !== "undefined") {
  CryptoManager.iniciar = async function () {
    NEXO_DEMO._migrarVersao();
    this._chave = await NEXO_DEMO._desbloquear(this);
    await this._cachearSessao(this._chave);
    this._renovarValidade();
    await NEXO_DEMO._garantirMock();
  };
  CryptoManager._iniciarMonitorInatividade = () => {};
}

document.addEventListener("DOMContentLoaded", () => {
  NEXO_DEMO._faixa();
  NEXO_DEMO._travarBase();
});
