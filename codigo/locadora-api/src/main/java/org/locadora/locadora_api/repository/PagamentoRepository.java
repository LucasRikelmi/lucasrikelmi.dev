package org.locadora.locadora_api.repository;

import org.locadora.locadora_api.model.Pagamento;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PagamentoRepository extends JpaRepository<Pagamento, Long> {
}