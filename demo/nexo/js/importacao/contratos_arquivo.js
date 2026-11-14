const ContratosArquivo = {
  Empresas:         { rotulo: "Base de Empresas",                exigeLinhas: true  },
  Ocs:              { rotulo: "Relatório de OCs",                exigeLinhas: false },
  OcsTransferencia: { rotulo: "Transferências entre Unidades",   exigeLinhas: false },
  EmpresasRede: { rotulo: "Base de Empresas da Rede",       exigeLinhas: true  },
  Coordenadas:      { rotulo: "Localizações Confirmadas",        exigeLinhas: false },
  Contatos:         { rotulo: "Contatos das Empresas",           exigeLinhas: true  },
  Emails:           { rotulo: "Histórico de E-mails",            exigeLinhas: false },
};

Object.entries(ContratosArquivo).forEach(([tipo, c]) => {
  c.chaveStorage   = `nexo_csv_${tipo}`;
  c.chaveTimestamp = `nexo_ts_${tipo}`;
  c.extensao       = "csv";
  c.nomeRegex      = null;
  c.cabecalhos     = [];
});
