const CruzNorm = {

  DOMINIOS_GENERICOS: new Set([
    "gmail.com",
    "hotmail.com",
    "outlook.com",
    "yahoo.com",
    "yahoo.com.br",
    "uol.com.br",
    "bol.com.br",
    "terra.com.br",
    "icloud.com",
    "live.com",
    "live.com.br",
    "msn.com",
    "ig.com.br",
    "globo.com",
    "r7.com",
    "zipmail.com.br",
    "pop.com.br",
    "oi.com.br",
    "folha.com.br",
  ]),

  BLACKLIST: new Set([
    "00000000000",
    "00000000000000",
    "11111111111",
    "11111111111111",
    "22222222222",
    "33333333333",
    "44444444444",
    "55555555555",
    "66666666666",
    "77777777777",
    "88888888888",
    "99999999999",
    "99999999999999",
    "00000000",
    "11111111",
    "99999999",
    "000000000",
    "999999999",
    "0000000000",
    "9999999999",
    "naotem@email.com",
    "sememail@gmail.com",
    "naopossui@gmail.com",
    "sememail@hotmail.com",
    "naotem@hotmail.com",
    "naopossuiemail@gmail.com",
    "semcontato@gmail.com",
    "naotemmail@gmail.com",
    "naotememail@gmail.com",
    "semmail@gmail.com",
    "semcontato@hotmail.com",
  ]),

  _TITULOS: /\b(sr|sra|dr|dra|eng|prof|me|msc|esp)\b\.?\s*/gi,

  NOMES_CONTATO_GENERICOS: new Set([
    "SEDE",
    "UC",
    "UNIDADE",
    "UNIDADE COLETORA",
    "EMPRESA",
    "ESTABELECIMENTO",
    "MATRIZ",
    "FILIAL",
    "NAO INFORMADO",
    "NAO POSSUI",
    "SEM CONTATO",
    "SEM NOME",
    "NOME NAO INFORMADO",
    "N A",
    "NA",
    "NAO CONSTA",
    "SEM RESPONSAVEL",
    "RESPONSAVEL",
    "CONTATO",
    "GERENTE",
    "DIRETOR",
    "PROPRIETARIO",
    "NAO TEM",
    "NENHUM",
    "NENHUMA",
    "SEDE UTILIZADO NO ANO ANTERIOR",
    "CONTATO CARTAO CNPJ",
  ]),

  cnpj(v) {
    if (!v) return null;
    const d = String(v).replace(/\D/g, "");
    if (d.length < 11) return null;
    if (this.BLACKLIST.has(d)) return null;
    if (/^(\d)\1+$/.test(d)) return null;
    return d;
  },

  telefone(v) {
    if (!v) return null;
    const d = String(v).replace(/\D/g, "");
    if (d.length < 8 || d.length > 13) return null;
    if (this.BLACKLIST.has(d)) return null;
    if (/^(\d)\1+$/.test(d)) return null;
    return d;
  },

  cep(v) {
    if (!v) return null;
    const d = String(v).replace(/\D/g, "");
    if (d.length !== 8) return null;
    if (/^0+$/.test(d) || /^(\d)\1+$/.test(d)) return null;
    return d;
  },

  nome(v) {
    if (!v) return null;
    const n = String(v)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(this._TITULOS, "")
      .replace(/[^A-Z0-9 ]/gi, " ")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
    if (n.length < 3) return null;
    if (this.NOMES_CONTATO_GENERICOS.has(n)) return null;
    return n;
  },

  email(v) {
    if (!v) return null;
    const e = String(v).toLowerCase().trim();
    if (!e.includes("@") || e.length < 6) return null;
    if (this.BLACKLIST.has(e)) return null;
    const at = e.lastIndexOf("@");
    const local = e.slice(0, at);
    const dominio = e.slice(at + 1);
    if (!local || local.length < 2 || !dominio || !dominio.includes("."))
      return null;
    if (this.DOMINIOS_GENERICOS.has(dominio)) {
      return { tipo: "exato", chave: e };
    }
    return { tipo: "dominio", chave: "@" + dominio };
  },

  texto(v) {
    if (!v) return null;
    const t = String(v)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
    return t || null;
  },
};
