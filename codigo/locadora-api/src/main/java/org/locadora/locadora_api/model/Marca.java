package org.locadora.locadora_api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.ArrayList;
import java.util.List;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Marca {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nome;

    // Composição: Se apagar marca, apaga modelos
    @OneToMany(mappedBy = "marca", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Modelo> listModelo = new ArrayList<>(); // <-- Garanta que tem o new ArrayList<>();

    // --- CONSTRUTORES ---
    public Marca() {} // Obrigatório para o Hibernate
    public Marca(String nome) { this.nome = nome; } // Usado no App.java

    // --- METODO AUXILIAR (Helper) ---
    public void addModelo(Modelo modelo) {
        listModelo.add(modelo);
        modelo.setMarca(this);
    }


    // Gere Getters e Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public List<Modelo> getListModelo() {
        return listModelo;
    }

    public void setListModelo(List<Modelo> listModelo) {
        this.listModelo = listModelo;
    }
}