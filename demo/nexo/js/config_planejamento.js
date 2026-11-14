const CONFIG_PLANEJAMENTO_PADRAO = {
  dataInicio: "2026-04-07",
  prazoFinalAcordos: "2026-06-30",
  prazoFinalRespostas: "2026-10-30",
  feriados: {
    "2026-04-21": "Tiradentes",
    "2026-05-01": "Trabalhador",
    "2026-06-04": "Corpus Christi",
    "2026-08-31": "Aniversário Municipal",
    "2026-09-07": "Independência",
    "2026-10-12": "N.S. Aparecida",
    "2026-11-02": "Finados",
    "2026-11-15": "Proc. da República",
    "2026-12-25": "Natal",
  },
};

const ConfigPlanejamento = {
  _CHAVE: "nexo_config_planejamento",

  carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(this._CHAVE) || "null");
      if (salvo && typeof salvo === "object") {
        return {
          ...CONFIG_PLANEJAMENTO_PADRAO,
          ...salvo,
          feriados: { ...(salvo.feriados && typeof salvo.feriados === "object" ? salvo.feriados : CONFIG_PLANEJAMENTO_PADRAO.feriados) },
        };
      }
    } catch (_) {  }
    return { ...CONFIG_PLANEJAMENTO_PADRAO, feriados: { ...CONFIG_PLANEJAMENTO_PADRAO.feriados } };
  },

  salvar(dados) {
    const mesclado = {
      ...CONFIG_PLANEJAMENTO_PADRAO,
      ...dados,
      feriados: { ...(dados.feriados || {}) },
    };
    localStorage.setItem(this._CHAVE, JSON.stringify(mesclado));
    Object.assign(CONFIG_PLANEJAMENTO, mesclado);
    return mesclado;
  },

  restaurarPadrao() {
    localStorage.removeItem(this._CHAVE);
    const padrao = this.carregar();
    Object.assign(CONFIG_PLANEJAMENTO, padrao);
    return padrao;
  },

  paraDate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  },
};

const CONFIG_PLANEJAMENTO = ConfigPlanejamento.carregar();
window.CONFIG_PLANEJAMENTO = CONFIG_PLANEJAMENTO;
window.ConfigPlanejamento = ConfigPlanejamento;
