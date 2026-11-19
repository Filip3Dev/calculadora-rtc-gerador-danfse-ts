# DANFSe Service (TypeScript)

Porte **TypeScript** do [Gerador de DANFSe](https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse) da Receita Federal (original em **Go**) — serviço HTTP que gera o **DANFSe em PDF** (Documento Auxiliar da NFS-e Nacional, padrão Sped/nfse.gov.br) a partir do XML da nota.

> [!NOTE]
> Paridade **visual/estrutural** com o serviço oficial: mesmo contrato HTTP (rota, parâmetros, mensagens de erro, headers), mesmo conteúdo de texto e mesma geometria do PDF — verificada por **golden tests** que extraem o texto dos PDFs de referência gerados pelo binário oficial Go eComparam linha a linha, mais asserts geométricos (âncoras de seção, canhoto, limites), replicando a estratégia dos próprios testes do Go (poppler).

## Como rodar

```bash
pnpm install
pnpm build        # core (com assets) + api

# API (NestJS) — http://localhost:8080/api/danfse · Swagger: /api/swagger-ui/
pnpm dev:api

# Playground (Vite + React) — http://localhost:5175
pnpm dev:web

# Testes: 7 golden visual (Go×TS) + 11 e2e de contrato
pnpm test
```

> A porta 8080 é a mesma do serviço original (`SERVER_PORT`). Se o porte
> regime-regular estiver rodando localmente na 8080, defina `SERVER_PORT` para
> um porto livre.

Requisitos: Node ≥ 22, pnpm ≥ 10.

## Contrato

| Rota | Descrição |
|---|---|
| `POST /api/danfse?stc=0&canhoto=true` | XML da NFS-e (body bruto) → **PDF** (`application/pdf`, `Content-Disposition: attachment; filename="danfse.pdf"`). `stc`: 0 válida / 1 substituída / 2 cancelada (marca d'água). `canhoto`: exibir recibo (default true). |
| `GET /health/live` · `GET /health/ready` | `{"status":"ok"}` (503 unavailable durante o shutdown). |
| `GET /api/swagger-ui/` | Swagger UI. |

Erros (4xx): `{"sucesso":false,"mensagem":"..."}` — mensagens exatas do original (`"Xml não informado."`, `"parâmetro stc inválido: deve ser 0, 1 ou 2"`, `"parâmetro canhoto inválido: deve ser true ou false"`, `"XML root element is \"X\", expected NFSe"`, `"infNFSe Id is empty"`, `"XML contains DTD or entity declaration"`). 5xx sempre genérico. `X-Request-ID` sempre gerado pelo servidor (o do cliente é descartado). Limite do XML: 5 MiB (`XML_MAX_SIZE_BYTES`, teto 32 MiB).

Exemplos com payloads e respostas: [docs/exemplos.md](docs/exemplos.md)

## Arquitetura

```
packages/core          @danfse/core — sem I/O além do logo:
  ├─ service/preparacao    parse XML (semântica encoding/xml), segurança (XXE/DOCTYPE,
  │                        sanitização &), QR nfse.gov.br, enriquecimento IBGE, NT-008
  ├─ service/presenter     modelo → documento (tabelas de enums, máscaras, supressões)
  ├─ renderer/renderer     PDF pdf-lib fiel (A4, grid 4 colunas, 12 seções com âncoras
  │                        em cm, Helvetica standard-14, QR vetorial, marca d'água)
  └─ domain/localidades    catálogo IBGE embutido (28 UFs + 5.525 municípios)
apps/api               NestJS :8080 — rota /api/danfse, health, X-Request-ID, ErroResponse
apps/playground        Vite + React :5175 — XML → PDF no navegador
fixtures/              XMLs de teste + PDFs de referência gerados pelo oficial Go
```

**Referência viva**: os `fixtures/*.pdf` foram gerados pelo binário oficial Go (Docker) com os mesmos XMLs — o golden compara o texto do PDF TS com eles linha a linha.

### Paridades deliberadas (marcadas `// PARITY:` no código)

- Erros 4xx ecoam `err.Error()` do serviço (inclusive em inglês) — como o original (a classificação fina 4xx/5xx é follow-up declarado no README oficial);
- PIS/COFINS exibidos apenas para competência ≤ 2026-12-31; `tpRetPisCofins=1` → próprios `R$ 0,00` (NT-008 §2.4.5);
- Destinatário suprimido quando é o próprio tomador; tributação municipal suprimida quando vazia;
- Truncamentos com reticências preservando a linha de totais (Lei 12.741/2012) — NT-008.

## Deploy (Cloudflare)

Worker `danfse-service` (`deploy/edge/`): playground como Static Assets + API em Cloudflare Container (imagem = Dockerfile da raiz; logo e fontes embarcadas). Domínio: **danfse.bitpag.xyz**.

```bash
# requer Docker Desktop aberto
pnpm deploy:cloudflare
```

> Wrangler pinado em `4.136.1` (linha 4.165+ falha `Unauthorized` no push de imagem — ver CHANGELOG dos projetos irmãos).



## Pacote npm

O motor também é distribuído como pacote npm pronto para uso (**sem servidor**), com banco de dados embutido e CLI:

```bash
npm i danfse-core
npx danfse-core --help   # CLI do pacote
```

Detalhes e exemplos: [README do pacote](packages/core/README.md) · [npmjs.com/package/danfse-core](https://www.npmjs.com/package/danfse-core)

## Upstream tracking

O workflow [Upstream Tracking](.github/workflows/upstream-tracking.yml) roda diariamente (09:00 BRT) e vigia os repositórios oficiais da Receita Federal: quando há movimento (tag/commits/migrações Flyway novas), abre uma issue (label `upstream`) com o diff e os passos de sincronização — e, quando há migrações novas, um **PR automático** com os SQLs para o CI validar (banco + golden). O estado da última sincronização vive em `.upstream/state.json`; o probe do piloto oficial (nuvem) também reporta dados ainda não publicados no GitHub.

## Licença

[MIT](LICENSE) — mantém o crédito ao projeto original (SERPRO/Receita Federal do Brasil).
