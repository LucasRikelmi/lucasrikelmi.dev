package org.locadora.locadora_api.model;

import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.time.LocalDate;
import java.util.List;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ContratoLocacao {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private LocalDate dataContrato;
    @Column(precision = 12, scale = 2)
    private BigDecimal valorCaucao;

    @Enumerated(EnumType.STRING)
    private StatusContrato status;

    // Trava otimista: impede duas devoluções simultâneas do mesmo contrato.
    @Version
    @JsonIgnore
    private Long versao;

    @Column(precision = 12, scale = 2)
    private BigDecimal valorTotal;

    @ManyToOne // Agregação (Diamante Branco)
    @JoinColumn(name = "id_funcionario")
    private Usuario funcionario;

    @ManyToOne // Agregação (Diamante Branco)
    @JoinColumn(name = "id_cliente")
    private Cliente cliente;

    @OneToMany(mappedBy = "contrato", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Locacao> listaLocacao = new ArrayList<>(); // <-- Aqui também

    // O diagrama mostra Pagamento ligado ao Contrato (Diamante preto no contrato)
    @OneToOne(mappedBy = "contrato", cascade = CascadeType.ALL)
    private Pagamento pagamento;

    // Gere Getters e Setters

    // --- MÉTODOS AUXILIARES ---
    public void addLocacao(Locacao l) {
        listaLocacao.add(l);
        l.setContrato(this);
    }


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getDataContrato() {
        return dataContrato;
    }

    public void setDataContrato(LocalDate dataContrato) {
        this.dataContrato = dataContrato;
    }

    public BigDecimal getValorCaucao() {
        return valorCaucao;
    }

    public void setValorCaucao(BigDecimal valorCaucao) {
        this.valorCaucao = valorCaucao;
    }

    public StatusContrato getStatus() {
        return status;
    }

    public void setStatus(StatusContrato status) {
        this.status = status;
    }

    public BigDecimal getValorTotal() {
        return valorTotal;
    }

    public void setValorTotal(BigDecimal valorTotal) {
        this.valorTotal = valorTotal;
    }

    public Usuario getFuncionario() {
        return funcionario;
    }

    public void setFuncionario(Usuario funcionario) {
        this.funcionario = funcionario;
    }

    public Cliente getCliente() {
        return cliente;
    }

    public void setCliente(Cliente cliente) {
        this.cliente = cliente;
    }

    public List<Locacao> getListaLocacao() {
        return listaLocacao;
    }

    public void setListaLocacao(List<Locacao> listaLocacao) {
        this.listaLocacao = listaLocacao;
    }

    public Pagamento getPagamento() {
        return pagamento;
    }

    public void setPagamento(Pagamento pagamento) {
        this.pagamento = pagamento;
    }
}
