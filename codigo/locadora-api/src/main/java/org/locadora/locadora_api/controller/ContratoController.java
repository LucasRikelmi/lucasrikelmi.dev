package org.locadora.locadora_api.controller;

import org.locadora.locadora_api.model.ContratoLocacao;
import org.locadora.locadora_api.model.DadosDevolucao;
import org.locadora.locadora_api.repository.ContratoRepository;
import org.locadora.locadora_api.service.ContratoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/contratos")
@CrossOrigin(origins = "*")
public class ContratoController {

    private final ContratoRepository contratoRepository;
    private final ContratoService contratoService;

    public ContratoController(ContratoRepository contratoRepository, ContratoService contratoService) {
        this.contratoRepository = contratoRepository;
        this.contratoService = contratoService;
    }

    @GetMapping
    public List<ContratoLocacao> listar() {
        return contratoRepository.findAll();
    }

    // Abre o contrato: valida disponibilidade (com trava), calcula o preço e marca os veículos como ALUGADO.
    @PostMapping
    public ResponseEntity<ContratoLocacao> abrir(@RequestBody ContratoLocacao contrato) {
        return ResponseEntity.ok(contratoService.abrir(contrato));
    }

    // Devolução: KM, avarias, pagamento e fechamento do contrato.
    @PutMapping("/{id}/encerrar")
    public ResponseEntity<ContratoLocacao> encerrar(@PathVariable Long id, @RequestBody DadosDevolucao dados) {
        return ResponseEntity.ok(contratoService.encerrar(id, dados));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        contratoService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
