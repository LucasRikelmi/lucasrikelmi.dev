package org.locadora.locadora_api.exception;

import org.springframework.http.HttpStatus;

// Erro de regra de negócio com o status HTTP que o cliente deve receber
// (antes tudo era RuntimeException e virava 500).
public class RegraNegocioException extends RuntimeException {

    private final HttpStatus status;

    public RegraNegocioException(HttpStatus status, String mensagem) {
        super(mensagem);
        this.status = status;
    }

    public static RegraNegocioException naoEncontrado(String mensagem) {
        return new RegraNegocioException(HttpStatus.NOT_FOUND, mensagem);
    }

    public static RegraNegocioException conflito(String mensagem) {
        return new RegraNegocioException(HttpStatus.CONFLICT, mensagem);
    }

    public static RegraNegocioException invalido(String mensagem) {
        return new RegraNegocioException(HttpStatus.BAD_REQUEST, mensagem);
    }

    public HttpStatus getStatus() {
        return status;
    }
}
