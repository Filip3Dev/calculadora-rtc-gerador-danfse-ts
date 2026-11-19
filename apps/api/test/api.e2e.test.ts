/**
 * E2E da API — contratos capturados do serviço oficial Go (v1.0.0) rodando
 * localmente (container danfse-go :8084). O servidor TS sobe em processo filho
 * (tsx — vitest não emite decoratorMetadata) na porta 8192.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const PORT = 8192;
const BASE = `http://127.0.0.1:${PORT}`;

const CM_PT = 72 / 2.54;
const PAGE_H = 841.89;

describe("e2e — contrato do serviço oficial Go", () => {
  let server: ChildProcess;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getDocument: any;

  beforeAll(async () => {
    server = spawn("pnpm", ["exec", "tsx", "src/main.ts"], {
      cwd: API_DIR,
      env: { ...process.env, SERVER_PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    const t0 = Date.now();
    for (;;) {
      try {
        const resp = await fetch(`${BASE}/health/live`, { signal: AbortSignal.timeout(1000) });
        if (resp.ok) break;
      } catch {
        /* subindo */
      }
      if (Date.now() - t0 > 25_000) throw new Error("API não subiu em 25s");
      await new Promise((r) => setTimeout(r, 300));
    }
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    getDocument = pdfjs.getDocument;
  }, 40_000);

  afterAll(() => {
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
  });

  const post = (corpo: string, query = ""): Promise<Response> =>
    fetch(`${BASE}/api/danfse${query}`, {
      method: "POST",
      headers: { "content-type": "application/xml" },
      body: corpo,
    });

  it("health live/ready", async () => {
    expect(await (await fetch(`${BASE}/health/live`)).json()).toEqual({ status: "ok" });
    expect(await (await fetch(`${BASE}/health/ready`)).json()).toEqual({ status: "ok" });
  });

  it("body vazio → 400 Xml não informado.", async () => {
    const r = await post("   ");
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ sucesso: false, mensagem: "Xml não informado." });
  });

  it("stc inválido → 400 mensagem exata", async () => {
    const r = await post("<NFSe/>", "?stc=9");
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ sucesso: false, mensagem: "parâmetro stc inválido: deve ser 0, 1 ou 2" });
  });

  it("canhoto inválido → 400 mensagem exata", async () => {
    const r = await post("<NFSe/>", "?canhoto=sim");
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ sucesso: false, mensagem: "parâmetro canhoto inválido: deve ser true ou false" });
  });

  it("root errada → 400 expected NFSe", async () => {
    const r = await post("<OutraRoot/>");
    expect(r.status).toBe(400);
    const corpo = await r.json();
    expect(corpo.mensagem).toContain('XML root element is "OutraRoot", expected NFSe');
  });

  it("Id vazio → 400 infNFSe Id is empty", async () => {
    const r = await post('<?xml version="1.0" encoding="UTF-8"?><NFSe><Id></Id></NFSe>');
    expect(r.status).toBe(400);
    expect((await r.json()).mensagem).toContain("infNFSe Id is empty");
  });

  it("rota desconhecida → 404 ErroResponse", async () => {
    const r = await fetch(`${BASE}/api/danfse/v1/pdf`, { method: "POST" });
    expect(r.status).toBe(404);
    const corpo = await r.json();
    expect(corpo.sucesso).toBe(false);
    expect(typeof corpo.mensagem).toBe("string");
  });

  it("X-Request-ID sempre gerado (32 chars) e não ecoa o do cliente", async () => {
    const r = await fetch(`${BASE}/health/live`, {
      headers: { "X-Request-ID": "tentativa-de-injecao-<xml>../etc</xml>" },
    });
    const id = r.headers.get("x-request-id") ?? "";
    expect(id).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(id).not.toContain("<");
  });

  it("CORS: OPTIONS com Origin → permitido", async () => {
    const r = await fetch(`${BASE}/api/danfse`, {
      method: "OPTIONS",
      headers: { Origin: "https://exemplo.gov.br", "Access-Control-Request-Method": "POST" },
    });
    expect([200, 204]).toContain(r.status);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("sucesso → PDF válido com headers exatos", { timeout: 20000 }, async () => {
    const xml = readFileSync(path.join(FIXTURES, "completo.xml"), "utf8");
    const r = await post(xml);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="danfse.pdf"');
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");

    // Paridade de conteúdo: linhas de texto do PDF HTTP = linhas do PDF oficial.
    const linhasTS = await linhas(buf);
    const linhasGo = await linhas(readFileSync(path.join(FIXTURES, "completo.pdf")));
    expect(linhasTS).toEqual(linhasGo);
  });

  it("stc=2 → marca d'água no PDF", { timeout: 20000 }, async () => {
    const xml = readFileSync(path.join(FIXTURES, "completo.xml"), "utf8");
    const r = await post(xml, "?stc=2");
    expect(r.status).toBe(200);
    const buf = Buffer.from(await r.arrayBuffer());
    const linhasTS = await linhas(buf);
    const linhasGo = await linhas(readFileSync(path.join(FIXTURES, "completo-stc2-cancelada.pdf")));
    expect(linhasTS).toEqual(linhasGo);
  });

  /** Extração de linhas (mesma lógica do golden do core). */
  async function linhas(pdf: Buffer): Promise<string[]> {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const raizPdfjs = path.dirname(req.resolve("pdfjs-dist/package.json"));
    const standardFontDataUrl = path.join(raizPdfjs, "standard_fonts") + path.sep;
    const doc = await getDocument({ data: new Uint8Array(pdf), standardFontDataUrl }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const palavras = content.items
      .filter((i: { str?: string; transform?: number[] }) => typeof i.str === "string" && i.str.trim() !== "" && i.transform)
      .map((i: { str: string; transform: number[] }) => ({
        texto: i.str.trim(),
        x: i.transform[4],
        y: (PAGE_H - i.transform[5]) / CM_PT,
      }));
    const ordenadas = [...palavras].sort((a: { y: number }, b: { y: number }) => a.y - b.y);
    const linhas: Array<{ y: number; partes: Array<[number, string]> }> = [];
    for (const p of ordenadas) {
      const l = linhas.find((x) => Math.abs(x.y - p.y) < 0.08);
      if (l) l.partes.push([p.x, p.texto]);
      else linhas.push({ y: p.y, partes: [[p.x, p.texto]] });
    }
    return linhas
      .sort((a, b) => a.y - b.y)
      .map((l) => l.partes.sort((a, b) => a[0] - b[0]).map(([, t]) => t).join(" ").replace(/\s+/g, " ").trim())
      .filter((l) => l !== "");
  }
});
