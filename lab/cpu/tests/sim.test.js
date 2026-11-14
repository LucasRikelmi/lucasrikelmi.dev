import { test } from "node:test";
import assert from "node:assert/strict";
import { assemble, disasm, AsmError } from "../js/core/assembler.js";
import { Machine, ORIGINAL_CONFIG } from "../js/core/machine.js";
import { PROGRAMS } from "../js/core/programs.js";

const run = (src, cfg = {}, max = 500000) => {
  const m = new Machine(cfg);
  m.load(assemble(src));
  m.run(max);
  return m;
};

test("codifica igual ao trabalho original (planilha)", () => {
  const { words } = assemble(`
    li x1, 1
    lui x2, 65536
    sw x1, 0(x2)
loop: j loop`);
  // valores anotados na aba Assembly do .xlsm
  assert.equal(words.get(0), 0x00100093);
  assert.equal(words.get(4), 0x10000137);
  assert.equal(words.get(8), 0x00112023);
  assert.equal(words.get(12), 0x0000006f);
});

test("LI grande vira LUI+ADDI com sinal correto", () => {
  for (const v of [0x10000300, 0x12345fff, -1, -2049, 0x7fffffff]) {
    const m = run(`li a0, ${v}\n ecall`);
    assert.equal(m.cpu.x[10], v | 0, `li ${v}`);
  }
});

test("aritmética, desvios e shifts", () => {
  const m = run(`
    li t0, -8
    srai t1, t0, 1      ; -4
    srli t2, t0, 28     ; 15
    li t3, 3
    sll t4, t3, t3      ; 24
    slt t5, t0, t3      ; 1
    sltu t6, t0, t3     ; 0
    li a0, 0
    li a1, 10
l:  addi a0, a0, 1
    blt a0, a1, l
    ecall`);
  const x = m.cpu.x;
  assert.deepEqual([x[6], x[7], x[29], x[30], x[31], x[10]], [-4, 15, 24, 1, 0, 10]);
});

test("erro de montagem aponta a linha", () => {
  assert.throws(() => assemble("nop\nfoo x1, x2"), (e) => e instanceof AsmError && e.line === 2);
  assert.throws(() => assemble("addi x1, x1, 5000"), /fora do intervalo/);
});

test("desmontador faz ida e volta", () => {
  const { listing } = assemble("addi a0, a1, -3\nsw t0, 8(sp)\nmret\nwfi");
  assert.deepEqual(listing.map((l) => disasm(l.word, l.addr)), ["addi a0, a1, -3", "sw t0, 8(sp)", "mret", "wfi"]);
});

for (const bytes of [16, 64, 256]) {
  test(`cópia por DMA e por CPU produzem o mesmo resultado (${bytes} B)`, () => {
    const a = run(PROGRAMS.dma.source(bytes));
    const b = run(PROGRAMS.cpucopy.source(bytes));
    assert.equal(a.cpu.haltReason, "ECALL");
    assert.equal(b.cpu.haltReason, "ECALL");
    const src = assemble(PROGRAMS.dma.source(bytes)).labels;
    for (let i = 0; i < bytes; i += 4) {
      assert.equal(a.ram32(src.get("dst") + i), a.ram32(src.get("src") + i));
      assert.equal(b.ram32(0x800 + i), b.ram32(0x300 + i));
    }
    assert.equal(a.dma.bytesMoved, bytes);
    assert.ok(a.metrics().cycles < b.metrics().cycles, "DMA deve ser mais rápido que a CPU");
  });
}

test("timer gera IRQs periódicas e o LED pisca", () => {
  const m = new Machine();
  m.load(assemble(PROGRAMS.timer.source()));
  m.run(1000);
  assert.ok(m.led.toggles >= 15, `toggles=${m.led.toggles}`);
  const met = m.metrics();
  assert.ok(met.irqCount >= 15);
  assert.ok(met.irqLatencyMax < 50);
});

test("console ecoa em maiúsculas", () => {
  const m = new Machine();
  m.load(assemble(PROGRAMS.console.source()));
  m.run(50);
  m.console.type("abc!");
  m.run(2000);
  assert.equal(m.console.output, "ABC!");
});

test("localidade: passo sequencial tem hit rate muito maior que passo 64", () => {
  const seq = run(PROGRAMS.stride.source(4));
  const bad = run(PROGRAMS.stride.source(64));
  assert.equal(seq.cpu.x[8], 130816);
  assert.equal(bad.cpu.x[8], 130816);
  const h = (m) => m.dcache.hits / (m.dcache.hits + m.dcache.misses);
  assert.ok(h(seq) > h(bad) + 0.3, `seq=${h(seq)} bad=${h(bad)}`);
});

test("write-back reduz transações de barramento em relação a write-through", () => {
  const wt = run(PROGRAMS.stride.source(4), { writePolicy: "WT" });
  const wb = run(PROGRAMS.stride.source(4), { writePolicy: "WB" });
  assert.ok(wb.dcache.memOps < wt.dcache.memOps);
  assert.ok(wb.cycle < wt.cycle);
});

test("configuração original (16 KB / 64 B) monta e executa", () => {
  const m = run(PROGRAMS.dma.source(64), ORIGINAL_CONFIG);
  assert.equal(m.cpu.haltReason, "ECALL");
  assert.equal(m.icache.sets, 128);
});

test("round-robin não deixa o DMA passar fome", () => {
  const src = PROGRAMS.dma.source(256);
  const fixed = run(src, { arbitration: "fixed" });
  const rr = run(src, { arbitration: "round_robin" });
  assert.equal(fixed.cpu.haltReason, "ECALL");
  assert.equal(rr.cpu.haltReason, "ECALL");
  assert.ok(rr.dma.stalls <= fixed.dma.stalls);
});
