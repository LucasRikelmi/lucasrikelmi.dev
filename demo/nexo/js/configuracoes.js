const ConfigManager = {
  CHAVE: "nexo_config",

  _defaults() {
    return { incluirUnidadeNoNomeArquivo: true };
  },

  carregar() {
    try {
      const raw = localStorage.getItem(this.CHAVE);
      if (!raw) return this._defaults();
      const salvo = JSON.parse(raw);
      return { incluirUnidadeNoNomeArquivo: salvo.incluirUnidadeNoNomeArquivo !== false };
    } catch { return this._defaults(); }
  },

  salvar(config) {
    localStorage.setItem(this.CHAVE, JSON.stringify(config));
  },

  slugUnidade() {
    const nome = (typeof ConfigUnidade !== "undefined" ? (ConfigUnidade.carregar().nome || "") : "").trim();
    if (!nome) return "";
    return "_" + nome
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 20);
  },

  prefixoArquivo() {
    const cfg = this.carregar();
    if (!cfg.incluirUnidadeNoNomeArquivo) return "";
    return this.slugUnidade();
  },
};

const _FormTravavel = {

  aplicar(form, botaoSalvar, temDadosSalvos, seletorCampos = "input, select, textarea") {
    const textoSalvarOriginal = botaoSalvar.innerHTML;
    const eraSubmit = botaoSalvar.type === "submit";

    const campos = () => form.querySelectorAll(seletorCampos);

    const travar = () => {
      campos().forEach((el) => { el.disabled = true; });
      form.classList.add("config-form-travado");
      if (eraSubmit) botaoSalvar.type = "button";
      botaoSalvar.classList.remove("nexo-modal-btn-primary");
      botaoSalvar.classList.add("nexo-modal-btn-alterar");
      botaoSalvar.innerHTML = '<i class="fas fa-pen"></i> Alterar';
    };

    const destravar = () => {
      campos().forEach((el) => { el.disabled = false; });
      form.classList.remove("config-form-travado");
      if (eraSubmit) botaoSalvar.type = "submit";
      botaoSalvar.classList.remove("nexo-modal-btn-alterar");
      botaoSalvar.classList.add("nexo-modal-btn-primary");
      botaoSalvar.innerHTML = textoSalvarOriginal;
    };

    botaoSalvar.addEventListener("click", (e) => {
      if (botaoSalvar.classList.contains("nexo-modal-btn-alterar")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        destravar();
      }
    });

    if (temDadosSalvos) travar(); else destravar();
    return { travar, destravar };
  },
};

document.addEventListener("DOMContentLoaded", () => {
  _carregarFormulario();
  _bindAbas();
  _renderDadosUnidade();
});

function _carregarFormulario() {
  const cfg = ConfigManager.carregar();
  _setChk("cfg-incluir-unidade-arquivo", cfg.incluirUnidadeNoNomeArquivo);
}

function _setChk(id, val) { const el = document.getElementById(id); if (el) el.checked = !!val; }
function _getChk(id) { const el = document.getElementById(id); return el ? el.checked : false; }

function _sincronizarTopbar(nome) {
  document.querySelectorAll(".agency-name").forEach(el => {
    if (nome) el.textContent = nome;
  });
}

function salvarConfiguracoes() {
  ConfigManager.salvar({ incluirUnidadeNoNomeArquivo: _getChk("cfg-incluir-unidade-arquivo") });
  NexoModal.alert("Preferências salvas", "Preferências de exportação salvas com sucesso!", "sucesso");
}

function _bindAbas() {
  const tabs = document.getElementById("cfgTabs");
  if (!tabs) return;
  tabs.querySelectorAll(".config-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => _trocarAbaConfig(btn.dataset.aba));
  });
}

const _ABAS_CONFIG = ["geral", "equipe", "geolocalizacao", "planejamento", "exportar", "sobre"];

function _trocarAbaConfig(aba) {
  document.querySelectorAll("#cfgTabs .config-tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.aba === aba);
  });
  _ABAS_CONFIG.forEach((id) => {
    const painel = document.getElementById("painel" + id.charAt(0).toUpperCase() + id.slice(1));
    if (painel) painel.hidden = id !== aba;
  });
  if (aba === "equipe") _renderEquipe();
  if (aba === "geolocalizacao") GeoBaseConfigUI.render(document.getElementById("painelConteudoGeolocalizacao"));
  if (aba === "planejamento") _renderPlanejamentoAba();
  if (aba === "exportar") _renderExportarImportar();
}

function _avisoCritico(msg) {
  return `<div class="config-aviso-critico"><i class="fas fa-triangle-exclamation"></i><span>${msg}</span></div>`;
}

function _avisoCompartilhamento() {
  return `<div class="config-geral-aviso"><i class="fas fa-users"></i>
    Quando mais de uma pessoa da unidade utiliza o NEXO, cada instalação (navegador ou
    máquina) mantém sua própria configuração local. Para uniformizar os dados entre todos os
    usuários, exporte e importe pela aba <strong>Exportar/Importar</strong>.
  </div>`;
}

const _UFS_CFG = [
  { sigla: "AC", nome: "Acre" }, { sigla: "AL", nome: "Alagoas" }, { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" }, { sigla: "BA", nome: "Bahia" }, { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" }, { sigla: "ES", nome: "Espírito Santo" }, { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" }, { sigla: "MT", nome: "Mato Grosso" }, { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" }, { sigla: "PA", nome: "Pará" }, { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" }, { sigla: "PE", nome: "Pernambuco" }, { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" }, { sigla: "RN", nome: "Rio Grande do Norte" }, { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" }, { sigla: "RR", nome: "Roraima" }, { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" }, { sigla: "SE", nome: "Sergipe" }, { sigla: "TO", nome: "Tocantins" },
];

const _CAMPOS_UNIDADE_DOC = [
  { chave: "municipioSede",   label: "Município-Sede",   placeholder: "Ex.: Uberlândia", obrigatorio: true },
  { chave: "logradouro",      label: "Logradouro",       placeholder: "Rua, avenida, número...", obrigatorio: true },
  { chave: "bairro",          label: "Bairro",           placeholder: "Bairro", obrigatorio: true },
  { chave: "cep",             label: "CEP",              placeholder: "00000-000", obrigatorio: true },

  { chave: "complemento",     label: "Complemento",      placeholder: "Sala, bloco, ponto de referência (opcional)", stretchEnd: true },
  { chave: "chefe",           label: "Responsável pela unidade", placeholder: "Nome completo do(a) chefe", full: true, obrigatorio: true },
  { chave: "telefoneFixo",    label: "Telefone fixo",    placeholder: "(00) 0000-0000", obrigatorio: true },
  { chave: "telefoneCelular", label: "Telefone celular", placeholder: "(00) 00000-0000", obrigatorio: true },
  { chave: "email",           label: "E-mail",           placeholder: "unidade@meridiano.example", stretchEnd: true, obrigatorio: true },
  { chave: "gerenteArea", label: "Gerente de Área", placeholder: "Nome completo do(a) gerente de área", full: true, obrigatorio: true },
];

let _stretchEndResizeTimer;
function _alinharCamposStretchEnd(form) {
  clearTimeout(_stretchEndResizeTimer);
  _stretchEndResizeTimer = setTimeout(() => {
    const alvos = Array.from(form.querySelectorAll(".config-field-stretch-end"));

    const primeiroCampo = form.querySelector(":scope > .config-field:not(.config-field-full):not(.config-field-nome)");
    if (!alvos.length || !primeiroCampo) return;

    alvos.forEach((el) => { el.style.gridColumn = ""; });
    void form.offsetHeight;

    const formRect = form.getBoundingClientRect();
    const largura = primeiroCampo.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(form).columnGap) || 0;

    alvos.forEach((el) => {
      const r = el.getBoundingClientRect();
      const indice = Math.round((r.left - formRect.left) / (largura + gap));
      el.style.gridColumn = `${indice + 1} / -1`;
    });
  }, 50);
}

function _renderDadosUnidade() {
  const content = document.getElementById("painelDadosUnidade");
  if (!content || typeof ConfigUnidade === "undefined") return;
  const atual = ConfigUnidade.carregar();
  const ufAtual = _UFS_CFG.some((u) => u.sigla === atual.uf) ? atual.uf : "";

  const ehGenerico = (chave, valor) => !valor.trim() || valor.trim() === (CONFIG_UNIDADE_PADRAO[chave] || "").trim();
  const _jaConfigurado = !ehGenerico("nome", atual.nome || "") && !!ufAtual;
  let assinaturaB64 = atual.gerenteAreaAssinaturaB64 || "";
  let diretorAssinaturaB64 = atual.diretorAssinaturaB64 || "";

  const assinaturaB64Original = assinaturaB64;
  const diretorAssinaturaB64Original = diretorAssinaturaB64;

  const previewAssinatura = () => assinaturaB64
    ? `<img src="${assinaturaB64}" alt="Assinatura do(a) gerente de área" style="max-height:60px;max-width:240px;border:1px solid var(--border-color);border-radius:4px;background:#fff;padding:4px;display:block;" />`
    : `<span style="font-size:0.78rem;color:var(--text-muted);">Nenhuma assinatura cadastrada.</span>`;

  const previewAssinaturaDiretor = () => {
    if (diretorAssinaturaB64) {
      return `<img src="${diretorAssinaturaB64}" alt="Assinatura do Diretor" style="max-height:60px;max-width:240px;border:1px solid var(--border-color);border-radius:4px;background:#fff;padding:4px;display:block;" />`;
    }
    const padrao = typeof ASSETS_B64 !== "undefined" ? ASSETS_B64.ASSINATURA_DIRETOR : "";
    if (padrao) {
      return `
        <img src="${padrao}" alt="Assinatura padrão do Diretor" style="max-height:60px;max-width:240px;border:1px solid var(--border-color);border-radius:4px;background:#fff;padding:4px;display:block;" />
        <span style="font-size:0.75rem;color:var(--text-muted);display:block;margin-top:4px;">Usando a assinatura padrão do sistema (nenhuma própria cadastrada).</span>`;
    }
    return `<span style="font-size:0.78rem;color:var(--text-muted);">Nenhuma assinatura cadastrada — a carta de Notificação sairá sem imagem de assinatura (só o nome/cargo do Diretor).</span>`;
  };

  content.innerHTML = `
    <form id="configGeralForm" class="config-geral-form">
      <label class="config-field config-field-nome">
        <span>Nome da unidade (como deve aparecer nos documentos) <strong class="config-campo-obrigatorio" title="Obrigatório para gerar cartas/recibos">*</strong></span>
        <input type="text" name="nome" value="${escapeHTML(atual.nome || "")}" placeholder="Nome oficial da unidade" />
      </label>
      <div class="config-field-linha">
        <label class="config-field">
          <span>UF <strong class="config-campo-obrigatorio" title="Obrigatório para gerar cartas/recibos">*</strong></span>
          <select name="uf" id="configGeralUf">
            <option value="" ${ufAtual ? "" : "selected"} disabled>Selecione…</option>
            ${_UFS_CFG.map((u) => `<option value="${u.sigla}" ${u.sigla === ufAtual ? "selected" : ""}>${u.sigla} — ${u.nome}</option>`).join("")}
          </select>
        </label>
        <label class="config-field">
          <span>Estado</span>
          <input type="text" name="estado" id="configGeralEstado" value="${escapeHTML(atual.estado || "")}" readonly />
        </label>
      </div>
      ${_CAMPOS_UNIDADE_DOC.map((c) => `
        <label class="config-field${c.full ? " config-field-full" : ""}${c.stretchEnd ? " config-field-stretch-end" : ""}">
          <span>${c.label}${c.obrigatorio ? ' <strong class="config-campo-obrigatorio" title="Obrigatório para gerar cartas/recibos">*</strong>' : ""}</span>
          <input type="text" name="${c.chave}" value="${escapeHTML(atual[c.chave] || "")}" placeholder="${c.placeholder}" />
        </label>
      `).join("")}
      <p class="config-geobase-nota"><strong class="config-campo-obrigatorio">*</strong> Campos obrigatórios — sem eles, o sistema bloqueia a geração de qualquer carta ou recibo (nunca é permitido gerar um documento oficial com dado genérico/de exemplo).</p>
      <div class="config-field config-field-full">
        <span>Assinatura do(a) gerente de área (imagem — convertida e guardada localmente)</span>
        <div class="config-geral-acoes" style="justify-content:flex-start; margin-top:4px;">
          <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeralAssinaturaEscolher"><i class="fas fa-image"></i> Escolher imagem</button>
          <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeralAssinaturaRemover"><i class="fas fa-trash"></i> Remover</button>
        </div>
        <input type="file" id="configGeralAssinaturaArquivo" accept="image/*" style="display:none" />
        <div id="configGeralAssinaturaPreview" style="margin-top:8px;">${previewAssinatura()}</div>
      </div>
      <div class="config-field config-field-full">
        <span>Assinatura do Diretor de Operações (nacional — a mesma para todas as unidades, usada só na carta de Notificação)</span>
        <div class="config-geral-acoes" style="justify-content:flex-start; margin-top:4px;">
          <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeralAssinaturaDiretorEscolher"><i class="fas fa-image"></i> Escolher imagem</button>
          <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeralAssinaturaDiretorRemover"><i class="fas fa-trash"></i> Remover</button>
        </div>
        <input type="file" id="configGeralAssinaturaDiretorArquivo" accept="image/*" style="display:none" />
        <div id="configGeralAssinaturaDiretorPreview" style="margin-top:8px;">${previewAssinaturaDiretor()}</div>
        <p class="config-geobase-nota" style="margin-top:6px;">
          <i class="fas fa-circle-info"></i> Não é a assinatura do(a) gerente de área desta unidade — troque aqui só se o Diretor de Operações mudar.
        </p>
      </div>
      ${_avisoCritico("Estes dados são utilizados diretamente no cabeçalho e rodapé de toda carta e recibo gerados (nome, endereço, telefone, chefe e gerente de área). Qualquer informação incorreta será reproduzida em <strong>todos</strong> os documentos — verifique os dados antes de gerar e entregar qualquer carta a um contato.")}
      <div class="config-geral-aviso">
        <i class="fas fa-circle-info"></i>
        As alterações realizadas nesta tela têm efeito imediato; para que sejam refletidas nos PDFs gerados, recarregue a página após salvar.
      </div>
      ${_avisoCompartilhamento()}
      <div class="config-geral-acoes">
        <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeralRestaurar"><i class="fas fa-rotate-left"></i> Restaurar padrão</button>
        <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeralPreview" title="Gera uma carta de exemplo com os dados salvos, para conferir cabeçalho, rodapé e assinatura antes de usar em uma carta real"><i class="fas fa-eye"></i> Gerar carta de preview</button>
        <button type="submit" class="btn-sm interativo nexo-modal-btn-primary" id="configGeralSalvar"><i class="fas fa-check"></i> Salvar</button>
      </div>
      <p class="config-geobase-nota" id="configGeralPreviewAviso" style="display:none;">
        <i class="fas fa-circle-info"></i> Há alterações não salvas — salve antes de gerar o preview, para que ele reflita os dados atuais.
      </p>
    </form>
  `;

  const form = content.querySelector("#configGeralForm");
  const selectUf = content.querySelector("#configGeralUf");
  const inputEstado = content.querySelector("#configGeralEstado");
  selectUf.addEventListener("change", () => {
    const uf = _UFS_CFG.find((u) => u.sigla === selectUf.value);
    inputEstado.value = uf ? uf.nome : "";
  });

  _alinharCamposStretchEnd(form);
  window.addEventListener("resize", () => _alinharCamposStretchEnd(form));

  const btnPreview = content.querySelector("#configGeralPreview");
  const avisoPreview = content.querySelector("#configGeralPreviewAviso");
  const marcarNaoSalvo = () => {
    btnPreview.disabled = true;
    avisoPreview.style.display = "";
  };
  const marcarSalvo = () => {
    btnPreview.disabled = false;
    avisoPreview.style.display = "none";
  };
  form.addEventListener("input", marcarNaoSalvo);
  form.addEventListener("change", marcarNaoSalvo);
  btnPreview.addEventListener("click", async () => {
    if (typeof gerarCartaPreview !== "function") {
      NexoModal.alert("Indisponível", "O motor de geração de PDF (pdf_engine.js) não carregou nesta página.", "erro");
      return;
    }
    try {
      await gerarCartaPreview();
    } catch (e) {
      NexoModal.alert("Erro ao gerar preview", e.message, "erro");
    }
  });

  const inputAssinatura = content.querySelector("#configGeralAssinaturaArquivo");
  content.querySelector("#configGeralAssinaturaEscolher").addEventListener("click", () => inputAssinatura.click());
  inputAssinatura.addEventListener("change", () => {
    const arquivo = inputAssinatura.files[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      NexoModal.alert("Arquivo inválido", "Selecione um arquivo de imagem (PNG, JPG...).", "aviso");
      inputAssinatura.value = "";
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      assinaturaB64 = leitor.result;
      content.querySelector("#configGeralAssinaturaPreview").innerHTML = previewAssinatura();
    };
    leitor.readAsDataURL(arquivo);
  });
  content.querySelector("#configGeralAssinaturaRemover").addEventListener("click", () => {
    assinaturaB64 = "";
    inputAssinatura.value = "";
    content.querySelector("#configGeralAssinaturaPreview").innerHTML = previewAssinatura();
    marcarNaoSalvo();
  });

  const inputAssinaturaDiretor = content.querySelector("#configGeralAssinaturaDiretorArquivo");
  content.querySelector("#configGeralAssinaturaDiretorEscolher").addEventListener("click", () => inputAssinaturaDiretor.click());
  inputAssinaturaDiretor.addEventListener("change", () => {
    const arquivo = inputAssinaturaDiretor.files[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      NexoModal.alert("Arquivo inválido", "Selecione um arquivo de imagem (PNG, JPG...).", "aviso");
      inputAssinaturaDiretor.value = "";
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      diretorAssinaturaB64 = leitor.result;
      content.querySelector("#configGeralAssinaturaDiretorPreview").innerHTML = previewAssinaturaDiretor();
    };
    leitor.readAsDataURL(arquivo);
  });
  content.querySelector("#configGeralAssinaturaDiretorRemover").addEventListener("click", () => {
    diretorAssinaturaB64 = "";
    inputAssinaturaDiretor.value = "";
    content.querySelector("#configGeralAssinaturaDiretorPreview").innerHTML = previewAssinaturaDiretor();
    marcarNaoSalvo();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const faltando = [];
    if (ehGenerico("nome", form.elements.nome.value)) faltando.push("Nome da unidade");
    if (!selectUf.value) faltando.push("UF");
    _CAMPOS_UNIDADE_DOC.forEach((c) => {
      if (c.obrigatorio && ehGenerico(c.chave, form.elements[c.chave].value)) faltando.push(c.label);
    });
    if (faltando.length) {
      NexoModal.alert(
        "Campos obrigatórios não preenchidos",
        `Preencha os seguintes campos antes de salvar: <strong>${faltando.join(", ")}</strong>.<br><br>
         Eles aparecem em toda carta e recibo gerados — o sistema não permite gerar documentos oficiais com dados genéricos.`,
        "aviso",
      );
      return;
    }

    const superMudou = assinaturaB64 !== assinaturaB64Original;
    const diretorMudou = diretorAssinaturaB64 !== diretorAssinaturaB64Original;
    if (superMudou || diretorMudou) {
      const quais = [
        superMudou ? "a assinatura do(a) <strong>gerente de área</strong> desta unidade" : null,
        diretorMudou ? "a assinatura do <strong>Diretor de Operações</strong> da Meridiano" : null,
      ].filter(Boolean).join(" e ");
      const ok = await NexoModal.confirm(
        "Confirmar troca de assinatura",
        `Você alterou ${quais}. Confirme que a imagem foi colocada no campo certo — elas nunca devem ser trocadas entre si (a do Diretor só aparece na carta de Notificação; a do(a) gerente de área, nas demais). Deseja salvar assim mesmo?`
      );
      if (!ok) return;
    }

    const dados = { uf: selectUf.value, estado: inputEstado.value, nome: form.elements.nome.value.trim() };
    _CAMPOS_UNIDADE_DOC.forEach((c) => { dados[c.chave] = form.elements[c.chave].value.trim(); });
    dados.gerenteAreaAssinaturaB64 = assinaturaB64;
    dados.diretorAssinaturaB64 = diretorAssinaturaB64;
    ConfigUnidade.salvar(dados);
    _sincronizarTopbar(dados.nome);
    marcarSalvo();
    _travamentoGeral.travar();
    NexoModal.alert("Configurações salvas", "Dados da unidade atualizados.", "sucesso");
  });

  const _travamentoGeral = _FormTravavel.aplicar(
    form,
    content.querySelector("#configGeralSalvar"),
    _jaConfigurado,
    "input, select, textarea, #configGeralAssinaturaEscolher, #configGeralAssinaturaRemover, #configGeralAssinaturaDiretorEscolher, #configGeralAssinaturaDiretorRemover",
  );

  content.querySelector("#configGeralRestaurar").addEventListener("click", async () => {
    const ok = await NexoModal.confirm("Restaurar padrão", "Esta ação substituirá os dados atuais da unidade (incluindo a assinatura) pelos valores padrão. Deseja continuar?");
    if (!ok) return;
    ConfigUnidade.restaurarPadrao();
    _renderDadosUnidade();
  });
}

async function _buscarAnalistasDaListagem() {
  if (typeof StorageManager === "undefined") throw new Error("Storage não disponível nesta página.");
  if (typeof FileProcessor === "undefined") throw new Error("Motor de leitura de CSV não disponível nesta página.");

  const csvEmp = await StorageManager.lerAsync("nexo_csv_Empresas");
  if (!csvEmp) {

    const existeAlgoSalvo = !!localStorage.getItem("nexo_csv_Empresas");
    throw new Error(
      existeAlgoSalvo
        ? "A base de Empresas está salva, mas não foi possível decifrá-la nesta aba/sessão. Recarregue a página, desbloqueie novamente com a mesma senha e tente de novo."
        : "Nenhuma base de Empresas importada ainda (Sincronização)."
    );
  }

  return ConfigEquipe.extrairNomesDaTabela(FileProcessor.csvParaTabela(csvEmp));
}

function _renderEquipe() {
  const content = document.getElementById("painelConteudoEquipe");
  if (!content || typeof ConfigEquipe === "undefined") return;
  let lista = ConfigEquipe.carregar().map((t) => ({ ...t }));

  const montar = () => `
    ${lista.length === 0 ? _avisoCritico("Quadro de analistas vazio: o Dashboard e o Planejamento permanecem bloqueados até que ao menos um analista seja cadastrado. Utilize \"Buscar analistas da listagem\" para preenchê-lo automaticamente a partir da base já importada, ou adicione os nomes manualmente.") : ""}
    <div class="config-equipe-lista" id="configEquipeLista">
      ${lista.map((t, i) => `
        <div class="config-equipe-item">
          <label class="config-equipe-check">
            <input type="checkbox" ${t.visivel ? "checked" : ""} data-idx="${i}" />
            <span>${escapeHTML(t.nome)}</span>
          </label>
          <button type="button" class="btn-icon" data-idx="${i}" data-acao="remover" title="Remover"><i class="fas fa-trash"></i></button>
        </div>
      `).join("") || `<p class="config-equipe-vazio">Nenhum analista cadastrado.</p>`}
    </div>
    <div class="config-equipe-add">
      <input type="text" id="configEquipeNovoNome" placeholder="Nome do analista" />
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configEquipeAdicionar"><i class="fas fa-plus"></i> Adicionar</button>
    </div>
    <div class="config-geral-acoes" style="justify-content:flex-start; margin-bottom:10px;">
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configEquipeBuscar"><i class="fas fa-magnifying-glass"></i> Buscar analistas da listagem (Responsável Resposta/Contato)</button>
    </div>
    <div class="config-geral-aviso">
      <i class="fas fa-circle-info"></i>
      Desmarcar um analista oculta as empresas dele na listagem do Controle e o remove dos filtros/gráficos por analista do Dashboard e do Planejamento (as empresas continuam contadas nos totais gerais, só deixam de ser atribuídas a ele). Assim como a inclusão/remoção de um analista no quadro, isso só é refletido nas telas Controle, Dashboard e Planejamento depois de salvo aqui e de recarregar (ou reabrir) essas telas.
    </div>
    ${_avisoCompartilhamento()}
    <div class="config-geral-acoes">
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configEquipeRestaurar"><i class="fas fa-rotate-left"></i> Limpar tudo</button>
      <button type="button" class="btn-sm interativo nexo-modal-btn-primary" id="configEquipeSalvar"><i class="fas fa-check"></i> Salvar</button>
    </div>
  `;

  const bind = () => {
    content.querySelectorAll("#configEquipeLista input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => { lista[Number(cb.dataset.idx)].visivel = cb.checked; });
    });
    content.querySelectorAll("[data-acao=remover]").forEach((btn) => {
      btn.addEventListener("click", () => {
        lista.splice(Number(btn.dataset.idx), 1);
        content.innerHTML = montar();
        bind();
      });
    });
    content.querySelector("#configEquipeAdicionar").addEventListener("click", () => {
      const input = content.querySelector("#configEquipeNovoNome");
      const nome = input.value.trim();
      if (!nome) return;
      if (lista.some((t) => t.nome.toLowerCase() === nome.toLowerCase())) {
        NexoModal.alert("Nome duplicado", "Este analista já consta no quadro.", "aviso");
        return;
      }
      lista.push({ nome, visivel: true });
      content.innerHTML = montar();
      bind();
    });
    content.querySelector("#configEquipeBuscar").addEventListener("click", async () => {
      try {
        const encontrados = await _buscarAnalistasDaListagem();
        let novos = 0;
        encontrados.forEach((nome) => {
          if (!lista.some((t) => t.nome.toLowerCase() === nome.toLowerCase())) {
            lista.push({ nome, visivel: true });
            novos++;
          }
        });
        content.innerHTML = montar();
        bind();
        NexoModal.alert(
          "Busca concluída",
          novos > 0
            ? `${novos} analista(s) adicionado(s) a partir da listagem. Remova os nomes indesejados antes de salvar.`
            : "Nenhum nome novo foi encontrado na listagem (todos já constavam no quadro, ou a base não possui analista atribuído).",
          "sucesso",
        );
      } catch (e) {
        NexoModal.alert("Não foi possível concluir a busca", e.message, "aviso");
      }
    });
    content.querySelector("#configEquipeRestaurar").addEventListener("click", async () => {
      const ok = await NexoModal.confirm("Limpar tudo", "Esta ação removerá todos os analistas do quadro, que ficará vazio e bloqueará o Dashboard e o Planejamento até um novo cadastro. Deseja continuar?");
      if (!ok) return;
      lista = ConfigEquipe.restaurarPadrao().map((t) => ({ ...t }));
      content.innerHTML = montar();
      bind();
    });
    content.querySelector("#configEquipeSalvar").addEventListener("click", () => {
      ConfigEquipe.salvar(lista);
      NexoModal.alert("Equipe salva", "Quadro de analistas atualizado.", "sucesso");
    });
  };

  content.innerHTML = montar();
  bind();
}

function _renderPlanejamentoAba() {
  const content = document.getElementById("painelConteudoPlanejamento");
  if (!content || typeof ConfigPlanejamento === "undefined") return;
  const atual = ConfigPlanejamento.carregar();
  let feriados = Object.entries(atual.feriados).map(([data, label]) => ({ data, label }));

  const _jaConfigurado = !!localStorage.getItem(ConfigPlanejamento._CHAVE);

  const montarFeriados = () => feriados.map((f, i) => `
    <div class="config-feriado-item">
      <input type="date" data-idx="${i}" data-campo="data" value="${f.data}" />
      <input type="text" data-idx="${i}" data-campo="label" value="${escapeHTML(f.label)}" placeholder="Nome do feriado" />
      <button type="button" class="btn-icon" data-idx="${i}" data-acao="remover" title="Remover"><i class="fas fa-trash"></i></button>
    </div>
  `).join("") || `<p class="config-equipe-vazio">Nenhum feriado cadastrado.</p>`;

  const montar = () => `
    <form id="configPlanForm" class="config-geral-form">
      <label class="config-field">
        <span>Início do período de planejamento</span>
        <input type="date" name="dataInicio" value="${atual.dataInicio}" />
      </label>
      <label class="config-field">
        <span>Prazo final — Acordos</span>
        <input type="date" name="prazoFinalAcordos" value="${atual.prazoFinalAcordos}" />
      </label>
      <label class="config-field">
        <span>Prazo final — Respostas</span>
        <input type="date" name="prazoFinalRespostas" value="${atual.prazoFinalRespostas}" />
      </label>
    </form>
    <h4 class="config-feriados-titulo">Feriados</h4>
    <div id="configFeriadosLista">${montarFeriados()}</div>
    <div class="config-equipe-add">
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configFeriadoAdicionar"><i class="fas fa-plus"></i> Adicionar feriado</button>
    </div>
    ${_avisoCritico("Prazo errado ou feriado esquecido distorce o cálculo de dias úteis, velocidade necessária e o alerta de risco de atraso no Planejamento — confira as datas antes de repassar a meta à equipe.")}
    <div class="config-geral-aviso">
      <i class="fas fa-circle-info"></i>
      Alterações só têm efeito após recarregar a página (calendário e cálculo de dias úteis são montados na carga).
    </div>
    ${_avisoCompartilhamento()}
    <div class="config-geral-acoes">
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configPlanRestaurar"><i class="fas fa-rotate-left"></i> Restaurar padrão</button>
      <button type="button" class="btn-sm interativo nexo-modal-btn-primary" id="configPlanSalvar"><i class="fas fa-check"></i> Salvar</button>
    </div>
  `;

  const bind = () => {
    content.querySelectorAll("#configFeriadosLista input").forEach((inp) => {
      inp.addEventListener("input", () => {
        feriados[Number(inp.dataset.idx)][inp.dataset.campo] = inp.value;
      });
    });
    content.querySelectorAll("[data-acao=remover]").forEach((btn) => {
      btn.addEventListener("click", () => {
        feriados.splice(Number(btn.dataset.idx), 1);
        content.querySelector("#configFeriadosLista").innerHTML = montarFeriados();
        bind();
      });
    });
    content.querySelector("#configFeriadoAdicionar").addEventListener("click", () => {
      feriados.push({ data: "", label: "" });
      content.querySelector("#configFeriadosLista").innerHTML = montarFeriados();
      bind();
    });
    content.querySelector("#configPlanRestaurar").addEventListener("click", async () => {
      const ok = await NexoModal.confirm("Restaurar padrão", "Isso substitui prazos e feriados pelos valores padrão. Confirmar?");
      if (!ok) return;
      const padrao = ConfigPlanejamento.restaurarPadrao();
      feriados = Object.entries(padrao.feriados).map(([data, label]) => ({ data, label }));
      _renderPlanejamentoAba();
    });
    content.querySelector("#configPlanSalvar").addEventListener("click", () => {
      const form = content.querySelector("#configPlanForm");
      const dados = {
        dataInicio: form.elements.dataInicio.value,
        prazoFinalAcordos: form.elements.prazoFinalAcordos.value,
        prazoFinalRespostas: form.elements.prazoFinalRespostas.value,
        feriados: Object.fromEntries(
          feriados.filter((f) => f.data && f.label).map((f) => [f.data, f.label]),
        ),
      };
      ConfigPlanejamento.salvar(dados);
      NexoModal.alert("Planejamento salvo", "Prazos e feriados atualizados. Recarregue a página para aplicar.", "sucesso");
      _travamentoPlan.travar();
    });
  };

  content.innerHTML = montar();

  const _travamentoPlan = _FormTravavel.aplicar(
    content.querySelector("#configPlanForm"),
    content.querySelector("#configPlanSalvar"),
    _jaConfigurado,
  );
  bind();
}

const GeoBaseConfigUI = {
  _pagina: 0,
  _PAGINAS: [
    { titulo: "O que é" },
    { titulo: "Uso no NEXO" },
    { titulo: "Fonte dos dados" },
    { titulo: "Geração do dicionário" },
    { titulo: "Importação" },
  ],

  _etlArquivo: null,
  _etlResultado: null,

  _conteudoPagina(indice) {
    const temMapEngine = typeof MapEngine !== "undefined" && typeof MapEngine.importarDicionario === "function";
    switch (indice) {
      case 0:
        return `
          <div class="config-geobase-info">
            <p>A <strong>GeoBase</strong> é um dicionário de endereços georreferenciados (logradouro, número, quadra/lote, bairro, CEP e coordenadas) usado pelo NEXO para posicionar empresas no mapa sem depender de APIs externas de geocodificação.</p>
            <p>Ela é montada a partir de qualquer cadastro público de endereços em CSV: o ETL embutido filtra apenas os municípios da área de atuação da unidade e gera um índice compacto, consultado 100% offline.</p>
            <p>Por princípio de privacidade (<em>zero-API</em>), nenhum endereço de cliente é enviado a serviços de terceiros — o casamento endereço → coordenada acontece inteiramente no navegador do analista.</p>
          </div>
        `;
      case 1:
        return `
          <div class="config-geobase-info">
            <p>No NEXO, o GeoBase é utilizado exclusivamente para a geração de KMLs com coordenadas <strong>aproximadas</strong> a partir do endereço declarado pela empresa, com base na GeoBase importada.</p>
            ${_avisoCritico("O resultado não é 100% preciso e exige validação humana antes de ser utilizado. A vantagem do recurso é evitar a busca manual, empresa por empresa, de uma localização aproximada — ele não substitui a conferência.")}
          </div>
        `;
      case 2:
        return `
          <div class="config-geobase-info">
            <p><strong>Fonte dos dados:</strong> qualquer CSV de endereços georreferenciados no layout abaixo (ex.: cadastros abertos de endereços por UF). Confira o cabeçalho do arquivo antes de processá-lo e ajuste colunas renomeadas ou reordenadas.</p>
            <p><strong>Códigos dos municípios</strong> (7 dígitos) já vêm embutidos no sistema para seleção da área de atuação.</p>
          </div>
        `;
      case 3:
        return `
          <div class="config-geobase-info">
            <p>O CSV bruto do GeoBase é processado, filtrado pelos municípios da área de atuação da unidade, e convertido num JSON minificado no formato abaixo.</p>
            <pre class="config-geobase-formato">{ "&lt;código oficial do município&gt;": { "&lt;nome do logradouro&gt;": [ { "tp": "tipo", "n": "número", "q": "quadra", "l": "lote", "b": "bairro", "c": "cep", "la": -16.72, "lo": -49.26 }, ... ] } }</pre>
            <p><strong>Layout esperado do CSV de origem</strong> — cabeçalho com estas colunas (nesta ordem), separadas por <code>;</code>:</p>
            <pre class="config-geobase-formato">COD_UNICO_ENDERECO;COD_UF;COD_MUNICIPIO;COD_DISTRITO;COD_SUBDISTRITO;COD_SETOR;NUM_QUADRA;NUM_FACE;CEP;DSC_LOCALIDADE;NOM_TIPO_SEGLOGR;NOM_TITULO_SEGLOGR;NOM_SEGLOGR;NUM_ENDERECO;DSC_MODIFICADOR;NOM_COMP_ELEM1;VAL_COMP_ELEM1;NOM_COMP_ELEM2;VAL_COMP_ELEM2;NOM_COMP_ELEM3;VAL_COMP_ELEM3;NOM_COMP_ELEM4;VAL_COMP_ELEM4;NOM_COMP_ELEM5;VAL_COMP_ELEM5;LATITUDE;LONGITUDE;NV_GEO_COORD;COD_ESPECIE;DSC_ESTABELECIMENTO;COD_INDICADOR_ESTAB_ENDERECO;COD_INDICADOR_CONST_ENDERECO;COD_INDICADOR_FINALIDADE_CONST;COD_TIPO_ESPECI</pre>
            ${_avisoCritico("NÃO abra nem salve o CSV bruto no Excel ou LibreOffice Calc antes de processá-lo aqui — esses programas limitam planilhas a ~1.048.576 linhas e, ao salvar, descartam silenciosamente todo o restante do arquivo (o GeoBase de uma UF inteira tem muito mais linhas que isso). Use o arquivo exatamente como foi baixado.")}
          </div>
          ${typeof GeoBaseEtl !== "undefined" ? this._renderEtlRunner(temMapEngine) : `
            <div class="config-geral-aviso">
              <i class="fas fa-circle-info"></i>
              Não foi possível carregar o motor do ETL (js/geobase_etl.js) nesta página. Recarregue e tente novamente.
            </div>
          `}
        `;
      case 4:
        return `
          <p class="config-geobase-nota">Se preferir gerar o dicionário fora do navegador (script Python), ou se já rodou o ETL nesta própria tela (página anterior), importe o <code>dicionario_geobase.json</code> resultante abaixo. O arquivo é armazenado localmente, sem necessidade de alterar o código-fonte do NEXO.</p>
          ${temMapEngine ? `
            <div class="config-geral-aviso" id="configGeoBaseStatusAtual">
              <i class="fas fa-spinner fa-spin"></i> Verificando dicionário em uso...
            </div>
            <div class="config-geral-acoes" style="justify-content:flex-start; margin-top:10px;">
              <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeoBaseImportar"><i class="fas fa-upload"></i> Importar dicionário (.json)</button>
              <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeoBaseInvalidar"><i class="fas fa-rotate-left"></i> Restaurar dicionário padrão</button>
            </div>
            <input type="file" id="configGeoBaseArquivo" accept="application/json" style="display:none" />
          ` : `
            <div class="config-geral-aviso">
              <i class="fas fa-circle-info"></i>
              A importação direta para o mapa não está disponível nesta página. Use o botão "Exportar .json" da página anterior e importe o arquivo pela aba GeoBase de uma página com mapa (ex.: Sincronização), quando esse recurso estiver disponível ali.
            </div>
          `}
        `;
      default:
        return "";
    }
  },

  render(content) {
    if (!content) return;
    const total = this._PAGINAS.length;
    const pagina = this._pagina;

    content.innerHTML = `
      <div class="config-geobase-paginador">
        <span class="config-geobase-paginador-titulo">${pagina + 1}. ${this._PAGINAS[pagina].titulo}</span>
        <span class="config-geobase-paginador-contador">Página ${pagina + 1} de ${total}</span>
      </div>
      <div id="geobasePaginaConteudo">${this._conteudoPagina(pagina)}</div>
      <div class="config-geobase-nav">
        <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="geobaseAnterior" ${pagina === 0 ? "disabled" : ""}><i class="fas fa-chevron-left"></i> Anterior</button>
        <button type="button" class="btn-sm interativo nexo-modal-btn-primary" id="geobaseProxima">${
          pagina === total - 1
            ? 'Ir para Planejamento <i class="fas fa-arrow-right"></i>'
            : 'Próxima <i class="fas fa-chevron-right"></i>'
        }</button>
      </div>
    `;

    content.querySelector("#geobaseAnterior").addEventListener("click", () => {
      if (this._pagina > 0) { this._pagina--; this.render(content); }
    });
    content.querySelector("#geobaseProxima").addEventListener("click", () => {

      if (this._pagina < total - 1) { this._pagina++; this.render(content); }
      else { _trocarAbaConfig("planejamento"); }
    });

    if (pagina === 3 && typeof GeoBaseEtl !== "undefined") {
      this._bindEtlRunner(content);
    }

    if (pagina === 4) {
      const temMapEngine = typeof MapEngine !== "undefined" && typeof MapEngine.importarDicionario === "function";
      if (temMapEngine) {
        this._atualizarStatusGeoBase(content);

        const inputArquivo = content.querySelector("#configGeoBaseArquivo");
        content.querySelector("#configGeoBaseImportar").addEventListener("click", () => inputArquivo.click());
        inputArquivo.addEventListener("change", async () => {
          const arquivo = inputArquivo.files[0];
          if (!arquivo) return;
          try {
            const resultado = await MapEngine.importarDicionario(arquivo);

            this._etlResultado = arquivo;
            NexoModal.alert("Dicionário importado", `${resultado.municipios} município(s) carregado(s) e armazenado(s) localmente.`, "sucesso");
            this._atualizarStatusGeoBase(content);
          } catch (e) {
            NexoModal.alert("Erro ao importar", e.message, "erro");
          } finally {
            inputArquivo.value = "";
          }
        });
        content.querySelector("#configGeoBaseInvalidar").addEventListener("click", async () => {
          const ok = await NexoModal.confirm("Restaurar dicionário padrão", "Esta ação removerá o dicionário importado e restabelecerá o arquivo padrão do sistema na próxima geração de mapa. Deseja continuar?");
          if (!ok) return;
          await MapEngine.invalidarCache();
          NexoModal.alert("Cache removido", "O próximo mapa gerado recarregará o dicionário padrão.", "sucesso");
          this._atualizarStatusGeoBase(content);
        });
      }
    }
  },

  async _atualizarStatusGeoBase(content) {
    const el = content.querySelector("#configGeoBaseStatusAtual");
    if (!el) return;
    const status = await MapEngine.statusDicionario();
    if (status.fonte === "json") {
      const quando = status.quando ? status.quando.toLocaleString("pt-BR") : "data desconhecida";
      el.innerHTML = `<i class="fas fa-file-code"></i> Dicionário <strong>importado via JSON</strong> em ${quando} — ${status.municipios} município(s)${status.versao ? ` (rótulo: ${escapeHTML(String(status.versao))})` : ""}.`;
    } else {
      el.innerHTML = `<i class="fas fa-database"></i> Usando o <strong>dicionário padrão do sistema</strong> (arquivo embutido, nenhuma importação ativa).`;
    }
  },

  _popupListaMunicipios(titulo, nomes) {
    const ordenados = [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const corpo = ordenados.length
      ? `<ul class="config-geobase-municipios-popup">${ordenados.map((n) => `<li>${escapeHTML(n)}</li>`).join("")}</ul>`
      : "<p>Nenhum município selecionado.</p>";
    NexoModal.alert(titulo, corpo, "info");
  },

  _ufUnidadeValida() {
    if (typeof ConfigUnidade === "undefined") return false;
    const uf = (ConfigUnidade.carregar().uf || "").trim();
    return typeof _UFS_CFG !== "undefined" && _UFS_CFG.some((u) => u.sigla === uf);
  },

  _renderEtlRunner(temMapEngine) {
    const municipios = (typeof ConfigUnidade !== "undefined" ? ConfigUnidade.carregar() : {}).municipiosGeoBase || [];
    const ufValida = this._ufUnidadeValida();
    return `
      <div class="config-geobase-etl-run">
        <h4 class="config-feriados-titulo">Executar ETL no navegador (sem Python)</h4>
        <p class="config-geobase-nota">Processa o CSV bruto do GeoBase diretamente aqui, filtrando pelos municípios da área de atuação e gerando o dicionário — sem precisar instalar Python.</p>

        <label class="config-field">
          <span>CSV bruto do GeoBase</span>
        </label>
        <div class="config-geral-acoes" style="justify-content:flex-start;">
          <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeoBaseCsvEscolher"><i class="fas fa-file-csv"></i> Escolher arquivo .csv</button>
          <span class="config-geobase-nota" id="configGeoBaseCsvNome" style="margin:0;">${this._etlArquivo ? escapeHTML(this._etlArquivo.name) : "Nenhum arquivo selecionado."}</span>
        </div>
        <input type="file" id="configGeoBaseCsvArquivo" accept=".csv,text/csv" style="display:none" />

        <label class="config-field" style="margin-top:12px;">
          <span>Municípios da área de atuação da unidade</span>
        </label>
        ${!ufValida ? _avisoCritico('A UF da unidade ainda não foi informada na aba <strong>Geral</strong>. É a partir dela que este sistema sabe qual lista de municípios oferecer — selecione a UF lá antes de continuar aqui.') : ""}
        <div class="config-geral-acoes" style="justify-content:flex-start; align-items:center; gap:10px;">
          <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeoBaseMunicipiosSelecionar" ${ufValida ? "" : "disabled"} title="${ufValida ? "" : "Informe a UF da unidade na aba Geral antes de selecionar os municípios"}"><i class="fas fa-list-check"></i> Selecionar municípios</button>
          <button type="button" class="config-geobase-contador" id="configGeoBaseMunicipiosContador" ${municipios.length ? "" : "disabled"} title="Ver municípios selecionados">
            <i class="fas fa-map-pin"></i> ${municipios.length} selecionado(s)
          </button>
        </div>
        <div id="configGeoBaseMunicipiosLista"></div>
        ${typeof MUNICIPIOS_BR_VERSAO !== "undefined" ? `<p class="config-geobase-nota" style="font-size:0.72rem;">Base de municípios gerada em ${new Date(MUNICIPIOS_BR_VERSAO + "T00:00:00").toLocaleDateString("pt-BR")}. Novos municípios são raros — surgem por lei estadual; se algum estiver faltando aqui, avise o desenvolvedor para regenerar a base.</p>` : ""}

        <div class="config-geral-acoes" style="margin-top:12px;">
          <button type="button" class="btn-sm interativo nexo-modal-btn-primary" id="configGeoBaseRodar" ${municipios.length && this._etlArquivo ? "" : "disabled"}><i class="fas fa-play"></i> Rodar ETL</button>
        </div>

        <div id="configGeoBaseVisualizacao" style="display:none;">
          <div class="config-geobase-vis-toggle">
            <button type="button" class="config-geobase-vis-btn ativo" id="configGeoBaseVisLog" data-vis="log"><i class="fas fa-terminal"></i> Linha a linha</button>
            <button type="button" class="config-geobase-vis-btn" id="configGeoBaseVisEtapas" data-vis="etapas"><i class="fas fa-diagram-project"></i> Etapas do algoritmo</button>
          </div>
          <pre id="configGeoBaseLog" class="config-geobase-log"></pre>
          <div id="configGeoBaseEtapas" class="config-geobase-etapas" style="display:none;"></div>
        </div>

        <div id="configGeoBaseEtlAcoes" class="config-geral-acoes" style="${this._etlResultado ? "" : "display:none;"}">
          <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="configGeoBaseExportarJson"><i class="fas fa-download"></i> Exportar .json</button>
        </div>
        <div class="config-geral-aviso" id="configGeoBaseVersaoInfo" style="${this._etlResultado ? "" : "display:none;"}">
          <i class="fas fa-circle-info"></i>
          ${temMapEngine
            ? "O dicionário gerado fica salvo localmente com uma versão própria (data + quantidade de municípios e pontos). Essa versão sempre prevalece sobre o dicionário padrão do sistema."
            : "O motor de mapas não está disponível nesta página, então o dicionário gerado fica só em memória — exporte o .json acima e importe-o pela aba GeoBase de uma página com mapa para que passe a valer para o sistema."}
        </div>
      </div>
    `;
  },

  _ETAPAS: [
    "arquivo.stream().pipeThrough(new TextDecoderStream(encoding))  // decodifica o CSV em chunks",
    "Lê o cabeçalho e valida as colunas obrigatórias do GeoBase",
    "Para cada linha: filtra por COD_MUNICIPIO (área de atuação da unidade)",
    "GeoCore.entradaDeLinhaGeoBase(row)  // normaliza endereço, extenso→numeral, coordenadas",
    "Deduplica estabelecimentos no mesmo ponto (chaveDedup + contagem k)",
    "Materializa o dicionário final (Map → array por município/logradouro)",
    "MapEngine.importarDicionario()  // grava o resultado no IndexedDB local",
  ],

  _renderEtapas(etapasEl, status) {
    etapasEl.innerHTML = this._ETAPAS.map((texto, i) => `
      <div class="config-geobase-etapa config-geobase-etapa-${status[i] || "pendente"}">
        <i class="fas ${status[i] === "feita" ? "fa-check" : status[i] === "ativa" ? "fa-spinner fa-spin" : "fa-circle-notch"}"></i>
        <code>${escapeHTML(texto)}</code>
      </div>
    `).join("");
  },

  _logLinha(logEl, texto, tipo = "info") {
    const linha = document.createElement("div");
    linha.className = `config-geobase-log-linha config-geobase-log-${tipo}`;
    linha.textContent = (tipo === "info" ? "› " : tipo === "sucesso" ? "✓ " : tipo === "erro" ? "✗ " : "") + texto;
    logEl.appendChild(linha);
    logEl.scrollTop = logEl.scrollHeight;
  },

  _bindEtlRunner(content) {
    const secao = content.querySelector(".config-geobase-etl-run");
    if (!secao) return;

    secao.querySelector("#configGeoBaseMunicipiosContador").addEventListener("click", () => {
      const salvos = ConfigUnidade.carregar().municipiosGeoBase || [];
      this._popupListaMunicipios("Municípios selecionados", salvos.map((m) => m.nome));
    });

    const btnSelecionar = secao.querySelector("#configGeoBaseMunicipiosSelecionar");
    const listaEl = secao.querySelector("#configGeoBaseMunicipiosLista");
    btnSelecionar.addEventListener("click", async () => {
      const uf = (ConfigUnidade.carregar().uf || "").trim();
      btnSelecionar.disabled = true;
      const original = btnSelecionar.innerHTML;
      btnSelecionar.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Carregando…`;
      let opcoes;
      try {
        opcoes = await GeoBaseEtl.buscarMunicipiosUF(uf);
      } catch (e) {
        NexoModal.alert("Erro ao buscar municípios", e.message, "erro");
        btnSelecionar.disabled = false;
        btnSelecionar.innerHTML = original;
        return;
      }
      btnSelecionar.disabled = false;
      btnSelecionar.innerHTML = original;

      const selecionadosAtuais = new Set(
        (ConfigUnidade.carregar().municipiosGeoBase || []).map((m) => m.codigo),
      );
      listaEl.innerHTML = `
        <div class="config-geobase-municipios-busca">
          <i class="fas fa-magnifying-glass"></i>
          <input type="text" id="configGeoBaseMunicipiosBusca" placeholder="Buscar município pelo nome…" />
          <button type="button" class="config-geobase-contador" id="configGeoBaseMunicipiosContadorLive" title="Ver selecionados até o momento">
            <i class="fas fa-map-pin"></i> <span id="configGeoBaseMunicipiosContadorLiveNum">${selecionadosAtuais.size}</span> selecionado(s)
          </button>
        </div>
        <div class="config-geobase-municipios-lista">
          ${opcoes.map((m) => `
            <label class="config-geobase-municipio-item" data-nome-busca="${escapeHTML(m.nome.toLowerCase())}">
              <input type="checkbox" value="${m.codigo}" data-nome="${escapeHTML(m.nome)}" ${selecionadosAtuais.has(m.codigo) ? "checked" : ""} />
              <span>${escapeHTML(m.nome)}</span>
            </label>
          `).join("")}
        </div>
        <p class="config-geobase-nota" id="configGeoBaseMunicipiosVazio" style="display:none;">Nenhum município encontrado para essa busca.</p>
        <div class="config-geral-acoes" style="margin-top:8px;">
          <button type="button" class="btn-sm interativo nexo-modal-btn-primary" id="configGeoBaseMunicipiosSalvar"><i class="fas fa-check"></i> Salvar seleção</button>
        </div>
      `;

      const contadorLiveNum = listaEl.querySelector("#configGeoBaseMunicipiosContadorLiveNum");
      const atualizarContadorLive = () => {
        contadorLiveNum.textContent = listaEl.querySelectorAll("input[type=checkbox]:checked").length;
      };
      listaEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
        cb.addEventListener("change", atualizarContadorLive);
      });
      listaEl.querySelector("#configGeoBaseMunicipiosContadorLive").addEventListener("click", () => {
        const nomes = [...listaEl.querySelectorAll("input[type=checkbox]:checked")].map((i) => i.dataset.nome);
        this._popupListaMunicipios("Municípios selecionados até o momento", nomes);
      });

      const itens = [...listaEl.querySelectorAll(".config-geobase-municipio-item")];
      const vazio = listaEl.querySelector("#configGeoBaseMunicipiosVazio");
      listaEl.querySelector("#configGeoBaseMunicipiosBusca").addEventListener("input", (e) => {
        const termo = e.target.value.trim().toLowerCase();
        let visiveis = 0;
        itens.forEach((item) => {
          const bate = !termo || item.dataset.nomeBusca.includes(termo);
          item.style.display = bate ? "" : "none";
          if (bate) visiveis++;
        });
        vazio.style.display = visiveis === 0 ? "block" : "none";
      });

      listaEl.querySelector("#configGeoBaseMunicipiosSalvar").addEventListener("click", () => {
        const marcados = [...listaEl.querySelectorAll("input[type=checkbox]:checked")]
          .map((i) => ({ codigo: i.value, nome: i.dataset.nome }));
        const atual = ConfigUnidade.carregar();
        ConfigUnidade.salvar({ ...atual, municipiosGeoBase: marcados });
        this.render(content);
        NexoModal.alert("Municípios salvos", `${marcados.length} município(s) salvo(s) para o ETL.`, "sucesso");
      });
    });

    const inputCsv = secao.querySelector("#configGeoBaseCsvArquivo");
    secao.querySelector("#configGeoBaseCsvEscolher").addEventListener("click", () => inputCsv.click());
    inputCsv.addEventListener("change", () => {
      this._etlArquivo = inputCsv.files[0] || null;
      this.render(content);
    });

    const btnVisLog = secao.querySelector("#configGeoBaseVisLog");
    const btnVisEtapas = secao.querySelector("#configGeoBaseVisEtapas");
    const logEl = secao.querySelector("#configGeoBaseLog");
    const etapasEl = secao.querySelector("#configGeoBaseEtapas");
    const alternarVisualizacao = (modo) => {
      btnVisLog.classList.toggle("ativo", modo === "log");
      btnVisEtapas.classList.toggle("ativo", modo === "etapas");
      logEl.style.display = modo === "log" ? "block" : "none";
      etapasEl.style.display = modo === "etapas" ? "block" : "none";
    };
    btnVisLog.addEventListener("click", () => alternarVisualizacao("log"));
    btnVisEtapas.addEventListener("click", () => alternarVisualizacao("etapas"));

    const btnRodar = secao.querySelector("#configGeoBaseRodar");
    btnRodar.addEventListener("click", async () => {
      const municipios = ConfigUnidade.carregar().municipiosGeoBase || [];
      if (!municipios.length || !this._etlArquivo) return;

      logEl.innerHTML = "";
      secao.querySelector("#configGeoBaseVisualizacao").style.display = "block";
      alternarVisualizacao("log");
      btnRodar.disabled = true;

      const status = this._ETAPAS.map(() => "pendente");
      const marcar = (ativa, ...feitas) => {
        feitas.forEach((i) => { status[i] = "feita"; });
        if (ativa != null) status[ativa] = "ativa";
        this._renderEtapas(etapasEl, status);
      };
      marcar(0);

      this._logLinha(logEl, `Iniciando ETL — ${this._etlArquivo.name} (${municipios.length} município(s) selecionado(s))`);
      marcar(2, 0, 1);

      const temMapEngine = typeof MapEngine !== "undefined" && typeof MapEngine.importarDicionario === "function";

      try {
        const { dicionario, stats } = await GeoBaseEtl.rodarETL(
          this._etlArquivo,
          municipios.map((m) => m.codigo),
          {
            onProgress: (p) => {
              if (p.concluido) {
                this._logLinha(logEl, `Leitura concluída — ${p.lidas.toLocaleString("pt-BR")} linhas lidas.`);
                this._logLinha(logEl, `${p.aproveitadas.toLocaleString("pt-BR")} linha(s) aproveitada(s) → ${p.municipios} município(s), ${p.pontosUnicos.toLocaleString("pt-BR")} ponto(s) único(s) após deduplicação.`, "sucesso");
                marcar(5, 2, 3, 4);
              } else {
                this._logLinha(logEl, `${p.lidas.toLocaleString("pt-BR")} linhas lidas… ${p.aproveitadas.toLocaleString("pt-BR")} aproveitadas até aqui.`);
                marcar(4, 2, 3);
              }
            },
          },
        );

        const blob = new Blob([JSON.stringify(dicionario)], { type: "application/json" });
        this._etlResultado = blob;

        if (temMapEngine) {
          this._logLinha(logEl, "Gravando dicionário no armazenamento local…");
          marcar(6, 5);
          const sufixoVersao = `${new Date().toISOString().slice(0, 10)}_${stats.municipios}mun_${stats.pontosUnicos}pts`;
          const resultado = await MapEngine.importarDicionario(blob, sufixoVersao);
          marcar(null, 6);
          this._logLinha(logEl, `Concluído — versão "${resultado.versao}" pronta para uso no mapa.`, "sucesso");
        } else {
          marcar(null, 5);
          this._logLinha(logEl, "Concluído — motor de mapas indisponível nesta página, resultado mantido em memória para exportação.", "sucesso");
        }

        secao.querySelector("#configGeoBaseEtlAcoes").style.display = "flex";
        secao.querySelector("#configGeoBaseVersaoInfo").style.display = "flex";
        NexoModal.alert(
          "Dicionário gerado",
          `${stats.municipios} município(s) processado(s). ${stats.lidas.toLocaleString("pt-BR")} linhas lidas, ${stats.aproveitadas.toLocaleString("pt-BR")} aproveitadas, ${stats.pontosUnicos.toLocaleString("pt-BR")} ponto(s) único(s).`,
          "sucesso",
        );
      } catch (e) {
        this._logLinha(logEl, `Erro: ${e.message}`, "erro");
        NexoModal.alert("Erro ao rodar o ETL", e.message, "erro");
      } finally {
        btnRodar.disabled = false;
      }
    });

    secao.querySelector("#configGeoBaseExportarJson")?.addEventListener("click", () => {
      if (!this._etlResultado) return;
      const url = URL.createObjectURL(this._etlResultado);
      const a = document.createElement("a");
      a.href = url;

      a.download = `dicionario_geobase_${_slugUnidadeExport()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  },
};

function _slugUnidadeExport() {
  const nome = (typeof ConfigUnidade !== "undefined" ? (ConfigUnidade.carregar().nome || "") : "").trim() || "unidade";
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
}

function _baixarJSON(dados, nomeArquivo) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function _lerArquivoComoJSON(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      try { resolve(JSON.parse(leitor.result)); }
      catch (_) { reject(new Error("Arquivo inválido — não é um JSON reconhecível.")); }
    };
    leitor.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    leitor.readAsText(arquivo);
  });
}

function _renderExportarImportar() {
  const content = document.getElementById("painelConteudoExportar");
  if (!content) return;

  const unidadePreenchida = typeof ConfigUnidade !== "undefined"
    && ConfigUnidade.carregar().nome
    && ConfigUnidade.carregar().nome !== "Nome da Unidade (exemplo)";
  const equipePreenchida = typeof ConfigEquipe !== "undefined" && ConfigEquipe.carregar().length > 0;
  const temMapEngine = typeof MapEngine !== "undefined" && typeof MapEngine.importarDicionario === "function";
  const temDicionarioParaExportar = !!(typeof GeoBaseConfigUI !== "undefined" && GeoBaseConfigUI._etlResultado);

  content.innerHTML = `
    <div class="config-geral-aviso">
      <i class="fas fa-circle-info"></i>
      Cada instalação do NEXO (navegador/máquina) guarda sua própria configuração — nada aqui é
      sincronizado automaticamente entre colegas. Exportar um bloco só faz sentido depois de
      preenchê-lo na aba correspondente; se você já recebeu um arquivo de um colega, use
      "Importar" em vez de digitar tudo de novo.
    </div>

    <h4 class="config-feriados-titulo"><i class="fas fa-building"></i> Geral</h4>
    ${!unidadePreenchida ? _avisoCritico("A aba Geral ainda parece não estar preenchida (nome padrão de exemplo). Preencha-a antes de exportar, ou importe o arquivo de um colega abaixo.") : ""}
    <div class="config-geral-acoes" style="justify-content:flex-start;">
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expGeralExportar" ${unidadePreenchida ? "" : "disabled"}><i class="fas fa-download"></i> Exportar JSON</button>
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expGeralImportar"><i class="fas fa-upload"></i> Importar JSON</button>
    </div>
    <input type="file" id="expGeralArquivo" accept="application/json" style="display:none" />

    <h4 class="config-feriados-titulo" style="margin-top:20px;"><i class="fas fa-users"></i> Equipe</h4>
    ${!equipePreenchida ? _avisoCritico("O quadro de Equipe ainda está vazio. Cadastre ao menos um analista antes de exportar, ou importe o arquivo de um colega abaixo.") : ""}
    <div class="config-geral-acoes" style="justify-content:flex-start;">
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expEquipeExportar" ${equipePreenchida ? "" : "disabled"}><i class="fas fa-download"></i> Exportar JSON</button>
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expEquipeImportar"><i class="fas fa-upload"></i> Importar JSON</button>
    </div>
    <input type="file" id="expEquipeArquivo" accept="application/json" style="display:none" />

    <h4 class="config-feriados-titulo" style="margin-top:20px;"><i class="fas fa-map-location-dot"></i> Geolocalização — Dicionário GeoBase (coordenadas)</h4>
    <p class="config-geobase-nota">
      O dicionário de coordenadas gerado/importado na aba Geolocalização (página "Geração do dicionário") — não a lista de municípios da área de atuação, que já viaja junto no export "Geral" (ou no "consolidado") abaixo, por já fazer parte da identificação da unidade.
    </p>
    ${!temMapEngine ? _avisoCritico('A importação direta do dicionário não está disponível nesta página. Use "Exportar .json" na aba Geolocalização (página "Geração do dicionário") e, se precisar, importe pela aba Controle.') : ""}
    ${temMapEngine && !temDicionarioParaExportar ? _avisoCritico('Nenhum dicionário pronto para exportar nesta sessão ainda. Gere-o (ETL) na aba Geolocalização (página "Geração do dicionário"), ou importe um no botão "Importar dicionário GeoBase (.json)" abaixo.') : ""}
    <div class="config-geral-acoes" style="justify-content:flex-start;">
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expGeoExportar" ${temDicionarioParaExportar ? "" : "disabled"}><i class="fas fa-download"></i> Exportar dicionário GeoBase (.json)</button>
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expGeoImportar" ${temMapEngine ? "" : "disabled"}><i class="fas fa-upload"></i> Importar dicionário GeoBase (.json)</button>
    </div>
    <input type="file" id="expGeoArquivo" accept="application/json" style="display:none" />

    <h4 class="config-feriados-titulo" style="margin-top:20px;"><i class="fas fa-calendar-days"></i> Planejamento</h4>
    <div class="config-geral-acoes" style="justify-content:flex-start;">
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expPlanExportar"><i class="fas fa-download"></i> Exportar JSON</button>
      <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expPlanImportar"><i class="fas fa-upload"></i> Importar JSON</button>
    </div>
    <input type="file" id="expPlanArquivo" accept="application/json" style="display:none" />

    <div class="config-consolidado">
      <h4 class="config-feriados-titulo">Configuração consolidada</h4>
      <p class="config-geobase-nota">Reúne Geral, Equipe e Planejamento num único arquivo — mais prático para repassar a configuração completa a outro colaborador de uma só vez. O dicionário GeoBase (potencialmente volumoso) permanece tratado separadamente, na aba Geolocalização.</p>
      <div class="config-geral-acoes" style="justify-content:flex-start;">
        <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expConsolidadoExportar" ${unidadePreenchida ? "" : "disabled"}><i class="fas fa-file-zipper"></i> Exportar configuração consolidada</button>
        <button type="button" class="btn-sm interativo nexo-modal-btn-secondary" id="expConsolidadoImportar"><i class="fas fa-file-import"></i> Importar configuração consolidada</button>
      </div>
      <input type="file" id="expConsolidadoArquivo" accept="application/json" style="display:none" />
    </div>
  `;

  content.querySelector("#expGeralExportar").addEventListener("click", () => ConfigUnidade.exportarJSON());
  const inputGeral = content.querySelector("#expGeralArquivo");
  content.querySelector("#expGeralImportar").addEventListener("click", () => inputGeral.click());
  inputGeral.addEventListener("change", async () => {
    const arquivo = inputGeral.files[0];
    if (!arquivo) return;
    try {
      await ConfigUnidade.importarJSON(arquivo);
      _renderDadosUnidade();
      _renderExportarImportar();
      NexoModal.alert("Importado", "Dados da unidade atualizados a partir do arquivo.", "sucesso");
    } catch (e) {
      NexoModal.alert("Erro ao importar", e.message, "erro");
    } finally {
      inputGeral.value = "";
    }
  });

  content.querySelector("#expEquipeExportar").addEventListener("click", () => {
    _baixarJSON({
      tipo: "nexo_config_equipe",
      unidadeNome: ConfigUnidade.carregar().nome,
      analistas: ConfigEquipe.carregar(),
    }, `nexo_config_equipe_${_slugUnidadeExport()}.json`);
  });
  const inputEquipe = content.querySelector("#expEquipeArquivo");
  content.querySelector("#expEquipeImportar").addEventListener("click", () => inputEquipe.click());
  inputEquipe.addEventListener("change", async () => {
    const arquivo = inputEquipe.files[0];
    if (!arquivo) return;
    try {
      const dados = await _lerArquivoComoJSON(arquivo);

      const analistasBrutos = Array.isArray(dados) ? dados : dados?.analistas;
      if (!Array.isArray(analistasBrutos)) throw new Error("formato inesperado — esperado um array de analistas (ou um arquivo com o campo 'analistas').");
      const lista = analistasBrutos.filter((t) => t && typeof t.nome === "string" && t.nome.trim()).map((t) => ({ nome: t.nome, visivel: !!t.visivel }));
      if (!lista.length) throw new Error("nenhum analista com nome válido encontrado no arquivo — item obrigatório ausente.");
      ConfigEquipe.salvar(lista);
      _renderExportarImportar();
      NexoModal.alert("Importado", "Quadro de equipe atualizado a partir do arquivo.", "sucesso");
    } catch (e) {
      NexoModal.alert("Erro ao importar", e.message, "erro");
    } finally {
      inputEquipe.value = "";
    }
  });

  content.querySelector("#expGeoExportar")?.addEventListener("click", () => {
    if (!temDicionarioParaExportar) return;
    const url = URL.createObjectURL(GeoBaseConfigUI._etlResultado);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dicionario_geobase_${_slugUnidadeExport()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  const inputGeo = content.querySelector("#expGeoArquivo");
  content.querySelector("#expGeoImportar")?.addEventListener("click", () => { if (temMapEngine) inputGeo.click(); });
  inputGeo.addEventListener("change", async () => {
    const arquivo = inputGeo.files[0];
    if (!arquivo) return;
    try {
      if (!temMapEngine) throw new Error("A importação direta do dicionário não está disponível nesta página.");
      const resultado = await MapEngine.importarDicionario(arquivo);

      if (typeof GeoBaseConfigUI !== "undefined") GeoBaseConfigUI._etlResultado = arquivo;
      NexoModal.alert("Dicionário importado", `${resultado.municipios} município(s) carregado(s) e armazenado(s) localmente.`, "sucesso");
      _renderExportarImportar();
    } catch (e) {
      NexoModal.alert("Erro ao importar", e.message, "erro");
    } finally {
      inputGeo.value = "";
    }
  });

  content.querySelector("#expPlanExportar").addEventListener("click", () => {
    _baixarJSON({
      tipo: "nexo_config_planejamento",
      unidadeNome: ConfigUnidade.carregar().nome,
      dados: ConfigPlanejamento.carregar(),
    }, `nexo_config_planejamento_${_slugUnidadeExport()}.json`);
  });
  const inputPlan = content.querySelector("#expPlanArquivo");
  content.querySelector("#expPlanImportar").addEventListener("click", () => inputPlan.click());
  inputPlan.addEventListener("change", async () => {
    const arquivo = inputPlan.files[0];
    if (!arquivo) return;
    try {
      const bruto = await _lerArquivoComoJSON(arquivo);

      const dados = (bruto && typeof bruto === "object" && !Array.isArray(bruto) && bruto.tipo === "nexo_config_planejamento")
        ? bruto.dados
        : (bruto && typeof bruto === "object" && !Array.isArray(bruto) && !bruto.tipo)
          ? bruto
          : null;
      if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error("formato inesperado — não corresponde a uma configuração de planejamento reconhecível.");
      ConfigPlanejamento.salvar(dados);
      _renderExportarImportar();
      NexoModal.alert("Importado", "Prazos e feriados atualizados. Recarregue a página para aplicar.", "sucesso");
    } catch (e) {
      NexoModal.alert("Erro ao importar", e.message, "erro");
    } finally {
      inputPlan.value = "";
    }
  });

  content.querySelector("#expConsolidadoExportar").addEventListener("click", () => {
    const dadosUnidade = ConfigUnidade.carregar();
    const consolidado = {
      tipo: "nexo_config_consolidado",
      versao: 1,
      unidadeNome: dadosUnidade.nome,
      unidade: dadosUnidade,
      equipe: (typeof ConfigEquipe !== "undefined" ? ConfigEquipe.carregar() : []),
      planejamento: (typeof ConfigPlanejamento !== "undefined" ? ConfigPlanejamento.carregar() : null),
    };
    _baixarJSON(consolidado, `nexo_config_consolidado_${_slugUnidadeExport()}.json`);
  });
  const inputConsolidado = content.querySelector("#expConsolidadoArquivo");
  content.querySelector("#expConsolidadoImportar").addEventListener("click", () => inputConsolidado.click());
  inputConsolidado.addEventListener("change", async () => {
    const arquivo = inputConsolidado.files[0];
    if (!arquivo) return;
    try {
      const dados = await _lerArquivoComoJSON(arquivo);
      if (!dados || dados.tipo !== "nexo_config_consolidado") {
        throw new Error("Arquivo não corresponde a uma configuração consolidada reconhecível (esperado tipo=nexo_config_consolidado).");
      }
      if (dados.unidade) ConfigUnidade.salvar(dados.unidade);
      if (Array.isArray(dados.equipe) && typeof ConfigEquipe !== "undefined") ConfigEquipe.salvar(dados.equipe);
      if (dados.planejamento && typeof ConfigPlanejamento !== "undefined") ConfigPlanejamento.salvar(dados.planejamento);
      _renderDadosUnidade();
      _renderExportarImportar();
      NexoModal.alert("Configuração importada", "Geral, Equipe e Planejamento atualizados a partir do arquivo consolidado. Recarregue a página para aplicar tudo.", "sucesso");
    } catch (e) {
      NexoModal.alert("Erro ao importar", e.message, "erro");
    } finally {
      inputConsolidado.value = "";
    }
  });
}
