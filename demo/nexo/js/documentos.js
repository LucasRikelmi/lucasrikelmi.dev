const DocumentosNexo = (() => {

  const PAG = { w: 595.28, h: 841.89 };
  const M = { esq: 56, dir: 56, topo: 40, base: 56 };
  const LARG = PAG.w - M.esq - M.dir;

  const COR = {
    tinta: [24, 26, 38],
    suave: [96, 100, 120],
    linha: [222, 224, 236],
    marca: [79, 70, 229],
    fundoMarca: [238, 240, 255],
  };

  const EMPRESA = {
    nome: "Meridiano Gestão de Fornecedores",
    site: "www.meridiano.example",
    portal: "fornecedores.meridiano.example",
    download: "download.meridiano.example",
    privacidade: "privacidade@meridiano.example",
    diretor: "Ricardo Almeida Torres",
    cargoDiretor: "Diretor de Operações",
  };

  const cor = (doc, rgb, tipo = "text") => {
    if (tipo === "text") doc.setTextColor(...rgb);
    else if (tipo === "draw") doc.setDrawColor(...rgb);
    else doc.setFillColor(...rgb);
  };
  const fonte = (doc, estilo, tamanho) => {
    doc.setFont("helvetica", estilo);
    doc.setFontSize(tamanho);
  };
  const unidade = () => (typeof CONFIG_UNIDADE !== "undefined" ? CONFIG_UNIDADE : {});
  const hojeExtenso = () =>
    new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const hojeCurto = () => new Date().toLocaleDateString("pt-BR");

  function diasUteis(n) {
    const d = new Date();
    let somados = 0;
    while (somados < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) somados++;
    }
    return d.toLocaleDateString("pt-BR");
  }

  function dadosEmpresa(empresa, opcoes) {
    const sigla = opcoes.categoria || _normalizarCategoria(empresa.CATEGORIA);
    const meta = _META_CATEGORIA[sigla] || _META_CATEGORIA.OPE;
    const prazo =
      _formatarDataInput(opcoes.dataLimite) ||
      _formatarDataInput(_valorPrazoDevolucao(empresa)) ||
      "a combinar";
    return {
      razao: empresa.RAZAOSOCIAL || "Empresa",
      cnpj: _formatarCNPJ(empresa.CNPJ),
      endereco: empresa.ENDERECO || "",
      bairro: empresa.BAIRRO || "",
      municipio: empresa.MUNICIPIO || "",
      uf: empresa.UF || unidade().uf || "",
      cep: empresa.CEP || "",
      analista: _resolverResponsavel(empresa),
      sigla: meta.sigla,
      categoria: meta.nome,
      prazo,
      ciclo: new Date().getFullYear(),
    };
  }

  function cabecalho(doc) {
    const u = unidade();
    const logoW = 150;
    const logoH = logoW / 2.435;
    if (typeof ASSETS_B64 !== "undefined" && ASSETS_B64.LOGO_MARCA) {
      doc.addImage(ASSETS_B64.LOGO_MARCA, "PNG", M.esq - 4, M.topo - 4, logoW, logoH, "logo-marca", "FAST");
    }
    const x = PAG.w - M.dir;
    let y = M.topo + 6;
    fonte(doc, "bold", 9);
    cor(doc, COR.tinta);
    doc.text(u.nome || "Unidade", x, y, { align: "right" });
    fonte(doc, "normal", 8);
    cor(doc, COR.suave);
    const linhas = [
      [u.logradouro, u.bairro].filter(Boolean).join(", "),
      [u.municipioSede, u.uf].filter(Boolean).join(" - ") + (u.cep ? `  ·  CEP ${u.cep}` : ""),
      [u.telefoneFixo, u.email].filter(Boolean).join("  ·  "),
    ].filter((l) => l.trim());
    linhas.forEach((l) => { y += 11; doc.text(l, x, y, { align: "right" }); });

    const yLinha = M.topo + logoH + 6;
    cor(doc, COR.marca, "fill");
    doc.rect(M.esq, yLinha, 46, 2.4, "F");
    cor(doc, COR.linha, "draw");
    doc.setLineWidth(0.6);
    doc.line(M.esq + 50, yLinha + 1.2, PAG.w - M.dir, yLinha + 1.2);
    return yLinha + 26;
  }

  function rodape(doc, texto) {
    const y = PAG.h - 34;
    cor(doc, COR.linha, "draw");
    doc.setLineWidth(0.6);
    doc.line(M.esq, y - 12, PAG.w - M.dir, y - 12);
    fonte(doc, "normal", 7.5);
    cor(doc, COR.suave);
    doc.text(`${EMPRESA.nome}  ·  ${EMPRESA.site}`, M.esq, y);
    doc.text(texto || `Documento gerado pelo NEXO em ${hojeCurto()}`, PAG.w - M.dir, y, { align: "right" });
  }

  function localEData(doc, y) {
    const u = unidade();
    fonte(doc, "normal", 9.5);
    cor(doc, COR.suave);
    doc.text(`${u.municipioSede || ""}${u.municipioSede ? ", " : ""}${hojeExtenso()}`, PAG.w - M.dir, y, { align: "right" });
    return y + 24;
  }

  function destinatario(doc, y, d) {
    fonte(doc, "normal", 8);
    cor(doc, COR.marca);
    doc.text("PARA", M.esq, y);
    y += 13;
    fonte(doc, "bold", 10.5);
    cor(doc, COR.tinta);
    doc.text(d.razao, M.esq, y);
    fonte(doc, "normal", 9.5);
    cor(doc, COR.suave);
    const linhas = [
      `CNPJ ${d.cnpj}`,
      [d.endereco, d.bairro].filter(Boolean).join(", "),
      [d.municipio, d.uf].filter(Boolean).join(" - ") + (d.cep ? `  ·  CEP ${d.cep}` : ""),
    ].filter((l) => l.trim());
    linhas.forEach((l) => { y += 12.5; doc.text(l, M.esq, y); });
    return y + 26;
  }

  function titulo(doc, y, texto, subtitulo) {
    fonte(doc, "bold", 15);
    cor(doc, COR.tinta);
    const linhas = doc.splitTextToSize(texto, LARG);
    doc.text(linhas, M.esq, y);
    y += linhas.length * 18;
    if (subtitulo) {
      fonte(doc, "normal", 9.5);
      cor(doc, COR.marca);
      doc.text(subtitulo, M.esq, y - 2);
      y += 12;
    }
    return y + 8;
  }

  function paragrafo(doc, y, texto, opcoes = {}) {
    const tam = opcoes.tamanho || 10.2;
    const entre = tam * 1.5;
    const negrito = /^\*\*.*\*\*$/.test(texto);
    const limpo = texto.replace(/\*\*/g, "");
    fonte(doc, negrito ? "bold" : "normal", tam);
    cor(doc, COR.tinta);
    const linhas = doc.splitTextToSize(limpo, LARG);
    linhas.forEach((linha, i) => {
      const ultima = i === linhas.length - 1;
      doc.text(linha, M.esq, y, ultima ? {} : { align: "justify", maxWidth: LARG });
      y += entre;
    });
    return y + (opcoes.depois ?? 6);
  }

  function quadro(doc, y, pares) {
    const colW = LARG / 2;
    const linhasQuadro = Math.ceil(pares.length / 2);
    const altura = 18 + linhasQuadro * 30;
    cor(doc, COR.fundoMarca, "fill");
    doc.roundedRect(M.esq, y, LARG, altura, 6, 6, "F");
    cor(doc, COR.marca, "fill");
    doc.rect(M.esq, y, 3, altura, "F");
    pares.forEach(([rotulo, valor], i) => {
      const x = M.esq + 16 + (i % 2) * colW;
      const yy = y + 22 + Math.floor(i / 2) * 30;
      fonte(doc, "normal", 7.5);
      cor(doc, COR.suave);
      doc.text(rotulo.toUpperCase(), x, yy);
      fonte(doc, "bold", 10);
      cor(doc, COR.tinta);
      doc.text(doc.splitTextToSize(String(valor || "-"), colW - 24)[0], x, yy + 12);
    });
    return y + altura + 20;
  }

  function assinatura(doc, y, nome, cargo, imagemB64) {
    fonte(doc, "normal", 10.2);
    cor(doc, COR.tinta);
    doc.text("Atenciosamente,", M.esq, y);
    y += 8;
    if (imagemB64) {
      doc.addImage(imagemB64, _formatoImagemB64(imagemB64), M.esq - 6, y, 140, 45, undefined, "FAST");
    }
    y += 52;
    cor(doc, COR.linha, "draw");
    doc.setLineWidth(0.6);
    doc.line(M.esq, y, M.esq + 200, y);
    fonte(doc, "bold", 10);
    doc.text(nome || "", M.esq, y + 14);
    fonte(doc, "normal", 9);
    cor(doc, COR.suave);
    doc.text(cargo || "", M.esq, y + 26);
    return y + 40;
  }

  const TEXTOS = {
    convite: (d) => ({
      titulo: `Requalificação de fornecedores ${d.ciclo}`,
      subtitulo: `${d.categoria} (${d.sigla})  ·  envio até ${d.prazo}`,
      paragrafos: [
        "Prezado(a) responsável,",
        `A ${EMPRESA.nome} administra o cadastro de fornecedores dos nossos clientes e convida a ${d.razao} a enviar o dossiê de requalificação deste ano, na categoria ${d.categoria}.`,
        "O dossiê reúne documentos cadastrais, certidões e indicadores de entrega. Ele mantém o fornecedor apto a participar de novas cotações durante o próximo ano.",
        `O envio é feito pelo portal ${EMPRESA.portal}, com o acesso enviado ao e-mail cadastrado. Os modelos de planilha estão disponíveis em ${EMPRESA.download}.`,
        "Os documentos enviados são tratados conforme a Lei nº 13.709/2018 (LGPD) e usados somente no processo de qualificação.",
      ],
      quadro: [
        ["Categoria", `${d.sigla} · ${d.categoria}`],
        ["Prazo para envio", d.prazo],
        ["Analista responsável", d.analista],
        ["Contato da unidade", unidade().telefoneFixo || unidade().email],
      ],
    }),
    lembrete: (d) => ({
      titulo: "Lembrete: dossiê pendente",
      subtitulo: `${d.categoria}  ·  prazo original ${d.prazo}`,
      paragrafos: [
        "Prezado(a) responsável,",
        `Ainda não recebemos o dossiê de requalificação da ${d.razao}. O prazo combinado com a sua equipe era ${d.prazo}.`,
        `Para manter o cadastro ativo, pedimos o envio até ${diasUteis(3)}. Se houver dificuldade com algum documento, o analista responsável pode ajudar por telefone ou agendar uma visita.`,
        "Se o envio já foi feito, por favor desconsidere este lembrete.",
      ],
      quadro: [
        ["Categoria", d.sigla],
        ["Novo prazo", diasUteis(3)],
        ["Analista responsável", d.analista],
        ["Acesso", EMPRESA.portal],
      ],
    }),
    comunicado: (d) => ({
      titulo: "Comunicado formal de pendência",
      subtitulo: `${d.categoria}  ·  CNPJ ${d.cnpj}`,
      paragrafos: [
        "Prezado(a) responsável,",
        `Registramos formalmente que a ${d.razao} não enviou o dossiê de requalificação no prazo acordado (${d.prazo}), mesmo após os contatos anteriores da nossa equipe.`,
        "Conforme o contrato de fornecimento, o cadastro fica suspenso para novas cotações até a regularização.",
        `Solicitamos o envio até ${diasUteis(5)}. Os documentos continuam protegidos pela LGPD.`,
        "Se a pendência já foi resolvida, pedimos que desconsidere este comunicado.",
      ],
      quadro: [
        ["Prazo para regularizar", diasUteis(5)],
        ["Analista responsável", d.analista],
        ["Acesso", EMPRESA.portal],
        ["Contato da unidade", unidade().telefoneFixo || unidade().email],
      ],
    }),
  };

  function carta(doc, tipo, empresa, opcoes = {}) {
    const d = dadosEmpresa(empresa, opcoes);
    const t = (TEXTOS[tipo] || TEXTOS.convite)(d);
    let y = cabecalho(doc);
    y = localEData(doc, y);
    y = destinatario(doc, y, d);
    y = titulo(doc, y, t.titulo, t.subtitulo);
    t.paragrafos.forEach((p) => { y = paragrafo(doc, y, p); });
    y = quadro(doc, y + 4, t.quadro);

    const u = unidade();
    if (tipo === "comunicado") {
      const img = u.diretorAssinaturaB64 || (typeof ASSETS_B64 !== "undefined" ? ASSETS_B64.ASSINATURA_DIRETOR : "");
      assinatura(doc, y, EMPRESA.diretor, `${EMPRESA.cargoDiretor}  ·  ${EMPRESA.nome}`, img);
    } else {
      const img = u.gerenteAreaAssinaturaB64 || (typeof ASSETS_B64 !== "undefined" ? ASSETS_B64.ASSINATURA_SUP : "");
      assinatura(doc, y, u.gerenteArea || u.chefe, `Gerente de Área  ·  ${u.nome || ""}`, img);
    }
    rodape(doc);
  }

  function via(doc, y0, d, rotuloVia) {
    const u = unidade();
    if (typeof ASSETS_B64 !== "undefined" && ASSETS_B64.LOGO_MARCA) {
      doc.addImage(ASSETS_B64.LOGO_MARCA, "PNG", M.esq - 3, y0, 96, 96 / 2.435, "logo-marca", "FAST");
    }
    fonte(doc, "bold", 12.5);
    cor(doc, COR.tinta);
    doc.text("Recibo de entrega do convite", PAG.w - M.dir, y0 + 16, { align: "right" });
    fonte(doc, "normal", 8.5);
    cor(doc, COR.marca);
    doc.text(rotuloVia.toUpperCase(), PAG.w - M.dir, y0 + 29, { align: "right" });

    let y = y0 + 58;
    const pares = [
      ["Empresa", d.razao], ["CNPJ", d.cnpj],
      ["Endereço", [d.endereco, d.bairro].filter(Boolean).join(", ")], ["Categoria", `${d.sigla} · ${d.categoria}`],
      ["Prazo para envio", d.prazo], ["Analista", d.analista],
    ];
    const colW = LARG / 2;
    pares.forEach(([r, v], i) => {
      const x = M.esq + (i % 2) * colW;
      const yy = y + Math.floor(i / 2) * 24;
      fonte(doc, "normal", 7);
      cor(doc, COR.suave);
      doc.text(r.toUpperCase(), x, yy);
      fonte(doc, "normal", 9.5);
      cor(doc, COR.tinta);
      doc.text(doc.splitTextToSize(String(v || "-"), colW - 12)[0], x, yy + 11);
    });
    y += 3 * 24 + 6;

    fonte(doc, "normal", 9.2);
    cor(doc, COR.tinta);
    const declaracao = `Declaro que recebi o convite e as instruções de acesso ao portal de fornecedores da ${EMPRESA.nome}, com envio do dossiê até ${d.prazo}.`;
    const linhas = doc.splitTextToSize(declaracao, LARG);
    doc.text(linhas, M.esq, y);
    y += linhas.length * 13 + 14;

    const campos = [["Nome", 0.62], ["Cargo / setor", 0.38], ["Telefone", 0.3], ["E-mail", 0.42], ["Data", 0.28]];
    cor(doc, COR.linha, "draw");
    doc.setLineWidth(0.7);
    let x = M.esq;
    let linhaCampos = 0;
    let usado = 0;
    campos.forEach(([rotulo, frac]) => {
      const w = LARG * frac - 10;
      if (usado + frac > 1.001) { linhaCampos++; usado = 0; x = M.esq; }
      const yy = y + linhaCampos * 30;
      doc.line(x, yy + 12, x + w, yy + 12);
      fonte(doc, "normal", 7);
      cor(doc, COR.suave);
      doc.text(rotulo.toUpperCase(), x, yy + 21);
      x += w + 10;
      usado += frac;
    });
    y += (linhaCampos + 1) * 30 + 22;
    doc.line(M.esq, y, M.esq + 230, y);
    fonte(doc, "normal", 7);
    doc.text("ASSINATURA DO RESPONSÁVEL PELO RECEBIMENTO", M.esq, y + 9);
    doc.line(PAG.w - M.dir - 200, y, PAG.w - M.dir, y);
    doc.text(`ANALISTA ${EMPRESA.nome.split(" ")[0].toUpperCase()}`, PAG.w - M.dir - 200, y + 9);
    fonte(doc, "normal", 7.5);
    cor(doc, COR.suave);
    doc.text(`${u.nome || ""}  ·  ${u.telefoneFixo || ""}  ·  ${u.email || ""}`, M.esq, y + 26);
  }

  function recibo(doc, empresa, opcoes = {}) {
    const d = dadosEmpresa(empresa, opcoes);
    const meio = PAG.h / 2;
    via(doc, M.topo - 8, d, "Via da empresa");

    cor(doc, COR.linha, "draw");
    doc.setLineWidth(0.8);
    doc.setLineDashPattern([4, 3], 0);
    doc.line(24, meio, PAG.w - 24, meio);
    doc.setLineDashPattern([], 0);
    fonte(doc, "normal", 6.5);
    cor(doc, COR.suave);
    doc.text("recortar aqui", PAG.w / 2, meio - 4, { align: "center" });
    via(doc, meio + 22, d, "Via da unidade");
  }

  function termo(doc) {
    let y = cabecalho(doc);
    y = titulo(doc, y + 4, "Termo de Confidencialidade e Proteção de Dados", "Anexo ao convite · Cadastro de Fornecedores Meridiano");
    const secoes = [
      ["1. Finalidade", "Os documentos e informações enviados pelo fornecedor são usados exclusivamente para avaliar e manter a sua qualificação no cadastro."],
      ["2. Base legal", "O tratamento dos dados segue a Lei nº 13.709/2018 (LGPD), em especial os artigos 6º e 7º, e o contrato de fornecimento firmado entre as partes."],
      ["3. Confidencialidade", "Os documentos não são compartilhados fora da equipe de qualificação e dos clientes que contratam o fornecedor."],
      ["4. Segurança", "Os dados operacionais ficam cifrados (AES-256-GCM, com chave derivada por Argon2id) no dispositivo do analista e não trafegam para serviços externos."],
      ["5. Direitos do titular", `O fornecedor pode solicitar acesso, correção ou exclusão dos seus dados pelo canal ${EMPRESA.privacidade}.`],
    ];
    secoes.forEach(([t, texto]) => {
      fonte(doc, "bold", 11);
      cor(doc, COR.tinta);
      doc.text(t, M.esq, y);
      y = paragrafo(doc, y + 16, texto, { depois: 14 });
    });
    rodape(doc, "Documento informativo, parte integrante do convite");
  }

  return { carta, recibo, termo, _TEXTOS: TEXTOS };
})();
