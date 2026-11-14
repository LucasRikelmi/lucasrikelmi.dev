const UploadManager = {

  _agora() {
    return new Date().toLocaleString("pt-BR", {
      timeZone:   "America/Sao_Paulo",
      day:        "2-digit",
      month:      "2-digit",
      year:       "numeric",
      hour:       "2-digit",
      minute:     "2-digit",
    });
  },

  gravarTimestamp(tipo) {
    localStorage.setItem(ContratosArquivo[tipo].chaveTimestamp, this._agora());
  },

  lerTimestamp(tipo) {
    return localStorage.getItem(ContratosArquivo[tipo].chaveTimestamp);
  },

  async _salvarStorage(chave, conteudo) {
    return StorageManager.salvar(chave, conteudo);
  },

  async processar(file, tipo) {
    const contrato = ContratosArquivo[tipo];
    if (!contrato) return { ok: false, erro: `Tipo desconhecido: ${tipo}` };

    const ext = file.name.split(".").pop().toLowerCase();
    if (ext !== contrato.extensao) {
      return {
        ok: false,
        erro: `Extensão inválida. Esperado .${contrato.extensao}, recebido .${ext}.`,
      };
    }

    if (contrato.nomeRegex) {
      const nomeSemExt = file.name.slice(0, file.name.lastIndexOf("."));
      if (!contrato.nomeRegex.test(nomeSemExt)) {
        if (contrato.confirmacaoSeNomeErrado) {

          return { ok: false, aviso: nomeSemExt, aguardaConfirmacao: true };
        }
      }
    }

    return await this._prosseguirLeitura(file, tipo, contrato);
  },

  async processarConfirmado(file, tipo) {
    return await this._prosseguirLeitura(file, tipo, ContratosArquivo[tipo]);
  },

  async _prosseguirLeitura(file, tipo, contrato) {

    let buffer;
    try {
      buffer = await FileProcessor.lerArquivo(file);
    } catch (e) {
      return { ok: false, erro: `Erro ao ler o arquivo: ${e.message}` };
    }
    const texto = FileProcessor.decodificarBuffer(buffer);

    const tabela = FileProcessor.csvParaTabela(texto);

    const cabEncontrados = (() => {
      if (tabela.length > 0) return Object.keys(tabela[0]);
      const matrizFallback = FileProcessor._parseCSV(
        FileProcessor._removerBOM(texto),
        FileProcessor._detectarDelimitador(texto)
      );
      return matrizFallback[FileProcessor._indiceLinhaCabecalho(matrizFallback)] ?? [];
    })();

    const { ok: cabOk, faltando } = FileProcessor.validarCabecalhos(
      cabEncontrados,
      contrato.cabecalhos
    );
    if (!cabOk) {
      return {
        ok: false,
        erro: `Cabeçalhos ausentes (${faltando.length}): ${faltando.slice(0, 5).join(", ")}` +
              (faltando.length > 5 ? ` … e mais ${faltando.length - 5}.` : "."),
      };
    }

    if (contrato.exigeLinhas && tabela.length === 0) {
      return { ok: false, erro: "O arquivo não possui linhas de dados." };
    }

    const salvou = await this._salvarStorage(contrato.chaveStorage, texto);
    if (!salvou.ok) return { ok: false, erro: salvou.erro };

    this.gravarTimestamp(tipo);

    return { ok: true, dados: tabela, linhas: tabela.length };
  },
};
