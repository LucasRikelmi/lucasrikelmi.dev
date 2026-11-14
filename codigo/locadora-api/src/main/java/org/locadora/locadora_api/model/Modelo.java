package org.locadora.locadora_api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Modelo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nome;
    private Integer ano;

    @Column(name = "qt_modelo")
    private Integer qtModelo;

    // --- RELAÇÃO COM MARCA (O que faltava) ---
    @ManyToOne
    @JoinColumn(name = "id_marca") // Nome da coluna no banco
    private Marca marca;
    // ----------------------------------------

    // Relação com Categoria (Para o preço)
    @ManyToOne
    @JoinColumn(name = "id_categoria")
    private Categoria categoria;

    // Um modelo tem vários veículos físicos
    @OneToMany(mappedBy = "modelo")
    @JsonIgnore
    private List<Veiculo> listaVeiculos;

    // --- Getters e Setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }

    public Integer getAno() { return ano; }
    public void setAno(Integer ano) { this.ano = ano; }

    public Integer getQtModelo() { return qtModelo; }
    public void setQtModelo(Integer qtModelo) { this.qtModelo = qtModelo; }

    // --- GETTER E SETTER DA MARCA (O erro vai sumir agora) ---
    public Marca getMarca() { return marca; }
    public void setMarca(Marca marca) { this.marca = marca; }

    public Categoria getCategoria() { return categoria; }
    public void setCategoria(Categoria categoria) { this.categoria = categoria; }

    public List<Veiculo> getListaVeiculos() { return listaVeiculos; }
    public void setListaVeiculos(List<Veiculo> listaVeiculos) { this.listaVeiculos = listaVeiculos; }
}