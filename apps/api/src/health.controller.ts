/**
 * Health checks de ciclo de vida — porte de controller/health.go.
 * live: sempre 200 {"status":"ok"}; ready: 200 ok / 503 unavailable durante
 * graceful shutdown (readiness revogado antes do Shutdown HTTP).
 */
import { Controller, Get, HttpCode, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

/** Estado de readiness compartilhado (revogado no graceful shutdown). */
export const readiness = { pronto: true };

@ApiTags("Health")
@Controller()
export class HealthController {
  @Get("health/live")
  @HttpCode(200)
  @ApiOperation({ summary: "Liveness — processo de pé" })
  live(): { status: string } {
    return { status: "ok" };
  }

  @Get("health/ready")
  @ApiOperation({ summary: "Readiness — pronto / 503 durante o shutdown" })
  ready(@Res({ passthrough: true }) res: Response): { status: string } {
    if (!readiness.pronto) {
      // PARITY: 503 {"status":"unavailable"}
      res.status(503);
      return { status: "unavailable" };
    }
    return { status: "ok" };
  }
}
