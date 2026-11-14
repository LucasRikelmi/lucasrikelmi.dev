document.addEventListener("nexo:dados-prontos", () => {

  function statusInfo(el, texto)    { el.textContent = texto; el.style.color = ""; }
  function statusSucesso(el, texto) { el.textContent = "✅ " + texto; el.style.color = "#10b981"; }
  function statusErro(el, texto)    { el.textContent = "⚠️ " + texto; el.style.color = "#ef4444"; }
  function statusAviso(el, texto)   { el.textContent = "⚠️ " + texto; el.style.color = "#f59e0b"; }

  function atualizarTimestamp(tipo) {
    const el = document.getElementById("ts_" + tipo);
    if (!el) return;
    const ts = UploadManager.lerTimestamp(tipo);
    el.textContent = ts
      ? "Último upload realizado em " + ts
      : "";
  }

  function restaurarEstadoCarregado(tipo) {
    const statusEl = document.getElementById("status_" + tipo);
    if (!statusEl) return;
    const contrato = ContratosArquivo[tipo];
    if (!localStorage.getItem(contrato.chaveStorage)) return;
    const prefixoMock = MockManager.ativo() ? "[MOCK] " : "";
    statusSucesso(statusEl, `${prefixoMock}${contrato.rotulo} carregada.`);
  }

  Object.keys(ContratosArquivo).forEach((tipo) => {
    atualizarTimestamp(tipo);
    restaurarEstadoCarregado(tipo);
  });

  if (MockManager.ativo()) {
    document.querySelectorAll(".sync-card").forEach(card => {
      card.classList.add("mock-ativo");
    });
  }

  async function handleUpload(file, tipo) {
    const statusEl = document.getElementById("status_" + tipo);
    if (!statusEl) return;

    statusInfo(statusEl, `Lendo ${file.name}...`);

    const resultado = await UploadManager.processar(file, tipo);

    if (resultado.aguardaConfirmacao) {
      statusAviso(
        statusEl,
        `Nome inesperado: "${resultado.aviso}". Confirme se é o arquivo correto.`
      );
      const confirmado = await NexoModal.confirm(
        "Arquivo Inesperado",
        `O arquivo <strong>"${file.name}"</strong> não segue o padrão esperado para <em>${ContratosArquivo[tipo].rotulo}</em>.<br><br>Deseja continuar mesmo assim?`
      );
      if (!confirmado) {
        statusInfo(statusEl, "Importação cancelada.");
        return;
      }
      const resultado2 = await UploadManager.processarConfirmado(file, tipo);
      _aplicarResultado(resultado2, tipo, file.name);
      return;
    }

    _aplicarResultado(resultado, tipo, file.name);
  }

  function _aplicarResultado(resultado, tipo, nomeArquivo) {
    const statusEl = document.getElementById("status_" + tipo);
    if (!statusEl) return;

    if (!resultado.ok) {
      statusErro(statusEl, resultado.erro || "Erro desconhecido.");
      return;
    }

    const linhas = resultado.linhas ?? 0;
    const msg = linhas > 0
      ? `${ContratosArquivo[tipo].rotulo} carregada — ${linhas} registros.`
      : `${ContratosArquivo[tipo].rotulo} carregada (arquivo sem linhas de dados).`;
    statusSucesso(statusEl, msg);

    atualizarTimestamp(tipo);

    if (tipo === "Empresas" && resultado.dados) {
      _preencherEquipeImplicito(resultado.dados, statusEl, msg);
    }
  }

  function _preencherEquipeImplicito(tabela, statusEl, msgBase) {
    if (typeof ConfigEquipe === "undefined") return;
    if (ConfigEquipe.carregar().length > 0) return;

    const nomes = ConfigEquipe.extrairNomesDaTabela(tabela);
    if (!nomes.length) return;

    ConfigEquipe.salvar(nomes.map((nome) => ({ nome, visivel: true })));
    statusSucesso(statusEl, `${msgBase} Quadro de Equipe preenchido automaticamente com ${nomes.length} analista(s) — confira em Configurações → Equipe.`);
  }

  Object.keys(ContratosArquivo).forEach((tipo) => {
    const input = document.getElementById("file_" + tipo);
    if (!input) return;
    input.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) handleUpload(file, tipo);

      this.value = "";
    });
  });

  function _limparArmazenamento(tipo) {
    const contrato = ContratosArquivo[tipo];
    StorageManager.remover(contrato.chaveStorage);
    localStorage.removeItem(contrato.chaveTimestamp);
    if (typeof MockManager !== "undefined") {
      StorageManager.remover(MockManager.PREFIXO_BCK + contrato.chaveStorage);
      localStorage.removeItem(MockManager.PREFIXO_BCK + contrato.chaveTimestamp);
    }
  }

  function _resetarCardUI(tipo) {
    const statusEl = document.getElementById("status_" + tipo);
    if (statusEl) statusInfo(statusEl, "Aguardando arquivo...");
    atualizarTimestamp(tipo);
  }

  async function limparRelatorio(tipo) {
    const contrato = ContratosArquivo[tipo];
    const confirmado = await NexoModal.confirm(
      "Limpar Dados",
      `Isso apaga permanentemente os dados importados de <strong>${contrato.rotulo}</strong> deste navegador.<br><br>Não pode ser desfeito. Deseja continuar?`
    );
    if (!confirmado) return;
    _limparArmazenamento(tipo);
    _resetarCardUI(tipo);
    document.getElementById("status_" + tipo)?.closest(".sync-card")?.classList.remove("mock-ativo");
  }

  async function limparTudo() {
    const confirmado = await NexoModal.confirm(
      "Limpar Todos os Dados",
      "Isso apaga permanentemente <strong>todos os relatórios importados</strong> deste navegador (Empresas, OCs, Transferências entre Unidades, Base da Rede, Coordenadas, Contatos e E-mails).<br><br>Não pode ser desfeito. Deseja continuar?"
    );
    if (!confirmado) return;
    Object.keys(ContratosArquivo).forEach((tipo) => {
      _limparArmazenamento(tipo);
      _resetarCardUI(tipo);
    });
    if (typeof MockManager !== "undefined") localStorage.removeItem(MockManager.CHAVE_FLAG);
    document.querySelectorAll(".sync-card").forEach((card) => card.classList.remove("mock-ativo"));
    if (typeof MockManager !== "undefined") MockManager._atualizarBotao();
  }

  document.querySelectorAll(".sync-card-clear-btn[data-tipo]").forEach((btn) => {
    btn.addEventListener("click", () => limparRelatorio(btn.dataset.tipo));
  });

  const btnLimparTudo = document.getElementById("btnLimparTudo");
  if (btnLimparTudo) btnLimparTudo.addEventListener("click", limparTudo);

  const btnMock = document.getElementById("btnMock");
  if (btnMock) {
    btnMock.addEventListener("click", async () => {
      await MockManager.toggle();

      Object.keys(ContratosArquivo).forEach((tipo) => {
        atualizarTimestamp(tipo);
        const statusEl = document.getElementById("status_" + tipo);
        if (statusEl) {
          statusInfo(statusEl, MockManager.ativo()
            ? `[MOCK] ${ContratosArquivo[tipo].rotulo} carregada.`
            : "Aguardando arquivo...");
        }
      });

      document.querySelectorAll(".sync-card").forEach(card => {
        card.classList.toggle("mock-ativo", MockManager.ativo());
      });
    });
  }

});
