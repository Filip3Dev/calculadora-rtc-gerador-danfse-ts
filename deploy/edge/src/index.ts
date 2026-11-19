/**
 * Worker de borda do DANFSe Service (Cloudflare) — Static Assets (playground)
 * + proxy /api/* e /health/* para o container (Dockerfile da raiz), gerenciado
 * pelo Durable Object abaixo. Adaptado do template oficial
 * cloudflare/templates/containers-template.
 */
import { DurableObject } from "cloudflare:workers";

const PORT = 8080;

/** Container dorme após este período sem tráfego (a 1ª chamada seguinte paga o boot). */
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

/** Nome estável → hash determinístico garante uma única instância global. */
const INSTANCE_NAME = "danfse-v3"; // bump: força container novo

/** Sonda de prontidão: GET leve sem dependências. */
const HEALTH_PATH = "/health/live";

export interface Env {
  CONTAINER: DurableObjectNamespace<DanfseContainer>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/health/")) {
      // Assets já resolveram antes do Worker; aqui só deveria chegar o proxy.
      return new Response("Não encontrado", { status: 404 });
    }
    return env.CONTAINER.getByName(INSTANCE_NAME).fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class DanfseContainer extends DurableObject {
  private starting?: Promise<void>;
  private ready = false;
  private monitoring = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const container = this.ctx.container;
      if (container?.running) {
        container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
        this.observeExit();
      }
    });
  }

  override async fetch(request: Request): Promise<Response> {
    if (!this.ready) {
      try {
        await (this.starting ??= this.start());
      } catch (err) {
        this.starting = undefined;
        throw err;
      }
    }

    const url = new URL(request.url);
    const proto = url.protocol.replace(":", "");
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");
    return this.ctx.container!.getTcpPort(PORT).fetch(forwarded);
  }

  private async start(): Promise<void> {
    const container = this.ctx.container!;
    try {
      if (!container.running) {
        container.start({
          image: container.images.base,
          instance: "lite",
          enableInternet: false, // logo e fontes vêm na imagem; nada a acessar fora
        });
      }
    } catch (err) {
      if (!/already running/i.test(String(err))) throw err;
    }
    container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
    this.observeExit();

    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const probe = await container
          .getTcpPort(PORT)
          .fetch(`http://container${HEALTH_PATH}`, {
            signal: AbortSignal.timeout(1000),
          });
        if (probe.ok) {
          this.ready = true;
          return;
        }
      } catch {
        // porta ainda não escutando — tenta de novo em 200ms
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Container não ficou pronto na porta ${PORT} (${HEALTH_PATH})`);
  }

  private observeExit(): void {
    if (this.monitoring) return;
    this.monitoring = true;
    this.ctx.waitUntil(
      this.ctx.container!.monitor().then(
        () => console.log("Container do DANFSe finalizou."),
        (err: unknown) => console.error("Container finalizou com erro:", err),
      ),
    );
  }
}
