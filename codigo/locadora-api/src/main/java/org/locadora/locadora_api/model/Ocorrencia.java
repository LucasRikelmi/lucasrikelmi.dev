package org.locadora.locadora_api.model;

import java.math.BigDecimal;import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Ocorrencia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // Diagrama não tem ID, mas o Hibernate EXIGE @Id
    private String descricao;
    @Column(precision = 12, scale = 2)
    private BigDecimal valor;

    @ManyToOne
    @JoinColumn(name = "id_locacao")
    @JsonIgnore
    private Locacao locacao;

    // Gere Getters e Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }

    public Locacao getLocacao() {
        return locacao;
    }

    public void setLocacao(Locacao locacao) {
        this.locacao = locacao;
    }
}