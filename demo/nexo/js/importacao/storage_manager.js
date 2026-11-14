const StorageManager = {
  _MARCA:        "e:",
  _MARCA_CHUNK:  "ec:",
  _MARCA_LEGADO:       "z:",
  _MARCA_LEGADO_CHUNK: "zc:",
  _CHUNK_SIZE:  1400 * 1024,

  _cache: {},

  async precarregarTudo() {
    if (typeof ContratosArquivo === "undefined") return;
    const chaves = [];
    Object.values(ContratosArquivo).forEach(({ chaveStorage }) => {
      chaves.push(chaveStorage);
      if (typeof MockManager !== "undefined") chaves.push(MockManager.PREFIXO_BCK + chaveStorage);
    });

    for (const chave of chaves) {
      const valor = localStorage.getItem(chave);
      if (!valor) continue;
      const eraLegado = valor.startsWith(this._MARCA_LEGADO) || valor.startsWith(this._MARCA_LEGADO_CHUNK)
        || (!valor.startsWith(this._MARCA) && !valor.startsWith(this._MARCA_CHUNK));
      const texto = await this._lerBruto(chave, valor);
      if (texto == null) continue;
      this._cache[chave] = texto;
      if (eraLegado) await this.salvar(chave, texto);
    }
  },

  async salvar(chave, texto) {
    let base64;
    try {
      const comprimido = pako.deflate(texto);
      const cifrado = await CryptoManager.cifrar(comprimido);
      base64 = this._paraBase64(cifrado);
    } catch (e) {
      return { ok: false, erro: "Erro ao cifrar/comprimir o arquivo: " + e.message };
    }

    this._limparChunks(chave);

    if (base64.length <= this._CHUNK_SIZE) {
      try {
        localStorage.setItem(chave, this._MARCA + base64);
        this._cache[chave] = texto;
        return { ok: true };
      } catch (_) {

      }
    }

    const chunks = [];
    for (let i = 0; i < base64.length; i += this._CHUNK_SIZE) {
      chunks.push(base64.slice(i, i + this._CHUNK_SIZE));
    }

    try {
      chunks.forEach((chunk, i) =>
        localStorage.setItem(`${chave}__chunk__${i}`, chunk)
      );
      localStorage.setItem(chave, this._MARCA_CHUNK + chunks.length);
      this._cache[chave] = texto;
      return { ok: true };
    } catch (e) {
      this._limparChunks(chave);
      localStorage.removeItem(chave);
      delete this._cache[chave];
      return {
        ok: false,
        erro:
          "Arquivo grande demais para o armazenamento do navegador " +
          "mesmo após compressão e divisão em partes. " +
          "Tente reduzir o número de linhas ou dividir o arquivo.",
      };
    }
  },

  async lerAsync(chave) {
    if (Object.prototype.hasOwnProperty.call(this._cache, chave)) return this._cache[chave];
    const texto = await this._lerBruto(chave);
    if (texto != null) this._cache[chave] = texto;
    return texto;
  },

  async _lerBruto(chave, valorConhecido) {
    const valor = valorConhecido !== undefined ? valorConhecido : localStorage.getItem(chave);
    if (!valor) return null;

    if (valor.startsWith(this._MARCA_CHUNK)) {
      const base64 = this._juntarChunks(chave, valor, this._MARCA_CHUNK);
      if (base64 == null) return null;
      try {
        const comprimido = await CryptoManager.decifrar(this._deBase64(base64));
        return pako.inflate(comprimido, { to: "string" });
      } catch (e) {
        console.error(`StorageManager: erro ao decifrar chunks de "${chave}":`, e);
        return null;
      }
    }

    if (valor.startsWith(this._MARCA)) {
      try {
        const comprimido = await CryptoManager.decifrar(this._deBase64(valor.slice(this._MARCA.length)));
        return pako.inflate(comprimido, { to: "string" });
      } catch (e) {
        console.error(`StorageManager: erro ao decifrar "${chave}":`, e);
        return null;
      }
    }

    if (valor.startsWith(this._MARCA_LEGADO_CHUNK)) {
      const base64 = this._juntarChunks(chave, valor, this._MARCA_LEGADO_CHUNK);
      if (base64 == null) return null;
      try {
        return pako.inflate(this._deBase64(base64), { to: "string" });
      } catch (e) {
        console.error("StorageManager: erro ao descomprimir chunks legados:", e);
        return null;
      }
    }
    if (valor.startsWith(this._MARCA_LEGADO)) {
      try {
        return pako.inflate(this._deBase64(valor.slice(this._MARCA_LEGADO.length)), { to: "string" });
      } catch (e) {
        console.error(`StorageManager: erro ao descomprimir legado "${chave}":`, e);
        return null;
      }
    }

    return valor;
  },

  _juntarChunks(chave, manifest, marca) {
    const n = parseInt(manifest.slice(marca.length), 10);
    let base64 = "";
    for (let i = 0; i < n; i++) {
      const chunk = localStorage.getItem(`${chave}__chunk__${i}`);
      if (!chunk) {
        console.error(`StorageManager: chunk ${i} de "${chave}" ausente.`);
        return null;
      }
      base64 += chunk;
    }
    return base64;
  },

  remover(chave) {
    const valor = localStorage.getItem(chave);
    if (valor && (valor.startsWith(this._MARCA_CHUNK) || valor.startsWith(this._MARCA_LEGADO_CHUNK))) {
      const marca = valor.startsWith(this._MARCA_CHUNK) ? this._MARCA_CHUNK : this._MARCA_LEGADO_CHUNK;
      const n = parseInt(valor.slice(marca.length), 10);
      for (let i = 0; i < n; i++) {
        localStorage.removeItem(`${chave}__chunk__${i}`);
      }
    }
    localStorage.removeItem(chave);
    delete this._cache[chave];
  },

  _limparChunks(chave) {
    for (let i = 0; ; i++) {
      const k = `${chave}__chunk__${i}`;
      if (localStorage.getItem(k) === null) break;
      localStorage.removeItem(k);
    }
  },

  _paraBase64(bytes) {
    let bin = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  },

  _deBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  },
};
