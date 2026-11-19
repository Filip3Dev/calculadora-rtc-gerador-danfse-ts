# Changelog

Todas as mudanças notáveis serão documentadas aqui. Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.1] — 2026-11-19

### Adicionado

- **Upstream tracking**: workflow diário (09:00 BRT) vigia o repositório oficial Go (gerador-danfse) — movimento abre
  issue automática (label `upstream`) com diff e passos de sincronização — os passos cobrem portar labels/renderer e regenerar os PDFs de referência do golden visual.

## [0.1.0] — 2026-11-19

### Adicionado

- **`@danfse/core`** — porte do gerador de DANFSe: preparação do XML da NFS-e Nacional
  (segurança XXE/DOCTYPE + sanitização `&` + limite 5 MiB/32 MiB, QR code nfse.gov.br,
  enriquecimento IBGE com catálogo embutido de 5.525 municípios, truncamentos NT-008),
  presenter (tabelas de enums, máscaras CPF/CNPJ/CEP/telefone/moeda/percentual, supressões
  de partes e da tributação municipal) e renderer PDF em pdf-lib (A4, grade de 4 colunas,
  12 seções com âncoras em cm, Helvetica standard-14 com métricas AFM, QR vetorial,
  marca d'água por situação, canhoto fixo) — paridade visual/estrutural com o Folio do
  original.
- **`@danfse/api`** (NestJS :8080) — `POST /api/danfse` (params `stc`/`canhoto` com
  mensagens exatas), health live/ready com readiness revogada no shutdown, `X-Request-ID`
  sempre gerado (o do cliente é descartado), envelope `ErroResponse` com 5xx genérico,
  Swagger UI, CORS e body limit configurável (`XML_MAX_SIZE_BYTES`).
- **`@danfse/playground`** (Vite + React :5175) — colar/abrir XML, parâmetros e PDF no
  navegador.
- **Testes** — 7 golden visual (linhas de texto e âncoras geométricas extraídas por pdfjs
  dos PDFs de referência gerados pelo binário oficial Go) + 11 e2e de contrato HTTP.
- **CI** (GitHub Actions): build + typecheck + testes a cada push/PR.
- **Deploy Cloudflare**: Worker (Static Assets + Container) — `pnpm deploy:cloudflare`.
