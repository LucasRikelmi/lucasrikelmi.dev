package org.locadora.locadora_api.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import org.locadora.locadora_api.exception.RegraNegocioException;
import org.locadora.locadora_api.model.*;
import org.locadora.locadora_api.repository.ClienteRepository;
import org.locadora.locadora_api.repository.ContratoRepository;
import org.locadora.locadora_api.repository.UsuarioRepository;
import org.locadora.locadora_api.repository.VeiculoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

// Regras do ciclo de vida do contrato (antes espalhadas no controller).
@Service
public class ContratoService {

    private static final long MINUTOS_POR_DIA = 24 * 60;

    private final ContratoRepository contratoRepository;
    private final VeiculoRepository veiculoRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioRepository usuarioRepository;

    public ContratoService(ContratoRepository contratoRepository, VeiculoRepository veiculoRepository,
                           ClienteRepository clienteRepository, UsuarioRepository usuarioRepository) {
        this.contratoRepository = contratoRepository;
        this.veiculoRepository = veiculoRepository;
        this.clienteRepository = clienteRepository;
        this.usuarioRepository = usuarioRepository;
    }

    // Diárias cobradas: fração de dia conta como dia inteiro, mínimo 1.
    public static long calcularDiarias(Locacao locacao) {
        long minutos = Duration.between(locacao.getDataRetirada(), locacao.getDataDevolucao()).toMinutes();
        return Math.max(1, (minutos + MINUTOS_POR_DIA - 1) / MINUTOS_POR_DIA);
    }

    @Transactional
    public ContratoLocacao abrir(ContratoLocacao contrato) {
        if (contrato.getListaLocacao() == null || contrato.getListaLocacao().isEmpty()) {
            throw RegraNegocioException.invalido("O contrato precisa de ao menos um veículo.");
        }
        Cliente cliente = clienteRepository.findById(idObrigatorio(contrato.getCliente() == null ? null : contrato.getCliente().getId(), "cliente"))
                .orElseThrow(() -> RegraNegocioException.naoEncontrado("Cliente não encontrado."));
        Usuario funcionario = usuarioRepository.findById(idObrigatorio(contrato.getFuncionario() == null ? null : contrato.getFuncionario().getId(), "funcionário"))
                .orElseThrow(() -> RegraNegocioException.naoEncontrado("Funcionário não encontrado."));

        contrato.setId(null);
        contrato.setCliente(cliente);
        contrato.setFuncionario(funcionario);
        contrato.setStatus(StatusContrato.ABERTO);
        contrato.setPagamento(null);
        if (contrato.getDataContrato() == null) contrato.setDataContrato(LocalDate.now());

        // Trava os veículos sempre na mesma ordem (por id) para que dois
        // contratos com os mesmos carros não entrem em deadlock.
        List<Locacao> locacoes = new ArrayList<>(contrato.getListaLocacao());
        locacoes.sort(Comparator.comparing(l -> idObrigatorio(l.getVeiculo() == null ? null : l.getVeiculo().getId(), "veículo")));

        BigDecimal total = BigDecimal.ZERO;
        for (Locacao locacao : locacoes) {
            if (locacao.getDataRetirada() == null || locacao.getDataDevolucao() == null
                    || !locacao.getDataDevolucao().isAfter(locacao.getDataRetirada())) {
                throw RegraNegocioException.invalido("A devolução prevista deve ser depois da retirada.");
            }

            Veiculo veiculo = veiculoRepository.findByIdParaAtualizacao(locacao.getVeiculo().getId())
                    .orElseThrow(() -> RegraNegocioException.naoEncontrado("Veículo não encontrado."));
            if (veiculo.getStatus() != StatusVeiculo.DISPONIVEL) {
                throw RegraNegocioException.conflito("O veículo " + veiculo.getPlaca() + " não está disponível (" + veiculo.getStatus() + ").");
            }
            if (veiculo.getModelo() == null || veiculo.getModelo().getCategoria() == null
                    || veiculo.getModelo().getCategoria().getValorDiaria() == null) {
                throw RegraNegocioException.invalido("Veículo sem categoria/diária configurada.");
            }

            // O preço é sempre calculado aqui: o valor enviado pelo cliente é ignorado.
            BigDecimal valor = veiculo.getModelo().getCategoria().getValorDiaria()
                    .multiply(BigDecimal.valueOf(calcularDiarias(locacao)))
                    .setScale(2, RoundingMode.HALF_EVEN);
            locacao.setId(null);
            locacao.setValorLocacao(valor);
            locacao.setVeiculo(veiculo);
            locacao.setCliente(cliente);
            locacao.setContrato(contrato);
            if (locacao.getListaOcorrencias() != null) {
                locacao.getListaOcorrencias().forEach(o -> o.setLocacao(locacao));
            }
            total = total.add(valor);

            veiculo.setStatus(StatusVeiculo.ALUGADO);
        }
        contrato.setValorTotal(total);
        return contratoRepository.save(contrato);
    }

    @Transactional
    public ContratoLocacao encerrar(Long id, DadosDevolucao dados) {
        ContratoLocacao contrato = contratoRepository.findByIdParaAtualizacao(id)
                .orElseThrow(() -> RegraNegocioException.naoEncontrado("Contrato não encontrado."));
        if (contrato.getStatus() != StatusContrato.ABERTO) {
            throw RegraNegocioException.conflito("Este contrato já foi encerrado.");
        }
        if (dados.getTipoPagamento() == null) {
            throw RegraNegocioException.invalido("Informe a forma de pagamento.");
        }
        BigDecimal valorFinal = dados.getValorTotalFinal() != null ? dados.getValorTotalFinal() : contrato.getValorTotal();
        if (valorFinal == null || valorFinal.signum() < 0) {
            throw RegraNegocioException.invalido("O valor final não pode ser negativo.");
        }

        // Antes só a primeira locação era devolvida: os outros carros do
        // contrato ficavam ALUGADOS para sempre.
        for (Locacao locacao : contrato.getListaLocacao()) {
            Veiculo veiculo = veiculoRepository.findByIdParaAtualizacao(locacao.getVeiculo().getId())
                    .orElseThrow(() -> RegraNegocioException.naoEncontrado("Veículo não encontrado."));

            if (dados.getKmAtual() != null) {
                if (veiculo.getKm() != null && dados.getKmAtual() < veiculo.getKm()) {
                    throw RegraNegocioException.invalido("KM de devolução menor que o KM atual do veículo " + veiculo.getPlaca() + ".");
                }
                veiculo.setKm(dados.getKmAtual());
            }

            if (dados.isTemAvaria()) {
                veiculo.setStatus(StatusVeiculo.MANUTENCAO);
                Ocorrencia ocorrencia = new Ocorrencia();
                ocorrencia.setDescricao("Avaria na devolução: " + (dados.getObsAvaria() == null ? "" : dados.getObsAvaria()));
                ocorrencia.setLocacao(locacao);
                locacao.getListaOcorrencias().add(ocorrencia);
            } else {
                veiculo.setStatus(StatusVeiculo.DISPONIVEL);
            }
        }

        Pagamento pagamento = new Pagamento();
        pagamento.setContrato(contrato);
        pagamento.setTipoPagamento(dados.getTipoPagamento());
        pagamento.setValorTotal(valorFinal);
        contrato.setPagamento(pagamento); // lado inverso também, para o JSON de resposta já trazer o pagamento

        contrato.setStatus(StatusContrato.FECHADO);
        contrato.setValorTotal(valorFinal);
        return contratoRepository.save(contrato);
    }

    // Excluir um contrato aberto libera os veículos (antes o front chamava
    // DELETE /contratos/{id}, mas o endpoint não existia).
    @Transactional
    public void excluir(Long id) {
        ContratoLocacao contrato = contratoRepository.findByIdParaAtualizacao(id)
                .orElseThrow(() -> RegraNegocioException.naoEncontrado("Contrato não encontrado."));
        if (contrato.getStatus() == StatusContrato.ABERTO) {
            for (Locacao locacao : contrato.getListaLocacao()) {
                veiculoRepository.findByIdParaAtualizacao(locacao.getVeiculo().getId())
                        .ifPresent(v -> v.setStatus(StatusVeiculo.DISPONIVEL));
            }
        }
        contratoRepository.delete(contrato);
    }

    private static Long idObrigatorio(Long id, String campo) {
        if (id == null) throw RegraNegocioException.invalido("Informe o " + campo + ".");
        return id;
    }
}
