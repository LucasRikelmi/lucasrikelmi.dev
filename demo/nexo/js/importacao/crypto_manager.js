const CryptoManager = {
  _SALT_KEY:  "nexo_crypto_salt",
  _VERIF_KEY: "nexo_crypto_verificador",
  _SESSAO_KEY: "nexo_crypto_sessao_chave",
  _MARCADOR: "NEXO-OK-v1",

  _ITERACOES: 600000,

  _ALGORITMO_KEY: "nexo_crypto_algoritmo",
  _ALGORITMO_PADRAO: "argon2id",

  _ARGON2_MEMORIA_KIB: 64 * 1024,
  _ARGON2_ITERACOES: 2,
  _ARGON2_PARALELISMO: 1,

  _TENTATIVAS_KEY: "nexo_crypto_tentativas",
  _MAX_TENTATIVAS: 3,

  _VALIDADE_KEY: "nexo_crypto_validade_ate",
  _VALIDADE_MS: 10 * 24 * 60 * 60 * 1000,

  _AVISO_KEY: "nexo_crypto_aviso_seguranca",

  _chave: null,

  _paraBase64(bytes) {
    let bin = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  },
  _deBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  },

  async _derivarChave(senha, saltBytes, algoritmo) {
    if (algoritmo === "argon2id") return this._derivarChaveArgon2id(senha, saltBytes);
    return this._derivarChavePBKDF2(senha, saltBytes);
  },

  async _derivarChavePBKDF2(senha, saltBytes) {
    const material = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: this._ITERACOES, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  },

  async _derivarChaveArgon2id(senha, saltBytes) {
    const bytes = await hashwasm.argon2id({
      password: senha,
      salt: saltBytes,
      parallelism: this._ARGON2_PARALELISMO,
      iterations: this._ARGON2_ITERACOES,
      memorySize: this._ARGON2_MEMORIA_KIB,
      hashLength: 32,
      outputType: "binary",
    });

    return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  },

  async _cifrarComChave(chave, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, bytes);
    const saida = new Uint8Array(iv.length + cifrado.byteLength);
    saida.set(iv, 0);
    saida.set(new Uint8Array(cifrado), iv.length);
    return saida;
  },
  async _decifrarComChave(chave, bytes) {
    const iv = bytes.slice(0, 12);
    const corpo = bytes.slice(12);
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, chave, corpo);
    return new Uint8Array(plano);
  },

  cifrar(bytes)   { return this._cifrarComChave(this._chave, bytes); },
  decifrar(bytes) { return this._decifrarComChave(this._chave, bytes); },

  async _criarVerificador(chave) {
    const cifrado = await this._cifrarComChave(chave, new TextEncoder().encode(this._MARCADOR));
    localStorage.setItem(this._VERIF_KEY, this._paraBase64(cifrado));
  },
  async _validarSenha(chave) {
    try {
      const b64 = localStorage.getItem(this._VERIF_KEY);
      if (!b64) return false;
      const plano = await this._decifrarComChave(chave, this._deBase64(b64));
      return new TextDecoder().decode(plano) === this._MARCADOR;
    } catch (_) {
      return false;
    }
  },

  async _cachearSessao(chave) {
    const raw = await crypto.subtle.exportKey("raw", chave);
    sessionStorage.setItem(this._SESSAO_KEY, this._paraBase64(new Uint8Array(raw)));
  },
  async _restaurarSessao() {
    const b64 = sessionStorage.getItem(this._SESSAO_KEY);
    if (!b64) return null;
    try {
      return await crypto.subtle.importKey("raw", this._deBase64(b64), "AES-GCM", true, ["encrypt", "decrypt"]);
    } catch (_) {
      return null;
    }
  },

  _MOCK_CHAVE_FLAG: "nexo_modo_mock",
  _MOCK_PREFIXO_BCK: "nexo_backup_",

  _zerarTudo() {
    localStorage.removeItem(this._SALT_KEY);
    localStorage.removeItem(this._VERIF_KEY);
    localStorage.removeItem(this._ALGORITMO_KEY);
    sessionStorage.removeItem(this._SESSAO_KEY);
    localStorage.removeItem(this._TENTATIVAS_KEY);
    localStorage.removeItem(this._VALIDADE_KEY);
    if (typeof ContratosArquivo !== "undefined") {
      Object.values(ContratosArquivo).forEach(({ chaveStorage, chaveTimestamp }) => {
        StorageManager.remover(chaveStorage);
        localStorage.removeItem(chaveTimestamp);
        StorageManager.remover(this._MOCK_PREFIXO_BCK + chaveStorage);
        localStorage.removeItem(this._MOCK_PREFIXO_BCK + chaveTimestamp);
      });
    }
    localStorage.removeItem(this._MOCK_CHAVE_FLAG);
  },

  _lerTentativas() {
    return parseInt(localStorage.getItem(this._TENTATIVAS_KEY) || "0", 10) || 0;
  },

  _registrarTentativaErrada() {
    const n = this._lerTentativas() + 1;
    localStorage.setItem(this._TENTATIVAS_KEY, String(n));
    return n >= this._MAX_TENTATIVAS;
  },
  _resetarTentativas() {
    localStorage.removeItem(this._TENTATIVAS_KEY);
  },

  _renovarValidade() {
    localStorage.setItem(this._VALIDADE_KEY, String(Date.now() + this._VALIDADE_MS));
  },
  _validadeExpirada() {
    const ate = parseInt(localStorage.getItem(this._VALIDADE_KEY) || "0", 10);
    return ate > 0 && Date.now() > ate;
  },

  _iniciarMonitorValidade() {
    if (this._monitorValidadeAtivo) return;
    this._monitorValidadeAtivo = true;
    setInterval(() => {
      if (this._validadeExpirada()) {
        this._chave = null;
        this._zerarTudo();
        this._registrarAviso("expirado");
        location.reload();
      }
    }, 60 * 1000);
  },

  _registrarAviso(motivo) {
    localStorage.setItem(this._AVISO_KEY, JSON.stringify({ motivo, quando: Date.now() }));
  },
  _MENSAGENS_AVISO: {
    tentativas: "Três tentativas de senha incorretas foram feitas. Por política de segurança contra força bruta, todos os dados confidenciais foram apagados deste navegador. Será necessário importar os relatórios novamente.",
    violacao: "Foi detectada uma tentativa de acessar a tela sem desbloqueá-la corretamente (ex.: manipulação da página pelas ferramentas de desenvolvedor). Por segurança, todos os dados confidenciais foram apagados imediatamente.",
    expirado: "O prazo de validade definido para os dados confidenciais expirou sem uso. Os dados foram apagados automaticamente, conforme a política de retenção, e um novo upload é necessário.",
  },

  _exibirAvisoPendenteSeHouver() {
    const bruto = localStorage.getItem(this._AVISO_KEY);
    if (!bruto) return;
    let aviso;
    try { aviso = JSON.parse(bruto); } catch (_) { localStorage.removeItem(this._AVISO_KEY); return; }
    const texto = this._MENSAGENS_AVISO[aviso.motivo];
    if (!texto) { localStorage.removeItem(this._AVISO_KEY); return; }

    const faixa = document.createElement("div");
    faixa.id = "cryptoAvisoSeguranca";
    faixa.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:10001;background:#7f1d1d;color:#fff;" +
      "padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:center;" +
      "font-size:0.88rem;box-shadow:0 2px 8px rgba(0,0,0,0.35);text-align:center;";
    faixa.innerHTML = `
      <i class="fas fa-triangle-exclamation"></i>
      <span>${texto}</span>
      <button id="_cg-aviso-ok" class="btn-sm interativo" style="background:#fff;color:#7f1d1d;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;flex-shrink:0;">Entendi</button>
    `;
    document.body.appendChild(faixa);
    faixa.querySelector("#_cg-aviso-ok").addEventListener("click", () => {
      localStorage.removeItem(this._AVISO_KEY);
      faixa.remove();
    });
  },

  _montarOverlay() {
    let overlay = document.getElementById("cryptoGateOverlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "cryptoGateOverlay";
    overlay.style.cssText =
      "display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;" +
      "justify-content:center;align-items:center;backdrop-filter:blur(2px);";
    document.body.appendChild(overlay);
    return overlay;
  },

  _renderBox(overlay, { icone, titulo, descricao, confirmar, mostrarConfirmacao, erro, permiteEsqueci }) {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "nexo-modal-box";
      box.style.textAlign = "left";
      box.innerHTML = `
        <div class="nexo-modal-ico-wrap" style="text-align:center;"><i class="fas ${icone}" style="color:var(--color-primary);"></i></div>
        <h3 style="text-align:center;">${titulo}</h3>
        <p style="text-align:center;">${descricao}</p>
        <label style="display:block;font-size:0.82rem;color:var(--text-muted);margin-bottom:4px;">Senha</label>
        <input type="password" id="_cg-senha" autocomplete="${mostrarConfirmacao ? "new-password" : "current-password"}"
          style="width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-body);color:var(--text-main);font-size:0.95rem;margin-bottom:${mostrarConfirmacao ? "12px" : "6px"};box-sizing:border-box;">
        ${mostrarConfirmacao ? `
        <label style="display:block;font-size:0.82rem;color:var(--text-muted);margin-bottom:4px;">Confirmar senha</label>
        <input type="password" id="_cg-senha2"
          style="width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-body);color:var(--text-main);font-size:0.95rem;margin-bottom:6px;box-sizing:border-box;">
        ` : ""}
        <p id="_cg-erro" style="color:var(--color-danger);font-size:0.82rem;min-height:1.2em;margin:4px 0 18px;text-align:center;">${erro || ""}</p>
        <div style="display:flex;justify-content:center;">
          <button id="_cg-ok" class="btn-sm interativo nexo-modal-btn-primary" style="width:100%;">${confirmar}</button>
        </div>
        ${permiteEsqueci ? `<p style="text-align:center;margin-top:14px;"><a href="#" id="_cg-esqueci" style="font-size:0.82rem;color:var(--text-muted);">Esqueci minha senha</a></p>` : ""}
      `;
      overlay.innerHTML = "";
      overlay.appendChild(box);

      const inpSenha = box.querySelector("#_cg-senha");
      const inpSenha2 = box.querySelector("#_cg-senha2");
      const btnOk = box.querySelector("#_cg-ok");
      const submeter = () => resolve({ senha: inpSenha.value, senha2: inpSenha2 ? inpSenha2.value : null, esqueceu: false });
      btnOk.addEventListener("click", submeter);
      inpSenha.addEventListener("keydown", (e) => { if (e.key === "Enter") submeter(); });
      if (inpSenha2) inpSenha2.addEventListener("keydown", (e) => { if (e.key === "Enter") submeter(); });
      inpSenha.focus();

      const linkEsqueci = box.querySelector("#_cg-esqueci");
      if (linkEsqueci) {

        linkEsqueci.addEventListener("click", (e) => {
          e.preventDefault();
          resolve({ senha: null, senha2: null, esqueceu: true });
        });
      }
    });
  },

  async _fluxoPrimeiraVez(overlay) {
    let erro = "";

    while (true) {
      const { senha, senha2 } = await this._renderBox(overlay, {
        icone: "fa-shield-halved",
        titulo: "Criar senha do NEXO",
        descricao: "Os dados confidenciais (CNPJ, contatos, endereços) ficam cifrados neste navegador. Defina uma senha — sem ela, os dados não podem ser recuperados.",
        confirmar: "Criar senha e continuar",
        mostrarConfirmacao: true,
        erro,
      });

      if (!senha || senha.length < 10) {
        erro = "A senha precisa ter pelo menos 10 caracteres.";
        continue;
      }
      if (senha !== senha2) {
        erro = "As senhas não coincidem.";
        continue;
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const chave = await this._derivarChave(senha, salt, this._ALGORITMO_PADRAO);
      localStorage.setItem(this._SALT_KEY, this._paraBase64(salt));
      localStorage.setItem(this._ALGORITMO_KEY, this._ALGORITMO_PADRAO);
      await this._criarVerificador(chave);
      await this._cachearSessao(chave);
      this._chave = chave;
      this._resetarTentativas();
      this._renovarValidade();
      return;
    }
  },

  _renderConfirmacao(overlay, { titulo, descricao, confirmar, exigirTexto }) {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "nexo-modal-box";
      box.innerHTML = `
        <div class="nexo-modal-ico-wrap"><i class="fas fa-triangle-exclamation" style="color:#f59e0b;"></i></div>
        <h3>${titulo}</h3>
        <p>${descricao}</p>
        ${exigirTexto ? `
        <label style="display:block;font-size:0.82rem;color:var(--text-muted);margin-bottom:4px;">Digite <strong>${exigirTexto}</strong> para confirmar</label>
        <input type="text" id="_cg-confirma-texto" autocomplete="off"
          style="width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-body);color:var(--text-main);font-size:0.95rem;margin-bottom:14px;box-sizing:border-box;">
        ` : ""}
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="_cg-cancelar" class="btn-sm interativo nexo-modal-btn-secondary">Cancelar</button>
          <button id="_cg-confirmar" class="btn-sm interativo nexo-modal-btn-primary" ${exigirTexto ? "disabled" : ""}>${confirmar}</button>
        </div>
      `;
      overlay.innerHTML = "";
      overlay.appendChild(box);
      const btnConfirmar = box.querySelector("#_cg-confirmar");
      const inpTexto = box.querySelector("#_cg-confirma-texto");
      if (inpTexto) {
        inpTexto.addEventListener("input", () => {
          btnConfirmar.disabled = inpTexto.value.trim().toUpperCase() !== exigirTexto;
        });
        inpTexto.focus();
      }
      box.querySelector("#_cg-cancelar").addEventListener("click", () => resolve(false));
      btnConfirmar.addEventListener("click", () => { if (!btnConfirmar.disabled) resolve(true); });
    });
  },

  async _fluxoDesbloquear(overlay) {
    const saltB64 = localStorage.getItem(this._SALT_KEY);
    const salt = this._deBase64(saltB64);

    const algoritmo = localStorage.getItem(this._ALGORITMO_KEY) || "pbkdf2";
    let erro = "";

    while (true) {
      const { senha, esqueceu } = await this._renderBox(overlay, {
        icone: "fa-lock",
        titulo: "Desbloquear NEXO",
        descricao: "Digite a senha definida neste navegador para acessar os dados confidenciais.",
        confirmar: "Desbloquear",
        mostrarConfirmacao: false,
        erro,
        permiteEsqueci: true,
      });
      if (esqueceu) {
        const confirmado = await this._renderConfirmacao(overlay, {
          titulo: "Esqueci minha senha",
          descricao: "Sem a senha original, os dados cifrados não podem ser recuperados — a única saída é apagá-los e reimportar os relatórios do zero.<br><br><strong>Apagar todos os dados e definir uma nova senha?</strong>",
          confirmar: "Apagar e recomeçar",
          exigirTexto: "APAGAR",
        });
        if (confirmado) {
          this._zerarTudo();
          return this._fluxoPrimeiraVez(overlay);
        }
        erro = "";
        continue;
      }
      const chave = await this._derivarChave(senha, salt, algoritmo);
      if (await this._validarSenha(chave)) {
        await this._cachearSessao(chave);
        this._chave = chave;
        this._resetarTentativas();
        this._renovarValidade();
        return;
      }

      if (this._registrarTentativaErrada()) {
        this._chave = null;
        this._zerarTudo();
        this._registrarAviso("tentativas");
        location.reload();
        return;
      }
      const restantes = this._MAX_TENTATIVAS - this._lerTentativas();
      erro = `Senha incorreta. Restam ${restantes} tentativa${restantes === 1 ? "" : "s"} antes que os dados sejam apagados.`;
    }
  },

  _vigiaOverlay: null,
  _vigiaPausada: false,

  _iniciarVigiaOverlay(overlay) {
    this._vigiaPausada = false;
    this._vigiaOverlay = new MutationObserver(() => {
      if (this._vigiaPausada) return;
      const aindaPresente = document.body.contains(overlay);
      const escondido = !aindaPresente || /display:\s*none|visibility:\s*hidden|opacity:\s*0\b/i.test(overlay.getAttribute("style") || "");
      if (escondido) this._tratarViolacaoOverlay();
    });
    this._vigiaOverlay.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
  },
  _pararVigiaOverlay() {
    if (this._vigiaOverlay) { this._vigiaOverlay.disconnect(); this._vigiaOverlay = null; }
  },

  _removerOverlaySeguro(overlay) {
    this._vigiaPausada = true;
    overlay.remove();
    this._pararVigiaOverlay();
  },
  _tratarViolacaoOverlay() {
    this._pararVigiaOverlay();
    this._chave = null;
    this._zerarTudo();
    this._registrarAviso("violacao");
    location.reload();
  },

  _temDadosOrfaos() {
    if (typeof ContratosArquivo === "undefined") return false;
    return Object.values(ContratosArquivo).some(({ chaveStorage }) => {
      const v = localStorage.getItem(chaveStorage);
      return !!v && v.length > 0;
    });
  },

  async _fluxoDadosOrfaos(overlay) {
    while (true) {
      const confirmado = await this._renderConfirmacao(overlay, {
        titulo: "Dados cifrados sem chave de acesso",
        descricao: "Foram encontrados dados confidenciais cifrados neste navegador, mas a informação necessária para decifrá-los não está mais presente — isso costuma acontecer após uma limpeza parcial dos dados do site. <strong>Sem ela, esses dados não podem ser recuperados de forma alguma</strong>, nem com a senha correta.<br><br>Para continuar usando o NEXO neste navegador, é necessário apagar esses dados órfãos e reimportar os relatórios do zero.",
        confirmar: "Apagar dados órfãos e recomeçar",
        exigirTexto: "APAGAR",
      });
      if (confirmado) {
        this._zerarTudo();
        return this._fluxoPrimeiraVez(overlay);
      }

    }
  },

  async iniciar() {
    this._exibirAvisoPendenteSeHouver();

    if (this._validadeExpirada()) {
      this._chave = null;
      this._zerarTudo();
      this._registrarAviso("expirado");
      location.reload();
      return;
    }

    const sessao = await this._restaurarSessao();
    if (sessao) {
      this._chave = sessao;
      this._renovarValidade();
    } else {
      const overlay = this._montarOverlay();
      this._iniciarVigiaOverlay(overlay);
      const jaConfigurado = !!localStorage.getItem(this._SALT_KEY);
      if (jaConfigurado) {
        await this._fluxoDesbloquear(overlay);
      } else if (this._temDadosOrfaos()) {
        await this._fluxoDadosOrfaos(overlay);
      } else {
        await this._fluxoPrimeiraVez(overlay);
      }
      this._removerOverlaySeguro(overlay);
    }
    this._iniciarMonitorInatividade();
    this._iniciarMonitorValidade();
  },

  _TIMEOUT_INATIVIDADE_MS: 30 * 60 * 1000,
  _timerInatividade: null,
  _bloqueando: false,

  _iniciarMonitorInatividade() {
    if (this._monitorAtivo) return;
    this._monitorAtivo = true;
    const resetar = () => {
      clearTimeout(this._timerInatividade);
      if (this._bloqueando) return;
      this._timerInatividade = setTimeout(() => this._bloquearPorInatividade(), this._TIMEOUT_INATIVIDADE_MS);
    };
    ["mousemove", "mousedown", "keydown", "scroll", "touchstart"].forEach((ev) =>
      document.addEventListener(ev, resetar, { passive: true })
    );
    resetar();
  },

  async _bloquearPorInatividade() {
    this._bloqueando = true;
    this._chave = null;
    sessionStorage.removeItem(this._SESSAO_KEY);

    const overlay = this._montarOverlay();
    this._iniciarVigiaOverlay(overlay);
    await this._fluxoDesbloquear(overlay);
    this._removerOverlaySeguro(overlay);

    this._bloqueando = false;
    clearTimeout(this._timerInatividade);
    this._timerInatividade = setTimeout(() => this._bloquearPorInatividade(), this._TIMEOUT_INATIVIDADE_MS);
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof StorageManager === "undefined") return;
  await CryptoManager.iniciar();
  await StorageManager.precarregarTudo();
  document.dispatchEvent(new Event("nexo:dados-prontos"));
});
