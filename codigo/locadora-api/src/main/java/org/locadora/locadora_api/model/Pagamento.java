package org.locadora.locadora_api.model;

import java.math.BigDecimal;import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
public class Pagamento {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(precision = 12, scale = 2)
    private BigDecimal valorTotal; // <--- O App usa isso

    @Enumerated(EnumType.STRING)
    private TipoPagamento tipoPagamento; // <--- O App vai usar isso

    // Relacionamento com o Contrato
    @OneToOne
    @JoinColumn(name = "id_contrato")
    @JsonIgnore // <--- ADICIONE ESTA LINHA
    private ContratoLocacao contrato;

    // --- CONSTRUTORES ---
    public Pagamento() {}

    // --- GETTERS E SETTERS OBRIGATÓRIOS ---

    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
    }

    public BigDecimal getValorTotal() {
        return valorTotal;
    }
    public void setValorTotal(BigDecimal valorTotal) {
        this.valorTotal = valorTotal;
    }

    public TipoPagamento getTipoPagamento() {
        return tipoPagamento;
    }
    public void setTipoPagamento(TipoPagamento tipoPagamento) {
        this.tipoPagamento = tipoPagamento;
    }

    public ContratoLocacao getContrato() {
        return contrato;
    }
    public void setContrato(ContratoLocacao contrato) {
        this.contrato = contrato;
    }
}