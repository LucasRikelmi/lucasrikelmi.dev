package org.locadora.locadora_api.controller;

import org.locadora.locadora_api.exception.RegraNegocioException;
import org.locadora.locadora_api.model.StatusVeiculo;
import org.locadora.locadora_api.model.Veiculo;
import org.locadora.locadora_api.repository.LocacaoRepository;
import org.locadora.locadora_api.repository.ModeloRepository;
import org.locadora.locadora_api.repository.VeiculoRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/veiculos")
@CrossOrigin(origins = "*")
public class VeiculoController {

    private final VeiculoRepository repository;
    private final LocacaoRepository locacaoRepository;
    private final ModeloRepository modeloRepository;

    public VeiculoController(VeiculoRepository repository, LocacaoRepository locacaoRepository,
                             ModeloRepository modeloRepository) {
        this.repository = repository;
        this.locacaoRepository = locacaoRepository;
        this.modeloRepository = modeloRepository;
    }

    @GetMapping
    public List<Veiculo> listar() {
        return repository.findAll();
    }

    @GetMapping("/{id}")
    public Veiculo buscarPorId(@PathVariable Long id) {
        return repository.findById(id)
                .orElseThrow(() -> RegraNegocioException.naoEncontrado("Veículo não encontrado."));
    }

    // Cadastro/edição. O status NÃO vem do formulário: ele é controlado pelo
    // fluxo de contratos (antes, editar um carro alugado o "liberava").
    @PostMapping
    @Transactional
    public Veiculo salvar(@RequestBody Veiculo dados) {
        if (dados.getModelo() == null || dados.getModelo().getId() == null) {
            throw RegraNegocioException.invalido("Selecione o modelo do veículo.");
        }
        dados.setModelo(modeloRepository.findById(dados.getModelo().getId())
                .orElseThrow(() -> RegraNegocioException.naoEncontrado("Modelo não encontrado.")));
        if (dados.getId() == null) {
            dados.setStatus(StatusVeiculo.DISPONIVEL);
            return repository.save(dados);
        }
        Veiculo atual = repository.findByIdParaAtualizacao(dados.getId())
                .orElseThrow(() -> RegraNegocioException.naoEncontrado("Veículo não encontrado."));
        atual.setPlaca(dados.getPlaca());
        atual.setCor(dados.getCor());
        atual.setChassi(dados.getChassi());
        atual.setRenavam(dados.getRenavam());
        atual.setModelo(dados.getModelo());
        if (dados.getKm() != null) {
            if (atual.getKm() != null && dados.getKm() < atual.getKm()) {
                throw RegraNegocioException.invalido("A quilometragem não pode diminuir.");
            }
            atual.setKm(dados.getKm());
        }
        return atual;
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        Veiculo veiculo = repository.findByIdParaAtualizacao(id)
                .orElseThrow(() -> RegraNegocioException.naoEncontrado("Veículo não encontrado."));
        if (locacaoRepository.existsByVeiculoId(id)) {
            throw RegraNegocioException.conflito("Veículo com histórico de locações não pode ser excluído.");
        }
        repository.delete(veiculo);
        return ResponseEntity.noContent().build();
    }
}
