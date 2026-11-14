// ============================================================
// API simulada da Locadora (modo DEMO do portfólio).
//
// O front-end original conversa com a API Spring Boot + Hibernate em
// http://localhost:8080. Aqui o `fetch` é interceptado e as regras dos
// controllers Java são reproduzidas sobre um "banco" em localStorage:
//   - POST com id   → update (mesma semântica do repository.save do JPA)
//   - POST sem id   → insert com id sequencial (GenerationType.IDENTITY)
//   - GET           → entidades com relacionamentos já resolvidos
//                     (@ManyToOne / @OneToMany como o Jackson serializaria)
//   - POST /contratos            → trava por veículo, 409 se indisponível,
//                                  preço = diárias (arredondadas p/ cima) × categoria
//   - PUT /contratos/{id}/encerrar → todos os veículos, KM, avaria → MANUTENCAO, pagamento
//   - POST /auth/login           → senha conferida aqui e nunca devolvida
// ============================================================
(function () {
  const API = "http://localhost:8080";
  const CHAVE_DB = "locadora_demo_db_v2";
  const DIA = 24 * 60 * 60 * 1000;

  function seed() {
    const hoje = Date.now();
    const iso = (offsetDias) => new Date(hoje + offsetDias * DIA).toISOString().slice(0, 16);
    return {
      seq: 100,
      categorias: [
        { id: 1, nome: "Econômico", valorDiaria: 119.9 },
        { id: 2, nome: "Sedan", valorDiaria: 189.9 },
        { id: 3, nome: "SUV", valorDiaria: 269.9 },
        { id: 4, nome: "Utilitário", valorDiaria: 229.9 },
      ],
      marcas: [
        { id: 1, nome: "Fiat" }, { id: 2, nome: "Volkswagen" }, { id: 3, nome: "Toyota" },
        { id: 4, nome: "Jeep" }, { id: 5, nome: "Chevrolet" },
      ],
      modelos: [
        { id: 1, nome: "Mobi Like", ano: 2024, qtModelo: 4, marca: { id: 1 }, categoria: { id: 1 } },
        { id: 2, nome: "Polo Track", ano: 2025, qtModelo: 3, marca: { id: 2 }, categoria: { id: 1 } },
        { id: 3, nome: "Corolla XEi", ano: 2024, qtModelo: 2, marca: { id: 3 }, categoria: { id: 2 } },
        { id: 4, nome: "Virtus Highline", ano: 2025, qtModelo: 2, marca: { id: 2 }, categoria: { id: 2 } },
        { id: 5, nome: "Compass Longitude", ano: 2024, qtModelo: 2, marca: { id: 4 }, categoria: { id: 3 } },
        { id: 6, nome: "S10 LT", ano: 2023, qtModelo: 1, marca: { id: 5 }, categoria: { id: 4 } },
      ],
      veiculos: [
        { id: 1, placa: "RBX4A21", cor: "Branco", chassi: "9BD341A5XPY000101", renavam: "01234567890", km: 18200, status: "ALUGADO", modelo: { id: 1 } },
        { id: 2, placa: "SFT2C45", cor: "Prata", chassi: "9BD341A5XPY000102", renavam: "01234567891", km: 9400, status: "DISPONIVEL", modelo: { id: 1 } },
        { id: 3, placa: "QWE7J12", cor: "Cinza", chassi: "9BWBH6BF0R4000103", renavam: "01234567892", km: 22100, status: "DISPONIVEL", modelo: { id: 2 } },
        { id: 4, placa: "PLM3D88", cor: "Preto", chassi: "9BRBDWHE1R0000104", renavam: "01234567893", km: 31050, status: "ALUGADO", modelo: { id: 3 } },
        { id: 5, placa: "KJH5E09", cor: "Azul", chassi: "9BWDL5BZ0S4000105", renavam: "01234567894", km: 5200, status: "DISPONIVEL", modelo: { id: 4 } },
        { id: 6, placa: "ZXC9F33", cor: "Vermelho", chassi: "988675112RK000106", renavam: "01234567895", km: 41200, status: "MANUTENCAO", modelo: { id: 5 } },
        { id: 7, placa: "BNM1G77", cor: "Branco", chassi: "988675112RK000107", renavam: "01234567896", km: 12800, status: "DISPONIVEL", modelo: { id: 5 } },
        { id: 8, placa: "VBN6H54", cor: "Prata", chassi: "9BG148FK0PC000108", renavam: "01234567897", km: 56300, status: "DISPONIVEL", modelo: { id: 6 } },
      ],
      clientes: [
        { id: 1, nome: "Ana Paula Ribeiro", cpf: "123.456.789-00", cnh: "04512345678",
          contato: { email: "ana.ribeiro@email.example", telefone: "(62) 0200-1001", celular: "(62) 09101-1001" },
          endereco: { cep: "74000-100", logradouro: "Rua das Flores", numero: "120", complemento: "Apto 302", referencia: "" } },
        { id: 2, nome: "Rafael Henrique Costa", cpf: "234.567.890-11", cnh: "04523456789",
          contato: { email: "rafael.costa@email.example", telefone: "", celular: "(62) 09202-2002" },
          endereco: { cep: "74100-200", logradouro: "Av. Central", numero: "455", complemento: "", referencia: "Próx. ao parque" } },
        { id: 3, nome: "Carolina Martins", cpf: "345.678.901-22", cnh: "04534567890",
          contato: { email: "carol.martins@email.example", telefone: "", celular: "(62) 09303-3003" },
          endereco: { cep: "74200-300", logradouro: "Rua 7", numero: "33", complemento: "Casa", referencia: "" } },
        { id: 4, nome: "Diego Fernandes", cpf: "456.789.012-33", cnh: "04545678901",
          contato: { email: "diego.f@email.example", telefone: "(62) 0200-4004", celular: "(62) 09404-4004" },
          endereco: { cep: "74300-400", logradouro: "Alameda dos Ipês", numero: "900", complemento: "", referencia: "" } },
      ],
      usuarios: [
        { id: 1, nome: "Usuário Demo", cpf: "000.000.000-00", login: "demo", senha: "demo123", perfil: "ADMIN",
          contato: { email: "demo@locadora.example", telefone: "", celular: "" }, endereco: { cep: "", logradouro: "", numero: "" } },
        { id: 2, nome: "Fernanda Lima", cpf: "111.222.333-44", login: "fernanda", senha: "fernanda123", perfil: "OPERADOR",
          contato: { email: "fernanda@locadora.example", telefone: "", celular: "(62) 09505-5005" }, endereco: { cep: "", logradouro: "", numero: "" } },
      ],
      contratos: [
        { id: 1, dataContrato: iso(-12).slice(0, 10), valorCaucao: 500, status: "FECHADO", valorTotal: 759.6,
          funcionario: { id: 2 }, cliente: { id: 2 }, pagamento: { id: 1, valorTotal: 759.6, tipoPagamento: "PIX" },
          listaLocacao: [{ id: 1, dataRetirada: iso(-12), dataDevolucao: iso(-8), valorLocacao: 759.6, veiculo: { id: 3 }, listaOcorrencias: [] }] },
        { id: 2, dataContrato: iso(-6).slice(0, 10), valorCaucao: 800, status: "FECHADO", valorTotal: 1499.4,
          funcionario: { id: 1 }, cliente: { id: 4 }, pagamento: { id: 2, valorTotal: 1499.4, tipoPagamento: "CREDITO" },
          listaLocacao: [{ id: 2, dataRetirada: iso(-6), dataDevolucao: iso(-1), valorLocacao: 1349.5, veiculo: { id: 6 },
            listaOcorrencias: [{ id: 1, descricao: "Avaria na Devolução: para-choque riscado", valor: 0 }] }] },
        { id: 3, dataContrato: iso(-2).slice(0, 10), valorCaucao: 400, status: "ABERTO", valorTotal: 0,
          funcionario: { id: 2 }, cliente: { id: 1 }, pagamento: null,
          listaLocacao: [{ id: 3, dataRetirada: iso(-2), dataDevolucao: iso(3), valorLocacao: 599.5, veiculo: { id: 1 }, listaOcorrencias: [] }] },
        { id: 4, dataContrato: iso(-1).slice(0, 10), valorCaucao: 600, status: "ABERTO", valorTotal: 0,
          funcionario: { id: 1 }, cliente: { id: 3 }, pagamento: null,
          listaLocacao: [{ id: 4, dataRetirada: iso(-1), dataDevolucao: iso(4), valorLocacao: 949.5, veiculo: { id: 4 }, listaOcorrencias: [] }] },
      ],
    };
  }

  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_DB) || "null");
      if (salvo && salvo.categorias) return salvo;
    } catch (_) { /* banco corrompido → recomeça do seed */ }
    const db = seed();
    salvar(db);
    return db;
  }
  function salvar(db) {
    try { localStorage.setItem(CHAVE_DB, JSON.stringify(db)); } catch (_) { /* sem storage: vale só em memória */ }
  }

  const db = carregar();
  const porId = (tabela, id) => db[tabela].find((x) => x.id === Number(id)) || null;
  const ref = (obj) => (obj && obj.id != null ? { id: Number(obj.id) } : null);
  const proxId = () => ++db.seq;

  // ── Serialização (o que o Jackson devolveria) ────────────
  const categoriaJson = (c) => c && { id: c.id, nome: c.nome, valorLocacao: c.valorDiaria };
  const modeloJson = (m) => m && {
    id: m.id, nome: m.nome, ano: m.ano, qtModelo: m.qtModelo,
    marca: porId("marcas", m.marca?.id), categoria: categoriaJson(porId("categorias", m.categoria?.id)),
  };
  const veiculoJson = (v) => v && { ...v, modelo: modeloJson(porId("modelos", v.modelo?.id)) };
  const contratoJson = (c) => ({
    ...c,
    funcionario: porId("usuarios", c.funcionario?.id),
    cliente: porId("clientes", c.cliente?.id),
    listaLocacao: (c.listaLocacao || []).map((l) => ({
      ...l,
      veiculo: veiculoJson(porId("veiculos", l.veiculo?.id)),
      cliente: porId("clientes", c.cliente?.id),
    })),
  });

  const semSenha = (u) => { const { senha, ...resto } = u; return resto; }; // senha é WRITE_ONLY no Java
  const SERIALIZA = {
    categorias: categoriaJson, marcas: (x) => x, modelos: modeloJson, veiculos: veiculoJson,
    clientes: (x) => x, usuarios: semSenha, contratos: contratoJson,
  };

  // Erro com status HTTP (equivale à RegraNegocioException do Java)
  class ErroApi extends Error {
    constructor(status, mensagem) { super(mensagem); this.status = status; }
  }
  const naoEncontrado = (m) => new ErroApi(404, m);
  const conflito = (m) => new ErroApi(409, m);
  const invalido = (m) => new ErroApi(400, m);

  // ── Trava por registro (equivale ao SELECT ... FOR UPDATE) ──
  // JavaScript é single-thread, mas o "banco" abaixo tem latência (await)
  // entre ler o status e gravar — exatamente a janela onde a corrida
  // acontece. Cada chave guarda a promessa da última operação; quem chega
  // depois espera a anterior terminar.
  const travas = new Map();
  async function comTrava(chaves, fn) {
    if (!estado.travaAtiva) return fn();
    chaves = [...new Set(chaves)].sort(); // ordem fixa evita deadlock
    const anteriores = chaves.map((k) => travas.get(k) || Promise.resolve());
    let liberar;
    const minha = new Promise((r) => (liberar = r));
    chaves.forEach((k) => travas.set(k, minha));
    await Promise.all(anteriores);
    try { return await fn(); } finally { liberar(); }
  }
  const latenciaBanco = () => new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
  const estado = { travaAtiva: true };

  const NORMALIZA = {
    categorias: (b) => ({ id: b.id, nome: b.nome, valorDiaria: Number(b.valorLocacao ?? b.valorDiaria) || 0 }),
    marcas: (b) => ({ id: b.id, nome: b.nome }),
    modelos: (b) => ({ id: b.id, nome: b.nome, ano: Number(b.ano) || null, qtModelo: Number(b.qtModelo) || 0, marca: ref(b.marca), categoria: ref(b.categoria) }),
    clientes: (b) => b,
  };

  function upsert(tabela, corpo) {
    const ent = NORMALIZA[tabela](corpo);
    if (ent.id != null && ent.id !== "") {
      ent.id = Number(ent.id);
      const i = db[tabela].findIndex((x) => x.id === ent.id);
      if (i >= 0) db[tabela][i] = { ...db[tabela][i], ...ent };
      else db[tabela].push(ent);
    } else {
      ent.id = proxId();
      db[tabela].push(ent);
    }
    salvar(db);
    return SERIALIZA[tabela](porId(tabela, ent.id));
  }

  // VeiculoController.salvar: status não vem do formulário; KM não diminui
  function salvarVeiculo(b) {
    if (!b.modelo?.id || !porId("modelos", b.modelo.id)) throw invalido("Selecione o modelo do veículo.");
    const dados = { placa: b.placa, cor: b.cor, chassi: b.chassi, renavam: b.renavam, modelo: ref(b.modelo) };
    const km = b.km === "" || b.km == null ? null : Number(b.km);
    if (b.id == null || b.id === "") {
      const novo = { id: proxId(), ...dados, km: km || 0, status: "DISPONIVEL" };
      db.veiculos.push(novo);
      salvar(db);
      return veiculoJson(novo);
    }
    const atual = porId("veiculos", b.id);
    if (!atual) throw naoEncontrado("Veículo não encontrado.");
    if (km != null && km < atual.km) throw invalido("A quilometragem não pode diminuir.");
    Object.assign(atual, dados, km != null ? { km } : {});
    salvar(db);
    return veiculoJson(atual);
  }

  // UsuarioController.salvar: login único; senha vazia na edição mantém a atual
  function salvarUsuario(b) {
    const outro = db.usuarios.find((u) => u.login === b.login && u.id !== Number(b.id));
    if (outro) throw conflito("Login já está em uso.");
    const senhaVazia = !b.senha;
    if (b.id != null && b.id !== "") {
      const atual = porId("usuarios", b.id);
      if (!atual) throw naoEncontrado("Usuário não encontrado.");
      Object.assign(atual, b, { id: atual.id, senha: senhaVazia ? atual.senha : b.senha });
      salvar(db);
      return semSenha(atual);
    }
    if (senhaVazia) throw invalido("Informe uma senha.");
    const novo = { ...b, id: proxId() };
    db.usuarios.push(novo);
    salvar(db);
    return semSenha(novo);
  }

  // ContratoService.calcularDiarias: fração de dia conta como dia inteiro, mínimo 1
  const diarias = (l) => Math.max(1, Math.ceil((new Date(l.dataDevolucao) - new Date(l.dataRetirada)) / DIA));

  // ContratoService.abrir
  async function abrirContrato(corpo) {
    const itens = corpo.listaLocacao || [];
    if (!itens.length) throw invalido("O contrato precisa de ao menos um veículo.");
    if (!porId("clientes", corpo.cliente?.id)) throw naoEncontrado("Cliente não encontrado.");
    if (!porId("usuarios", corpo.funcionario?.id)) throw naoEncontrado("Funcionário não encontrado.");

    return comTrava(itens.map((l) => "veiculo:" + l.veiculo?.id), async () => {
      const contrato = {
        id: proxId(),
        dataContrato: corpo.dataContrato || new Date().toISOString().slice(0, 10),
        valorCaucao: Number(corpo.valorCaucao) || 0,
        status: "ABERTO",
        valorTotal: 0,
        funcionario: ref(corpo.funcionario),
        cliente: ref(corpo.cliente),
        pagamento: null,
        listaLocacao: [],
      };
      for (const l of itens) {
        if (!(new Date(l.dataDevolucao) > new Date(l.dataRetirada))) throw invalido("A devolução prevista deve ser depois da retirada.");
        const veiculo = porId("veiculos", l.veiculo?.id);
        if (!veiculo) throw naoEncontrado("Veículo não encontrado.");
        const statusLido = veiculo.status;
        await latenciaBanco(); // janela da corrida: entre ler e gravar
        if (statusLido !== "DISPONIVEL") throw conflito(`O veículo ${veiculo.placa} não está disponível (${statusLido}).`);
        const categoria = porId("categorias", porId("modelos", veiculo.modelo?.id)?.categoria?.id);
        if (!categoria) throw invalido("Veículo sem categoria/diária configurada.");
        const valor = diarias(l) * categoria.valorDiaria; // valor do cliente é ignorado
        contrato.listaLocacao.push({
          id: proxId(),
          dataRetirada: l.dataRetirada,
          dataDevolucao: l.dataDevolucao,
          valorLocacao: valor,
          veiculo: { id: veiculo.id },
          listaOcorrencias: (l.listaOcorrencias || []).map((o) => ({ id: proxId(), descricao: o.descricao, valor: Number(o.valor) || 0 })),
        });
        contrato.valorTotal += valor;
        veiculo.status = "ALUGADO";
      }
      db.contratos.push(contrato);
      salvar(db);
      return contratoJson(contrato);
    });
  }

  // ContratoService.encerrar: devolve TODOS os veículos do contrato
  async function encerrarContrato(id, dados) {
    return comTrava(["contrato:" + id], async () => {
      const contrato = porId("contratos", id);
      if (!contrato) throw naoEncontrado("Contrato não encontrado.");
      const statusLido = contrato.status;
      await latenciaBanco();
      if (statusLido !== "ABERTO") throw conflito("Este contrato já foi encerrado.");
      if (!dados.tipoPagamento) throw invalido("Informe a forma de pagamento.");
      const valorFinal = Number.isFinite(dados.valorTotalFinal) ? dados.valorTotalFinal : contrato.valorTotal;
      if (valorFinal < 0) throw invalido("O valor final não pode ser negativo.");
      for (const locacao of contrato.listaLocacao || []) {
        const veiculo = porId("veiculos", locacao.veiculo?.id);
        if (!veiculo) continue;
        if (Number.isFinite(dados.kmAtual)) {
          if (dados.kmAtual < veiculo.km) throw invalido(`KM de devolução menor que o KM atual do veículo ${veiculo.placa}.`);
          veiculo.km = dados.kmAtual;
        }
        if (dados.temAvaria) {
          veiculo.status = "MANUTENCAO";
          (locacao.listaOcorrencias = locacao.listaOcorrencias || []).push({ id: proxId(), descricao: "Avaria na devolução: " + (dados.obsAvaria || ""), valor: 0 });
        } else {
          veiculo.status = "DISPONIVEL";
        }
      }
      contrato.pagamento = { id: proxId(), tipoPagamento: dados.tipoPagamento, valorTotal: valorFinal };
      contrato.status = "FECHADO";
      contrato.valorTotal = valorFinal;
      salvar(db);
      return contratoJson(contrato);
    });
  }

  // ContratoService.excluir: contrato aberto libera os veículos
  function excluirContrato(id) {
    const contrato = porId("contratos", id);
    if (!contrato) throw naoEncontrado("Contrato não encontrado.");
    if (contrato.status === "ABERTO") {
      contrato.listaLocacao.forEach((l) => { const v = porId("veiculos", l.veiculo?.id); if (v) v.status = "DISPONIVEL"; });
    }
    remover("contratos", id);
  }

  function excluir(tabela, id) {
    if (!porId(tabela, id)) throw naoEncontrado("Registro não encontrado.");
    if (tabela === "contratos") return excluirContrato(id);
    if (tabela === "veiculos" && db.contratos.some((c) => c.listaLocacao.some((l) => l.veiculo?.id === Number(id)))) {
      throw conflito("Veículo com histórico de locações não pode ser excluído.");
    }
    // Equivale ao DataIntegrityViolationException → 409 do Java
    const emUso =
      (tabela === "marcas" && db.modelos.some((m) => m.marca?.id === Number(id))) ||
      (tabela === "categorias" && db.modelos.some((m) => m.categoria?.id === Number(id))) ||
      (tabela === "modelos" && db.veiculos.some((v) => v.modelo?.id === Number(id))) ||
      (tabela === "clientes" && db.contratos.some((c) => c.cliente?.id === Number(id))) ||
      (tabela === "usuarios" && db.contratos.some((c) => c.funcionario?.id === Number(id)));
    if (emUso) throw conflito("Registro em uso por outros cadastros; não pode ser alterado/excluído.");
    remover(tabela, id);
  }

  function remover(tabela, id) {
    const i = db[tabela].findIndex((x) => x.id === Number(id));
    if (i >= 0) db[tabela].splice(i, 1);
    salvar(db);
  }

  const resposta = (status, corpo) =>
    new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status, headers: { "Content-Type": "application/json" },
    });

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async function (entrada, opcoes = {}) {
    const url = typeof entrada === "string" ? entrada : entrada.url;
    if (!url.startsWith(API)) return fetchOriginal(entrada, opcoes);

    await new Promise((r) => setTimeout(r, 80)); // latência de rede simulada
    const metodo = (opcoes.method || "GET").toUpperCase();
    const partes = url.slice(API.length).split("?")[0].split("/").filter(Boolean);
    const [tabela, id, acao] = partes;
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : null;

    try {
      // AuthController: a senha é conferida no "servidor" e nunca volta
      if (tabela === "auth" && id === "login" && metodo === "POST") {
        const u = db.usuarios.find((x) => x.login === corpo?.login && x.senha === corpo?.senha);
        return u ? resposta(200, semSenha(u)) : resposta(401, { erro: "Usuário ou senha incorretos." });
      }
      if (!db[tabela]) return resposta(404, { erro: "Rota não encontrada" });
      if (metodo === "GET" && !id) return resposta(200, db[tabela].map(SERIALIZA[tabela]));
      if (metodo === "GET") {
        const ent = porId(tabela, id);
        return ent ? resposta(200, SERIALIZA[tabela](ent)) : resposta(404, { erro: "Não encontrado." });
      }
      if (metodo === "DELETE") { excluir(tabela, id); return resposta(204); }
      if (tabela === "contratos" && metodo === "PUT" && acao === "encerrar") return resposta(200, await encerrarContrato(id, corpo));
      if (tabela === "contratos" && metodo === "POST") return resposta(200, await abrirContrato(corpo));
      if (tabela === "veiculos" && metodo === "POST") return resposta(200, salvarVeiculo(corpo));
      if (tabela === "usuarios" && metodo === "POST") return resposta(200, salvarUsuario(corpo));
      if (metodo === "POST" && NORMALIZA[tabela]) return resposta(200, upsert(tabela, corpo));
      return resposta(405, { erro: "Método não suportado." });
    } catch (e) {
      return resposta(e.status || 500, { erro: e.message });
    }
  };

  window.LocadoraDemo = {
    resetar() { localStorage.removeItem(CHAVE_DB); location.reload(); },
    estado,
  };

  // Faixa de demonstração
  document.addEventListener("DOMContentLoaded", () => {
    try { if (localStorage.getItem("nexo_demo_sem_faixa") === "1") return; } catch (_) { /* storage bloqueado */ }
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;gap:10px;align-items:center;" +
      "padding:8px 10px 8px 14px;border-radius:999px;background:#0f172a;color:#e2e8f0;" +
      "font:500 12px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)";
    el.innerHTML =
      '<span>API Spring simulada no navegador · dados fictícios</span>' +
      '<button type="button" style="all:unset;cursor:pointer;padding:6px 10px;border-radius:999px;background:#1e293b">Resetar</button>' +
      '<a href="../../index.html#projetos" style="color:#fff;text-decoration:none;padding:6px 12px;border-radius:999px;background:#1e293b">← Portfólio</a>';
    el.querySelector("button").addEventListener("click", () => window.LocadoraDemo.resetar());
    document.body.appendChild(el);
  });
})();
