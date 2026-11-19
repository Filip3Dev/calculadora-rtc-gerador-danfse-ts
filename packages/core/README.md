# danfse-core

Gerador de **DANFSe (PDF)** a partir do XML da **NFS-e Nacional** — porte TypeScript do [serviço oficial em Go da Receita Federal](https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse), com paridade **visual/estrutural** (golden tests comparam o texto do PDF linha a linha com o gerado pelo binário oficial). Sem banco de dados.

```bash
npm i danfse-core
```

## Uso programático

```js
import { gerarDanfse } from "danfse-core";
import { readFileSync, writeFileSync } from "node:fs";

//                XML      situação              canhoto
const pdf = await gerarDanfse(readFileSync("nota.xml", "utf8"), "cancelada", true);
writeFileSync("danfse.pdf", pdf);
```

## CLI

```
danfse nota.xml [-o saida.pdf] [--stc 0|1|2] [--canhoto true|false]
```

`--stc`: 0 válida (default) · 1 substituída · 2 cancelada (marca d'água). Rejeita documentos de outros modelos (NF-e/NFCom) com a mensagem exata do serviço oficial.

Código, testes e documentação no [repositório](https://github.com/Filip3Dev/calculadora-rtc-gerador-danfse-ts).

MIT — crédito compartilhado ao projeto original (SERPRO/Receita Federal do Brasil).
