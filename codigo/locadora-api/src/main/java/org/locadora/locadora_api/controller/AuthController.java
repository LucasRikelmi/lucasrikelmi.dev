package org.locadora.locadora_api.controller;

import org.locadora.locadora_api.exception.RegraNegocioException;
import org.locadora.locadora_api.model.Usuario;
import org.locadora.locadora_api.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

// Login no servidor. Antes o front baixava GET /usuarios (com as senhas) e
// comparava no navegador, além de ter uma credencial mestra fixa no HTML.
@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    public record Credenciais(String login, String senha) {}

    private final UsuarioRepository repository;

    public AuthController(UsuarioRepository repository) {
        this.repository = repository;
    }

    @PostMapping("/login")
    @Transactional
    public Usuario login(@RequestBody Credenciais credenciais) {
        Usuario usuario = repository.findByLogin(credenciais.login())
                .filter(u -> senhaConfere(u, credenciais.senha()))
                .orElseThrow(() -> new RegraNegocioException(HttpStatus.UNAUTHORIZED, "Usuário ou senha incorretos."));
        return usuario;
    }

    // Aceita senhas antigas em texto puro uma única vez e já as converte para BCrypt.
    private boolean senhaConfere(Usuario usuario, String senha) {
        String salva = usuario.getSenha();
        if (salva == null || senha == null) return false;
        if (salva.startsWith("$2")) return UsuarioController.BCRYPT.matches(senha, salva);
        if (!salva.equals(senha)) return false;
        usuario.setSenha(UsuarioController.BCRYPT.encode(senha));
        return true;
    }
}
