/**
 * Renderer DANFSe → PDF — porte fiel de internal/renderer (renderer.go,
 * layout.go, style.go, text.go) sobre pdf-lib.
 *
 * PARITY: A4 595.28×841.89pt, margens zeradas, coords "topo em cm"
 * (topToPDFY = 841.89 − top×cmPt), baseline = topToPDFY − Ascent − size×0.19,
 * Helvetica/HelveticaBold standard-14 (mesmas métricas AFM do Folio).
 */
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import type { DocumentoDanfse } from "../domain/tipos.js";
import * as L from "./labels.js";

// ─── Constantes de layout (layout.go) ────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CM_PT = 72 / 2.54;

const PAGE_LEFT = 0.15;
const PAGE_TOP = 0.15;
const PAGE_RIGHT = 20.85;
const PAGE_BOTTOM = 29.55;

const GRID_LEFT = 0.3;
const COL_X2 = 5.41;
const COL_X3 = 10.51;
const COL_X4 = 15.62;
const COL_X_END = 20.7;
const COL_X_QR = 17.48;
const QR_LEFT = 17.39;
const QR_TOP = 1.58;
const QR_SIZE = 1.9;
const QR_TEXT_TOP = 3.53;
const QR_TEXT_STEP = 0.21;
const QR_TEXT_WIDTH = 4.72;
const QR_TEXT_LEFT = QR_LEFT + (QR_SIZE - QR_TEXT_WIDTH) / 2;

const FIELD_INSET = 0.08;
const IDENT_ROW_HEIGHT = 0.69;
const IDENT_LABEL_OFFSET = 0.06;
const IDENT_VALUE_OFFSET = 0.36;
const IDENT_SHADE_TOP = 0.015;
const IDENT_SHADE_HEIGHT = 0.675;
const SECTION_TITLE_OFFSET = 0.07;
const PARTY_ROW_STEP = 0.64;
const MUN_ROW_STEP = 0.65;
const FED_ROW_STEP = 0.65;
const IBS_ROW_STEP = 0.64;
const IBS_SECOND_ROW = 1.29;
const IBS_THIRD_ROW = 1.94;
const TOTALS_ROW_STEP = 0.69;
const SERVICE_TAX_DESC_OFFSET = 0.65;
const SERVICE_DESC_OFFSET = 1.05;
const COMPL_CONTENT_OFFSET = 0.41;
const FIELD_SHADE_TOP = 0.015;
const FIELD_SHADE_HEIGHT = PARTY_ROW_STEP - FIELD_SHADE_TOP;

const COL1 = COL_X2 - GRID_LEFT;
const COL2 = COL_X3 - COL_X2;
const COL3 = COL_X4 - COL_X3;
const COL4 = COL_X_END - COL_X4;

const VALUE_PT = 7.0;
const LABEL_PT = 6.0;
const TITLE_PT = 7.0;

const LINE_STEP = (VALUE_PT * 1.2) / CM_PT;
const COL_GUTTER = 0.15;
const ELLIPSIS = "...";
const MIN_COMPL_LINES = 12;
const Y_INFO_COMPL = 22.68;
const Y_CANHOTO = 28.1;
const FOLGA_INFO = 0.1;
const Y_COMPL_TRIBUTOS = 27.65;
const NORMAL_SECTION_H = 0.63;
const COMPL_SECTION_H = 0.39;
const TOTAL_SECTION_H = 0.67;
const CANHOTO_BOTTOM = 28.77;
const CANHOTO_H = CANHOTO_BOTTOM - Y_CANHOTO;
const SUPPRESSED_PARTY_H = 0.4;
const COMPL_LINE_STEP = (6.5 * 1.2) / CM_PT;
const SUPPRESSED_MUNICIPAL_H = 0.32;
const PARTY_BLOCK_H = 1.94;
const MUN_BLOCK_H = 2.59;

const TOMADOR_TOP = 6.92;
const DESTINATARIO_TOP = 8.86;
const INTERMEDIARIO_TOP = 10.8;
const SERVICE_TOP = 12.74;
const MUNICIPAL_TOP = 14.43;
const FEDERAL_TOP = 17.02;
const IBS_TOP = 18.32;
const TOTALS_TOP = 20.9;
const COMPLEMENTARY_TOP = 22.27;

const BASELINE_ADJ = 0.19;

const BLACK = rgb(0, 0, 0);
const GRAY_HEADER = rgb(0.9490196078, 0.9490196078, 0.9490196078);
const RED = rgb(1, 0, 0);

// ─── Conversões ──────────────────────────────────────────────────────────────

const cm = (v: number) => v * CM_PT;
const topToPDFY = (top: number) => PAGE_H - top * CM_PT;
/** Ascent Helvetica (AFM 718/1000) — Baseline = topo − Ascent − size×0.19. */
const ascent = (size: number) => (718 / 1000) * size;
const baselineFromTop = (top: number, size: number) => topToPDFY(top) - ascent(size) - size * BASELINE_ADJ;

const bodyLeft = () => GRID_LEFT * CM_PT;
const bodyRight = () => COL_X_END * CM_PT;
const colunaX = (i: number) => [GRID_LEFT, COL_X2, COL_X3, COL_X4][i] * CM_PT;
const larguraColunas = (inicio: number, qtd: number) =>
  ([GRID_LEFT, COL_X2, COL_X3, COL_X4, COL_X_END][inicio + qtd] -
    [GRID_LEFT, COL_X2, COL_X3, COL_X4, COL_X_END][inicio]) * CM_PT;

// ─── Medição/truncamento (text.go) — métricas AFM via pdf-lib ────────────────

const measure = (font: PDFFont, text: string, size: number): number =>
  font.widthOfTextAtSize(text, size);

/** PARITY: truncateText — binária por runas com "..." anexado. */
function truncateText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (text === "") return text;
  if (measure(font, text, size) <= maxWidth) return text;
  const runes = Array.from(text);
  let lo = 0;
  let hi = runes.length - 1;
  let melhor = "";
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    const cand = runes.slice(0, meio).join("").replace(/ +$/, "") + ELLIPSIS;
    if (measure(font, cand, size) <= maxWidth) {
      melhor = cand;
      lo = meio + 1;
    } else {
      hi = meio - 1;
    }
  }
  if (melhor === ELLIPSIS) return "";
  return melhor;
}

function fit(value: string, font: PDFFont, size: number, width: number): string {
  return measure(font, value, size) <= width ? value : truncateText(value, font, size, width);
}

/** PrefixFit: maior prefixo (em chars) que cabe na largura. */
function prefixFit(text: string, font: PDFFont, size: number, width: number): number {
  const runes = Array.from(text);
  let acc = 0;
  for (let i = 0; i < runes.length; i++) {
    const w = measure(font, runes.slice(0, i + 1).join(""), size);
    if (w > width) return i;
    acc = i + 1;
  }
  return acc;
}

/** nextTextLine — quebra por palavra no último espaço. */
function nextTextLine(text: string, font: PDFFont, size: number, width: number): { part: string; consumed: number } {
  const fitChars = prefixFit(text, font, size, width);
  if (fitChars <= 0) return { part: "", consumed: 0 };
  const runes = Array.from(text);
  let part = runes.slice(0, fitChars).join("").trim();
  let consumed = fitChars;
  if (fitChars < runes.length) {
    const lastSpace = Math.max(part.lastIndexOf(" "), part.lastIndexOf("\n"));
    if (lastSpace > 0) {
      part = part.slice(0, lastSpace).trim();
      consumed = runes.slice(0, lastSpace).join("").replace(/[ \n]+$/, "").length;
    }
  }
  return { part, consumed };
}

function countLines(text: string, font: PDFFont, width: number, size: number): number {
  let lines = 0;
  let remaining = text.trim();
  while (remaining !== "") {
    const fitChars = prefixFit(remaining, font, size, width);
    if (fitChars <= 0) break;
    const runes = Array.from(remaining);
    let part = runes.slice(0, fitChars).join("").trim();
    if (fitChars < runes.length) {
      const lastSpace = Math.max(part.lastIndexOf(" "), part.lastIndexOf("\n"));
      if (lastSpace > 0) part = part.slice(0, lastSpace).trim();
    }
    if (part === "") break;
    remaining = remaining.slice(part.length).trim();
    lines++;
  }
  return lines;
}

function truncateLines(text: string, font: PDFFont, width: number, size: number, maxLines: number): string {
  let remaining = text.trim();
  const lines: string[] = [];
  while (lines.length < maxLines && remaining !== "") {
    const fitChars = prefixFit(remaining, font, size, width);
    if (fitChars <= 0) break;
    const runes = Array.from(remaining);
    let part = runes.slice(0, fitChars).join("").trim();
    if (fitChars < runes.length) {
      const lastSpace = Math.max(part.lastIndexOf(" "), part.lastIndexOf("\n"));
      if (lastSpace > 0) part = part.slice(0, lastSpace).trim();
    }
    if (part === "") break;
    lines.push(part);
    remaining = remaining.slice(part.length).trim();
  }
  let result = lines.join("\n");
  if (remaining !== "") result = result.replace(/[ \n]+$/, "") + ELLIPSIS;
  return result;
}

/** ajustarInformacoesComplementares — preserva o sufixo tributário (binária). */
function ajustarInformacoesComplementares(
  texto: string,
  linhaTributos: string,
  font: PDFFont,
  width: number,
  size: number,
  maxLines: number,
): string {
  if (countLines(texto, font, width, size) <= maxLines) return texto;
  if (linhaTributos !== "" && texto.endsWith(linhaTributos)) {
    const prefixo = texto.slice(0, -linhaTributos.length);
    const sufixo = " | " + linhaTributos;
    const runes = Array.from(prefixo);
    let lo = 0;
    let hi = runes.length - 1;
    let melhor = "";
    while (lo <= hi) {
      const meio = (lo + hi) >> 1;
      const cand = runes.slice(0, meio).join("").replace(/ +$/, "") + ELLIPSIS + sufixo;
      if (countLines(cand, font, width, size) <= maxLines) {
        melhor = cand;
        lo = meio + 1;
      } else {
        hi = meio - 1;
      }
    }
    if (melhor !== "") return melhor;
    return linhaTributos;
  }
  return truncateLines(texto, font, width, size, maxLines);
}

// ─── Estilos de célula (style.go) ────────────────────────────────────────────

interface EstiloCelula {
  tamanhoRotuloPt: number;
  tamanhoValorPt: number;
  offsetRotuloCM: number;
  offsetValorCM: number;
  sombreado: boolean;
  sombreadoTopCM: number;
  sombreadoAlturaCM: number;
}

const estiloCampo: EstiloCelula = {
  tamanhoRotuloPt: LABEL_PT,
  tamanhoValorPt: VALUE_PT,
  offsetRotuloCM: 0,
  offsetValorCM: 0.3,
  sombreado: false,
  sombreadoTopCM: 0,
  sombreadoAlturaCM: 0,
};
const estiloCampoSombreado: EstiloCelula = {
  ...estiloCampo,
  sombreado: true,
  sombreadoTopCM: FIELD_SHADE_TOP,
  sombreadoAlturaCM: FIELD_SHADE_HEIGHT,
};
const estiloAcesso: EstiloCelula = {
  tamanhoRotuloPt: VALUE_PT,
  tamanhoValorPt: VALUE_PT,
  offsetRotuloCM: 0,
  offsetValorCM: 0.3,
  sombreado: false,
  sombreadoTopCM: 0,
  sombreadoAlturaCM: 0,
};
const estiloIdentificacao: EstiloCelula = {
  tamanhoRotuloPt: TITLE_PT,
  tamanhoValorPt: VALUE_PT,
  offsetRotuloCM: IDENT_LABEL_OFFSET,
  offsetValorCM: IDENT_VALUE_OFFSET,
  sombreado: false,
  sombreadoTopCM: 0,
  sombreadoAlturaCM: 0,
};
const estiloIdentificacaoSombreada: EstiloCelula = {
  ...estiloIdentificacao,
  sombreado: true,
  sombreadoTopCM: IDENT_SHADE_TOP,
  sombreadoAlturaCM: IDENT_SHADE_HEIGHT,
};

// ─── Layout de página (layout.go) ────────────────────────────────────────────

interface PageLayout {
  alturaTomador: number;
  alturaDestinatario: number;
  alturaIntermediario: number;
  serviceTop: number;
  municipalTop: number;
  federalTop: number;
  ibsTop: number;
  totalsTop: number;
  complementaryTop: number;
}

function montarLayoutPagina(doc: DocumentoDanfse): PageLayout {
  const partyHeight = (visivel: boolean) => (visivel ? PARTY_BLOCK_H : SUPPRESSED_PARTY_H);
  const l: PageLayout = {
    alturaTomador: TOMADOR_TOP,
    alturaDestinatario: DESTINATARIO_TOP,
    alturaIntermediario: INTERMEDIARIO_TOP,
    serviceTop: SERVICE_TOP,
    municipalTop: MUNICIPAL_TOP,
    federalTop: FEDERAL_TOP,
    ibsTop: IBS_TOP,
    totalsTop: TOTALS_TOP,
    complementaryTop: COMPLEMENTARY_TOP,
  };
  const alturaTomador = partyHeight(doc.Partes.Tomador.Visivel);
  const alturaDestinatario = partyHeight(doc.Partes.Destinatario.Visivel);
  const alturaIntermediario = partyHeight(doc.Partes.Intermediario.Visivel);
  l.alturaDestinatario = l.alturaTomador + alturaTomador;
  l.alturaIntermediario = l.alturaDestinatario + alturaDestinatario;
  l.serviceTop = l.alturaIntermediario + alturaIntermediario;
  l.municipalTop = l.serviceTop + (MUNICIPAL_TOP - SERVICE_TOP);
  const municipalHeight = doc.Tributacoes.Municipal.Visivel ? MUN_BLOCK_H : SUPPRESSED_MUNICIPAL_H;
  l.federalTop = l.municipalTop + municipalHeight;
  l.ibsTop = l.federalTop + (IBS_TOP - FEDERAL_TOP);
  l.totalsTop = l.ibsTop + (TOTALS_TOP - IBS_TOP);
  l.complementaryTop = l.totalsTop + (COMPLEMENTARY_TOP - TOTALS_TOP);
  return l;
}

const limiteInferiorBlocoCM = (canhotoVisivel: boolean) =>
  canhotoVisivel ? Y_CANHOTO : CANHOTO_BOTTOM;

function contarLinhasComplementares(contentTop: number, taxLineTop: number): number {
  const lines = Math.floor((taxLineTop - contentTop - FOLGA_INFO) / COMPL_LINE_STEP + 1e-9);
  return Math.max(lines, 1);
}

function calcularAlocacaoTexto(
  layout: PageLayout,
  doc: DocumentoDanfse,
  descLinhas: number,
  complLinhas: number,
): { descriptionLines: number; complementaryLines: number; shiftCM: number } {
  let descricaoLinhas = Math.max(descLinhas, 1);
  const reserva = Math.min(Math.max(complLinhas, 1), MIN_COMPL_LINES);
  const taxLineTop = limiteInferiorBlocoCM(doc.Canhoto.Visivel);
  const baseTop = layout.complementaryTop + COMPL_CONTENT_OFFSET;
  const disponivel = Math.max(taxLineTop - baseTop - FOLGA_INFO, 0);
  const extraDescricao = (descricaoLinhas - 1) * LINE_STEP;
  const pedidaCompl = reserva * COMPL_LINE_STEP;
  if (extraDescricao + pedidaCompl > disponivel) {
    const maxExtra = Math.max(disponivel - pedidaCompl, 0);
    const maxDescricaoLinhas = 1 + Math.floor(maxExtra / LINE_STEP + 1e-9);
    if (descricaoLinhas > maxDescricaoLinhas) descricaoLinhas = maxDescricaoLinhas;
  }
  descricaoLinhas = Math.max(descricaoLinhas, 1);
  const shift = (descricaoLinhas - 1) * LINE_STEP;
  const contentTop = baseTop + shift;
  return {
    descriptionLines: descricaoLinhas,
    complementaryLines: contarLinhasComplementares(contentTop, taxLineTop),
    shiftCM: shift,
  };
}

// ─── Contexto de desenho ─────────────────────────────────────────────────────

interface Ctx {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  logo: PDFImage;
}

function text(ctx: Ctx, value: string, x: number, y: number, size: number, font: PDFFont, color = BLACK): void {
  if (value.trim() === "") return;
  ctx.page.drawText(value, { x, y, size, font, color });
}

function textTop(ctx: Ctx, value: string, x: number, top: number, size: number, font: PDFFont, color = BLACK): void {
  text(ctx, value, x, baselineFromTop(top, size), size, font, color);
}

function centerText(ctx: Ctx, value: string, x: number, top: number, width: number, size: number, font: PDFFont, color = BLACK): void {
  const w = measure(font, value, size);
  const xCenter = x + (width - w) / 2;
  text(ctx, value, xCenter, baselineFromTop(top, size), size, font, color);
}

function wrapText(ctx: Ctx, value: string, x: number, top: number, width: number, size: number, font: PDFFont, maxLines: number): void {
  if (maxLines <= 0) return;
  const lineHeight = size * 1.2;
  let remaining = value.trim();
  for (let line = 0; line < maxLines && remaining !== ""; line++) {
    const { part, consumed } = nextTextLine(remaining, font, size, width);
    if (part === "" || consumed === 0) break;
    let linha = part;
    if (line === maxLines - 1 && consumed < remaining.length) {
      linha = truncateText(part + ELLIPSIS, font, size, width);
    }
    textTop(ctx, linha, x, top + (lineHeight * line) / CM_PT, size, font);
    remaining = remaining.slice(consumed).trim();
  }
}

const fallbackTraco = (s: string) => (s.trim() === "" ? "-" : s);

function desenharCelula(
  ctx: Ctx,
  x: number,
  topCM: number,
  widthCM: number,
  rotulo: string,
  valor: string,
  estilo: EstiloCelula,
): void {
  const recuo = cm(FIELD_INSET);
  const largura = widthCM * CM_PT - 2 * recuo;
  if (estilo.sombreado) {
    ctx.page.drawRectangle({
      x,
      y: topToPDFY(topCM + estilo.sombreadoTopCM + estilo.sombreadoAlturaCM),
      width: widthCM * CM_PT,
      height: estilo.sombreadoAlturaCM * CM_PT,
      color: GRAY_HEADER,
    });
  }
  if (rotulo !== "") {
    textTop(ctx, fit(rotulo, ctx.bold, estilo.tamanhoRotuloPt, largura), x + recuo, topCM + estilo.offsetRotuloCM, estilo.tamanhoRotuloPt, ctx.bold);
  }
  textTop(ctx, fit(fallbackTraco(valor), ctx.regular, estilo.tamanhoValorPt, largura), x + recuo, topCM + estilo.offsetValorCM, estilo.tamanhoValorPt, ctx.regular);
}

function desenharCampo(ctx: Ctx, x: number, topCM: number, widthCM: number, rotulo: string, valor: string, sombreado: boolean): void {
  desenharCelula(ctx, x, topCM, widthCM, rotulo, valor, sombreado ? estiloCampoSombreado : estiloCampo);
}

function desenharCampoIdentificacao(ctx: Ctx, x: number, topCM: number, widthCM: number, rotulo: string, valor: string, sombreado: boolean): void {
  desenharCelula(ctx, x, topCM, widthCM, rotulo, valor, sombreado ? estiloIdentificacaoSombreada : estiloIdentificacao);
}

function desenharMultiplasLinhas(ctx: Ctx, x: number, topCM: number, width: number, height: number, rotulo: string, valor: string, size: number): void {
  const recuo = cm(FIELD_INSET);
  if (rotulo !== "") {
    textTop(ctx, rotulo, x + recuo, topCM, LABEL_PT, ctx.bold);
  }
  wrapText(ctx, valor, x + recuo, topCM + 0.3, width - 2 * recuo, size, ctx.regular, Math.max(1, Math.floor(height / (size * 1.2))));
}

function addLineH(ctx: Ctx, topCM: number, w = 0.5): void {
  ctx.page.drawLine({
    start: { x: bodyLeft(), y: topToPDFY(topCM) },
    end: { x: bodyRight(), y: topToPDFY(topCM) },
    thickness: w,
    color: BLACK,
  });
}

function addLineV(ctx: Ctx, xCM: number, topCM: number, bottomCM: number, w = 0.5): void {
  ctx.page.drawLine({
    start: { x: xCM * CM_PT, y: topToPDFY(topCM) },
    end: { x: xCM * CM_PT, y: topToPDFY(bottomCM) },
    thickness: w,
    color: BLACK,
  });
}

// ─── Seções (renderer.go) ────────────────────────────────────────────────────

function desenharCabecalho(ctx: Ctx, doc: DocumentoDanfse): void {
  ctx.page.drawRectangle({
    x: bodyLeft(),
    y: topToPDFY(0.3 + 1.16),
    width: cm(20.4),
    height: cm(1.16),
    color: GRAY_HEADER,
  });
  ctx.page.drawImage(ctx.logo, {
    x: cm(0.49),
    y: topToPDFY(0.44 + 0.85),
    width: cm(4.0),
    height: cm(0.85),
  });
  centerText(ctx, L.labelDANFSeVersao, cm(COL_X2), 0.35, cm(10.19), TITLE_PT + 2, ctx.bold);
  centerText(ctx, L.labelDocumentoAuxiliar, cm(COL_X2), 0.65, cm(10.19), TITLE_PT + 2, ctx.bold);
  if (doc.Cabecalho.TipoAmbiente === "Homologação") {
    centerText(ctx, L.labelNFSemValidadeJuridica, cm(COL_X2), 0.95, cm(10.19), 9, ctx.bold, RED);
  }
  textTop(ctx, `Município: ${doc.Cabecalho.Municipio} - ${doc.Cabecalho.UF}`, colunaX(3), 0.45, 8, ctx.regular);
  textTop(ctx, "Ambiente Gerador: " + doc.Cabecalho.AmbienteGerador, colunaX(3), 0.97, 6, ctx.regular);
  textTop(ctx, "Tipo de Ambiente: " + doc.Cabecalho.TipoAmbiente, colunaX(3), 1.22, 6, ctx.regular);
  addLineH(ctx, 1.48);
}

function desenharInfoNfse(ctx: Ctx, doc: DocumentoDanfse): void {
  desenharCelula(ctx, bodyLeft(), 1.48, 15.3, L.labelChaveAcessoNfse, doc.Acesso.ChaveAcesso, estiloAcesso);
  desenharQRCode(ctx, doc.Acesso.CodigoQR);
  const linhasQR = [L.labelQrLine1, L.labelQrLine2, L.labelQrLine3];
  linhasQR.forEach((linha, i) => {
    textTop(ctx, linha, cm(QR_TEXT_LEFT), 3.53 + i * QR_TEXT_STEP, 6, ctx.regular);
  });

  desenharCelula(ctx, colunaX(0), 2.27, larguraColunas(0, 1) / CM_PT, L.labelNumeroNFSe, doc.Acesso.NumeroNFSe, estiloAcesso);
  desenharCelula(ctx, colunaX(1), 2.27, larguraColunas(1, 1) / CM_PT, L.labelCompetenciaNFSe, doc.Acesso.Competencia, estiloAcesso);
  desenharCelula(ctx, colunaX(2), 2.27, larguraColunas(2, 1) / CM_PT, L.labelDataHoraEmissaoNFSe, doc.Acesso.DataHoraEmissaoNFSe, estiloAcesso);

  desenharCelula(ctx, colunaX(0), 2.96, larguraColunas(0, 1) / CM_PT, L.labelNumeroDPS, doc.Acesso.NumeroDPS, estiloAcesso);
  desenharCelula(ctx, colunaX(1), 2.96, larguraColunas(1, 1) / CM_PT, L.labelSerieDPS, doc.Acesso.SerieDPS, estiloAcesso);
  desenharCelula(ctx, colunaX(2), 2.96, larguraColunas(2, 1) / CM_PT, L.labelDataHoraEmissaoDPS, doc.Acesso.DataHoraEmissaoDPS, estiloAcesso);
}

function desenharQRCode(ctx: Ctx, codigo: string): void {
  if (codigo === "") return;
  try {
    const qr = QRCode.create(codigo, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const moduloW = cm(QR_SIZE) / size;
    const x0 = cm(QR_LEFT);
    const y0 = topToPDFY(QR_TOP + QR_SIZE);
    ctx.page.drawRectangle({ x: x0, y: y0, width: cm(QR_SIZE), height: cm(QR_SIZE), color: rgb(1, 1, 1) });
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) {
          ctx.page.drawRectangle({
            x: x0 + c * moduloW,
            y: y0 + (size - 1 - r) * moduloW,
            width: moduloW,
            height: moduloW,
            color: BLACK,
          });
        }
      }
    }
  } catch {
    // PARITY: erro de QR é silenciosamente ignorado (renderer.go:122-127)
  }
}

function desenharTituloSecao(ctx: Ctx, topCM: number, titulo: string, alturaCM: number, sombreado: boolean): void {
  const y = topToPDFY(topCM);
  const h = alturaCM * CM_PT;
  if (sombreado) {
    ctx.page.drawRectangle({ x: bodyLeft(), y: y - h, width: COL1 * CM_PT, height: h, color: GRAY_HEADER });
  }
  textTop(ctx, titulo, bodyLeft() + cm(FIELD_INSET), topCM + SECTION_TITLE_OFFSET, TITLE_PT, ctx.bold);
  ctx.page.drawLine({
    start: { x: bodyLeft(), y },
    end: { x: bodyRight(), y },
    thickness: 0.5,
    color: BLACK,
  });
}

function desenharSecao(ctx: Ctx, topCM: number, titulo: string, altura = NORMAL_SECTION_H): void {
  desenharTituloSecao(ctx, topCM, titulo, altura, true);
}

function desenharBlocoSuprimido(ctx: Ctx, topCM: number, valor: string, altura = SUPPRESSED_MUNICIPAL_H): void {
  const bottom = topCM + altura;
  addLineH(ctx, topCM);
  addLineH(ctx, bottom);
  const size = 7.5;
  const width = bodyRight() - bodyLeft() - 2;
  const txt = fit(valor, ctx.regular, size, width);
  const textTopCM = topCM + (altura - size / CM_PT) / 2;
  centerText(ctx, txt, bodyLeft() + 1, textTopCM, width, size, ctx.regular);
}

type VarianteParte = "prestador" | "tomador" | "destinatario" | "intermediario";

function desenharSecaoParte(ctx: Ctx, topCM: number, titulo: string, p: DocumentoDanfse["Partes"]["Emitente"], variante: VarianteParte): void {
  desenharSecao(ctx, topCM, titulo);
  const identCols = variante === "destinatario" ? 2 : 1;
  desenharCampo(ctx, colunaX(1), topCM, larguraColunas(1, identCols) / CM_PT, L.labelCNPJCPFNIF, p.CNPJCPFNIF, false);
  if (variante !== "destinatario") {
    desenharCampo(ctx, colunaX(2), topCM, larguraColunas(2, 1) / CM_PT, L.labelIndicadorMunicipal, p.InscricaoMunicipal, false);
  }
  desenharCampo(ctx, colunaX(3), topCM, larguraColunas(3, 1) / CM_PT, L.labelTelefone, p.Telefone, false);
  desenharCampo(ctx, colunaX(0), topCM + PARTY_ROW_STEP, larguraColunas(0, 2) / CM_PT, L.labelNomeNomeEmpresarial, p.Nome, false);
  desenharCampo(ctx, colunaX(2), topCM + PARTY_ROW_STEP, larguraColunas(2, 1) / CM_PT, L.labelMunicipioUF, p.MunicipioUF, false);
  desenharCampo(ctx, colunaX(3), topCM + PARTY_ROW_STEP, larguraColunas(3, 1) / CM_PT, L.labelCodigoIBGECEP, p.CodigoIBGECEP, false);
  desenharCampo(ctx, colunaX(0), topCM + 2 * PARTY_ROW_STEP, larguraColunas(0, 2) / CM_PT, L.labelEndereco, p.Endereco, false);
  desenharCampo(ctx, colunaX(2), topCM + 2 * PARTY_ROW_STEP, larguraColunas(2, 2) / CM_PT, L.labelEmail, p.Email, false);
  if (variante === "prestador") {
    desenharCampo(ctx, colunaX(0), topCM + 3 * PARTY_ROW_STEP, larguraColunas(0, 2) / CM_PT, L.labelSimplesNacional, p.SimplesNacional, false);
    desenharCampo(ctx, colunaX(2), topCM + 3 * PARTY_ROW_STEP, larguraColunas(2, 2) / CM_PT, L.labelRegimeApuracaoSN, p.RegimeApuracaoSN, false);
  }
}

function desenharPartes(ctx: Ctx, doc: DocumentoDanfse, layout: PageLayout): void {
  desenharCampoIdentificacao(ctx, bodyLeft(), 3.65, COL1, L.labelEmitenteNfse, doc.Acesso.TipoEmitente, true);
  desenharCampoIdentificacao(ctx, colunaX(1), 3.65, COL2, L.labelSituacaoNfse, doc.Acesso.Situacao, false);
  desenharCampoIdentificacao(ctx, colunaX(2), 3.65, COL3, L.labelFinalidade, doc.Acesso.Finalidade, false);

  desenharSecaoParte(ctx, 4.34, L.labelPrestadorFornecedor, doc.Partes.Emitente, "prestador");

  if (doc.Partes.Tomador.Visivel) {
    desenharSecaoParte(ctx, layout.alturaTomador, L.labelTomadorAdquirente, doc.Partes.Tomador, "tomador");
  } else {
    desenharBlocoSuprimido(ctx, layout.alturaTomador, doc.Partes.Tomador.MensagemSupressao, SUPPRESSED_PARTY_H);
  }
  if (doc.Partes.Destinatario.Visivel) {
    desenharSecaoParte(ctx, layout.alturaDestinatario, L.labelDestinatarioOperacao, doc.Partes.Destinatario, "destinatario");
  } else {
    desenharBlocoSuprimido(ctx, layout.alturaDestinatario, doc.Partes.Destinatario.MensagemSupressao, SUPPRESSED_PARTY_H);
  }
  if (doc.Partes.Intermediario.Visivel) {
    desenharSecaoParte(ctx, layout.alturaIntermediario, L.labelIntermediarioOperacao, doc.Partes.Intermediario, "intermediario");
  } else {
    desenharBlocoSuprimido(ctx, layout.alturaIntermediario, doc.Partes.Intermediario.MensagemSupressao, SUPPRESSED_PARTY_H);
  }
}

function desenharServico(ctx: Ctx, doc: DocumentoDanfse, descLines: number, layout: PageLayout): void {
  const y = layout.serviceTop;
  let desc = doc.Servico.DescServ;
  if (desc === "") desc = doc.Servico.DescServOriginal;
  desenharSecao(ctx, y, L.labelServicoPrestado);
  desenharCampo(ctx, colunaX(1), y, larguraColunas(1, 1) / CM_PT, L.labelCodigoTribNacMun, doc.Servico.CodigoTribNacMun, false);
  desenharCampo(ctx, colunaX(2), y, larguraColunas(2, 1) / CM_PT, L.labelCodigoNBS, doc.Servico.CodigoNBS, false);
  desenharCampo(ctx, colunaX(3), y, larguraColunas(3, 1) / CM_PT, L.labelLocalPrestacao, doc.Servico.LocalPrestacaoUF, false);
  textTop(
    ctx,
    truncateText(doc.Servico.XTribNac, ctx.regular, VALUE_PT, bodyRight() - bodyLeft() - cm(COL_GUTTER)),
    bodyLeft() + cm(FIELD_INSET),
    y + SERVICE_TAX_DESC_OFFSET,
    VALUE_PT,
    ctx.regular,
  );
  desenharMultiplasLinhas(ctx, bodyLeft(), y + SERVICE_DESC_OFFSET, bodyRight() - bodyLeft(), descLines * LINE_STEP * CM_PT, L.labelDescricaoServico, desc, VALUE_PT);
}

function desenharTributacaoMunicipal(ctx: Ctx, doc: DocumentoDanfse, layout: PageLayout, shift: number): void {
  const mun = doc.Tributacoes.Municipal;
  if (!mun.Visivel) {
    desenharBlocoSuprimido(ctx, layout.municipalTop + shift, mun.MensagemSupressao, SUPPRESSED_MUNICIPAL_H);
    return;
  }
  const top = layout.municipalTop + shift;
  desenharSecao(ctx, top, L.labelTribMunicipal);
  desenharCampo(ctx, colunaX(1), top, larguraColunas(1, 1) / CM_PT, L.labelTipoTribIssqn, mun.TribISSQN, false);
  desenharCampo(ctx, colunaX(2), top, larguraColunas(2, 2) / CM_PT, L.labelMunicipioUFPAISSIssqn, mun.MunicipioUFPAISIncid, false);
  desenharCampo(ctx, colunaX(0), top + MUN_ROW_STEP, larguraColunas(0, 1) / CM_PT, L.labelRegEspTribIssqn, mun.RegEspTrib, false);
  desenharCampo(ctx, colunaX(1), top + MUN_ROW_STEP, larguraColunas(1, 1) / CM_PT, L.labelTpImunidadeIssqn, mun.TpImunidade, false);
  desenharCampo(ctx, colunaX(2), top + MUN_ROW_STEP, larguraColunas(2, 1) / CM_PT, L.labelSuspensaoExigIssqn, mun.SuspensaoExig, false);
  desenharCampo(ctx, colunaX(3), top + MUN_ROW_STEP, larguraColunas(3, 1) / CM_PT, L.labelNumeroProcessoSusp, mun.NProcessoSusp, false);
  desenharCampo(ctx, colunaX(0), top + 2 * MUN_ROW_STEP, larguraColunas(0, 1) / CM_PT, L.labelBeneficioMunicipal, mun.BeneficioMunicipal, false);
  desenharCampo(ctx, colunaX(1), top + 2 * MUN_ROW_STEP, larguraColunas(1, 1) / CM_PT, L.labelCalculoBM, mun.CalculoBM, false);
  desenharCampo(ctx, colunaX(2), top + 2 * MUN_ROW_STEP, larguraColunas(2, 1) / CM_PT, L.labelTotalDeducoes, mun.TotalDeducoes, false);
  desenharCampo(ctx, colunaX(3), top + 2 * MUN_ROW_STEP, larguraColunas(3, 1) / CM_PT, L.labelDescontoIncondicionado, mun.DescontoIncond, false);
  desenharCampo(ctx, colunaX(0), top + 3 * MUN_ROW_STEP, larguraColunas(0, 1) / CM_PT, L.labelBCIssqn, mun.BCISSQN, false);
  desenharCampo(ctx, colunaX(1), top + 3 * MUN_ROW_STEP, larguraColunas(1, 1) / CM_PT, L.labelAliqAplicada, mun.AliqAplic, false);
  desenharCampo(ctx, colunaX(2), top + 3 * MUN_ROW_STEP, larguraColunas(2, 1) / CM_PT, L.labelRetencaoIssqn, mun.RetISSQN, false);
  desenharCampo(ctx, colunaX(3), top + 3 * MUN_ROW_STEP, larguraColunas(3, 1) / CM_PT, L.labelIssqnApurado, mun.ISSQNApurado, false);
}

function desenharTributacaoFederal(ctx: Ctx, doc: DocumentoDanfse, layout: PageLayout, shift: number): void {
  const fed = doc.Tributacoes.Federal;
  const top = layout.federalTop + shift;
  desenharSecao(ctx, top, L.labelTribFederal);
  desenharCampo(ctx, colunaX(1), top, larguraColunas(1, 1) / CM_PT, L.labelIRRF, fed.IRRF, false);
  desenharCampo(ctx, colunaX(2), top, larguraColunas(2, 1) / CM_PT, L.labelContribPrevidRet, fed.ContribPrevidRet, false);
  desenharCampo(ctx, colunaX(3), top, larguraColunas(3, 1) / CM_PT, L.labelContribSocRet, fed.ContribSocRet, false);
  if (fed.ExibirPisCofins) {
    desenharCampo(ctx, colunaX(0), top + FED_ROW_STEP, larguraColunas(0, 1) / CM_PT, L.labelPISDebito, fed.PISDebito, false);
    desenharCampo(ctx, colunaX(1), top + FED_ROW_STEP, larguraColunas(1, 1) / CM_PT, L.labelCOFINSDebito, fed.COFINSDebito, false);
    desenharCampo(ctx, colunaX(2), top + FED_ROW_STEP, larguraColunas(2, 2) / CM_PT, L.labelDescricaoContribRet, fed.DescContribRet, false);
  }
}

function desenharTributacaoIBSCBS(ctx: Ctx, doc: DocumentoDanfse, layout: PageLayout, shift: number): void {
  const ibs = doc.Tributacoes.IBSCBS;
  const top = layout.ibsTop + shift;
  desenharSecao(ctx, top, L.labelTribIBSCBS);
  desenharCampo(ctx, colunaX(1), top, larguraColunas(1, 1) / CM_PT, L.labelCSTcClassTrib, ibs.CSTcClassTrib, false);
  desenharCampo(ctx, colunaX(2), top, larguraColunas(2, 2) / CM_PT, L.labelIndOpCodIBGELocalidadeUF, ibs.IndOpCodIBGELocalidadeUF, false);
  desenharCampo(ctx, colunaX(0), top + IBS_ROW_STEP, larguraColunas(0, 1) / CM_PT, L.labelExclusoesReducoesBC, ibs.ExclusoesReducoesBC, false);
  desenharCampo(ctx, colunaX(1), top + IBS_ROW_STEP, larguraColunas(1, 1) / CM_PT, L.labelBCPosExclusoes, ibs.BCPosExclusoes, false);
  desenharCampo(ctx, colunaX(2), top + IBS_ROW_STEP, larguraColunas(2, 1) / CM_PT, L.labelRedAliqIBSRedAliqCBS, ibs.RedAliqIBSRedAliqCBS, false);
  desenharCampo(ctx, colunaX(3), top + IBS_ROW_STEP, larguraColunas(3, 1) / CM_PT, L.labelAliqIBSUFIBSMun, ibs.AliqIBSUFIBSMun, false);
  desenharCampo(ctx, colunaX(0), top + IBS_SECOND_ROW, larguraColunas(0, 1) / CM_PT, L.labelAliqEfetMunIBS, ibs.AliqEfetMunIBS, false);
  desenharCampo(ctx, colunaX(1), top + IBS_SECOND_ROW, larguraColunas(1, 1) / CM_PT, L.labelValorMunIBS, ibs.ValorMunIBS, false);
  desenharCampo(ctx, colunaX(2), top + IBS_SECOND_ROW, larguraColunas(2, 1) / CM_PT, L.labelAliqEfetEstIBS, ibs.AliqEfetEstIBS, false);
  desenharCampo(ctx, colunaX(3), top + IBS_SECOND_ROW, larguraColunas(3, 1) / CM_PT, L.labelValorEstIBS, ibs.ValorEstIBS, false);
  desenharCampo(ctx, colunaX(0), top + IBS_THIRD_ROW, larguraColunas(0, 1) / CM_PT, L.labelValorTotalIBS, ibs.ValorTotalIBS, false);
  desenharCampo(ctx, colunaX(1), top + IBS_THIRD_ROW, larguraColunas(1, 1) / CM_PT, L.labelAliqCBS, ibs.AliqCBS, false);
  desenharCampo(ctx, colunaX(2), top + IBS_THIRD_ROW, larguraColunas(2, 1) / CM_PT, L.labelAliqEfetCBS, ibs.AliqEfetCBS, false);
  desenharCampo(ctx, colunaX(3), top + IBS_THIRD_ROW, larguraColunas(3, 1) / CM_PT, L.labelValorTotalCBS, ibs.ValorTotalCBS, false);
}

function desenharTotais(ctx: Ctx, doc: DocumentoDanfse, layout: PageLayout, shift: number): void {
  const top = layout.totalsTop + shift;
  desenharSecao(ctx, top, L.labelValorTotalNfse, TOTAL_SECTION_H);
  desenharCampo(ctx, colunaX(1), top, larguraColunas(1, 1) / CM_PT, L.labelValorOperacaoServico, doc.Totais.ValorOperacaoServico, false);
  desenharCampo(ctx, colunaX(2), top, larguraColunas(2, 1) / CM_PT, L.labelDescontoIncondicionado, doc.Totais.DescontoIncond, false);
  desenharCampo(ctx, colunaX(3), top, larguraColunas(3, 1) / CM_PT, L.labelDescontoCondicionado, doc.Totais.DescontoCond, false);
  desenharCampo(ctx, colunaX(0), top + TOTALS_ROW_STEP, larguraColunas(0, 1) / CM_PT, L.labelTotalRetencoes, doc.Totais.TotalRetencoes, false);
  desenharCampo(ctx, colunaX(1), top + TOTALS_ROW_STEP, larguraColunas(1, 1) / CM_PT, L.labelValorLiquidoNfse, doc.Totais.ValorLiquido, false);
  desenharCampo(ctx, colunaX(2), top + TOTALS_ROW_STEP, larguraColunas(2, 1) / CM_PT, L.labelTotalIBSCBS, doc.Totais.TotalIBSCBS, false);
  desenharCampo(ctx, colunaX(3), top + TOTALS_ROW_STEP, larguraColunas(3, 1) / CM_PT, L.labelValorLiquidoIBSCBS, doc.Totais.ValorLiquidoIBSCBS, true);
}

function combinarConteudoComplementar(conteudo: string, linhaTributos: string): string {
  if (conteudo === "") return linhaTributos;
  if (conteudo.includes(linhaTributos)) return conteudo;
  if (linhaTributos !== "") return `${conteudo} | ${linhaTributos}`;
  return conteudo;
}

function selecionarConteudoComplementar(doc: DocumentoDanfse): string {
  let src = doc.InformacoesComplementares.Conteudo;
  if (src === "") src = doc.InformacoesComplementares.ConteudoOriginal;
  return combinarConteudoComplementar(src, doc.InformacoesComplementares.LinhaTributos);
}

function desenharInformacoesComplementares(ctx: Ctx, doc: DocumentoDanfse, layout: PageLayout, shift: number, lines: number): void {
  desenharTituloSecao(ctx, layout.complementaryTop + shift, L.labelInformacoesComplementares, COMPL_SECTION_H, false);
  const contentTop = layout.complementaryTop + COMPL_CONTENT_OFFSET + shift;
  let content = selecionarConteudoComplementar(doc);
  content = ajustarInformacoesComplementares(content, doc.InformacoesComplementares.LinhaTributos, ctx.regular, bodyRight() - bodyLeft() - 3, 6.5, lines);
  desenharMultiplasLinhas(ctx, bodyLeft(), contentTop, bodyRight() - bodyLeft(), lines * COMPL_LINE_STEP * CM_PT, "", content, 6.5);
}

function desenharCanhoto(ctx: Ctx, doc: DocumentoDanfse): void {
  if (!doc.Canhoto.Visivel) return;
  addLineH(ctx, Y_CANHOTO);
  addLineH(ctx, CANHOTO_BOTTOM);
  addLineV(ctx, 0.3, Y_CANHOTO, CANHOTO_BOTTOM);
  addLineV(ctx, COL_X2, Y_CANHOTO, CANHOTO_BOTTOM);
  addLineV(ctx, COL_X3, Y_CANHOTO, CANHOTO_BOTTOM);
  addLineV(ctx, 20.7, Y_CANHOTO, CANHOTO_BOTTOM);
  textTop(ctx, L.labelDataCientificacao, bodyLeft() + 2, 28.17, 6, ctx.bold);
  textTop(ctx, L.labelIdentificacaoAssinatura, colunaX(1) + 2, 28.17, 6, ctx.bold);
  textTop(ctx, L.labelNumeroNFSeChave, colunaX(2) + 2, 28.17, 6, ctx.bold);
  wrapText(ctx, doc.Acesso.NumeroNFSe + " / " + doc.Acesso.ChaveAcesso, colunaX(2) + 2, 28.47, bodyRight() - colunaX(2), 6.5, ctx.regular, 2);
}

function drawFrame(ctx: Ctx): void {
  ctx.page.drawRectangle({
    x: PAGE_LEFT * CM_PT,
    y: PAGE_H - PAGE_BOTTOM * CM_PT,
    width: (PAGE_RIGHT - PAGE_LEFT) * CM_PT,
    height: (PAGE_BOTTOM - PAGE_TOP) * CM_PT,
    borderColor: BLACK,
    borderWidth: 1,
  });
}

// ─── Marca d'água (configurada ANTES — desenhada primeiro, por baixo) ────────

function desenharMarcaDagua(ctx: Ctx, marca: DocumentoDanfse["MarcaDagua"]): void {
  if (marca.Texto === "") return;
  const size = marca.TamanhoFonte;
  const w = measure(ctx.bold, marca.Texto, size);
  const diagonal = Math.sqrt(PAGE_W ** 2 + PAGE_H ** 2);
  // Centraliza o texto no centro da página ao longo da diagonal de 45°.
  const cx = PAGE_W / 2;
  const cy = PAGE_H / 2;
  const offset = (diagonal - w) / 2;
  const x = cx + (offset / Math.SQRT2) * Math.cos((45 * Math.PI) / 180);
  const y = cy + (offset / Math.SQRT2) * Math.sin((45 * Math.PI) / 180);
  ctx.page.drawText(marca.Texto, {
    x,
    y,
    size,
    font: ctx.bold,
    color: rgb(marca.ColorR, marca.ColorG, marca.ColorB),
    opacity: marca.Opacidade,
    rotate: { type: "degrees", angle: marca.Angulo } as never,
  });
}

// ─── Entrada principal ───────────────────────────────────────────────────────

const LOGO_PATH = new URL("./assets/logo-nfse.png", import.meta.url);

let logoCache: Uint8Array | null = null;

/** Renderiza um DocumentoDanfse em PDF (1 página A4, layout fixo). */
export async function renderizarDanfse(doc: DocumentoDanfse): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const [regular, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  logoCache ??= new Uint8Array(readFileSync(fileURLToPath(LOGO_PATH)));
  const logo = await pdf.embedPng(logoCache);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { page, regular, bold, logo };

  desenharMarcaDagua(ctx, doc.MarcaDagua);

  const layout = montarLayoutPagina(doc);
  let desc = doc.Servico.DescServ;
  if (desc === "") desc = doc.Servico.DescServOriginal;
  const descLines = countLines(desc, regular, bodyRight() - bodyLeft() - 3, VALUE_PT);
  const content = selecionarConteudoComplementar(doc);
  const contentLines = countLines(content, regular, bodyRight() - bodyLeft() - 3, 6.5);
  const allocation = calcularAlocacaoTexto(layout, doc, descLines, contentLines);

  desenharCabecalho(ctx, doc);
  desenharInfoNfse(ctx, doc);
  desenharPartes(ctx, doc, layout);
  desenharServico(ctx, doc, allocation.descriptionLines, layout);
  desenharTributacaoMunicipal(ctx, doc, layout, allocation.shiftCM);
  desenharTributacaoFederal(ctx, doc, layout, allocation.shiftCM);
  desenharTributacaoIBSCBS(ctx, doc, layout, allocation.shiftCM);
  desenharTotais(ctx, doc, layout, allocation.shiftCM);
  desenharInformacoesComplementares(ctx, doc, layout, allocation.shiftCM, allocation.complementaryLines);
  desenharCanhoto(ctx, doc);
  drawFrame(ctx);

  return pdf.save();
}
