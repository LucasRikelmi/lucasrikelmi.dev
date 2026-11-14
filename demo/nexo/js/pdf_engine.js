function _vazio(v) {
  if (!v) return true;
  const s = String(v).trim();
  return s === "" || s === "-" || s === "--" || s.toLowerCase() === "null";
}

function _formatarCNPJ(cnpj) {
  if (!cnpj) return "[CNPJ NÃO INFORMADO]";

  const n = String(cnpj).replace(/\D/g, "");
  if (n.length !== 14) return String(cnpj);

  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}

function _obterDicCNAE() {
  if (typeof DICIONARIO_CNAES === "undefined" || !DICIONARIO_CNAES) return null;
  return Array.isArray(DICIONARIO_CNAES)
    ? DICIONARIO_CNAES[0]
    : DICIONARIO_CNAES;
}

function _formatarCNAE(codigoCSV) {
  if (_vazio(codigoCSV)) return null;
  const raw = String(codigoCSV).trim();
  const dic = _obterDicCNAE();
  if (!dic) return raw;

  const digitos = raw.replace(/\D/g, "");
  const base4 = digitos.slice(0, 4);
  const base5 = digitos.slice(0, 5);

  let descricao = dic[digitos] || dic[base5] || dic[base4] || null;

  if (!descricao) {
    for (const chave of Object.keys(dic)) {
      const chaveDigitos = String(chave).replace(/\D/g, "");
      if (chaveDigitos === digitos || chaveDigitos.startsWith(base4)) {
        descricao = dic[chave];
        break;
      }
    }
  }

  return descricao ? `${raw} - ${descricao}` : raw;
}

function _formatarDataInput(dataStr) {
  if (!dataStr) return "";
  const s = String(dataStr).trim();

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  const m2 = s.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (m2) return m2[1];
  return s;
}

const _CAMPOS_PRAZO_DEVOLUCAO = [
  "PRAZODATA",
  "DATAPREVISTADEVOLUCAO",
  "DATAENVIO",
  "DATARETORNO",
];

function _valorPrazoDevolucao(empresa) {
  if (!empresa) return "";
  const chaves = Object.keys(empresa);
  for (const candidato of _CAMPOS_PRAZO_DEVOLUCAO) {
    const chave = chaves.find((k) => k === candidato || k.startsWith(candidato));
    if (chave && !_vazio(empresa[chave])) return empresa[chave];
  }
  return "";
}

function _resolverResponsavel(empresa) {
  if (!empresa) return "[Analista não informado]";

  if (!_vazio(empresa.ANALISTARESPONSAVEL)) {
    return String(empresa.ANALISTARESPONSAVEL).trim();
  }

  if (!_vazio(empresa.ANALISTACONTATO)) {
    return String(empresa.ANALISTACONTATO).trim();
  }

  return "[Analista não informado]";
}

function _normalizarCategoria(valor) {
  const v = String(valor || "").toUpperCase().trim();
  for (const sigla of Object.keys(_META_CATEGORIA)) {
    if (v.includes(sigla)) return sigla;
  }
  return "OPE";
}

const _META_CATEGORIA = {
  CRI: { nome: "Fornecedor Crítico", sigla: "CRI" },
  EST: { nome: "Fornecedor Estratégico", sigla: "EST" },
  OPE: { nome: "Fornecedor Operacional", sigla: "OPE" },
};

function _resolverCNAE(empresa) {
  const raw = _vazio(empresa.CNAE) ? "" : String(empresa.CNAE).trim();
  const digitos = raw.replace(/\D/g, "");

  const dic = _obterDicCNAE();
  if (!digitos || !dic) {
    return { subclasse: raw || "", descricao: "" };
  }

  const prefixo4 = digitos.slice(0, 4);
  const prefixo5 = digitos.slice(0, 5);

  let chaveEncontrada = null;
  let descricao = "";

  for (const chave of Object.keys(dic)) {
    const chaveDigitos = String(chave).replace(/\D/g, "");
    if (
      chaveDigitos === digitos ||
      chaveDigitos === prefixo5 ||
      chaveDigitos === prefixo4 ||
      chaveDigitos.startsWith(prefixo4)
    ) {
      chaveEncontrada = String(chave);
      descricao = dic[chave];
      break;
    }
  }

  return {
    subclasse: chaveEncontrada || raw || "",
    descricao: descricao || "",
  };
}

function _formatoImagemB64(dataUrl) {
  return /^data:image\/jpe?g/i.test(dataUrl || "") ? "JPEG" : "PNG";
}

function _obterEmpresasSelecionadasDaGrid() {
  if (typeof dbGlobal === "undefined" || typeof selectedCNPJs === "undefined") {
    return [];
  }
  return dbGlobal.filter((emp) => selectedCNPJs.has(emp.CNPJ));
}

function _camposUnidadePendentes() {
  if (typeof CONFIG_UNIDADE === "undefined" || typeof CONFIG_UNIDADE_PADRAO === "undefined") return [];
  const CAMPOS = [
    ["nome", "Nome da unidade"],
    ["uf", "UF"],
    ["municipioSede", "Município-Sede"],
    ["logradouro", "Logradouro"],
    ["bairro", "Bairro"],
    ["cep", "CEP"],
    ["chefe", "Chefe da unidade"],
    ["telefoneFixo", "Telefone fixo"],
    ["telefoneCelular", "Telefone celular"],
    ["email", "E-mail"],
    ["gerenteArea", "Gerente de Área"],
  ];
  return CAMPOS
    .filter(([chave]) => !CONFIG_UNIDADE[chave] || CONFIG_UNIDADE[chave] === CONFIG_UNIDADE_PADRAO[chave])
    .map(([, label]) => label);
}

async function gerarPDFConsolidado(config = {}) {

  const empresas =
    Array.isArray(config.empresas) && config.empresas.length
      ? config.empresas
      : _obterEmpresasSelecionadasDaGrid();

  if (empresas.length === 0) {
    _notificarUsuario("Nenhuma empresa selecionada na Grid.", "warning");
    return;
  }

  const pendentes = _camposUnidadePendentes();
  if (pendentes.length) {
    const msg = `Os seguintes dados da unidade ainda não foram preenchidos em Configurações > Geral: ${pendentes.join(", ")}.\n\nEles aparecem no cabeçalho e rodapé de toda carta e recibo gerados — por isso a geração de documentos com dados genéricos não é permitida. Preencha-os antes de gerar qualquer carta ou recibo.`;
    if (typeof NexoModal !== "undefined") {
      await NexoModal.alert(
        "Identificação da unidade incompleta",
        `Os seguintes dados da unidade ainda não foram preenchidos em <strong>Configurações &gt; Geral</strong>: ${pendentes.join(", ")}.<br><br>
         Eles aparecem no cabeçalho e rodapé de <strong>toda</strong> carta e recibo gerados — por isso a geração de documentos com dados genéricos não é permitida. Preencha-os antes de gerar qualquer carta ou recibo.`,
        "erro",
      );
    } else {
      alert(msg);
    }
    return;
  }

  _exibirSpinner(true);

  try {
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

    empresas.forEach((empresa, i) => {

      const cfgAvancada =
        config.configAvancada && config.configAvancada[i]
          ? config.configAvancada[i]
          : {};

      const tipoEscolha = cfgAvancada.tipoCarta || config.tipoCarta;

      const categoriaEmpresa = _normalizarCategoria(empresa.CATEGORIA);

      const TIPO_DOC = { cobranca: "lembrete", notificacao: "comunicado" };
      const tipoDoc = TIPO_DOC[tipoEscolha] || "convite";
      const categoria = _META_CATEGORIA[tipoEscolha] ? tipoEscolha : categoriaEmpresa;
      const dataLimite = cfgAvancada.dataLimite || config.dataLimiteGlobal || "";
      const opcoes = { categoria, dataLimite };

      if (i > 0) doc.addPage();

      DocumentosNexo.carta(doc, tipoDoc, empresa, opcoes);

      const incluirTermo =
        cfgAvancada.incluirTermo !== undefined ? cfgAvancada.incluirTermo : config.incluirTermo;
      if (incluirTermo !== false) {
        doc.addPage();
        DocumentosNexo.termo(doc);
      }

      const incluirRecibo =
        cfgAvancada.incluirRecibo !== undefined ? cfgAvancada.incluirRecibo : config.incluirRecibo;
      if (incluirRecibo !== false) {
        doc.addPage();
        DocumentosNexo.recibo(doc, empresa, opcoes);
      }
    });

    const dataHoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    const _prefPdf = (typeof ConfigManager !== "undefined") ? ConfigManager.prefixoArquivo() : "";
    doc.save(`NEXO_Documentos${_prefPdf}_${dataHoje}_${empresas.length}emp.pdf`);

    _notificarUsuario(
      `PDF gerado com sucesso para ${empresas.length} empresa(s)!`,
      "success",
    );
  } catch (err) {
    console.error("[pdf_engine] Erro crítico na compilação do lote:", err);
    if (typeof NexoModal !== "undefined") {
      NexoModal.alert(
        "Erro ao gerar o PDF",
        `${escapeHTML(err.message)}<br><br>Verifique as chaves e colunas da Grid.`,
        "erro",
      );
    } else {
      alert(`Erro ao gerar o PDF consolidado:\n${err.message}\n\nVerifique as chaves e colunas da Grid.`);
    }
  } finally {
    _exibirSpinner(false);
  }
}

async function gerarCartaPreview() {
  const empresaExemplo = {
    CNPJ: "00000000000000",
    RAZAOSOCIAL: "EMPRESA EXEMPLO LTDA (dados fictícios — apenas para preview)",
    ENDERECO: "RUA EXEMPLO, 123",
    MUNICIPIO: (typeof CONFIG_UNIDADE !== "undefined" && CONFIG_UNIDADE.municipioSede) || "MUNICÍPIO EXEMPLO",
    CEP: "00000-000",
    BAIRRO: "BAIRRO EXEMPLO",
    CNAE: "",
    CATEGORIA: "OPE",
  };
  await gerarPDFConsolidado({
    empresas: [empresaExemplo],
    tipoCarta: "OPE",
    dataLimiteGlobal: "",
    incluirTermo: false,
    incluirRecibo: false,
  });
}

async function gerarSomenteTermo() {
  _exibirSpinner(true);
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    DocumentosNexo.termo(doc);
    doc.save("NEXO_Termo_Confidencialidade.pdf");
    _notificarUsuario("PDF do Termo de Confidencialidade gerado com sucesso!", "success");
  } catch (err) {
    console.error("[pdf_engine] Erro ao gerar Termo de Confidencialidade avulsa:", err);
    alert(`Erro ao gerar o PDF:\n${err.message}`);
  } finally {
    _exibirSpinner(false);
  }
}

function _exibirSpinner(mostrar) {
  let spinner = document.getElementById("pdf-spinner");
  if (!spinner) {
    spinner = document.createElement("div");
    spinner.id = "pdf-spinner";
    spinner.innerHTML = `
      <div style="width:52px;height:52px;border:5px solid rgba(255,255,255,0.3);
        border-top-color:#fff;border-radius:50%;animation:nexo-spin 0.8s linear infinite;"></div>
      <p style="color:white;font-weight:600;font-size:1rem;margin:16px 0 0;">Gerando PDF... Aguarde.</p>`;
    const s = document.createElement("style");
    s.textContent = "@keyframes nexo-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
    Object.assign(spinner.style, {
      display: "none",
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.65)",
      zIndex: "9999",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    });
    document.body.appendChild(spinner);
  }
  spinner.style.display = mostrar ? "flex" : "none";
}

function _notificarUsuario(mensagem, tipo = "info") {
  const cores = {
    info: "#4f46e5",
    warning: "#d97706",
    error: "#dc2626",
    success: "#16a34a",
  };
  const toast = document.createElement("div");
  toast.style.cssText = `position:fixed;top:24px;right:24px;background:${cores[tipo]};color:white;padding:14px 20px;border-radius:8px;font-weight:600;font-size:0.9rem;box-shadow:0 4px 20px rgba(0,0,0,0.25);z-index:10000;max-width:380px;animation:nexo-toast-in 0.3s ease;`;
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}
