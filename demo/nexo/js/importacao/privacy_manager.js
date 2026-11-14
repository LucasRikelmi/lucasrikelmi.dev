const PrivacyManager = {
  CHAVE_STORAGE: "nexo_privacidade",
  CLASS_BODY:    "modo-privacidade",

  init() {
    if (localStorage.getItem(this.CHAVE_STORAGE) === "1") {
      document.body.classList.add(this.CLASS_BODY);
    }
    this._injetarCSS();
    this._atualizarIcone();
  },

  ativo() {
    return document.body.classList.contains(this.CLASS_BODY);
  },

  ativar() {
    document.body.classList.add(this.CLASS_BODY);
    localStorage.setItem(this.CHAVE_STORAGE, "1");
    this._atualizarIcone();
  },

  desativar() {
    document.body.classList.remove(this.CLASS_BODY);
    localStorage.removeItem(this.CHAVE_STORAGE);
    this._atualizarIcone();
  },

  toggle() {
    this.ativo() ? this.desativar() : this.ativar();
  },

  _atualizarIcone() {
    const btn = document.getElementById("btnPrivacidade");
    if (!btn) return;
    const ico = btn.querySelector("i");
    if (!ico) return;

    if (this.ativo()) {
      ico.className = "fas fa-eye-slash";
      btn.title = "Desativar Modo Privacidade";
      btn.classList.add("privacy-ativo");
    } else {
      ico.className = "fas fa-eye";
      btn.title = "Ativar Modo Privacidade";
      btn.classList.remove("privacy-ativo");
    }
  },

  _injetarCSS() {
    if (document.getElementById("privacy-manager-css")) return;
    const style = document.createElement("style");
    style.id = "privacy-manager-css";
    style.textContent = `
      /* ── Mascaramento global: blura toda a área de conteúdo ── */
      body.modo-privacidade .content-wrapper,
      body.modo-privacidade #subview-wrapper {
        filter: blur(7px);
        user-select: none;
        pointer-events: none;
        transition: filter 0.3s ease;
      }

      /* ── Mascaramento pontual (dado-sensivel) — para tabelas específicas ── */
      body.modo-privacidade .dado-sensivel {
        filter: blur(6px);
        user-select: none;
        cursor: default;
        transition: filter 0.25s ease;
      }
      body.modo-privacidade .dado-sensivel:hover {
        filter: blur(6px);
      }

      /* ── Impressão: oculta completamente ── */
      @media print {
        body.modo-privacidade .content-wrapper,
        body.modo-privacidade #subview-wrapper,
        body.modo-privacidade .dado-sensivel {
          visibility: hidden !important;
        }
      }

      /* ── Botão ativado ── */
      #btnPrivacidade.privacy-ativo {
        color: var(--color-danger, #ef4444) !important;
      }
    `;
    document.head.appendChild(style);
  },
};

document.addEventListener("DOMContentLoaded", () => PrivacyManager.init());
