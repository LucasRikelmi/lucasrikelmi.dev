package org.locadora.locadora_api.model;

import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Locacao {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime dataRetirada;
    private LocalDateTime dataDevolucao;

    @Column(precision = 12, scale = 2, name = "valor_locacao", nullable = false)
    @JsonProperty("valorLocacao")
    private BigDecimal valorLocacao; // Float wrapper

    @ManyToOne
    @JoinColumn(name = "id_veiculo")
    private Veiculo veiculo;

    @ManyToOne
    @JoinColumn(name = "id_contrato")
    @JsonIgnore
    private ContratoLocacao contrato;

    // Se tiver Cliente direto na locação conforme seu código anterior (embora o diagrama ligue cliente ao contrato)
    @ManyToOne
    @JoinColumn(name = "id_cliente")
    private Cliente cliente;

    // Se tiver Ocorrencias
    @OneToMany(mappedBy = "locacao", cascade = CascadeType.ALL)
    private List<Ocorrencia> listaOcorrencias = new ArrayList<>();

    // --- Getters e Setters ---
    public void setValorLocacao(BigDecimal valorLocacao) { this.valorLocacao = valorLocacao; }
    public BigDecimal getValorLocacao() { return valorLocacao; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getDataRetirada() { return dataRetirada; }
    public void setDataRetirada(LocalDateTime dataRetirada) { this.dataRetirada = dataRetirada; }

    public LocalDateTime getDataDevolucao() { return dataDevolucao; }
    public void setDataDevolucao(LocalDateTime dataDevolucao) { this.dataDevolucao = dataDevolucao; }

    public Veiculo getVeiculo() { return veiculo; }
    public void setVeiculo(Veiculo veiculo) { this.veiculo = veiculo; }

    public ContratoLocacao getContrato() { return contrato; }
    public void setContrato(ContratoLocacao contrato) { this.contrato = contrato; }

    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }

    public List<Ocorrencia> getListaOcorrencias() { return listaOcorrencias; }
    public void setListaOcorrencias(List<Ocorrencia> listaOcorrencias) { this.listaOcorrencias = listaOcorrencias; }
}