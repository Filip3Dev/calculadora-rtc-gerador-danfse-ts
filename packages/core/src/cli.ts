#!/usr/bin/env node
/**
 * CLI danfse — gera o PDF do DANFSe a partir do XML da NFS-e Nacional,
 * sobre o mesmo motor do serviço (paridade visual com o oficial Go).
 *
 * Uso:
 *   danfse <nota.xml> [-o saida.pdf] [--stc 0|1|2] [--canhoto true|false]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gerarDanfse, situacaoNotaPorSTC } from "./index.js";

const args = process.argv.slice(2);
const posicionais: string[] = [];
const opts = new Map<string, string>();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-o" || a === "--stc" || a === "--canhoto") opts.set(a, args[++i]);
  else if (a === "-h" || a === "--help") {
    console.log(`danfse — gera DANFSe (PDF) do XML da NFS-e Nacional

  danfse <nota.xml> [-o saida.pdf] [--stc 0|1|2] [--canhoto true|false]

  --stc       situação: 0 válida (default) · 1 substituída · 2 cancelada (marca d'água)
  --canhoto   exibir recibo (default true)
  -o          arquivo de saída (default: <nota>.pdf ao lado do XML)`);
    process.exit(0);
  } else posicionais.push(a);
}

const entrada = posicionais[0];
if (!entrada) {
  console.error("Uso: danfse <nota.xml> [-o saida.pdf] [--stc 0|1|2] [--canhoto true|false]  (-h para ajuda)");
  process.exit(2);
}

// stc
let situacao: "valida" | "substituida" | "cancelada" = "valida";
const stc = opts.get("--stc");
if (stc !== undefined) {
  const valor = /^\d+$/.test(stc) ? parseInt(stc, 10) : NaN;
  const resolvido = Number.isFinite(valor) ? situacaoNotaPorSTC(valor) : null;
  if (resolvido === null) {
    console.error("parâmetro stc inválido: deve ser 0, 1 ou 2");
    process.exit(2);
  }
  situacao = resolvido;
}

// canhoto
let canhoto = true;
const canhotoRaw = opts.get("--canhoto");
if (canhotoRaw !== undefined) {
  const min = canhotoRaw.toLowerCase();
  if (min === "true") canhoto = true;
  else if (min === "false") canhoto = false;
  else {
    console.error("parâmetro canhoto inválido: deve ser true ou false");
    process.exit(2);
  }
}

try {
  const xml = readFileSync(entrada, "utf8");
  const pdf = await gerarDanfse(xml, situacao, canhoto);
  const saida = opts.get("-o") ?? entrada.replace(/\.xml$/i, "") + ".pdf";
  writeFileSync(saida, pdf);
  console.error(`✓ ${saida} (${pdf.length} bytes · stc=${situacao === "valida" ? 0 : situacao === "substituida" ? 1 : 2} · canhoto=${canhoto})`);
} catch (e) {
  console.error(`Erro: ${(e as Error).message}`);
  process.exit(1);
}
