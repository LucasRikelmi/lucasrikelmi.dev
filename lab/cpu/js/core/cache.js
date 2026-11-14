// Cache L1 apenas de tags (modelo de temporização). Os dados vivem sempre na RAM,
// então a coerência de valores é garantida; a cache decide só QUANTO custa cada acesso
// e QUANTAS transações de memória (memOps) precisam do barramento.

export class Cache {
  constructor(name, cfg, rng = Math.random) {
    this.name = name;
    this.rng = rng;
    this.lineBytes = cfg.lineBytes;
    this.assoc = cfg.assoc;
    this.sets = Math.max(1, Math.floor(cfg.sizeBytes / cfg.lineBytes / cfg.assoc));
    if (!Number.isInteger(Math.log2(this.sets)) || !Number.isInteger(Math.log2(this.lineBytes))) {
      throw new Error(`${name}: número de conjuntos e tamanho de linha precisam ser potência de 2`);
    }
    this.offsetBits = Math.log2(this.lineBytes);
    this.indexBits = Math.log2(this.sets);
    this.policy = cfg.replacement;   // LRU | FIFO | RAND
    this.writePolicy = cfg.writePolicy; // WT | WB
    this.writeAlloc = cfg.writeAlloc;
    const n = this.sets * this.assoc;
    this.valid = new Uint8Array(n);
    this.dirty = new Uint8Array(n);
    this.tag = new Uint32Array(n);
    this.stamp = new Float64Array(n);  // LRU: último uso; FIFO: instalação
    this.touched = new Float64Array(n).fill(-1); // ciclo do último acesso (UI)
    this.lastHit = new Uint8Array(n);
    this.hits = 0; this.misses = 0; this.writebacks = 0; this.memOps = 0;
    this.last = null;
  }

  split(addr) {
    const a = addr >>> 0;
    return {
      set: (a >>> this.offsetBits) & (this.sets - 1),
      tag: a >>> (this.offsetBits + this.indexBits),
    };
  }

  victim(set) {
    const base = set * this.assoc;
    for (let w = 0; w < this.assoc; w++) if (!this.valid[base + w]) return w;
    if (this.policy === "RAND") return Math.floor(this.rng() * this.assoc);
    let v = 0;
    for (let w = 1; w < this.assoc; w++) if (this.stamp[base + w] < this.stamp[base + v]) v = w;
    return v;
  }

  // Retorna { hit, memOps, set, way, writeback }.
  access(addr, isWrite, now) {
    const { set, tag } = this.split(addr);
    const base = set * this.assoc;
    let way = -1;
    for (let w = 0; w < this.assoc; w++) {
      if (this.valid[base + w] && this.tag[base + w] === tag) { way = w; break; }
    }
    let memOps = 0, writeback = false;
    const hit = way >= 0;
    if (hit) {
      this.hits++;
      if (this.policy === "LRU") this.stamp[base + way] = now;
      if (isWrite) {
        if (this.writePolicy === "WT") memOps++;
        else this.dirty[base + way] = 1;
      }
    } else {
      this.misses++;
      if (isWrite && !this.writeAlloc) {
        memOps++; // write-around: vai direto para a RAM, sem instalar
      } else {
        way = this.victim(set);
        const i = base + way;
        if (this.writePolicy === "WB" && this.valid[i] && this.dirty[i]) { memOps++; writeback = true; this.writebacks++; }
        memOps++; // preenchimento da linha
        this.valid[i] = 1; this.dirty[i] = 0; this.tag[i] = tag; this.stamp[i] = now;
        if (isWrite) {
          if (this.writePolicy === "WT") memOps++;
          else this.dirty[i] = 1;
        }
      }
    }
    if (way >= 0) { this.touched[base + way] = now; this.lastHit[base + way] = hit ? 1 : 0; }
    this.memOps += memOps;
    this.last = { set, way, hit, isWrite, addr: addr >>> 0, now };
    return { hit, memOps, set, way, writeback };
  }

  // Invalidação seletiva (snoop) das linhas que cobrem [lo, hi).
  invalidateRange(lo, hi) {
    let n = 0;
    for (let a = lo - (lo % this.lineBytes); a < hi; a += this.lineBytes) {
      const { set, tag } = this.split(a);
      for (let w = 0; w < this.assoc; w++) {
        const i = set * this.assoc + w;
        if (this.valid[i] && this.tag[i] === tag) { this.valid[i] = 0; this.dirty[i] = 0; n++; }
      }
    }
    return n;
  }

  get accesses() { return this.hits + this.misses; }
}
