export * from "./domain/tipos.js";
export * from "./domain/format.js";
export * from "./domain/situacao.js";
export * from "./domain/localidades.js";
export * from "./service/xml-utils.js";
export * from "./service/preparacao.js";
export * from "./service/presenter.js";
export * from "./renderer/renderer.js";
export * from "./renderer/labels.js";

import { prepararNFSe } from "./service/preparacao.js";
import { apresentar } from "./service/presenter.js";
import { renderizarDanfse } from "./renderer/renderer.js";
import type { SituacaoNotaTipo } from "./domain/situacao.js";

/**
 * Pipeline completo (pdf_application.go): XML → preparação → apresentação →
 * PDF. O canhoto do documento é sobrescrito pelo parâmetro HTTP.
 */
export async function gerarDanfse(
  xml: string,
  situacao: SituacaoNotaTipo,
  canhoto: boolean,
): Promise<Uint8Array> {
  const nfse = prepararNFSe(xml, situacao);
  const doc = apresentar(nfse);
  doc.Canhoto.Visivel = canhoto;
  return renderizarDanfse(doc);
}
