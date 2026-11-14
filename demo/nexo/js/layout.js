function cnpjDigitos(v) {
  return String(v == null ? "" : v).replace(/\D/g, "");
}
function formatarCNPJ(v) {
  const n = cnpjDigitos(v);
  if (n.length !== 14) return v == null ? "" : String(v);
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}

function cnpjBuscaCasa(valorCelula, termoBusca) {
  const dig = cnpjDigitos(termoBusca);
  if (!dig) return false;
  return cnpjDigitos(valorCelula).includes(dig);
}

function ehColunaCNPJ(chave) {
  const k = String(chave == null ? "" : chave).toUpperCase();
  return k === "CNPJ" || k.endsWith("CNPJ") || k === "REPRESENTANTEDOC";
}

window.cnpjDigitos = cnpjDigitos;
window.formatarCNPJ = formatarCNPJ;
window.cnpjBuscaCasa = cnpjBuscaCasa;
window.ehColunaCNPJ = ehColunaCNPJ;

function _obterDicCNAE() {
  if (typeof DICIONARIO_CNAES === "undefined" || !DICIONARIO_CNAES) return null;
  return Array.isArray(DICIONARIO_CNAES) ? DICIONARIO_CNAES[0] : DICIONARIO_CNAES;
}

function descricaoCNAE(codigo) {
  if (!codigo) return "";
  const dic = _obterDicCNAE();
  if (!dic) return "";
  const digitos = String(codigo).replace(/\D/g, "");
  if (!digitos) return "";
  const base4 = digitos.slice(0, 4);
  const base5 = digitos.slice(0, 5);
  let descricao = dic[digitos] || dic[base5] || dic[base4] || null;
  if (!descricao) {
    for (const chave of Object.keys(dic)) {
      const chaveDigitos = String(chave).replace(/\D/g, "");
      if (chaveDigitos === digitos || chaveDigitos.startsWith(base4)) { descricao = dic[chave]; break; }
    }
  }
  return descricao || "";
}
window._obterDicCNAE = _obterDicCNAE;
window.descricaoCNAE = descricaoCNAE;

function escapeHTML(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
window.escapeHTML = escapeHTML;

function neutralizarFormulaCSV(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
window.neutralizarFormulaCSV = neutralizarFormulaCSV;

const NexoModal = {
  _el: null,

  _init() {
    if (this._el) return;
    const overlay = document.createElement("div");
    overlay.id = "nexoModalOverlay";
    overlay.innerHTML = `
      <div class="nexo-modal-box">
        <div class="nexo-modal-ico-wrap">
          <i id="nexoModalIco" class="fas fa-info-circle"></i>
        </div>
        <h3 id="nexoModalTitulo"></h3>
        <p id="nexoModalMsg"></p>
        <div id="nexoModalBtns"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this._el = overlay;
  },

  _icoMap: {
    info:    { cls: "fa-info-circle",          color: "var(--color-primary)" },
    aviso:   { cls: "fa-exclamation-triangle",  color: "#f59e0b" },
    erro:    { cls: "fa-times-circle",          color: "var(--color-danger)" },
    sucesso: { cls: "fa-check-circle",          color: "var(--color-success)" },
  },

  _open(titulo, msg, tipo, btns) {
    this._init();
    const ico = this._icoMap[tipo] || this._icoMap.info;
    const icoEl = document.getElementById("nexoModalIco");
    icoEl.className = `fas ${ico.cls}`;
    icoEl.style.color = ico.color;
    document.getElementById("nexoModalTitulo").textContent = titulo;
    document.getElementById("nexoModalMsg").innerHTML = msg;
    const btnsEl = document.getElementById("nexoModalBtns");
    btnsEl.innerHTML = "";
    btns.forEach((b) => btnsEl.appendChild(b));
    this._el.classList.add("ativo");
  },

  _close() {
    if (this._el) this._el.classList.remove("ativo");
  },

  alert(titulo, msg, tipo = "info") {
    return new Promise((resolve) => {
      const btn = document.createElement("button");
      btn.className = "btn-sm interativo nexo-modal-btn-primary";
      btn.textContent = "OK";
      btn.onclick = () => { this._close(); resolve(); };
      this._open(titulo, msg, tipo, [btn]);
    });
  },

  confirm(titulo, msg) {
    return new Promise((resolve) => {
      const btnCancelar = document.createElement("button");
      btnCancelar.className = "btn-sm interativo nexo-modal-btn-secondary";
      btnCancelar.textContent = "Cancelar";
      btnCancelar.onclick = () => { this._close(); resolve(false); };

      const btnConfirmar = document.createElement("button");
      btnConfirmar.className = "btn-sm interativo nexo-modal-btn-primary";
      btnConfirmar.textContent = "Confirmar";
      btnConfirmar.onclick = () => { this._close(); resolve(true); };

      this._open(titulo, msg, "aviso", [btnCancelar, btnConfirmar]);
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {

  document.querySelectorAll(".nav-links a[href]").forEach((link) => {
    const href = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
    if (!href || href.startsWith("#")) return;
    const paginaAtual = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (href !== paginaAtual) return;
    link.addEventListener("click", (e) => {
      const subview = document.getElementById("subview-wrapper");
      if (subview && subview.style.display !== "none" && typeof window.voltarDashboard === "function") {
        e.preventDefault();
        window.voltarDashboard();
        return;
      }
      e.preventDefault();
    });
  });

  const sidebar = document.getElementById("sidebar");
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  if (sidebar && collapseBtn) {
    const _atualizarTooltipSidebar = (isCollapsed) => {
      collapseBtn.title = isCollapsed ? "Expandir menu" : "Retrair menu";
    };
    const collapsed = localStorage.getItem("sidebarCollapsed") === "1";
    if (collapsed) {
      sidebar.classList.add("collapsed");
      collapseBtn.querySelector("i").classList.replace("fa-chevron-left", "fa-chevron-right");
    }
    _atualizarTooltipSidebar(collapsed);
    collapseBtn.addEventListener("click", () => {
      const isCollapsed = sidebar.classList.toggle("collapsed");
      const icon = collapseBtn.querySelector("i");
      icon.classList.replace(
        isCollapsed ? "fa-chevron-left" : "fa-chevron-right",
        isCollapsed ? "fa-chevron-right" : "fa-chevron-left"
      );
      _atualizarTooltipSidebar(isCollapsed);
      localStorage.setItem("sidebarCollapsed", isCollapsed ? "1" : "0");
    });
  }

  const themeToggle = document.getElementById("themeToggle");

  const atualizarGraficosSeExistirem = () => {
    const isDark = document.body.classList.contains("dark-mode");
    if (window.chartBar) {
      window.chartBar.update();
    }
    if (window.chartPizza) {
      window.chartPizza.options.plugins.legend.labels.color = isDark ? "#f8fafc" : "#1e293b";
      window.chartPizza.update();
    }
    if (typeof window.atualizarRotulosSubCharts === "function") {
      window.atualizarRotulosSubCharts();
    }
  };

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    if (themeToggle) {
      const icon = themeToggle.querySelector("i");
      if (icon) icon.classList.replace("fa-moon", "fa-sun");
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const isDark = document.body.classList.contains("dark-mode");
      const icon = themeToggle.querySelector("i");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      if (icon) {
        isDark
          ? icon.classList.replace("fa-moon", "fa-sun")
          : icon.classList.replace("fa-sun", "fa-moon");
      }
      atualizarGraficosSeExistirem();
    });
  }

  const btnPriv = document.getElementById("btnPrivacidade");
  if (btnPriv && typeof PrivacyManager !== "undefined") {
    btnPriv.addEventListener("click", () => PrivacyManager.toggle());
  }
});
