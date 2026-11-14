let _cnpjsRemovidosLote = new Set();

function _confirmar(mensagem, titulo = "Atencao", tipo = "warning", labelSim = "Confirmar", labelNao = "Cancelar") {
  return new Promise((resolve) => {
    const modal = document.getElementById("_nexo-confirm-modal");
    if (!modal) { resolve(window.confirm(mensagem)); return; }

    const icones = {
      warning:  { cls: "fas fa-exclamation-triangle", cor: "#f59e0b" },
      danger:   { cls: "fas fa-times-circle",         cor: "#ef4444" },
      info:     { cls: "fas fa-info-circle",           cor: "#4f46e5" },
      question: { cls: "fas fa-question-circle",       cor: "#8b5cf6" },
    };
    const cfg = icones[tipo] || icones.warning;
    const iconEl  = document.getElementById("_nexo-confirm-icon");
    const titleEl = document.getElementById("_nexo-confirm-title-text");
    const bodyEl  = document.getElementById("_nexo-confirm-body");
    const btnSim  = document.getElementById("_nexo-confirm-sim");
    const btnNao  = document.getElementById("_nexo-confirm-nao");

    iconEl.className    = cfg.cls;
    iconEl.style.color  = cfg.cor;
    titleEl.textContent = titulo;
    bodyEl.textContent  = mensagem;
    btnSim.textContent  = labelSim;
    btnNao.textContent  = labelNao;

    const cores = { warning:"#f59e0b", danger:"#ef4444", info:"#4f46e5", question:"#8b5cf6" };
    btnSim.style.background = cores[tipo] || "#4f46e5";

    const fechar = (res) => { modal.style.display = "none"; resolve(res); };
    btnSim.onclick = () => fechar(true);
    btnNao.onclick = () => fechar(false);
    modal.style.display = "flex";
  });
}

const _TIPOS_SEM_PRAZO = ["cobranca", "notificacao"];

function _atualizarEstadoData() {
  const sel = document.getElementById("selCartaGlobal");
  const inp = document.getElementById("pdfDataLimiteGlobal");
  const container = inp ? inp.closest(".form-group") : null;
  if (!sel || !inp) return;

  const semPrazo = _TIPOS_SEM_PRAZO.includes(sel.value);
  inp.disabled = semPrazo;
  inp.style.opacity = semPrazo ? "0.35" : "1";
  inp.style.cursor = semPrazo ? "not-allowed" : "";
  if (container) container.style.opacity = semPrazo ? "0.5" : "1";
  if (semPrazo) inp.value = "";

  const chkRecibo = document.getElementById("pdfIncluirRecibo");
  if (chkRecibo) chkRecibo.checked = !semPrazo;
}

async function _verificarDataPassada(inputEl) {
  if (!inputEl || !inputEl.value) return;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const sel = new Date(inputEl.value + "T00:00:00");
  if (sel < hoje) {
    const fmt = inputEl.value.split("-").reverse().join("/");
    const ok = await _confirmar(
      `A data selecionada (${fmt}) é anterior à data de hoje.\n\nTem certeza que a data está correta?`,
      "Data no passado",
      "warning",
      "Sim, está correta",
      "Corrigir"
    );
    if (!ok) inputEl.value = "";
  }
}

function _fmtCNPJ(v) {
  const n = String(v || "").replace(/\D/g, "");
  if (n.length !== 14) return v;
  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
}

let dbGlobal = [];
let dbFiltrado = [];
let colunasAtivas = [];
let chavesDisponiveis = [];
let filtrosAtivos = {};
let colunaOrdem = null;
let ordemAscendente = true;
let selectedCNPJs = new Set();
let lastSelectedIndex = -1;
let paginaAtual = 1;
let itensPorPagina = 25;
let _dropdownChave = null;
let _dropdownOpen = false;
let largurasColunas = {};

const COLUNAS_DEFAULT = [
  "CNPJ",
  "RAZAOSOCIAL",
  "CATEGORIA",
  "SITUACAO",
  "ANALISTARESPONSAVEL",
  "PRAZODATA",
  "MUNICIPIO",
];

const DICIONARIO_NOMES = {
  CNPJ: "CNPJ",
  RAZAOSOCIAL: "Razão Social",
  NOMEFANTASIA: "Nome Fantasia",
  CNAE: "CNAE",
  ENDERECO: "Endereço",
  BAIRRO: "Bairro",
  CEP: "CEP",
  MUNICIPIO: "Município",
  UF: "UF",
  LOCALIDADE: "Localidade",
  UNIDADE: "Unidade",
  CICLO: "Ciclo",
  CATEGORIA: "Categoria",
  SITUACAO: "Situação",
  CLIENTENOVO: "Cliente Novo",
  PORTE: "Porte",
  PRIORITARIA: "Prioritária",
  ANALISTARESPONSAVEL: "Analista Responsável",
  ANALISTACONTATO: "Analista de Contato",
  CONTATADA: "Contatada",
  CONTATOINCOMPLETO: "Contato Incompleto",
  CANALCONTATO: "Canal de Contato",
  DATACONTATO: "Data do Contato",
  CANALENVIO: "Canal de Envio",
  STATUSENVIO: "Status do Envio",
  DATAENVIO: "Data de Envio",
  PRAZODIAS: "Prazo (dias)",
  PRAZODATA: "Prazo de Retorno",
  DATARETORNO: "Data de Retorno",
  OC: "OC",
  OCSTATUS: "Status da OC",
  CONTATONOME: "Contato",
  CONTATOTELEFONE: "Telefone",
  CONTATOEMAIL: "E-mail",
  POSSUIEMAIL: "Possui E-mail",
  EMAILINVALIDO: "E-mail Inválido",
  REPRESENTANTENOME: "Representante",
  REPRESENTANTEDOCUMENTO: "Documento do Representante",
};

document.addEventListener("nexo:dados-prontos", () => {
  inicializarMotor();
});

async function inicializarMotor() {
  const csvCru = await StorageManager.lerAsync("nexo_csv_Empresas");
  const tbody = document.getElementById("tbody-visitas");

  if (!csvCru || typeof MotorRegras === "undefined") {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;">
      Sem dados. Sincronize primeiro.</td></tr>`;
    return;
  }

  const baseBruta = MotorRegras.csvParaTabela(csvCru);

  dbGlobal = baseBruta.filter(
    (emp) =>
      emp.CNPJ &&
      !(emp.STATUS && emp.STATUS.toUpperCase().includes("CONCLUIDA")) &&
      !MotorRegras.empresaDeAnalistaOculto(emp),
  );
  dbFiltrado = [...dbGlobal];

  if (dbGlobal.length > 0) {
    chavesDisponiveis = Object.keys(dbGlobal[0]);
    colunasAtivas = [...COLUNAS_DEFAULT];

    popularModalDeColunas();
    renderizarHeader();
    renderizarBody();
    travarLargurasColunas();
  }
}

function travarLargurasColunas() {
  const table = document.getElementById("grid-visitas");
  const ths = document.querySelectorAll("#thead-visitas th");
  ths.forEach((th, i) => {
    const chave = colunasAtivas[i];
    const w = th.offsetWidth;
    if (chave && w) {
      largurasColunas[chave] = w;
      th.style.width = w + "px";
    }
  });
  if (table) table.style.tableLayout = "fixed";
}

function obterNomeColuna(chave) {
  if (DICIONARIO_NOMES[chave]) return DICIONARIO_NOMES[chave];

  if (!chave) return chave;
  return chave.length <= 4 ? chave : chave.charAt(0) + chave.slice(1).toLowerCase();
}

function popularModalDeColunas() {
  const list = document.getElementById("modal-col-list");
  list.innerHTML = "";

  chavesDisponiveis.forEach((chave) => {
    const isChecked = colunasAtivas.includes(chave);

    const div = document.createElement("div");
    div.className = `column-toggle-item ${isChecked ? "" : "disabled"}`;

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = isChecked;

    const span = document.createElement("span");
    span.textContent = obterNomeColuna(chave);

    div.addEventListener("click", (e) => {
      if (e.target !== chk) chk.checked = !chk.checked;
      alternarColuna(chave, div, chk.checked);
    });

    div.appendChild(chk);
    div.appendChild(span);
    list.appendChild(div);
  });
}

function alternarColuna(chave, element, marcado) {
  if (marcado) {
    element.classList.remove("disabled");
    if (!colunasAtivas.includes(chave)) colunasAtivas.push(chave);
  } else {
    element.classList.add("disabled");
    colunasAtivas = colunasAtivas.filter((c) => c !== chave);
  }

  largurasColunas = {};
  const table = document.getElementById("grid-visitas");
  if (table) table.style.tableLayout = "";

  renderizarHeader();
  renderizarBody();
  travarLargurasColunas();
}

function renderizarHeader() {
  const thead = document.getElementById("thead-visitas");
  const tr = document.createElement("tr");

  colunasAtivas.forEach((chave) => {
    const th = document.createElement("th");
    const iconeOrdem =
      colunaOrdem === chave
        ? ordemAscendente
          ? "fa-sort-up"
          : "fa-sort-down"
        : "fa-sort";

    const thContent = document.createElement("div");
    thContent.className = "th-content";
    thContent.addEventListener("click", () => aplicarOrdenacao(chave));

    const span = document.createElement("span");
    span.textContent = obterNomeColuna(chave);

    const icone = document.createElement("i");
    icone.className = `fas ${iconeOrdem}`;

    thContent.appendChild(span);
    thContent.appendChild(icone);

    const filtroAtual = filtrosAtivos[chave];
    const temSet = filtroAtual instanceof Set && filtroAtual.size > 0;
    const temTexto = typeof filtroAtual === "string" && filtroAtual;
    const divFiltro = document.createElement("div");
    divFiltro.className = "col-filter-input col-filter-btn" + (temSet || temTexto ? " ativo" : "");

    const inpFiltro = document.createElement("input");
    inpFiltro.type = "text";
    inpFiltro.className = "filtro-inline";
    inpFiltro.title = "Digite para filtrar rapidamente";
    if (temSet) {
      const n = filtroAtual.size;
      inpFiltro.placeholder = `${n} selecionado${n !== 1 ? "s" : ""}`;
      inpFiltro.value = "";
    } else {
      inpFiltro.placeholder = "Filtrar...";
      inpFiltro.value = temTexto ? filtroAtual : "";
    }

    inpFiltro.addEventListener("input", (e) => {
      if (filtrosAtivos[chave] instanceof Set) delete filtrosAtivos[chave];
      atualizarFiltro(e, chave);
      divFiltro.classList.toggle("ativo", !!e.target.value);
    });
    inpFiltro.addEventListener("click", (e) => e.stopPropagation());

    const icoFiltro = document.createElement("i");
    icoFiltro.className = "fas fa-filter filtro-icon";
    icoFiltro.title = "Busca avançada (selecionar / desmarcar valores)";
    icoFiltro.addEventListener("click", (e) => {
      e.stopPropagation();
      _abrirDropdownFiltro(chave, divFiltro);
    });

    divFiltro.appendChild(inpFiltro);
    divFiltro.appendChild(icoFiltro);

    if (largurasColunas[chave]) th.style.width = largurasColunas[chave] + "px";

    th.appendChild(thContent);
    th.appendChild(divFiltro);
    tr.appendChild(th);
  });

  thead.innerHTML = "";
  thead.appendChild(tr);
}

function renderizarBody() {
  const tbody = document.getElementById("tbody-visitas");
  tbody.innerHTML = "";

  const total = dbFiltrado.length;

  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="${colunasAtivas.length}"
      style="text-align:center;padding:20px;">
      Nenhum resultado para os filtros atuais.</td></tr>`;
    renderizarPaginacao(0, 0, 0);
    return;
  }

  const pp = itensPorPagina === 0 ? total : itensPorPagina;
  const inicio = (paginaAtual - 1) * pp;
  const fim = Math.min(inicio + pp, total);
  const pagina = dbFiltrado.slice(inicio, fim);

  pagina.forEach((emp, i) => {
    const index = inicio + i;
    const tr = document.createElement("tr");
    tr.id = `row-${index}`;

    if (selectedCNPJs.has(emp.CNPJ)) tr.classList.add("selected");

    tr.addEventListener("mousedown", (e) =>
      lidarComCliqueLinha(e, index, emp.CNPJ),
    );

    colunasAtivas.forEach((chave) => {
      const td = document.createElement("td");
      if (chave === "CATEGORIA") td.classList.add("text-info-bold");
      let valor = emp[chave] || "-";
      if (chave === "CNPJ" && valor !== "-") valor = _fmtCNPJ(valor);
      td.innerText = valor;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  renderizarPaginacao(inicio + 1, fim, total);
}

function renderizarPaginacao(de, ate, total) {
  const container = document.getElementById("paginacao-visitas");
  if (!container) return;
  container.innerHTML = "";
  container.style.cssText = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 15px;border-top:1px solid var(--border-color);";

  const OPCOES = [10, 25, 50, 100, 500, 0];
  const LABELS  = ["10","25","50","100","500","Todas"];

  const sel = document.createElement("div");
  sel.style.cssText = "display:flex;align-items:center;gap:4px;font-size:0.82rem;";
  const lbl = document.createElement("span"); lbl.textContent = "Exibir:"; sel.appendChild(lbl);
  OPCOES.forEach((n, idx) => {
    const btn = document.createElement("button");
    btn.textContent = LABELS[idx];
    const ativo = itensPorPagina === n;
    btn.style.cssText = `padding:2px 8px;border-radius:4px;border:1px solid var(--border-color);cursor:pointer;font-size:0.8rem;background:${ativo?"var(--color-primary)":"var(--bg-body)"};color:${ativo?"white":"var(--text-main)"};${ativo?"font-weight:700;":""}`;
    btn.onclick = () => { itensPorPagina = n; paginaAtual = 1; renderizarBody(); };
    sel.appendChild(btn);
  });

  const info = document.createElement("span");
  info.style.cssText = "font-size:0.82rem;color:var(--text-muted);flex:1;text-align:center;white-space:nowrap;";
  info.textContent = total
    ? `Exibindo ${de.toLocaleString("pt-BR")} a ${ate.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} registros`
    : "Nenhum registro";

  container.append(sel, info);

  if (itensPorPagina > 0 && total > itensPorPagina) {
    const totalPags = Math.ceil(total / itensPorPagina);
    const nav = document.createElement("div");
    nav.style.cssText = "display:flex;gap:3px;";
    const addB = (html, pag, disabled, ativo) => {
      const b = document.createElement("button");
      b.innerHTML = html; b.disabled = disabled;
      b.style.cssText = `padding:2px 8px;border-radius:4px;border:1px solid var(--border-color);cursor:${disabled?"default":"pointer"};font-size:0.8rem;background:${ativo?"var(--color-primary)":"var(--bg-body)"};color:${ativo?"white":"var(--text-main)"};opacity:${disabled?"0.4":"1"};`;
      if (!disabled && pag !== null) b.onclick = () => { paginaAtual = pag; renderizarBody(); };
      nav.appendChild(b);
    };
    addB("«", 1, paginaAtual===1, false);
    addB("‹", paginaAtual-1, paginaAtual===1, false);
    const s = Math.max(1, Math.min(paginaAtual-2, totalPags-4));
    const e2 = Math.min(totalPags, s+4);
    for (let p = s; p <= e2; p++) addB(String(p), p, false, p===paginaAtual);
    addB("›", paginaAtual+1, paginaAtual===totalPags, false);
    addB("»", totalPags, paginaAtual===totalPags, false);
    container.appendChild(nav);
  }
}

function lidarComCliqueLinha(evento, index, cnpjClicado) {
  if (evento.shiftKey) evento.preventDefault();
  if (evento.shiftKey && lastSelectedIndex !== -1) {

    const ancoraCNPJ = dbFiltrado[lastSelectedIndex]?.CNPJ;
    const ancoraAtual = ancoraCNPJ
      ? dbFiltrado.findIndex((e) => e.CNPJ === ancoraCNPJ)
      : lastSelectedIndex;
    const inicio = Math.min(ancoraAtual, index);
    const fim = Math.max(ancoraAtual, index);
    for (let i = inicio; i <= fim; i++) {
      selectedCNPJs.add(dbFiltrado[i].CNPJ);
      document.getElementById(`row-${i}`)?.classList.add("selected");
    }
  } else {
    const linhaDOM = document.getElementById(`row-${index}`);
    if (selectedCNPJs.has(cnpjClicado)) {
      selectedCNPJs.delete(cnpjClicado);
      linhaDOM?.classList.remove("selected");
    } else {
      selectedCNPJs.add(cnpjClicado);
      linhaDOM?.classList.add("selected");
    }
    lastSelectedIndex = index;
  }
  _atualizarContadorSelecao();
}

function limparSelecao() {
  selectedCNPJs.clear();
  lastSelectedIndex = -1;
  document
    .querySelectorAll("#grid-visitas tbody tr.selected")
    .forEach((tr) => tr.classList.remove("selected"));
  _atualizarContadorSelecao();
}

function _atualizarContadorSelecao() {
  const badge = document.getElementById("badge-selecao");
  if (!badge) return;
  const n = selectedCNPJs.size;
  if (n === 0) {
    badge.style.display = "none";
  } else {
    badge.style.display = "";
    badge.textContent = `${n} selecionada${n !== 1 ? "s" : ""}`;
  }
}

function openSelecaoModal() {
  if (selectedCNPJs.size === 0) return;
  renderizarSelecaoModal();
  document.getElementById("selecaoModal").style.display = "flex";
}

function closeSelecaoModal() {
  document.getElementById("selecaoModal").style.display = "none";
}

function renderizarSelecaoModal() {
  const lista = document.getElementById("selecaoModalLista");
  if (!lista) return;

  if (selectedCNPJs.size === 0) {
    closeSelecaoModal();
    return;
  }

  const itens = dbGlobal.filter((emp) => selectedCNPJs.has(emp.CNPJ));
  lista.innerHTML = "";

  itens.forEach((emp) => {
    const linha = document.createElement("div");
    linha.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 4px;border-bottom:1px solid var(--border-color);";

    const info = document.createElement("div");
    info.style.cssText = "min-width:0;";

    const nome = document.createElement("div");
    nome.style.cssText =
      "font-weight:600;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    nome.textContent = emp.RAZAOSOCIAL || "Sem Razão Social";

    const cnpjEl = document.createElement("div");
    cnpjEl.style.cssText = "font-size:0.78rem;color:var(--text-muted);";
    cnpjEl.textContent = _fmtCNPJ(emp.CNPJ);

    info.appendChild(nome);
    info.appendChild(cnpjEl);

    const btnRemover = document.createElement("button");
    btnRemover.innerHTML = "&times;";
    btnRemover.title = "Remover esta empresa da seleção";
    btnRemover.style.cssText =
      "background:none;border:none;color:var(--text-muted);cursor:pointer;" +
      "font-size:1.3rem;line-height:1;padding:2px 9px;border-radius:4px;flex-shrink:0;transition:color 0.15s;";
    btnRemover.addEventListener("mouseover", () => { btnRemover.style.color = "var(--color-danger)"; });
    btnRemover.addEventListener("mouseout",  () => { btnRemover.style.color = "var(--text-muted)"; });
    btnRemover.addEventListener("click", () => _removerDaSelecao(emp.CNPJ));

    linha.appendChild(info);
    linha.appendChild(btnRemover);
    lista.appendChild(linha);
  });
}

function _removerDaSelecao(cnpj) {
  selectedCNPJs.delete(cnpj);
  _atualizarContadorSelecao();
  renderizarBody();
  renderizarSelecaoModal();
}

let timerFiltro;

function atualizarFiltro(evento, chave) {
  clearTimeout(timerFiltro);
  filtrosAtivos[chave] = evento.target.value.toUpperCase();
  timerFiltro = setTimeout(() => aplicarTodosOsFiltros(), 300);
}

function aplicarOrdenacao(chave) {
  if (colunaOrdem === chave) {
    ordemAscendente = !ordemAscendente;
  } else {
    colunaOrdem = chave;
    ordemAscendente = true;
  }
  renderizarHeader();
  aplicarTodosOsFiltros();
}

function aplicarTodosOsFiltros() {

  dbFiltrado = dbGlobal.filter((emp) => {
    for (let chave in filtrosAtivos) {
      const filtro = filtrosAtivos[chave];
      if (!filtro) continue;
      if (filtro instanceof Set) {
        if (filtro.size === 0) continue;
        const val = String(emp[chave] || "").trim().toUpperCase();
        if (!filtro.has(val)) return false;
      } else if (typeof filtro === "string" && filtro) {
        if (!(emp[chave] || "").toUpperCase().includes(filtro)) return false;
      }
    }
    return true;
  });

  if (colunaOrdem) {
    dbFiltrado.sort((a, b) => {
      let valA = a[colunaOrdem] || "";
      let valB = b[colunaOrdem] || "";
      if (!isNaN(valA) && !isNaN(valB)) {
        valA = Number(valA);
        valB = Number(valB);
      }
      if (valA < valB) return ordemAscendente ? -1 : 1;
      if (valA > valB) return ordemAscendente ? 1 : -1;
      return 0;
    });
  }

  lastSelectedIndex = -1;
  paginaAtual = 1;
  renderizarBody();
  _atualizarIndicadoresFiltro();
}

function _atualizarIndicadoresFiltro() {
  const temFiltro = Object.values(filtrosAtivos).some((f) =>
    f instanceof Set ? f.size > 0 : !!f,
  );
  const btn = document.getElementById("btnLimparFiltros");
  if (btn) btn.style.display = temFiltro ? "" : "none";
}

function limparTodosFiltros() {
  filtrosAtivos = {};
  const btn = document.getElementById("btnLimparFiltros");
  if (btn) btn.style.display = "none";
  renderizarHeader();
  aplicarTodosOsFiltros();
}

function _abrirDropdownFiltro(chave, anchorEl) {
  const dd = document.getElementById("dropdown-filtro");
  if (!dd) return;
  if (_dropdownChave === chave && _dropdownOpen) { _fecharDropdownFiltro(); return; }
  _fecharDropdownFiltro();

  _dropdownChave = chave;
  _dropdownOpen = true;

  const valoresMap = new Map();
  dbGlobal.forEach((emp) => {
    const v = String(emp[chave] || "").trim();
    const key = v.toUpperCase();
    if (!valoresMap.has(key)) valoresMap.set(key, v || "(Vazio)");
  });
  const valores = Array.from(valoresMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const selecaoAtual = filtrosAtivos[chave] instanceof Set ? filtrosAtivos[chave] : null;
  const todosChecados = !selecaoAtual;

  dd.innerHTML = `
    <div class="ddf-header">
      <span class="ddf-titulo"></span>
      <button class="ddf-fechar" title="Fechar">&times;</button>
    </div>
    <div class="ddf-busca-container">
      <input id="ddf-busca" class="ddf-busca" type="text" placeholder="Pesquisar…">
    </div>
    <label class="ddf-item ddf-todos">
      <input type="checkbox" id="ddf-todos-chk" ${todosChecados ? "checked" : ""}>
      <span>(Selecionar Tudo)</span>
    </label>
    <div class="ddf-lista" id="ddf-lista"></div>
    <div class="ddf-rodape">
      <button class="ddf-btn-aplicar">Aplicar</button>
      <button class="ddf-btn-limpar">Limpar</button>
    </div>`;

  dd.querySelector(".ddf-titulo").textContent = obterNomeColuna(chave);
  dd.querySelector(".ddf-fechar").addEventListener("click", _fecharDropdownFiltro);
  dd.querySelector(".ddf-btn-aplicar").addEventListener("click", _aplicarSelecaoFiltro);
  dd.querySelector(".ddf-btn-limpar").addEventListener("click", _limparFiltroColuna);
  dd.querySelector("#ddf-todos-chk").addEventListener("change", (e) => _toggleTodosDdf(e.target.checked));
  dd.querySelector("#ddf-busca").addEventListener("input", (e) => _filtrarOpcoesDdf(e.target.value));

  const lista = dd.querySelector("#ddf-lista");
  valores.forEach(([key, label]) => {
    const lbl = document.createElement("label");
    lbl.className = "ddf-item";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = todosChecados || selecaoAtual.has(key);
    chk.dataset.key = key;
    chk.addEventListener("change", _sincronizarTodosDdf);

    const sp = document.createElement("span");
    sp.textContent = label;

    lbl.appendChild(chk);
    lbl.appendChild(sp);
    lista.appendChild(lbl);
  });

  dd.style.display = "block";
  const rect = anchorEl.getBoundingClientRect();
  const ddW = 240;
  let left = rect.left;
  if (left + ddW > window.innerWidth - 8) left = window.innerWidth - ddW - 8;
  if (left < 8) left = 8;
  dd.style.left = left + "px";
  dd.style.top = (rect.bottom + 4) + "px";

  setTimeout(() => dd.querySelector("#ddf-busca")?.focus(), 0);
}

function _fecharDropdownFiltro() {
  const dd = document.getElementById("dropdown-filtro");
  if (!dd) return;
  dd.style.display = "none";
  dd.innerHTML = "";
  _dropdownChave = null;
  _dropdownOpen = false;
}

function _filtrarOpcoesDdf(busca) {
  const q = busca.trim().toUpperCase();
  document.querySelectorAll("#ddf-lista .ddf-item").forEach((lbl) => {
    const txt = (lbl.querySelector("span")?.textContent || "").toUpperCase();
    lbl.style.display = q === "" || txt.includes(q) ? "" : "none";
  });
}

function _toggleTodosDdf(checked) {
  document.querySelectorAll("#ddf-lista input[type=checkbox]").forEach((c) => { c.checked = checked; });
}

function _sincronizarTodosDdf() {
  const chks = Array.from(document.querySelectorAll("#ddf-lista input[type=checkbox]"));
  const todosChk = document.getElementById("ddf-todos-chk");
  if (todosChk) todosChk.checked = chks.every((c) => c.checked);
}

function _aplicarSelecaoFiltro() {
  if (!_dropdownChave) return;
  const chks = Array.from(document.querySelectorAll("#ddf-lista input[type=checkbox]"));
  const todosChk = document.getElementById("ddf-todos-chk");

  if (!todosChk || todosChk.checked || chks.every((c) => c.checked)) {
    delete filtrosAtivos[_dropdownChave];
  } else {
    const sel = new Set();
    chks.forEach((c) => { if (c.checked) sel.add(c.dataset.key); });
    if (sel.size > 0) {
      filtrosAtivos[_dropdownChave] = sel;
    } else {
      delete filtrosAtivos[_dropdownChave];
    }
  }

  _fecharDropdownFiltro();
  renderizarHeader();
  aplicarTodosOsFiltros();
}

function _limparFiltroColuna() {
  if (!_dropdownChave) return;
  delete filtrosAtivos[_dropdownChave];
  _fecharDropdownFiltro();
  renderizarHeader();
  aplicarTodosOsFiltros();
}

document.addEventListener("click", (e) => {
  const dd = document.getElementById("dropdown-filtro");
  if (!dd || dd.style.display === "none") return;
  if (!dd.contains(e.target) && !e.target.closest(".col-filter-btn")) {
    _fecharDropdownFiltro();
  }
});

function _abrirDropdownTextoIntel(label, chave, anchorEl, filterState, lblEl, onFilter) {
  const dd = document.getElementById("dropdown-filtro");
  if (!dd) return;
  _fecharDropdownFiltro();

  dd.innerHTML = `
    <div class="ddf-header">
      <span class="ddf-titulo"></span>
      <button class="ddf-fechar" title="Fechar">&times;</button>
    </div>
    <div style="padding:8px 10px 4px;">
      <input id="ddf-intel-inp" class="ddf-busca" type="text" placeholder="Filtrar…">
    </div>
    <div class="ddf-rodape">
      <button class="ddf-btn-aplicar">Aplicar</button>
      <button class="ddf-btn-limpar">Limpar</button>
    </div>`;

  dd.querySelector(".ddf-titulo").textContent = label;

  const inp = dd.querySelector("#ddf-intel-inp");
  inp.value = filterState[chave] || "";

  const aplicar = (val) => {
    if (val) filterState[chave] = val; else delete filterState[chave];
    const ativo = !!val;
    anchorEl.classList.toggle("ativo", ativo);
    if (lblEl.tagName === "INPUT") lblEl.value = ativo ? val : "";
    else lblEl.textContent = ativo ? `"${val.toLowerCase()}"` : "Filtrar...";
    onFilter();
    _fecharDropdownFiltro();
  };

  dd.querySelector(".ddf-fechar").addEventListener("click", _fecharDropdownFiltro);
  dd.querySelector(".ddf-btn-aplicar").addEventListener("click", () => aplicar(inp.value.trim().toUpperCase()));
  dd.querySelector(".ddf-btn-limpar").addEventListener("click", () => aplicar(""));
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") aplicar(inp.value.trim().toUpperCase()); });

  dd.style.display = "block";
  const rect = anchorEl.getBoundingClientRect();
  let left = rect.left;
  if (left + 240 > window.innerWidth - 8) left = window.innerWidth - 248;
  dd.style.left = Math.max(8, left) + "px";
  dd.style.top = (rect.bottom + 4) + "px";
  setTimeout(() => inp.focus(), 0);
}

function _empresasParaExportacaoGrid() {
  return selectedCNPJs.size > 0
    ? dbFiltrado.filter((emp) => selectedCNPJs.has(emp.CNPJ))
    : dbFiltrado;
}

function exportarGridCSV() {
  const empresas = _empresasParaExportacaoGrid();
  if (empresas.length === 0) {
    _notificarUsuario("Nenhum dado para exportar.", "warning");
    return;
  }

  const esc = (v) => {
    const s = String(v == null ? "" : v).replace(/"/g, '""');
    return /[";\n\r]/.test(s) ? `"${s}"` : s;
  };

  const cab = colunasAtivas.map((c) => esc(obterNomeColuna(c)));
  const linhas = empresas.map((emp) =>
    colunasAtivas.map((chave) => {
      let valor = emp[chave] || "";
      if (chave === "CNPJ" && valor) valor = _fmtCNPJ(valor);
      return esc(valor);
    }).join(";")
  );

  const conteudo = "﻿" + [cab.join(";"), ...linhas].join("\r\n");
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });

  const now = new Date();
  const stamp =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` +
    `_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carteira_empresas_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof _notificarUsuario === "function")
    _notificarUsuario(`CSV gerado com ${empresas.length.toLocaleString("pt-BR")} registros.`, "success");
}

function exportarGridPDF() {
  if (!window.jspdf) {
    _notificarUsuario("jsPDF não está disponível.", "error");
    return;
  }
  const empresas = _empresasParaExportacaoGrid();
  if (empresas.length === 0) {
    _notificarUsuario("Nenhum dado para exportar.", "warning");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const margem = 10;
  const pageW = 297;
  const pageH = 210;
  const usableW = pageW - 2 * margem;
  const nCols = colunasAtivas.length;
  const colW = Math.min(45, usableW / Math.max(nCols, 1));
  const startX = margem + (usableW - colW * nCols) / 2;
  const rowH = 6;
  const headerH = 8;

  let y = margem;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Carteira de Empresas | NEXO", margem, y + 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const dd2 = String(now.getDate()).padStart(2, "0");
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  doc.text(
    `Gerado em ${dd2}/${mo}/${now.getFullYear()} ${hh}:${mm}  ·  ${empresas.length.toLocaleString("pt-BR")} registros`,
    margem, y + 10
  );
  doc.setTextColor(0);
  y += 15;

  function desenharCabecalho() {
    doc.setFillColor(30, 41, 59);
    doc.rect(startX, y, colW * nCols, headerH, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    colunasAtivas.forEach((chave, i) => {
      const nome = obterNomeColuna(chave);
      const maxC = Math.max(4, Math.floor(colW / 1.9));
      const txt = nome.length > maxC ? nome.substring(0, maxC - 1) + "…" : nome;
      doc.text(txt, startX + i * colW + 1.5, y + headerH - 2.5);
    });
    doc.setTextColor(0, 0, 0);
    y += headerH;
  }

  desenharCabecalho();
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  empresas.forEach((emp, idx) => {
    if (y + rowH > pageH - margem) {
      doc.addPage();
      y = margem;
      desenharCabecalho();
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, y, colW * nCols, rowH, "F");
    }
    colunasAtivas.forEach((chave, i) => {
      let val = String(emp[chave] || "-");
      if (chave === "CNPJ" && val !== "-") val = _fmtCNPJ(val);
      const maxC = Math.max(4, Math.floor(colW / 1.8));
      if (val.length > maxC) val = val.substring(0, maxC - 1) + "…";
      doc.text(val, startX + i * colW + 1.5, y + rowH - 2);
    });
    y += rowH;
  });

  const totalPags = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Página ${p} / ${totalPags}`, pageW - margem, pageH - 4, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save("carteira-empresas-nexo.pdf");
}

function openColumnModal() {
  document.getElementById("columnModal").style.display = "flex";
}
function closeColumnModal() {
  document.getElementById("columnModal").style.display = "none";
}

function _animarSecao(el, direcao) {
  el.classList.remove("section-slide-left", "section-slide-right");
  void el.offsetWidth;
  el.classList.add(direcao === "left" ? "section-slide-left" : "section-slide-right");
}

function switchMainToggle(section) {
  const btnVisitas = document.getElementById("btn-visitas");
  const btnIntel   = document.getElementById("btn-contatos");

  const direcao = section === "contatos" ? "right" : "left";

  btnVisitas.classList.remove("active");
  btnIntel.classList.remove("active");
  document.getElementById(`btn-${section}`).classList.add("active");

  const secVisitas = document.getElementById("sec-visitas");
  const secIntel   = document.getElementById("sec-contatos");
  const ativa = section === "visitas" ? secVisitas : secIntel;
  const outra = section === "visitas" ? secIntel   : secVisitas;

  outra.style.display = "none";
  ativa.style.display = "block";
  _animarSecao(ativa, direcao);
}

function switchSubToggle(element, targetId) {
  const btns = Array.from(element.parentElement.querySelectorAll(".toggle-btn"));
  const idx  = btns.indexOf(element);

  const direcao = idx === 0 ? "left" : "right";

  btns.forEach((btn) => btn.classList.remove("active"));
  element.classList.add("active");

  ["placeholder-central", "placeholder-cruz1", "placeholder-cruz2"].forEach(
    (id) => (document.getElementById(id).style.display = "none"),
  );
  const alvo = document.getElementById(targetId);
  alvo.style.display = "block";
  _animarSecao(alvo, direcao);
}

function switchModalTab(tab, element) {
  document
    .querySelectorAll(".modal-tab")
    .forEach((t) => t.classList.remove("active"));
  element.classList.add("active");
  document.getElementById("tab-simples").classList.remove("active");
  document.getElementById("tab-avancado").classList.remove("active");
  document.getElementById(`tab-${tab}`).classList.add("active");
}

function obterEmpresasParaExportacao() {
  return dbGlobal.filter((emp) => selectedCNPJs.has(emp.CNPJ));
}

async function abrirLinksRFB() {
  const lista = obterEmpresasParaExportacao();
  if (lista.length === 0) {
    _notificarUsuario("Selecione empresas na Grid primeiro.", "warning");
    return;
  }
  if (lista.length > 5) {
    const ok = await _confirmar(
      `Você está prestes a abrir ${lista.length} abas simultaneamente no navegador.\n\n` +
      `Consultar muitas empresas ao mesmo tempo pode causar travamentos ou bloqueio temporário pelo sistema da Receita Federal.\n\n` +
      `Recomendamos consultar no máximo 5 CNPJs por vez.`,
      `Múltiplas abas (${lista.length})`,
      "warning",
      "Abrir mesmo assim",
      "Cancelar"
    );
    if (!ok) return;
  }

  lista.forEach((emp) => {
    const cnpjLimpo = emp.CNPJ.replace(/[^\d]/g, "");
    window.open(
      `https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp?cnpj=${cnpjLimpo}`,
      "_blank",
    );
  });
}

function mostrarToast(mensagem, tipo = "info") {
  if (typeof _notificarUsuario === "function") {
    _notificarUsuario(mensagem, tipo);
  } else {
    alert(mensagem);
  }
}

function openPdfModal() {
  const selecionadas = obterEmpresasParaExportacao();
  if (selecionadas.length === 0) {
    mostrarToast("Selecione ao menos uma empresa para gerar PDF.", "warning");
    return;
  }

  _cnpjsRemovidosLote.clear();
  document.getElementById("qtd-selecionadas").innerText = selecionadas.length;

  const inpGlobal = document.getElementById("pdfDataLimiteGlobal");
  if (inpGlobal) {
    inpGlobal.value = "";
    inpGlobal.onchange = () => _verificarDataPassada(inpGlobal);
  }
  _atualizarEstadoData();

  const tbody = document.querySelector("#tab-avancado tbody");
  tbody.innerHTML = "";

  const estiloCelula =
    "padding:10px;border-bottom:1px solid var(--border-color);";
  const estiloControle =
    "width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-surface);color:var(--text-main);";

  selecionadas.forEach((emp) => {
    const tr = document.createElement("tr");

    const ci = (emp.CNPJ || "").replace(/\D/g, "");

    const categoriaStr = emp.CATEGORIA || "Desconhecida";
    const padrao = "auto";

    const tdInfo = document.createElement("td");
    tdInfo.style.cssText = `${estiloCelula}font-size:0.9rem;`;
    const nomeForte = document.createElement("strong");
    nomeForte.textContent = emp.RAZAOSOCIAL || "Sem Razão Social";
    const detalhe = document.createElement("span");
    detalhe.style.color = "var(--text-muted)";
    detalhe.textContent = `CNPJ: ${_fmtCNPJ(emp.CNPJ) || "-"} | Categoria: ${categoriaStr}`;
    tdInfo.appendChild(nomeForte);
    tdInfo.appendChild(document.createElement("br"));
    tdInfo.appendChild(detalhe);

    const tdCarta = document.createElement("td");
    tdCarta.style.cssText = estiloCelula;
    const sel = document.createElement("select");
    sel.id = `adv-carta-${ci}`;
    sel.className = "form-control";
    sel.style.cssText = estiloControle;
    [
      ["auto", "Automático"],
      ["CRI", "Crítico · Convite"],
      ["EST", "Estratégico · Convite"],
      ["OPE", "Operacional · Convite"],
    ].forEach(([valor, rotulo]) => {
      const opt = document.createElement("option");
      opt.value = valor;
      opt.textContent = rotulo;
      if (padrao === valor) opt.selected = true;
      sel.appendChild(opt);
    });
    tdCarta.appendChild(sel);

    const tdData = document.createElement("td");
    tdData.style.cssText = estiloCelula;
    const inpData = document.createElement("input");
    inpData.type = "date";
    inpData.id = `adv-data-${ci}`;
    inpData.className = "form-control";
    inpData.style.cssText = estiloControle;
    inpData.addEventListener("change", () => _verificarDataPassada(inpData));
    tdData.appendChild(inpData);

    const tdTermo = document.createElement("td");
    tdTermo.style.cssText = `${estiloCelula}text-align:center;`;
    const chkTermo = document.createElement("input");
    chkTermo.type = "checkbox";
    chkTermo.id = `adv-termo-${ci}`;
    chkTermo.checked = true;
    tdTermo.appendChild(chkTermo);

    const tdRecibo = document.createElement("td");
    tdRecibo.style.cssText = `${estiloCelula}text-align:center;`;
    const chkRecibo = document.createElement("input");
    chkRecibo.type = "checkbox";
    chkRecibo.id = `adv-recibo-${ci}`;
    chkRecibo.checked = true;
    tdRecibo.appendChild(chkRecibo);

    const tdTrash = document.createElement("td");
    tdTrash.style.cssText = `${estiloCelula}text-align:center;width:42px;`;
    const btnTrash = document.createElement("button");
    btnTrash.innerHTML = '<i class="fas fa-trash-alt"></i>';
    btnTrash.title = "Remover desta impressão";
    btnTrash.style.cssText =
      "background:none;border:none;color:var(--text-muted);cursor:pointer;" +
      "font-size:0.85rem;padding:4px 7px;border-radius:4px;transition:color 0.15s;";
    btnTrash.addEventListener("mouseover", () => { btnTrash.style.color = "var(--color-danger)"; });
    btnTrash.addEventListener("mouseout",  () => { btnTrash.style.color = "var(--text-muted)"; });
    btnTrash.addEventListener("click", () => {
      _cnpjsRemovidosLote.add(emp.CNPJ);
      tr.style.transition = "opacity 0.2s";
      tr.style.opacity = "0";
      setTimeout(() => {
        tr.remove();

        const restantes = document.querySelectorAll("#tab-avancado tbody tr").length;
        const el = document.getElementById("qtd-selecionadas");
        if (el) el.innerText = restantes;
      }, 210);
    });
    tdTrash.appendChild(btnTrash);

    tr.append(tdInfo, tdCarta, tdData, tdTermo, tdRecibo, tdTrash);
    tbody.appendChild(tr);
  });

  const modal = document.getElementById("pdfModal");
  modal.style.display = "flex";
}

function closePdfModal() {
  document.getElementById("pdfModal").style.display = "none";
}

async function iniciarGeracao() {
  const modoAvancado = document
    .getElementById("tab-avancado")
    ?.classList.contains("active");

  let config;

  if (modoAvancado) {

    const lista = obterEmpresasParaExportacao().filter(
      (emp) => !_cnpjsRemovidosLote.has(emp.CNPJ),
    );
    const configAvancada = lista.map((emp) => {
      const ci = (emp.CNPJ || "").replace(/\D/g, "");
      const sel = document.getElementById(`adv-carta-${ci}`);
      const inpData = document.getElementById(`adv-data-${ci}`);
      const chkTermo = document.getElementById(`adv-termo-${ci}`);
      const chkRecibo = document.getElementById(`adv-recibo-${ci}`);

      return {
        tipoCarta: sel ? sel.value : "auto",
        dataLimite: inpData ? inpData.value : "",
        incluirTermo: chkTermo ? chkTermo.checked : true,
        incluirRecibo: chkRecibo ? chkRecibo.checked : true,
      };
    });

    const indexSemData = configAvancada.findIndex((c) => !c.dataLimite);
    if (indexSemData !== -1) {
      const empPendente = lista[indexSemData];
      const cnpjPendente = empPendente.CNPJ || `#${indexSemData + 1}`;
      mostrarToast(
        `Atenção: Informe a data limite para o CNPJ ${_fmtCNPJ(cnpjPendente)}.`,
        "warning",
      );

      const ci = (empPendente.CNPJ || "").replace(/\D/g, "");
      const campoPendente = document.getElementById(`adv-data-${ci}`);
      if (campoPendente) {
        campoPendente.focus();
        campoPendente.style.borderColor = "var(--color-warning, #f59e0b)";
        campoPendente.addEventListener(
          "input",
          () => (campoPendente.style.borderColor = ""),
          { once: true },
        );
      }
      return;
    }

    config = {
      tipoCarta: "auto",
      dataLimiteGlobal: "",
      incluirTermo: true,
      incluirRecibo: true,
      configAvancada,
      empresas: lista,
    };
  } else {
    const selCarta = document.querySelector("#tab-simples select");
    const inpDataGlobal = document.getElementById("pdfDataLimiteGlobal");
    const checkboxes = document.querySelectorAll(
      "#tab-simples .checkbox-group input[type='checkbox']",
    );

    const tipoCarta = selCarta ? selCarta.value : "auto";
    const prazoObrigatorio = !_TIPOS_SEM_PRAZO.includes(tipoCarta);

    if (prazoObrigatorio && (!inpDataGlobal || !inpDataGlobal.value)) {
      mostrarToast(
        "Atenção: Defina o Prazo de Resposta (Data Limite) para o lote.",
        "warning",
      );
      return;
    }

    config = {
      tipoCarta,
      dataLimiteGlobal: inpDataGlobal ? inpDataGlobal.value : "",
      incluirTermo: checkboxes[0] ? checkboxes[0].checked : true,
      incluirRecibo: checkboxes[1] ? checkboxes[1].checked : true,
      empresas: obterEmpresasParaExportacao(),
    };
  }

  const btnPdf = document.getElementById("btnGerarPdf");
  if (btnPdf) {
    btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDFs...';
    btnPdf.disabled = true;
  }

  await new Promise((r) => setTimeout(r, 60));

  try {
    if (typeof gerarPDFConsolidado === "function") {
      await gerarPDFConsolidado(config);
    } else {
      mostrarToast("Motor de PDF não carregado.", "error");
    }
  } finally {
    if (btnPdf) {
      btnPdf.innerHTML = '<i class="fas fa-print"></i> Gerar PDF Consolidado';
      btnPdf.disabled = false;
    }
    closePdfModal();
  }
}

function abrirModalKml() {
  const itens = dbGlobal.filter((e) => selectedCNPJs.has(e.CNPJ));
  if (itens.length === 0) {
    mostrarToast("Selecione ao menos uma empresa para gerar o mapa.", "warning");
    return;
  }

  try {
    const salvo = JSON.parse(localStorage.getItem("nexo_prefs_kml") || "null");
    if (salvo) {
      const chks = [
        "chkKmlNomeFantasia","chkKmlCategoria","chkKmlEmpresaNova",
        "chkKmlVip","chkKmlCnae","chkKmlContato",
        "chkKmlTelefone","chkKmlRepresentante","chkKmlStatus","chkKmlOc",
        "chkKmlAnalistas","chkKmlRelatorio",
        "chkStatusVerde","chkStatusAzul","chkStatusAmarelo",
        "chkStatusLaranja","chkStatusRoxo",
      ];
      chks.forEach((id) => {
        const el = document.getElementById(id);
        if (el && salvo[id] !== undefined) el.checked = salvo[id];
      });
      const sel = document.getElementById("selKmlQualidade");
      if (sel && salvo.selKmlQualidade !== undefined) sel.value = salvo.selKmlQualidade;
    }
  } catch (_) {}

  document.getElementById("modalKml").style.display = "flex";
}

function fecharModalKml() {
  document.getElementById("modalKml").style.display = "none";
}

const _KML_STATUS_MAP = {
  chkStatusVerde: "verde",
  chkStatusAzul: "azul",
  chkStatusAmarelo: "amarelo",
  chkStatusLaranja: "laranja",
  chkStatusRoxo: "roxo",
};

function _lerStatusKmlSelecionados() {
  return Object.keys(_KML_STATUS_MAP)
    .filter((id) => {
      const el = document.getElementById(id);
      return el && el.checked;
    })
    .map((id) => _KML_STATUS_MAP[id]);
}

function aplicarPresetKmlStatus(preset) {
  const PRESETS = {
    tudo: ["verde", "azul", "amarelo", "laranja", "roxo"],
    confiavel: ["verde", "azul", "amarelo", "roxo"],
    exato: ["verde", "azul", "roxo"],
    "rev-laranja": ["laranja"],
    "rev-amarelo": ["amarelo", "laranja"],
  };
  const alvo = PRESETS[preset];
  if (!alvo) return;
  Object.entries(_KML_STATUS_MAP).forEach(([id, status]) => {
    const el = document.getElementById(id);
    if (el) el.checked = alvo.includes(status);
  });
}

function marcarKmlStatusCustom() {
  const sel = document.getElementById("selKmlQualidade");
  if (sel) sel.value = "custom";
}

async function executarGeracaoKml() {
  const itens = dbGlobal.filter((e) => selectedCNPJs.has(e.CNPJ));

  const configKml = {
    nomeFantasia: document.getElementById("chkKmlNomeFantasia").checked,
    categoria: document.getElementById("chkKmlCategoria").checked,
    empresaNova: document.getElementById("chkKmlEmpresaNova").checked,
    vip: document.getElementById("chkKmlVip").checked,
    cnae: document.getElementById("chkKmlCnae").checked,
    contato: document.getElementById("chkKmlContato").checked,
    telefone: document.getElementById("chkKmlTelefone").checked,
    representante: document.getElementById("chkKmlRepresentante").checked,
    status: document.getElementById("chkKmlStatus").checked,
    oc: document.getElementById("chkKmlOc").checked,
    analistas: document.getElementById("chkKmlAnalistas").checked,
    gerarRelatorio: document.getElementById("chkKmlRelatorio").checked,
  };

  configKml.statusPermitidos = _lerStatusKmlSelecionados();

  const _qld = document.getElementById("selKmlQualidade").value;

  if (_qld === "rev-laranja" || _qld === "rev-amarelo")
    configKml.gerarRelatorio = true;

  try {
    const prefs = {
      chkKmlNomeFantasia: configKml.nomeFantasia,
      chkKmlCategoria: configKml.categoria,
      chkKmlEmpresaNova: configKml.empresaNova,
      chkKmlVip: configKml.vip,
      chkKmlCnae: configKml.cnae,
      chkKmlContato: configKml.contato,
      chkKmlTelefone: configKml.telefone,
      chkKmlRepresentante: configKml.representante,
      chkKmlStatus: configKml.status,
      chkKmlOc: configKml.oc,
      chkKmlAnalistas: configKml.analistas,
      chkKmlRelatorio: configKml.gerarRelatorio,
      selKmlQualidade: _qld,
      chkStatusVerde: document.getElementById("chkStatusVerde").checked,
      chkStatusAzul: document.getElementById("chkStatusAzul").checked,
      chkStatusAmarelo: document.getElementById("chkStatusAmarelo").checked,
      chkStatusLaranja: document.getElementById("chkStatusLaranja").checked,
      chkStatusRoxo: document.getElementById("chkStatusRoxo").checked,
    };
    localStorage.setItem("nexo_prefs_kml", JSON.stringify(prefs));
  } catch (_) {}

  const btn = document.getElementById("btnExecutarKml");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando Mapa...';
  btn.disabled = true;

  try {

    await MapEngine.gerarKML(itens, configKml);
  } catch (error) {
    console.error(error);
    mostrarToast("Erro ao processar arquivo: " + error.message, "error");
  } finally {
    btn.innerHTML = '<i class="fas fa-download"></i> Gerar e Baixar';
    btn.disabled = false;
    fecharModalKml();
  }
}
