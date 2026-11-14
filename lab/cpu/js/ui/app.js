// Interface do simulador. O núcleo (../core) não conhece o DOM; aqui só lemos o
// estado da máquina e desenhamos. A renderização é limitada a 1x por quadro.

import { assemble, disasm, REG_NAMES, AsmError } from "../core/assembler.js";
import { Machine, DEFAULT_CONFIG, ORIGINAL_CONFIG, OWNER, CPU_STATE, MAP } from "../core/machine.js";
import { PROGRAMS } from "../core/programs.js";

const $ = (s, el = document) => el.querySelector(s);
const hex = (v, n = 8) => "0x" + (v >>> 0).toString(16).padStart(n, "0");
const fmt = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—";
const int = (v) => Math.round(v).toLocaleString("pt-BR");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const CATALOG = [
  { key: "dma", label: "Cópia por DMA (64 B)", make: () => PROGRAMS.dma.source(64), info: PROGRAMS.dma },
  { key: "cpucopy", label: "Cópia pela CPU (64 B)", make: () => PROGRAMS.cpucopy.source(64), info: PROGRAMS.cpucopy },
  { key: "timer", label: "Pisca LED (timer + IRQ)", make: () => PROGRAMS.timer.source(), info: PROGRAMS.timer },
  { key: "console", label: "Console com eco (IRQ)", make: () => PROGRAMS.console.source(), info: PROGRAMS.console },
  { key: "stride4", label: "Localidade: passo 4 B", make: () => PROGRAMS.stride.source(4), info: PROGRAMS.stride },
  { key: "stride64", label: "Localidade: passo 64 B", make: () => PROGRAMS.stride.source(64), info: PROGRAMS.stride },
  { key: "custom", label: "Meu código (editor)", make: null, info: { summary: "Código escrito no editor. Use .org 0x100 para a rotina de interrupção e termine com ECALL.", cycles: 100000 } },
];
const SPEEDS = [2, 5, 20, 60, 250, 2000, Infinity];
const SPEED_LABEL = (s) => (s === Infinity ? "máxima" : `${s.toLocaleString("pt-BR")} ciclos/s`);

const state = {
  cfg: { ...DEFAULT_CONFIG },
  m: null,
  prog: null,
  entry: CATALOG[0],
  bps: new Set(),
  running: false,
  speed: 2,
  acc: 0,
  last: 0,
  hexRadix: true,
  logFilter: "todos",
  lastSeq: 0,
  lastMetrics: 0,
  prevRegs: new Int32Array(32),
  colors: {},
};

// ── Cores vindas do CSS (para os canvas) ──
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["bg", "card", "card-2", "line", "line-2", "ink", "muted", "accent", "accent-fill", "data", "ok", "warn", "err"]) {
    state.colors[k] = cs.getPropertyValue("--" + k).trim();
  }
}

// ── Carregamento ──
function buildProgramSelect() {
  const sel = $("#program");
  sel.innerHTML = CATALOG.map((c) => `<option value="${c.key}">${c.label}</option>`).join("");
  sel.addEventListener("change", () => selectProgram(sel.value));
}

function selectProgram(key) {
  const entry = CATALOG.find((c) => c.key === key) || CATALOG[0];
  state.entry = entry;
  $("#program").value = entry.key;
  $("#summary").textContent = entry.info.summary;
  if (entry.make) $("#editor").value = entry.make();
  state.bps.clear();
  loadSource($("#editor").value);
  $("#term-form").classList.toggle("hl", !!entry.info.interactive);
}

function loadSource(src) {
  pause();
  const msg = $("#asm-msg");
  try {
    state.prog = assemble(src);
    state.m = new Machine(state.cfg);
    state.m.load(state.prog);
    msg.textContent = `${state.prog.listing.length} palavras montadas`;
    msg.className = "asm-msg ok";
  } catch (e) {
    msg.textContent = e instanceof AsmError ? `Erro na ${e.message}` : String(e.message || e);
    msg.className = "asm-msg err";
    showTab("editor");
    if (e instanceof AsmError) selectLine($("#editor"), e.line);
    return false;
  }
  state.lastSeq = 0; state.prevRegs.fill(0);
  $("#events").innerHTML = ""; $("#term").textContent = "";
  renderListing(); buildCaches(); buildRamMap(); render(true);
  return true;
}

function selectLine(ta, line) {
  const lines = ta.value.split("\n");
  let start = 0;
  for (let i = 0; i < line - 1; i++) start += lines[i].length + 1;
  ta.focus(); ta.setSelectionRange(start, start + (lines[line - 1] || "").length);
}

// ── Execução ──
function atBreakpoint(m) {
  return m.cpu.state === CPU_STATE.FETCH && state.bps.has(m.cpu.pc);
}

function stepCycles(n) {
  const m = state.m;
  for (let i = 0; i < n; i++) {
    if (!m.tick()) { pause(); return; }
    if (state.running && atBreakpoint(m)) { pause(); flashStatus(`parado no ponto 0x${m.cpu.pc.toString(16)}`); return; }
  }
}

function stepInstr() {
  const m = state.m, start = m.instret;
  for (let i = 0; i < 20000 && m.instret === start; i++) if (!m.tick()) break;
  render(true);
}

function runToEnd() {
  pause();
  const m = state.m;
  const limit = state.entry.info.cycles || 100000;
  const t0 = performance.now();
  for (let i = 0; i < limit; i++) {
    if (!m.tick()) break;
    if (atBreakpoint(m) && i > 0) { flashStatus(`parado no ponto 0x${m.cpu.pc.toString(16)}`); break; }
    if ((i & 4095) === 0 && performance.now() - t0 > 1500) break; // não trava a aba
  }
  render(true);
}

function play() {
  if (state.m.halted) return;
  state.running = true; state.last = performance.now(); state.acc = 0;
  document.body.classList.add("running");
  $("#btn-run").setAttribute("aria-label", "Pausar");
  requestAnimationFrame(loop);
}
function pause() {
  state.running = false;
  document.body.classList.remove("running");
  $("#btn-run")?.setAttribute("aria-label", "Executar");
}

function loop(ts) {
  if (!state.running) { render(true); return; }
  const dt = Math.min(0.1, (ts - state.last) / 1000);
  state.last = ts;
  const sp = SPEEDS[state.speed];
  if (sp === Infinity) stepCycles(4000);
  else {
    state.acc += sp * dt;
    const n = Math.floor(state.acc);
    state.acc -= n;
    if (n > 0) stepCycles(n);
  }
  render(false);
  if (state.running) requestAnimationFrame(loop);
}

let statusMsg = null, statusUntil = 0;
function flashStatus(t) { statusMsg = t; statusUntil = performance.now() + 2500; }

// ── Renderização ──
function render(force) {
  const m = state.m;
  if (!m) return;
  $("#cycle").textContent = m.cycle.toLocaleString("pt-BR");
  const st = $("#status");
  if (m.halted) {
    const ok = m.cpu.haltReason === "ECALL";
    st.textContent = ok ? "fim (ecall)" : "erro"; st.className = "pill " + (ok ? "done" : "err");
    st.title = m.cpu.haltReason;
  } else if (statusMsg && performance.now() < statusUntil) {
    st.textContent = statusMsg; st.className = "pill";
  } else if (state.running) { st.textContent = "executando"; st.className = "pill run"; }
  else { st.textContent = m.cycle ? "pausado" : "pronto"; st.className = "pill"; }

  renderDiagram();
  renderListingPc();
  renderRegs();
  renderCaches();
  renderBus();
  renderConsole();
  renderEvents();
  const now = performance.now();
  if (force || now - state.lastMetrics > 120) { state.lastMetrics = now; renderMetrics(); renderHexdump(); }
}

// Diagrama
const svgEl = (id) => document.getElementById(id);
const TAP = { cpuMmio: 130, i: 445, d: 345, ram: 555, dma: 780, timer: 145, console: 345, led: 535, pic: 760 };
function devTap(addr) {
  if (addr >= MAP.PIC) return "pic";
  if (addr >= MAP.LED) return "led";
  if (addr >= MAP.DMA) return "dma";
  if (addr >= MAP.CONSOLE) return "console";
  return "timer";
}
function setOn(id, on, extra) {
  const el = svgEl(id);
  el.classList.toggle("on", !!on);
  if (extra !== undefined) el.classList.toggle("cpu", !!extra);
}
function renderDiagram() {
  const m = state.m, cpu = m.cpu, bus = m.bus, c = m.cycle;
  const names = ["FETCH", "EXEC", "STALL", "ESPERA BUS", "WFI", "PARADA"];
  svgEl("cpu-state").textContent = names[cpu.state];
  svgEl("cpu-pc").textContent = hex(cpu.pc);
  svgEl("cpu-ir").textContent = m.cycle ? hex(cpu.ir) : "—";
  svgEl("cpu-dis").textContent = m.cycle ? disasm(cpu.ir, cpu.irPc) : "—";
  svgEl("cpu-mie").textContent = cpu.mie;
  svgEl("cpu-isr").textContent = cpu.inIsr ? "sim" : "não";
  svgEl("cpu-instret").textContent = m.instret.toLocaleString("pt-BR");

  const split = m.icache !== m.dcache;
  svgEl("l1d-name").textContent = split ? "L1D" : "L1 (unif.)";
  svgEl("b-l1i").style.opacity = split ? 1 : 0.35;
  for (const [id, cache] of [["l1i", m.icache], ["l1d", m.dcache]]) {
    svgEl(id + "-hits").textContent = cache.hits.toLocaleString("pt-BR");
    svgEl(id + "-miss").textContent = cache.misses.toLocaleString("pt-BR");
    const l = cache.last, recent = l && c - l.now <= 2;
    const t = svgEl(id + "-last");
    t.textContent = recent ? (l.hit ? "acerto" : "falta") : "";
    t.setAttribute("class", "b-hit " + (recent ? (l.hit ? "hit" : "miss") : ""));
  }
  const iRecent = m.icache.last && c - m.icache.last.now <= 1;
  const dRecent = m.dcache.last && c - m.dcache.last.now <= 1 && split;
  setOn("l-cpu-i", iRecent || (!split && m.dcache.last && c - m.dcache.last.now <= 1));
  setOn("l-cpu-d", dRecent);

  // Barramento
  const owner = bus.owner;
  const busRect = svgEl("bus");
  busRect.setAttribute("class", "busbar " + (owner === OWNER.CPU ? "cpu" : owner === OWNER.DMA ? "dma" : ""));
  svgEl("bus-owner").textContent = owner === OWNER.CPU ? "CPU" : owner === OWNER.DMA ? "DMA" : "livre";
  const src = cpu.busSrc;
  const cpuOwn = owner === OWNER.CPU, dmaOwn = owner === OWNER.DMA;
  setOn("l-i-bus", cpuOwn && src === "i", true);
  setOn("l-d-bus", cpuOwn && src === "d", true);
  setOn("l-cpu-mmio", cpuOwn && src === "mmio", true);
  const mmioDev = cpuOwn && src === "mmio" ? devTap(cpu.busAddr) : null;
  setOn("l-ram-bus", (cpuOwn && src !== "mmio") || dmaOwn, cpuOwn);
  setOn("l-dma-bus", dmaOwn || mmioDev === "dma", mmioDev === "dma");
  for (const d of ["timer", "console", "led", "pic"]) setOn("l-bus-" + d, mmioDev === d, true);
  // pacote viajando no barramento
  const pk = svgEl("packet");
  if (owner !== OWNER.IDLE && !reduceMotion) {
    const from = dmaOwn ? TAP.dma : src === "mmio" ? TAP.cpuMmio : TAP[src] ?? TAP.d;
    const to = dmaOwn ? TAP.ram : src === "mmio" ? TAP[mmioDev] : TAP.ram;
    const total = Math.max(1, bus.total || 1);
    const p = 1 - bus.remaining / total;
    const back = !dmaOwn && cpu.busWrite === false && src !== "mmio"; // leitura: dado volta da RAM
    const x = back ? to + (from - to) * p : from + (to - from) * p;
    pk.setAttribute("cx", x); pk.classList.add("on");
    pk.style.fill = dmaOwn ? state.colors["accent-fill"] : state.colors.data;
  } else pk.classList.remove("on");

  svgEl("b-cpu").classList.toggle("active", cpu.state === CPU_STATE.EXEC || cpu.state === CPU_STATE.FETCH);
  svgEl("b-dma").classList.toggle("active", m.dma.state === 1);
  svgEl("b-ram").classList.toggle("active", owner !== OWNER.IDLE && (dmaOwn || src !== "mmio"));
  svgEl("ram-tx").textContent = (m.dcache.memOps + (split ? m.icache.memOps : 0) + m.dma.bytesMoved / m.cfg.busWidthBytes).toLocaleString("pt-BR");

  // DMA
  const dma = m.dma;
  svgEl("dma-state").textContent = ["ocioso", "transferindo", "concluído"][dma.state];
  svgEl("dma-src").textContent = dma.len ? hex(dma.state === 1 ? dma.cur.src : dma.src, 4) : "—";
  svgEl("dma-dst").textContent = dma.len ? hex(dma.state === 1 ? dma.cur.dst : dma.dst, 4) : "—";
  svgEl("dma-left").textContent = dma.len ? `${dma.state === 1 ? dma.left : dma.state === 2 ? 0 : dma.len} B` : "—";
  svgEl("dma-prog").setAttribute("width", dma.len ? 148 * (dma.bytesMoved % (dma.len + 1)) / dma.len : 0);
  svgEl("dma-stalls").textContent = dma.stalls;

  // Periféricos
  const tm = m.timer;
  svgEl("timer-v").textContent = tm.ctrl ? `${tm.count}/${tm.period}` : "off";
  svgEl("timer-prog").setAttribute("width", tm.ctrl ? 142 * tm.count / tm.period : 0);
  const con = m.console;
  svgEl("console-v").textContent = con.rxReady ? "RX pronto" : con.txBusy ? "TX ocupado" : con.ctrl ? "IRQ on" : "—";
  svgEl("console-last").textContent = con.output ? `saída: …${con.output.slice(-14)}` : "sem saída";
  svgEl("led").classList.toggle("on", !!m.led.on);
  svgEl("led-v").textContent = `${m.led.toggles} troca${m.led.toggles === 1 ? "" : "s"}`;
  const pic = m.pic;
  const bits = svgEl("pic-bits");
  if (!bits.childElementCount) {
    bits.innerHTML = ["timer", "console", "dma"].map((n, i) =>
      `<circle class="pic-bit" id="pic-b${i}" cx="${745 + i * 46}" cy="317" r="6"/><text class="pic-lbl" x="${755 + i * 46}" y="321">${n.slice(0, 3)}</text>`).join("");
  }
  for (let i = 0; i < 3; i++) {
    const b = svgEl("pic-b" + i);
    b.classList.toggle("on", !!(pic.pending & (1 << i)));
    b.classList.toggle("masked", !!(pic.mask & (1 << i)));
  }
  const lat = pic.latencies.flat();
  svgEl("pic-v").textContent = pic.pending ? `pendente: ${pic.pending.toString(2).padStart(3, "0")}` :
    lat.length ? `${lat.length} atendida(s), última em ${lat[lat.length - 1]} ciclos` : "nenhuma pendente";
  setOn("l-irq", pic.pending || (cpu.inIsr && cpu.state === CPU_STATE.STALL));

  // RAM: células quentes
  const hot = dmaOwn ? [dma.cur.src, dma.cur.dst] : cpuOwn && src !== "mmio" ? [cpu.busAddr] : [];
  document.querySelectorAll(".ram-cell.hot").forEach((e) => e.classList.remove("hot"));
  for (const a of hot) svgEl("ram-" + Math.floor(a / 1024))?.classList.add("hot");
}

function buildRamMap() {
  const g = svgEl("ram-map");
  const used = new Set([...state.prog.words.keys()].map((a) => Math.floor(a / 1024)));
  const codeKb = new Set(state.prog.listing.filter((l) => !l.text.startsWith(".word")).map((l) => Math.floor(l.addr / 1024)));
  let html = "";
  for (let i = 0; i < 64; i++) {
    const x = 486 + (i % 8) * 17.4, y = 64 + Math.floor(i / 8) * 13.5;
    const cls = codeKb.has(i) ? "code" : used.has(i) ? "data" : "";
    html += `<rect class="ram-cell ${cls}" id="ram-${i}" x="${x}" y="${y}" width="15.4" height="11.5" rx="2"><title>0x${(i * 1024).toString(16)}–0x${(i * 1024 + 1023).toString(16)}</title></rect>`;
  }
  g.innerHTML = html;
}

// Listagem
function renderListing() {
  const tb = $("#listing tbody");
  const rows = state.prog.listing.map((l) => {
    const lbl = l.labels && l.labels.length ? `<span class="lab">${l.labels.join(", ")}:</span>\n` : "";
    const src = l.text.replace(/</g, "&lt;");
    return `<tr data-addr="${l.addr}" class="${lbl ? "lbl" : ""}${state.bps.has(l.addr) ? " bp" : ""}"><td>${hex(l.addr, 4)}</td><td>${hex(l.word)}</td><td>${lbl}${src}</td></tr>`;
  });
  tb.innerHTML = rows.join("");
  state.pcRow = null;
}
function renderListingPc() {
  const m = state.m;
  const addr = m.cpu.state === CPU_STATE.FETCH || m.cpu.state === CPU_STATE.WFI ? m.cpu.pc : m.cpu.irPc;
  if (state.pcRow && +state.pcRow.dataset.addr === addr) return;
  state.pcRow?.classList.remove("pc");
  const row = $(`#listing tr[data-addr="${addr}"]`);
  if (row) {
    row.classList.add("pc");
    const wrap = $(".listing-wrap");
    if (!wrap.closest("[hidden]")) {
      const top = row.offsetTop - wrap.clientHeight / 2;
      if (row.offsetTop < wrap.scrollTop + 30 || row.offsetTop > wrap.scrollTop + wrap.clientHeight - 30) wrap.scrollTo({ top, behavior: state.running ? "auto" : "smooth" });
    }
  }
  state.pcRow = row;
}

// Registradores
function buildRegs() {
  const g = $("#regs");
  let html = "";
  for (let i = 0; i < 32; i++) html += `<div class="reg${i === 0 ? " zero" : ""}" id="r${i}"><span class="n">x${i}<i>${REG_NAMES[i]}</i></span><span class="v">0</span></div>`;
  html += `<div class="reg special"><span class="n">pc</span><span class="v" id="r-pc"></span></div>`;
  html += `<div class="reg special"><span class="n">mepc</span><span class="v" id="r-mepc"></span></div>`;
  g.innerHTML = html;
}
function renderRegs() {
  const x = state.m.cpu.x, prev = state.prevRegs;
  const f = (v) => (state.hexRadix ? hex(v) : String(v | 0));
  for (let i = 0; i < 32; i++) {
    const el = document.getElementById("r" + i);
    const v = el.lastChild;
    const t = f(x[i]);
    if (v.textContent !== t) {
      v.textContent = t;
      if (x[i] !== prev[i]) {
        el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
        clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("flash"), 220);
      }
    }
    prev[i] = x[i];
  }
  $("#r-pc").textContent = hex(state.m.cpu.pc);
  $("#r-mepc").textContent = hex(state.m.cpu.mepc);
}

// Métricas
function renderMetrics() {
  const k = state.m.metrics();
  const cards = [
    [fmt(k.cpi), "CPI (ciclos por instrução)"],
    [k.instret ? fmt(k.hitRate * 100, 1) + "%" : "—", "taxa de acerto L1"],
    [k.instret ? fmt(k.amat) : "—", "AMAT (ciclos)"],
    [k.instret ? fmt(k.mpki, 1) : "—", "MPKI (faltas/mil instr.)"],
    [k.irqCount ? fmt(k.irqLatencyAvg, 1) : "—", `latência IRQ média${k.irqCount ? ` (${k.irqCount})` : ""}`],
    [k.irqCount ? int(k.irqJitter) : "—", "jitter IRQ (máx − mín)"],
    [k.dmaBytes ? fmt(k.dmaThroughput / 1e6, 0) + " MB/s" : "—", "vazão do DMA*"],
    [fmt((k.busCpu + k.busDma) * 100, 0) + "%", "ocupação do barramento"],
    [int(k.stallMem), "ciclos esperando memória"],
    [int(k.stallBus), "ciclos esperando o barramento"],
  ];
  $("#metrics").innerHTML = cards.map(([v, l]) => `<div class="m"><b>${v}</b><span>${l}</span></div>`).join("") +
    `<p class="hint" style="grid-column:1/-1">* bytes ÷ ciclos em que o DMA esteve ativo, a ${int(state.m.cfg.clockHz / 1e6)} MHz.</p>`;
}

// Cache
function buildCaches() {
  const m = state.m;
  const list = m.icache === m.dcache ? [m.dcache] : [m.icache, m.dcache];
  $("#caches").innerHTML = list.map((c) =>
    `<div class="cache-block"><h3><span>${c.name}</span><span>${c.sets} conjuntos × ${c.assoc} via${c.assoc > 1 ? "s" : ""} · linha ${c.lineBytes} B</span></h3><canvas class="cache-canvas" data-cache="${c.name}"></canvas></div>`).join("");
  $("#cache-geom").textContent = `${m.cfg.cacheSizeBytes} B · ${m.cfg.writePolicy} · ${m.cfg.replacement}`;
  state.cacheViews = list.map((c) => ({ cache: c, canvas: $(`canvas[data-cache="${c.name}"]`) }));
  state.cacheViews.forEach(layoutCache);
}
function layoutCache(v) {
  const c = v.cache, cv = v.canvas;
  const W = cv.clientWidth || 600;
  const cols = Math.min(c.sets, W < 520 ? 16 : 32);
  const groups = Math.ceil(c.sets / cols);
  const gap = 2, groupGap = 6;
  const cell = Math.max(6, Math.floor((W - (cols - 1) * gap) / cols));
  const H = groups * (c.assoc * (cell + gap) - gap) + (groups - 1) * groupGap;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px";
  Object.assign(v, { cols, groups, gap, groupGap, cell, dpr, W, H });
}
function cellRect(v, set, way) {
  const col = set % v.cols, grp = Math.floor(set / v.cols);
  const x = col * (v.cell + v.gap);
  const y = grp * (v.assoc * (v.cell + v.gap) - v.gap + v.groupGap) + way * (v.cell + v.gap);
  return [x, y];
}
function renderCaches() {
  const now = state.m.cycle, C = state.colors;
  for (const v of state.cacheViews || []) {
    const c = v.cache, ctx = v.canvas.getContext("2d");
    v.assoc = c.assoc;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.clearRect(0, 0, v.W, v.H);
    for (let s = 0; s < c.sets; s++) for (let w = 0; w < c.assoc; w++) {
      const i = s * c.assoc + w;
      const [x, y] = cellRect(v, s, w);
      if (!c.valid[i]) { ctx.fillStyle = C.line; ctx.globalAlpha = 0.55; }
      else {
        const age = now - c.touched[i];
        ctx.fillStyle = C.data; ctx.globalAlpha = 0.28 + 0.72 * Math.exp(-age / 150);
      }
      ctx.beginPath(); ctx.roundRect(x, y, v.cell, v.cell, 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (c.valid[i] && c.dirty[i]) { ctx.fillStyle = C.warn; ctx.beginPath(); ctx.arc(x + v.cell - 3, y + 3, 2, 0, 7); ctx.fill(); }
    }
    const l = c.last;
    if (l && l.way >= 0 && now - l.now <= 3) {
      const [x, y] = cellRect(v, l.set, l.way);
      ctx.strokeStyle = l.hit ? C.ok : C.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x - 1.5, y - 1.5, v.cell + 3, v.cell + 3, 3); ctx.stroke();
    }
  }
}
function cacheTooltip(e) {
  const cv = e.target.closest(".cache-canvas");
  const tip = $("#tip");
  if (!cv) { tip.hidden = true; return; }
  const v = state.cacheViews.find((x) => x.canvas === cv);
  const r = cv.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const c = v.cache;
  for (let s = 0; s < c.sets; s++) for (let w = 0; w < c.assoc; w++) {
    const [x, y] = cellRect(v, s, w);
    if (px >= x && px <= x + v.cell && py >= y && py <= y + v.cell) {
      const i = s * c.assoc + w;
      const base = c.valid[i] ? (((c.tag[i] << (c.offsetBits + c.indexBits)) | (s << c.offsetBits)) >>> 0) : null;
      tip.textContent = `${c.name} conjunto ${s} · via ${w}\nválida ${c.valid[i]} · suja ${c.dirty[i]}\n` +
        (base !== null ? `tag ${hex(c.tag[i], 1)} → ${hex(base, 4)}…${hex(base + c.lineBytes - 1, 4)}\núltimo uso: ciclo ${c.touched[i]}` : "linha vazia");
      tip.hidden = false;
      tip.style.left = Math.min(innerWidth - 240, e.clientX + 14) + "px";
      tip.style.top = e.clientY + 14 + "px";
      return;
    }
  }
  tip.hidden = true;
}

// Barramento
function renderBus() {
  const cv = $("#bus-canvas"), m = state.m, C = state.colors;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const N = 240, bw = W / N;
  for (let k = 0; k < N; k++) {
    const cyc = m.cycle - (N - 1 - k);
    if (cyc < 1) continue;
    const o = m.bus.history[cyc & 4095];
    ctx.fillStyle = o === OWNER.CPU ? C.data : o === OWNER.DMA ? C["accent-fill"] : C.line;
    const h = o ? H - 12 : 6;
    ctx.fillRect(k * bw, H - 6 - h, Math.max(1, bw - 0.5), h);
  }
  const k = m.metrics();
  const rows = [["CPU", k.busCpu, "cpu"], ["DMA", k.busDma, "dma"], ["livre", Math.max(0, 1 - k.busCpu - k.busDma), "idle"]];
  $("#bus-util").innerHTML = rows.map(([n, v, c]) =>
    `<div class="util-row"><span>${n}</span><span class="track"><span class="fill ${c}" style="width:${(v * 100).toFixed(1)}%"></span></span><span>${(v * 100).toFixed(0)}%</span></div>`).join("");
}

// Console
function renderConsole() {
  const out = state.m.console.output;
  const t = $("#term");
  if (t.textContent !== out) { t.textContent = out; t.scrollTop = t.scrollHeight; }
}

// Memória
function renderHexdump() {
  const m = state.m;
  let base = parseInt($("#mem-addr").value, 16);
  if (!Number.isFinite(base)) base = 0;
  base = Math.max(0, Math.min(MAP.RAM_SIZE - 128, base & ~15));
  const hot = m.dma.state === 1 ? [m.dma.cur.src - 4, m.dma.cur.dst - 4] : [];
  let html = "";
  for (let r = 0; r < 8; r++) {
    const a = base + r * 16;
    let ws = "";
    for (let k = 0; k < 4; k++) {
      const addr = a + k * 4, v = m.ram32(addr) >>> 0;
      ws += `<span class="w${v === 0 ? " z" : ""}${hot.includes(addr) ? " hot" : ""}">${v.toString(16).padStart(8, "0")}</span>`;
    }
    html += `<div class="row"><span class="a">${a.toString(16).padStart(4, "0")}</span>${ws}</div>`;
  }
  $("#hexdump").innerHTML = html;
}

// Eventos
const LOG_KINDS = ["todos", "cpu", "bus", "dma", "pic", "console"];
function buildLogFilters() {
  $("#log-filters").innerHTML = LOG_KINDS.map((k) => `<button class="chip" data-k="${k}" aria-pressed="${k === state.logFilter}">${k}</button>`).join("");
  $("#log-filters").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.logFilter = b.dataset.k;
    $("#log-filters").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#events").innerHTML = ""; state.lastSeq = 0; renderEvents();
  });
}
function renderEvents() {
  const ev = state.m.events;
  const ol = $("#events");
  const fresh = ev.filter((e) => e.seq > state.lastSeq && (state.logFilter === "todos" || e.comp === state.logFilter)).slice(-150);
  if (!fresh.length) return;
  state.lastSeq = ev[ev.length - 1].seq;
  const atBottom = ol.scrollHeight - ol.scrollTop - ol.clientHeight < 40;
  const frag = document.createDocumentFragment();
  for (const e of fresh) {
    const li = document.createElement("li");
    li.className = e.kind;
    li.innerHTML = `<span class="c">${e.cycle}</span><span class="k">${e.comp}</span><span class="t"></span>`;
    li.lastChild.textContent = e.msg;
    frag.appendChild(li);
  }
  ol.appendChild(frag);
  while (ol.childElementCount > 300) ol.firstElementChild.remove();
  if (atBottom) ol.scrollTop = ol.scrollHeight;
}

// Configuração
const CFG_FIELDS = [
  ["cacheType", "Tipo de cache", ["split", "unified"]],
  ["cacheSizeBytes", "Tamanho (bytes)", [256, 512, 1024, 2048, 4096, 8192, 16384]],
  ["cacheAssoc", "Associatividade (vias)", [1, 2, 4, 8]],
  ["cacheLineBytes", "Linha (bytes)", [8, 16, 32, 64]],
  ["replacement", "Substituição", ["LRU", "FIFO", "RAND"]],
  ["writePolicy", "Política de escrita", ["WT", "WB"]],
  ["writeAlloc", "Alocar na escrita", [true, false]],
  ["missPenaltyCycles", "Penalidade de falta (ciclos)", "num"],
  ["arbitration", "Arbitragem do barramento", ["fixed", "round_robin"]],
  ["busWaitStates", "Wait states", "num"],
  ["dmaBurstBytes", "Rajada do DMA (bytes)", [4, 8, 16, 32, 64]],
  ["timerPeriod", "Período do timer (ciclos)", "num"],
];
const LABEL_VAL = { true: "sim", false: "não", split: "separada (I + D)", unified: "unificada", fixed: "prioridade fixa (CPU)", round_robin: "round-robin", WT: "write-through", WB: "write-back" };
function buildConfig() {
  const f = $("#config");
  f.innerHTML = CFG_FIELDS.map(([k, label, opts]) => {
    const input = opts === "num"
      ? `<input type="number" name="${k}" min="0" max="1000" step="1">`
      : `<select name="${k}">${opts.map((o) => `<option value="${o}">${LABEL_VAL[o] ?? o}</option>`).join("")}</select>`;
    return `<label>${label}${input}</label>`;
  }).join("") + `<div class="actions"><button class="btn small primary" type="submit">Aplicar</button><span class="asm-msg" id="cfg-msg" role="status"></span></div>`;
  fillConfig();
  f.addEventListener("submit", (e) => { e.preventDefault(); applyConfig(readConfig()); });
  document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    applyConfig(b.dataset.preset === "original" ? { ...ORIGINAL_CONFIG } : { ...DEFAULT_CONFIG });
    fillConfig();
  }));
}
function fillConfig() {
  const f = $("#config");
  for (const [k] of CFG_FIELDS) f.elements[k].value = String(state.cfg[k]);
}
function readConfig() {
  const f = $("#config"), out = { ...state.cfg };
  for (const [k, , opts] of CFG_FIELDS) {
    const raw = f.elements[k].value;
    out[k] = raw === "true" ? true : raw === "false" ? false : /^\d+$/.test(raw) ? +raw : raw;
    if (opts === "num") out[k] = Math.max(k === "timerPeriod" || k === "missPenaltyCycles" ? 1 : 0, +raw || 0);
  }
  return out;
}
function applyConfig(cfg) {
  const msg = $("#cfg-msg");
  try { new Machine(cfg); } catch (e) { msg.textContent = e.message; msg.className = "asm-msg err"; return; }
  state.cfg = cfg;
  msg.textContent = "configuração aplicada"; msg.className = "asm-msg ok";
  loadSource($("#editor").value);
}

// Experimentos
function runHeadless(src, cfg, limit = 2e6) {
  const m = new Machine(cfg);
  m.load(assemble(src));
  m.run(limit);
  return m;
}
function bars(el, rows, unit) {
  const max = Math.max(...rows.map((r) => r.v));
  el.innerHTML = rows.map((r) => `<div class="bar-row"><span>${r.label}</span><span class="track"><span class="fill ${r.cls}"></span></span><b>${r.text ?? int(r.v) + " " + unit}</b></div>`).join("") + (rows.verdict ? `<p class="verdict">${rows.verdict}</p>` : "");
  requestAnimationFrame(() => el.querySelectorAll(".fill").forEach((f, i) => { f.style.width = (100 * rows[i].v / max).toFixed(1) + "%"; }));
}
function benchCopy() {
  const bytes = +$("#bench-bytes").value;
  const d = runHeadless(PROGRAMS.dma.source(bytes), state.cfg);
  const c = runHeadless(PROGRAMS.cpucopy.source(bytes), state.cfg);
  const rows = [
    { label: "CPU (LW/SW)", v: c.cycle, cls: "cpu" },
    { label: "DMA", v: d.cycle, cls: "dma" },
  ];
  rows.verdict = `<strong>${fmt(c.cycle / d.cycle, 1)}×</strong> mais rápido com DMA, programa inteiro (configuração, cópia e interrupção). Em write-${state.cfg.writePolicy === "WT" ? "through cada SW custa uma transação de barramento; teste com write-back" : "back as escritas ficam na cache; teste com write-through"} para ver a diferença.`;
  bars($("#bench-out"), rows, "ciclos");
}
function benchStride() {
  const a = runHeadless(PROGRAMS.stride.source(4), state.cfg);
  const b = runHeadless(PROGRAMS.stride.source(64), state.cfg);
  const hr = (m) => m.dcache.hits / Math.max(1, m.dcache.hits + m.dcache.misses);
  const rows = [
    { label: "passo 4 B", v: hr(a) * 100, cls: "dma", text: `${fmt(hr(a) * 100, 1)}% · ${int(a.cycle)} ciclos` },
    { label: "passo 64 B", v: hr(b) * 100, cls: "cpu", text: `${fmt(hr(b) * 100, 1)}% · ${int(b.cycle)} ciclos` },
  ];
  rows.verdict = `Mesma soma, mesmas instruções. Só muda a ordem de acesso: acerto na L1D de dados cai de ${fmt(hr(a) * 100, 0)}% para ${fmt(hr(b) * 100, 0)}%.`;
  bars($("#stride-out"), rows, "%");
}

// Abas
function showTab(which) {
  const ed = which === "editor";
  $("#t-listing").setAttribute("aria-selected", String(!ed));
  $("#t-editor").setAttribute("aria-selected", String(ed));
  $("#tab-listing").hidden = ed; $("#tab-editor").hidden = !ed;
}

// ── Inicialização ──
function init() {
  readColors();
  buildProgramSelect(); buildRegs(); buildLogFilters(); buildConfig();
  const tip = document.createElement("div"); tip.id = "tip"; tip.className = "tip"; tip.hidden = true; document.body.appendChild(tip);

  $("#btn-run").addEventListener("click", () => (state.running ? pause() : play()));
  $("#btn-step").addEventListener("click", () => { pause(); stepCycles(1); render(true); });
  $("#btn-instr").addEventListener("click", () => { pause(); stepInstr(); });
  $("#btn-reset").addEventListener("click", () => { loadSource($("#editor").value); });
  $("#btn-end").addEventListener("click", runToEnd);
  const sp = $("#speed");
  sp.addEventListener("input", () => { state.speed = +sp.value; $("#speed-val").textContent = SPEED_LABEL(SPEEDS[state.speed]); });
  sp.value = state.speed; $("#speed-val").textContent = SPEED_LABEL(SPEEDS[state.speed]);
  $("#t-listing").addEventListener("click", () => showTab("listing"));
  $("#t-editor").addEventListener("click", () => showTab("editor"));
  $("#btn-assemble").addEventListener("click", () => {
    state.entry = CATALOG.find((c) => c.key === "custom"); $("#program").value = "custom";
    $("#summary").textContent = state.entry.info.summary;
    if (loadSource($("#editor").value)) showTab("listing");
  });
  $("#editor").addEventListener("keydown", (e) => {
    if (e.key === "Tab") { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText("    ", s, t.selectionEnd, "end"); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("#btn-assemble").click();
  });
  $("#listing").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-addr]"); if (!tr) return;
    const a = +tr.dataset.addr;
    state.bps.has(a) ? state.bps.delete(a) : state.bps.add(a);
    tr.classList.toggle("bp", state.bps.has(a));
  });
  $("#btn-radix").addEventListener("click", (e) => {
    state.hexRadix = !state.hexRadix;
    e.target.textContent = state.hexRadix ? "hex" : "dec";
    e.target.setAttribute("aria-pressed", String(!state.hexRadix));
    renderRegs();
  });
  $("#term-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("#term-input");
    if (!inp.value) return;
    state.m.console.type(inp.value); inp.value = "";
    if (!state.running && !state.m.halted) play();
  });
  $("#mem-addr").addEventListener("change", renderHexdump);
  $("#btn-bench").addEventListener("click", benchCopy);
  $("#btn-stride").addEventListener("click", benchStride);
  document.addEventListener("pointermove", cacheTooltip, { passive: true });
  document.addEventListener("themechange", () => { readColors(); render(true); });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " ") { e.preventDefault(); state.running ? pause() : play(); }
    else if (e.key === ".") { pause(); stepCycles(1); render(true); }
    else if (e.key.toLowerCase() === "n") { pause(); stepInstr(); }
    else if (e.key.toLowerCase() === "r") loadSource($("#editor").value);
  });
  new ResizeObserver(() => { (state.cacheViews || []).forEach(layoutCache); render(true); }).observe($("#caches"));

  selectProgram("dma");
  benchCopy(); benchStride();
  // Começa rodando devagar quando o simulador aparece na tela (exceto com movimento reduzido).
  if (!reduceMotion) {
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting && state.m.cycle === 0) { play(); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe($("#diagram"));
  }
}

init();
