package org.locadora.locadora_api.repository;

import jakarta.persistence.LockModeType;
import org.locadora.locadora_api.model.ContratoLocacao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ContratoRepository extends JpaRepository<ContratoLocacao, Long> {

    // Trava o contrato durante a devolução: dois cliques em "encerrar" não
    // geram dois pagamentos.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratoLocacao c where c.id = :id")
    Optional<ContratoLocacao> findByIdParaAtualizacao(@Param("id") Long id);
}
