// Comportamentos comuns a todas as páginas: tema, menu mobile, holofote e revelação.
// O tema salvo é aplicado por um script inline no <head> (antes da pintura);
// este arquivo só cuida da interação.
(() => {
  const root = document.documentElement;
  const KEY = "tema";
  const media = matchMedia("(prefers-color-scheme: dark)");

  const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const effective = () => root.dataset.theme || (media.matches ? "dark" : "light");

  function syncMeta() {
    const color = getComputedStyle(root).getPropertyValue("--bg").trim();
    // Com tema fixo, as duas metas (claro/escuro) recebem a cor escolhida;
    // no modo sistema, cada uma volta ao padrão da sua media query.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute("content", root.dataset.theme ? color : m.dataset.default || color);
    });
    root.style.colorScheme = effective();
  }

  function apply(mode) {
    if (mode === "light" || mode === "dark") root.dataset.theme = mode;
    else delete root.dataset.theme;
    try { mode === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, mode); } catch { /* armazenamento bloqueado */ }
    document.querySelectorAll(".theme-switch button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
    syncMeta();
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: effective() } }));
  }

  const ICONS = {
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>',
  };
  const LABELS = { system: "Tema do sistema", light: "Tema claro", dark: "Tema escuro" };

  document.querySelectorAll(".theme-switch").forEach((sw) => {
    sw.setAttribute("role", "radiogroup");
    sw.setAttribute("aria-label", "Tema");
    sw.innerHTML = ["system", "light", "dark"].map((m) =>
      `<button type="button" role="radio" data-mode="${m}" aria-label="${LABELS[m]}" title="${LABELS[m]}">${ICONS[m]}</button>`).join("");
    sw.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) apply(b.dataset.mode); });
    sw.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const bs = [...sw.querySelectorAll("button")];
      const i = bs.indexOf(document.activeElement);
      const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
      n.focus(); n.click();
    });
  });
  const s = stored();
  apply(s === "light" || s === "dark" ? s : "system");
  // Segue o sistema em tempo real quando a pessoa não fixou um tema.
  media.addEventListener("change", () => { if (!root.dataset.theme) apply("system"); });

  // Menu mobile
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("menu");
  if (toggle && menu) {
    const set = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("menu-open", open);
    };
    toggle.addEventListener("click", () => set(toggle.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    matchMedia("(min-width: 48em)").addEventListener("change", (e) => { if (e.matches) set(false); });
  }

  // Holofote: atualiza --mx/--my do cartão sob o cursor (um listener só, com rAF).
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let pending = null;
    document.addEventListener("pointermove", (e) => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = null;
        const el = e.target.closest?.(".spot, [data-glow]");
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    }, { passive: true });
  }

  // Revelação ao rolar
  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce.matches) {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    els.forEach((el) => io.observe(el));
  } else els.forEach((el) => el.classList.add("in"));
})();
