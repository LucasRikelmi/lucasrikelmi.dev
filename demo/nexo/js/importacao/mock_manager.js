const MockManager = {
  CHAVE_FLAG:    "nexo_modo_mock",
  PREFIXO_BCK:  "nexo_backup_",

  ANALISTAS_MOCK: ["Analista A", "Analista B", "Analista C", "Analista D", "Analista E", "Analista F"],

  EXTRA_POR_GRUPO: 34,

  _PREFIXOS_EXTRA: ["Horizonte","Aurora","Mirante","Pioneira","Nova Era","Primavera","Atlântica","Vale Verde","Monte Claro"],
  _STATUS_EXTRA: ["RESPONDIDA","CONTATADA","AGENDADA","FORMALIZADA","SEM CONTATO","PRAZO VENCIDO","CONTATO EM ANDAMENTO","PRAZO ESTENDIDO","LEMBRETE ENVIADO"],
  _CONTATOS_EXTRA: [
    ["Contato Exemplo 01","0240-5101"], ["Contato Exemplo 02","08811-5102"], ["Contato Exemplo 03","0240-5103"],
    ["Contato Exemplo 04","08822-5104"],     ["Contato Exemplo 05","0240-5105"],   ["Contato Exemplo 06","08833-5106"],
    ["Contato Exemplo 07","0240-5107"],  ["Contato Exemplo 08","08844-5108"],["Contato Exemplo 09","0240-5109"],
  ],
  _CATEGORIAS_EXTRA: [
    { setor: "servicos", nouns: ["Soluções Corporativas","Serviços Jurídicos","Consultoria Financeira","Serviços de TI","Serviços Gerais","Assessoria Empresarial","Serviços Educacionais","Serviços de Limpeza","Serviços Médicos"],
      cnaes: ["7319002","6201500","7311400","8621601","8541400","4930201"],
      locais: [["38420-010","Centro"],["38430-140","Jd. das Palmeiras"],["38413-010","Jd. Primavera"],["38435-260","Res. Monte Alegre"],["38420-380","Vila Nova"],["38440-590","Pq. Industrial"]] },
    { setor: "comercio", nouns: ["Comércio de Materiais Elétricos","Comércio de Móveis","Comércio de Informática","Comércio de Cosméticos","Comércio de Brinquedos","Comércio de Ferragens","Comércio de Calçados","Comércio de Papelaria","Comércio Atacadista"],
      cnaes: ["4711301","4721104","4781400","4744001","4753900","4530701"],
      locais: [["38425-050","Jd. Esperança"],["38420-900","Res. Bela Vista"],["38430-230","Jd. Europa"],["38416-110","Jd. Primavera II"],["38420-410","Res. Vale Verde"],["38445-160","Lot. São José"]] },
    { setor: "industria", nouns: ["Indústria de Laticínios","Indústria Gráfica","Indústria de Embalagens","Indústria Metalúrgica","Indústria Têxtil","Indústria de Bebidas","Indústria Química","Indústria de Móveis","Indústria Alimentícia"],
      cnaes: ["1412601","1091101","2512000","2120000","2221100","1101200"],
      locais: [["38450-000","Pq. das Nações"],["38440-060","Vila Operária"],["38413-420","Res. Ipanema"],["38430-280","Jd. Novo Horizonte"],["38416-330","Jd. Primavera"],["38445-470","Res. Portal do Sol"]] },
    { setor: "obras", nouns: ["Construções e Reformas","Incorporadora","Engenharia Civil","Terraplenagem","Instalações Hidráulicas","Obras e Infraestrutura","Pavimentação","Empreendimentos Imobiliários","Reformas Residenciais"],
      cnaes: ["4120400","4110700","4291000","4312600","4321500","4299599"],
      locais: [["38425-620","Res. Recanto Verde"],["38430-740","Jd. Itália"],["38413-060","Vila Santa Rita"],["38440-270","Jd. Botânico"],["38435-380","Res. dos Ipês"],["38450-130","Chácaras Recreio"]] },
  ],

  _CLUSTERS_EXTRA: [
    { cnpj: "61.234.567/0001-66", nome: "Representante Exemplo D Ltda", indices: [0, 1] },
    { cnpj: "62.345.678/0001-67", nome: "Representante Exemplo E Ltda", indices: [2, 3] },
    { cnpj: "45.678.901/0001-88", nome: "Representante Exemplo F Ltda", indices: [9, 10] },
    { cnpj: "56.789.012/0001-99", nome: "Representante Exemplo G Ltda", indices: [11, 12] },
    { cnpj: "63.456.789/0001-68", nome: "Representante Exemplo H Ltda", indices: [18, 19] },
    { cnpj: "64.567.890/0001-69", nome: "Representante Exemplo I Ltda", indices: [20, 21] },
    { cnpj: "65.678.901/0001-70", nome: "Representante Exemplo J Ltda", indices: [22, 23] },
    { cnpj: "71.789.012/0001-71", nome: "Representante Exemplo K Ltda", indices: [24, 25] },
    { cnpj: "72.890.123/0001-72", nome: "Representante Exemplo L Ltda", indices: [26, 27] },
    { cnpj: "73.901.234/0001-73", nome: "Representante Exemplo M Ltda", indices: [28, 29] },
    { cnpj: "81.012.345/0001-74", nome: "Representante Exemplo N Ltda", indices: [30, 31] },
    { cnpj: "82.123.456/0001-75", nome: "Representante Exemplo O Ltda", indices: [32, 33] },
  ],

  _OC_EXTRA_INDICES: [13, 14, 15, 16, 17],

  _CATEGORIAS: ["CRI", "EST", "OPE"],

  // Categoria derivada da raiz do CNPJ: estável entre as bases do mock.
  _categoriaDe(cnpj) {
    const raiz = String(cnpj || "").replace(/\D/g, "").slice(0, 8);
    const soma = raiz.split("").reduce((t, c) => t + Number(c), 0);
    return this._CATEGORIAS[soma % 3];
  },

  _cnpjFicticio(base12) {
    const d = base12.split("").map(Number);
    const dv = (n, w) => { const r = n.reduce((s, x, k) => s + x * w[k], 0) % 11; return r < 2 ? 0 : 11 - r; };
    const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6, ...w1];
    const d1 = dv(d, w1), d2 = (dv([...d, d1], w2) + 1) % 10;
    const s = base12 + d1 + d2;
    return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`;
  },

  _empresaExtra(catIdx, i) {
    const cat = this._CATEGORIAS_EXTRA[catIdx];
    const prefixo = this._PREFIXOS_EXTRA[i % 9];
    const noun = cat.nouns[Math.floor(i / 9) % 9];
    const razao = `${prefixo} ${noun} Ltda`;
    const fantasia = `${prefixo} ${noun.split(" ").pop()}`;
    const seq = 25 + catIdx * this.EXTRA_POR_GRUPO + i;
    const seqStr = String(seq).padStart(3, "0");
    const cnpj = this._cnpjFicticio(`90${seqStr}${seqStr}0001`);
    const analista = this.ANALISTAS_MOCK[(catIdx * this.EXTRA_POR_GRUPO + i) % 6];
    const status = this._STATUS_EXTRA[i % 9];
    const [cep, bairro] = cat.locais[i % cat.locais.length];
    const cnae = cat.cnaes[i % cat.cnaes.length];
    const [contato, telSufixo] = this._CONTATOS_EXTRA[i % 9];
    const slug = fantasia.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    const cluster = this._CLUSTERS_EXTRA.find((c) => c.indices.includes(i));
    return {
      cnpj, razao, fantasia, status, analista, categoria: this._categoriaDe(cnpj), cnae, cep, bairro,
      contato, tel: `(34) ${telSufixo}`, email: `contato@${slug}.example`,
      docRepresentante: cluster ? cluster.cnpj : undefined,
      nomeRepresentante: cluster ? cluster.nome : undefined,
    };
  },

  ativo() {
    return localStorage.getItem(this.CHAVE_FLAG) === "1";
  },

  async ativar() {
    if (this.ativo()) return;

    for (const { chaveStorage, chaveTimestamp } of Object.values(ContratosArquivo)) {
      const atual = await StorageManager.lerAsync(chaveStorage);
      if (atual) await StorageManager.salvar(this.PREFIXO_BCK + chaveStorage, atual);
      const ts = localStorage.getItem(chaveTimestamp);
      if (ts) localStorage.setItem(this.PREFIXO_BCK + chaveTimestamp, ts);
    }

    await StorageManager.salvar(ContratosArquivo.Empresas.chaveStorage,            this._csvEmpresas());
    await StorageManager.salvar(ContratosArquivo.Ocs.chaveStorage,                this._csvOcs());
    await StorageManager.salvar(ContratosArquivo.OcsTransferencia.chaveStorage,   this._csvOcsTransferencia());
    await StorageManager.salvar(ContratosArquivo.EmpresasRede.chaveStorage,    this._csvEmpresasRede());
    await StorageManager.salvar(ContratosArquivo.Coordenadas.chaveStorage,         this._csvCoordenadas());
    await StorageManager.salvar(ContratosArquivo.Contatos.chaveStorage,         this._csvContatos());
    await StorageManager.salvar(ContratosArquivo.Emails.chaveStorage,              this._csvEmails());

    const ts = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    Object.values(ContratosArquivo).forEach(({ chaveTimestamp }) => {
      localStorage.setItem(chaveTimestamp, ts + " [MOCK]");
    });

    if (typeof ConfigEquipe !== "undefined") {
      const equipeAtual = ConfigEquipe.carregar();
      localStorage.setItem(this.PREFIXO_BCK + ConfigEquipe._CHAVE, JSON.stringify(equipeAtual));
      ConfigEquipe.salvar(this.ANALISTAS_MOCK.map((nome) => ({ nome, visivel: true })));
    }

    localStorage.setItem(this.CHAVE_FLAG, "1");
    this._atualizarBotao();
  },

  async desativar() {
    if (!this.ativo()) return;

    for (const { chaveStorage, chaveTimestamp } of Object.values(ContratosArquivo)) {
      const bckDados = await StorageManager.lerAsync(this.PREFIXO_BCK + chaveStorage);
      if (bckDados) {
        await StorageManager.salvar(chaveStorage, bckDados);
        StorageManager.remover(this.PREFIXO_BCK + chaveStorage);
      } else {
        StorageManager.remover(chaveStorage);
      }

      const bckTs = localStorage.getItem(this.PREFIXO_BCK + chaveTimestamp);
      if (bckTs) {
        localStorage.setItem(chaveTimestamp, bckTs);
        localStorage.removeItem(this.PREFIXO_BCK + chaveTimestamp);
      } else {
        localStorage.removeItem(chaveTimestamp);
      }
    }

    if (typeof ConfigEquipe !== "undefined") {
      const chaveBck = this.PREFIXO_BCK + ConfigEquipe._CHAVE;
      try {
        const equipeAtual = JSON.parse(localStorage.getItem(chaveBck) || "null");
        ConfigEquipe.salvar(Array.isArray(equipeAtual) ? equipeAtual : []);
      } catch (_) {
        ConfigEquipe.salvar([]);
      }
      localStorage.removeItem(chaveBck);
    }

    localStorage.removeItem(this.CHAVE_FLAG);
    this._atualizarBotao();
  },

  async toggle() {
    this.ativo() ? await this.desativar() : await this.ativar();
  },

  init() {
    document.addEventListener("DOMContentLoaded", () => this._atualizarBotao());
  },

  _atualizarBotao() {
    const btn = document.getElementById("btnMock");
    if (!btn) return;
    if (this.ativo()) {
      btn.innerHTML = '<i class="fas fa-flask"></i> Desativar Mock';
      btn.classList.add("mock-ativo");
    } else {
      btn.innerHTML = '<i class="fas fa-flask"></i> Carregar Base Mock';
      btn.classList.remove("mock-ativo");
    }
  },

  _cabEmpresas() {
    return "ciclo,cnpj,razao_social,nome_fantasia,unidade,uf,municipio,localidade," +
           "porte,prioritaria,categoria,cliente_novo,situacao," +
           "oc,oc_status,contatada,contato_incompleto,email_invalido,canal_contato," +
           "possui_email,canal_envio,status_envio,analista_contato," +
           "analista_responsavel,data_contato,data_envio," +
           "prazo_dias,prazo_data,data_retorno,cnae,cep,bairro," +
           "contato_nome,contato_telefone,contato_email," +
           "representante_documento,representante_nome,endereco";
  },

  _linhaEmpresa(ano, cnpj, razao, fantasia, status, analista, categoria,
                cnae, cep, bairro, municipio, canal, contato, tel, email,
                docRepresentante, nomeRepresentante) {
    const vip = ["Não","Não","Não","Não","Não","Sim"][Math.floor(Math.random()*6)];
    const formas = ["E-mail","E-mail","E-mail","Presencial","Telefone"];
    const forma = canal || formas[Math.floor(Math.random()*formas.length)];

    const destino = nomeRepresentante ? "Representante" : (forma === "E-mail" ? "Unidade" : "Presencial");
    const envio = forma === "E-mail" ? "Enviado" : "Entregue";
    return `${ano},${cnpj},"${razao}","${fantasia}",Unidade Triângulo,MG,` +
           `${municipio || "Uberlândia"},${municipio || "Uberlândia"},1,` +
           `${vip},${categoria},Não,${status},,,Sim,Não,Não,` +
           `${forma},Sim,${destino},${envio},"${analista}","${analista}",` +
           `15/04/2026,10/04/2026,30,10/05/2026,05/05/2026,${cnae},${cep},` +
           `"${bairro}","${contato}","${tel}","${email}",` +
           `"${docRepresentante || ""}","${nomeRepresentante || ""}","Av. Exemplo, ${Math.floor(Math.random()*2000)+100}"`;
  },

  _csvEmpresas() {

    const dados = [

      ["11.222.333/0001-01", "Alpha Serviços e Consultoria Ltda", "Alpha Serv", "RESPONDIDA", "Analista A", "7319002", "38420-010", "Centro", "Uberlândia", "Contato Exemplo 10", "(34) 0225-1001", "contato@alphaserv.example", "12.345.678/0001-99", "Representante Exemplo A Ltda"],
      ["22.333.444/0001-02", "Beta Tecnologia da Informação S.A.", "Beta TI", "CONTATADA", "Analista B", "6201500", "38430-140", "Jd. das Palmeiras", "Uberlândia", "Contato Exemplo 11", "(34) 0226-2002", "contato@betati.example", "12.345.678/0001-99", "Representante Exemplo A Ltda"],
      ["33.444.555/0001-03", "Gama Comunicações Exemplo Ltda", "Gama Com", "AGENDADA", "Analista C", "7311400", "38413-010", "Jd. Primavera", "Uberlândia", "Contato Exemplo 12", "(34) 08811-3003", "contato@gamacom.example", "12.345.678/0001-99", "Representante Exemplo A Ltda"],
      ["44.555.666/0001-04", "Delta Saúde e Bem-Estar Ltda", "Delta Saúde", "FORMALIZADA", "Analista D", "8621601", "38435-260", "Res. Monte Alegre", "Uberlândia", "Contato Exemplo 13", "(34) 09922-4004", "contato@deltasaude.example", "12.345.678/0001-99", "Representante Exemplo A Ltda"],
      ["55.666.777/0001-05", "Épsilon Educacional Exemplo S.A.", "Épsilon Edu", "SEM CONTATO", "Analista E", "8541400", "38420-380", "Vila Nova", "Uberlândia", "Contato Exemplo 14", "(34) 08833-5005", "contato@epsilonedu.example", "34.567.890/0001-77", "Representante Exemplo C Ltda"],
      ["66.777.888/0001-06", "Zeta Logística e Transporte Ltda", "Zeta Log", "PRAZO VENCIDO", "Analista F", "4930201", "38440-590", "Pq. Industrial", "Uberlândia", "Contato Exemplo 15", "(34) 0228-6006", "contato@zetalog.example", "34.567.890/0001-77", "Representante Exemplo C Ltda"],

      ["77.888.999/0001-07", "Eta Comércio de Alimentos Ltda", "Eta Alim", "RESPONDIDA", "Analista A", "4711301", "38425-050", "Jd. Esperança", "Uberlândia", "Contato Exemplo 16", "(34) 0229-7007", "contato@etaalim.example", "12.345.678/0001-99", "Representante Exemplo A Ltda"],
      ["88.999.000/0001-08", "Theta Varejo Exemplo S.A.", "Theta Var", "CONTATO EM ANDAMENTO", "Analista B", "4721104", "38420-900", "Res. Bela Vista", "Uberlândia", "Contato Exemplo 17", "(34) 08844-8008", "contato@thetavar.example", "12.345.678/0001-99", "Representante Exemplo A Ltda"],
      ["99.000.111/0001-09", "Iota Comércio de Vestuário Exemplo", "Iota Vest", "CONTATADA", "Analista C", "4781400", "38430-230", "Jd. Europa", "Uberlândia", "Contato Exemplo 18", "(34) 08855-9009", "contato@iotavest.example", "12.345.678/0001-99", "Representante Exemplo A Ltda"],
      ["10.111.222/0001-10", "Kappa Materiais de Construção Ltda", "Kappa Mat", "PRAZO ESTENDIDO", "Analista D", "4744001", "38416-110", "Jd. Primavera II", "Uberlândia", "Contato Exemplo 19", "(34) 09933-1010", "contato@kappamat.example", "12.345.678/0001-99", "Representante Exemplo A Ltda"],
      ["21.222.333/0001-11", "Lambda Eletrodomésticos Exemplo S.A.", "Lambda Ele", "LEMBRETE ENVIADO", "Analista E", "4753900", "38420-410", "Res. Vale Verde", "Uberlândia", "Contato Exemplo 20", "(34) 0230-1111", "contato@lambdaele.example", "34.567.890/0001-77", "Representante Exemplo C Ltda"],
      ["32.333.444/0001-12", "Mu Autopeças e Acessórios Ltda", "Mu Auto", "SEM CONTATO", "Analista F", "4530701", "38445-160", "Lot. São José", "Uberlândia", "Contato Exemplo 21", "(34) 08866-1212", "contato@muauto.example", "34.567.890/0001-77", "Representante Exemplo C Ltda"],

      ["43.444.555/0001-13", "Nu Indústria de Confecções Exemplo", "Nu Conf", "RESPONDIDA", "Analista A", "1412601", "38450-000", "Pq. das Nações", "Uberlândia", "Contato Exemplo 22", "(34) 0231-1313", "contato@nuconf.example", "98.765.432/0001-55", "Representante Exemplo B Ltda"],
      ["54.555.666/0001-14", "Xi Indústria de Alimentos Exemplo", "Xi Alim", "CONTATADA", "Analista B", "1091101", "38440-060", "Vila Operária", "Uberlândia", "Contato Exemplo 23", "(34) 09944-1414", "contato@xialim.example", "98.765.432/0001-55", "Representante Exemplo B Ltda"],
      ["65.666.777/0001-15", "Omicron Metalurgia Exemplo Ltda", "Omicron Met", "AGENDADA", "Analista C", "2512000", "38413-420", "Res. Ipanema", "Uberlândia", "Contato Exemplo 24", "(34) 08877-1515", "contato@omicronmet.example", "98.765.432/0001-55", "Representante Exemplo B Ltda"],
      ["76.777.888/0001-16", "Pi Indústria Farmacêutica Exemplo", "Pi Farma", "PRAZO VENCIDO", "Analista D", "2120000", "38430-280", "Jd. Novo Horizonte", "Uberlândia", "Contato Exemplo 25", "(34) 09955-1616", "contato@pifarma.example", "98.765.432/0001-55", "Representante Exemplo B Ltda"],
      ["87.888.999/0001-17", "Rho Plásticos e Embalagens Ltda", "Rho Plas", "SEM CONTATO", "Analista E", "2221100", "38416-330", "Jd. Primavera", "Uberlândia", "Contato Exemplo 26", "(34) 0232-1717", "contato@rhoplas.example", "98.765.432/0001-55", "Representante Exemplo B Ltda"],
      ["98.999.000/0001-18", "Sigma Bebidas Exemplo S.A.", "Sigma Beb", "PRAZO VENCIDO", "Analista F", "1101200", "38445-470", "Res. Portal do Sol", "Uberlândia", "Contato Exemplo 27", "(34) 08888-1818", "contato@sigmabeb.example", "98.765.432/0001-55", "Representante Exemplo B Ltda"],

      ["12.000.111/0001-19", "Tau Construções e Reformas Ltda", "Tau Const", "RESPONDIDA", "Analista A", "4120400", "38425-620", "Res. Recanto Verde", "Uberlândia", "Contato Exemplo 28", "(34) 0233-1919", "contato@tauconst.example", "98.765.432/0001-55", "Representante Exemplo B Ltda"],
      ["23.111.222/0001-20", "Upsilon Incorporadora Exemplo S.A.", "Upsilon Inc", "CONTATADA", "Analista B", "4110700", "38430-740", "Jd. Itália", "Uberlândia", "Contato Exemplo 29", "(34) 09966-2020", "contato@upsiloninc.example", "34.567.890/0001-77", "Representante Exemplo C Ltda"],
      ["34.222.333/0001-21", "Phi Engenharia Civil Exemplo Ltda", "Phi Eng", "FORMALIZADA", "Analista C", "4291000", "38413-060", "Vila Santa Rita", "Uberlândia", "Contato Exemplo 30", "(34) 08899-2121", "contato@phieng.example", "34.567.890/0001-77", "Representante Exemplo C Ltda"],
      ["45.333.444/0001-22", "Chi Terraplanagem Exemplo Ltda", "Chi Terra", "LEMBRETE ENVIADO", "Analista D", "4312600", "38440-270", "Jd. Botânico", "Uberlândia", "Contato Exemplo 31", "(34) 09977-2222", "contato@chiterra.example", "34.567.890/0001-77", "Representante Exemplo C Ltda"],
      ["56.444.555/0001-23", "Psi Instalações Elétricas Exemplo", "Psi Elet", "AGENDADA", "Analista E", "4321500", "38435-380", "Res. dos Ipês", "Uberlândia", "Contato Exemplo 32", "(34) 0234-2323", "contato@psielt.example"],
      ["67.555.666/0001-24", "Ômega Obras e Infraestrutura Ltda", "Ômega Obras", "CONTATO EM ANDAMENTO", "Analista F", "4299599", "38450-130", "Chácaras Recreio", "Uberlândia", "Contato Exemplo 33", "(34) 08800-2424", "contato@omegaobras.example"],
    ];

    for (let catIdx = 0; catIdx < this._CATEGORIAS_EXTRA.length; catIdx++) {
      for (let i = 0; i < this.EXTRA_POR_GRUPO; i++) {
        const e = this._empresaExtra(catIdx, i);
        dados.push([
          e.cnpj, e.razao, e.fantasia, e.status, e.analista,
          e.cnae, e.cep, e.bairro, "Uberlândia", e.contato, e.tel, e.email,
          e.docRepresentante, e.nomeRepresentante,
        ]);
      }
    }

    const linhas = [this._cabEmpresas()];
    dados.forEach(([cnpj,razao,fantasia,status,tec,cnae,cep,bairro,mun,contato,tel,email,docRepresentante,nomeRepresentante]) => {
      linhas.push(this._linhaEmpresa(2026, cnpj, razao, fantasia, status, tec, this._categoriaDe(cnpj), cnae, cep, bairro, mun, null, contato, tel, email, docRepresentante, nomeRepresentante));
    });
    return linhas.join("\n");
  },

  _csvOcs() {
    const cab = '"ciclo","uf","unidade_destino","cnpj_empresa","razao_social","analista_oc",' +
                '"categoria","categoria_destino","prioritaria","oc","status","aberta_em",' +
                '"aberta_por","atualizada_em"';
    const linhas = [cab];

    const ocs = [
      ["11.222.333/0001-01","Alpha Serviços e Consultoria Ltda","Analista A","","","Não","M1","CONCLUIDA","03/03/2026"],
      ["22.333.444/0001-02","Beta Tecnologia da Informação S.A.","Analista B","","","Não","M2","INICIADA","10/03/2026"],
      ["43.444.555/0001-13","Nu Indústria de Confecções Exemplo","Analista A","","","Não","M1","CONCLUIDA","15/03/2026"],
      ["54.555.666/0001-14","Xi Indústria de Alimentos Exemplo","Analista B","","","Não","M2","EM ANALISE","20/03/2026"],
      ["77.888.999/0001-07","Eta Comércio de Alimentos Ltda","Analista C","","","Não","1","REJEITADA","25/03/2026"],
      ["12.000.111/0001-19","Tau Construções e Reformas Ltda","Analista D","","","Não","1","CONCLUIDA","01/04/2026"],

      ["33.444.555/0001-03","Gama Comunicações Exemplo Ltda","Analista C","","","Não","1","INICIADA","05/04/2026"],
      ["99.000.111/0001-09","Iota Comércio de Vestuário Exemplo","Analista C","","","Não","M2","EM ANALISE","08/04/2026"],
      ["65.666.777/0001-15","Omicron Metalurgia Exemplo Ltda","Analista C","","","Não","1","CONCLUIDA","12/04/2026"],
      ["34.222.333/0001-21","Phi Engenharia Civil Exemplo Ltda","Analista C","","","Não","1","REJEITADA","15/04/2026"],
      ["44.555.666/0001-04","Delta Saúde e Bem-Estar Ltda","Analista D","","","Não","M1","CONCLUIDA","06/04/2026"],
      ["10.111.222/0001-10","Kappa Materiais de Construção Ltda","Analista D","","","Não","1","INICIADA","09/04/2026"],
      ["76.777.888/0001-16","Pi Indústria Farmacêutica Exemplo","Analista D","","","Não","1","EM ANALISE","13/04/2026"],
      ["45.333.444/0001-22","Chi Terraplanagem Exemplo Ltda","Analista D","","","Não","1","CONCLUIDA","16/04/2026"],
      ["55.666.777/0001-05","Épsilon Educacional Exemplo S.A.","Analista E","","","Não","1","REJEITADA","07/04/2026"],
      ["21.222.333/0001-11","Lambda Eletrodomésticos Exemplo S.A.","Analista E","","","Não","1","INICIADA","10/04/2026"],
      ["87.888.999/0001-17","Rho Plásticos e Embalagens Ltda","Analista E","","","Não","M2","EM ANALISE","14/04/2026"],
      ["56.444.555/0001-23","Psi Instalações Elétricas Exemplo","Analista E","","","Não","1","CONCLUIDA","17/04/2026"],
      ["66.777.888/0001-06","Zeta Logística e Transporte Ltda","Analista F","","","Não","1","CONCLUIDA","08/04/2026"],
      ["32.333.444/0001-12","Mu Autopeças e Acessórios Ltda","Analista F","","","Não","1","REJEITADA","11/04/2026"],
      ["98.999.000/0001-18","Sigma Bebidas Exemplo S.A.","Analista F","","","Não","1","INICIADA","15/04/2026"],
      ["67.555.666/0001-24","Ômega Obras e Infraestrutura Ltda","Analista F","","","Não","M1","CONCLUIDA","18/04/2026"],
      ["88.999.000/0001-08","Theta Varejo Exemplo S.A.","Analista B","","","Não","1","CONCLUIDA","09/04/2026"],
      ["23.111.222/0001-20","Upsilon Incorporadora Exemplo S.A.","Analista B","","","Não","1","EM ANALISE","19/04/2026"],
    ];

    const STATUS_OC_EXTRA = ["CONCLUIDA", "INICIADA", "EM ANALISE", "REJEITADA", "CONCLUIDA"];
    const ORIG_OC_EXTRA = ["1", "1", "M2", "1", "M1"];
    this._CATEGORIAS_EXTRA.forEach((cat, catIdx) => {
      this._OC_EXTRA_INDICES.forEach((i, idx) => {
        const e = this._empresaExtra(catIdx, i);
        ocs.push([e.cnpj, e.razao, e.analista, "", "", "Não", ORIG_OC_EXTRA[idx], STATUS_OC_EXTRA[idx], "20/04/2026"]);
      });
    });

    const RODIZIO = ["B1", "P2", "B4", "P3", "B3", "P1", "B2", "P4"];
        let iRodizio = 0;
    ocs.forEach(([cnpj, razao, tec, , , vip, orig, status, data]) => {
      const codigo = orig !== "1" ? orig : RODIZIO[iRodizio++ % RODIZIO.length];
      const cat = this._categoriaDe(cnpj);
      const catDestino = codigo === "M2" ? this._CATEGORIAS[(this._CATEGORIAS.indexOf(cat) + 1) % 3] : cat;
      linhas.push(
        `"2026","MG","Unidade Triângulo","${cnpj}","${razao}","${tec}","${cat}","${catDestino}","${vip}",` +
        `"OC-${codigo}","${status}","${data}","usuario.exemplo","${data}"`
      );
    });
    return linhas.join("\n");
  },

  _csvOcsTransferencia() {
    const cab = "ciclo,categoria,oc,unidade_destino,cnpj_transferido,razao_social,responsavel,email";
    const linhas = [cab];
    const transf = [

      ["", "M1", "22.333.444/0001-02", "Beta Tecnologia da Informação S.A.", "Analista B", "analista.b@meridiano.example"],
      ["", "M1", "65.666.777/0001-15", "Omicron Metalurgia Exemplo Ltda", "Analista C", "analista.c@meridiano.example"],
    ];
    transf.forEach(([, oc, cnpj, razao, resp, email]) => {
      linhas.push(`2026,${this._categoriaDe(cnpj)},${oc},"Unidade Triângulo",${cnpj},"${razao}","${resp}",${email}`);
    });

    linhas.push(`2026,OPE,,,,,,`);
    return linhas.join("\n");
  },

  _csvEmpresasRede() {

    const cab = this._cabEmpresas();
    const linhas = [cab];
    const extra = [
      ["98.765.432/0001-31", "Omega Comércio Atacadista Uberaba", "Omega Atac", "CONTATADA", "Analista D", "4631100", "38010-100", "Centro", "Uberaba", "Contato Exemplo 34", "(34) 0241-3131", "contato@omegatac.example"],
      ["87.654.321/0001-32", "Psi Serviços Financeiros Araguari", "Psi Fin", "RESPONDIDA", "Analista E", "6491600", "38441-420", "Jd. América", "Araguari", "Contato Exemplo 35", "(34) 0372-3232", "contato@psifin.example"],
      ["76.543.210/0001-33", "Rho Indústria Têxtil Patos", "Rho Têx", "AGENDADA", "Analista F", "1411801", "38700-050", "Centro", "Patos de Minas", "Contato Exemplo 36", "(34) 0412-3333", "contato@rhotex.example"],
      ["65.432.109/0001-34", "Sigma Construções Araguari Ltda", "Sigma Const", "SEM CONTATO", "Analista A", "4120400", "38442-080", "Jd. Califórnia", "Araguari", "Contato Exemplo 37", "(34) 0375-3434", "contato@sigmaconst.example"],
    ];
    extra.forEach(([cnpj,razao,fantasia,status,tec,cnae,cep,bairro,mun,contato,tel,email]) => {
      linhas.push(this._linhaEmpresa(2026, cnpj, razao, fantasia, status, tec, this._categoriaDe(cnpj), cnae, cep, bairro, mun, "E-mail", contato, tel, email));
    });
    return linhas.join("\n");
  },

  _csvCoordenadas() {
    const cab = "ciclo,cnpj,razao_social,nome_fantasia,uf,coordenada";
    const linhas = [cab];
    const pts = [
      ["11.222.333/0001-01","Alpha Serviços e Consultoria Ltda","Alpha Serv","-18.8200,-48.2950"],
      ["77.888.999/0001-07","Eta Comércio de Alimentos Ltda","Eta Alim","-18.8267,-48.2803"],
      ["43.444.555/0001-13","Nu Indústria de Confecções Exemplo","Nu Conf","-18.8155,-48.3014"],
      ["12.000.111/0001-19","Tau Construções e Reformas Ltda","Tau Const","-18.8381,-48.2635"],
      ["34.222.333/0001-21","Phi Engenharia Civil Exemplo Ltda","Phi Eng","-18.8494,-48.2491"],
      ["98.765.432/0001-31","Omega Comércio Atacadista Uberaba","Omega Atac","-18.7788,-48.2842"],
    ];
    pts.forEach(([cnpj, razao, fantasia, coord]) => {
      linhas.push(`2026,${cnpj},"${razao}","${fantasia}",MG,"${coord}"`);
    });
    return linhas.join("\n");
  },

  _csvContatos() {
    const cab = "cnpj_empresa,contato_nome,contato_telefone,contato_email," +
                "bairro,municipio,uf,porte";
    const linhas = [cab];
    const inf = [
      ["11.222.333/0001-01","Alpha Serviços e Consultoria Ltda","", "7319002","Contato Exemplo 10",  "(34) 0225-1001","contato@alphaserv.example"],
      ["22.333.444/0001-02","Beta Tecnologia da Informação S.A.","", "6201500","Contato Exemplo 11",    "(34) 0226-2002","contato@betati.example"],
      ["77.888.999/0001-07","Eta Comércio de Alimentos Ltda","", "4711301","Contato Exemplo 16",    "(34) 0229-7007","contato@etaalim.example"],
      ["43.444.555/0001-13","Nu Indústria de Confecções Exemplo","", "1412601","Contato Exemplo 22",  "(34) 0231-1313","contato@nuconf.example"],
      ["12.000.111/0001-19","Tau Construções e Reformas Ltda","", "4120400","Contato Exemplo 28",  "(34) 0233-1919","contato@tauconst.example"],
    ];
    inf.forEach(([cnpj, razao, , cnae, contato, tel, mail]) => {
      linhas.push(`${cnpj},"${contato}",${tel},${mail},Setor Central,Uberlândia,MG,1`);
    });
    return linhas.join("\n");
  },

  _csvEmails() {
    const cab = "enviado_em,status_email,categoria,cnpj_raiz";
    const linhas = [cab];
    const emails = [
      ["02/04/2026", "ENVIADO", "11222333"],
      ["03/04/2026", "ENTREGUE", "22333444"],
      ["04/04/2026", "ENVIADO", "33444555"],
      ["05/04/2026", "DEVOLVIDO", "44555666"],
      ["06/04/2026", "ENVIADO", "77888999"],
      ["07/04/2026", "ENTREGUE", "88999000"],
      ["08/04/2026", "ENVIADO", "43444555"],
      ["09/04/2026", "DEVOLVIDO", "54555666"],
      ["10/04/2026", "ENVIADO", "12000111"],
      ["11/04/2026", "ENTREGUE", "23111222"],
    ];
    emails.forEach(([data, status, raiz]) => linhas.push([data, status, this._categoriaDe(raiz), raiz].join(",")));
    return linhas.join("\n");
  },
};

MockManager.init();
