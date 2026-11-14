(function () {
  "use strict";

  if (typeof window.Shepherd === "undefined") {
    console.warn("[tour] Shepherd.js não carregado — tutorial desabilitado.");
    return;
  }

  function _paginaAtual() {
    const arq = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (arq === "" || arq === "index.html") return "index";
    return arq.replace(/\.html$/, "");
  }

  function _abrirVisitas() {
    if (typeof window.switchMainToggle === "function") {
      window.switchMainToggle("visitas");
    }
  }
  function _abrirContatos(sub) {
    if (typeof window.switchMainToggle === "function") {
      window.switchMainToggle("contatos");
    }
    const btns = document.querySelectorAll(
      "#sec-contatos .toggle-container .toggle-btn",
    );
    if (typeof window.switchSubToggle !== "function") return;
    if (sub === "cruz" && btns[1]) {
      window.switchSubToggle(btns[1], "placeholder-cruz1");
    } else if (btns[0]) {
      window.switchSubToggle(btns[0], "placeholder-central");
    }
  }

  const _passoBoasVindas = {
    title: "Bem-vindo ao NEXO 👋",
    text: "Vou te mostrar rapidamente os principais recursos desta tela. Você pode sair a qualquer momento no “×” e reabrir pelo item <strong>Tutorial</strong> na barra lateral esquerda.",

  };
  const _passoNavegacao = {
    attachTo: { element: ".nav-links", on: "right" },
    title: "Menu de navegação",
    text: "Use o menu lateral para alternar entre Início, Dashboard, Planejamento, Controle e Sincronização.",
  };
  const _passoTema = {
    attachTo: { element: "#themeToggle", on: "bottom" },
    title: "Tema claro/escuro",
    text: "Alterna entre os modos claro e escuro. A preferência fica salva neste navegador.",
  };
  const _passoVersao = {
    attachTo: { element: "#versionBadge", on: "right" },
    title: "Versão & novidades",
    text: "Mostra a versão atual. Clique para abrir o histórico de mudanças (changelog).",
    abrirSidebar: true,
  };
  const _passoPrivacidade = {
    attachTo: { element: "#btnPrivacidade", on: "bottom" },
    title: "Modo Privacidade",
    text: "Borra os dados sensíveis na tela com um clique — útil ao se ausentar de um computador compartilhado.",
  };

  const STEPS = {
    index: [
      _passoBoasVindas,
      _passoNavegacao,
      {
        attachTo: { element: ".sync-card", on: "bottom" },
        title: "Atalhos rápidos",
        text: "Estes cartões levam direto às principais telas do sistema.",
      },
      _passoTema,
      _passoVersao,
    ],
    sincronizacao: [
      _passoBoasVindas,
      {
        attachTo: { element: "#file_Empresas", on: "bottom" },
        title: "Importar a base principal",
        text: "Comece por aqui: carregue o CSV de <strong>Empresas</strong> exportado do sistema de origem. É a base obrigatória — as demais telas dependem dela.",
      },
      {
        attachTo: { element: "#file_Ocs", on: "bottom" },
        title: "Bases complementares",
        text: "Carregue também OCs, Contatos, Coordenadas, E-mails e Empresas (rede) para habilitar contagens, mapas e o módulo de Contatos.",
      },
      {
        attachTo: { element: "#status_Empresas", on: "left" },
        title: "Status de cada base",
        text: "Cada base mostra se foi importada com sucesso, a quantidade de registros e o horário da última carga.",
      },
      {
        attachTo: { element: "#btnMock", on: "bottom" },
        title: "Base de demonstração",
        text: "Gere uma base fictícia (Mock) para explorar o sistema.",
      },
      _passoNavegacao,
    ],
    controle: [
      _passoBoasVindas,
      {
        attachTo: { element: "#btn-visitas", on: "bottom" },
        title: "Aba Visitas",
        text: "A visão principal: a carteira de empresas para acompanhamento e ações em lote. Os botões abaixo alternam entre <strong>Visitas</strong> e <strong>Contatos</strong>.",
        prepare: _abrirVisitas,
      },
      {
        attachTo: { element: "#grid-visitas", on: "top" },
        title: "Grid de Visitas",
        text: "Lista as empresas da carteira. Clique nos cabeçalhos para ordenar (3 estados: crescente → decrescente → original) e arraste-os para reordenar colunas.",
        prepare: _abrirVisitas,
      },
      {
        attachTo: { element: "#grid-visitas", on: "top" },
        title: "Filtros e busca da grid",
        text: "Use o ícone de <strong>filtro</strong> em cada coluna (busca estilo Excel, seleção de valores) e a busca por CNPJ funciona com ou sem máscara. A seleção das linhas alimenta as ações em lote.",
        prepare: _abrirVisitas,
      },
      {
        attachTo: { element: 'button[onclick="limparSelecao()"]', on: "bottom" },
        title: "Seleção e limpeza",
        text: "Marque as empresas na grid para as ações em lote. Um contador mostra quantas estão selecionadas; “Limpar Seleção” zera a marcação e “Limpar Filtros” remove os filtros aplicados.",
        prepare: _abrirVisitas,
      },
      {
        attachTo: { element: 'button[onclick="openPdfModal()"]', on: "bottom" },
        title: "Gerar Documentos",
        text: "Abre o modal de geração de cartas e recibos em PDF. <strong>Modo simplificado</strong>: uma configuração para todas. <strong>Modo avançado</strong>: carta, prazo e anexos por empresa.",
        prepare: _abrirVisitas,
      },
      {
        attachTo: { element: 'button[onclick="abrirModalKml()"]', on: "bottom" },
        title: "Gerar Mapa (KML)",
        text: "Abre o modal do mapa geográfico. Você escolhe as camadas (status, categoria, OC, contato…) e a <strong>precisão geográfica exigida</strong> dos pontos antes de exportar para o Google Earth/Maps.",
        prepare: _abrirVisitas,
      },
      {
        attachTo: { element: 'button[onclick="exportarGridCSV()"]', on: "bottom" },
        title: "Exportar e colunas",
        text: "Baixe a grid em <strong>CSV</strong> (pronto para Excel pt-BR) ou <strong>PDF</strong>, e use “Colunas” para escolher quais campos exibir — a preferência fica salva neste navegador.",
        prepare: _abrirVisitas,
      },

      {
        attachTo: { element: "#btn-contatos", on: "bottom" },
        title: "Aba Contatos",
        text: "Reúne o cruzamento de dados para abordagem centralizada. Tem duas sub-abas: <strong>Contato Centralizada</strong> e <strong>Busca de vínculos</strong>.",
        prepare: () => _abrirContatos("central"),
      },
      {
        attachTo: { element: "#placeholder-central", on: "top" },
        title: "Contato Centralizada",
        text: "Agrupa empresas que compartilham a mesma empresa representante (matriz, administradora ou holding), permitindo gerar cartas em lote para o representante — um único canal cobre várias empresas.",
        prepare: () => _abrirContatos("central"),
        mesmoOculto: true,
      },
      {
        attachTo: { element: "#placeholder-cruz1", on: "top" },
        title: "Busca de vínculos",
        text: "Detecta vínculos entre empresas por <strong>telefone</strong>, <strong>e-mail</strong> e <strong>nome de contato</strong> em comum. Útil para descobrir relações não óbvias e priorizar contatos. As grids têm filtro inline, ordenação e cabeçalho fixo.",
        prepare: () => _abrirContatos("cruz"),
        mesmoOculto: true,
      },
      _passoPrivacidade,
      _passoNavegacao,
    ],
    dashboard: [
      _passoBoasVindas,
      {
        attachTo: { element: "#filterGeral", on: "bottom" },
        title: "Filtro por analista",
        text: "Restringe todos os indicadores a um responsável específico, ou veja a unidade inteira.",
      },
      {
        attachTo: { element: "#kpiTotal", on: "bottom" },
        title: "Cartões de indicador",
        text: "Cada cartão (Total, Respondidas, Prazo Vencido, OCs) é <strong>clicável</strong>: abre uma sub-tela de drill-down com gráficos navegáveis e a grid detalhada (exportável em PDF/CSV).",
      },
      {
        attachTo: { element: "#kpiPercTrabalho", on: "bottom" },
        title: "Indicadores percentuais",
        text: "Percentuais de trabalho, atraso, associação e resposta via OC — leitura rápida da saúde da carteira.",
      },
      {
        attachTo: { element: "#chartTrabalhoAnalista", on: "top" },
        title: "Produtividade por analista",
        text: "Carga e andamento de cada analista. Os rótulos se ajustam ao tema claro/escuro.",
      },
      {
        attachTo: { element: "#chartFinalizadasPendente", on: "top" },
        title: "Finalizadas × pendentes",
        text: "Comparativo do que já foi concluído frente ao que ainda falta na carteira.",
      },
      {
        attachTo: { element: "#btnInverterEixo", on: "bottom" },
        title: "Ajustes dos gráficos",
        text: "Inverta o eixo dos gráficos e reponha a seleção de analistas quando precisar de outra leitura.",
      },
      _passoPrivacidade,
      _passoNavegacao,
    ],
    planejamento: [
      _passoBoasVindas,
      {
        attachTo: { element: "#filterPlanejamento", on: "bottom" },
        title: "Filtro do planejamento",
        text: "Foque a análise em um analista ou veja a unidade inteira (modo Unidade agrega as OCs corretamente).",
      },
      {
        attachTo: { element: "#btnFocoRespostas", on: "bottom" },
        title: "Foco da análise",
        text: "Alterne entre o foco em <strong>Respostas</strong> e em <strong>Acordos</strong> para recalcular metas e projeções.",
      },
      {
        attachTo: { element: "#inputDiasRestantes", on: "bottom" },
        title: "Parâmetros do período",
        text: "Informe os dias trabalhados e os dias restantes — eles alimentam as metas diárias e a projeção de fechamento.",
      },
      {
        attachTo: { element: "#checkContatos", on: "bottom" },
        title: "Considerar contatos",
        text: "Inclui (ou não) as contatos em andamento no cálculo do volume realizado.",
      },
      {
        attachTo: { element: "#kpiVelocidade", on: "bottom" },
        title: "Metas e ritmo",
        text: "Velocidade necessária por dia, projeção de fechamento e ritmo de recuperação (catch-up) da resposta.",
      },
      {
        attachTo: { element: "#chartTendencia", on: "top" },
        title: "Gráfico de tendência",
        text: "Compara o realizado com a linha ideal (que parte do dia 1 e atinge 100% no último dia). Ajuda a antecipar riscos de prazo.",
      },
      {
        attachTo: { element: "#alertaRisco", on: "bottom" },
        title: "Alerta de risco",
        text: "Sinaliza quando o ritmo atual coloca o prazo em risco, para você reagir a tempo.",
      },
      {
        attachTo: { element: "#gridCalendario", on: "top" },
        title: "Calendário de metas",
        text: "Distribui a meta pelos dias úteis restantes, considerando os feriados.",
      },
      _passoPrivacidade,
      _passoNavegacao,
    ],
    configuracoes: [
      _passoBoasVindas,
      {
        attachTo: { element: "#cfgTabs", on: "bottom" },
        title: "Abas de configuração",
        text: "Geral, Equipe, Geolocalização, Planejamento e Exportar/Importar — tudo que alimenta cartas, recibos e os cálculos das demais telas fica centralizado aqui.",
        prepare: () => _trocarAbaConfig("geral"),
      },
      {
        attachTo: { element: "#painelDadosUnidade", on: "top" },
        title: "Identificação da unidade",
        text: "Nome, UF, endereço, chefe e assinatura aparecem em toda carta e recibo gerados. Os campos marcados com <strong>*</strong> são obrigatórios — sem eles, o sistema bloqueia a geração de documentos com dados genéricos.",
        prepare: () => _trocarAbaConfig("geral"),
      },
      {
        attachTo: { element: "#painelEquipe", on: "top" },
        title: "Quadro de Equipe",
        text: "Lista os analistas usados nos filtros e indicadores do Dashboard e do Planejamento — sem ao menos um cadastrado, as duas telas ficam bloqueadas. É preenchido sozinho ao importar a Listagem de Empresas pela 1ª vez; o botão \"Buscar analistas da listagem\" repete a busca quando precisar.",
        prepare: () => _trocarAbaConfig("equipe"),
        mesmoOculto: true,
      },
      {
        attachTo: { element: "#painelGeolocalizacao", on: "top" },
        title: "Geolocalização (GeoBase)",
        text: "Gera o dicionário de coordenadas aproximadas usado no KML — depende da UF (aba Geral) para oferecer a lista de municípios da área de atuação.",
        prepare: () => _trocarAbaConfig("geolocalizacao"),
        mesmoOculto: true,
      },
      {
        attachTo: { element: "#painelPlanejamento", on: "top" },
        title: "Prazos e feriados",
        text: "Datas de início, prazos finais e feriados alimentam o cálculo de dias úteis e metas do Planejamento.",
        prepare: () => _trocarAbaConfig("planejamento"),
        mesmoOculto: true,
      },
      {
        attachTo: { element: "#painelExportar", on: "top" },
        title: "Exportar/Importar",
        text: "Repasse a configuração completa (ou por seção) a um colega da mesma unidade — cada instalação/navegador mantém a própria cópia local.",
        prepare: () => _trocarAbaConfig("exportar"),
        mesmoOculto: true,
      },
      _passoNavegacao,
    ],
  };

  function _injetarTema() {
    if (document.getElementById("nexo-tour-theme")) return;
    const st = document.createElement("style");
    st.id = "nexo-tour-theme";

    st.textContent = `
      .shepherd-element.nexo-shepherd {
        background: var(--color-surface, #fff) !important;
        color: var(--color-text, #1e293b);
        border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.30);
        max-width: 360px;
      }
      .nexo-shepherd .shepherd-content { border-radius: 10px; overflow: hidden; }
      .nexo-shepherd .shepherd-arrow:before { background: var(--color-primary, #1e3a8a) !important; }
      .nexo-shepherd .shepherd-header {
        background: var(--color-primary, #1e3a8a) !important;
        background-image: none !important;
        border-radius: 10px 10px 0 0;
        padding: 12px 16px !important;
      }
      .nexo-shepherd .shepherd-title { color: #fff !important; font-weight: 700; font-size: 1rem; }
      .nexo-shepherd .shepherd-cancel-icon { color: rgba(255,255,255,0.9) !important; }
      .nexo-shepherd .shepherd-cancel-icon:hover { color: #fff !important; }
      .nexo-shepherd .shepherd-text {
        color: var(--color-text, #1e293b) !important;
        font-size: 0.92rem; line-height: 1.5; padding: 14px 16px;
      }
      .nexo-shepherd .shepherd-footer { padding: 0 16px 14px; gap: 8px; }
      .nexo-shepherd .shepherd-button {
        background: var(--color-primary, #1e3a8a) !important; color: #fff !important;
        border-radius: 6px; font-weight: 600; padding: 7px 14px; border: none;
      }
      .nexo-shepherd .shepherd-button:hover { filter: brightness(1.08); opacity: 1; }
      .nexo-shepherd .shepherd-button.nexo-btn-sec {
        background: transparent !important; color: var(--color-text-muted, #64748b) !important;
        border: 1px solid var(--color-border, #cbd5e1);
      }
    `;

    document.head.appendChild(st);
  }

  function _construirTour(passos) {
    const tour = new window.Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: "nexo-shepherd",
        scrollTo: { behavior: "smooth", block: "center" },
        cancelIcon: { enabled: true },
        modalOverlayOpeningPadding: 6,
        modalOverlayOpeningRadius: 6,
      },
    });

    tour.on("show", (e) => {

      const atual = e?.step?.el;
      document.querySelectorAll(".shepherd-element").forEach((el) => {
        if (el !== atual) el.remove();
      });
    });

    const validos = passos.filter((p) => {
      if (!p.attachTo) return true;
      const el = document.querySelector(p.attachTo.element);
      if (!el) return false;

      if (p.abrirSidebar || p.mesmoOculto) return true;
      return el.getClientRects().length > 0;
    });
    if (validos.length === 0) return null;

    validos.forEach((p, i) => {
      const botoes = [];
      if (i > 0) {
        botoes.push({
          text: "Voltar",
          classes: "nexo-btn-sec",
          action: () => tour.back(),
        });
      }
      botoes.push({
        text: i === validos.length - 1 ? "Concluir" : "Próximo",
        action: () => (i === validos.length - 1 ? tour.complete() : tour.next()),
      });
      const step = {
        id: "passo-" + i,
        title: p.title,
        text: p.text,
        attachTo: p.attachTo,
        buttons: botoes,
      };

      if (p.abrirSidebar || p.prepare) {
        step.beforeShowPromise = () =>
          new Promise((resolve) => {
            if (p.abrirSidebar) {

              const sb = document.getElementById("sidebar");
              if (sb) {
                sb.style.transition = "none";
                sb.classList.remove("collapsed");
                void sb.offsetWidth;
                requestAnimationFrame(() => { sb.style.transition = ""; });
              }
            }
            let espera = 0;
            if (p.prepare) {
              try {
                p.prepare();
                espera = 280;
              } catch (e) {

              }
            }
            espera ? setTimeout(resolve, espera) : resolve();
          });
      }
      tour.addStep(step);
    });

    return tour;
  }

  const _flagDe = (pag) => "tourVisto_" + pag;

  function iniciarTour(forcado) {
    const pag = _paginaAtual();
    const passos = STEPS[pag];
    if (!passos) return;

    if (window.Shepherd.activeTour) window.Shepherd.activeTour.cancel();
    _injetarTema();
    const tour = _construirTour(passos);
    if (!tour) return;
    const encerrar = () => {
      localStorage.setItem(_flagDe(pag), "1");

      if (pag === "controle") _abrirVisitas();

      if (pag === "configuracoes" && typeof _trocarAbaConfig === "function") {
        _trocarAbaConfig("geral");
      }
    };
    tour.on("complete", encerrar);
    tour.on("cancel", encerrar);
    tour.start();
  }
  window.iniciarTourNEXO = iniciarTour;

  function _criarBotaoAjuda() {
    let a = document.getElementById("nexo-tour-help");
    if (!a) {
      const nav = document.querySelector("#sidebar .nav-links");
      if (!nav) return;

      const li = document.createElement("li");
      li.className = "nexo-tour-help-item";

      a = document.createElement("a");
      a.href = "#";
      a.id = "nexo-tour-help";
      a.setAttribute("data-tooltip", "Tutorial");
      a.setAttribute("aria-label", "Abrir tutorial desta tela");
      a.title = "Tutorial desta tela";
      a.innerHTML = '<i class="fas fa-circle-question"></i><span>Tutorial</span>';

      li.appendChild(a);
      nav.appendChild(li);
    }
    a.addEventListener("click", (e) => {
      e.preventDefault();
      iniciarTour(true);
    });
  }

  function _bootstrap() {
    const pag = _paginaAtual();
    if (!STEPS[pag]) return;
    _injetarTema();
    _criarBotaoAjuda();

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _bootstrap);
  } else {
    _bootstrap();
  }
})();
