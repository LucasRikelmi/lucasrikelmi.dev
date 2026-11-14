(function () {

  const CL_VERSIONS = [
    {
      title: "Versão 1.0 — Edição de demonstração",
      data: "2026",
      sections: [
        {
          heading: "Operação",
          items: [
            "Grid operacional com filtros, ordenação, seleção múltipla e exportação CSV/PDF",
            "Geração em lote de cartas, recibos e anexos em PDF vetorial",
            "Mapas KML com marcadores por status e geocodificação offline",
          ],
        },
        {
          heading: "Gestão",
          items: [
            "Dashboard com KPIs, funil de atendimento e produtividade por analista",
            "Planejamento com metas diárias, calendário de dias úteis e projeção de fechamento",
            "Cruzamento de contatos para identificar representantes ligados a várias empresas",
          ],
        },
        {
          heading: "Segurança & privacidade",
          items: [
            "Dados cifrados no navegador (AES-256-GCM, chave derivada por Argon2id)",
            "Modo privacidade, bloqueio por inatividade e expiração automática",
            "Nenhuma chamada a serviços externos — funciona 100% offline",
          ],
        },
      ],
    },
  ];

  let clIdx = CL_VERSIONS.length - 1;

  function clRender() {
    const v = CL_VERSIONS[clIdx];
    const isDark = document.body.classList.contains("dark-mode");
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-primary").trim() || "#4f46e5";
    const textMain = isDark ? "#f8fafc" : "#334155";
    const textMuted = isDark ? "#94a3b8" : "#64748b";
    const borderColor = isDark ? "#334155" : "#e2e8f0";

    const titleEl = document.getElementById("cl-title");
    if (titleEl) {
      titleEl.textContent = v.title;
      titleEl.style.color = textMain;
    }

    const dotsEl = document.getElementById("cl-dots");
    if (dotsEl) {
      dotsEl.innerHTML = CL_VERSIONS.map((_, i) =>
        `<span onclick="clGo(${i})" style="width:8px;height:8px;border-radius:50%;background:${i === clIdx ? accent : (isDark ? "#475569" : "#cbd5e1")};cursor:pointer;transition:background .2s;display:inline-block;"></span>`
      ).join("");
    }

    const prevBtn = document.getElementById("cl-prev");
    const nextBtn = document.getElementById("cl-next");
    if (prevBtn) {
      prevBtn.style.opacity = clIdx === 0 ? "0.3" : "1";
      prevBtn.style.color = textMain;
      prevBtn.style.borderColor = borderColor;
    }
    if (nextBtn) {
      nextBtn.style.opacity = clIdx === CL_VERSIONS.length - 1 ? "0.3" : "1";
      nextBtn.style.color = textMain;
      nextBtn.style.borderColor = borderColor;
    }

    const h4style = `margin:0 0 8px;font-size:0.82rem;color:${accent};text-transform:uppercase;letter-spacing:.5px;`;
    const ulstyle = "margin:0 0 14px;padding-left:18px;";
    let html = `<p style="margin:0 0 12px;color:${textMuted};font-size:0.78rem;">Lançado em ${v.data}</p>`;
    v.sections.forEach((s) => {
      html += `<h4 style="${h4style}">${s.heading}</h4><ul style="${ulstyle}">`;
      s.items.forEach((it) => { html += `<li>${it}</li>`; });
      html += `</ul>`;
    });

    const bodyEl = document.getElementById("cl-body");
    if (bodyEl) {
      bodyEl.innerHTML = html;
      bodyEl.style.color = textMain;
      bodyEl.scrollTop = 0;
    }

    const modalCard = document.getElementById("cl-card");
    if (modalCard) {
      const bg = isDark ? "#1e293b" : "#ffffff";
      modalCard.style.background = bg;
      modalCard.querySelectorAll("[data-cl-border]").forEach((el) => {
        el.style.borderColor = borderColor;
      });
    }
  }

  window.clNav = function (dir) {
    const next = clIdx + dir;
    if (next < 0 || next >= CL_VERSIONS.length) return;
    clIdx = next;
    clRender();
  };

  window.clGo = function (i) { clIdx = i; clRender(); };

  const CL_CURRENT = CL_VERSIONS[CL_VERSIONS.length - 1].title;

  function clTemNovidade() {
    try { return localStorage.getItem("nexo_changelog_visto") !== CL_CURRENT; }
    catch (_) { return true; }
  }
  function clMarcarVisto() {
    try { localStorage.setItem("nexo_changelog_visto", CL_CURRENT); } catch (_) {}
    const dot = document.getElementById("cl-novo-dot");
    if (dot) dot.style.display = "none";
  }

  function clOpen() {
    const modal = document.getElementById("changelogModal");
    if (modal) {
      modal.style.display = "flex";
      clRender();
    }
    clMarcarVisto();
  }

  function clClose() {
    const modal = document.getElementById("changelogModal");
    if (modal) modal.style.display = "none";
  }

  function injectModal() {
    if (document.getElementById("changelogModal")) return;

    const modal = document.createElement("div");
    modal.id = "changelogModal";
    modal.style.cssText =
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;";

    modal.innerHTML = `
      <div id="cl-card" style="border-radius:12px;max-width:540px;width:90%;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);background:#fff;">

        <div data-cl-border style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e2e8f0;flex-shrink:0;">
          <button id="cl-prev" onclick="clNav(-1)" style="background:none;border:1px solid #e2e8f0;border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:0.9rem;color:#334155;display:flex;align-items:center;justify-content:center;">&#8592;</button>
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="fas fa-rocket" style="color:var(--color-primary,#4f46e5);font-size:1rem;"></i>
            <h3 id="cl-title" style="margin:0;font-size:0.95rem;font-weight:700;color:#334155;"></h3>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button id="cl-next" onclick="clNav(+1)" style="background:none;border:1px solid #e2e8f0;border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:0.9rem;color:#334155;display:flex;align-items:center;justify-content:center;">&#8594;</button>
            <button onclick="document.getElementById('changelogModal').style.display='none'" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:#94a3b8;line-height:1;margin-left:4px;">&times;</button>
          </div>
        </div>

        <div id="cl-dots" style="display:flex;justify-content:center;gap:6px;padding:10px 0 4px;flex-shrink:0;"></div>

        <div id="cl-body" style="padding:16px 22px 20px;font-size:0.875rem;line-height:1.7;color:#334155;overflow-y:auto;flex:1;"></div>

        <div data-cl-border style="padding:10px 22px;border-top:1px solid #e2e8f0;text-align:right;flex-shrink:0;">
          <button onclick="document.getElementById('changelogModal').style.display='none'" style="background:var(--color-primary,#4f46e5);color:#fff;border:none;border-radius:6px;padding:7px 18px;font-size:0.85rem;font-weight:600;cursor:pointer;">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(modal);
  }

  function wireVersionBadge() {
    const badge = document.getElementById("versionBadge");
    if (!badge) return;

    const numero = (/Vers[ãa]o\s+([\d.]+)/.exec(CL_CURRENT) || [])[1];
    if (numero) badge.textContent = `Versão: ${numero}`;
    badge.style.cursor = "pointer";
    badge.style.textDecoration = "underline dotted";
    badge.title = "Ver novidades";
    badge.addEventListener("click", clOpen);

    if (clTemNovidade() && !document.getElementById("cl-novo-dot")) {
      if (!document.getElementById("cl-novo-dot-css")) {
        const st = document.createElement("style");
        st.id = "cl-novo-dot-css";
        st.textContent =
          "#cl-novo-dot{display:inline-block;width:8px;height:8px;margin-left:7px;border-radius:50%;" +
          "background:#ef4444;cursor:pointer;vertical-align:middle;box-shadow:0 0 0 0 rgba(239,68,68,0.7);" +
          "animation:clNovoPulse 1.6s infinite;}" +
          "@keyframes clNovoPulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.65);}" +
          "70%{box-shadow:0 0 0 7px rgba(239,68,68,0);}100%{box-shadow:0 0 0 0 rgba(239,68,68,0);}}";
        document.head.appendChild(st);
      }
      const dot = document.createElement("span");
      dot.id = "cl-novo-dot";
      dot.title = "Novidades nesta versão — clique para ver";
      dot.addEventListener("click", clOpen);
      (badge.parentElement || badge).appendChild(dot);
    }
  }

  function watchTheme() {
    const observer = new MutationObserver(() => {
      if (document.getElementById("changelogModal")?.style.display !== "none") {
        clRender();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  document.addEventListener("DOMContentLoaded", function () {
    injectModal();
    clRender();
    wireVersionBadge();
    watchTheme();
  });
})();
