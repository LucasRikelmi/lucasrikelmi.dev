let _rawEmpresas = [];
let _rawOcs = [];
let _rawOcsUnicas = [];
let _rawOcsTransferencia = [];
let _dadosProcessados = null;

let _ddDados = [];
let _ddColunas = [];
let _ddTitulo = "";
let _ddPagina = 1;
let _ddFiltrosColuna = {};
let _ddOrdemCol = null;
let _ddOrdemDir = null;
let _ddPP = 25;
let _ddTipo = null;
let _ddColunasAll = [];
let _ddColPadrao = [];
let _ddDragCol = null;
let _ddLargurasColunas = {};

function _preservarScrollSubview(fn) {
  const wrap = document.getElementById("subview-wrapper");
  const scrollAntes = wrap ? wrap.scrollTop : 0;
  fn();
  if (wrap) requestAnimationFrame(() => { wrap.scrollTop = scrollAntes; });
}

const _KPI_FILTROS_LS_KEY = "nexo_kpi_filtros_particulares";

const _KPI_FILTROS_PADRAO = {
  trabalho: {
    compostos: {
      contatada: true, agendada: true, estendida: true, prazoVencido: true,
      lembrete: true, formalizada: true, ocs: true, respondida: true,
    },
  },
  respostaOc: { modo: "ambos" },
  associacao: { tipo: "ambos", inverter: false },
};

const _KPI_TRABALHO_COMP_LABELS = {
  contatada: "Contatada", agendada: "Agendada", estendida: "Prazo Estendido",
  prazoVencido: "Prazo Vencido", lembrete: "Lembrete Enviado", formalizada: "Formalizada",
  ocs: "OCs Efetivas", respondida: "Respondida",
};

function _carregarKpiFiltros() {
  try {
    const salvos = JSON.parse(localStorage.getItem(_KPI_FILTROS_LS_KEY) || "null");
    if (salvos && typeof salvos === "object") {

      const out = {};
      Object.keys(_KPI_FILTROS_PADRAO).forEach((k) => {
        out[k] = { ..._KPI_FILTROS_PADRAO[k], ...(salvos[k] || {}) };
      });
      return out;
    }
  } catch (_) {}
  return JSON.parse(JSON.stringify(_KPI_FILTROS_PADRAO));
}

function _salvarKpiFiltros(filtros) {
  try { localStorage.setItem(_KPI_FILTROS_LS_KEY, JSON.stringify(filtros)); } catch (_) {}
}

function _ddChaveLS(tipo) { return "nexo_dd_cols_" + tipo; }

function _ddRestaurarColunas(tipo, disponiveis, padrao) {
  try {
    const salvas = JSON.parse(localStorage.getItem(_ddChaveLS(tipo)) || "null");
    if (Array.isArray(salvas)) {
      const filt = salvas.filter((c) => disponiveis.includes(c));
      if (filt.length) return filt;
    }
  } catch (_) {}
  return padrao.filter((c) => disponiveis.includes(c));
}

function _ddSalvarColunas() {
  if (_ddTipo) {
    try { localStorage.setItem(_ddChaveLS(_ddTipo), JSON.stringify(_ddColunas)); } catch (_) {}
  }
}

function _ddAbrirModalColunas() {
  if (!_ddTipo || !_ddColunasAll.length) return;
  let modal = document.getElementById("_dd-col-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "_dd-col-modal";
    modal.className = "modal-overlay";
    modal.style.display = "none";
    modal.innerHTML = `<div class="modal-content" style="max-width:560px;">
      <div class="modal-header"><h3><i class="fas fa-columns" style="color:var(--color-primary)"></i> Colunas exibidas</h3>
      <button class="btn-icon" id="_dd-col-close"><i class="fas fa-times"></i></button></div>
      <p class="text-muted" style="margin-bottom:12px;">Marque as colunas e arraste no cabeçalho para reordenar. A escolha fica salva neste navegador.</p>
      <div class="column-toggle-list" id="_dd-col-list"></div>
      <div style="margin-top:20px; display:flex; justify-content:space-between; gap:10px;">
        <button id="_dd-col-reset" style="padding:10px 16px; background:var(--bg-body); border:1px solid var(--border-color); color:var(--text-main); border-radius:5px; cursor:pointer;">Restaurar padrão</button>
        <button id="_dd-col-apply" style="padding:10px 20px; background:var(--color-primary); color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Aplicar e Fechar</button>
      </div></div>`;
    document.body.appendChild(modal);
    modal.querySelector("#_dd-col-close").onclick = () => { modal.style.display = "none"; };
    modal.addEventListener("mousedown", (e) => { if (e.target === modal) modal.style.display = "none"; });
  }

  const ativas = _ddColunas.filter((c) => _ddColunasAll.includes(c));
  const ordem = [...ativas, ..._ddColunasAll.filter((c) => !ativas.includes(c))];

  const list = modal.querySelector("#_dd-col-list");
  list.innerHTML = "";
  ordem.forEach((chave) => {
    const on = _ddColunas.includes(chave);
    const item = document.createElement("div");
    item.className = "column-toggle-item" + (on ? "" : " disabled");
    item.dataset.chave = chave;
    const chk = document.createElement("input");
    chk.type = "checkbox"; chk.checked = on;
    const span = document.createElement("span");
    span.textContent = _ddNomeColuna(chave);
    item.addEventListener("click", (e) => {
      if (e.target !== chk) chk.checked = !chk.checked;
      item.classList.toggle("disabled", !chk.checked);
    });
    item.append(chk, span);
    list.appendChild(item);
  });

  const aplicar = (novas) => {
    if (!novas.length) { if (typeof _notificarUsuario === "function") _notificarUsuario("Selecione ao menos uma coluna.", "warning"); return; }
    _ddColunas = novas;
    _ddSalvarColunas();
    modal.style.display = "none";
    _ddPagina = 1;

    _ddLargurasColunas = {};
    const tabela = document.getElementById("drilldown-table");
    if (tabela) tabela.style.tableLayout = "";
    _ddRenderHeader(_ddColunas);
    _ddRenderizarPagina();
    _ddTravarLargurasColunas();
  };

  const btnApply = modal.querySelector("#_dd-col-apply");
  btnApply.onclick = () => {
    const novas = Array.from(list.querySelectorAll(".column-toggle-item"))
      .filter((it) => it.querySelector("input").checked)
      .map((it) => it.dataset.chave);
    aplicar(novas);
  };
  modal.querySelector("#_dd-col-reset").onclick = () => {
    try { localStorage.removeItem(_ddChaveLS(_ddTipo)); } catch (_) {}
    aplicar(_ddColPadrao.filter((c) => _ddColunasAll.includes(c)));
  };

  modal.style.display = "flex";
}

document.addEventListener("nexo:dados-prontos", async () => {
  Chart.register(ChartDataLabels);

  const dados = await MotorRegras.processar();
  if (!dados) {
    NexoModal.alert("Dados não encontrados", "Sincronize os dados antes de acessar o Dashboard.", "aviso")
      .then(() => { window.location.href = "sincronizacao.html"; });
    return;
  }

  if (!MotorRegras.equipeAtiva || MotorRegras.equipeAtiva.length === 0) {
    NexoModal.alert(
      "Equipe não configurada",
      "O Dashboard organiza os indicadores por analista e nenhum analista está cadastrado. Acesse o ícone de Configurações, no rodapé da barra lateral, aba Equipe, e cadastre o quadro de analistas antes de continuar.",
      "aviso",
    );
    return;
  }

  _dadosProcessados = dados;

  const equipe = [...MotorRegras.equipeAtiva];

  const _rotuloTecMap = {};
  MotorRegras.rotulosEquipe(equipe).forEach((r, i) => { _rotuloTecMap[equipe[i]] = r; });

  const equipeFunil = MotorRegras.equipeComDados(dados);

  let compAtivos = {
    contatada: true,
    agendada: true,
    estendida: true,
    prazoVencido: true,
    lembrete: true,
    formalizada: true,
    ocs: true,
    respondida: true,
  };
  let tecsAtivos = Array(equipe.length).fill(true);

  const _kpiFiltrosParticulares = _carregarKpiFiltros();

  window.chartBar = null;
  window.chartPizza = null;
  let isHorizontal = true;
  let hoveredLabelIdx = null;

  const getTextColor = () =>
    document.body.classList.contains("dark-mode") ? "#f8fafc" : "#1e293b";
  const getGridColor = () =>
    document.body.classList.contains("dark-mode")
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.08)";
  const getHoverColor = () =>
    document.body.classList.contains("dark-mode") ? "#818cf8" : "#4f46e5";

  const _csvEmp = await StorageManager.lerAsync("nexo_csv_Empresas");
  const _csvOc = await StorageManager.lerAsync("nexo_csv_Ocs");
  const _csvOcTransf = await StorageManager.lerAsync("nexo_csv_OcsTransferencia");
  _rawEmpresas = _csvEmp ? FileProcessor.csvParaTabela(_csvEmp) : [];
  _rawOcs     = _csvOc ? FileProcessor.csvParaTabela(_csvOc) : [];
  _rawOcsUnicas = MotorRegras.ocsUnicas(_rawOcs);

  _rawOcsTransferencia = _csvOcTransf
    ? FileProcessor.csvParaTabela(_csvOcTransf).filter((r) => String(r.RAZAOSOCIAL || "").trim() !== "")
    : [];

  renderizarKPIs(dados);
  renderizarTabelas(dados);
  _configurarPopoversKPI(dados);
  iniciarGraficoBarras();
  renderizarGraficoPizza();

  document.querySelectorAll(".comp-item").forEach((item) => {
    item.addEventListener("click", function () {
      const comp = this.getAttribute("data-comp");
      compAtivos[comp] = !compAtivos[comp];
      this.classList.toggle("inativo", !compAtivos[comp]);
      atualizarDadosGrafico();
    });
  });

  document.getElementById("btnInverterEixo").addEventListener("click", () => {
    isHorizontal = !isHorizontal;
    hoveredLabelIdx = null;
    if (chartBar) chartBar.destroy();
    iniciarGraficoBarras();
  });

  document.getElementById("btnResetAnalistas").addEventListener("click", () => {
    tecsAtivos = Array(equipe.length).fill(true);
    hoveredLabelIdx = null;
    atualizarDadosGrafico();
    renderizarChipsOcultos();
  });

  function iniciarGraficoBarras() {
    const canvas = document.getElementById("chartTrabalhoAnalista");
    const ctx = canvas.getContext("2d");

    const gridLogic = {
      drawTicks: true,
      tickLength: 6,
      tickColor: () => getGridColor(),
      color: (ctx) =>
        ctx.tick.value % 10 === 0 ? getGridColor() : "transparent",
    };

    const tickLogicValores = {
      color: () => getTextColor(),
      stepSize: 5,
      maxRotation: 0,
      minRotation: 0,
      callback: function (v) {
        return v % 10 === 0 ? v + "%" : "";
      },
    };

    const scaleOptions = {
      x: {
        grid: isHorizontal ? gridLogic : { display: false },
        ticks: isHorizontal
          ? tickLogicValores
          : {
              color: (ctx) =>
                ctx.index === hoveredLabelIdx
                  ? getHoverColor()
                  : getTextColor(),
              font: { weight: "bold" },
              maxRotation: 0,
              minRotation: 0,
            },
        max: isHorizontal ? 100 : undefined,
        beginAtZero: true,
      },
      y: {
        grid: !isHorizontal ? gridLogic : { display: false },
        ticks: !isHorizontal
          ? tickLogicValores
          : {
              color: (ctx) =>
                ctx.index === hoveredLabelIdx
                  ? getHoverColor()
                  : getTextColor(),
              font: { weight: "bold" },
              maxRotation: 0,
              minRotation: 0,
            },
        max: !isHorizontal ? 100 : undefined,
        beginAtZero: true,
      },
    };

    const COR_BASE = "#1e3a8a";
    const COR_OVERPERFORM = "#2f4fae";
    const BORDA_OVERPERFORM = "#60a5fa";

    chartBar = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            valoresReais: [],
            backgroundColor: (ctx) => {
              const real = ctx.dataset.valoresReais?.[ctx.dataIndex] ?? 0;
              return real > 100 ? COR_OVERPERFORM : COR_BASE;
            },
            borderColor: (ctx) => {
              const real = ctx.dataset.valoresReais?.[ctx.dataIndex] ?? 0;
              return real > 100 ? BORDA_OVERPERFORM : "transparent";
            },
            borderWidth: (ctx) => {
              const real = ctx.dataset.valoresReais?.[ctx.dataIndex] ?? 0;
              return real > 100 ? 2 : 0;
            },
            maxBarThickness: 60,
          },
        ],
      },
      options: {
        indexAxis: isHorizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: false,

        layout: { padding: { top: isHorizontal ? 0 : 28 } },
        scales: scaleOptions,
        plugins: {
          legend: { display: false },
          datalabels: {
            color: (ctx) => {
              let val = ctx.dataset.data[ctx.dataIndex];
              if (val < 12) return getTextColor();
              return isHorizontal ? "#fff" : getTextColor();
            },
            anchor: "end",
            align: (ctx) => {
              let val = ctx.dataset.data[ctx.dataIndex];
              if (val < 12) return "end";
              return isHorizontal ? "start" : "end";
            },
            offset: (ctx) => (ctx.dataset.data[ctx.dataIndex] < 12 ? 4 : 8),
            font: (ctx) => {
              const real = ctx.dataset.valoresReais?.[ctx.dataIndex] ?? 0;
              return real > 100 ? { weight: "700" } : {};
            },
            formatter: (v, ctx) => {
              const real = ctx.dataset.valoresReais?.[ctx.dataIndex] ?? v;
              if (real <= 0) return "";
              return real > 100 ? `${real.toFixed(1)}%` : v.toFixed(1) + "%";
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                let idx = context.dataset.origIndices[context.dataIndex];
                let nomeReal = equipe[idx];
                let emp = dados.empresas[nomeReal];
                let oc = dados.ocs[nomeReal];

                let valorAbsoluto = 0;
                if (compAtivos.contatada) valorAbsoluto += emp.contatada;
                if (compAtivos.agendada) valorAbsoluto += emp.agendada;
                if (compAtivos.estendida) valorAbsoluto += emp.estendida;
                if (compAtivos.prazoVencido) valorAbsoluto += emp.prazoVencido;
                if (compAtivos.lembrete) valorAbsoluto += emp.lembrete;
                if (compAtivos.formalizada) valorAbsoluto += emp.formalizada;
                if (compAtivos.ocs) valorAbsoluto += oc.concTotal;
                if (compAtivos.respondida) valorAbsoluto += emp.respondida;

                const real = context.dataset.valoresReais[context.dataIndex];
                const sufixo = real > 100 ? " — Superou a meta" : "";
                return ` ${real.toFixed(1)}% | ${valorAbsoluto} Unidades${sufixo}`;
              },
            },
          },
        },
      },
    });

    canvas.onclick = function (evt) {
      if (!chartBar) return;
      const rect = canvas.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      let idx = null;

      const elements = chartBar.getElementsAtEventForMode(
        evt,
        "nearest",
        { intersect: true },
        true,
      );
      if (elements.length > 0) {
        idx = elements[0].index;
      } else {
        if (isHorizontal && x <= chartBar.chartArea.left) {
          let val = chartBar.scales.y.getValueForPixel(y);
          if (val >= 0 && val < chartBar.data.labels.length) idx = val;
        } else if (!isHorizontal && y >= chartBar.chartArea.bottom) {
          let val = chartBar.scales.x.getValueForPixel(x);
          if (val >= 0 && val < chartBar.data.labels.length) idx = val;
        }
      }

      if (idx !== null && idx >= 0 && idx < chartBar.data.labels.length) {
        let originalIndex = chartBar.data.datasets[0].origIndices[idx];
        tecsAtivos[originalIndex] = false;
        hoveredLabelIdx = null;
        canvas.style.cursor = "default";
        atualizarDadosGrafico();
        renderizarChipsOcultos();
      }
    };

    canvas.onmousemove = function (evt) {
      if (!chartBar) return;
      const rect = canvas.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      let isPointer = false;
      let newHoveredIdx = null;

      const elements = chartBar.getElementsAtEventForMode(
        evt,
        "nearest",
        { intersect: true },
        true,
      );
      if (elements.length > 0) {
        isPointer = true;
      } else {
        if (isHorizontal && x <= chartBar.chartArea.left) {
          let val = chartBar.scales.y.getValueForPixel(y);
          if (val >= 0 && val < chartBar.data.labels.length) {
            isPointer = true;
            newHoveredIdx = val;
          }
        } else if (!isHorizontal && y >= chartBar.chartArea.bottom) {
          let val = chartBar.scales.x.getValueForPixel(x);
          if (val >= 0 && val < chartBar.data.labels.length) {
            isPointer = true;
            newHoveredIdx = val;
          }
        }
      }

      canvas.style.cursor = isPointer ? "pointer" : "default";

      if (hoveredLabelIdx !== newHoveredIdx) {
        hoveredLabelIdx = newHoveredIdx;
        chartBar.update("none");
      }
    };

    canvas.onmouseout = function () {
      if (hoveredLabelIdx !== null) {
        hoveredLabelIdx = null;
        if (chartBar) chartBar.update("none");
      }
    };

    atualizarDadosGrafico();
  }

  function atualizarDadosGrafico() {
    let labels = [],
      valoresPlot = [],
      valoresReais = [],
      origIndices = [];
    const rotulos = MotorRegras.rotulosEquipe(equipe);
    equipe.forEach((tec, i) => {
      if (!tecsAtivos[i]) return;
      let e = dados.empresas[tec],
        f = dados.ocs[tec];
      let soma = 0;
      if (compAtivos.contatada) soma += e.contatada;
      if (compAtivos.agendada) soma += e.agendada;
      if (compAtivos.estendida) soma += e.estendida;
      if (compAtivos.prazoVencido) soma += e.prazoVencido;
      if (compAtivos.lembrete) soma += e.lembrete;
      if (compAtivos.formalizada) soma += e.formalizada;
      if (compAtivos.ocs) soma += f.concTotal;
      if (compAtivos.respondida) soma += e.respondida;

      const real = (soma / (e.total || 1)) * 100;
      labels.push(rotulos[i]);
      valoresReais.push(real);
      valoresPlot.push(Math.min(real, 100));
      origIndices.push(i);
    });
    chartBar.data.labels = labels;
    chartBar.data.datasets[0].data = valoresPlot;
    chartBar.data.datasets[0].valoresReais = valoresReais;
    chartBar.data.datasets[0].origIndices = origIndices;
    chartBar.update();

    document.getElementById("btnResetAnalistas").style.visibility =
      tecsAtivos.includes(false) ? "visible" : "hidden";
  }

  function renderizarChipsOcultos() {
    const container = document.getElementById("hiddenAnalistasContainer");
    container.innerHTML = "";
    equipe.forEach((tec, i) => {
      if (!tecsAtivos[i]) {
        const chip = document.createElement("div");
        chip.className = "hidden-tec-chip";
        chip.title = "Clique para devolver ao gráfico";
        chip.innerHTML = `<i class="fas fa-eye-slash"></i> ${escapeHTML(_rotuloTecMap[tec] || tec)}`;
        chip.onclick = () => {
          tecsAtivos[i] = true;
          atualizarDadosGrafico();
          renderizarChipsOcultos();
        };
        container.appendChild(chip);
      }
    });
  }

  function renderizarGraficoPizza() {
    const ctx = document
      .getElementById("chartFinalizadasPendente")
      .getContext("2d");
    const sel = document.getElementById("filterGeral");
    sel.innerHTML = '<option value="GERAL">Visão Geral</option>';
    equipe.forEach(
      (t) =>
        (sel.innerHTML += `<option value="${escapeHTML(t)}">${escapeHTML(_rotuloTecMap[t] || t)}</option>`),
    );

    const update = (tec) => {
      let f = 0,
        p = 0;
      const lista = tec === "GERAL" ? equipe : [tec];
      lista.forEach((t) => {
        let ent = dados.empresas[t].respondida + dados.ocs[t].concEfetiva;
        f += ent;
        p += dados.empresas[t].total - ent;
      });

      if (window.chartPizza) window.chartPizza.destroy();

      window.chartPizza = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Finalizadas", "Pendentes"],
          datasets: [
            {
              data: [f, Math.max(0, p)],
              backgroundColor: ["#10b981", "#64748b"],
              borderWidth: 2,

              borderColor: getTextColor() === "#f8fafc" ? "#1e293b" : "#ffffff",

              offset: f < p ? [20, 0] : [0, 20],
            },
          ],
        },
        options: {
          cutout: "55%",

          layout: { padding: { top: 55, bottom: 5, left: 34, right: 34 } },
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                usePointStyle: true,
                padding: 15,

                generateLabels: function (chart) {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length) {
                    return data.labels.map((label, i) => {
                      const meta = chart.getDatasetMeta(0);
                      const style = meta.controller.getStyle(i);

                      const isHidden = !chart.getDataVisibility(i);

                      return {
                        text: label,
                        fillStyle: style.backgroundColor,
                        strokeStyle: style.borderColor,
                        lineWidth: style.borderWidth,
                        hidden: isHidden,
                        index: i,

                        fontColor: isHidden ? "#ef4444" : getTextColor(),
                      };
                    });
                  }
                  return [];
                },
              },
            },
            datalabels: {
              display: true,
              font: { weight: "bold", size: 13 },
              formatter: (value, ctx) => {
                let total = ctx.chart.getDatasetMeta(0).total;
                if (total === 0) return "";
                let percentage = ((value / total) * 100).toFixed(1) + "%";
                return percentage;
              },
              color: (ctx) => {
                let total = ctx.chart.getDatasetMeta(0).total;
                if (total === 0) return "#ffffff";
                let value = ctx.dataset.data[ctx.dataIndex];
                return value / total < 0.2 ? getTextColor() : "#ffffff";
              },
              anchor: (ctx) => {
                let total = ctx.chart.getDatasetMeta(0).total;
                if (total === 0) return "center";
                let value = ctx.dataset.data[ctx.dataIndex];
                return value / total < 0.2 ? "end" : "center";
              },
              align: (ctx) => {
                let total = ctx.chart.getDatasetMeta(0).total;
                if (total === 0) return "center";
                let value = ctx.dataset.data[ctx.dataIndex];
                return value / total < 0.2 ? "end" : "center";
              },
              offset: (ctx) => {
                let total = ctx.chart.getDatasetMeta(0).total;
                if (total === 0) return 0;
                let value = ctx.dataset.data[ctx.dataIndex];
                return value / total < 0.2 ? 12 : 0;
              },
            },
            tooltip: {
              padding: 12,
              callbacks: {
                label: function (context) {
                  let total = context.chart.getDatasetMeta(0).total;
                  let value = context.parsed;
                  let percentage = ((value / total) * 100).toFixed(1) + "%";
                  return ` ${percentage} | ${value} Unidades`;
                },
                afterLabel: function (context) {
                  if (context.label === "Finalizadas") {
                    return ["", "Respondidas + OCs Efetivas"];
                  } else {

                    return [
                      "",
                      "Casos ativos aguardando",
                      "ação da Meridiano ou resposta",
                      "do contato.",
                    ];
                  }
                },
              },
            },
          },
        },
      });
    };
    update("GERAL");
    sel.addEventListener("change", (e) => {
      const tec = e.target.value;
      const titleEl = document.getElementById("pizzaChartTitle");
      if (titleEl) titleEl.textContent = tec === "GERAL" ? "Unidade" : "Analista";
      update(tec);
    });
  }

  function renderizarKPIs(dados) {

    let eAbs = 0, cAbs = 0, aAbs = 0, asAbs = 0, asRepresentanteAbs = 0, asGrupoAbs = 0;
    equipeFunil.forEach((t) => {
      const emp = dados.empresas[t];
      if (!emp) return;
      eAbs += emp.total;
      cAbs += emp.respondida;
      aAbs += emp.prazoVencido;
      asAbs += emp.associadas;
      asRepresentanteAbs += emp.associadasRepresentante || 0;
      asGrupoAbs += emp.associadasGrupo || 0;
    });

    let e = 0,
      c = 0,
      a = 0,
      f = 0,
      fd = 0;

    const compTrab = _kpiFiltrosParticulares.trabalho.compostos;
    let trAjustado = 0;
    equipe.forEach((t) => {
      let emp = dados.empresas[t],
        oc = dados.ocs[t];
      e += emp.total;
      c += emp.respondida;
      a += emp.prazoVencido;
      f += oc.concTotal;
      fd += oc.concEfetiva;
      if (compTrab.contatada) trAjustado += emp.contatada;
      if (compTrab.agendada) trAjustado += emp.agendada;
      if (compTrab.estendida) trAjustado += emp.estendida;
      if (compTrab.prazoVencido) trAjustado += emp.prazoVencido;
      if (compTrab.lembrete) trAjustado += emp.lembrete;
      if (compTrab.formalizada) trAjustado += emp.formalizada;
      if (compTrab.ocs) trAjustado += oc.concEfetiva;
      if (compTrab.respondida) trAjustado += emp.respondida;
    });
    const div = e || 1;
    document.getElementById("kpiTotal").innerText = eAbs;
    document.getElementById("kpiRespondidas").innerText = cAbs;
    document.getElementById("kpiAtraso").innerText = aAbs;
    document.getElementById("kpiOcs").innerText = f;

    const kf = _kpiFiltrosParticulares;

    let percTrab = ((trAjustado / div) * 100).toFixed(1);

    const numColOc =
      kf.respostaOc.modo === "somenteRespostas" ? c :
      kf.respostaOc.modo === "somenteOcs" ? fd :
      c + fd;
    let percColOc = ((numColOc / div) * 100).toFixed(1);

    let percAtraso = ((a / div) * 100).toFixed(1);

    const baseUniverso = eAbs || 1;
    const numAssoc =
      kf.associacao.tipo === "representante" ? asRepresentanteAbs :
      kf.associacao.tipo === "grupo" ? asGrupoAbs :
      asAbs;
    const percAssocBase = kf.associacao.inverter
      ? (baseUniverso - numAssoc) / baseUniverso
      : numAssoc / baseUniverso;
    let percAssoc = (percAssocBase * 100).toFixed(1);

    document.getElementById("kpiPercTrabalho").innerText = percTrab + "%";
    document.getElementById("barTrabalho").style.width = Math.min(100, percTrab) + "%";

    document.getElementById("kpiPercRespostaOc").innerText = percColOc + "%";
    document.getElementById("barRespostaOc").style.width = Math.min(100, percColOc) + "%";

    document.getElementById("kpiPercAtraso").innerText = percAtraso + "%";
    document.getElementById("barAtraso").style.width = Math.min(100, percAtraso) + "%";

    document.getElementById("kpiPercAssocLabel").textContent =
      kf.associacao.inverter ? "% Não Associação" : "% Associação";
    document.getElementById("kpiPercAssoc").innerText = percAssoc + "%";
    document.getElementById("barAssoc").style.width = Math.min(100, percAssoc) + "%";
  }

  function _filtroEhPadrao(chave) {
    const st = _kpiFiltrosParticulares[chave];
    if (!st) return true;
    if (chave === "trabalho") {
      return Object.keys(_KPI_FILTROS_PADRAO.trabalho.compostos).every((k) => !!st.compostos[k]);
    }
    if (chave === "respostaOc") {
      return st.modo === "ambos";
    }
    if (chave === "associacao") {
      return st.tipo === "ambos" && !st.inverter;
    }
    return JSON.stringify(st) === JSON.stringify(_KPI_FILTROS_PADRAO[chave]);
  }
  function _atualizarIndicadorFiltro(chave) {
    const dot = document.querySelector(`.kpi-filtro-dot[data-kpi-dot="${chave}"]`);
    if (dot) dot.classList.toggle("ativo", !_filtroEhPadrao(chave));
  }

  function _configurarPopoversKPI(dadosAtual) {
    const botoes = document.querySelectorAll(".kpi-config-btn[data-kpi]");

    const fecharTodos = () => {
      document.querySelectorAll(".kpi-config-popover.aberto").forEach((p) => p.classList.remove("aberto"));
      botoes.forEach((b) => b.classList.remove("ativo"));
    };

    const aplicar = (chave) => {
      _salvarKpiFiltros(_kpiFiltrosParticulares);
      renderizarKPIs(dadosAtual);
      _atualizarIndicadorFiltro(chave);
    };

    const MONTADORES = {

      trabalho: (popover, chave) => {
        const comp = _kpiFiltrosParticulares[chave].compostos;
        popover.innerHTML = `<fieldset class="kpi-grupo">
          <legend>% Trabalho Realizado — Composto por</legend>` +
          Object.keys(_KPI_TRABALHO_COMP_LABELS).map((k) => `
            <label>
              <input type="checkbox" data-comp-key="${k}" ${comp[k] ? "checked" : ""}>
              <span>${_KPI_TRABALHO_COMP_LABELS[k]}</span>
            </label>`).join("") + `</fieldset>`;
        popover.querySelectorAll("input[data-comp-key]").forEach((chk) => {
          chk.addEventListener("change", () => {
            comp[chk.dataset.compKey] = chk.checked;
            aplicar(chave);
          });
        });
      },

      respostaOc: (popover, chave) => {
        const st = _kpiFiltrosParticulares[chave];
        const opcoes = [
          { v: "ambos", l: "Respostas + OCs Efetivas (padrão)" },
          { v: "somenteRespostas", l: "Não considerar OCs efetivas (somente Respostas)" },
          { v: "somenteOcs", l: "Não considerar Respondidas (somente OCs efetivas)" },
        ];
        popover.innerHTML = `<fieldset class="kpi-grupo">
          <legend>% Resposta + OC</legend>` +
          opcoes.map((op) => `
            <label>
              <input type="radio" name="_kpi-respostaOc-modo" value="${op.v}" ${st.modo === op.v ? "checked" : ""}>
              <span>${op.l}</span>
            </label>`).join("") + `</fieldset>`;
        popover.querySelectorAll('input[name="_kpi-respostaOc-modo"]').forEach((rad) => {
          rad.addEventListener("change", () => { st.modo = rad.value; aplicar(chave); });
        });
      },

      associacao: (popover, chave) => {
        const st = _kpiFiltrosParticulares[chave];
        const modos = [
          { v: "assoc", l: "% Associação (padrão)" },
          { v: "naoAssoc", l: "% Não Associação (Empresa)" },
        ];
        const tipos = [
          { v: "ambos", l: "Representante + Grupo Empresarial (padrão)" },
          { v: "representante", l: "Somente Representante" },
          { v: "grupo", l: "Somente Grupo Empresarial" },
        ];
        popover.innerHTML = `<fieldset class="kpi-grupo">
          <legend>% Associação — sentido</legend>` +
          modos.map((op) => `
            <label>
              <input type="radio" name="_kpi-assoc-modo" value="${op.v}" ${(st.inverter ? "naoAssoc" : "assoc") === op.v ? "checked" : ""}>
              <span>${op.l}</span>
            </label>`).join("") + `</fieldset>
          <fieldset class="kpi-grupo">
          <legend>Vínculo considerado</legend>` +
          tipos.map((op) => `
            <label>
              <input type="radio" name="_kpi-assoc-tipo" value="${op.v}" ${st.tipo === op.v ? "checked" : ""}>
              <span>${op.l}</span>
            </label>`).join("") + `</fieldset>`;
        popover.querySelectorAll('input[name="_kpi-assoc-modo"]').forEach((rad) => {
          rad.addEventListener("change", () => { st.inverter = rad.value === "naoAssoc"; aplicar(chave); });
        });
        popover.querySelectorAll('input[name="_kpi-assoc-tipo"]').forEach((rad) => {
          rad.addEventListener("change", () => { st.tipo = rad.value; aplicar(chave); });
        });
      },
    };

    botoes.forEach((btn) => {
      const chave = btn.dataset.kpi;
      const montar = MONTADORES[chave];
      const popover = document.querySelector(`.kpi-config-popover[data-kpi-popover="${chave}"]`);
      if (!montar || !popover) return;

      montar(popover, chave);
      _atualizarIndicadorFiltro(chave);

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const jaAberto = popover.classList.contains("aberto");
        fecharTodos();
        if (!jaAberto) { popover.classList.add("aberto"); btn.classList.add("ativo"); }
      });
      popover.addEventListener("click", (e) => e.stopPropagation());
    });

    document.addEventListener("click", fecharTodos);
  }

  function renderizarTabelas(dados) {
    const funil = document.querySelector("#gridFunil tbody"),
      fa = document.querySelector("#gridOcs tbody"),
      q = document.querySelector("#gridPercentuais tbody");
    funil.innerHTML = "";
    fa.innerHTML = "";
    q.innerHTML = "";

    const rotulosPorNome = {};
    MotorRegras.rotulosEquipe(equipe).forEach((rotulo, i) => { rotulosPorNome[equipe[i]] = rotulo; });

    equipeFunil.forEach((t) => {
      let emp = dados.empresas[t],
        oc = dados.ocs[t],
        nome = rotulosPorNome[t] || t;

      funil.innerHTML += `<tr>
                <td class="text-left font-bold-name">${escapeHTML(nome)}</td>
                <td>${emp.total}</td>
                <td>${emp.semContato}</td>
                <td>${emp.contatoEmAndamento || 0}</td>
                <td>${emp.contatada}</td>
                <td>${emp.agendada}</td>
                <td class="text-danger-bold">${emp.prazoVencido}</td>
                <td>${emp.estendida}</td>
                <td>${emp.lembrete}</td>
                <td>${emp.formalizada}</td>
                <td class="text-success-bold">${emp.respondida}</td>
            </tr>`;
    });

    equipe.forEach((t) => {
      let emp = dados.empresas[t],
        oc = dados.ocs[t],
        nome = rotulosPorNome[t];

      fa.innerHTML += `<tr>
                <td class="text-left font-bold-name">${escapeHTML(nome)}</td>
                <td>${oc.iniciada}</td>
                <td>${oc.analise}</td>
                <td class="text-danger-bold">${oc.rejeitada}</td>
                <td class="text-success-bold">${oc.concTotal}</td>
            </tr>`;

      let tr =
        emp.contatada +
        emp.agendada +
        emp.estendida +
        emp.prazoVencido +
        emp.lembrete +
        emp.formalizada +
        oc.concEfetiva +
        emp.respondida;

      q.innerHTML += `<tr>
                <td class="text-left font-bold-name">${escapeHTML(nome)}</td>
                <td>${((tr / (emp.total || 1)) * 100).toFixed(1)}%</td>
                <td class="text-danger-bold">${((emp.prazoVencido / (emp.total || 1)) * 100).toFixed(1)}%</td>
                <td class="text-success-bold">${(((emp.respondida + oc.concEfetiva) / (emp.total || 1)) * 100).toFixed(1)}%</td>
                <td>${((emp.associadas / (emp.total || 1)) * 100).toFixed(1)}%</td>
            </tr>`;
    });
  }
});

const _DD_COLS_EMP = [
  "CNPJ", "RAZAOSOCIAL", "CATEGORIA",
  "SITUACAO", "STATUS",
  "ANALISTARESPONSAVEL",
  "ANALISTACONTATO",
  "DATAENVIO",
];
const _DD_COLS_OC = [
  "CNPJ", "OC", "STATUS", "CATEGORIADESTINO",
  "ABERTAPOR", "ATUALIZADAEM", "RAZAOSOCIAL",
];

const _DD_COLS_NOWRAP = new Set([
  "CNPJ", "SITUACAO", "STATUS",
  "DATAENVIO", "DATARETORNO", "PRAZODATA", "DIASATRASO",
]);

const _DD_NOMES = {
  CNPJ: "CNPJ",
  RAZAOSOCIAL: "Razão Social",
  CATEGORIA: "Categoria",
  SITUACAO: "Status",
  STATUS: "Status",
  ANALISTARESPONSAVEL: "Analista Resp.",
  ANALISTACONTATO: "Analista Contato",
  DATAENVIO: "Data Entrega",
  DATARETORNO: "Data Devolução",
  PRAZODATA: "Prazo Final Agendado",
  DIASATRASO: "Dias em Atraso",
  CNAE: "CNAE",
  OC: "OC",
  CATEGORIADESTINO: "Categoria destino",
  ABERTAPOR: "Aberta por",
  ATUALIZADAEM: "Atualizada em",
};

const _OC_DESCRICOES = CatalogoOcorrencias.CODIGOS;
const _OC_CODIGOS = CatalogoOcorrencias.ordenados();

const _CORES_ANALISTAS = {
  André: "#6366f1", Felipe: "#f59e0b", Juliana: "#ec4899",
  Lucas: "#4f46e5", Marina: "#10b981", Otávio: "#ef4444",
};

let _svCharts = [];

window.atualizarRotulosSubCharts = function () {
  const cor = _corRotuloChart(), corSec = _corRotuloChartSec(), peso = _pesoRotuloChart();
  _svCharts.forEach((c) => {
    if (!c || !c.options) return;
    const sc = c.options.scales;
    if (sc) {
      if (sc.x && sc.x.ticks) { sc.x.ticks.color = corSec; sc.x.ticks.font = { ...(sc.x.ticks.font || {}), weight: peso }; }
      if (sc.y && sc.y.ticks) { sc.y.ticks.color = cor;    sc.y.ticks.font = { ...(sc.y.ticks.font || {}), weight: peso }; }
    }
    const lg = c.options.plugins && c.options.plugins.legend;
    if (lg && lg.labels) { lg.labels.color = cor; lg.labels.font = { ...(lg.labels.font || {}), weight: peso }; }
    try { c.update("none"); } catch (_) {}
  });
};

let _ddOcMetrica = "total";
let _ddTotalAnalista = "todos";
let _ddTotalPagerIdx = 0;
let _ddBaseLinhas = [];
let _ddFiltroTec  = "todos";
let _ddFiltroBusca = "";

function _ddNomeColuna(chave) {
  return _DD_NOMES[chave] || chave;
}

function _ddColunasDisponiveis(preferidas, amostra) {
  if (!amostra || amostra.length === 0) return [];
  const chaves = Object.keys(amostra[0]);
  return preferidas.filter((c) => chaves.includes(c));
}

function _ddColsComData(linhas, dataCol, ...extras) {
  const base = _DD_COLS_EMP.map((c) => (c === "DATAENVIO" ? dataCol : c));
  const amostra = linhas.length ? linhas : _rawEmpresas;
  return _ddColunasDisponiveis([...base, ...extras], amostra);
}

function _carimbarDiasAtraso(linhas) {
  const campoData = _encontrarCampo(linhas.length ? linhas : _rawEmpresas, "PRAZODATA", "DATAENVIO");
  if (!campoData) return;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeMs = hoje.getTime();
  linhas.forEach((r) => {
    const ms = _parseDataMs(r[campoData]);
    if (!isFinite(ms) || ms === -Infinity) { r.DIASATRASO = ""; return; }
    const dias = Math.floor((hojeMs - ms) / 86400000);
    r.DIASATRASO = dias > 0 ? String(dias) : "0";
  });
}

function _ddStatusKey(amostra) {
  if (!amostra || amostra.length === 0) return null;
  const chaves = Object.keys(amostra[0]);
  return chaves.find((k) => k === "SITUACAO")
    || chaves.find((k) => k === "STATUS")
    || null;
}

function _encontrarCampo(amostra, ...candidatos) {
  if (!amostra || amostra.length === 0) return null;
  const chaves = Object.keys(amostra[0]);
  for (const c of candidatos) {
    const f = chaves.find((k) => k === c || k.startsWith(c));
    if (f) return f;
  }
  return null;
}

function _parseDataMs(v) {
  const s = String(v || "").trim();
  if (!s) return -Infinity;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  const t = Date.parse(s);
  return isNaN(t) ? -Infinity : t;
}

function _corAnalista(nome) {
  if (!nome) return "#94a3b8";
  for (const [k, v] of Object.entries(_CORES_ANALISTAS)) {
    if (String(nome).toUpperCase().includes(k.toUpperCase())) return v;
  }

  let h = 0;
  const s = String(nome);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 50%)`;
}

function voltarDashboard() {
  _svCharts.forEach((c) => { try { c.destroy(); } catch (_) {} });
  _svCharts = [];
  document.getElementById("subview-wrapper").style.display = "none";
  document.getElementById("dash-main").style.display = "";
  const fixo = document.getElementById("drilldown-thead-fixo");
  if (fixo) fixo.style.display = "none";
}

let _ddHeaderFixoInit = false;

function _ddInitHeaderFixoListeners() {
  if (_ddHeaderFixoInit) return;
  _ddHeaderFixoInit = true;
  const wrapper = document.getElementById("subview-wrapper");
  const scrollDiv = document.getElementById("drilldown-scroll");
  if (wrapper) wrapper.addEventListener("scroll", () => _ddSyncHeaderFixo(), { passive: true });
  if (scrollDiv) scrollDiv.addEventListener("scroll", _ddSyncHeaderFixoScrollX, { passive: true });
  window.addEventListener("resize", () => _ddSyncHeaderFixo(true));
}

function _ddSyncHeaderFixo(rebuild) {
  const wrapper = document.getElementById("subview-wrapper");
  const scrollDiv = document.getElementById("drilldown-scroll");
  const tabela = document.getElementById("drilldown-table");
  const theadOriginal = document.getElementById("drilldown-thead");
  const fixo = document.getElementById("drilldown-thead-fixo");
  const trTit = theadOriginal && theadOriginal.querySelector("tr:first-child");
  if (!wrapper || wrapper.style.display === "none" || !trTit || !tabela) {
    if (fixo) fixo.style.display = "none";
    return;
  }

  const wrapperRect = wrapper.getBoundingClientRect();
  const titRect = trTit.getBoundingClientRect();
  const tabelaRect = tabela.getBoundingClientRect();

  const deveMostrar = titRect.top < wrapperRect.top - 1 && tabelaRect.bottom > wrapperRect.top + 20;

  if (!deveMostrar) {
    if (fixo) fixo.style.display = "none";
    return;
  }

  if (rebuild || fixo.style.display === "none" || !fixo.dataset.colsHash) {
    _ddClonarHeaderFixo(trTit);
  }

  const scrollRect = scrollDiv.getBoundingClientRect();
  fixo.style.display = "block";
  fixo.style.top = wrapperRect.top + "px";
  fixo.style.left = scrollRect.left + "px";
  fixo.style.width = scrollDiv.clientWidth + "px";
  fixo.style.height = titRect.height + "px";
  _ddSyncHeaderFixoScrollX();
}

function _ddSyncHeaderFixoScrollX() {
  const scrollDiv = document.getElementById("drilldown-scroll");
  const tabela = document.getElementById("drilldown-table");
  const inner = document.getElementById("drilldown-thead-fixo-inner");
  if (!scrollDiv || !tabela || !inner || !inner.closest("table")) return;
  const innerTable = inner.closest("table");
  innerTable.style.marginLeft = (-scrollDiv.scrollLeft) + "px";
  innerTable.style.width = tabela.offsetWidth + "px";
}

function _ddClonarHeaderFixo(trTit) {
  const fixo = document.getElementById("drilldown-thead-fixo");
  const inner = document.getElementById("drilldown-thead-fixo-inner");
  if (!fixo || !inner) return;
  inner.innerHTML = "";
  const trClone = trTit.cloneNode(true);
  inner.appendChild(trClone);

  const thsOrig = trTit.querySelectorAll("th");
  const thsClone = trClone.querySelectorAll("th");
  thsOrig.forEach((thO, i) => {
    const thC = thsClone[i];
    if (!thC) return;
    const w = thO.getBoundingClientRect().width;
    thC.style.width = w + "px";
    thC.style.minWidth = w + "px";
    thC.style.maxWidth = w + "px";
    thC.draggable = false;
    thC.addEventListener("click", () => thO.click());
  });
  fixo.dataset.colsHash = String(thsOrig.length);
}

function _rampaCores(n, hue) {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const l = n === 1 ? 42 : 34 + (i / (n - 1)) * 34;
    return `hsl(${hue}, 65%, ${l.toFixed(1)}%)`;
  });
}

function _ehModoEscuro() { return document.body.classList.contains("dark-mode"); }
function _corRotuloChart() { return _ehModoEscuro() ? "#f1f5f9" : "#334155"; }
function _corRotuloChartSec() { return _ehModoEscuro() ? "#cbd5e1" : "#64748b"; }
function _pesoRotuloChart() { return _ehModoEscuro() ? "700" : "500"; }

function _chartBarra(canvas, labels, dados, titulo, horizontal, coresOverride) {
  if (!window.Chart) return null;
  const cores = coresOverride || labels.map((l) => _corAnalista(l));
  return new Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data: dados, backgroundColor: cores, borderRadius: 5 }] },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: horizontal ? 36 : 8, top: horizontal ? 4 : 24 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end", align: horizontal ? "right" : "top",
          color: (ctx) => cores[ctx.dataIndex] || _corRotuloChart(),
          font: { size: 12, weight: "700" },
          formatter: (v) => (v > 0 ? v : null),
        },
      },
      scales: {
        x: {
          display: !horizontal,
          grid: { display: false },
          ticks: { color: _corRotuloChartSec(), font: { size: 10, weight: _pesoRotuloChart() } },
        },
        y: {
          grid: { display: false },
          ticks: { color: _corRotuloChart(), font: { size: 12, weight: _pesoRotuloChart() }, padding: horizontal ? 6 : 2 },
        },
      },
    },
  });
}

function _chartPizza(canvas, labels, dados, titulo) {
  if (!window.Chart) return null;
  const cores = labels.map((l) => _corAnalista(l));
  const total = dados.reduce((s, v) => s + v, 0);
  return new Chart(canvas, {
    type: "pie",
    data: { labels, datasets: [{ data: dados, backgroundColor: cores, borderWidth: 2, borderColor: "var(--bg-surface)" }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 8 },
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: _corRotuloChart(), font: { size: 12, weight: _pesoRotuloChart() }, padding: 12,
            generateLabels: (chart) => chart.data.labels.map((lbl, i) => ({
              text: `${lbl}  —  ${dados[i]} (${total ? Math.round(dados[i]/total*100) : 0}%)`,
              fillStyle: cores[i], strokeStyle: "transparent", hidden: false, index: i,
              fontColor: _corRotuloChart(),
            })),
          },
        },
        datalabels: { display: false },
      },
    },
  });
}

function _chartVazio(canvas, msg) {
  const host = canvas.parentElement;
  if (host) {
    host.innerHTML =
      `<div style="display:flex;align-items:center;justify-content:center;height:100%;` +
      `color:var(--text-muted);font-size:0.9rem;text-align:center;padding:20px;">` +
      `<span><i class="fas fa-inbox" style="display:block;font-size:1.7rem;margin-bottom:8px;opacity:0.5;"></i>` +
      `${msg || "Sem dados para este filtro."}</span></div>`;
  }
  return null;
}

function _criarChartPager(container, paginas, idxInicial, onChange) {
  let idx = Math.min(Math.max(idxInicial || 0, 0), paginas.length - 1);
  let inst = null;

  const card = document.createElement("div");
  card.className = "sv-pager";

  const head = document.createElement("div");
  head.className = "sv-pager-head";

  const titleWrap = document.createElement("div");
  titleWrap.className = "sv-pager-titlewrap";
  const titleEl = document.createElement("h3");
  titleEl.className = "sv-pager-title";
  const subEl = document.createElement("div");
  subEl.className = "sv-pager-sub";
  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(subEl);
  head.appendChild(titleWrap);

  const nav = document.createElement("div");
  nav.className = "sv-pager-nav";
  const prev = document.createElement("button");
  prev.className = "sv-pager-arrow";
  prev.title = "Gráfico anterior";
  prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
  const dots = document.createElement("div");
  dots.className = "sv-pager-dots";
  const next = document.createElement("button");
  next.className = "sv-pager-arrow";
  next.title = "Próximo gráfico";
  next.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nav.appendChild(prev); nav.appendChild(dots); nav.appendChild(next);
  if (paginas.length > 1) head.appendChild(nav);

  const controlsRow = document.createElement("div");
  controlsRow.className = "sv-pager-controls";

  const body = document.createElement("div");
  body.className = "sv-pager-body";

  card.appendChild(head);
  card.appendChild(controlsRow);
  card.appendChild(body);
  container.appendChild(card);

  paginas.forEach((_, i) => {
    const d = document.createElement("button");
    d.className = "sv-pager-dot";
    d.title = `Gráfico ${i + 1}`;
    d.onclick = () => go(i);
    dots.appendChild(d);
  });

  function destroyInst() {
    if (inst) {
      const k = _svCharts.indexOf(inst);
      if (k > -1) _svCharts.splice(k, 1);
      try { inst.destroy(); } catch (_) {}
      inst = null;
    }
  }

  function drawCurrent() {
    destroyInst();
    const pg = paginas[idx];
    body.innerHTML = "";
    const inner = document.createElement("div");
    inner.style.cssText = `position:relative; height:${pg.altura || 280}px;`;
    const canvas = document.createElement("canvas");
    inner.appendChild(canvas);
    body.appendChild(inner);
    inst = pg.render(canvas);
    if (inst) _svCharts.push(inst);
  }

  function renderControls() {
    controlsRow.innerHTML = "";
    const pg = paginas[idx];
    if (pg.controles) {
      const c = pg.controles(() => drawCurrent());
      if (c) controlsRow.appendChild(c);
    }
    controlsRow.style.display = controlsRow.children.length ? "flex" : "none";
  }

  function syncHead() {
    const pg = paginas[idx];
    titleEl.textContent = pg.titulo || "";
    subEl.textContent = pg.subtitulo || "";
    subEl.style.display = pg.subtitulo ? "" : "none";
    prev.disabled = idx === 0;
    next.disabled = idx === paginas.length - 1;
    Array.from(dots.children).forEach((d, i) => d.classList.toggle("active", i === idx));
  }

  function go(i) {
    if (i < 0 || i >= paginas.length) return;
    idx = i;
    syncHead();
    renderControls();
    drawCurrent();
    if (onChange) onChange(idx);
  }

  prev.onclick = () => go(idx - 1);
  next.onclick = () => go(idx + 1);

  go(idx);
  return { el: card, rerender: drawCurrent, go, get idx() { return idx; } };
}

function _pillGroup(itens, getAtivo, onPick) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex; flex-wrap:wrap; gap:6px;";
  itens.forEach(({ id, label, tip }) => {
    const b = document.createElement("button");
    b.className = "sv-pill" + (id === getAtivo() ? " active" : "");
    b.textContent = label;
    if (tip) b.title = tip;
    b.onclick = () => {
      onPick(id);
      wrap.querySelectorAll(".sv-pill").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    };
    wrap.appendChild(b);
  });
  return wrap;
}

function _pillGroups(grupos, getAtivo, onPick) {
  const col = document.createElement("div");
  col.style.cssText = "display:flex; flex-direction:column; gap:8px; width:100%;";
  grupos.forEach((itens) => {
    if (!itens.length) return;
    const row = document.createElement("div");
    row.style.cssText = "display:flex; flex-wrap:wrap; gap:6px;";
    itens.forEach(({ id, label, tip }) => {
      const b = document.createElement("button");
      b.className = "sv-pill" + (id === getAtivo() ? " active" : "");
      b.textContent = label;
      if (tip) b.title = tip;
      b.onclick = () => {
        onPick(id);
        col.querySelectorAll(".sv-pill").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      };
      row.appendChild(b);
    });
    col.appendChild(row);
  });
  return col;
}

function _contarPorAnalista(linhas, campoNome) {
  const equipe = MotorRegras.equipeAtiva;
  const contagem = {};
  equipe.forEach((t) => { contagem[t] = 0; });
  linhas.forEach((r) => {
    const nome = String(r[campoNome] || "").trim();
    const tec = equipe.find((t) => nome.toUpperCase().includes(t.toUpperCase()));
    if (tec) contagem[tec]++;
  });

  const nomesComDados = equipe.filter((t) => contagem[t] > 0).sort((a, b) => contagem[b] - contagem[a]);
  const dados = nomesComDados.map((t) => contagem[t]);

  const rotulosPorNome = {};
  MotorRegras.rotulosEquipe(equipe).forEach((rotulo, i) => { rotulosPorNome[equipe[i]] = rotulo; });
  const labels = nomesComDados.map((t) => rotulosPorNome[t] || t);
  return { labels, dados };
}

function _getOcCod(r)      { return MotorRegras.codigoOc(r) || "??"; }
function _isEfetiva(r) { return MotorRegras.ocEfetiva(r); }
function _ocAnalista(oc)   { return MotorRegras.analistaDaOc(oc); }
function _ocConcluida(oc) { return MotorRegras.ocConcluida(oc); }

function _buildFiltroEmpresa(svChartsEl, baseLinhas, campoTec, onFiltro) {
  const equipe = MotorRegras.equipeAtiva;
  const bar = document.createElement("div");
  bar.id = "sv-filtro-bar";
  bar.style.cssText = "width:100%; margin-bottom:14px; display:flex; flex-wrap:wrap; align-items:center; gap:10px;";

  if (campoTec) {
    const lbl = document.createElement("span");
    lbl.style.cssText = "font-size:0.82rem; color:var(--text-muted); white-space:nowrap;";
    lbl.textContent = "Filtrar Análise:";
    const sel = document.createElement("select");
    sel.id = "sv-sel-tec";
    sel.style.cssText = "padding:4px 8px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-surface); color:var(--text-main); font-size:0.82rem;";
    [{ val: "todos", lbl: "Visão Geral (Unidade)" }, ...equipe.map((t) => ({ val: t, lbl: t }))].forEach(({ val, lbl: l }) => {
      const opt = document.createElement("option"); opt.value = val; opt.textContent = l; sel.appendChild(opt);
    });
    sel.value = _ddFiltroTec;
    sel.onchange = () => { _ddFiltroTec = sel.value; _preservarScrollSubview(onFiltro); };
    bar.appendChild(lbl);
    bar.appendChild(sel);
  }

  svChartsEl.appendChild(bar);
}

function _aplicarFiltrosEmpresa(baseLinhas, campoTec) {
  const campoRaz = _encontrarCampo(baseLinhas.length ? baseLinhas : _rawEmpresas, "RAZAOSOCIAL", "NOME", "CNPJ");
  let result = [...baseLinhas];

  if (_ddFiltroTec !== "todos") {
    result = result.filter((r) => MotorRegras.analistaDaEmpresa(r) === _ddFiltroTec);
  }
  if (_ddFiltroBusca && campoRaz) {
    const q = _ddFiltroBusca.toUpperCase();
    result = result.filter((r) => String(r[campoRaz] || "").toUpperCase().includes(q) || String(r["CNPJ"] || "").includes(q));
  }
  return result;
}

function _buildRespondidas(baseLinhas) {

  _buildEmpresaPager(baseLinhas, "Respondidas por Analista", "barra", {
    rampaHue: 145,
    extraPages: ({ getFiltradas }) => {
      if (!_dadosProcessados) return [];
      return [
        {
          titulo: "% da Carteira Respondida",
          subtitulo: "Respondidas ÷ total do analista",
          altura: 280,
          render: (canvas) => _chartPercCarteira(canvas),
        },
        {
          titulo: "Respondida vs. Esperada por Categoria",
          subtitulo: "Respondidas ÷ total de empresas de cada categoria",
          altura: 280,
          render: (canvas) => _chartRespostaPorCategoria(canvas, getFiltradas),
        },
      ];
    },
  });
}

function _chartRespostaPorCategoria(canvas, getFiltradas) {
  if (!window.Chart) return _chartVazio(canvas);

  const respondidas = getFiltradas();
  const campoCat = _encontrarCampo(respondidas.length ? respondidas : _rawEmpresas, "CATEGORIA");
  if (!campoCat) return _chartVazio(canvas);

  let universo = _rawEmpresas;
  if (_ddFiltroTec && _ddFiltroTec !== "todos") {
    universo = universo.filter((r) => MotorRegras.analistaDaEmpresa(r) === _ddFiltroTec);
  }

  const totalPorCategoria = {}, respostaPorCategoria = {};
  universo.forEach((r) => {
    const p = String(r[campoCat] || "").trim().toUpperCase() || "—";
    totalPorCategoria[p] = (totalPorCategoria[p] || 0) + 1;
  });
  respondidas.forEach((r) => {
    const p = String(r[campoCat] || "").trim().toUpperCase() || "—";
    respostaPorCategoria[p] = (respostaPorCategoria[p] || 0) + 1;
  });

  const categorias = Object.keys(totalPorCategoria).sort((a, b) => totalPorCategoria[b] - totalPorCategoria[a]);
  if (!categorias.length) return _chartVazio(canvas);

  const dadosRespondida = categorias.map((p) => respostaPorCategoria[p] || 0);
  const dadosEsperada = categorias.map((p) => totalPorCategoria[p]);

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: categorias,
      datasets: [
        { label: "Respondida", data: dadosRespondida, backgroundColor: "#10b981", borderRadius: 5 },
        { label: "Quantidade Final Esperada", data: dadosEsperada, backgroundColor: "#94a3b8", borderRadius: 5 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { color: _corRotuloChart(), font: { size: 11, weight: _pesoRotuloChart() }, boxWidth: 12 } },
        datalabels: {
          anchor: "end", align: "top",
          color: _corRotuloChart(),
          font: { size: 11, weight: "700" },
          formatter: (v) => (v > 0 ? v : null),
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: _corRotuloChart(), font: { size: 12, weight: _pesoRotuloChart() } } },
        y: { grid: { display: false }, beginAtZero: true, ticks: { color: _corRotuloChartSec(), font: { weight: _pesoRotuloChart() }, precision: 0 } },
      },
    },
  });
}

function _chartPercCarteira(canvas) {
  if (!window.Chart || !_dadosProcessados) return _chartVazio(canvas);
  const linhas = MotorRegras.equipeAtiva
    .map((t) => {
      const e = _dadosProcessados.empresas[t] || {};
      const total = e.total || 0;
      return { t, perc: total ? (e.respondida / total) * 100 : 0, total };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.perc - a.perc);
  if (!linhas.length) return _chartVazio(canvas);

  const rotulosPorNome = {};
  MotorRegras.rotulosEquipe(MotorRegras.equipeAtiva).forEach((r, i) => { rotulosPorNome[MotorRegras.equipeAtiva[i]] = r; });
  const labels = linhas.map((x) => rotulosPorNome[x.t] || x.t);
  const dados = linhas.map((x) => +x.perc.toFixed(1));
  const cores = linhas.map((x) => _corAnalista(x.t));
  return new Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data: dados, backgroundColor: cores, borderRadius: 5 }] },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 44 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end", align: "right",
          color: (ctx) => cores[ctx.dataIndex],
          font: { size: 12, weight: "700" },
          formatter: (v) => (v > 0 ? v + "%" : null),
        },
      },
      scales: {
        x: { min: 0, max: 100, grid: { display: false }, ticks: { color: _corRotuloChartSec(), font: { weight: _pesoRotuloChart() }, callback: (v) => v + "%" } },
        y: { grid: { display: false }, ticks: { color: _corRotuloChart(), font: { size: 12, weight: _pesoRotuloChart() } } },
      },
    },
  });
}
function _buildAtraso(baseLinhas) {

  _buildEmpresaPager(baseLinhas, "Prazo Vencido por Analista", "barra", {
    rampaHue: 0,
    extraPages: ({ getFiltradas }) => {

      const campoData = _encontrarCampo(
        baseLinhas.length ? baseLinhas : _rawEmpresas,
        "PRAZODATA", "DATAENVIO", "DATARETORNO"
      );
      if (!campoData) return [];
      return [{
        titulo: "Faixas de Atraso",
        subtitulo: "Dias desde a data prevista",
        altura: 280,
        render: (canvas) => {
          const linhas = getFiltradas();
          const [labels, dados, cores, gruposPorFaixa] = _faixasDeAtraso(linhas, campoData);
          if (!dados.some((v) => v > 0)) return _chartVazio(canvas);
          return _chartFaixas(canvas, labels, dados, cores, gruposPorFaixa);
        },
      }];
    },
  });
}

function _buildEmpresaPager(baseLinhas, titulo, tipoInicial, opts) {
  opts = opts || {};
  _ddBaseLinhas = baseLinhas;
  _ddFiltroTec  = "todos";
  _ddFiltroBusca = "";

  const svChartsEl = document.getElementById("sv-charts");
  svChartsEl.innerHTML = "";
  const campoTec = _encontrarCampo(baseLinhas.length ? baseLinhas : _rawEmpresas, "ANALISTARESPONSAVEL", "ANALISTACONTATO");
  const getFiltradas = () => _aplicarFiltrosEmpresa(_ddBaseLinhas, campoTec);

  let tipoAtual = tipoInicial;
  let pager = null;

  const onFiltro = () => {
    const filtradas = getFiltradas();
    _ddDados = filtradas; _ddPagina = 1;
    document.getElementById("sv-count").textContent = `${filtradas.length.toLocaleString("pt-BR")} registro${filtradas.length !== 1 ? "s" : ""}`;
    _ddRenderizarPagina();
    if (pager) pager.rerender();
  };

  if (campoTec) _buildFiltroEmpresa(svChartsEl, baseLinhas, campoTec, onFiltro);

  const paginaAnalista = {
    titulo,
    subtitulo: "Distribuição por analista",
    altura: 280,
    controles: (rerender) => _pillGroup(
      [{ id: "barra", label: "Barras" }, { id: "pizza", label: "Pizza" }],
      () => tipoAtual,
      (t) => { tipoAtual = t; rerender(); }
    ),
    render: (canvas) => {
      const [labels, dados] = _contarPorAnalistaArr(getFiltradas(), campoTec);
      if (!labels.length) return _chartVazio(canvas);
      if (tipoAtual === "pizza") return _chartPizza(canvas, labels, dados, titulo);

      const cores = opts.rampaHue != null ? _rampaCores(labels.length, opts.rampaHue) : null;
      return _chartBarra(canvas, labels, dados, titulo, true, cores);
    },
  };

  const extras = opts.extraPages ? opts.extraPages({ getFiltradas, campoTec }) : [];
  pager = _criarChartPager(svChartsEl, [...extras, paginaAnalista]);
}

function _faixasDeAtraso(linhas, campoData) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeMs = hoje.getTime();
  const faixas = [
    { label: "1–7 dias",  cor: "#fbbf24", min: 1,  max: 7   },
    { label: "8–15 dias", cor: "#fb923c", min: 8,  max: 15  },
    { label: "16–30 dias",cor: "#f97316", min: 16, max: 30  },
    { label: "30+ dias",  cor: "#dc2626", min: 31, max: Infinity },
    { label: "Sem data",  cor: "#94a3b8", min: null, max: null },
  ];
  const grupos = faixas.map(() => []);
  linhas.forEach((r) => {
    const ms = _parseDataMs(r[campoData]);
    if (!isFinite(ms) || ms === -Infinity) { grupos[faixas.length - 1].push(r); return; }
    const dias = Math.floor((hojeMs - ms) / 86400000);
    const i = faixas.findIndex((f) => f.min !== null && dias >= f.min && dias <= f.max);
    if (i >= 0) grupos[i].push(r);

  });
  const cont = grupos.map((g) => g.length);

  const idxSemData = faixas.length - 1;
  const incluir = faixas.map((_, i) => i !== idxSemData || cont[i] > 0);
  const labels = faixas.filter((_, i) => incluir[i]).map((f) => f.label);
  const dados  = cont.filter((_, i) => incluir[i]);
  const cores  = faixas.filter((_, i) => incluir[i]).map((f) => f.cor);
  const gruposPorFaixa = grupos.filter((_, i) => incluir[i]);
  return [labels, dados, cores, gruposPorFaixa];
}

function _contribuicaoAnalistaFaixa(linhasFaixa) {
  const total = linhasFaixa.length;
  if (!total) return [];
  const cont = {};
  linhasFaixa.forEach((r) => {
    const t = MotorRegras.analistaDaEmpresa(r) || "Sem Analista";
    cont[t] = (cont[t] || 0) + 1;
  });
  return Object.entries(cont)
    .map(([analista, count]) => ({ analista, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

function _getFaixaTooltipEl() {
  let el = document.getElementById("sv-faixa-tooltip");
  if (!el) {
    el = document.createElement("div");
    el.id = "sv-faixa-tooltip";
    el.style.cssText =
      "position:absolute;pointer-events:none;z-index:60;opacity:0;transition:opacity 0.1s ease;" +
      "background:var(--bg-surface);border:1px solid var(--border-color);border-radius:6px;" +
      "box-shadow:0 4px 14px rgba(0,0,0,0.18);padding:8px 10px;font-size:0.78rem;color:var(--text-main);";
    document.body.appendChild(el);
  }
  return el;
}

function _faixaTooltipHandler(gruposPorFaixa) {
  return (context) => {
    const { chart, tooltip } = context;
    const el = _getFaixaTooltipEl();
    if (tooltip.opacity === 0) { el.style.opacity = 0; return; }

    const idx = tooltip.dataPoints?.[0]?.dataIndex;
    const label = tooltip.dataPoints?.[0]?.label || "";
    const raw = tooltip.dataPoints?.[0]?.raw ?? 0;
    const contrib = _contribuicaoAnalistaFaixa((gruposPorFaixa || [])[idx] || []);

    let linhasHtml = "";
    if (contrib.length) {
      linhasHtml =
        '<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border-color);' +
        'display:grid;grid-template-columns:auto auto auto;column-gap:10px;row-gap:2px;">' +
        contrib.map((c) => (
          `<span style="font-weight:600;color:${_corAnalista(c.analista)};">${escapeHTML(c.analista)}</span>` +
          `<span style="text-align:right;">${c.pct.toFixed(0)}%</span>` +
          `<span style="text-align:right;color:var(--text-muted);">(${c.count} emp)</span>`
        )).join("") +
        "</div>";
    }
    el.innerHTML =
      `<div style="font-weight:700;">${label}: ${raw} empresa(s)</div>` + linhasHtml;

    const canvasRect = chart.canvas.getBoundingClientRect();
    el.style.left = canvasRect.left + window.scrollX + tooltip.caretX + 12 + "px";
    el.style.top = canvasRect.top + window.scrollY + tooltip.caretY - 10 + "px";
    el.style.opacity = 1;
  };
}

function _chartFaixas(canvas, labels, dados, cores, gruposPorFaixa) {
  if (!window.Chart) return null;
  return new Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data: dados, backgroundColor: cores, borderRadius: 5 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end", align: "top",
          color: (ctx) => cores[ctx.dataIndex],
          font: { size: 14, weight: "800" },
          formatter: (v) => (v > 0 ? v : null),
        },
        tooltip: gruposPorFaixa ? {
          enabled: false,
          external: _faixaTooltipHandler(gruposPorFaixa),
        } : undefined,
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: _corRotuloChart(), font: { size: 12, weight: _pesoRotuloChart() } } },
        y: { grid: { display: false }, beginAtZero: true, ticks: { color: _corRotuloChartSec(), font: { weight: _pesoRotuloChart() }, precision: 0 } },
      },
    },
  });
}

function _contarPorAnalistaArr(linhas, campoNome) {
  const { labels, dados } = _contarPorAnalista(linhas, campoNome);
  return [labels, dados];
}

function _buildOcs() {
  const svChartsEl = document.getElementById("sv-charts");
  svChartsEl.innerHTML = "";

  const metricasGerais = [
    { id: "total",      label: "Todas OCs",   tip: "Todas as OCs concluídas, de qualquer tipo." },
    { id: "efetivas",   label: "Efetivas",    tip: "Ocorrências concluídas que resolvem a empresa: baixas (B)." },
    { id: "emTransito", label: "Em trânsito", tip: "Movimentos (M) para outra unidade ou categoria: a empresa continua no fluxo." },
  ];
  const metricasNumeradas = _OC_CODIGOS.map((c) => ({
    id: "oc" + c,
    label: "OC " + c,
    tip: `${CatalogoOcorrencias.TIPOS[c[0]].nome}: ${_OC_DESCRICOES[c]}`,
  }));

  const _ehMetricaTransf = () => CatalogoOcorrencias.ehTransferencia(_ddOcMetrica.replace(/^oc/, ""));

  const renderOcChart = (canvas) => {
    const equipe = MotorRegras.equipeAtiva;
    const contagem = {};
    equipe.forEach((t) => { contagem[t] = 0; });
    _ocsDaMetrica(_ddOcMetrica).forEach((r) => {
      const tec = _ocAnalista(r);
      if (tec) contagem[tec]++;
    });

    const nomesComDados = equipe.filter((t) => contagem[t] > 0).sort((a, b) => contagem[b] - contagem[a]);
    const dados = nomesComDados.map((t) => contagem[t]);

    const rotulosPorNome = {};
    MotorRegras.rotulosEquipe(equipe).forEach((rotulo, i) => { rotulosPorNome[equipe[i]] = rotulo; });
    const labels = nomesComDados.map((t) => rotulosPorNome[t] || t);
    if (!labels.length) return _chartVazio(canvas);
    return _chartBarra(canvas, labels, dados, "OCs por Analista", true);
  };

  const _aplicarMetricaNaGrid = () => {
    _ddDados = _ocsDaMetrica(_ddOcMetrica)
      .slice()
      .sort((a, b) => _getOcCod(a).localeCompare(_getOcCod(b)));
    _ddPagina = 1;
    document.getElementById("sv-count").textContent =
      `${_ddDados.length.toLocaleString("pt-BR")} registro${_ddDados.length !== 1 ? "s" : ""}`;
    _ddRenderizarPagina();
  };

  document.getElementById("sv-extra").innerHTML = "";
  const row = document.createElement("div");
  row.style.cssText = "display:flex; gap:16px; flex-wrap:wrap; align-items:stretch; width:100%;";
  const colEsq = document.createElement("div");
  const colDir = document.createElement("div");
  colEsq.style.display = "flex";
  row.appendChild(colEsq);
  row.appendChild(colDir);
  svChartsEl.appendChild(row);

  const _aplicarLayout = () => {
    const mostra1213 = _ehMetricaTransf();
    colEsq.style.cssText = (mostra1213 ? "flex:1 1 380px; min-width:0;" : "flex:1 1 100%; min-width:0;") + " display:flex;";
    colDir.style.cssText = mostra1213
      ? "flex:1 1 420px; min-width:340px; display:flex; flex-direction:column; justify-content:space-between; gap:16px;"
      : "display:none;";
    colDir.innerHTML = "";
    if (mostra1213) _buildOc1213Table(colDir);
  };

  const equipeAtiva = MotorRegras.equipeAtiva;
  const paginaOc = {
    titulo: "OCs por Analista",
    subtitulo: "Selecione a métrica",
    altura: Math.max(340, equipeAtiva.length * 40),
    controles: (rerender) => _pillGroups(
      [metricasGerais, metricasNumeradas],
      () => _ddOcMetrica,
      (id) => { _ddOcMetrica = id; _aplicarLayout(); _aplicarMetricaNaGrid(); rerender(); }
    ),
    render: renderOcChart,
  };
  const pagerOc = _criarChartPager(colEsq, [paginaOc]);
  pagerOc.el.style.cssText += "flex:1 1 auto; display:flex; flex-direction:column;";

  _aplicarLayout();
  _aplicarMetricaNaGrid();
}

function _ocsDaMetrica(metrica) {

  const concl = _rawOcsUnicas.filter(_ocConcluida).filter((r) => _ocAnalista(r) !== null);
  if (metrica === "efetivas") return concl.filter(_isEfetiva);
  if (metrica === "emTransito") return _rawOcsUnicas.filter((r) => MotorRegras.ocEmTransito(r));
  if (metrica.startsWith("oc")) {
    const cod = metrica.slice(2);
    return concl.filter((r) => _getOcCod(r) === cod);
  }
  return concl;
}

function _statusOcConcluido(valor) {
  const s = MotorRegras.limparAcentos(valor || "");
  return s.includes("CONCLUIDA") || s.includes("FINALIZADA") || s.includes("OK");
}

function _buildOc1213Table(svExtraEl) {
  const equipe = MotorRegras.equipeAtiva;

  const env = {}, rec = {};
  equipe.forEach((t) => { env[t] = { "T1": 0, "T2": 0 }; rec[t] = { "T1": 0, "T2": 0 }; });

  _rawOcsUnicas.forEach((r) => {
    const cod = _getOcCod(r);
    if (cod !== "T1" && cod !== "T2") return;
    if (!_ocConcluida(r)) return;
    const tecCriador = _ocAnalista(r);
    if (tecCriador && env[tecCriador]) env[tecCriador][cod]++;
  });

  const temRelatorioTransferencia = _rawOcsTransferencia.length > 0;
  const campoStOc = _encontrarCampo(_rawEmpresas, "OCSTATUS");
  const temRecebidas = temRelatorioTransferencia || !!campoStOc;

  if (temRelatorioTransferencia) {

    const analistaPorRaiz = new Map();
    _rawEmpresas.forEach((e) => {
      const raiz = MotorRegras.raizCnpj(e.CNPJ);
      if (!raiz) return;
      const t = MotorRegras.analistaDaEmpresa(e);
      if (t) analistaPorRaiz.set(raiz, t);
    });

    MotorRegras.transferenciasUnicas(_rawOcsTransferencia).forEach((tr) => {
      const cod = MotorRegras.codigoOc(tr);
      if (cod !== "T1" && cod !== "T2") return;
      if (!MotorRegras.ehTransferenciaParaUnidade(tr, CONFIG_UNIDADE.nome)) return;
      const t = analistaPorRaiz.get(MotorRegras.raizCnpj(tr.CNPJTRANSFERIDO));
      if (t && rec[t]) rec[t][cod]++;
    });
  } else if (campoStOc) {

    _rawEmpresas.forEach((e) => {
      const cod = MotorRegras.codigoOc(e);
      if (cod !== "T1" && cod !== "T2") return;
      if (!_statusOcConcluido(e[campoStOc])) return;
      const t = MotorRegras.analistaDaEmpresa(e);
      if (t && rec[t]) rec[t][cod]++;
    });
  }

  const cardTabela = document.createElement("div");
  cardTabela.className = "sv-pager sv-ocTransf-anim";
  cardTabela.style.cssText = "padding:20px; width:100%; box-sizing:border-box; flex:0 0 auto;";
  cardTabela.innerHTML = `<p style="margin:0 0 14px; font-size:0.95rem; font-weight:700; color:var(--text-main); text-transform:uppercase; letter-spacing:0.5px;">Transferências: Saldo por Analista</p>`;

  const tabelaWrap = document.createElement("div");
  tabelaWrap.style.cssText = "width:100%; overflow-x:auto;";
  const tabela = document.createElement("table");
  tabela.className = "preview-table";
  tabela.style.cssText = "width:100%; border-collapse:collapse; font-size:0.95rem;";
  tabela.innerHTML = `<thead><tr>
    <th style="text-align:left;padding:10px 14px;">Analista</th>
    <th style="text-align:center;padding:10px 14px;">T1 Enviadas</th>
    <th style="text-align:center;padding:10px 14px;">T2 Enviadas</th>
    <th style="text-align:center;padding:10px 14px;">T1 Recebidas</th>
    <th style="text-align:center;padding:10px 14px;">T2 Recebidas</th>
    <th style="text-align:center;padding:10px 14px;font-weight:700;">Saldo</th>
  </tr></thead>`;

  const tbody = document.createElement("tbody");
  equipe.forEach((t) => {
    const e12 = env[t]["T1"] || 0, e13 = env[t]["T2"] || 0;
    const r12 = rec[t]["T1"] || 0, r13 = rec[t]["T2"] || 0;
    const saldo = (e12 + e13) - (r12 + r13);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px 14px;font-weight:600;color:${_corAnalista(t)};">${escapeHTML(t)}</td>
      <td style="text-align:center;padding:10px 14px;">${e12}</td>
      <td style="text-align:center;padding:10px 14px;">${e13}</td>
      <td style="text-align:center;padding:10px 14px;">${temRecebidas ? r12 : "—"}</td>
      <td style="text-align:center;padding:10px 14px;">${temRecebidas ? r13 : "—"}</td>
      <td style="text-align:center;padding:10px 14px;font-weight:700;font-size:1rem;color:${saldo > 0 ? "#10b981" : saldo < 0 ? "#ef4444" : "var(--text-muted)"};">${saldo > 0 ? `+${saldo}` : String(saldo)}</td>
    `;
    tbody.appendChild(tr);
  });
  tabela.appendChild(tbody);
  tabelaWrap.appendChild(tabela);
  cardTabela.appendChild(tabelaWrap);

  const cardGrafico = document.createElement("div");
  cardGrafico.className = "sv-pager sv-ocTransf-anim";
  cardGrafico.style.cssText = "padding:20px; width:100%; box-sizing:border-box; flex:0 0 auto;";

  const tituloGrafico = document.createElement("p");
  tituloGrafico.style.cssText = "margin:0 0 10px; font-size:0.95rem; font-weight:700; color:var(--text-main); text-transform:uppercase; letter-spacing:0.5px;";
  tituloGrafico.textContent = "Enviadas x Recebidas por Analista";
  cardGrafico.appendChild(tituloGrafico);

  const togglesWrap = document.createElement("div");
  togglesWrap.style.cssText = "margin-bottom:10px;";
  cardGrafico.appendChild(togglesWrap);

  const graficoWrap = document.createElement("div");
  graficoWrap.style.cssText = "position:relative; width:100%;";
  const canvas = document.createElement("canvas");
  graficoWrap.appendChild(canvas);
  cardGrafico.appendChild(graficoWrap);

  svExtraEl.appendChild(cardTabela);
  svExtraEl.appendChild(cardGrafico);

  let modo = "ambas";
  let chartInst = null;

  const desenhar = () => {
    if (chartInst) {
      const k = _svCharts.indexOf(chartInst);
      if (k > -1) _svCharts.splice(k, 1);
      try { chartInst.destroy(); } catch (_) {}
      chartInst = null;
    }
    const altura = Math.max(240, equipe.length * 46);
    graficoWrap.style.height = altura + "px";
    chartInst = _chartOc1213EnviadasRecebidas(canvas, equipe, env, rec, temRecebidas, modo);
    if (chartInst) _svCharts.push(chartInst);
  };

  togglesWrap.appendChild(_pillGroup(
    [
      { id: "ambas", label: "Ambas" },
      { id: "enviadas", label: "Enviadas" },
      { id: "recebidas", label: "Recebidas", tip: temRecebidas ? undefined : "Nenhuma fonte de OC de transferência recebidas carregada (Relatório de Transferências ou coluna StatusOc)" },
    ],
    () => modo,
    (id) => { modo = id; desenhar(); },
  ));

  desenhar();
}

function _chartOc1213EnviadasRecebidas(canvas, equipe, env, rec, temRecebidas, modo) {
  if (!window.Chart) return null;
  const enviadas = equipe.map((t) => (env[t]["T1"] || 0) + (env[t]["T2"] || 0));
  const recebidas = equipe.map((t) => (rec[t]["T1"] || 0) + (rec[t]["T2"] || 0));

  const datasets = [];
  if (modo !== "recebidas") {
    datasets.push({
      label: "Enviadas",
      data: enviadas,
      backgroundColor: "#4f46e5",
      borderRadius: 4,
      maxBarThickness: 22,
    });
  }
  if (modo !== "enviadas") {
    datasets.push({
      label: "Recebidas",
      data: temRecebidas ? recebidas : equipe.map(() => 0),
      backgroundColor: "#0d9488",
      borderRadius: 4,
      maxBarThickness: 22,
    });
  }

  return new Chart(canvas, {
    type: "bar",
    data: { labels: MotorRegras.rotulosEquipe(equipe), datasets },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 36, top: 6 } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "rgba(128,128,128,0.12)" },
          ticks: { precision: 0, color: _corRotuloChartSec(), font: { size: 12 } },
        },
        y: {
          grid: { display: false },
          ticks: { color: _corRotuloChart(), font: { size: 13, weight: _pesoRotuloChart() }, padding: 8 },
        },
      },
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: "bottom",
          labels: { color: _corRotuloChart(), font: { size: 13 }, boxWidth: 14, padding: 16 },
        },
        datalabels: {
          anchor: "end", align: "right",
          color: _corRotuloChartSec(),
          font: { size: 12, weight: "700" },
          formatter: (v) => (v > 0 ? v : null),
        },
      },
    },
  });
}

function _buildTotal() {
  const svChartsEl = document.getElementById("sv-charts");
  svChartsEl.innerHTML = "";

  const equipe = MotorRegras.equipeAtiva;
  const campoTec = _encontrarCampo(_rawEmpresas, "ANALISTARESPONSAVEL", "ANALISTACONTATO");

  if (campoTec) {
    const filtroWrap = document.createElement("div");
    filtroWrap.id = "sv-analista-filtro";
    filtroWrap.style.cssText = "width:100%; margin-bottom:12px; display:flex; align-items:center; gap:8px;";
    const lbl = document.createElement("span");
    lbl.style.cssText = "font-size:0.82rem; color:var(--text-muted);";
    lbl.textContent = "Filtrar Análise:";
    const sel = document.createElement("select");
    sel.style.cssText = "padding:4px 8px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-surface); color:var(--text-main); font-size:0.82rem;";
    [{ val: "todos", lbl: "Visão Geral (Unidade)" }, ...equipe.map((t) => ({ val: t, lbl: t }))].forEach(({ val, lbl: l }) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = l;
      sel.appendChild(opt);
    });
    sel.value = _ddTotalAnalista;
    sel.onchange = () => { _ddTotalAnalista = sel.value; _preservarScrollSubview(rebuild); };
    filtroWrap.appendChild(lbl);
    filtroWrap.appendChild(sel);
    svChartsEl.appendChild(filtroWrap);
  }

  function atualizarGridTotal(paginaAtual) {
    let gLinhas = _rawEmpresas;
    if (_ddTotalAnalista !== "todos") {
      gLinhas = gLinhas.filter((r) => MotorRegras.analistaDaEmpresa(r) === _ddTotalAnalista);
    }
    _ddDados = gLinhas;
    _ddPagina = 1;
    document.getElementById("sv-count").textContent =
      `${gLinhas.length.toLocaleString("pt-BR")} registro${gLinhas.length !== 1 ? "s" : ""}`;
    _ddRenderizarPagina();
    _ddTravarLargurasColunas();
  }

  function rebuild() {
    _svCharts.forEach((c) => { try { c.destroy(); } catch (_) {} });
    _svCharts = [];
    Array.from(svChartsEl.children).forEach((child) => { if (child.id !== "sv-analista-filtro") child.remove(); });

    const paginas = _buildTotalPaginas(_ddTotalAnalista);

    if (paginas.length) {
      _criarChartPager(svChartsEl, paginas, _ddTotalPagerIdx, (i) => {
        _ddTotalPagerIdx = i;
        atualizarGridTotal(paginas[i]);
      });
    } else {
      atualizarGridTotal(null);
    }
  }

  rebuild();
}

function _buildTotalPaginas(tecFiltro) {
  const paleta = ["#6366f1","#f59e0b","#ec4899","#4f46e5","#10b981","#ef4444","#8b5cf6","#f97316","#06b6d4","#84cc16"];
  const campoTec = _encontrarCampo(_rawEmpresas, "ANALISTARESPONSAVEL", "ANALISTACONTATO");

  let linhas = _rawEmpresas;
  if (tecFiltro && tecFiltro !== "todos") {
    linhas = linhas.filter((r) => MotorRegras.analistaDaEmpresa(r) === tecFiltro);
  }

  const mkPagina = (campo, titulo, horizontal, maxItems, vazioLabel, tooltipFn) => {
    const vazio = vazioLabel || "—";
    const conta = {};
    linhas.forEach((r) => { const v = String(r[campo] || "").trim() || vazio; conta[v] = (conta[v] || 0) + 1; });
    const ordenado = Object.entries(conta).sort((a, b) => b[1] - a[1]);
    const totalCats = ordenado.length;
    const lim = maxItems || 10;
    const sorted = ordenado.slice(0, lim);
    if (!sorted.length) return null;
    const lbs = sorted.map((e) => e[0]);
    const dds = sorted.map((e) => e[1]);
    const altura = horizontal ? Math.max(220, lbs.length * 38) : 280;

    const empresasTxt = `${linhas.length.toLocaleString("pt-BR")} empresa${linhas.length !== 1 ? "s" : ""}`;
    const subtitulo = totalCats > sorted.length
      ? `Top ${sorted.length} de ${totalCats.toLocaleString("pt-BR")} · ${empresasTxt}`
      : `${totalCats.toLocaleString("pt-BR")} categoria${totalCats !== 1 ? "s" : ""} · ${empresasTxt}`;
    return {
      titulo,
      subtitulo,
      altura,
      render: (canvas) => _chartCategoria(canvas, lbs, dds, horizontal, paleta, tooltipFn),
    };
  };

  const paginas = [];

  if (_dadosProcessados) {
    const equipeStatus = MotorRegras.equipeAtiva.filter(
      (t) => !tecFiltro || tecFiltro === "todos" || t === tecFiltro
    );
    if (equipeStatus.length) {
      paginas.push({
        titulo: "Status por Analista",
        subtitulo: "Distribuição percentual do funil",
        altura: Math.max(220, equipeStatus.length * 48 + 70),
        render: (canvas) => _chartStatusEmpilhado(canvas, equipeStatus),
      });
    }
  }

  const campoCat = _encontrarCampo(linhas.length ? linhas : _rawEmpresas, "CATEGORIA");
  if (campoCat) { const p = mkPagina(campoCat, "Por Categoria", true, 12); if (p) paginas.push(p); }

  const campoMuni = _encontrarCampo(linhas.length ? linhas : _rawEmpresas, "MUNICIPIO", "MUNICIPIONOME", "NMUNICIPIO", "NOMEMUNICIPIO");
  if (campoMuni) { const p = mkPagina(campoMuni, "Por Município", true, Infinity); if (p) paginas.push(p); }

  const campoCnae = _encontrarCampo(linhas.length ? linhas : _rawEmpresas, "CNAE");
  if (campoCnae) {

    const tooltipCnae = (label) => (typeof descricaoCNAE === "function" ? descricaoCNAE(label) : "");
    const p = mkPagina(campoCnae, "Por CNAE", true, 12, "Sem CNAE", tooltipCnae);
    if (p) paginas.push(p);
  }

  const campoNova = _encontrarCampo(linhas.length ? linhas : _rawEmpresas, "CLIENTENOVO");
  if (campoNova) {

    const novas = linhas.filter((r) => String(r[campoNova] || "").trim().toUpperCase().startsWith("S")).length;
    const veteranas = linhas.length - novas;
    if (linhas.length > 0) {
      paginas.push({
        titulo: "Empresas Novas vs. Antigas",
        subtitulo: `${linhas.length.toLocaleString("pt-BR")} empresa(s)`,
        altura: 280,
        render: (canvas) => _chartNovasVeteranas(canvas, novas, veteranas),
      });
    }
  }

  return paginas;
}

function _chartNovasVeteranas(canvas, novas, veteranas) {
  if (!window.Chart) return _chartVazio(canvas);
  const total = novas + veteranas || 1;
  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Novas", "Antigas"],
      datasets: [{
        data: [novas, veteranas],
        backgroundColor: ["#4f46e5", "#f59e0b"],
        borderColor: ["#4f46e5", "#f59e0b"],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      rotation: -90,
      circumference: 180,
      cutout: "65%",
      layout: { padding: { bottom: 10 } },
      plugins: {
        legend: { position: "bottom", labels: { color: _corRotuloChart(), font: { size: 13, weight: _pesoRotuloChart() }, boxWidth: 14, padding: 16 } },
        datalabels: {
          color: "#fff",
          font: { size: 15, weight: "700" },
          formatter: (v) => (v > 0 ? [String(v), `(${((v / total) * 100).toFixed(0)}%)`] : null),
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw / total) * 100).toFixed(1)}%)`,
          },
        },
      },
    },
  });
}

const _STATUS_SEG = [
  { key: "semContato",        label: "Sem Contato",              cor: "#93c5fd", txt: "#1e293b" },
  { key: "contatoEmAndamento", label: "Contato em Andamento",    cor: "#3b82f6", txt: "#ffffff" },
  { key: "contatada",         label: "Contatada",                cor: "#fdba74", txt: "#1e293b" },
  { key: "agendada",         label: "Agendada",                cor: "#fb923c", txt: "#1e293b" },
  { key: "prazoVencido",         label: "Prazo Vencido",               cor: "#b45309", txt: "#ffffff" },
  { key: "estendida",      label: "Prazo Estendido",             cor: "#fca5a5", txt: "#1e293b" },
  { key: "lembrete",          label: "Lembrete Enviado",                 cor: "#eab308", txt: "#1e293b" },
  { key: "formalizada",       label: "Formalizada",              cor: "#fde047", txt: "#1e293b" },
  { key: "respondida",         label: "Respondida",                cor: "#86efac", txt: "#1e293b" },
  { key: "ocDet",           label: "OC",                     cor: "#166534", txt: "#ffffff" },
];

function _chartStatusEmpilhado(canvas, equipe) {
  if (!window.Chart || !_dadosProcessados) return null;

  const rows = equipe.map((t) => {
    const e = _dadosProcessados.empresas[t] || {};
    const f = _dadosProcessados.ocs[t] || {};
    const vals = {};
    _STATUS_SEG.forEach((s) => {
      vals[s.key] = s.key === "ocDet" ? (f.concEfetiva || 0) : (e[s.key] || 0);
    });
    const soma = _STATUS_SEG.reduce((acc, s) => acc + vals[s.key], 0) || 1;
    return { vals, soma };
  });

  const labels = MotorRegras.rotulosEquipe(equipe);
  const datasets = _STATUS_SEG.map((s) => ({
    label: s.label,
    backgroundColor: s.cor,
    _txt: s.txt,
    data: rows.map((r) => +((r.vals[s.key] / r.soma) * 100).toFixed(1)),
    _raw: rows.map((r) => r.vals[s.key]),
    borderWidth: 0,
    stack: "st",
  }));

  return new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { color: _corRotuloChart(), font: { size: 11, weight: _pesoRotuloChart() }, boxWidth: 12, padding: 8 },
        },
        datalabels: {
          color: (ctx) => ctx.dataset._txt || "#1e293b",
          font: { size: 10, weight: "700" },
          formatter: (v) => (v >= 5 ? v + "%" : null),
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.dataset._raw[ctx.dataIndex]} (${ctx.parsed.x}%)`,
          },
        },
      },
      scales: {
        x: { stacked: true, min: 0, max: 100, grid: { display: false },
             ticks: { color: _corRotuloChartSec(), font: { size: 11, weight: _pesoRotuloChart() }, callback: (v) => v + "%" } },
        y: { stacked: true, grid: { display: false },
             ticks: { color: _corRotuloChart(), font: { size: 12, weight: _pesoRotuloChart() } } },
      },
    },
  });
}

function _getCnaeTooltipEl() {
  let el = document.getElementById("sv-cnae-tooltip");
  if (!el) {
    el = document.createElement("div");
    el.id = "sv-cnae-tooltip";
    el.style.cssText =
      "position:absolute;pointer-events:none;z-index:60;opacity:0;transition:opacity 0.1s ease;" +
      "background:var(--bg-surface);border:1px solid var(--border-color);border-radius:6px;" +
      "box-shadow:0 4px 14px rgba(0,0,0,0.18);padding:8px 10px;font-size:0.78rem;" +
      "color:var(--text-main);max-width:240px;";
    document.body.appendChild(el);
  }
  return el;
}

function _cnaeTooltipHandler(tooltipFn) {
  return (context) => {
    const { chart, tooltip } = context;
    const el = _getCnaeTooltipEl();
    if (tooltip.opacity === 0) { el.style.opacity = 0; return; }

    const dp = tooltip.dataPoints?.[0];
    const label = dp?.label || "";
    const raw = dp?.raw ?? 0;
    const desc = tooltipFn(label);

    el.innerHTML =
      `<div style="font-weight:700;">${escapeHTML(label)}</div>` +
      (desc ? `<div style="color:var(--text-muted); margin-top:2px;">${escapeHTML(desc)}</div>` : "") +
      `<div style="margin-top:6px; padding-top:6px; border-top:1px solid var(--border-color); color:var(--text-muted);">${raw} empresa(s)</div>`;

    const canvasRect = chart.canvas.getBoundingClientRect();
    el.style.left = canvasRect.left + window.scrollX + tooltip.caretX + 12 + "px";
    el.style.top = canvasRect.top + window.scrollY + tooltip.caretY - 10 + "px";
    el.style.opacity = 1;
  };
}

function _chartCategoria(canvas, lbs, dds, horizontal, paleta, tooltipFn) {
  if (!window.Chart) return null;
  return new Chart(canvas, {
    type: "bar",
    data: { labels: lbs, datasets: [{ data: dds, backgroundColor: lbs.map((_, i) => paleta[i % paleta.length]), borderRadius: 5 }] },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: horizontal ? 44 : 8, top: horizontal ? 4 : 28 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end", align: horizontal ? "right" : "top",
          color: (ctx) => paleta[ctx.dataIndex % paleta.length],
          font: { size: 14, weight: "800" },
          formatter: (v) => (v > 0 ? v : null),
        },
        ...(tooltipFn ? { tooltip: { enabled: false, external: _cnaeTooltipHandler(tooltipFn) } } : {}),
      },
      scales: {
        x: { display: !horizontal, grid: { display: false }, ticks: { color: _corRotuloChart(), font: { size: 13, weight: _pesoRotuloChart() } } },
        y: { grid: { display: false }, ticks: { color: _corRotuloChart(), font: { size: 13, weight: _pesoRotuloChart() }, padding: horizontal ? 6 : 2 } },
      },
    },
  });
}

function abrirDrilldown(tipo) {
  const cfg = {
    total:     { titulo: "Total de Empresas",   icone: "fa-building",             cor: "#4f46e5" },
    respondidas: { titulo: "Empresas Respondidas",   icone: "fa-check-circle",         cor: "#10b981" },
    atraso:    { titulo: "Empresas Prazo Vencido",   icone: "fa-exclamation-triangle",  cor: "#ef4444" },
    ocs:      { titulo: "OCs",                 icone: "fa-handshake",            cor: "#f59e0b" },
  };
  const info = cfg[tipo];
  if (!info) return;

  _svCharts.forEach((c) => { try { c.destroy(); } catch (_) {} });
  _svCharts = [];
  _ddOcMetrica    = "total";
  _ddTotalAnalista  = "todos";
  _ddTotalPagerIdx = 0;
  _ddFiltroTec     = "todos";
  _ddFiltroBusca   = "";
  _ddBaseLinhas    = [];
  _ddFiltrosColuna = {};
  _ddOrdemCol      = null;
  _ddOrdemDir      = null;

  document.getElementById("dash-main").style.display = "none";
  document.getElementById("subview-wrapper").style.display = "";

  const ico = document.getElementById("sv-icone");
  ico.className = `fas ${info.icone}`;
  ico.style.color = info.cor;
  document.getElementById("sv-titulo").textContent = info.titulo;
  document.getElementById("sv-extra").innerHTML = "";

  let linhas, colunas;

  if (tipo === "ocs") {

    linhas = _ocsDaMetrica("total").slice().sort((a, b) => _getOcCod(a).localeCompare(_getOcCod(b)));
    colunas = _ddColunasDisponiveis(_DD_COLS_OC, linhas.length ? linhas : _rawOcs);
    if (!colunas.length && _rawOcs.length) colunas = Object.keys(_rawOcs[0]).slice(0, 8);
    _buildOcs();

  } else if (tipo === "total") {
    linhas = _rawEmpresas;
    colunas = _ddColunasDisponiveis(_DD_COLS_EMP, linhas.length ? linhas : _rawEmpresas);
    if (!colunas.length && _rawEmpresas.length) colunas = Object.keys(_rawEmpresas[0]).slice(0, 8);
    _buildTotal();

  } else {

    const baseEmp = _rawEmpresas;
    const statusKey = _ddStatusKey(_rawEmpresas);
    if (tipo === "respondidas") {
      linhas = statusKey ? baseEmp.filter((r) => (r[statusKey] || "").toUpperCase().includes("RESPONDIDA")) : [];

      const campoData = _encontrarCampo(linhas.length ? linhas : _rawEmpresas, "DATARETORNO", "DATARESPOSTA", "DATAREALIZACAORESPOSTA", "DATAENTREGA");
      if (campoData) linhas = [...linhas].sort((a, b) => _parseDataMs(b[campoData]) - _parseDataMs(a[campoData]));

      colunas = _ddColsComData(linhas, "DATARETORNO");
      _buildRespondidas(linhas);
    } else {
      linhas = statusKey ? baseEmp.filter((r) => (r[statusKey] || "").toUpperCase().includes("VENCIDO")) : [];

      const campoData = _encontrarCampo(linhas.length ? linhas : _rawEmpresas, "PRAZODATA", "DATAENVIO", "DATARETORNO");
      if (campoData) linhas = [...linhas].sort((a, b) => _parseDataMs(a[campoData]) - _parseDataMs(b[campoData]));

      _carimbarDiasAtraso(linhas);

      colunas = _ddColsComData(linhas, "PRAZODATA", "DIASATRASO");
      _buildAtraso(linhas);
    }
    if (!colunas.length && _rawEmpresas.length) colunas = Object.keys(_rawEmpresas[0]).slice(0, 8);
  }

  _ddTipo = tipo;
  const amostraAll = linhas.length ? linhas : (tipo === "ocs" ? _rawOcs : _rawEmpresas);
  _ddColunasAll = amostraAll.length ? Object.keys(amostraAll[0]) : [...colunas];
  colunas.forEach((c) => { if (!_ddColunasAll.includes(c)) _ddColunasAll.push(c); });
  _ddColPadrao = [...colunas];

  _ddDados   = linhas;
  _ddColunas = _ddRestaurarColunas(tipo, _ddColunasAll, colunas);
  _ddTitulo  = info.titulo;
  _ddPagina  = 1;

  document.getElementById("sv-count").textContent =
    `${linhas.length.toLocaleString("pt-BR")} registro${linhas.length !== 1 ? "s" : ""}`;

  _ddRenderHeader(_ddColunas);

  _ddRenderizarPagina();
  _ddTravarLargurasColunas();

  _ddInitHeaderFixoListeners();
  _ddSyncHeaderFixo(true);
}

function _ddTravarLargurasColunas() {
  const tabela = document.getElementById("drilldown-table");
  const ths = document.querySelectorAll("#drilldown-thead > tr:first-child > th");
  ths.forEach((th, i) => {
    const chave = _ddColunas[i];
    const w = th.offsetWidth;
    if (chave && w) {
      _ddLargurasColunas[chave] = w;
      th.style.width = w + "px";
    }
  });
  if (tabela) tabela.style.tableLayout = "fixed";
}

function _ddRenderHeader(colunas) {
  const thead = document.getElementById("drilldown-thead");
  thead.innerHTML = "";

  const trTit = document.createElement("tr");
  colunas.forEach((c) => {
    const th = document.createElement("th");
    if (c === "RAZAOSOCIAL") th.className = "text-left";
    th.style.cursor = "pointer";
    th.title = "Clique para ordenar · arraste para reordenar";
    th.draggable = true;

    th.addEventListener("dragstart", (e) => {
      _ddDragCol = c;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => th.classList.add("drag-source"), 0);
    });
    th.addEventListener("dragend", () => {
      trTit.querySelectorAll("th").forEach((t) => t.classList.remove("drag-source", "drag-over"));
      _ddDragCol = null;
    });
    th.addEventListener("dragover", (e) => {
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      if (_ddDragCol && _ddDragCol !== c) {
        trTit.querySelectorAll("th").forEach((t) => t.classList.remove("drag-over"));
        th.classList.add("drag-over");
      }
    });
    th.addEventListener("dragleave", (e) => { if (!th.contains(e.relatedTarget)) th.classList.remove("drag-over"); });
    th.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!_ddDragCol || _ddDragCol === c) return;
      const iOrig = _ddColunas.indexOf(_ddDragCol);
      const iDest = _ddColunas.indexOf(c);
      if (iOrig === -1 || iDest === -1) return;
      _ddColunas.splice(iOrig, 1);
      _ddColunas.splice(iDest, 0, _ddDragCol);
      _ddSalvarColunas();
      _ddRenderHeader(_ddColunas);
      _ddRenderizarPagina();
    });

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; align-items:center; gap:6px; justify-content:flex-start;";
    const sp = document.createElement("span");
    sp.textContent = _ddNomeColuna(c);
    const ico = document.createElement("i");
    ico.className = _ddIconeOrdem(c);
    ico.style.cssText = "font-size:0.8rem;" + (_ddOrdemCol === c ? "" : "opacity:0.45;");
    wrap.appendChild(sp);
    wrap.appendChild(ico);
    th.appendChild(wrap);
    th.addEventListener("click", () => { if (!_ddDragCol) _ddCicloOrdem(c); });

    if (_ddLargurasColunas[c]) th.style.width = _ddLargurasColunas[c] + "px";
    trTit.appendChild(th);
  });
  thead.appendChild(trTit);

  _ddRenderFiltroRow(thead, colunas);

  const tabela = document.getElementById("drilldown-table");
  if (tabela && window.requestAnimationFrame) {
    requestAnimationFrame(() => {
      const h = trTit.offsetHeight || 44;
      tabela.style.setProperty("--dd-h1", h + "px");
      _ddSyncHeaderFixo(true);
    });
  }
}

function _ddIconeOrdem(c) {
  if (_ddOrdemCol !== c) return "fas fa-sort";
  return _ddOrdemDir === "asc" ? "fas fa-sort-up"
       : _ddOrdemDir === "desc" ? "fas fa-sort-down"
       : "fas fa-sort";
}

function _ddCicloOrdem(chave) {
  if (_ddOrdemCol !== chave) { _ddOrdemCol = chave; _ddOrdemDir = "asc"; }
  else if (_ddOrdemDir === "asc") { _ddOrdemDir = "desc"; }
  else { _ddOrdemCol = null; _ddOrdemDir = null; }
  _ddPagina = 1;
  _ddRenderHeader(_ddColunas);
  _ddRenderizarPagina();
}

function _ddCompara(av, bv) {
  const a = String(av == null ? "" : av).trim();
  const b = String(bv == null ? "" : bv).trim();
  if (a === "" && b === "") return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  const reNum = /^-?\d+([.,]\d+)?$/;
  if (reNum.test(a) && reNum.test(b)) return parseFloat(a.replace(",", ".")) - parseFloat(b.replace(",", "."));
  const reData = /\d{2}[\/-]\d{2}/;
  const ma = _parseDataMs(a), mb = _parseDataMs(b);
  if (reData.test(a) && reData.test(b) && ma !== -Infinity && mb !== -Infinity) return ma - mb;
  return a.toUpperCase().localeCompare(b.toUpperCase(), "pt-BR");
}

function _ddRenderFiltroRow(thead, colunas) {
  const tr = document.createElement("tr");
  tr.className = "sv-filtro-row";
  colunas.forEach((chave) => {
    const th = document.createElement("th");
    const filtroAtual = _ddFiltrosColuna[chave];
    const temSet = filtroAtual instanceof Set && filtroAtual.size > 0;
    const temTexto = typeof filtroAtual === "string" && filtroAtual;
    const box = document.createElement("div");
    box.className = "sv-colfilter" + (temSet || temTexto ? " ativo" : "");
    const inp = document.createElement("input");
    inp.type = "text";
    inp.title = `Filtrar por ${_ddNomeColuna(chave)}`;
    if (temSet) {
      inp.placeholder = `${filtroAtual.size} selecionado${filtroAtual.size !== 1 ? "s" : ""}`;
      inp.value = "";
    } else {
      inp.placeholder = "Filtrar…";
      inp.value = temTexto ? filtroAtual : "";
    }

    inp.addEventListener("input", (e) => {
      const v = e.target.value.trim().toUpperCase();
      if (v) _ddFiltrosColuna[chave] = v; else delete _ddFiltrosColuna[chave];
      box.classList.toggle("ativo", !!v);
      _ddPagina = 1;
      _ddRenderizarPagina();
    });
    const ico = document.createElement("i");
    ico.className = "fas fa-filter";
    ico.style.cursor = "pointer";
    ico.title = "Busca avançada (selecionar valores)";
    ico.addEventListener("click", (e) => {
      e.stopPropagation();
      _ddAbrirFiltroAvancado(chave, box);
    });
    box.appendChild(inp);
    box.appendChild(ico);
    th.appendChild(box);
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

function _ddAbrirFiltroAvancado(chave, anchorEl) {
  document.getElementById("_dd-filtro-pop")?.remove();

  const entradas = Object.entries(_ddFiltrosColuna).filter(([k, v]) => k !== chave && v);
  const base = entradas.length
    ? _ddDados.filter((l) => entradas.every(([k, v]) =>
        v instanceof Set ? v.has(String(l[k] ?? "").trim()) : String(l[k] || "").toUpperCase().includes(v)))
    : _ddDados;

  const distintos = Array.from(new Set(base.map((l) => String(l[chave] ?? "").trim())))
    .sort((a, b) => _ddCompara(a, b));

  const sel = _ddFiltrosColuna[chave] instanceof Set
    ? new Set(_ddFiltrosColuna[chave])
    : new Set(distintos);

  const pop = document.createElement("div");
  pop.id = "_dd-filtro-pop";
  pop.className = "dropdown-filtro-panel";
  pop.style.cssText = "position:fixed; z-index:9999; width:260px; max-height:340px; display:flex; flex-direction:column; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; box-shadow:0 8px 28px rgba(0,0,0,0.28); overflow:hidden;";

  const r = anchorEl.getBoundingClientRect();
  pop.style.left = Math.min(r.left, window.innerWidth - 272) + "px";
  pop.style.top = Math.min(r.bottom + 4, window.innerHeight - 360) + "px";

  pop.innerHTML = `
    <div style="padding:8px; border-bottom:1px solid var(--border-color);">
      <input type="text" id="_dd-fpop-busca" placeholder="Buscar valor…" style="width:100%; padding:5px 8px; border:1px solid var(--border-color); border-radius:5px; background:var(--bg-body); color:var(--text-main); font-size:0.82rem;">
      <label style="display:flex; align-items:center; gap:6px; margin-top:8px; font-size:0.82rem; cursor:pointer; color:var(--text-main);">
        <input type="checkbox" id="_dd-fpop-todos"> <span>(Selecionar todos)</span>
      </label>
    </div>
    <div id="_dd-fpop-lista" style="flex:1; overflow-y:auto; padding:6px 8px;"></div>
    <div style="display:flex; gap:6px; padding:8px; border-top:1px solid var(--border-color);">
      <button id="_dd-fpop-limpar" style="flex:1; padding:6px; border:1px solid var(--border-color); border-radius:5px; background:var(--bg-body); color:var(--text-main); cursor:pointer; font-size:0.8rem;">Limpar</button>
      <button id="_dd-fpop-ok" style="flex:1; padding:6px; border:none; border-radius:5px; background:var(--color-primary); color:white; cursor:pointer; font-size:0.8rem; font-weight:600;">Aplicar</button>
    </div>`;

  document.body.appendChild(pop);

  const lista = pop.querySelector("#_dd-fpop-lista");
  const chkTodos = pop.querySelector("#_dd-fpop-todos");

  const desenhar = (filtroTxt) => {
    lista.innerHTML = "";
    const ft = (filtroTxt || "").toUpperCase();
    const visiveis = distintos.filter((v) => !ft || v.toUpperCase().includes(ft));
    visiveis.forEach((v) => {
      const lab = document.createElement("label");
      lab.style.cssText = "display:flex; align-items:center; gap:6px; padding:3px 2px; font-size:0.82rem; cursor:pointer; color:var(--text-main);";
      const ck = document.createElement("input");
      ck.type = "checkbox"; ck.checked = sel.has(v);
      ck.addEventListener("change", () => {
        if (ck.checked) sel.add(v); else sel.delete(v);
        chkTodos.checked = distintos.every((x) => sel.has(x));
      });
      const sp = document.createElement("span");
      sp.textContent = v === "" ? "(vazio)" : v;
      sp.style.cssText = "white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
      lab.append(ck, sp);
      lista.appendChild(lab);
    });
    chkTodos.checked = distintos.length > 0 && distintos.every((x) => sel.has(x));
  };
  desenhar("");

  pop.querySelector("#_dd-fpop-busca").addEventListener("input", (e) => desenhar(e.target.value));
  chkTodos.addEventListener("change", () => {
    if (chkTodos.checked) distintos.forEach((v) => sel.add(v)); else sel.clear();
    desenhar(pop.querySelector("#_dd-fpop-busca").value);
  });
  pop.querySelector("#_dd-fpop-limpar").onclick = () => {
    delete _ddFiltrosColuna[chave];
    pop.remove();
    _ddPagina = 1;
    _ddRenderHeader(_ddColunas);
    _ddRenderizarPagina();
  };
  pop.querySelector("#_dd-fpop-ok").onclick = () => {

    if (sel.size === distintos.length) delete _ddFiltrosColuna[chave];
    else _ddFiltrosColuna[chave] = new Set(sel);
    pop.remove();
    _ddPagina = 1;
    _ddRenderHeader(_ddColunas);
    _ddRenderizarPagina();
  };

  setTimeout(() => {
    const fechar = (ev) => {
      if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener("mousedown", fechar); }
    };
    document.addEventListener("mousedown", fechar);
  }, 0);
}

function _ddDadosFiltrados() {
  const entradas = Object.entries(_ddFiltrosColuna).filter(([, v]) => v instanceof Set ? v.size >= 0 : !!v);
  let res = entradas.length
    ? _ddDados.filter((linha) =>
        entradas.every(([chave, v]) =>
          v instanceof Set
            ? v.has(String(linha[chave] ?? "").trim())
            : (ehColunaCNPJ(chave)
                ? (cnpjBuscaCasa(linha[chave], v) || String(linha[chave] || "").toUpperCase().includes(v))
                : String(linha[chave] || "").toUpperCase().includes(v))))
    : _ddDados;
  if (_ddOrdemCol && _ddOrdemDir) {
    const dir = _ddOrdemDir === "asc" ? 1 : -1;
    res = [...res].sort((a, b) => dir * _ddCompara(a[_ddOrdemCol], b[_ddOrdemCol]));
  }
  return res;
}

function _ddRenderizarPagina() {
  const dados  = _ddDadosFiltrados();
  const total  = dados.length;
  const pp     = _ddPP === 0 ? (total || 1) : _ddPP;
  const totalPags = Math.max(1, Math.ceil(total / pp));
  if (_ddPagina > totalPags) _ddPagina = totalPags;
  const inicio = (_ddPagina - 1) * pp;
  const fim    = Math.min(inicio + pp, total);
  const pagina = dados.slice(inicio, fim);

  const elCount = document.getElementById("sv-count");
  if (elCount) elCount.textContent = `${total.toLocaleString("pt-BR")} registro${total !== 1 ? "s" : ""}`;

  const tbody = document.getElementById("drilldown-tbody");
  tbody.innerHTML = "";

  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="${_ddColunas.length || 1}" style="text-align:center;padding:30px;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
    document.getElementById("drilldown-paginacao").innerHTML = "";
    return;
  }

  pagina.forEach((linha) => {
    const tr = document.createElement("tr");
    _ddColunas.forEach((chave) => {
      const td = document.createElement("td");
      if (chave === "RAZAOSOCIAL") td.className = "text-left font-bold-name";
      let val = linha[chave] || "-";
      if (chave === "CNPJ" && val !== "-") val = formatarCNPJ(val);

      td.textContent = val;

      if (_DD_COLS_NOWRAP.has(chave)) td.style.whiteSpace = "nowrap";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  _ddRenderizarPaginacao(inicio + 1, fim, total);
}

function _ddRenderizarPaginacao(de, ate, total) {
  const container = document.getElementById("drilldown-paginacao");
  _montarPaginacao(container, {
    de, ate, total,
    porPagina: _ddPP,
    pagina: _ddPagina,
    onPorPagina: (n) => { _ddPP = n; _ddPagina = 1; _ddRenderizarPagina(); },
    onPagina: (p) => { _ddPagina = p; _ddRenderizarPagina(); },
  });
}

function _montarPaginacao(container, opts) {
  if (!container) return;
  const { de, ate, total, porPagina, pagina, onPorPagina, onPagina } = opts;
  container.innerHTML = "";
  container.style.cssText = "display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:10px 15px; border-top:1px solid var(--border-color);";

  const OPCOES = [10, 25, 50, 100, 500, 0];
  const LABELS = ["10", "25", "50", "100", "500", "Todas"];

  const sel = document.createElement("div");
  sel.style.cssText = "display:flex; align-items:center; gap:4px; font-size:0.82rem;";
  const lbl = document.createElement("span"); lbl.textContent = "Exibir:"; sel.appendChild(lbl);
  OPCOES.forEach((n, i) => {
    const btn = document.createElement("button");
    btn.textContent = LABELS[i];
    const ativo = porPagina === n;
    btn.style.cssText = `padding:2px 8px; border-radius:4px; border:1px solid var(--border-color); cursor:pointer; font-size:0.8rem; background:${ativo ? "var(--color-primary)" : "var(--bg-body)"}; color:${ativo ? "white" : "var(--text-main)"}; ${ativo ? "font-weight:700;" : ""}`;
    btn.onclick = () => onPorPagina(n);
    sel.appendChild(btn);
  });

  const info = document.createElement("span");
  info.style.cssText = "font-size:0.82rem; color:var(--text-muted); flex:1; text-align:center; white-space:nowrap;";
  info.textContent = total
    ? `Exibindo ${de.toLocaleString("pt-BR")} a ${ate.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} registros`
    : "Nenhum registro";

  container.append(sel, info);

  if (porPagina > 0 && total > porPagina) {
    const totalPags = Math.ceil(total / porPagina);
    const paginaAtual = Math.min(pagina, totalPags);
    const nav = document.createElement("div");
    nav.style.cssText = "display:flex; gap:3px;";
    const addB = (html, pag, disabled, ativo) => {
      const b = document.createElement("button");
      b.innerHTML = html; b.disabled = disabled;
      b.style.cssText = `padding:2px 8px; border-radius:4px; border:1px solid var(--border-color); cursor:${disabled ? "default" : "pointer"}; font-size:0.8rem; background:${ativo ? "var(--color-primary)" : "var(--bg-body)"}; color:${ativo ? "white" : "var(--text-main)"}; opacity:${disabled ? "0.4" : "1"};`;
      if (!disabled && pag !== null) b.onclick = () => onPagina(pag);
      nav.appendChild(b);
    };
    addB("«", 1, paginaAtual === 1, false);
    addB("‹", paginaAtual - 1, paginaAtual === 1, false);
    const s = Math.max(1, Math.min(paginaAtual - 2, totalPags - 4));
    const e2 = Math.min(totalPags, s + 4);
    for (let p = s; p <= e2; p++) addB(String(p), p, false, p === paginaAtual);
    addB("›", paginaAtual + 1, paginaAtual === totalPags, false);
    addB("»", totalPags, paginaAtual === totalPags, false);
    container.appendChild(nav);
  }
}

function exportarDrilldownCSV() {
  const dados = _ddDadosFiltrados();
  if (dados.length === 0) return;
  const sep = ";";
  const linhas = [
    _ddColunas.map((c) => `"${_ddNomeColuna(c)}"`).join(sep),
    ...dados.map((linha) =>
      _ddColunas.map((c) => `"${neutralizarFormulaCSV(String(linha[c] || "")).replace(/"/g, '""')}"`).join(sep)
    ),
  ];
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `nexo-${_ddTitulo.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarDrilldownPDF() {
  if (!window.jspdf) {
    if (typeof _notificarUsuario === "function") _notificarUsuario("jsPDF não está disponível.", "error");
    else NexoModal.alert("PDF indisponível", "jsPDF não está carregado nesta página.", "aviso");
    return;
  }
  const dadosPDF = _ddDadosFiltrados();
  if (dadosPDF.length === 0) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const margem = 10, pageW = 297, pageH = 210;
  const usableW = pageW - 2 * margem;
  const nCols = _ddColunas.length;
  const PAD = 1.5;
  const FONT = 7;
  const lineH = FONT * 0.42;
  const MIN_COL = 10;
  const MAX_COL = 70;
  let y = margem;

  const valorCelula = (linha, chave) => {
    let val = String(linha[chave] ?? "-");
    if (val === "") val = "-";
    if (chave === "CNPJ" && val !== "-") val = formatarCNPJ(val);
    return val;
  };

  const AMOSTRA = Math.min(dadosPDF.length, 400);
  const larguras = _ddColunas.map((chave) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT);
    let maxTxt = doc.getTextWidth(_ddNomeColuna(chave));
    doc.setFont("helvetica", "normal");
    for (let r = 0; r < AMOSTRA; r++) {
      const w = doc.getTextWidth(valorCelula(dadosPDF[r], chave));
      if (w > maxTxt) maxTxt = w;
    }
    return Math.min(MAX_COL, Math.max(MIN_COL, maxTxt + PAD * 2));
  });

  const somaNat = larguras.reduce((a, b) => a + b, 0);
  if (somaNat > usableW) {
    const fator = usableW / somaNat;
    for (let i = 0; i < larguras.length; i++) larguras[i] *= fator;
  }
  const tabelaW = larguras.reduce((a, b) => a + b, 0);
  const startX = margem + (usableW - tabelaW) / 2;
  const colX = [];
  larguras.reduce((acc, w, i) => { colX[i] = acc; return acc + w; }, startX);

  const quebrar = (texto, col) =>
    doc.splitTextToSize(texto, Math.max(1, larguras[col] - PAD * 2));

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${_ddTitulo} — NEXO`, margem, y + 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  doc.text(
    `Gerado em ${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}  ·  ${dadosPDF.length.toLocaleString("pt-BR")} registros`,
    margem, y + 10
  );
  doc.setTextColor(0);
  y += 15;

  const desenharCabecalho = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT);
    const linhasCab = _ddColunas.map((c, i) => quebrar(_ddNomeColuna(c), i));
    const nLin = linhasCab.reduce((m, l) => Math.max(m, l.length), 1);
    const headerH = nLin * lineH + 2 * PAD;
    doc.setFillColor(30, 41, 59);
    doc.rect(startX, y, tabelaW, headerH, "F");
    doc.setTextColor(255, 255, 255);
    linhasCab.forEach((linhas, i) => {
      linhas.forEach((t, k) => {
        doc.text(t, colX[i] + PAD, y + PAD + (k + 1) * lineH - 0.6);
      });
    });
    doc.setTextColor(0, 0, 0);
    y += headerH;
  };

  desenharCabecalho();
  doc.setFontSize(FONT);
  doc.setFont("helvetica", "normal");

  dadosPDF.forEach((linha, idx) => {

    const celulas = _ddColunas.map((c, i) => quebrar(valorCelula(linha, c), i));
    const nLin = celulas.reduce((m, l) => Math.max(m, l.length), 1);
    const rowH = nLin * lineH + 2 * PAD;

    if (y + rowH > pageH - margem) {
      doc.addPage();
      y = margem;
      desenharCabecalho();
      doc.setFontSize(FONT);
      doc.setFont("helvetica", "normal");
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(startX, y, tabelaW, rowH, "F");
    }
    celulas.forEach((linhas, i) => {
      linhas.forEach((t, k) => {
        doc.text(t, colX[i] + PAD, y + PAD + (k + 1) * lineH - 0.6);
      });
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

  doc.save(`nexo-${_ddTitulo.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.pdf`);
}
