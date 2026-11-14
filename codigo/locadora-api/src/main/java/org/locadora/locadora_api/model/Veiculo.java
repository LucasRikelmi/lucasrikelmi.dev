package org.locadora.locadora_api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.ArrayList;
import java.util.List;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Veiculo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String placa;
    private String cor;
    private String chassi;
    private String renavam;
    private Integer km;

    @Enumerated(EnumType.STRING)
    private StatusVeiculo status;

    // Trava otimista: se duas transações alterarem o mesmo veículo ao mesmo
    // tempo, a segunda falha em vez de sobrescrever a primeira.
    @Version
    @JsonIgnore
    private Long versao;

    // O Veículo aponta para o Modelo (que aponta para a Categoria)
    @ManyToOne
    @JoinColumn(name = "id_modelo")
    private Modelo modelo;

    // Sem cascade: excluir um veículo não pode apagar o histórico de locações
    // (a exclusão é bloqueada no controller quando há histórico).
    @OneToMany(mappedBy = "veiculo")
    @JsonIgnore // evita o loop infinito Veiculo -> Locacao -> Veiculo
    private List<Locacao> locacoes = new ArrayList<>();

    //Manutenções (Se houver a classe Manutencao criada)
    @OneToMany(mappedBy = "veiculo", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Manutencao> manutencoes = new ArrayList<>();

    // --- Getters e Setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPlaca() { return placa; }
    public void setPlaca(String placa) { this.placa = placa; }

    public String getCor() { return cor; }
    public void setCor(String cor) { this.cor = cor; }

    public String getChassi() { return chassi; }
    public void setChassi(String chassi) { this.chassi = chassi; }

    public String getRenavam() { return renavam; }
    public void setRenavam(String renavam) { this.renavam = renavam; }

    public Integer getKm() { return km; }
    public void setKm(Integer km) { this.km = km; }

    public StatusVeiculo getStatus() { return status; }
    public void setStatus(StatusVeiculo status) { this.status = status; }

    public Modelo getModelo() { return modelo; }
    public void setModelo(Modelo modelo) { this.modelo = modelo; }

    public List<Locacao> getLocacoes() { return locacoes; }
    public void setLocacoes(List<Locacao> locacoes) { this.locacoes = locacoes; }
}