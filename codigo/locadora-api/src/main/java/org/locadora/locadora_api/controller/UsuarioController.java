package org.locadora.locadora_api.controller;

import org.locadora.locadora_api.exception.RegraNegocioException;
import org.locadora.locadora_api.model.Usuario;
import org.locadora.locadora_api.repository.UsuarioRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/usuarios")
@CrossOrigin(origins = "*")
public class UsuarioController {

    static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder();

    private final UsuarioRepository repository;

    public UsuarioController(UsuarioRepository repository) {
        this.repository = repository;
    }

    // A senha é WRITE_ONLY no JSON: esta listagem não a expõe.
    @GetMapping
    public List<Usuario> listar() {
        return repository.findAll();
    }

    @PostMapping
    @Transactional
    public Usuario salvar(@RequestBody Usuario usuario) {
        repository.findByLogin(usuario.getLogin())
                .filter(outro -> !outro.getId().equals(usuario.getId()))
                .ifPresent(outro -> { throw RegraNegocioException.conflito("Login já está em uso."); });

        boolean senhaVazia = usuario.getSenha() == null || usuario.getSenha().isBlank();
        if (usuario.getId() != null && senhaVazia) {
            // Edição sem nova senha: mantém a atual (antes era sobrescrita com null).
            Usuario atual = repository.findById(usuario.getId())
                    .orElseThrow(() -> RegraNegocioException.naoEncontrado("Usuário não encontrado."));
            usuario.setSenha(atual.getSenha());
        } else if (senhaVazia) {
            throw RegraNegocioException.invalido("Informe uma senha.");
        } else {
            usuario.setSenha(BCRYPT.encode(usuario.getSenha()));
        }
        return repository.save(usuario);
    }

    @DeleteMapping("/{id}")
    public void deletar(@PathVariable Long id) {
        repository.deleteById(id);
    }
}
