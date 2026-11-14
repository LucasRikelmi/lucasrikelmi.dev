const CONFIG_UNIDADE_PADRAO = {
  nome: "Nome da Unidade (exemplo)",
  uf: "UF",
  estado: "Estado",
  municipioSede: "",
  cep: "00000-000",
  logradouro: "Endereço da unidade",
  bairro: "",
  complemento: "",

  endereco: "Endereço da unidade",
  chefe: "Nome do(a) chefe da unidade",
  telefoneFixo: "(00) 0000-0000",
  telefoneCelular: "(00) 00000-0000",
  email: "unidade@meridiano.example",

  gerenteArea: "",
  gerenteAreaAssinaturaB64: "",

  diretorAssinaturaB64: "",

  municipiosGeoBase: [],
};

const ConfigUnidade = {
  _CHAVE: "nexo_config_unidade",

  carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(this._CHAVE) || "null");
      const mesclado = salvo && typeof salvo === "object"
        ? { ...CONFIG_UNIDADE_PADRAO, ...salvo }
        : { ...CONFIG_UNIDADE_PADRAO };

      if (salvo && !salvo.logradouro && salvo.endereco) {
        mesclado.logradouro = salvo.endereco;
      }
      return mesclado;
    } catch (_) {
      return { ...CONFIG_UNIDADE_PADRAO };
    }
  },

  salvar(dados) {
    const mesclado = { ...CONFIG_UNIDADE_PADRAO, ...dados };

    mesclado.endereco = [mesclado.logradouro, mesclado.bairro, mesclado.complemento].filter(Boolean).join(", ");
    localStorage.setItem(this._CHAVE, JSON.stringify(mesclado));
    Object.assign(CONFIG_UNIDADE, mesclado);
    return mesclado;
  },

  restaurarPadrao() {
    localStorage.removeItem(this._CHAVE);
    Object.assign(CONFIG_UNIDADE, CONFIG_UNIDADE_PADRAO);
    return { ...CONFIG_UNIDADE_PADRAO };
  },

  _nomeArquivo() {
    const slug = String(CONFIG_UNIDADE.nome || "unidade")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
    return `nexo_config_${slug || "unidade"}.json`;
  },

  exportarJSON() {
    const blob = new Blob([JSON.stringify(CONFIG_UNIDADE, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = this._nomeArquivo();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importarJSON(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        try {
          const dados = JSON.parse(leitor.result);
          if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
            throw new Error("formato inesperado");
          }
          if (!dados.nome || !String(dados.nome).trim()) {
            reject(new Error("Item obrigatório ausente — o arquivo não informa o nome da unidade."));
            return;
          }
          resolve(this.salvar(dados));
        } catch (_) {
          reject(new Error("Arquivo inválido — não é um JSON de configuração reconhecível."));
        }
      };
      leitor.onerror = () => reject(new Error("Erro ao ler o arquivo."));
      leitor.readAsText(arquivo);
    });
  },
};

const CONFIG_UNIDADE = ConfigUnidade.carregar();
window.CONFIG_UNIDADE = CONFIG_UNIDADE;
window.ConfigUnidade = ConfigUnidade;

function _atualizarAgencyNameNaTela() {
  document.querySelectorAll(".agency-name").forEach((el) => {
    el.textContent = CONFIG_UNIDADE.nome;
  });
}
document.addEventListener("DOMContentLoaded", _atualizarAgencyNameNaTela);

window.addEventListener("storage", (e) => {
  if (e.key !== ConfigUnidade._CHAVE) return;
  Object.assign(CONFIG_UNIDADE, ConfigUnidade.carregar());
  _atualizarAgencyNameNaTela();
});
