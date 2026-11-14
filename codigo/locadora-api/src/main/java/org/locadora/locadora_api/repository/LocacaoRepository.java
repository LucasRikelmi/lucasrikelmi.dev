package org.locadora.locadora_api.repository;

import org.locadora.locadora_api.model.Locacao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LocacaoRepository extends JpaRepository<Locacao, Long> {

    boolean existsByVeiculoId(Long veiculoId);
}
