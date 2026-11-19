/**
 * Controller do POST /api/danfse — porte de controller/danfse.go.
 *
 * PARITY: params validados ANTES do body (stc → canhoto → XML); mensagens
 * exatas; sucesso = application/pdf + Content-Disposition attachment; erros
 * 4xx ecoam a mensagem de validação (shape ErroResponse).
 */
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { gerarDanfse, situacaoNotaPorSTC } from "@danfse/core";
import { ErroHttp } from "./erro-http.js";

@ApiTags("DANFSe")
@Controller("api")
export class DanfseController {
  @Post("danfse")
  @HttpCode(200)
  @ApiOperation({
    summary: "Gerar DANFSe em PDF com base no xml da nota.",
    description:
      "Gera um DANFSe em PDF a partir do XML bruto da NFS-e nacional. Envie o conteúdo completo do XML com Content-Type application/xml.",
  })
  @ApiBody({
    description: "XML completo da NFS-e nacional (elemento raiz NFSe)",
    type: String,
  })
  @ApiOkResponse({ description: "DANFSe em PDF" })
  @ApiResponse({ status: 400, description: "ErroResponse {sucesso, mensagem}" })
  async gerarPdf(
    @Query("stc") stc: string | undefined,
    @Query("canhoto") canhoto: string | undefined,
    @Body() xml: string | Buffer,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // stc (antes de tudo)
    let situacao: ReturnType<typeof situacaoNotaPorSTC> = "valida";
    if (stc !== undefined && stc !== "") {
      const valor = /^\d+$/.test(stc) ? parseInt(stc, 10) : NaN;
      const resolvido = Number.isFinite(valor) ? situacaoNotaPorSTC(valor) : null;
      if (resolvido === null || resolvido === undefined) {
        throw new ErroHttp(400, "parâmetro stc inválido: deve ser 0, 1 ou 2");
      }
      situacao = resolvido;
    }

    // canhoto (após stc)
    let exibirCanhoto = true;
    if (canhoto !== undefined && canhoto !== "") {
      const min = canhoto.toLowerCase();
      if (min === "true") exibirCanhoto = true;
      else if (min === "false") exibirCanhoto = false;
      else throw new ErroHttp(400, "parâmetro canhoto inválido: deve ser true ou false");
    }

    // body
    const dados = Buffer.isBuffer(xml) ? xml.toString("utf8") : String(xml ?? "");
    if (dados.trim() === "") {
      throw new ErroHttp(400, "Xml não informado.");
    }

    try {
      const pdf = await gerarDanfse(dados, situacao, exibirCanhoto);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="danfse.pdf"');
      return new StreamableFile(Buffer.from(pdf));
    } catch (e) {
      // PARITY: erros do serviço (4xx de validação) são ecoados como 400 —
      // classificação fina 4xx/5xx é follow-up no próprio original (README).
      throw new ErroHttp(400, e instanceof Error ? e.message : String(e));
    }
  }
}
