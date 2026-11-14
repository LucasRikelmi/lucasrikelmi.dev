package org.locadora.locadora_api.model;
import jakarta.persistence.*;

@Entity
public class Cliente {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nome;
    private String cnh;
    private String cpf;

    // O diagrama liga Cliente a Contato (Agregação vazada)
    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_contato")
    private Contato contato; // Assumindo que cliente tem contato direto ou herda de pessoa

    // Na classe Cliente (opcional, se quiser adicionar endereço)
    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_endereco")
    private Endereco endereco;



    // --- CONSTRUTORES ---
    public Cliente() {}
    public Cliente(String nome, String cnh) {
        this.nome = nome;
        this.cnh = cnh;
    }

    // Gere Getters e Setters


    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

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

    public String getCnh() {
        return cnh;
    }

    public void setCnh(String cnh) {
        this.cnh = cnh;
    }

    public Contato getContato() {
        return contato;
    }

    public void setContato(Contato contato) {
        this.contato = contato;
    }

    public Endereco getEndereco() {
        return endereco;
    }

    public void setEndereco(Endereco endereco) {
        this.endereco = endereco;
    }
}
