/** Smoke: gera o PDF do fixture completo e salva para comparação visual com o Go. */
import { readFileSync, writeFileSync } from "node:fs";
import { gerarDanfse } from "../src/index.js";

const xml = readFileSync("../../fixtures/completo.xml", "utf8");
const pdf = await gerarDanfse(xml, "valida", true);
writeFileSync("/tmp/danfse-ref/completo-ts.pdf", pdf);
console.log("PDF TS gerado:", pdf.length, "bytes");

const homolog = readFileSync("../../fixtures/homolog.xml", "utf8");
const pdfH = await gerarDanfse(homolog, "valida", true);
writeFileSync("/tmp/danfse-ref/homolog-ts.pdf", pdfH);
console.log("Homolog TS:", pdfH.length, "bytes");
