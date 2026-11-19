/**
 * Exception handler central — porte de controller/exception_handler.go
 * (TratarErrosHTTP): contrato de erro {"sucesso":false,"mensagem":"..."}
 * ("content" omitempty — omitido quando vazio); 5xx SEMPRE genérico
 * ("Internal Server Error"), nunca expondo err.Error() (dados fiscais).
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { Request, Response } from "express";
import { ErroHttp } from "./erro-http.js";

@Catch()
export class ErroResponseFilter implements ExceptionFilter {
  catch(excecao: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();
    if (res.writableEnded) return; // resposta já committed

    let status = 500;
    let mensagem = "Internal Server Error";

    if (excecao instanceof ErroHttp) {
      status = excecao.status;
      mensagem = excecao.mensagem;
    } else if (excecao instanceof HttpException) {
      status = excecao.getStatus();
      if (status < 500) {
        const corpo = excecao.getResponse() as { message?: unknown };
        // 404 de rota desconhecida no Echo: mensagem "Not Found".
        mensagem = typeof corpo?.message === "string" ? corpo.message : "Not Found";
      }
    }
    // 5xx permanece genérico — nunca vaza err.Error().

    res.status(status).json({ sucesso: false, mensagem });
    void req; // correlação disponível via X-Request-ID (já no header)
  }
}
