// Página inicial: galerias com abas acessíveis e o cartão do laboratório,
// que roda o simulador de verdade (sem interface) para medir o speedup do DMA.
(() => {
  // Galerias: padrão ARIA de abas, com setas/Home/End.
  document.querySelectorAll("[data-gallery]").forEach((g) => {
    const imgs = [...g.querySelectorAll("img")];
    const list = g.nextElementSibling;
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const url = g.querySelector(".url");
    const select = (i, focus) => {
      imgs.forEach((im, j) => { im.classList.toggle("on", i === j); im.setAttribute("aria-hidden", String(i !== j)); });
      tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      url.textContent = imgs[i].dataset.url;
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => t.addEventListener("click", () => select(i)));
    list.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      select((n + tabs.length) % tabs.length, true);
    });
  });

  // Laboratório: mede CPU × DMA quando o cartão aparece.
  const live = document.getElementById("lab-live");
  if (!live) return;
  async function measure() {
    try {
      const [{ assemble }, { Machine, OWNER }, { PROGRAMS }] = await Promise.all([
        import("../../lab/cpu/js/core/assembler.js"),
        import("../../lab/cpu/js/core/machine.js"),
        import("../../lab/cpu/js/core/programs.js"),
      ]);
      const run = (src) => { const m = new Machine(); m.load(assemble(src)); m.run(200000); return m; };
      const d = run(PROGRAMS.dma.source(256));
      const c = run(PROGRAMS.cpucopy.source(256));
      const fmt = (n) => n.toLocaleString("pt-BR");
      document.getElementById("lab-speed").textContent = (c.cycle / d.cycle).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "×";
      document.getElementById("lab-cpu-v").textContent = fmt(c.cycle) + " ciclos";
      document.getElementById("lab-dma-v").textContent = fmt(d.cycle) + " ciclos";
      requestAnimationFrame(() => {
        document.getElementById("lab-cpu").style.width = "100%";
        document.getElementById("lab-dma").style.width = (100 * d.cycle / c.cycle).toFixed(1) + "%";
      });
      // linha do tempo do barramento (agrupada em 60 fatias)
      const N = 60, per = Math.ceil(d.cycle / N);
      let html = "";
      for (let k = 0; k < N; k++) {
        let cpu = 0, dma = 0;
        for (let j = 1 + k * per; j <= Math.min(d.cycle, (k + 1) * per); j++) {
          const o = d.bus.history[j & 4095];
          if (o === OWNER.CPU) cpu++; else if (o === OWNER.DMA) dma++;
        }
        html += `<i class="${dma > cpu ? "d" : cpu ? "c" : ""}"></i>`;
      }
      document.getElementById("lab-tl").innerHTML = html;
    } catch (e) {
      document.getElementById("lab-speed").textContent = "—";
    }
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); measure(); } }, { rootMargin: "200px" });
    io.observe(live);
  } else measure();
})();
