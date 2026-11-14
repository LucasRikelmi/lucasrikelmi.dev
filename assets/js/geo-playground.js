// Playground do motor de geocodificação: roda o MESMO demo/nexo/js/geo_core.js
// do NEXO sobre uma cidade sintética (geo-town.js). Carregado sob demanda quando
// a seção aparece na tela, para não pesar no carregamento da página.
(() => {
  const host = document.getElementById("geo-play");
  if (!host) return;

  const STATUS = {
    verde: { label: "Exato", note: "via + quadra/lote ou número", color: "--ok" },
    azul: { label: "Bom", note: "via + quadra confirmadas", color: "--data" },
    amarelo: { label: "Aproximado", note: "eixo da rua", color: "--warn" },
    laranja: { label: "Duvidoso", note: "via parecida ou CEP como proxy", color: "--orange" },
    vermelho: { label: "Não encontrado", note: "centro do município", color: "--err" },
  };
  const EXAMPLES = [
    { e: "Rua Oito, Qd. 21 Lt. 4", b: "Setor Central", c: "" },
    { e: "AV BRASIL, 340", b: "", c: "" },
    { e: "Av. Brazil 340", b: "", c: "" },
    { e: "Rua Sessenta e Oito, 220", b: "", c: "" },
    { e: "QD 41 LT 3, RUA 12", b: "", c: "" },
    { e: "Rua 10 esq. com Av. Goiás", b: "", c: "" },
    { e: "Rod. GO-070 km 4", b: "", c: "" },
    { e: "Rua 80, 15", b: "Jardim Primavera", c: "74920123" },
    { e: "Rua das Flores, 120", b: "", c: "" },
  ];

  const load = (src) => new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("falha ao carregar " + src));
    document.head.appendChild(s);
  });

  let G, T, idx, quadras, opts, keys;
  const $ = (s) => host.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function boot() {
    try {
      await load("demo/nexo/js/geo_core.js");
      await load("assets/js/geo-town.js");
    } catch (err) {
      $(".geo-steps").innerHTML = `<p class="geo-err">${esc(err.message)}</p>`;
      return;
    }
    G = window.GeoCore; T = window.GeoTown;
    // Cede a thread entre as etapas: o boot inteiro numa tarefa só passava de 100 ms com CPU 4x.
    const ceder = () => new Promise((r) => setTimeout(r));
    ({ idx, quadras } = T.build());
    await ceder();
    keys = Object.keys(idx[T.COD]);
    opts = {
      blocking: G.construirBlockingIndex(idx),
      cepIndex: G.construirIndiceCep(idx),
      cache: new Map(),
      totalPontosPorMunicipio: { [T.COD]: keys.reduce((s, k) => s + idx[T.COD][k].length, 0) },
      centroideMunicipio: G.centroide(keys.flatMap((k) => idx[T.COD][k])),
    };
    opts.cepBairroIndex = G.construirIndiceCepBairro(idx, opts.cepIndex);
    await ceder();
    drawMap();
    await ceder();
    $(".geo-ex").innerHTML = EXAMPLES.map((x, i) => `<button type="button" class="chip" data-i="${i}">${esc(x.e)}</button>`).join("");
    $(".geo-ex").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const x = EXAMPLES[+b.dataset.i];
      const f = $("form");
      f.endereco.value = x.e; f.bairro.value = x.b; f.cep.value = x.c;
      run();
    });
    $("form").addEventListener("submit", (e) => { e.preventDefault(); run(); });
    let t; $("form").addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 250); });
    host.classList.add("ready");
    run();
  }

  // ── Mapa ──
  const XY = (p) => ({ x: (p.lo - T.LON0) * T.M_LON, y: (T.LAT0 - p.la) * T.M_LAT });
  function drawMap() {
    const svg = $(".geo-map");
    let h = "";
    for (const q of quadras) {
      h += `<rect class="q" x="${q.x0 + 14}" y="${q.y0 + 14}" width="${q.x1 - q.x0 - 28}" height="${q.y1 - q.y0 - 28}" rx="10"/>`;
      h += `<text class="q-lbl" x="${(q.x0 + q.x1) / 2}" y="${(q.y0 + q.y1) / 2 + 8}">Q${q.q}</text>`;
    }
    const x0 = T.V[0].x, x1 = T.V[T.V.length - 1].x, y0 = T.H[0].y, y1 = T.H[T.H.length - 1].y;
    for (const r of T.H) {
      h += `<line class="st" data-k="${r.key}" x1="${x0 - 40}" y1="${r.y}" x2="${x1 + 40}" y2="${r.y}"/>`;
      h += `<text class="st-lbl" x="${x0 - 50}" y="${r.y + 7}" text-anchor="end">${esc(r.name)}</text>`;
    }
    T.V.forEach((v, i) => {
      h += `<line class="st" data-k="${v.key}" x1="${v.x}" y1="${y0 - 40}" x2="${v.x}" y2="${y1 + 40 + (i % 2) * 44}"/>`;
      h += `<text class="st-lbl" x="${v.x}" y="${y1 + 82 + (i % 2) * 44}" text-anchor="middle">${esc(v.name)}</text>`;
    });
    const R = T.ROD, end = [R.from[0] + R.dir[0] * 600, R.from[1] + R.dir[1] * 600];
    h += `<line class="st rod" data-k="${R.key}" x1="${R.from[0]}" y1="${R.from[1]}" x2="${end[0]}" y2="${end[1]}"/>`;
    h += `<text class="st-lbl" x="${end[0] - 20}" y="${end[1] + 50}" text-anchor="end">${esc(R.name)}</text>`;
    const mid = (T.H[2].y + T.H[3].y) / 2;
    h += `<line class="divisa" x1="${x0 - 40}" y1="${mid}" x2="${x1 + 140}" y2="${mid}"/>`;
    h += `<text class="bairro" transform="translate(${x1 + 110} ${(y0 + mid) / 2}) rotate(90)" text-anchor="middle">SETOR CENTRAL</text>`;
    h += `<text class="bairro" transform="translate(${x1 + 110} ${(mid + y1) / 2}) rotate(90)" text-anchor="middle">JARDIM PRIMAVERA</text>`;
    h += `<g class="pts">`;
    for (const k of keys) for (const p of idx[T.COD][k]) { const { x, y } = XY(p); h += `<circle class="pt" data-k="${esc(k)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/>`; }
    h += `</g><g class="pin" opacity="0"><circle class="pulse" r="18"/><circle class="halo" r="26"/><path class="drop" d="M0 0 C-14 -20 -22 -30 -22 -44 A22 22 0 1 1 22 -44 C22 -30 14 -20 0 0Z"/><circle class="dot" cy="-44" r="8"/></g>`;
    svg.innerHTML = h;
  }

  function run() {
    if (!G) return;
    const f = $("form");
    const consulta = { codMunicipio: T.COD, enderecoCru: f.endereco.value, bairro: f.bairro.value, cepConsulta: f.cep.value };
    opts.cache.clear();
    const t0 = performance.now();
    const r = G.geocodificar(consulta, idx, opts);
    const ms = performance.now() - t0;
    const q = r._q || G.extrairEntidades(consulta.enderecoCru);
    const norm = G.normalizeBase(consulta.enderecoCru);
    const ranked = q.via ? keys.map((k) => ({ k, s: G.viaSimilarity(q.via, k) })).sort((a, b) => b.s - a.s).slice(0, 4) : [];
    // A cor do resultado (verde, amarelo...) pinta também a via e a barra vencedora;
    // o amarelo da marca fica fora desta seção para não ser lido como "aproximado".
    host.style.setProperty("--st", `var(${STATUS[r.status].color})`);
    renderSteps(consulta, norm, q, ranked, r, ms);
    renderMap(r);
  }

  function renderSteps(c, norm, q, ranked, r, ms) {
    const st = STATUS[r.status];
    const ent = [["tipo", q.tipo], ["via", q.via], ["quadra", q.quadra], ["lote", q.lote], ["número", q.numero], ["km", q.km], ["cruzamento", q.viaCruzamento]]
      .map(([k, v]) => `<span class="ent${v == null ? " nil" : ""}"><i>${k}</i>${v == null ? "—" : esc(v)}</span>`).join("");
    const gate = (v) => `<span class="gate" style="left:${v * 100}%"></span>`;
    const bars = ranked.length ? ranked.map((x) => `<div class="cand${x.k === r.viaKey ? " win" : ""}"><span>${esc(x.k)}</span><span class="tr">${gate(G.GATE_FUZZY)}${gate(G.GATE_FORTE)}${gate(G.GATE_EXATO)}<span class="fl" data-v="${x.s.toFixed(3)}"></span></span><b>${x.s.toFixed(2)}</b></div>`).join("") : `<p class="muted">nenhuma via extraída</p>`;
    $(".geo-steps").innerHTML = `
      <li><span class="n">1</span><div><h3>Normalização</h3><code>${esc(norm || "—")}</code></div></li>
      <li><span class="n">2</span><div><h3>Entidades extraídas</h3><div class="ents">${ent}</div></div></li>
      <li><span class="n">3</span><div><h3>Busca da via <small>similaridade · cortes 0,70 / 0,85 / 0,92</small></h3><div class="cands">${bars}</div></div></li>
      <li class="result" style="--st: var(${st.color})"><span class="n">4</span><div><h3>Decisão</h3>
        <p class="badge"><b>${st.label}</b> ${st.note}</p>
        <p class="why">${esc(r.motivo)}</p>
        <p class="meta mono">${r.candidatosNaRua || 0} ponto(s) candidatos · ${ms < 1 ? "<1" : ms.toFixed(1)} ms no seu navegador</p></div></li>`;
    // barras: entram de 0 até o score (transform, sem layout)
    requestAnimationFrame(() => $(".geo-steps").querySelectorAll(".fl").forEach((f) => f.style.setProperty("--v", f.dataset.v)));
  }

  function renderMap(r) {
    const svg = $(".geo-map");
    svg.querySelectorAll(".st.hl, .pt.hl").forEach((e) => e.classList.remove("hl"));
    if (r.viaKey) svg.querySelectorAll(`[data-k="${CSS.escape(r.viaKey)}"]`).forEach((e) => e.classList.add("hl"));
    const pin = svg.querySelector(".pin");
    if (!r.coord) { pin.setAttribute("opacity", "0"); return; }
    const { x, y } = XY({ la: r.coord.lat, lo: r.coord.lon });
    pin.style.setProperty("--st", `var(${STATUS[r.status].color})`);
    pin.setAttribute("opacity", "1");
    pin.style.transform = `translate(${x}px, ${y}px)`;
    pin.classList.remove("drop-in"); void pin.getBBox(); pin.classList.add("drop-in");
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); boot(); } }, { rootMargin: "400px" });
    io.observe(host);
  } else boot();
})();
