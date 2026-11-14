package org.locadora.locadora_api.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

// Converte exceções em respostas JSON { "erro": "..." } com o status correto.
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(RegraNegocioException.class)
    public ResponseEntity<Map<String, String>> regraNegocio(RegraNegocioException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("erro", e.getMessage()));
    }

    // Duas requisições alteraram o mesmo registro ao mesmo tempo (@Version ou
    // timeout de lock): a que perdeu recebe 409 e pode tentar de novo.
    @ExceptionHandler({OptimisticLockingFailureException.class, PessimisticLockingFailureException.class})
    public ResponseEntity<Map<String, String>> concorrencia(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("erro", "O registro foi alterado por outra operação. Atualize a tela e tente novamente."));
    }

    // Ex.: excluir uma marca que ainda tem modelos/veículos vinculados.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> integridade(DataIntegrityViolationException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("erro", "Registro em uso por outros cadastros; não pode ser alterado/excluído."));
    }
}
