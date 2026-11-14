package org.locadora.locadora_api.controller;

import org.locadora.locadora_api.model.Marca;
import org.locadora.locadora_api.repository.MarcaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/marcas")
@CrossOrigin(origins = "*")
public class MarcaController {

    @Autowired
    private MarcaRepository repository;

    @GetMapping
    public List<Marca> listar() {
        return repository.findAll();
    }

    @PostMapping
    public Marca salvar(@RequestBody Marca marca) {
        return repository.save(marca);
    }

    @DeleteMapping("/{id}")
    public void deletar(@PathVariable Long id) {
        repository.deleteById(id);
    }
}