package org.locadora.locadora_api.controller;

import org.locadora.locadora_api.model.Cliente;
import org.locadora.locadora_api.repository.ClienteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/clientes")
@CrossOrigin(origins = "*") // Permite acesso do nosso frontend
public class ClienteController {

    @Autowired
    private ClienteRepository repository;

    @GetMapping
    public List<Cliente> listar() {
        return repository.findAll();
    }

    @PostMapping
    public Cliente salvar(@RequestBody Cliente cliente) {
        // Observação: Para salvar um Cliente que contém Endereco e Contato (OneToOne),
        // você precisa garantir que essas sub-entidades não estejam nulas
        // ou o CascadeType esteja configurado corretamente no Cliente.java.

        return repository.save(cliente);
    }

    @DeleteMapping("/{id}")
    public void deletar(@PathVariable Long id) {
        repository.deleteById(id);
    }
}