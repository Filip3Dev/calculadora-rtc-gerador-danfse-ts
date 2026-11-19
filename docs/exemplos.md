# Exemplos — DANFSe Service

Todas as respostas/contratos abaixo foram **capturados do serviço oficial Go** (v1.0.0, container local) e replicados pelo porte TS — os e2e (`apps/api/test`) comparam o contrato e o golden visual compara o conteúdo do PDF linha a linha.

Base local: `http://localhost:8080`.

---

## 1. Gerar um DANFSe (PDF)

```bash
curl -X POST "http://localhost:8080/api/danfse" \
  -H "Content-Type: application/xml" \
  --data-binary @fixtures/completo.xml \
  -o danfse.pdf
```

Resposta `200`:

| Header | Valor |
|---|---|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="danfse.pdf"` |
| `X-Request-ID` | 32 chars alfanuméricos gerados pelo servidor |

Body: PDF A4 de 1 página (`%PDF-1.7`) — o mesmo documento que o oficial gera para o mesmo XML (comparado por extração de texto nos testes).

### Parâmetros

- `stc` — `0` Válida (default) · `1` Substituída (marca d'água) · `2` Cancelada (marca d'água)
- `canhoto` — `true` (default) · `false` oculta o recibo inferior

```bash
curl -X POST "http://localhost:8080/api/danfse?stc=2&canhoto=false" ...
```

## 2. Erros (400) — envelope `ErroResponse`

```json
{"sucesso": false, "mensagem": "Xml não informado."}
```

| Gatilho | Mensagem |
|---|---|
| body vazio/espaços | `Xml não informado.` |
| `stc=9`/`stc=abc` | `parâmetro stc inválido: deve ser 0, 1 ou 2` |
| `canhoto=sim` | `parâmetro canhoto inválido: deve ser true ou false` |
| root ≠ NFSe | `XML root element is "OutraRoot", expected NFSe` |
| `<NFSe><Id></Id></NFSe>` | `infNFSe Id is empty` |
| DOCTYPE/ENTITY | `XML contains DTD or entity declaration` |

Rota desconhecida → `404` `{"sucesso":false,"mensagem":"..."}`; falhas internas → `500` genérico (`Internal Server Error` — nunca expõe o erro).

## 3. Health checks

```
GET /health/live  → 200 {"status":"ok"}
GET /health/ready → 200 {"status":"ok"}   (503 {"status":"unavailable"} durante o shutdown)
```

## 4. X-Request-ID

O header enviado pelo cliente é **descartado**; a resposta sempre carrega um novo ID de 32
chars (`FfKqDlUnEyFYvYaSSJzNOwJiGsEoPaCD`) — usado como correlação nos logs JSON.

## 5. Configuração

| Variável | Default | Descrição |
|---|---|---|
| `SERVER_PORT` | `8080` | Porta HTTP. |
| `XML_MAX_SIZE_BYTES` | `5242880` | Limite do XML (teto 33554432; inválido rejeita o boot). |
| `LOG_LEVEL` | `info` | `debug` `info` `warn` `error`. |
