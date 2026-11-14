# lucasrikelmi.dev

Portfólio de **Lucas Rikelmi**, publicado em [lucasrikelmi.dev](https://lucasrikelmi.dev).
Site estático (HTML, CSS e JS puros), sem build e sem dependências de CDN: fontes e bibliotecas são servidas pelo próprio site.

## Conteúdo

| Caminho | O que é |
|---|---|
| `index.html` | Página do portfólio |
| `assets/css/base.css` | Tokens de cor (claro/escuro), tipografia em `rem`, seletor de tema e efeitos compartilhados |
| `assets/js/site.js` | Tema (sistema / claro / escuro), menu mobile, holofote no hover e revelação ao rolar |
| `assets/js/geo-playground.js` | Playground que roda o `demo/nexo/js/geo_core.js` sobre a cidade fictícia de `assets/js/geo-town.js` |
| `demo/nexo/` | **NEXO**: demo navegável de um sistema de gestão de operações de campo (100% no navegador, dados cifrados, PDFs, mapas KML). Dados fictícios. |
| `demo/locadora/` | **Locadora**: front-end do projeto Java com a API Spring simulada no navegador, incluindo o teste de concorrência. |
| `codigo/locadora-api/` | Código-fonte da API (Java 17, Spring Boot 3, JPA, PostgreSQL, testes com JUnit 5 + H2). |
| `lab/cpu/` | **Simulador RV32**: CPU, cache L1, barramento, DMA e interrupções ciclo a ciclo. Núcleo em `js/core/` (sem DOM), interface em `js/ui/`. |

## Rodar localmente

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`. As demos e o simulador usam módulos ES e precisam ser servidos por HTTP.

## Testes

```bash
# Simulador (Node 20+)
node --test lab/cpu/tests/

# API Java
cd codigo/locadora-api
./mvnw test
```

Para rodar a API contra o PostgreSQL local, defina a senha por variável de ambiente (ela não fica mais no repositório):

```bash
DB_PASSWORD=sua-senha ./mvnw spring-boot:run   # DB_URL e DB_USER também podem ser sobrescritos
```

Os valores monetários passaram de `float` para `BigDecimal` (`numeric(12,2)`). Num banco criado antes dessa mudança, o `ddl-auto=update` do Hibernate não altera o tipo das colunas existentes; recrie o banco de desenvolvimento ou rode um `ALTER TABLE ... TYPE numeric(12,2)` nas colunas de valor.
