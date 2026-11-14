// Sistema completo, ciclo a ciclo: CPU RV32I (subconjunto) + L1 + barramento
// arbitrado + DMA em rajada + PIC + Timer + Console + LED, mapeados em memória.
// Ordem do tick (igual ao trabalho original): timer → console → barramento → CPU → DMA.

import { Cache } from "./cache.js";
import { decode } from "./assembler.js";

export const MAP = {
  RAM_SIZE: 0x10000,
  TIMER: 0x10000000, CONSOLE: 0x10000100, DMA: 0x10000200, LED: 0x10000300, PIC: 0x10000f00,
};
export const IRQ = { TIMER: 0, CONSOLE: 1, DMA: 2 };
export const OWNER = { IDLE: 0, CPU: 1, DMA: 2 };

export const DEFAULT_CONFIG = Object.freeze({
  clockHz: 100_000_000,
  cacheType: "split",        // split | unified
  cacheSizeBytes: 1024,
  cacheAssoc: 2,
  cacheLineBytes: 16,
  cacheHitCycles: 1,
  missPenaltyCycles: 20,
  writePolicy: "WT",         // WT | WB
  writeAlloc: true,
  replacement: "LRU",        // LRU | FIFO | RAND
  busWidthBytes: 4,
  busWaitStates: 1,
  arbitration: "fixed",      // fixed | round_robin
  dmaBurstBytes: 16,
  timerPeriod: 200,
  irqVector: 0x100,
  irqEntryPenalty: 5,
  consoleTxCycles: 20,
  seed: 42,
});

// Configuração exatamente como estava na planilha original.
export const ORIGINAL_CONFIG = Object.freeze({
  ...DEFAULT_CONFIG, cacheSizeBytes: 16384, cacheLineBytes: 64,
});

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Bus {
  constructor(m) { this.m = m; this.reset(); }
  reset() {
    this.owner = OWNER.IDLE; this.remaining = 0; this.total = 0;
    this.req = { [OWNER.CPU]: 0, [OWNER.DMA]: 0 };
    this.lastWinner = OWNER.DMA;
    this.busy = { [OWNER.CPU]: 0, [OWNER.DMA]: 0 };
    this.history = new Uint8Array(4096); // owner por ciclo (anel)
  }
  request(who, cycles) { this.req[who] = Math.max(1, cycles); }
  waiting(who) { return this.req[who] > 0 && this.owner !== who; }
  tick() {
    if (this.owner !== OWNER.IDLE && this.remaining === 0) this.owner = OWNER.IDLE;
    if (this.owner === OWNER.IDLE) {
      const c = this.req[OWNER.CPU] > 0, d = this.req[OWNER.DMA] > 0;
      let win = OWNER.IDLE;
      if (c && d) {
        win = this.m.cfg.arbitration === "round_robin"
          ? (this.lastWinner === OWNER.CPU ? OWNER.DMA : OWNER.CPU)
          : OWNER.CPU;
      } else if (c) win = OWNER.CPU; else if (d) win = OWNER.DMA;
      if (win !== OWNER.IDLE) {
        this.owner = win; this.remaining = this.total = this.req[win]; this.req[win] = 0; this.lastWinner = win;
        this.m.log("bus", `${win === OWNER.CPU ? "CPU" : "DMA"} ganhou o barramento (${this.remaining} ciclos)`);
      }
    }
    this.history[this.m.cycle & 4095] = this.owner;
    if (this.owner !== OWNER.IDLE) { this.busy[this.owner]++; this.remaining--; }
  }
}

class Pic {
  constructor(m) { this.m = m; this.reset(); }
  reset() {
    this.pending = 0; this.mask = 0; this.current = -1;
    this.raisedAt = [-1, -1, -1, -1]; this.latencies = [[], [], [], []]; this.count = [0, 0, 0, 0];
  }
  raise(v) {
    if (!(this.pending & (1 << v))) this.raisedAt[v] = this.m.cycle;
    this.pending |= 1 << v; this.count[v]++;
    this.m.log("pic", `IRQ ${v} (${["timer", "console", "dma", "?"][v]}) pendente`);
  }
  active() {
    const a = this.pending & ~this.mask;
    if (!a) return -1;
    for (let v = 0; v < 4; v++) if (a & (1 << v)) return v; // prioridade fixa: menor vetor
    return -1;
  }
  ack(v) {
    this.pending &= ~(1 << v); this.current = v;
    if (this.raisedAt[v] >= 0) { this.latencies[v].push(this.m.cycle - this.raisedAt[v]); this.raisedAt[v] = -1; }
  }
  read(off) { return off === 0 ? this.mask : off === 4 ? this.pending : off === 0xc ? this.current : 0; }
  write(off, v) {
    if (off === 0) this.mask = v & 0xf;
    else if (off === 8) this.pending &= ~(1 << (v & 3)); // EOI manual
  }
}

class Timer {
  constructor(m) { this.m = m; this.reset(); }
  reset() { this.ctrl = 0; this.period = this.m.cfg.timerPeriod; this.count = 0; this.status = 0; this.fired = 0; }
  tick() {
    if (!this.ctrl) return;
    if (++this.count >= this.period) {
      this.count = 0; this.status = 1; this.fired++;
      this.m.pic.raise(IRQ.TIMER);
    }
  }
  read(off) { return [this.ctrl, this.period, this.count, this.status][off >> 2] ?? 0; }
  write(off, v) {
    if (off === 0) this.ctrl = v & 1;
    else if (off === 4) this.period = Math.max(1, v);
    else if (off === 0xc && v === 1) this.status = 0;
  }
}

class Console {
  constructor(m) { this.m = m; this.reset(); }
  reset() { this.rxQueue = []; this.rx = 0; this.rxReady = 0; this.ctrl = 0; this.txBusy = 0; this.output = ""; }
  type(ch) { for (const c of String(ch)) this.rxQueue.push(c.charCodeAt(0) & 0xff); }
  tick() {
    if (this.txBusy > 0) this.txBusy--;
    if (!this.rxReady && this.rxQueue.length) {
      this.rx = this.rxQueue.shift(); this.rxReady = 1;
      this.m.log("console", `tecla recebida '${String.fromCharCode(this.rx)}'`);
      if (this.ctrl & 1) this.m.pic.raise(IRQ.CONSOLE);
    }
  }
  read(off) {
    if (off === 0) { const v = this.rx; this.rxReady = 0; return v; }
    if (off === 4) return this.rxReady | (this.txBusy > 0 ? 2 : 0);
    if (off === 8) return this.ctrl;
    return 0;
  }
  write(off, v) {
    if (off === 0) {
      this.output += String.fromCharCode(v & 0xff); this.txBusy = this.m.cfg.consoleTxCycles;
      this.m.log("console", `saída '${String.fromCharCode(v & 0xff)}'`);
    } else if (off === 8) this.ctrl = v & 1;
  }
}

class Led {
  constructor(m) { this.m = m; this.reset(); }
  reset() { this.on = 0; this.toggles = 0; }
  read() { return this.on; }
  write(off, v) { const n = v & 1; if (n !== this.on) this.toggles++; this.on = n; }
}

class Dma {
  constructor(m) { this.m = m; this.reset(); }
  reset() {
    this.src = 0; this.dst = 0; this.len = 0; this.state = 0; // 0 ocioso, 1 transferindo, 2 concluído
    this.left = 0; this.cur = { src: 0, dst: 0 }; this.inBurst = false; this.waitLeft = 0; this.wordsLeft = 0;
    this.bytesMoved = 0; this.startCycle = -1; this.endCycle = -1; this.stalls = 0; this.irqPending = false;
  }
  read(off) { return [this.src, this.dst, this.len, 0, this.state][off >> 2] ?? 0; }
  write(off, v) {
    if (off === 0) this.src = v >>> 0;
    else if (off === 4) this.dst = v >>> 0;
    else if (off === 8) this.len = v >>> 0;
    else if (off === 0xc && (v & 1)) this.start();
  }
  start() {
    if (this.state === 1) { this.m.log("dma", "START ignorado: transferência em andamento", "warn"); return; }
    const w = this.m.cfg.busWidthBytes;
    if (this.len === 0 || this.len % w || this.src % w || this.dst % w) {
      this.m.log("dma", `parâmetros inválidos (src/dst/len precisam ser múltiplos de ${w})`, "error"); return;
    }
    if (this.src + this.len > MAP.RAM_SIZE || this.dst + this.len > MAP.RAM_SIZE) {
      this.m.log("dma", "faixa fora da RAM", "error"); return;
    }
    const inv = this.m.invalidate(this.dst, this.dst + this.len);
    this.cur = { src: this.src, dst: this.dst }; this.left = this.len; this.state = 1;
    this.startCycle = this.m.cycle; this.endCycle = -1; this.inBurst = false;
    this.m.log("dma", `início: ${this.len} B de 0x${this.src.toString(16)} → 0x${this.dst.toString(16)} (${inv} linha(s) invalidadas)`);
  }
  tick() {
    const m = this.m, bus = m.bus;
    if (this.irqPending) { this.irqPending = false; m.pic.raise(IRQ.DMA); }
    if (this.state !== 1) return;
    if (!this.inBurst) {
      if (bus.owner !== OWNER.DMA) {
        if (!bus.req[OWNER.DMA]) {
          const w = m.cfg.busWidthBytes;
          this.wordsLeft = Math.min(Math.max(1, m.cfg.dmaBurstBytes / w), this.left / w);
          this.waitLeft = m.cfg.busWaitStates;
          bus.request(OWNER.DMA, this.waitLeft + this.wordsLeft);
        }
        this.stalls++;
        return;
      }
      this.inBurst = true;
    }
    if (this.waitLeft > 0) { this.waitLeft--; return; }
    const w = m.cfg.busWidthBytes;
    m.ram32w(this.cur.dst, m.ram32(this.cur.src));
    this.cur.src += w; this.cur.dst += w; this.left -= w; this.bytesMoved += w; this.wordsLeft--;
    if (this.left <= 0) {
      this.state = 2; this.inBurst = false; this.endCycle = m.cycle; this.irqPending = true;
      m.log("dma", `concluído em ${this.endCycle - this.startCycle + 1} ciclos`);
    } else if (this.wordsLeft === 0) this.inBurst = false;
  }
}

const S = { FETCH: 0, EXEC: 1, STALL: 2, WAIT_BUS: 3, WFI: 4, HALT: 5 };
export const CPU_STATE = S;

class Cpu {
  constructor(m) { this.m = m; this.reset(); }
  reset() {
    this.x = new Int32Array(32); this.pc = 0; this.ir = 0; this.irPc = 0;
    this.state = S.FETCH; this.next = S.EXEC; this.stall = 0; this.busCycles = 0;
    this.mie = 1; this.mepc = 0; this.inIsr = false;
    this.stallMem = 0; this.stallBus = 0; this.idle = 0; this.haltReason = null;
    this.changed = -1;
  }
  // Acesso à memória pelo caminho cache → barramento. Decide o próximo estado.
  memAccess(cache, addr, isWrite, then) {
    const m = this.m;
    this.busAddr = addr >>> 0; this.busWrite = isWrite;
    this.busSrc = addr >= MAP.TIMER ? "mmio" : then === S.EXEC ? "i" : "d";
    if (addr >= MAP.TIMER) { // MMIO: sem cache, 1 transação + wait states
      this.busCycles = 1 + m.cfg.busWaitStates;
      m.bus.request(OWNER.CPU, this.busCycles);
      this.state = S.WAIT_BUS; this.next = then; return;
    }
    if (addr + 3 >= MAP.RAM_SIZE) return this.halt(`acesso fora da RAM em 0x${(addr >>> 0).toString(16)}`);
    const r = cache.access(addr, isWrite, m.cycle);
    const extraHit = m.cfg.cacheHitCycles - 1;
    if (r.memOps > 0) {
      this.busCycles = r.memOps * m.cfg.missPenaltyCycles;
      m.bus.request(OWNER.CPU, this.busCycles);
      this.state = S.WAIT_BUS; this.next = then; this.stallMem += extraHit; this.pendingHitStall = extraHit;
    } else if (extraHit > 0) {
      this.stall = extraHit; this.stallMem += extraHit; this.state = S.STALL; this.next = then;
    } else this.state = then;
  }
  halt(reason) { this.state = S.HALT; this.haltReason = reason; this.m.log("cpu", reason, reason === "ECALL" ? "info" : "error"); }
  tick() {
    const m = this.m;
    this.x[0] = 0;
    switch (this.state) {
      case S.HALT: return;
      case S.STALL:
        if (--this.stall <= 0) this.state = this.next;
        return;
      case S.WAIT_BUS:
        if (m.bus.owner === OWNER.CPU) {
          this.stallMem += this.busCycles;
          this.stall = this.busCycles - 1 + (this.pendingHitStall || 0); this.pendingHitStall = 0;
          this.state = this.stall > 0 ? S.STALL : this.next;
        } else this.stallBus++;
        return;
      case S.WFI:
        this.idle++;
        if (m.pic.active() >= 0) { this.state = S.FETCH; m.log("cpu", "WFI: acordou com interrupção pendente"); }
        return;
      case S.FETCH: {
        const v = m.pic.active();
        if (v >= 0 && this.mie) {
          this.mepc = this.pc; this.pc = m.cfg.irqVector >>> 0; this.mie = 0; this.inIsr = true;
          m.pic.ack(v);
          m.log("cpu", `interrupção ${v}: salva mepc=0x${this.mepc.toString(16)}, salta para 0x${this.pc.toString(16)}`, "irq");
          this.stall = m.cfg.irqEntryPenalty; this.state = S.STALL; this.next = S.FETCH;
          return;
        }
        if (this.pc & 3) return this.halt(`PC desalinhado 0x${this.pc.toString(16)}`);
        if (this.pc + 3 >= MAP.RAM_SIZE) return this.halt(`PC fora da RAM 0x${this.pc.toString(16)}`);
        this.irPc = this.pc; this.ir = m.ram32(this.pc) >>> 0;
        return this.memAccess(m.icache, this.pc, false, S.EXEC);
      }
      case S.EXEC: return this.execute();
    }
  }
  execute() {
    const m = this.m, x = this.x, w = this.ir, pc = this.irPc;
    const d = decode(w);
    let next = (pc + 4) >>> 0, then = S.FETCH, mem = null;
    const set = (rd, v) => { if (rd) { x[rd] = v | 0; this.changed = rd; } };
    m.instret++;
    switch (d.op) {
      case 0x33: {
        const a = x[d.rs1], b = x[d.rs2], sh = b & 31;
        const k = (d.f7 << 3) | d.f3;
        const r = {
          0x000: a + b, 0x100: a - b, 0x001: a << sh, 0x002: a < b ? 1 : 0, 0x003: (a >>> 0) < (b >>> 0) ? 1 : 0,
          0x004: a ^ b, 0x005: a >>> sh, 0x105: a >> sh, 0x006: a | b, 0x007: a & b,
        }[k];
        if (r === undefined) return this.halt(`instrução inválida 0x${w.toString(16)} em 0x${pc.toString(16)}`);
        set(d.rd, r); break;
      }
      case 0x13: {
        const a = x[d.rs1], i = d.immI, sh = d.rs2;
        const r = [a + i, a << sh, a < i ? 1 : 0, (a >>> 0) < (i >>> 0) ? 1 : 0, a ^ i, d.f7 ? a >> sh : a >>> sh, a | i, a & i][d.f3];
        set(d.rd, r); break;
      }
      case 0x03: {
        if (d.f3 !== 2) return this.halt("apenas LW é suportado");
        const addr = (x[d.rs1] + d.immI) >>> 0;
        if (addr & 3) return this.halt(`LW desalinhado em 0x${addr.toString(16)}`);
        set(d.rd, m.read32(addr)); mem = { addr, write: false }; break;
      }
      case 0x23: {
        if (d.f3 !== 2) return this.halt("apenas SW é suportado");
        const addr = (x[d.rs1] + d.immS) >>> 0;
        if (addr & 3) return this.halt(`SW desalinhado em 0x${addr.toString(16)}`);
        m.write32(addr, x[d.rs2]); mem = { addr, write: true }; break;
      }
      case 0x63: {
        const a = x[d.rs1], b = x[d.rs2];
        const t = [a === b, a !== b, false, false, a < b, a >= b, (a >>> 0) < (b >>> 0), (a >>> 0) >= (b >>> 0)][d.f3];
        if (t) next = (pc + d.immB) >>> 0; break;
      }
      case 0x6f: set(d.rd, pc + 4); next = (pc + d.immJ) >>> 0; break;
      case 0x67: { const t = (x[d.rs1] + d.immI) & ~1; set(d.rd, pc + 4); next = t >>> 0; break; }
      case 0x37: set(d.rd, d.immU); break;
      case 0x17: set(d.rd, pc + d.immU); break;
      case 0x73:
        if (w === 0x30200073) { next = this.mepc; this.mie = 1; this.inIsr = false; m.pic.current = -1; m.log("cpu", `MRET → 0x${next.toString(16)}`, "irq"); }
        else if (w === 0x10500073) { then = S.WFI; m.log("cpu", "WFI: dormindo até a próxima interrupção"); }
        else { this.pc = next; return this.halt("ECALL"); }
        break;
      default: return this.halt(`instrução inválida 0x${w.toString(16)} em 0x${pc.toString(16)}`);
    }
    this.pc = next;
    if (mem) this.memAccess(m.dcache, mem.addr, mem.write, then);
    else this.state = then;
  }
}

export class Machine {
  constructor(cfg = {}) { this.configure(cfg); }

  configure(cfg) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.ram = new Uint8Array(MAP.RAM_SIZE);
    this.view = new DataView(this.ram.buffer);
    this.program = null;
    this.reset();
  }

  reset() {
    const c = this.cfg;
    const rng = mulberry32(c.seed);
    const cc = {
      sizeBytes: c.cacheSizeBytes, assoc: c.cacheAssoc, lineBytes: c.cacheLineBytes,
      replacement: c.replacement, writePolicy: c.writePolicy, writeAlloc: c.writeAlloc,
    };
    if (c.cacheType === "split") {
      this.icache = new Cache("L1I", cc, rng);
      this.dcache = new Cache("L1D", cc, rng);
    } else {
      this.icache = this.dcache = new Cache("L1", cc, rng);
    }
    this.cycle = 0; this.instret = 0;
    this.events = []; this.eventSeq = 0;
    this.bus = new Bus(this); this.pic = new Pic(this); this.timer = new Timer(this);
    this.console = new Console(this); this.led = new Led(this); this.dma = new Dma(this); this.cpu = new Cpu(this);
    this.ram.fill(0);
    if (this.program) for (const [a, w] of this.program.words) this.view.setUint32(a, w, true);
  }

  load(program) { this.program = program; this.reset(); }

  log(comp, msg, kind = "info") {
    this.events.push({ seq: ++this.eventSeq, cycle: this.cycle, comp, msg, kind });
    if (this.events.length > 3000) this.events.splice(0, 1000);
  }

  ram32(a) { return this.view.getInt32(a >>> 0, true); }
  ram32w(a, v) { this.view.setInt32(a >>> 0, v | 0, true); }
  invalidate(lo, hi) {
    let n = this.dcache.invalidateRange(lo, hi);
    if (this.icache !== this.dcache) n += this.icache.invalidateRange(lo, hi);
    return n;
  }

  device(addr) {
    const a = addr >>> 0;
    if (a >= MAP.TIMER && a < MAP.TIMER + 0x10) return [this.timer, a - MAP.TIMER];
    if (a >= MAP.CONSOLE && a < MAP.CONSOLE + 0x10) return [this.console, a - MAP.CONSOLE];
    if (a >= MAP.DMA && a < MAP.DMA + 0x14) return [this.dma, a - MAP.DMA];
    if (a >= MAP.LED && a < MAP.LED + 4) return [this.led, 0];
    if (a >= MAP.PIC && a < MAP.PIC + 0x10) return [this.pic, a - MAP.PIC];
    return [null, 0];
  }
  read32(addr) {
    if (addr < MAP.RAM_SIZE) return this.ram32(addr);
    const [dev, off] = this.device(addr);
    if (!dev) { this.log("bus", `leitura de MMIO sem dispositivo 0x${addr.toString(16)}`, "warn"); return 0; }
    return dev.read(off) | 0;
  }
  write32(addr, v) {
    if (addr < MAP.RAM_SIZE) { this.ram32w(addr, v); return; }
    const [dev, off] = this.device(addr);
    if (!dev) { this.log("bus", `escrita em MMIO sem dispositivo 0x${addr.toString(16)}`, "warn"); return; }
    dev.write(off, v | 0);
  }

  get halted() { return this.cpu.state === S.HALT; }

  tick() {
    if (this.halted) return false;
    this.cycle++;
    this.timer.tick();
    this.console.tick();
    this.bus.tick();
    this.cpu.tick();
    this.dma.tick();
    return true;
  }

  run(maxCycles, until) {
    for (let i = 0; i < maxCycles; i++) {
      if (!this.tick()) return true;
      if (until && until(this)) return true;
    }
    return this.halted;
  }

  metrics() {
    const caches = this.icache === this.dcache ? [this.dcache] : [this.icache, this.dcache];
    const hits = caches.reduce((s, c) => s + c.hits, 0);
    const misses = caches.reduce((s, c) => s + c.misses, 0);
    const acc = hits + misses;
    const lat = this.pic.latencies.flat();
    const dmaCycles = this.dma.endCycle >= 0 ? this.dma.endCycle - this.dma.startCycle + 1
      : this.dma.startCycle >= 0 ? this.cycle - this.dma.startCycle + 1 : 0;
    const cyc = Math.max(1, this.cycle);
    return {
      cycles: this.cycle,
      instret: this.instret,
      cpi: this.instret ? this.cycle / this.instret : 0,
      hitRate: acc ? hits / acc : 0,
      amat: acc ? this.cfg.cacheHitCycles + (misses / acc) * this.cfg.missPenaltyCycles : 0,
      mpki: this.instret ? (misses * 1000) / this.instret : 0,
      caches: caches.map((c) => ({ name: c.name, hits: c.hits, misses: c.misses, writebacks: c.writebacks, memOps: c.memOps })),
      irqCount: lat.length,
      irqLatencyAvg: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : 0,
      irqLatencyMin: lat.length ? Math.min(...lat) : 0,
      irqLatencyMax: lat.length ? Math.max(...lat) : 0,
      irqJitter: lat.length ? Math.max(...lat) - Math.min(...lat) : 0,
      dmaBytes: this.dma.bytesMoved,
      dmaCycles,
      dmaThroughput: dmaCycles ? (this.dma.bytesMoved / dmaCycles) * this.cfg.clockHz : 0,
      dmaStalls: this.dma.stalls,
      busCpu: this.bus.busy[OWNER.CPU] / cyc,
      busDma: this.bus.busy[OWNER.DMA] / cyc,
      stallMem: this.cpu.stallMem,
      stallBus: this.cpu.stallBus,
      idle: this.cpu.idle,
    };
  }
}
