import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { ErroResponseFilter } from "./erro-response.filter.js";
import { readiness } from "./health.controller.js";

const MAX_XML_DEFAULT = 5 * 1024 * 1024; // 5 MiB (XML_MAX_SIZE_BYTES)

function validarConfig(): number {
  const raw = process.env.XML_MAX_SIZE_BYTES;
  if (raw === undefined) return MAX_XML_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 32 * 1024 * 1024) {
    console.error(`XML_MAX_SIZE_BYTES inválido`);
    process.exit(1);
  }
  return n;
}

async function bootstrap(): Promise<void> {
  const maxBytes = validarConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["log", "warn", "error"],
  });
  // Body bruto (XML) com limite configurável — PARITY: BodyLimit do Echo (413).
  // O Go lê io.ReadAll SEM validar content-type: qualquer tipo vira texto.
  app.useBodyParser("text", { type: () => true, limit: maxBytes });
  app.useGlobalFilters(new ErroResponseFilter());
  app.enableCors({ origin: "*", methods: ["POST", "GET", "OPTIONS"] });
  // Sem prefixo global: as rotas já são /api/danfse, /health/* (basePath "/" do original).

  const config = new DocumentBuilder()
    .setTitle("DANFSe Service")
    .setDescription("Serviço HTTP para gerar o DANFSe em PDF a partir do XML de uma NFS-e.")
    .setVersion(process.env.npm_package_version ?? "0.1.0")
    .addTag("DANFSe")
    .addTag("Health")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/swagger-ui", app, document, { jsonDocumentUrl: "api/swagger-ui-json" });

  const porta = Number(process.env.SERVER_PORT ?? 8080);
  const server = app.getHttpServer();
  await app.listen(porta, "0.0.0.0");

  const desligar = (sinal: string) => {
    console.log(`Recebido ${sinal}; revogando readiness antes de encerrar.`);
    readiness.pronto = false;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", () => desligar("SIGTERM"));
  process.on("SIGINT", () => desligar("SIGINT"));

  console.log(`⚡ DANFSe Service (TS) em http://localhost:${porta}/api/danfse`);
  console.log(`📚 Swagger: http://localhost:${porta}/api/swagger-ui/`);
}

void bootstrap();
