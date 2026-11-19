/**
 * Segurança e utilidades de XML/string — porte de xml_security.go e
 * utils_string/utils_strings.go.
 */

export const MAX_XML_INPUT_SIZE = 5 * 1024 * 1024;
export const MAX_XML_INPUT_SIZE_LIMIT = 32 * 1024 * 1024;

export class XMLSecurityError extends Error {}

/** Rejeita diretivas DOCTYPE/ENTITY (case-insensitive), aceita `<?xml?>` e namespaces. */
export function rejeitarDTDAndEntidades(xmlData: string): void {
  // PARITY: o Go varre tokens xml.Directive (conteúdo após "<!"); aqui escaneamos
  // diretivas diretamente. Declaração <?xml ...?> NÃO é diretiva (não casa).
  const regex = /<!\[?[^\]]*?>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xmlData)) !== null) {
    const directive = m[0].toUpperCase();
    if (directive.includes("DOCTYPE") || directive.includes("ENTITY")) {
      throw new XMLSecurityError("XML contains DTD or entity declaration");
    }
  }
}

const RE_ENTIDADE_XML = /^&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/;

/** Corrige `&` não escapado de forma controlada (tolerância legado). */
export function sanitizarAmpersand(xml: string): string {
  if (!xml.includes("&")) return xml;
  let out = "";
  for (let i = 0; i < xml.length; i++) {
    if (xml[i] === "&" && !RE_ENTIDADE_XML.test(xml.slice(i))) {
      out += "&amp;";
      continue;
    }
    out += xml[i];
  }
  return out;
}

/** Trunca por linhas/caracteres com reticências (TruncarTexto). */
export function truncarTexto(texto: string, maxLinhas: number, maxCars: number): string {
  if (texto === "" || maxLinhas <= 0 || maxCars <= 0) return "";
  const segmentos = texto.split("\n");
  const out: string[] = [];
  let usadas = 0;
  let truncou = false;
  for (const seg of segmentos) {
    if (usadas >= maxLinhas) {
      truncou = true;
      break;
    }
    const runes = Array.from(seg);
    const necess = runes.length > 0 ? Math.ceil(runes.length / maxCars) : 1;
    if (usadas + necess <= maxLinhas) {
      out.push(seg);
      usadas += necess;
      continue;
    }
    const limite = (maxLinhas - usadas) * maxCars;
    if (runes.length > limite) out.push(runes.slice(0, limite).join(""));
    else out.push(seg);
    usadas = maxLinhas;
    truncou = true;
    break;
  }
  let res = out.join("\n");
  if (truncou) res = res.replace(/[ \n]+$/, "") + "...";
  return res;
}

/** Corta em maxCars caracteres (reserva 3 p/ "..."), preservando quebras (TruncarPorTamanho). */
export function truncarPorTamanho(texto: string, maxCars: number): string {
  const runes = Array.from(texto);
  if (runes.length <= maxCars) return texto;
  const limite = Math.max(maxCars - 3, 0);
  return runes.slice(0, limite).join("").replace(/[ \n]+$/, "") + "...";
}

/** Corta em maxConteudo caracteres + reticências (TruncarComReticencias). */
export function truncarComReticencias(texto: string, maxConteudo: number): string {
  const runes = Array.from(texto);
  if (runes.length <= maxConteudo) return texto;
  const limite = Math.max(maxConteudo, 0);
  return runes.slice(0, limite).join("").replace(/[ \n]+$/, "") + "...";
}
