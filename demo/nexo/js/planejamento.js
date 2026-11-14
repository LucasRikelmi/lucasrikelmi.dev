document.addEventListener("nexo:dados-prontos", () => {

  if (typeof MotorRegras !== "undefined" && (!MotorRegras.equipeAtiva || MotorRegras.equipeAtiva.length === 0)) {
    if (typeof NexoModal !== "undefined") {
      NexoModal.alert(
        "Equipe não configurada",
        "O Planejamento organiza metas e calendário por analista e nenhum analista está cadastrado. Acesse o ícone de Configurações, no rodapé da barra lateral, aba Equipe, e cadastre o quadro de analistas antes de continuar.",
        "aviso",
      );
    }
    return;
  }

  const HOJE = new Date();
  HOJE.setHours(0, 0, 0, 0);

  let estadoPlan = {
    foco: "acordos",
    considerarContatos: false,
    analista: "GERAL",
    diasTrabalhados: 1,
    diasRestantes: 20,
    stepGrafico: 1,
  };

  let calMonth = HOJE.getMonth();
  let calYear = HOJE.getFullYear();

  let ultimoDiaClicado = null;
  let diasSelecionados = new Set();
  let domDias = [];

  const feriadosConfig =
    typeof CONFIG_PLANEJAMENTO !== "undefined" ? CONFIG_PLANEJAMENTO.feriados : {};

  function getFeriado(data) {
    const iso =
      `${data.getFullYear()}-` +
      `${String(data.getMonth() + 1).padStart(2, "0")}-` +
      `${String(data.getDate()).padStart(2, "0")}`;
    return feriadosConfig[iso] || null;
  }

  function isFuturo(data) {
    const d = new Date(data);
    d.setHours(0, 0, 0, 0);
    return d > HOJE;
  }

  const btnAcordos = document.getElementById("btnFocoAcordos");
  const btnRespostas = document.getElementById("btnFocoRespostas");
  const checkContatos = document.getElementById("checkContatos");
  const labelContatos = checkContatos.parentElement;
  const selectFiltro = document.getElementById("filterPlanejamento");

  MotorRegras.equipeAtiva.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    selectFiltro.appendChild(opt);
  });
  const boxMedia = document.getElementById("mediaPeriodoBox");
  const spanMedia = document.getElementById("valorMediaPeriodo");

  let chartInstancia = null;

  const canvasContainer = document.querySelector(".canvas-container-lg");

  canvasContainer.addEventListener(
    "wheel",
    async (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        estadoPlan.stepGrafico = Math.max(1, estadoPlan.stepGrafico - 1);
      } else {
        estadoPlan.stepGrafico = Math.min(10, estadoPlan.stepGrafico + 1);
      }
      atualizarPainel(false);
    },
    { passive: false },
  );

  function calcularDiasUteis(dataInicio, dataFim) {
    let count = 0;
    let cur = new Date(dataInicio);
    cur.setHours(0, 0, 0, 0);
    const fim = new Date(dataFim);
    fim.setHours(0, 0, 0, 0);
    while (cur <= fim) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6 && !getFeriado(cur)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  function gerarDatasReaisParaGrafico(dataInicio, limiteDias) {
    const dates = [];
    const cur = new Date(dataInicio);
    while (dates.length < limiteDias && dates.length < 300) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6 && !getFeriado(cur)) {
        const dia = cur.getDate().toString().padStart(2, "0");
        const mes = (cur.getMonth() + 1).toString().padStart(2, "0");
        dates.push(`${dia}/${mes}`);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  const DATA_INICIO_PLANEJAMENTO =
    typeof ConfigPlanejamento !== "undefined"
      ? ConfigPlanejamento.paraDate(CONFIG_PLANEJAMENTO.dataInicio)
      : new Date(2026, 3, 7);

  function obterFimPrazo() {
    if (typeof ConfigPlanejamento === "undefined") {
      return estadoPlan.foco === "acordos" ? new Date(2026, 5, 30) : new Date(2026, 9, 30);
    }
    return ConfigPlanejamento.paraDate(
      estadoPlan.foco === "acordos"
        ? CONFIG_PLANEJAMENTO.prazoFinalAcordos
        : CONFIG_PLANEJAMENTO.prazoFinalRespostas,
    );
  }

  function atualizarDiasAutomaticos() {
    const dataInicio = DATA_INICIO_PLANEJAMENTO;
    const fimPrazo = obterFimPrazo();

    let limiteHoje = HOJE > fimPrazo ? new Date(fimPrazo) : new Date(HOJE);
    if (limiteHoje < dataInicio) limiteHoje = new Date(dataInicio);

    estadoPlan.diasTrabalhados = calcularDiasUteis(dataInicio, limiteHoje) || 1;

    const amanha = new Date(limiteHoje);
    amanha.setDate(amanha.getDate() + 1);

    estadoPlan.diasRestantes = calcularDiasUteis(amanha, fimPrazo);
  }

  function agregarDadosUnidade(empresas) {

    const equipe = [...MotorRegras.equipeAtiva];
    if (empresas["SEM ANALISTA"] && empresas["SEM ANALISTA"].total > 0) {
      equipe.push("SEM ANALISTA");
    }
    const agregado = {
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
    };
    equipe.forEach((nome) => {
      const tec = empresas[nome];
      if (!tec) return;
      Object.keys(agregado).forEach((k) => {
        agregado[k] += tec[k] || 0;
      });
    });
    return agregado;
  }

  async function obterVolumePendencia() {
    try {
      if (typeof MotorRegras !== "undefined") {
        const dados = await MotorRegras.processar();
        if (dados) {
          const emp =
            estadoPlan.analista === "GERAL"
              ? agregarDadosUnidade(dados.empresas)
              : dados.empresas[estadoPlan.analista];
          if (emp) {

            if (estadoPlan.foco === "acordos") {

              const vol =
                emp.agendada +
                emp.prazoVencido +
                emp.estendida +
                emp.lembrete +
                emp.formalizada +
                emp.respondida +
                (estadoPlan.considerarContatos ? emp.contatada : 0);
              const pend = Math.max(0, emp.total - vol);
              return { vol, pend };
            } else {

              const vol = emp.respondida;
              const pend = Math.max(0, emp.total - vol);
              return { vol, pend };
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Planejamento] MotorRegras indisponível, usando mock:", e);
    }

    let vol = 45;
    const pend = 150;
    if (estadoPlan.considerarContatos) vol += 30;
    return { vol, pend };
  }

  function _animarCanvas(direcao) {
    if (canvasContainer) {
      canvasContainer.classList.remove("section-slide-left", "section-slide-right");
      void canvasContainer.offsetWidth;
      canvasContainer.classList.add(direcao === "right" ? "section-slide-right" : "section-slide-left");
    }
  }

  btnAcordos.addEventListener("click", async () => {
    estadoPlan.foco = "acordos";
    btnAcordos.classList.add("active");
    btnRespostas.classList.remove("active");
    labelContatos.style.visibility = "visible";
    atualizarDiasAutomaticos();
    await atualizarPainel();
    _animarCanvas("left");
  });

  btnRespostas.addEventListener("click", async () => {
    estadoPlan.foco = "respostas";
    btnRespostas.classList.add("active");
    btnAcordos.classList.remove("active");
    labelContatos.style.visibility = "hidden";
    checkContatos.checked = false;
    estadoPlan.considerarContatos = false;
    atualizarDiasAutomaticos();
    await atualizarPainel();
    _animarCanvas("right");
  });

  checkContatos.addEventListener("change", (e) => {
    estadoPlan.considerarContatos = e.target.checked;
    atualizarPainel();
  });

  selectFiltro.addEventListener("change", (e) => {
    estadoPlan.analista = e.target.value;
    atualizarPainel();
  });

  async function atualizarPainel(recriarCalendario = true) {
    const { vol: volumeRealizado, pend: pendenciaRestante } =
      await obterVolumePendencia();

    const velocidadeDia = (
      volumeRealizado / estadoPlan.diasTrabalhados
    ).toFixed(1);

    const catchupNecessario = (
      estadoPlan.diasRestantes > 0
        ? pendenciaRestante / estadoPlan.diasRestantes
        : pendenciaRestante
    ).toFixed(1);

    const projecaoFim = Math.min(
      Math.round(volumeRealizado + parseFloat(velocidadeDia) * estadoPlan.diasRestantes),
      volumeRealizado + pendenciaRestante,
    );

    document.getElementById("kpiVelocidade").innerHTML =
      `${velocidadeDia} <span style="font-size: 1rem; color: var(--text-muted);">/dia</span>`;
    document.getElementById("kpiCatchup").innerHTML =
      `${catchupNecessario} <span style="font-size: 1rem; color: var(--text-muted);">/dia</span>`;
    document.getElementById("kpiProjecao").innerHTML =
      `${projecaoFim} <span style="font-size: 1rem; color: var(--text-muted);">entregas</span>`;

    const alerta = document.getElementById("alertaRisco");
    const cardCatchup = document.getElementById("cardCatchup");

    if (parseFloat(catchupNecessario) >= 8) {
      alerta.style.display = "block";
      cardCatchup.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
    } else {
      alerta.style.display = "none";
      cardCatchup.style.backgroundColor = "var(--bg-surface)";
    }

    renderizarGraficoTendencia(
      parseFloat(velocidadeDia),
      parseFloat(catchupNecessario),
      volumeRealizado + pendenciaRestante,
    );

    if (recriarCalendario) {
      ultimoDiaClicado = null;
      diasSelecionados.clear();
      boxMedia.style.display = "none";
      await renderizarCalendario();
    }
  }

  const ALTURA_GRAFICO = 300;

  function renderizarGraficoTendencia(velAtual, velIdeal, totalVol) {
    const canvas = document.getElementById("chartTendencia");
    if (chartInstancia) {
      chartInstancia.destroy();
      chartInstancia = null;
    }

    const labelsCompletas = gerarDatasReaisParaGrafico(
      DATA_INICIO_PLANEJAMENTO,
      estadoPlan.diasTrabalhados,
    );

    const dadosRealizados = labelsCompletas.map((_, i) =>
      Math.min(Math.round(velAtual * (i + 1)), totalVol || Infinity),
    );

    const fimPrazo = obterFimPrazo();
    const diasUteisPrazoOriginal = Math.max(
      1,
      calcularDiasUteis(DATA_INICIO_PLANEJAMENTO, fimPrazo),
    );
    const velIdealTotal = totalVol ? totalVol / diasUteisPrazoOriginal : velIdeal;
    const dadosIdeais = labelsCompletas.map((_, i) =>
      Math.min(Math.round(velIdealTotal * (i + 1)), totalVol || Infinity),
    );

    const step = estadoPlan.stepGrafico;
    const labelsStep = [],
      realStep = [],
      idealStep = [],
      indicesStep = [];
    for (let i = 0; i < labelsCompletas.length; i += step) {
      labelsStep.push(labelsCompletas[i]);
      realStep.push(dadosRealizados[i]);
      idealStep.push(dadosIdeais[i]);
      indicesStep.push(i);
    }

    const idxCorteExtra = indicesStep.findIndex(
      (i) => i + 1 > diasUteisPrazoOriginal,
    );
    const COR_REALIZADO = "#3b82f6";
    const COR_REALIZADO_EXTRA = "#10b981";
    const COR_IDEAL_ESTAGNADO = "#f59e0b";
    const _aposCorte = (ctx) => idxCorteExtra !== -1 && ctx.p1DataIndex >= idxCorteExtra;

    const ppp = 55;
    const larguraMinima = canvasContainer.clientWidth;
    const larguraDinamica = Math.max(labelsStep.length * ppp, larguraMinima);

    canvas.width = larguraDinamica;
    canvas.height = ALTURA_GRAFICO;
    canvas.style.width = larguraDinamica + "px";
    canvas.style.height = ALTURA_GRAFICO + "px";

    chartInstancia = new Chart(canvas, {
      type: "line",
      data: {
        labels: labelsStep,
        datasets: [
          {
            label: "Realizado Acumulado",
            data: realStep,
            borderColor: COR_REALIZADO,
            backgroundColor: "rgba(59, 130, 246, 0.1)",

            segment: {
              borderColor: (ctx) => (_aposCorte(ctx) ? COR_REALIZADO_EXTRA : COR_REALIZADO),
            },
            fill: true,
            tension: 0.4,
            pointRadius: (ctx) => (idxCorteExtra !== -1 && ctx.dataIndex >= idxCorteExtra ? 4 : 3),
            pointBackgroundColor: (ctx) =>
              idxCorteExtra !== -1 && ctx.dataIndex >= idxCorteExtra ? COR_REALIZADO_EXTRA : COR_REALIZADO,
            borderWidth: 2,
          },
          {
            label: "Meta Ideal Acumulada",
            data: idealStep,
            borderColor: "#ef4444",
            borderDash: [5, 5],

            segment: {
              borderColor: (ctx) => (_aposCorte(ctx) ? COR_IDEAL_ESTAGNADO : "#ef4444"),
              borderDash: (ctx) => (_aposCorte(ctx) ? [2, 3] : [5, 5]),
            },
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label(context) {
                const val = context.raw;
                const ideal = idealStep[context.dataIndex] || 1;
                const pct = ((val / ideal) * 100).toFixed(0);
                return `${context.dataset.label}: ${val} (${pct}% da meta | Ideal: ${ideal})`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true },
            grid: { color: "rgba(128,128,128,0.1)" },
          },
          y: {
            ticks: { font: { size: 10 } },
            grid: { color: "rgba(128,128,128,0.1)" },
          },
        },
      },
    });

    setTimeout(() => {
      canvasContainer.scrollLeft = canvasContainer.scrollWidth;
    }, 50);
  }

  async function obterDadosCalendario() {
    try {
      if (typeof MotorRegras !== "undefined") {
        const dados = await MotorRegras.processar();
        if (dados) {
          const chave =
            estadoPlan.analista === "GERAL" ? "GERAL" : estadoPlan.analista;
          if (estadoPlan.foco === "acordos") {
            return {
              principal: dados.calContatoReal[chave] || {},
              secundario: dados.calContato[chave] || {},
              temDados: true,
            };
          } else {
            return {
              principal: dados.calResposta[chave] || {},
              secundario: {},
              temDados: true,
            };
          }
        }
      }
    } catch (e) {
      console.warn("[Calendário] MotorRegras indisponível:", e);
    }
    return { principal: {}, secundario: {}, temDados: false };
  }

  async function renderizarCalendario() {
    const grid = document.getElementById("gridCalendario");
    if (!grid) return;
    grid.innerHTML = "";
    grid.style.display = "block";

    domDias = [];

    const dados =
      typeof MotorRegras !== "undefined" ? await MotorRegras.processar() : null;
    let principal = {},
      secundario = {};

    if (dados) {
      if (estadoPlan.foco === "acordos") {
        principal = dados.calContatoReal[estadoPlan.analista] || {};
        secundario = dados.calContato[estadoPlan.analista] || {};
      } else {
        principal = dados.calResposta[estadoPlan.analista] || {};
      }
    }

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;margin-bottom:5px";

    const btnPrev = document.createElement("button");
    btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnPrev.className = "icon-btn interativo";
    btnPrev.onclick = async () => {
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
      _resetCalState();
      await renderizarCalendario();
    };

    const btnNext = document.createElement("button");
    btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnNext.className = "icon-btn interativo";
    btnNext.onclick = async () => {
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
      _resetCalState();
      await renderizarCalendario();
    };

    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const monthLabel = document.createElement("h3");
    monthLabel.innerText = `${monthNames[calMonth]} de ${calYear}`;
    monthLabel.style.cssText = "margin:0;font-weight:600;font-size:1rem";

    header.appendChild(btnPrev);
    header.appendChild(monthLabel);
    header.appendChild(btnNext);
    grid.appendChild(header);

    const legenda = document.createElement("div");
    legenda.style.cssText =
      "display:flex;gap:12px;justify-content:center;font-size:0.72rem;color:var(--text-muted);margin-bottom:15px;flex-wrap:wrap";
    legenda.innerHTML = `
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:50%;background:var(--color-primary);display:inline-block"></span> Produtivo</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:50%;border:1.5px solid rgba(239,68,68,0.6);display:inline-block"></span> Dia zerado</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:50%;background:#8b5cf6;display:inline-block"></span> Extra (FDS/Feriado)</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;border:1.5px solid #fbbf24;background:rgba(251,191,36,0.2);display:inline-block"></span> Selecionado</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:50%;border:1px dashed var(--text-muted);display:inline-block;opacity:.6"></span> Futuro / Sem dados</span>
    `;
    grid.appendChild(legenda);

    const daysGrid = document.createElement("div");
    daysGrid.style.cssText =
      "display:grid;grid-template-columns:repeat(7,1fr);gap:10px";

    ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].forEach((wd) => {
      const d = document.createElement("div");
      d.innerText = wd;
      d.style.cssText =
        "text-align:center;font-weight:700;font-size:0.75rem;color:var(--text-muted)";
      daysGrid.appendChild(d);
    });

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

    for (let i = 1 - firstDay; i <= daysInMonth + remainingCells; i++) {
      const dataAtual = new Date(calYear, calMonth, i);
      const diaVerdadeiro = dataAtual.getDate();
      const diaSemana = dataAtual.getDay();
      const isGhost = i < 1 || i > daysInMonth;
      const nomeFeriado =
        typeof getFeriado === "function" ? getFeriado(dataAtual) : null;
      const ehFolga =
        diaSemana === 0 || diaSemana === 6 || nomeFeriado !== null;

      const ehFuturo =
        typeof isFuturo === "function" ? isFuturo(dataAtual) : dataAtual > HOJE;
      const ehAntesDeAbril = dataAtual < new Date(2026, 3, 1);
      const isForaDoEscopo = ehFuturo || ehAntesDeAbril;

      const diaBox = document.createElement("div");
      diaBox.className = "cal-dia-box";

      if (isGhost) diaBox.classList.add("ghost-day");
      if (isForaDoEscopo) diaBox.classList.add("fora-escopo");

      const numDia = document.createElement("span");
      numDia.innerText = diaVerdadeiro;
      numDia.style.cssText = "font-size:1.2rem; font-weight:700;";
      diaBox.appendChild(numDia);

      const diaStr = String(diaVerdadeiro).padStart(2, "0");
      const mesStr = String(dataAtual.getMonth() + 1).padStart(2, "0");
      const chaveData = `${diaStr}/${mesStr}`;

      let totalDia = 0;
      let contatadasReal = 0;
      let contatadasPlano = 0;
      let respondidas = 0;

      if (dados) {
        if (estadoPlan.foco === "acordos") {
          contatadasReal = principal[chaveData] || 0;
          contatadasPlano = secundario[chaveData] || 0;
          totalDia =
            contatadasReal +
            (estadoPlan.considerarContatos ? contatadasPlano : 0);
        } else {
          respondidas = principal[chaveData] || 0;
          totalDia = respondidas;
        }
      }

      const diaInativo = ehFolga && totalDia === 0;
      if (diaInativo) diaBox.classList.add("dia-inativo");

      if ((isGhost || isForaDoEscopo || diaInativo) && totalDia === 0) {
        if (nomeFeriado) {
          const tag = document.createElement("span");
          tag.className = "tag-feriado";
          tag.innerText = nomeFeriado;
          diaBox.appendChild(tag);
        }
        domDias.push({ el: diaBox, vazio: true });
        daysGrid.appendChild(diaBox);
        continue;
      }

      if ((isForaDoEscopo || isGhost) && totalDia > 0) {
        diaBox.classList.add("milagre-dados");
      }

      const indiceDom = domDias.length;
      diaBox.style.cursor = "pointer";
      diaBox.dataset.valorDia = totalDia;

      if (nomeFeriado) {
        const tag = document.createElement("span");
        tag.className = "tag-feriado";
        tag.innerText = nomeFeriado;
        diaBox.appendChild(tag);
      }

      if (estadoPlan.foco === "acordos") {
        const linhaPlano = estadoPlan.considerarContatos
          ? `\nEmpresas Contatadas: ${contatadasPlano}`
          : "";
        const linhaTotal = estadoPlan.considerarContatos
          ? `\n─────\nTotal: ${totalDia}`
          : "";
        diaBox.title = `Empresas Agendadas: ${contatadasReal}${linhaPlano}${linhaTotal}`;
      } else {
        diaBox.title = `Empresas Respondidas: ${respondidas}`;
      }

      const centerBadge = document.createElement("div");
      centerBadge.style.cssText =
        "margin:auto;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:bold;font-size:0.9rem";

      if (totalDia > 0) {
        centerBadge.innerText = totalDia;
        centerBadge.style.color = "#fff";
        if (ehFolga) {
          diaBox.classList.add("extra-prod");
          centerBadge.style.backgroundColor = "#8b5cf6";
          numDia.style.color = document.body.classList.contains("dark-mode")
            ? "#f8fafc"
            : "#111";
        } else {
          centerBadge.style.backgroundColor = "var(--color-primary)";
          if (totalDia > 4 && totalDia <= 9)
            diaBox.classList.add("bg-low-prod");
          else if (totalDia > 9) diaBox.classList.add("bg-high-prod");
        }
      } else {
        diaBox.classList.add("zero-prod");
        centerBadge.innerText = "0";
        centerBadge.style.color = "var(--text-muted)";
        centerBadge.style.backgroundColor = "transparent";
        centerBadge.style.border = "1.5px solid rgba(239, 68, 68, 0.5)";
        numDia.style.color = "var(--text-main)";
      }

      diaBox.appendChild(centerBadge);

      diaBox.addEventListener("mouseover", () => {
        if (!diaBox.classList.contains("selected"))
          diaBox.style.transform = "translateY(-3px)";
      });
      diaBox.addEventListener("mouseout", () => {
        if (!diaBox.classList.contains("selected"))
          diaBox.style.transform = "translateY(0)";
      });

      diaBox.addEventListener("click", (e) => {

        if (window.getSelection) window.getSelection().removeAllRanges();

        if (e.shiftKey && ultimoDiaClicado !== null) {
          const min = Math.min(ultimoDiaClicado, indiceDom);
          const max = Math.max(ultimoDiaClicado, indiceDom);

          const isSelecionando = !diasSelecionados.has(indiceDom);

          for (let k = min; k <= max; k++) {
            if (domDias[k] && !domDias[k].vazio) {
              if (isSelecionando) {
                diasSelecionados.add(k);
                domDias[k].el.classList.add("selected");
              } else {
                diasSelecionados.delete(k);
                domDias[k].el.classList.remove("selected");
              }
            }
          }

          ultimoDiaClicado = indiceDom;
        } else {

          if (diasSelecionados.has(indiceDom)) {
            diasSelecionados.delete(indiceDom);
            diaBox.classList.remove("selected");
            ultimoDiaClicado = null;
          } else {
            diasSelecionados.add(indiceDom);
            diaBox.classList.add("selected");
            ultimoDiaClicado = indiceDom;
          }
        }

        if (typeof calcularMediaSelecao === "function") calcularMediaSelecao();
      });

      domDias.push({ el: diaBox, vazio: false });
      daysGrid.appendChild(diaBox);
    }

    grid.appendChild(daysGrid);
  }

  function _resetCalState() {
    ultimoDiaClicado = null;
    diasSelecionados.clear();
    boxMedia.style.display = "none";
  }

  function calcularMediaSelecao() {
    if (diasSelecionados.size === 0) {
      boxMedia.style.display = "none";
      return;
    }

    let somaTotal = 0;
    diasSelecionados.forEach((indice) => {
      somaTotal += parseInt(domDias[indice]?.el?.dataset?.valorDia) || 0;
    });

    const media = (somaTotal / diasSelecionados.size).toFixed(1);
    boxMedia.style.display = "block";
    spanMedia.innerText = media;

    boxMedia.style.transform = "scale(1.05)";
    setTimeout(() => {
      boxMedia.style.transform = "scale(1)";
    }, 150);
  }

  atualizarDiasAutomaticos();
  atualizarPainel();
});
