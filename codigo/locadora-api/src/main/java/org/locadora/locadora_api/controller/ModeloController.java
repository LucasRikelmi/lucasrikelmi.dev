package org.locadora.locadora_api.controller;

import org.locadora.locadora_api.model.Modelo;
import org.locadora.locadora_api.repository.ModeloRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/modelos")
@CrossOrigin(origins = "*")
public class ModeloController {

    @Autowired
    private ModeloRepository repository;

    @GetMapping
    public List<Modelo> listar() {
        return repository.findAll();
    }

    @PostMapping
    public Modelo salvar(@RequestBody Modelo modelo) {
        return repository.save(modelo);
    }

    @DeleteMapping("/{id}")
    public void deletar(@PathVariable Long id) {
        repository.deleteById(id);
    }
}