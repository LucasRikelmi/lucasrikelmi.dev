const CruzEngine = {

  _pronto: false,
  _construindo: false,
  _filaOnPronto: [],

  indices: null,
  _linear: [],

  cnpjsLocais: new Set(),

  _resetar() {
    this.indices = {
      porRepresentante     : new Map(),
      porTelefone     : new Map(),
      porEmail        : new Map(),
      porCep          : new Map(),
      porEndereco     : new Map(),
      porNomeContato  : new Map(),
      registros       : new Map(),
    };
    this._linear = [];
  },

  _idx(mapa, chave, cnpj) {
    if (!chave || !cnpj) return;
    if (!mapa.has(chave)) mapa.set(chave, new Set());
    mapa.get(chave).add(cnpj);
  },

  _indexar(reg) {
    const { cnpj, representanteDoc, telefones, emailsChave, cep, enderecoNorm, razaoNorm, nomeContato } = reg;

    if (representanteDoc) this._idx(this.indices.porRepresentante, representanteDoc, cnpj);
    for (const tel of telefones) this._idx(this.indices.porTelefone, tel, cnpj);
    for (const ch  of emailsChave) this._idx(this.indices.porEmail, ch, cnpj);
    if (cep)          this._idx(this.indices.porCep, cep, cnpj);
    if (enderecoNorm) this._idx(this.indices.porEndereco, enderecoNorm, cnpj);

    if (nomeContato) this._idx(this.indices.porNomeContato, nomeContato, cnpj);

    if (razaoNorm)      this._linear.push({ cnpj, campo: 'RAZAO',    valor: razaoNorm });
    if (nomeContato)    this._linear.push({ cnpj, campo: 'CONTATO',  valor: nomeContato });
    if (reg.analista)    this._linear.push({ cnpj, campo: 'ANALISTA',  valor: CruzNorm.texto(reg.analista) });
    for (const tel of telefones)   this._linear.push({ cnpj, campo: 'TEL',   valor: tel });
    for (const ch  of emailsChave) this._linear.push({ cnpj, campo: 'EMAIL', valor: ch });
  },

  _construirRegistro(emp, contatosEmp) {
    const cnpj = CruzNorm.cnpj(emp.CNPJ);
    if (!cnpj) return null;

    const telefones   = new Set();
    const emailsChave = new Set();

    const telE = CruzNorm.telefone(emp.CONTATOTELEFONE);
    if (telE) telefones.add(telE);

    const emE = CruzNorm.email(emp.CONTATOEMAIL);
    if (emE) emailsChave.add(emE.chave);

    for (const inf of contatosEmp) {
      const telI = CruzNorm.telefone(inf.CONTATOTELEFONE);
      if (telI) telefones.add(telI);

      const emI = CruzNorm.email(inf.CONTATOEMAIL);
      if (emI) emailsChave.add(emI.chave);
    }

    const analistaResposta   = (emp.ANALISTARESPONSAVEL || '').trim();
    const analistaContato = (emp.ANALISTACONTATO || '').trim();
    const analista = analistaResposta || analistaContato;

    return {
      cnpj,
      cnpjOriginal : emp.CNPJ,
      empresa      : emp,

      representanteDoc  : CruzNorm.cnpj(emp.REPRESENTANTEDOCUMENTO),
      representanteNome : CruzNorm.texto(emp.REPRESENTANTENOME),
      nomeContato  : CruzNorm.nome(emp.CONTATONOME),
      analista,

      telefones,
      emailsChave,

      cep          : CruzNorm.cep(emp.CEP),
      enderecoNorm : CruzNorm.texto(emp.ENDERECO),
      razaoNorm    : CruzNorm.texto(emp.RAZAOSOCIAL),

      unidade      : emp.UNIDADE    || '',
      municipio    : emp.MUNICIPIO  || '',
      status       : emp.SITUACAO  || '',
      cnae         : emp.CNAE           || '',
    };
  },

  construir(onProgresso, onPronto) {
    if (this._pronto) { onPronto?.(); return; }
    if (onPronto) this._filaOnPronto.push(onPronto);
    if (this._construindo) return;

    this._construindo = true;
    this._resetar();

    (async () => {
      const [csvEmp, csvEst, csvInf] = await Promise.all([
        StorageManager.lerAsync('nexo_csv_Empresas'),
        StorageManager.lerAsync('nexo_csv_EmpresasRede'),
        StorageManager.lerAsync('nexo_csv_Contatos'),
      ]);

      const empresas  = csvEmp ? MotorRegras.csvParaTabela(csvEmp) : [];
      const rede  = csvEst ? MotorRegras.csvParaTabela(csvEst) : [];
      const infRaw    = csvInf ? MotorRegras.csvParaTabela(csvInf) : [];

      const mapaEmp = new Map();
      this.cnpjsLocais = new Set();
      for (const e of empresas) {
        const c = CruzNorm.cnpj(e.CNPJ);
        if (c) { mapaEmp.set(c, e); this.cnpjsLocais.add(c); }
      }
      for (const e of rede) {
        const c = CruzNorm.cnpj(e.CNPJ);
        if (c && !mapaEmp.has(c)) mapaEmp.set(c, e);
      }

      const mapaInf = new Map();
      for (const inf of infRaw) {
        const c = CruzNorm.cnpj(inf.CNPJEMPRESA);
        if (!c) continue;
        if (!mapaInf.has(c)) mapaInf.set(c, []);
        mapaInf.get(c).push(inf);
      }

      const pares = [...mapaEmp.entries()];
      const CHUNK = 500;
      let i = 0;

      const tick = () => {
        const fim = Math.min(i + CHUNK, pares.length);
        for (; i < fim; i++) {
          const [cnpj, emp] = pares[i];
          const reg = this._construirRegistro(emp, mapaInf.get(cnpj) || []);
          if (!reg) continue;
          this.indices.registros.set(cnpj, reg);
          this._indexar(reg);
        }

        onProgresso?.(Math.round((i / pares.length) * 100));

        if (i < pares.length) {
          setTimeout(tick, 0);
        } else {
          this._pronto = true;
          this._construindo = false;
          const cbs = this._filaOnPronto.splice(0);
          for (const cb of cbs) cb();
        }
      };

      setTimeout(tick, 0);
    })();
  },

  invalidar() {
    this._pronto = false;
    this._construindo = false;
    this._filaOnPronto = [];
    this.indices = null;
    this._linear = [];
    this.cnpjsLocais = new Set();
  },

  clustersRepresentante(minEmp = 7) {
    const res = [];
    for (const [representanteDoc, cnpjs] of this.indices.porRepresentante) {
      if (cnpjs.size < minEmp) continue;

      const regs = [...cnpjs]
        .map(c => this.indices.registros.get(c))
        .filter(Boolean);

      const freq = {};
      for (const r of regs) {
        const ag = r.unidade || 'SEM UNIDADE';
        freq[ag] = (freq[ag] || 0) + 1;
      }
      const unidadeLider = Object.entries(freq)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '-';

      const municipios = [...new Set(regs.map(r => r.municipio).filter(Boolean))];
      const representanteNome = regs[0]?.representanteNome || '';

      res.push({ representanteDoc, representanteNome, total: cnpjs.size, unidadeLider, municipios, registros: regs });
    }
    return res.sort((a, b) => b.total - a.total);
  },

  temVinculo(cnpjOriginal) {
    const c = CruzNorm.cnpj(cnpjOriginal);
    if (!c) return { vinculo: false, forca: null };
    const reg = this.indices.registros.get(c);
    if (!reg) return { vinculo: false, forca: null };

    let count = 0;
    const motivos = [];

    for (const tel of reg.telefones) {
      const s = this.indices.porTelefone.get(tel);
      if (s && s.size > 1) { count += s.size - 1; if (!motivos.includes('telefone')) motivos.push('telefone'); }
    }
    for (const ch of reg.emailsChave) {
      const s = this.indices.porEmail.get(ch);
      if (s && s.size > 1) { count += s.size - 1; if (!motivos.includes('e-mail')) motivos.push('e-mail'); }
    }

    let forteContato = false;
    if (reg.nomeContato) {
      const s = this.indices.porNomeContato.get(reg.nomeContato);
      if (s && s.size > 1) {
        motivos.push('nome de contato');

        for (const peerCnpj of s) {
          if (peerCnpj === c) continue;
          const peer = this.indices.registros.get(peerCnpj);
          if (!peer) continue;
          for (const tel of reg.telefones) {
            if (peer.telefones.has(tel)) { forteContato = true; break; }
          }
          if (forteContato) break;
        }
      }
    }

    const temFoneEmail = motivos.some(m => m === 'telefone' || m === 'e-mail');
    const temContato   = motivos.includes('nome de contato');
    const forca = forteContato ? 'forte'
                : temFoneEmail ? 'normal'
                : temContato   ? 'contato'
                : null;

    return { vinculo: count > 0 || temContato, count, motivos, forca };
  },

  buscarContato(nome) {
    const norm = CruzNorm.nome(nome);
    if (!norm || norm.length < 2) return new Set();

    const exato = this.indices.porNomeContato.get(norm);
    if (exato && exato.size >= 1) return exato;

    const res = new Set();
    for (const { cnpj, campo, valor } of this._linear) {
      if (campo === 'CONTATO' && valor && valor.includes(norm)) res.add(cnpj);
    }
    return res;
  },

  ehLigacaoForte(cnpj1, cnpj2) {
    const r1 = this.indices.registros.get(cnpj1);
    const r2 = this.indices.registros.get(cnpj2);
    if (!r1 || !r2 || !r1.nomeContato || r1.nomeContato !== r2.nomeContato) return false;
    for (const t of r1.telefones) if (r2.telefones.has(t)) return true;
    return false;
  },

  clustersConexos(cnpjsLimite = null, config = {}) {
    const {
      telefone    = true,
      email       = true,
      contato     = false,
      cepEndereco = false,
    } = config;

    const parent = new Map();
    const find = (x) => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
      return parent.get(x);
    };
    const union = (x, y) => {
      const px = find(x), py = find(y);
      if (px !== py) parent.set(px, py);
    };

    const registros = cnpjsLimite
      ? new Map([...this.indices.registros].filter(([c]) => cnpjsLimite.has(c)))
      : this.indices.registros;

    for (const c of registros.keys()) find(c);

    const conectar = (mapa) => {
      for (const cnpjs of mapa.values()) {
        const membros = cnpjsLimite ? [...cnpjs].filter(c => cnpjsLimite.has(c)) : [...cnpjs];
        if (membros.length < 2) continue;
        for (let i = 1; i < membros.length; i++) union(membros[0], membros[i]);
      }
    };

    if (telefone)    conectar(this.indices.porTelefone);
    if (email)       conectar(this.indices.porEmail);
    if (cepEndereco) { conectar(this.indices.porCep); conectar(this.indices.porEndereco); }
    if (contato)     conectar(this.indices.porNomeContato);

    const grupos = new Map();
    for (const c of registros.keys()) {
      const raiz = find(c);
      if (!grupos.has(raiz)) grupos.set(raiz, []);
      grupos.get(raiz).push(this.indices.registros.get(c));
    }

    return [...grupos.values()].filter(g => g.length >= 2).sort((a, b) => b.length - a.length);
  },

  clustersNaoTransitivos(cnpjsLimite = null, config = {}) {
    const { telefone = true, email = true, contato = false, cepEndereco = false } = config;
    const fmtTel = t => t.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
    const grupos = [];

    const coletar = (mapa, labelFn) => {
      for (const [chave, cnpjs] of mapa.entries()) {
        const membros = cnpjsLimite ? [...cnpjs].filter(c => cnpjsLimite.has(c)) : [...cnpjs];
        if (membros.length < 2) continue;
        grupos.push({
          motivo: labelFn(chave),
          items:  membros.map(c => this.indices.registros.get(c)).filter(Boolean),
        });
      }
    };

    if (telefone)    coletar(this.indices.porTelefone,    t => `📞 ${fmtTel(t)}`);
    if (email)       coletar(this.indices.porEmail,       k => k.startsWith('@') ? `🌐 ${k}` : `📧 ${k}`);
    if (cepEndereco) {
      coletar(this.indices.porCep,      k => `📮 CEP ${k.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`);
      coletar(this.indices.porEndereco, k => `🏠 ${k.slice(0, 45)}`);
    }
    if (contato)     coletar(this.indices.porNomeContato, k => `👤 ${k}`);

    return grupos.sort((a, b) => b.items.length - a.items.length);
  },

  buscarFragmento(termo) {
    const t = CruzNorm.texto(termo);
    if (!t || t.length < 2) return new Set();
    const cnpjs = new Set();
    for (const { cnpj, valor } of this._linear) {
      if (valor && valor.includes(t)) cnpjs.add(cnpj);
    }
    return cnpjs;
  },
};
