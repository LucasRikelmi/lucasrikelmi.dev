// ============================================================
// CatalogoOcorrencias: ocorrências que encerram ou suspendem o
// acompanhamento de um fornecedor no programa de qualificação.
//
//   B = Baixa       o fornecedor sai da carteira; conta como resolvido.
//   M = Movimento   o fornecedor passa para outra carteira ou unidade;
//                   fica "em trânsito" e não conta como resolvido.
//   P = Pendência   impedimento temporário; o fornecedor segue em aberto.
//
// MotorRegras e Dashboard leem só daqui. Para criar um código novo basta
// acrescentar uma linha em CODIGOS.
// ============================================================
const CatalogoOcorrencias = {
  TIPOS: {
    B: { nome: "Baixa", resolve: true },
    M: { nome: "Movimento", resolve: false },
    P: { nome: "Pendência", resolve: false },
  },

  CODIGOS: {
    B1: "Fornecedor encerrou as atividades",
    B2: "Incorporado por outro fornecedor",
    B3: "Desistiu do programa",
    B4: "Contrato com o cliente encerrado",
    M1: "Movido para outra unidade",
    M2: "Movido para outra categoria",
    P1: "Aguardando documentação",
    P2: "Atividade suspensa",
    P3: "Endereço não localizado",
    P4: "Outros",
  },

  // "OC-B1", "b1", "B 01" → "B1". Qualquer outra coisa → null.
  codigo(valor) {
    const m = String(valor || "").toUpperCase().match(/(?:^|[^A-Z])([BMP])\s*0*(\d{1,2})(?!\d)/);
    if (!m) return null;
    const cod = m[1] + Number(m[2]);
    return this.CODIGOS[cod] ? cod : null;
  },

  tipo(cod) {
    return cod ? cod.charAt(0) : null;
  },

  descricao(cod) {
    return this.CODIGOS[cod] || "";
  },

  ehTransferencia(cod) {
    return this.tipo(cod) === "M";
  },

  // A ocorrência resolve o fornecedor (entra no "% Resposta + OC")?
  resolve(cod) {
    return this.TIPOS[this.tipo(cod)]?.resolve === true;
  },

  // O fornecedor saiu desta carteira mas continua no fluxo.
  emTransito(cod) {
    return this.tipo(cod) === "M";
  },

  // Códigos ordenados por tipo (B, M, P) e número, para as abas do dashboard.
  ordenados() {
    const ordemTipo = "BMP";
    return Object.keys(this.CODIGOS).sort((a, b) =>
      ordemTipo.indexOf(a[0]) - ordemTipo.indexOf(b[0]) || Number(a.slice(1)) - Number(b.slice(1)));
  },
};
