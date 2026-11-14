const EQUIPE_PADRAO = [];

const ConfigEquipe = {
  _CHAVE: "nexo_config_equipe",

  carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(this._CHAVE) || "null");
      if (Array.isArray(salvo)) {
        return salvo.filter((t) => t && typeof t.nome === "string" && t.nome.trim());
      }
    } catch (_) {  }
    return EQUIPE_PADRAO.map((nome) => ({ nome, visivel: true }));
  },

  salvar(lista) {
    localStorage.setItem(this._CHAVE, JSON.stringify(lista));
    this._atualizarVisivel(lista);
    return lista;
  },

  restaurarPadrao() {
    localStorage.removeItem(this._CHAVE);
    const lista = this.carregar();
    this._atualizarVisivel(lista);
    return lista;
  },

  _atualizarVisivel(lista) {
    window.EQUIPE_VISIVEL = new Set(lista.filter((t) => t.visivel).map((t) => t.nome));
  },

  extrairNomesDaTabela(tabela) {
    const nomes = new Set();
    (tabela || []).forEach((emp) => {
      const chaves = Object.keys(emp);
      const kResposta = chaves.find((k) => k === "ANALISTARESPONSAVEL");
      const kContato = chaves.find((k) => k === "ANALISTACONTATO");
      [kResposta, kContato].forEach((k) => {
        const raw = String((k && emp[k]) || "").trim();
        if (raw) nomes.add(raw);
      });
    });
    return [...nomes].map((n) => n.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()));
  },
};

window.ConfigEquipe = ConfigEquipe;
ConfigEquipe._atualizarVisivel(ConfigEquipe.carregar());
