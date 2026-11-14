// Painel da demo: dispara várias aberturas de contrato AO MESMO TEMPO para o
// mesmo veículo e mostra quem venceu. Com a trava ligada, exatamente uma
// requisição recebe 200 e as demais 409; sem a trava, o carro é "alugado"
// várias vezes (o bug que o SELECT ... FOR UPDATE + @Version evitam no Java).
(function () {
  const API = "http://localhost:8080";
  const N = 5;

  function montar() {
    const alvo = document.querySelector("#view-locacao");
    if (!alvo) return;
    const painel = document.createElement("div");
    painel.className = "panel";
    painel.style.marginBottom = "24px";
    painel.innerHTML = `
      <h2 style="margin:0 0 6px;font-size:18px">Teste de concorrência <span style="font-size:12px;color:var(--muted);font-weight:500">(race condition)</span></h2>
      <p style="color:var(--muted);font-size:14px;margin:0 0 16px">
        Dispara ${N} pedidos de locação simultâneos para o <strong>mesmo veículo</strong>.
        No backend Java isso é protegido por <code>SELECT ... FOR UPDATE</code> (trava pessimista) e <code>@Version</code> (trava otimista).
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <select id="rcVeiculo" class="input" style="min-width:240px"></select>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer">
          <input type="checkbox" id="rcTrava" checked> Trava ativa
        </label>
        <button type="button" class="btn" id="rcDisparar">Disparar ${N} requisições</button>
      </div>
      <div id="rcResultado" style="margin-top:16px;font-size:14px"></div>`;
    alvo.prepend(painel);

    const sel = painel.querySelector("#rcVeiculo");
    const res = painel.querySelector("#rcResultado");

    async function carregarVeiculos() {
      const lista = await (await fetch(`${API}/veiculos`)).json();
      const livres = lista.filter((v) => v.status === "DISPONIVEL");
      sel.innerHTML = livres.length
        ? livres.map((v) => `<option value="${v.id}">${v.modelo?.nome} (${v.placa})</option>`).join("")
        : '<option value="">Nenhum veículo disponível</option>';
    }

    painel.querySelector("#rcDisparar").addEventListener("click", async () => {
      const veiculoId = Number(sel.value);
      if (!veiculoId) return;
      const [clientes, usuarios] = await Promise.all([
        fetch(`${API}/clientes`).then((r) => r.json()),
        fetch(`${API}/usuarios`).then((r) => r.json()),
      ]);
      window.LocadoraDemo.estado.travaAtiva = painel.querySelector("#rcTrava").checked;
      res.innerHTML = "Enviando…";

      const agora = new Date();
      const fim = new Date(agora.getTime() + 2 * 86400000);
      const pedido = (i) => ({
        cliente: { id: clientes[i % clientes.length].id },
        funcionario: { id: usuarios[0].id },
        valorCaucao: 300,
        dataContrato: agora.toISOString().slice(0, 10),
        listaLocacao: [{ veiculo: { id: veiculoId }, dataRetirada: agora.toISOString().slice(0, 16), dataDevolucao: fim.toISOString().slice(0, 16) }],
      });

      // Promise.all: todas as requisições saem juntas
      const respostas = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          fetch(`${API}/contratos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido(i)) })
            .then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }))
        )
      );
      window.LocadoraDemo.estado.travaAtiva = true;

      const ok = respostas.filter((r) => r.status === 200);
      const linhas = respostas.map((r, i) => {
        const cor = r.status === 200 ? "var(--success)" : "var(--danger)";
        const txt = r.status === 200 ? `contrato #${r.corpo.id} aberto` : r.corpo.erro;
        return `<div style="display:flex;gap:10px;padding:4px 0"><code style="color:${cor};min-width:44px">${r.status}</code><span>Requisição ${i + 1}: ${txt}</span></div>`;
      }).join("");
      const veredito = ok.length === 1
        ? `<strong style="color:var(--success)">Correto:</strong> só uma requisição alugou o carro.`
        : `<strong style="color:var(--danger)">Race condition:</strong> o mesmo carro entrou em ${ok.length} contratos.`;

      // Desfaz os contratos de teste para não sujar a demo
      await Promise.all(ok.map((r) => fetch(`${API}/contratos/${r.corpo.id}`, { method: "DELETE" })));
      res.innerHTML = `${linhas}<p style="margin:12px 0 0">${veredito} <span style="color:var(--muted)">(contratos de teste desfeitos)</span></p>`;
      carregarVeiculos();
    });

    carregarVeiculos();
  }

  document.addEventListener("DOMContentLoaded", montar);
})();
