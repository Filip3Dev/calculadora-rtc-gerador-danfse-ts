/** Copia assets (logo PNG) para o dist — tsc não copia arquivos não-TS. */
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
mkdirSync(path.join(raiz, "dist", "renderer"), { recursive: true });
cpSync(path.join(raiz, "src", "renderer", "assets"), path.join(raiz, "dist", "renderer", "assets"), {
  recursive: true,
});
console.log("✓ assets copiados para dist/renderer/assets");
