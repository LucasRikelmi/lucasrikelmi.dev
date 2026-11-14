const FileProcessor = {

  lerArquivo(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(reader.error || new Error("Falha ao ler o arquivo."));
      reader.readAsArrayBuffer(file);
    });
  },

  decodificarBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (_) {
      return new TextDecoder("iso-8859-1").decode(bytes);
    }
  },

  _removerBOM(texto) {
    return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  },

  _detectarDelimitador(texto) {
    const linhas = texto.split("\n", 20);
    const trecho = linhas.join("\n");
    const qtdPv  = (trecho.match(/;/g)  || []).length;
    const qtdVir = (trecho.match(/,/g) || []).length;
    const qtdTab = (trecho.match(/\t/g) || []).length;
    if (qtdTab > qtdPv && qtdTab > qtdVir) return "\t";
    return qtdPv >= qtdVir ? ";" : ",";
  },

  _parseCSV(texto, delimitador) {
    const linhas = [];
    let linhaAtual = [];
    let campo = "";
    let dentroAspas = false;

    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];

      if (dentroAspas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; }
          else { dentroAspas = false; }
        } else {
          campo += c;
        }
        continue;
      }

      if (c === '"') {
        dentroAspas = true;
      } else if (c === delimitador) {
        linhaAtual.push(campo);
        campo = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linhaAtual.push(campo);
        linhas.push(linhaAtual);
        linhaAtual = [];
        campo = "";
      } else {
        campo += c;
      }
    }

    if (campo !== "" || linhaAtual.length > 0) {
      linhaAtual.push(campo);
      linhas.push(linhaAtual);
    }
    return linhas;
  },

  _ALIAS: {},

  _normalizarBruto(h) {
    if (!h) return "";
    return String(h)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
  },

  normalizarCabecalho(h) {
    const n = FileProcessor._normalizarBruto(h);
    return FileProcessor._ALIAS[n] || n;
  },

  validarCabecalhos(cabecalhosEncontrados, cabecalhosEsperados) {
    const norm = (arr) => arr.map(this.normalizarCabecalho);
    const encontradosNorm = norm(cabecalhosEncontrados);
    const faltando = norm(cabecalhosEsperados).filter(e => !encontradosNorm.includes(e));
    return { ok: faltando.length === 0, faltando };
  },

  _indiceLinhaCabecalho(matriz) {
    for (let i = 0; i < matriz.length; i++) {
      const preenchidas = matriz[i].filter(c => String(c).trim() !== "").length;
      if (preenchidas >= 2) return i;
    }
    return 0;
  },

  csvParaTabela(csvCru) {
    if (!csvCru) return [];
    const texto = this._removerBOM(csvCru);
    const delimitador = this._detectarDelimitador(texto);
    const matriz = this._parseCSV(texto, delimitador);
    if (matriz.length === 0) return [];

    const linhaCabecalho = this._indiceLinhaCabecalho(matriz);
    const cabecalhos = matriz[linhaCabecalho].map(h => this.normalizarCabecalho(h));
    const resultado = [];

    for (let i = linhaCabecalho + 1; i < matriz.length; i++) {
      const valores = matriz[i];
      if (valores.length === 1 && valores[0].trim() === "") continue;
      const obj = {};
      cabecalhos.forEach((cab, idx) => {
        obj[cab] = valores[idx] !== undefined ? String(valores[idx]).trim() : "";
      });
      resultado.push(obj);
    }
    return resultado;
  },
};
