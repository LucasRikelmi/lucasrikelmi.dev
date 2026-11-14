package org.locadora.locadora_api.repository;

import jakarta.persistence.LockModeType;
import org.locadora.locadora_api.model.Veiculo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VeiculoRepository extends JpaRepository<Veiculo, Long> {

    // SELECT ... FOR UPDATE: a segunda transação que tentar alugar o mesmo
    // veículo espera a primeira terminar e então já enxerga o status ALUGADO.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from Veiculo v where v.id = :id")
    Optional<Veiculo> findByIdParaAtualizacao(@Param("id") Long id);
}
