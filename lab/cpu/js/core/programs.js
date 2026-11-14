// Programas de exemplo. Reescritos a partir dos 4 cenários da planilha original,
// agora com MRET/WFI de verdade (sem retorno manual por x30 nem laço de atraso).

function dataWords(n, seed = 0x1234abcd) {
  const out = [];
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    out.push("0x" + x.toString(16).toUpperCase().padStart(8, "0"));
  }
  const lines = [];
  for (let i = 0; i < out.length; i += 4) lines.push("    .word " + out.slice(i, i + 4).join(", "));
  return lines.join("\n");
}

export const PROGRAMS = {
  timer: {
    name: "Pisca LED (timer + IRQ)",
    summary: "O timer gera uma interrupção a cada 50 ciclos; a ISR inverte o LED e reconhece a IRQ. Entre uma e outra a CPU dorme em WFI.",
    cycles: 1200,
    source: () => `; Pisca LED com interrupção do timer
.org 0
    li   t0, 0x10000000     ; base do TIMER
    li   t1, 50
    sw   t1, 4(t0)          ; TIMER_PERIOD = 50 ciclos
    li   t1, 1
    sw   t1, 0(t0)          ; TIMER_CTRL = 1 (liga)
    li   s0, 0x10000300     ; base do LED
    li   s1, 0              ; estado do LED
main:
    wfi                     ; dorme até a próxima IRQ
    j    main

.org 0x100                  ; vetor de interrupção
isr:
    xori s1, s1, 1          ; inverte o LED
    sw   s1, 0(s0)
    li   t2, 1
    sw   t2, 12(t0)         ; TIMER_STATUS = 1 (ack)
    addi s2, s2, 1          ; contador de piscadas
    mret
`,
  },

  dma: {
    name: "Cópia por DMA",
    summary: "A CPU programa o DMA (origem, destino, tamanho), dorme em WFI e só acorda na IRQ de conclusão. O DMA move os dados em rajadas pelo barramento.",
    cycles: 2000,
    source: (bytes = 64) => `; Cópia de ${bytes} bytes via DMA
.org 0
    li   t0, 0x10000200     ; base do DMA
    la   t1, src
    sw   t1, 0(t0)          ; DMA_SRC
    la   t1, dst
    sw   t1, 4(t0)          ; DMA_DST
    li   t1, ${bytes}
    sw   t1, 8(t0)          ; DMA_LEN (bytes)
    li   t1, 1
    sw   t1, 12(t0)         ; DMA_CTRL = START
wait:
    wfi                     ; dorme até a IRQ do DMA
    beqz s0, wait           ; s0 = 1 quando a ISR rodar
    ecall                   ; fim

.org 0x100                  ; vetor de interrupção
isr:
    li   s0, 1
    mret

.org 0x300
src:
${dataWords(bytes / 4)}

.org 0x800
dst:
    .space ${bytes}
`,
  },

  cpucopy: {
    name: "Cópia pela CPU (LW/SW)",
    summary: "Mesma cópia do cenário DMA, feita palavra a palavra pela CPU. Cada SW em write-through vira uma transação de barramento, e a CPU espera por ela.",
    cycles: 4000,
    source: (bytes = 64) => `; Cópia de ${bytes} bytes pela CPU
.org 0
    la   a0, src
    la   a1, dst
    li   a2, ${bytes / 4}           ; palavras
loop:
    lw   t0, 0(a0)
    sw   t0, 0(a1)
    addi a0, a0, 4
    addi a1, a1, 4
    addi a2, a2, -1
    bnez a2, loop
    ecall

.org 0x300
src:
${dataWords(bytes / 4)}

.org 0x800
dst:
    .space ${bytes}
`,
  },

  console: {
    name: "Console com eco (IRQ)",
    summary: "Cada tecla gera uma IRQ do console; a ISR lê o caractere, converte para maiúscula e ecoa na tela.",
    cycles: 4000,
    interactive: true,
    source: () => `; Eco de teclado por interrupção
.org 0
    li   t0, 0x10000100     ; base do CONSOLE
    li   t1, 1
    sw   t1, 8(t0)          ; CONSOLE_CTRL = 1 (IRQ ao receber)
idle:
    wfi
    j    idle

.org 0x100                  ; vetor de interrupção
isr:
    lw   t2, 0(t0)          ; lê a tecla (limpa RX_READY)
    li   t3, 97             ; 'a'
    blt  t2, t3, out
    li   t3, 123            ; 'z' + 1
    bge  t2, t3, out
    addi t2, t2, -32        ; minúscula → maiúscula
out:
    sw   t2, 0(t0)          ; ecoa na tela
    mret
`,
  },

  stride: {
    name: "Localidade de cache (passo)",
    summary: "Soma um vetor de 512 palavras (2 KB, maior que a L1D) com passo configurável. Passo 4 é sequencial; passo 64 cai sempre nos mesmos conjuntos e faz a cache brigar consigo mesma.",
    cycles: 200000,
    source: (stride = 4) => `; Soma de vetor com passo de ${stride} bytes
.org 0
    li   a0, 0x1000         ; base do vetor
    li   a1, 512            ; nº de elementos
    mv   t0, a0             ; 1) vetor[i] = i
    li   t1, 0
fill:
    sw   t1, 0(t0)
    addi t0, t0, 4
    addi t1, t1, 1
    bne  t1, a1, fill
    slli t2, a1, 2          ; 2) soma com passo
    add  t2, a0, t2         ; fim do vetor
    li   s0, 0              ; soma
    li   t3, 0              ; deslocamento inicial
    li   t4, ${stride}      ; passo em bytes
outer:
    add  t0, a0, t3
inner:
    lw   t5, 0(t0)
    add  s0, s0, t5
    add  t0, t0, t4
    blt  t0, t2, inner
    addi t3, t3, 4
    blt  t3, t4, outer
    ecall                   ; s0 = 130816
`,
  },
};
