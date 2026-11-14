package org.locadora.locadora_api.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class DadosDevolucao {
    private LocalDateTime dataDevolucaoReal;
    private Integer kmAtual;
    private boolean temAvaria;
    private String obsAvaria;
    private BigDecimal valorTotalFinal;
    private TipoPagamento tipoPagamento;

    // Getters e Setters
    public LocalDateTime getDataDevolucaoReal() { return dataDevolucaoReal; }
    public void setDataDevolucaoReal(LocalDateTime dataDevolucaoReal) { this.dataDevolucaoReal = dataDevolucaoReal; }
    public Integer getKmAtual() { return kmAtual; }
    public void setKmAtual(Integer kmAtual) { this.kmAtual = kmAtual; }
    public boolean isTemAvaria() { return temAvaria; }
    public void setTemAvaria(boolean temAvaria) { this.temAvaria = temAvaria; }
    public String getObsAvaria() { return obsAvaria; }
    public void setObsAvaria(String obsAvaria) { this.obsAvaria = obsAvaria; }
    public BigDecimal getValorTotalFinal() { return valorTotalFinal; }
    public void setValorTotalFinal(BigDecimal valorTotalFinal) { this.valorTotalFinal = valorTotalFinal; }
    public TipoPagamento getTipoPagamento() { return tipoPagamento; }
    public void setTipoPagamento(TipoPagamento tipoPagamento) { this.tipoPagamento = tipoPagamento; }
}