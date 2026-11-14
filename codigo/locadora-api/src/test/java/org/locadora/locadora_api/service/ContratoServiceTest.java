package org.locadora.locadora_api.service;

import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.locadora.locadora_api.exception.RegraNegocioException;
import org.locadora.locadora_api.model.*;
import org.locadora.locadora_api.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ContratoServiceTest {

    @Autowired ContratoService service;
    @Autowired ContratoRepository contratoRepository;
    @Autowired VeiculoRepository veiculoRepository;
    @Autowired ModeloRepository modeloRepository;
    @Autowired MarcaRepository marcaRepository;
    @Autowired CategoriaRepository categoriaRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired UsuarioRepository usuarioRepository;

    Cliente cliente;
    Usuario funcionario;
    Modelo modelo;

    @BeforeEach
    void preparar() {
        contratoRepository.deleteAll();
        veiculoRepository.deleteAll();

        Categoria categoria = new Categoria();
        categoria.setNome("Sedan");
        categoria.setValorDiaria(new BigDecimal("100.00"));
        categoria = categoriaRepository.save(categoria);

        Marca marca = new Marca();
        marca.setNome("Marca Teste");
        marca = marcaRepository.save(marca);

        modelo = new Modelo();
        modelo.setNome("Modelo Teste");
        modelo.setMarca(marca);
        modelo.setCategoria(categoria);
        modelo = modeloRepository.save(modelo);

        cliente = clienteRepository.save(new Cliente("Cliente Teste", "123"));
        Usuario u = new Usuario("vendedor" + System.nanoTime());
        u.setNome("Vendedor");
        u.setSenha("x");
        funcionario = usuarioRepository.save(u);
    }

    private Veiculo novoVeiculo(String placa) {
        Veiculo v = new Veiculo();
        v.setPlaca(placa);
        v.setKm(1000);
        v.setStatus(StatusVeiculo.DISPONIVEL);
        v.setModelo(modelo);
        return veiculoRepository.save(v);
    }

    private ContratoLocacao pedido(LocalDateTime retirada, LocalDateTime devolucao, Veiculo... veiculos) {
        ContratoLocacao c = new ContratoLocacao();
        Cliente refCliente = new Cliente();
        refCliente.setId(cliente.getId());
        Usuario refFunc = new Usuario();
        refFunc.setId(funcionario.getId());
        c.setCliente(refCliente);
        c.setFuncionario(refFunc);
        List<Locacao> itens = new ArrayList<>();
        for (Veiculo v : veiculos) {
            Locacao l = new Locacao();
            Veiculo ref = new Veiculo();
            ref.setId(v.getId());
            l.setVeiculo(ref);
            l.setDataRetirada(retirada);
            l.setDataDevolucao(devolucao);
            l.setValorLocacao(BigDecimal.ONE); // valor do cliente deve ser ignorado
            itens.add(l);
        }
        c.setListaLocacao(itens);
        return c;
    }

    @Test
    void precoEhCalculadoNoServidorArredondandoDiariaParaCima() {
        Veiculo v = novoVeiculo("AAA1A11");
        LocalDateTime ini = LocalDateTime.of(2026, 1, 1, 10, 0);

        ContratoLocacao c = service.abrir(pedido(ini, ini.plusDays(2).plusHours(1), v));

        assertThat(c.getListaLocacao().get(0).getValorLocacao()).isEqualByComparingTo("300.00"); // 2 dias e 1 hora = 3 diárias
        assertThat(c.getValorTotal()).isEqualByComparingTo("300.00");
        assertThat(veiculoRepository.findById(v.getId()).orElseThrow().getStatus()).isEqualTo(StatusVeiculo.ALUGADO);
    }

    @Test
    void naoAlugaVeiculoIndisponivel() {
        Veiculo v = novoVeiculo("BBB2B22");
        LocalDateTime ini = LocalDateTime.of(2026, 1, 1, 10, 0);
        service.abrir(pedido(ini, ini.plusDays(1), v));

        assertThatThrownBy(() -> service.abrir(pedido(ini, ini.plusDays(1), v)))
                .isInstanceOf(RegraNegocioException.class)
                .extracting(e -> ((RegraNegocioException) e).getStatus())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void devolucaoLiberaTodosOsVeiculosDoContrato() {
        Veiculo v1 = novoVeiculo("CCC3C33");
        Veiculo v2 = novoVeiculo("DDD4D44");
        LocalDateTime ini = LocalDateTime.of(2026, 1, 1, 10, 0);
        ContratoLocacao c = service.abrir(pedido(ini, ini.plusDays(1), v1, v2));

        DadosDevolucao dados = new DadosDevolucao();
        dados.setKmAtual(1200);
        dados.setTipoPagamento(TipoPagamento.PIX);
        ContratoLocacao fechado = service.encerrar(c.getId(), dados);

        assertThat(fechado.getStatus()).isEqualTo(StatusContrato.FECHADO);
        assertThat(fechado.getPagamento()).isNotNull();
        assertThat(veiculoRepository.findById(v1.getId()).orElseThrow().getStatus()).isEqualTo(StatusVeiculo.DISPONIVEL);
        assertThat(veiculoRepository.findById(v2.getId()).orElseThrow().getStatus()).isEqualTo(StatusVeiculo.DISPONIVEL);
        assertThatThrownBy(() -> service.encerrar(c.getId(), dados)).isInstanceOf(RegraNegocioException.class);
    }

    // Race condition: N requisições simultâneas para o MESMO veículo.
    // Sem a trava (SELECT ... FOR UPDATE), todas leriam DISPONIVEL e o carro
    // seria alugado várias vezes. Com ela, exatamente uma vence.
    @Test
    void requisicoesSimultaneasAlugamOVeiculoUmaUnicaVez() throws Exception {
        Veiculo v = novoVeiculo("EEE5E55");
        LocalDateTime ini = LocalDateTime.of(2026, 1, 1, 10, 0);
        int concorrentes = 8;

        ExecutorService pool = Executors.newFixedThreadPool(concorrentes);
        CountDownLatch largada = new CountDownLatch(1);
        AtomicInteger sucessos = new AtomicInteger();
        AtomicInteger conflitos = new AtomicInteger();
        List<Future<?>> tarefas = new ArrayList<>();
        for (int i = 0; i < concorrentes; i++) {
            tarefas.add(pool.submit(() -> {
                largada.await();
                try {
                    service.abrir(pedido(ini, ini.plusDays(1), v));
                    sucessos.incrementAndGet();
                } catch (RegraNegocioException e) {
                    if (e.getStatus() == HttpStatus.CONFLICT) conflitos.incrementAndGet();
                }
                return null;
            }));
        }
        largada.countDown(); // todas as threads disparam juntas
        for (Future<?> t : tarefas) t.get(30, TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(sucessos.get()).isEqualTo(1);
        assertThat(conflitos.get()).isEqualTo(concorrentes - 1);
        assertThat(contratoRepository.count()).isEqualTo(1);
    }
}
