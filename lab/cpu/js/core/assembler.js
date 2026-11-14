// Montador de duas passagens para um subconjunto do RV32I.
// Passo 1 resolve rótulos e tamanhos (LI pode virar 1 ou 2 instruções);
// passo 2 codifica. Erros carregam o número da linha para o editor marcar.

const ABI = [
  "zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2", "s0", "s1",
  "a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7",
  "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11",
  "t3", "t4", "t5", "t6",
];
export const REG_NAMES = ABI;

const R = { // funct7, funct3
  ADD: [0x00, 0], SUB: [0x20, 0], SLL: [0x00, 1], SLT: [0x00, 2], SLTU: [0x00, 3],
  XOR: [0x00, 4], SRL: [0x00, 5], SRA: [0x20, 5], OR: [0x00, 6], AND: [0x00, 7],
};
const I_ALU = { ADDI: 0, SLTI: 2, SLTIU: 3, XORI: 4, ORI: 6, ANDI: 7 };
const SHIFT_I = { SLLI: [0x00, 1], SRLI: [0x00, 5], SRAI: [0x20, 5] };
const BR = { BEQ: 0, BNE: 1, BLT: 4, BGE: 5, BLTU: 6, BGEU: 7 };

export class AsmError extends Error {
  constructor(line, msg) { super(`linha ${line}: ${msg}`); this.line = line; this.detail = msg; }
}

function parseReg(tok, line) {
  const s = String(tok || "").trim().toLowerCase();
  if (s === "fp") return 8;
  const abi = ABI.indexOf(s);
  if (abi >= 0) return abi;
  const m = s.match(/^x(\d{1,2})$/);
  if (m && +m[1] < 32) return +m[1];
  throw new AsmError(line, `registrador inválido "${tok}"`);
}

function parseNum(tok) {
  const s = String(tok).trim().toLowerCase();
  if (/^-?0x[0-9a-f]+$/.test(s)) return parseInt(s, 16) | 0;
  if (/^-?0b[01]+$/.test(s)) return (s.startsWith("-") ? -1 : 1) * parseInt(s.replace(/^-?0b/, ""), 2);
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^'.'$/.test(tok.trim())) return tok.trim().charCodeAt(1);
  return null;
}

function value(tok, labels, line) {
  const n = parseNum(tok);
  if (n !== null) return n;
  const k = String(tok).trim();
  if (labels.has(k)) return labels.get(k);
  throw new AsmError(line, `valor ou rótulo desconhecido "${tok}"`);
}

function memOperand(tok, labels, line) {
  const m = String(tok).replace(/\s+/g, "").match(/^(.*)\((\w+)\)$/);
  if (!m) throw new AsmError(line, `operando de memória inválido "${tok}" (use imm(reg))`);
  return { imm: m[1] === "" ? 0 : value(m[1], labels, line), rs1: parseReg(m[2], line) };
}

function checkImm(v, bits, line, signed = true) {
  const min = signed ? -(1 << (bits - 1)) : 0;
  const max = signed ? (1 << (bits - 1)) - 1 : (1 << bits) - 1;
  if (v < min || v > max) throw new AsmError(line, `imediato ${v} fora do intervalo [${min}, ${max}]`);
}

const enc = {
  r: (f7, rs2, rs1, f3, rd, op) => ((f7 << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op) >>> 0,
  i: (imm, rs1, f3, rd, op) => (((imm & 0xfff) << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op) >>> 0,
  s: (imm, rs2, rs1, f3, op) =>
    ((((imm >> 5) & 0x7f) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | ((imm & 0x1f) << 7) | op) >>> 0,
  b: (imm, rs2, rs1, f3) =>
    ((((imm >> 12) & 1) << 31) | (((imm >> 5) & 0x3f) << 25) | (rs2 << 20) | (rs1 << 15) |
      (f3 << 12) | (((imm >> 1) & 0xf) << 8) | (((imm >> 11) & 1) << 7) | 0x63) >>> 0,
  j: (imm, rd) =>
    ((((imm >> 20) & 1) << 31) | (((imm >> 1) & 0x3ff) << 21) | (((imm >> 11) & 1) << 20) |
      (((imm >> 12) & 0xff) << 12) | (rd << 7) | 0x6f) >>> 0,
  u: (imm20, rd, op) => (((imm20 & 0xfffff) << 12) | (rd << 7) | op) >>> 0,
};

// Divide um valor de 32 bits em LUI + ADDI respeitando o sinal do ADDI.
function splitHiLo(v) {
  const lo = ((v & 0xfff) << 20) >> 20;
  const hi = ((v - lo) >>> 12) & 0xfffff;
  return { hi, lo };
}

function tokenize(src) {
  const out = [];
  src.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    let s = raw.replace(/[;#].*$/, "").trim();
    if (!s) return;
    const labels = [];
    let m;
    while ((m = s.match(/^([A-Za-z_.][\w.]*)\s*:\s*(.*)$/))) { labels.push(m[1]); s = m[2].trim(); }
    let mnemonic = null, args = [];
    if (s) {
      const sp = s.search(/\s/);
      mnemonic = (sp < 0 ? s : s.slice(0, sp)).toUpperCase();
      const rest = sp < 0 ? "" : s.slice(sp + 1);
      args = rest.split(",").map((a) => a.trim()).filter((a) => a !== "");
    }
    out.push({ line, labels, mnemonic, args, text: raw.trim() });
  });
  return out;
}

function sizeOf(st) {
  if (!st.mnemonic || st.mnemonic.startsWith(".")) return 0;
  if (st.mnemonic === "LA") return 8;
  if (st.mnemonic === "LI") {
    const v = parseNum(st.args[1] ?? "");
    if (v === null) return 8; // rótulo: sempre LUI+ADDI (como "la")
    return v >= -2048 && v <= 2047 ? 4 : 8;
  }
  return 4;
}

export function assemble(src) {
  const stmts = tokenize(src);
  const labels = new Map();
  // Passo 1
  let pc = 0;
  for (const st of stmts) {
    for (const l of st.labels) {
      if (labels.has(l)) throw new AsmError(st.line, `rótulo "${l}" duplicado`);
      labels.set(l, pc);
    }
    if (st.mnemonic === ".ORG") pc = value(st.args[0], labels, st.line) >>> 0;
    else if (st.mnemonic === ".WORD") pc += 4 * st.args.length;
    else if (st.mnemonic === ".SPACE") pc += value(st.args[0], labels, st.line);
    else if (st.mnemonic && st.mnemonic.startsWith(".")) throw new AsmError(st.line, `diretiva desconhecida ${st.mnemonic}`);
    else pc += sizeOf(st);
  }
  // Passo 2
  const words = new Map(); // addr -> word
  const listing = [];      // {addr, word, line, text, label?}
  const lineOfAddr = new Map();
  pc = 0;
  const emit = (w, st, text) => {
    if (words.has(pc)) throw new AsmError(st.line, `endereço 0x${pc.toString(16)} já ocupado (sobreposição de .org)`);
    words.set(pc, w >>> 0);
    listing.push({ addr: pc, word: w >>> 0, line: st.line, text: text ?? st.text, labels: st.labels });
    lineOfAddr.set(pc, st.line);
    pc += 4;
  };
  for (const st of stmts) {
    const { mnemonic: mn, args: a, line } = st;
    if (!mn) continue;
    const need = (n) => { if (a.length !== n) throw new AsmError(line, `${mn} espera ${n} operando(s), recebeu ${a.length}`); };
    const off = (t) => value(t, labels, line) - pc;
    if (mn === ".ORG") { pc = value(a[0], labels, line) >>> 0; continue; }
    if (mn === ".WORD") { for (const t of a) emit(value(t, labels, line), st, `.word ${t}`); continue; }
    if (mn === ".SPACE") { pc += value(a[0], labels, line); continue; }

    if (R[mn]) { need(3); const [f7, f3] = R[mn]; emit(enc.r(f7, parseReg(a[2], line), parseReg(a[1], line), f3, parseReg(a[0], line), 0x33), st); continue; }
    if (I_ALU[mn] !== undefined) {
      need(3); const imm = value(a[2], labels, line); checkImm(imm, 12, line);
      emit(enc.i(imm, parseReg(a[1], line), I_ALU[mn], parseReg(a[0], line), 0x13), st); continue;
    }
    if (SHIFT_I[mn]) {
      need(3); const sh = value(a[2], labels, line); checkImm(sh, 5, line, false);
      const [f7, f3] = SHIFT_I[mn];
      emit(enc.i((f7 << 5) | sh, parseReg(a[1], line), f3, parseReg(a[0], line), 0x13), st); continue;
    }
    if (BR[mn] !== undefined) {
      need(3); const o = off(a[2]); checkImm(o, 13, line);
      if (o & 1) throw new AsmError(line, "desvio desalinhado");
      emit(enc.b(o, parseReg(a[1], line), parseReg(a[0], line), BR[mn]), st); continue;
    }
    switch (mn) {
      case "LW": { need(2); const m = memOperand(a[1], labels, line); checkImm(m.imm, 12, line); emit(enc.i(m.imm, m.rs1, 2, parseReg(a[0], line), 0x03), st); break; }
      case "SW": { need(2); const m = memOperand(a[1], labels, line); checkImm(m.imm, 12, line); emit(enc.s(m.imm, parseReg(a[0], line), m.rs1, 2, 0x23), st); break; }
      case "JALR": {
        if (a.length === 1) { emit(enc.i(0, parseReg(a[0], line), 0, 1, 0x67), st); break; }
        need(2); const m = memOperand(a[1], labels, line); checkImm(m.imm, 12, line);
        emit(enc.i(m.imm, m.rs1, 0, parseReg(a[0], line), 0x67), st); break;
      }
      case "JAL": {
        const [rd, tgt] = a.length === 1 ? [1, a[0]] : (need(2), [parseReg(a[0], line), a[1]]);
        const o = off(tgt); checkImm(o, 21, line); emit(enc.j(o, rd), st); break;
      }
      case "J": { need(1); const o = off(a[0]); checkImm(o, 21, line); emit(enc.j(o, 0), st); break; }
      case "LUI": case "AUIPC": {
        need(2); const v = value(a[1], labels, line);
        if (v < 0 || v > 0xfffff) throw new AsmError(line, `imediato de ${mn} deve caber em 20 bits (0..0xFFFFF)`);
        emit(enc.u(v, parseReg(a[0], line), mn === "LUI" ? 0x37 : 0x17), st); break;
      }
      case "LI": case "LA": {
        need(2); const rd = parseReg(a[0], line); const v = value(a[1], labels, line) | 0;
        const literal = mn === "LI" && parseNum(a[1]) !== null;
        if (literal && v >= -2048 && v <= 2047) emit(enc.i(v, 0, 0, rd, 0x13), st);
        else {
          const { hi, lo } = splitHiLo(v);
          emit(enc.u(hi, rd, 0x37), st, `${st.text}  ; LUI`);
          emit(enc.i(lo, rd, 0, rd, 0x13), st, `             ; + ADDI`);
        }
        break;
      }
      case "MV": need(2); emit(enc.i(0, parseReg(a[1], line), 0, parseReg(a[0], line), 0x13), st); break;
      case "NOP": emit(enc.i(0, 0, 0, 0, 0x13), st); break;
      case "BEQZ": case "BNEZ": {
        need(2); const o = off(a[1]); checkImm(o, 13, line);
        emit(enc.b(o, 0, parseReg(a[0], line), mn === "BEQZ" ? 0 : 1), st); break;
      }
      case "RET": emit(enc.i(0, 1, 0, 0, 0x67), st); break;
      case "ECALL": emit(0x00000073, st); break;
      case "MRET": emit(0x30200073, st); break;
      case "WFI": emit(0x10500073, st); break;
      default: throw new AsmError(line, `instrução desconhecida "${mn}"`);
    }
  }
  return { words, listing, labels, lineOfAddr };
}

// ── Desmontador (para o painel da CPU) ──
const sx = (v, bits) => (v << (32 - bits)) >> (32 - bits);
export function decode(w) {
  const op = w & 0x7f, rd = (w >>> 7) & 31, f3 = (w >>> 12) & 7, rs1 = (w >>> 15) & 31, rs2 = (w >>> 20) & 31, f7 = w >>> 25;
  const immI = w >> 20;
  const immS = ((w >> 25) << 5) | ((w >>> 7) & 31);
  const immB = sx((((w >>> 31) & 1) << 12) | (((w >>> 7) & 1) << 11) | (((w >>> 25) & 0x3f) << 5) | (((w >>> 8) & 0xf) << 1), 13);
  const immJ = sx((((w >>> 31) & 1) << 20) | (((w >>> 12) & 0xff) << 12) | (((w >>> 20) & 1) << 11) | (((w >>> 21) & 0x3ff) << 1), 21);
  const immU = w & 0xfffff000;
  return { op, rd, f3, rs1, rs2, f7, immI, immS, immB, immJ, immU };
}

export function disasm(w, pc = 0) {
  const d = decode(w >>> 0);
  const r = (n) => ABI[n];
  const hex = (n) => "0x" + (n >>> 0).toString(16);
  switch (d.op) {
    case 0x33: { const n = Object.keys(R).find((k) => R[k][0] === d.f7 && R[k][1] === d.f3); return n ? `${n.toLowerCase()} ${r(d.rd)}, ${r(d.rs1)}, ${r(d.rs2)}` : "?"; }
    case 0x13: {
      if (w === 0x13) return "nop";
      if (d.f3 === 1 || d.f3 === 5) { const n = d.f3 === 1 ? "slli" : (d.f7 ? "srai" : "srli"); return `${n} ${r(d.rd)}, ${r(d.rs1)}, ${d.rs2}`; }
      const n = Object.keys(I_ALU).find((k) => I_ALU[k] === d.f3).toLowerCase();
      if (n === "addi" && d.rs1 === 0) return `li ${r(d.rd)}, ${d.immI}`;
      return `${n} ${r(d.rd)}, ${r(d.rs1)}, ${d.immI}`;
    }
    case 0x03: return `lw ${r(d.rd)}, ${d.immI}(${r(d.rs1)})`;
    case 0x23: return `sw ${r(d.rs2)}, ${d.immS}(${r(d.rs1)})`;
    case 0x63: { const n = Object.keys(BR).find((k) => BR[k] === d.f3) || "b?"; return `${n.toLowerCase()} ${r(d.rs1)}, ${r(d.rs2)}, ${hex(pc + d.immB)}`; }
    case 0x6f: return d.rd === 0 ? `j ${hex(pc + d.immJ)}` : `jal ${r(d.rd)}, ${hex(pc + d.immJ)}`;
    case 0x67: return `jalr ${r(d.rd)}, ${d.immI}(${r(d.rs1)})`;
    case 0x37: return `lui ${r(d.rd)}, ${hex(d.immU >>> 12)}`;
    case 0x17: return `auipc ${r(d.rd)}, ${hex(d.immU >>> 12)}`;
    case 0x73: return w === 0x30200073 ? "mret" : w === 0x10500073 ? "wfi" : "ecall";
    default: return w === 0 ? "—" : ".word " + hex(w);
  }
}
