/**
 * Middlewares de requisição — porte de logging.go (RequestLogger) e do
 * stripExternalRequestIDHeader + RequestID do Echo.
 *
 * PARITY: o X-Request-ID do cliente é SEMPRE descartado; o servidor gera um
 * novo (32 chars alfanuméricos) e ecoa na resposta. Nunca logamos corpo,
 * querystring, IDs fiscais ou erros crus.
 */
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const CARACTERES = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** 32 chars alfanuméricos aleatórios (mesmo formato do middleware do Echo). */
export function novoRequestId(): string {
  let id = "";
  for (let i = 0; i < 32; i++) {
    id += CARACTERES[Math.floor(Math.random() * CARACTERES.length)];
  }
  return id;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Header externo é descartado ANTES de gerar o próprio (não confiável).
    req.headers["x-request-id"] = undefined;
    res.setHeader("X-Request-ID", novoRequestId());
    next();
  }
}
