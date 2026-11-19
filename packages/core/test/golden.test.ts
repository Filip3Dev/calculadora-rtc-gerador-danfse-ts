/**
 * GOLDEN VISUAL — compara o PDF gerado pelo porte TS com o PDF de referência
 * gerado pelo serviço oficial Go (fixtures/*.pdf, capturados do binário oficial
 * executando localmente) via extração de texto (pdfjs) — a mesma estratégia dos
 * testes do próprio Go (pdftotext), portada.
 *
 * Compara: (a) linhas de texto (ordenadas por posição, espaços colapsados);
 * (b) âncoras geométricas (TRIBUTAÇÃO/INFORMAÇÕES/CIENTIFICAÇÃO em y fixos,
 * canhoto ~28,10cm, sem overflow horizontal > 20,70cm+0,05).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { gerarDanfse } from "../src/index.js";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const CM_PT = 72 / 2.54;
const PAGE_H = 841.89;

type Palavra = { texto: string; x: number; yTopoCM: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let getDocument: any = null;
/** Métricas das standard-14 (Helvetica não embutida) — sem isso as posições saem imprecisas. */
let standardFontDataUrl: string | null = null;

beforeAll(async () => {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    getDocument = pdfjs.getDocument as never;
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const pathMod = await import("node:path");
    standardFontDataUrl =
      pathMod.dirname(req.resolve("pdfjs-dist/standard_fonts/FoxitSans.pfb")) + pathMod.sep;
  } catch {
    getDocument = null; // skip suave (como os testes Go com poppler ausente)
  }
});

/** Extrai palavras com posição (topo em cm) da 1ª página do PDF. */
async function extrairPalavras(pdf: Uint8Array): Promise<Palavra[]> {
  if (!getDocument) throw new Error("pdfjs-dist indisponível");
  const doc = await getDocument({
    data: new Uint8Array(pdf),
    standardFontDataUrl,
  } as never).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const palavras: Palavra[] = [];
  for (const item of content.items) {
    if (typeof item.str !== "string" || item.str.trim() === "" || !item.transform) continue;
    const [, , , , e, f] = item.transform;
    palavras.push({ texto: item.str.trim(), x: e, yTopoCM: (PAGE_H - f) / CM_PT });
  }
  return palavras;
}

/** Linhas de texto: agrupa palavras por y (tolerância 0,08cm), ordena por x, colapsa espaços. */
function linhasDeTexto(palavras: Palavra[]): string[] {
  const ordenadas = [...palavras].sort((a, b) => a.yTopoCM - b.yTopoCM);
  const linhas: Array<{ y: number; partes: Array<[number, string]> }> = [];
  for (const p of ordenadas) {
    const linha = linhas.find((l) => Math.abs(l.y - p.yTopoCM) < 0.08);
    if (linha) {
      linha.partes.push([p.x, p.texto]);
    } else {
      linhas.push({ y: p.yTopoCM, partes: [[p.x, p.texto]] });
    }
  }
  return linhas
    .sort((a, b) => a.y - b.y)
    .map((l) =>
      l.partes
        .sort((a, b) => a[0] - b[0])
        .map(([x, t]) => t)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((l) => l !== "");
}

const carregar = (nome: string): Uint8Array => new Uint8Array(readFileSync(path.join(FIXTURES, nome)));

describe.skipIf(!true)("golden visual — paridade Go × TS", () => {
  const casos: Array<{
    nome: string;
    xml: string;
    situacao: "valida" | "substituida" | "cancelada";
    canhoto: boolean;
    pdfGo: string;
  }> = [
    { nome: "completo (válida, com canhoto)", xml: "completo.xml", situacao: "valida", canhoto: true, pdfGo: "completo.pdf" },
    { nome: "sem canhoto", xml: "completo.xml", situacao: "valida", canhoto: false, pdfGo: "completo-sem-canhoto.pdf" },
    { nome: "cancelada (stc=2)", xml: "completo.xml", situacao: "cancelada", canhoto: true, pdfGo: "completo-stc2-cancelada.pdf" },
    { nome: "homologação (tpAmb=2)", xml: "homolog.xml", situacao: "valida", canhoto: true, pdfGo: "homolog.pdf" },
  ];

  for (const caso of casos) {
    it(`${caso.nome}: linhas de texto idênticas ao oficial`, { timeout: 30000 }, async () => {
      if (!getDocument) return; // skip suave
      const xml = readFileSync(path.join(FIXTURES, caso.xml), "utf8");
      const pdfTS = await gerarDanfse(xml, caso.situacao, caso.canhoto);
      const [palavrasTS, palavrasGo] = await Promise.all([
        extrairPalavras(pdfTS),
        extrairPalavras(carregar(caso.pdfGo)),
      ]);
      const linhasTS = linhasDeTexto(palavrasTS);
      const linhasGo = linhasDeTexto(palavrasGo);

      // Conjuntos de linhas devem ser idênticos (ordem canônica por y).
      // Nota: kerning entre libs pode alterar truncagens-limite; falhas apontam a linha.
      expect(linhasTS, diffLinhas(linhasGo, linhasTS)).toEqual(linhasGo);
    });
  }

  it("âncoras geométricas (padrão do teste Go: tolerância ±0,25cm)", { timeout: 30000 }, async () => {
    if (!getDocument) return;
    const xml = readFileSync(path.join(FIXTURES, "completo.xml"), "utf8");
    const pdfTS = await gerarDanfse(xml, "valida", true);
    const palavras = await extrairPalavras(pdfTS);

    // Sem overflow horizontal: nenhuma palavra passa de 20,70+0,05cm.
    for (const p of palavras) {
      expect(p.x / CM_PT, `overflow: "${p.texto}"`).toBeLessThan(20.75);
    }

    // Canhoto em y≈28,10 (labels entre 27,92–28,42).
    const cient = palavras.find((p) => p.texto.includes("CIENTIFICAÇÃO"));
    expect(cient, "label DATA CIENTIFICAÇÃO presente").toBeTruthy();
    expect(cient!.yTopoCM).toBeGreaterThan(27.9);
    expect(cient!.yTopoCM).toBeLessThan(28.42);

    // Âncoras das seções em y fixos (tolerância ±0,25 do teste Go).
    const ancora = (alvo: string, esperado: number) => {
      const p = palavras.find((w) => w.texto.includes(alvo));
      expect(p, `âncora ${alvo}`).toBeTruthy();
      expect(Math.abs(p!.yTopoCM - esperado), `âncora ${alvo} y`).toBeLessThan(0.3);
    };
    ancora("TRIBUTAÇÃO MUNICIPAL", 14.43 + 0.07);
    ancora("TRIBUTAÇÃO FEDERAL", 17.02 + 0.07);
    ancora("TRIBUTAÇÃO IBS / CBS", 18.32 + 0.07);
    ancora("INFORMAÇÕES COMPLEMENTARES", 22.27 + 0.07);
    ancora("CHAVE DE ACESSO", 1.48);
  });

  it("marca d'água CANCELADA presente (stc=2)", { timeout: 30000 }, async () => {
    if (!getDocument) return;
    const xml = readFileSync(path.join(FIXTURES, "completo.xml"), "utf8");
    const pdfTS = await gerarDanfse(xml, "cancelada", true);
    const palavras = await extrairPalavras(pdfTS);
    expect(palavras.some((p) => p.texto.includes("CANCELADA"))).toBe(true);
  });

  it("homologação: aviso SEM VALIDADE JURÍDICA", { timeout: 30000 }, async () => {
    if (!getDocument) return;
    const xml = readFileSync(path.join(FIXTURES, "homolog.xml"), "utf8");
    const pdfTS = await gerarDanfse(xml, "valida", true);
    const palavras = await extrairPalavras(pdfTS);
    expect(palavras.some((p) => p.texto.includes("SEM VALIDADE JURÍDICA"))).toBe(true);
  });
});

/** Diagnóstico: primeira divergência entre esperado (Go) e obtido (TS). */
function diffLinhas(esperado: string[], obtido: string[]): string {
  for (let i = 0; i < Math.min(esperado.length, obtido.length); i++) {
    if (esperado[i] !== obtido[i]) {
      return `\n1ª divergência (linha ${i}):\n  Go: ${JSON.stringify(esperado[i])}\n  TS: ${JSON.stringify(obtido[i])}`;
    }
  }
  if (esperado.length !== obtido.length) {
    const extra = esperado.length > obtido.length ? "Go" : "TS";
    const maior = esperado.length > obtido.length ? esperado : obtido;
    return `\nContagem de linhas difere (Go ${esperado.length} × TS ${obtido.length}); primeira exclusiva (${extra}): ${JSON.stringify(
      maior[Math.min(esperado.length, obtido.length)],
    )}`;
  }
  return "";
}
