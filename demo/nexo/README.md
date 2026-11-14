# NEXO: Gestão de Operações de Campo (DEMO)

Versão de demonstração, para portfólio. O cenário é fictício: a
*Meridiano Gestão de Fornecedores* acompanha a requalificação anual de uma
carteira de fornecedores (categorias CRI, EST e OPE). Empresas, pessoas,
endereços e documentos são inventados.

## Como abrir

Sirva a pasta do portfólio por HTTP (ex.: `python3 -m http.server`) e abra
`demo/nexo/index.html`. No primeiro acesso, `js/demo_mode.js`:

1. cria/desbloqueia o cofre cifrado com uma senha fixa de demonstração
   (a criptografia AES-256-GCM + Argon2id continua ativa);
2. carrega a Base Mock (160 empresas fictícias) e a identidade da unidade;
3. desliga o bloqueio por inatividade e mostra a faixa "ambiente de demonstração".

## Arquitetura (resumo)

- **100% client-side / offline-first / zero-API**: nenhum dado sai do navegador.
- **Sem bundler**: cada módulo é um global carregado por `<script>`; a ordem é parte do contrato.
- **Camadas**: arquivo (`FileProcessor`) → persistência cifrada (`StorageManager`/`CryptoManager`)
  → negócio (`MotorRegras`) → motores (`PdfEngine`/`DocumentosNexo`, `MapEngine`/`GeoCore`, `CruzEngine`) → UI.
- **Bibliotecas internalizadas** em `vendor/` (pako, Chart.js, jsPDF, JSZip, hash-wasm, Shepherd, Font Awesome, Inter).

| Pasta | Conteúdo |
|---|---|
| `*.html` | Início, Sincronização, Controle, Dashboard, Planejamento, Configurações |
| `js/importacao/` | Importação, persistência cifrada, privacidade e base mock |
| `js/contatos/` | Cruzamento de contatos (agrupamento por representante) |
| `js/documentos.js` | Gerador dos documentos (convite, lembrete, comunicado, recibo, termo) |
| `js/ocorrencias.js` | Catálogo de ocorrências (baixa, movimento e pendência) |
| `js/geo_core.js`, `js/map_engine.js` | Normalização de endereços, geocodificação offline e KML (a versão mantida do motor é o [Candeia](https://github.com/LucasRikelmi/candeia)) |
