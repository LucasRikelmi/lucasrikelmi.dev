package org.locadora.locadora_api.model;

import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Categoria {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nome;

    // No diagrama está "valorLocacao", mas no Java chamamos de valorDiaria para não confundir
    // com o valor total da locação. Mapeamos para a coluna certa no banco.
    @Column(precision = 12, scale = 2, name = "valor_diaria")
    @JsonProperty("valorLocacao")
    private BigDecimal valorDiaria;

    // Relacionamento com Modelo (Uma Categoria tem vários Modelos)
    @OneToMany(mappedBy = "categoria")
    @JsonIgnore
    private List<Modelo> listaModelos;

    // --- Getters e Setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }

    public BigDecimal getValorDiaria() { return valorDiaria; }
    public void setValorDiaria(BigDecimal valorDiaria) { this.valorDiaria = valorDiaria; }

    public List<Modelo> getListaModelos() { return listaModelos; }
    public void setListaModelos(List<Modelo> listaModelos) { this.listaModelos = listaModelos; }
}