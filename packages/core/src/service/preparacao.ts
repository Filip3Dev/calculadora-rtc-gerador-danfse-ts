/**
 * Preparação do modelo NFSe — porte de danfse_preparation.go + danfse_tax_totals.go.
 * Parse XML com semântica do encoding/xml Go (tags case-insensitive, atributos,
 * números ausentes = 0, elementos ponteiro ausentes = null).
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { NFSe, EndNac, EnderecoTomador } from "../domain/tipos.js";
import { buscarMunicipio } from "../domain/localidades.js";
import { marcaDagua, type SituacaoNotaTipo } from "../domain/situacao.js";
import { formatarMoeda, formatarPercentual } from "../domain/format.js";
import {
  MAX_XML_INPUT_SIZE,
  MAX_XML_INPUT_SIZE_LIMIT,
  rejeitarDTDAndEntidades,
  sanitizarAmpersand,
  truncarComReticencias,
} from "./xml-utils.js";

const MAX_CARACTERES_DESCRICAO = 1300;
const MAX_CARACTERES_INFO_COMPL = 2000;
const CONSULTA_PUBLICA_BASE_URL = "https://www.nfse.gov.br";

type No = Record<string, unknown>;

/** Busca valor de elemento/atributo por nome case-insensitive (como encoding/xml). */
function elem(no: No | null | undefined, nome: string): No | string | null {
  if (!no || typeof no !== "object") return null;
  const alvo = nome.toLowerCase();
  for (const [k, v] of Object.entries(no)) {
    if (k.replace(/^.*:/, "").toLowerCase() === alvo) return v as No | string;
  }
  return null;
}

/** Texto: "#text" quando há atributos, ou o valor string direto. */
function texto(no: No | string | null | undefined): string | undefined {
  if (no === null || no === undefined) return undefined;
  if (typeof no === "string") return no;
  if (typeof no === "object" && "#text" in (no as No)) return String((no as No)["#text"]);
  return undefined;
}

/** Float do Go xml.Unmarshal: ausente = 0; inválido = 0 (Go retorna erro — tratamos como 0 por segurança de parse já validado). */
function num(no: No | string | null | undefined): number {
  const t = texto(no);
  if (t === undefined || t === "") return 0;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : 0;
}

/** Float ponteiro (*float64): null quando ausente. */
function numPtr(no: No | string | null | undefined): number | null {
  const t = texto(no);
  if (t === undefined || t === "") return null;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

/** Int do xml.Unmarshal: ausente = 0. */
function int(no: No | string | null | undefined): number {
  const t = texto(no);
  if (t === undefined || t === "") return 0;
  const v = parseInt(t, 10);
  return Number.isFinite(v) ? v : 0;
}

const objeto = (no: No | string | null | undefined): No | null =>
  no !== null && no !== undefined && typeof no === "object" ? (no as No) : null;

/** Executa a preparação completa: valida, sanitiza, parseia, enriquece e calcula. */
export function prepararNFSe(xmlData: string, situacao: SituacaoNotaTipo, maxInputSize?: number): NFSe {
  const limite = maxInputSize ?? MAX_XML_INPUT_SIZE;
  if (limite <= 0 || limite > MAX_XML_INPUT_SIZE_LIMIT) {
    throw new Error(`invalid XML max input size ${limite} bytes`);
  }
  if (xmlData.trim() === "") {
    throw new Error("input XML is empty");
  }
  // PARITY: Go usa len(bytes) — contagem em bytes UTF-8, não em code units.
  if (Buffer.byteLength(xmlData, "utf8") > limite) {
    throw new Error(`input exceeds maximum size of ${limite} bytes`);
  }

  xmlData = sanitizarAmpersand(xmlData);

  if (Buffer.byteLength(xmlData, "utf8") > limite) {
    throw new Error(`sanitized input exceeds maximum size of ${limite} bytes`);
  }

  rejeitarDTDAndEntidades(xmlData);

  const valido = XMLValidator.validate(xmlData);
  if (valido !== true) {
    throw new Error(valido.err.msg);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    ignoreDeclaration: true, // PARITY: sem isto a declaração <?xml?> vira raiz falsa "?xml"
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: true,
  });
  const bruto = parser.parse(xmlData) as No;
  const raizNome = Object.keys(bruto).find((k) => k.replace(/^.*:/, "") === "NFSe");
  if (!raizNome) {
    // PARITY: encoding/xml com XMLName — match case-SENSITIVE da raiz; a
    // mensagem é a do decoder (validada no oficial: vale até para <nfse> minúsculo).
    const local = (Object.keys(bruto)[0] ?? "").replace(/^.*:/, "");
    throw new Error(`expected element type <NFSe> but have <${local}>`);
  }
  const raiz = objeto(bruto[raizNome] as No | string | null);
  if (!raiz) {
    throw new Error("expected element type <NFSe> but have <NFSe>");
  }

  const inf = objeto(elem(raiz, "infNFSe")) ?? {};
  const idAttr = (() => {
    for (const [k, v] of Object.entries(raiz === inf ? {} : (inf as No))) {
      if (k.startsWith("@_") && k.replace(/^.*:/, "").toLowerCase() === "@_id") return String(v);
    }
    return "";
  })();

  const nfse = montarNFSe(raiz, inf, idAttr);

  if (idAttr.trim() === "") {
    throw new Error("infNFSe Id is empty");
  }

  nfse.MarcaDagua = marcaDagua(situacao);
  nfse.InfNFSe.qrcode = `${CONSULTA_PUBLICA_BASE_URL}/ConsultaPublica/?tpc=1&chave=${encodeURIComponent(
    idAttr.replaceAll("NFS", ""),
  )}`;

  enriquecerMunicipios(nfse);
  calcularExclusoesReducoesBC(nfse);
  calcularLinhas(nfse);

  return nfse;
}

// ─── Montagem do modelo (espelho dos structs Go) ─────────────────────────────

function montarNFSe(raiz: No, inf: No, id: string): NFSe {
  const dps = objeto(elem(inf, "DPS")) ?? {};
  const infDps = objeto(elem(dps, "infDPS")) ?? {};
  const serv = objeto(elem(infDps, "serv")) ?? {};
  const valoresInf = objeto(elem(inf, "valores")) ?? {};

  return {
    Versao: (() => {
      for (const [k, v] of Object.entries(raiz)) {
        if (k.startsWith("@_") && k.replace(/^.*:/, "").toLowerCase() === "@_versao") return String(v);
      }
      return "";
    })(),
    MarcaDagua: "",
    ExibicaoDescServ: "",
    ExibicaoCompl: "",
    ExibicaoLinhaTributos: "",
    VExclusoesReducoesBC: 0,
    TextoDescServOriginal: "",
    TextoComplOriginal: "",
    InfNFSe: {
      Id: id,
      situacao: texto(elem(inf, "situacao")) ?? undefined,
      qrcode: undefined,
      dhProc: texto(elem(inf, "dhProc")),
      nNFSe: texto(elem(inf, "nNFSe")),
      ambGer: texto(elem(inf, "ambGer")),
      cStat: texto(elem(inf, "cStat")),
      xLocEmi: texto(elem(inf, "xLocEmi")),
      cLocIncid: texto(elem(inf, "cLocIncid")),
      xLocIncid: texto(elem(inf, "xLocIncid")),
      xUFIncid: texto(elem(inf, "xUFIncid")),
      xPaisIncid: texto(elem(inf, "xPaisIncid")),
      xTribNac: texto(elem(inf, "xTribNac")),
      xTribMun: texto(elem(inf, "xTribMun")),
      xLocPrestacao: texto(elem(inf, "xLocPrestacao")),
      cPaisPrestacao: texto(elem(inf, "cPaisPrestacao")),
      DPS: { infDPS: montarInfDPS(infDps, serv) },
      emit: montarEmitente(objeto(elem(inf, "emit")) ?? {}),
      valores: {
        vLiq: num(elem(valoresInf, "vLiq")),
        vBC: num(elem(valoresInf, "vBC")),
        vISSQN: num(elem(valoresInf, "vISSQN")),
        pAliqAplic: numPtr(elem(valoresInf, "pAliqAplic")),
        vCalcBM: num(elem(valoresInf, "vCalcBM")),
        tpBM: int(elem(valoresInf, "tpBM")),
        vCalcDR: num(elem(valoresInf, "vCalcDR")),
        vTotalRet: num(elem(valoresInf, "vTotalRet")),
      },
      IBSCBS: montarIBSCBSResp(objeto(elem(inf, "IBSCBS"))),
    },
  };
}

function montarEmitente(emit: No): NFSe["InfNFSe"]["emit"] {
  const enderNac = objeto(elem(emit, "enderNac")) ?? {};
  const str = (n: string) => texto(elem(emit, n));
  return {
    CNPJ: str("CNPJ"),
    CPF: str("CPF"),
    NIF: str("NIF"),
    cNaoNIF: int(elem(emit, "cNaoNIF")),
    IM: str("IM"),
    xNome: str("xNome"),
    xFant: str("xFant"),
    fone: str("fone"),
    email: str("email"),
    enderNac: montarEndereco(enderNac),
    enderExt: objeto(elem(emit, "enderExt"))
      ? {
          xCidade: texto(elem(objeto(elem(emit, "enderExt"))!, "xCidade")),
          cPais: texto(elem(objeto(elem(emit, "enderExt"))!, "cPais")),
          cEndPost: texto(elem(objeto(elem(emit, "enderExt"))!, "cEndPost")),
        }
      : null,
  };
}

function montarEndereco(end: No): NFSe["InfNFSe"]["emit"]["enderNac"] {
  const str = (n: string) => texto(elem(end, n));
  return { xLgr: str("xLgr"), nro: str("nro"), xCpl: str("xCpl"), xBairro: str("xBairro"), xMun: str("xMun"), cMun: str("cMun"), UF: str("UF"), CEP: str("CEP") };
}

function montarEnderecoTomador(end: No | null): EnderecoTomador | null {
  if (!end) return null;
  const str = (n: string) => texto(elem(end, n));
  const endNac = objeto(elem(end, "endNac"));
  const endExt = objeto(elem(end, "endExt"));
  const endNacObj: EndNac | null = endNac
    ? {
        xLgr: texto(elem(endNac, "xLgr")),
        nro: texto(elem(endNac, "nro")),
        xCpl: texto(elem(endNac, "xCpl")),
        xBairro: texto(elem(endNac, "xBairro")),
        cMun: texto(elem(endNac, "cMun")),
        xMun: texto(elem(endNac, "xMun")),
        UF: texto(elem(endNac, "UF")),
        CEP: texto(elem(endNac, "CEP")),
      }
    : null;
  return {
    xLgr: str("xLgr"),
    nro: str("nro"),
    xCpl: str("xCpl"),
    xBairro: str("xBairro"),
    endNac: endNacObj,
    endExt: endExt
      ? { xCidade: texto(elem(endExt, "xCidade")), cPais: texto(elem(endExt, "cPais")), cEndPost: texto(elem(endExt, "cEndPost")) }
      : null,
  };
}

function montarParte(parte: No | null): NFSe["InfNFSe"]["DPS"]["infDPS"]["toma"] | null {
  if (!parte) return null;
  const str = (n: string) => texto(elem(parte, n));
  return {
    CNPJ: str("CNPJ"),
    CPF: str("CPF"),
    NIF: str("NIF"),
    cNaoNIF: int(elem(parte, "cNaoNIF")),
    IM: str("IM"),
    xNome: str("xNome"),
    fone: str("fone"),
    email: str("email"),
    end: montarEnderecoTomador(objeto(elem(parte, "end"))),
  };
}

function montarInfDPS(infDps: No, serv: No): NFSe["InfNFSe"]["DPS"]["infDPS"] {
  const valores = objeto(elem(infDps, "valores")) ?? {};
  const vServPrest = objeto(elem(valores, "vServPrest")) ?? {};
  const vDesc = objeto(elem(valores, "vDescCondIncond")) ?? {};
  const vDedRed = objeto(elem(valores, "vDedRed")) ?? {};
  const trib = objeto(elem(valores, "trib")) ?? {};
  const tribMun = objeto(elem(trib, "tribMun"));
  const tribFed = objeto(elem(trib, "tribFed"));
  const totTrib = objeto(elem(trib, "totTrib")) ?? {};
  const vTotTrib = objeto(elem(totTrib, "vTotTrib")) ?? {};
  const pTotTrib = objeto(elem(totTrib, "pTotTrib")) ?? {};
  const exigSusp = tribMun ? objeto(elem(tribMun, "exigSusp")) : null;
  const bm = tribMun ? objeto(elem(tribMun, "BM")) : null;
  const pisCofins = tribFed ? objeto(elem(tribFed, "piscofins")) : null;
  const prest = objeto(elem(infDps, "prest"));
  const regTrib = prest ? objeto(elem(prest, "regTrib")) : null;
  const infoCompl = objeto(elem(serv, "infoCompl")) ?? {};
  const cServ = objeto(elem(serv, "cServ")) ?? {};
  const locPrest = objeto(elem(serv, "locPrest")) ?? {};
  const obra = objeto(elem(serv, "obra"));
  const atvEvento = objeto(elem(serv, "atvEvento"));
  const subst = objeto(elem(infDps, "subst"));

  // Id da infDPS (atributo)
  const idDps = (() => {
    for (const [k, v] of Object.entries(infDps)) {
      if (k.startsWith("@_") && k.replace(/^.*:/, "").toLowerCase() === "@_id") return String(v);
    }
    return undefined;
  })();

  return {
    Id: idDps,
    nDPS: texto(elem(infDps, "nDPS")),
    serie: texto(elem(infDps, "serie")),
    dhEmi: texto(elem(infDps, "dhEmi")),
    dCompet: texto(elem(infDps, "dCompet")),
    cLocEmi: texto(elem(infDps, "cLocEmi")),
    xUFEmi: texto(elem(infDps, "xUFEmi")),
    tpEmit: int(elem(infDps, "tpEmit")),
    tpAmb: int(elem(infDps, "tpAmb")),
    prest: prest && regTrib
      ? {
          regTrib: {
            opSimpNac: int(elem(regTrib, "opSimpNac")),
            regApTribSN: int(elem(regTrib, "regApTribSN")),
            regEspTrib: int(elem(regTrib, "regEspTrib")),
          },
        }
      : null,
    toma: montarParte(objeto(elem(infDps, "toma"))),
    interm: (() => {
      const interm = objeto(elem(infDps, "interm"));
      if (!interm) return null;
      const str = (n: string) => texto(elem(interm, n));
      return {
        CNPJ: str("CNPJ"),
        CPF: str("CPF"),
        NIF: str("NIF"),
        cNaoNIF: int(elem(interm, "cNaoNIF")),
        IM: str("IM"),
        xNome: str("xNome"),
        fone: str("fone"),
        email: str("email"),
        end: (() => {
          const end = objeto(elem(interm, "end"));
          if (!end) return undefined;
          const endNac = objeto(elem(end, "endNac"));
          const str2 = (n: string) => texto(elem(end, n));
          return {
            xLgr: str2("xLgr"),
            nro: str2("nro"),
            xCpl: str2("xCpl"),
            xBairro: str2("xBairro"),
            endNac: endNac
              ? {
                  xLgr: texto(elem(endNac, "xLgr")),
                  nro: texto(elem(endNac, "nro")),
                  xCpl: texto(elem(endNac, "xCpl")),
                  xBairro: texto(elem(endNac, "xBairro")),
                  cMun: texto(elem(endNac, "cMun")),
                  xMun: texto(elem(endNac, "xMun")),
                  UF: texto(elem(endNac, "UF")),
                  CEP: texto(elem(endNac, "CEP")),
                }
              : null,
            endExt: null,
          };
        })(),
      };
    })(),
    serv: {
      cServ: {
        cTribNac: texto(elem(cServ, "cTribNac")),
        cTribMun: texto(elem(cServ, "cTribMun")),
        xDescServ: texto(elem(cServ, "xDescServ")),
        cNBS: texto(elem(cServ, "cNBS")),
      },
      obra: obra
        ? { cObra: texto(elem(obra, "cObra")), inscImobFisc: texto(elem(obra, "inscImobFisc")) }
        : undefined,
      infoCompl: {
        xInfComp: texto(elem(infoCompl, "xInfComp")),
        idDocTec: texto(elem(infoCompl, "idDocTec")),
        docRef: texto(elem(infoCompl, "docRef")),
        xPed: texto(elem(infoCompl, "xPed")),
        xOutInf: texto(elem(infoCompl, "xOutInf")),
      },
      locPrest: {
        cLocPrestacao: texto(elem(locPrest, "cLocPrestacao")),
        cPaisPrestacao: texto(elem(locPrest, "cPaisPrestacao")),
        UF: texto(elem(locPrest, "UF")),
        pais: texto(elem(locPrest, "pais")),
      },
      atvEvento: atvEvento ? { idAtvEvt: texto(elem(atvEvento, "idAtvEvt")) } : undefined,
    },
    valores: {
      vServPrest: { vServ: num(elem(vServPrest, "vServ")) },
      vDescCondIncond: {
        vDescCond: num(elem(vDesc, "vDescCond")),
        vDescIncond: num(elem(vDesc, "vDescIncond")),
      },
      vDedRed: { pDR: num(elem(vDedRed, "pDR")), vDR: num(elem(vDedRed, "vDR")) },
      trib: {
        tribMun: tribMun
          ? {
              tribISSQN: int(elem(tribMun, "tribISSQN")),
              tpRetISSQN: int(elem(tribMun, "tpRetISSQN")),
              cPaisResult: texto(elem(tribMun, "cPaisResult")),
              tpImunidade: int(elem(tribMun, "tpImunidade")),
              exigSusp: exigSusp
                ? { tpSusp: int(elem(exigSusp, "tpSusp")), nProcesso: texto(elem(exigSusp, "nProcesso")) }
                : { tpSusp: 0 },
              BM: bm ? { nBM: texto(elem(bm, "nBM")), vRedBCBM: num(elem(bm, "vRedBCBM")) } : undefined,
            }
          : null,
        tribFed: tribFed
          ? {
              vRetIRRF: num(elem(tribFed, "vRetIRRF")),
              vRetCSLL: num(elem(tribFed, "vRetCSLL")),
              vRetCP: num(elem(tribFed, "vRetCP")),
              piscofins: pisCofins
                ? {
                    vBCPisCofins: num(elem(pisCofins, "vBCPisCofins")),
                    vCofins: num(elem(pisCofins, "vCofins")),
                    vPis: num(elem(pisCofins, "vPis")),
                    tpRetPisCofins: int(elem(pisCofins, "tpRetPisCofins")),
                  }
                : null,
            }
          : null,
        totTrib: {
          vTotTrib: {
            vTotTribFed: num(elem(vTotTrib, "vTotTribFed")),
            vTotTribEst: num(elem(vTotTrib, "vTotTribEst")),
            vTotTribMun: num(elem(vTotTrib, "vTotTribMun")),
          },
          pTotTrib: {
            pTotTribFed: num(elem(pTotTrib, "pTotTribFed")),
            pTotTribEst: num(elem(pTotTrib, "pTotTribEst")),
            pTotTribMun: num(elem(pTotTrib, "pTotTribMun")),
          },
        },
      },
    },
    subst: subst ? { chSubstda: texto(elem(subst, "chSubstda")) } : undefined,
    IBSCBS: montarIBSCBSDPS(objeto(elem(infDps, "IBSCBS"))),
  };
}

function montarIBSCBSDPS(no: No | null): NFSe["InfNFSe"]["DPS"]["infDPS"]["IBSCBS"] {
  if (!no) return null;
  const finNFSePtr = numPtr(elem(no, "finNFSe"));
  const imovel = objeto(elem(no, "imovel"));
  const dest = objeto(elem(no, "dest"));
  const valores = objeto(elem(no, "valores")) ?? {};
  const trib = objeto(elem(valores, "trib")) ?? {};
  const g = objeto(elem(trib, "gIBSCBS")) ?? {};
  return {
    finNFSe: finNFSePtr,
    cIndOp: texto(elem(no, "cIndOp")),
    imovel: imovel ? { inscImobFisc: texto(elem(imovel, "inscImobFisc")) } : null,
    dest: dest
      ? {
          CNPJ: texto(elem(dest, "CNPJ")),
          CPF: texto(elem(dest, "CPF")),
          NIF: texto(elem(dest, "NIF")),
          xNome: texto(elem(dest, "xNome")),
          fone: texto(elem(dest, "fone")),
          email: texto(elem(dest, "email")),
          end: montarEnderecoTomador(objeto(elem(dest, "end"))),
        }
      : null,
    valores: {
      trib: { gIBSCBS: { CST: texto(elem(g, "CST")), cClassTrib: texto(elem(g, "cClassTrib")) } },
    },
  };
}

function montarIBSCBSResp(no: No | null): NFSe["InfNFSe"]["IBSCBS"] {
  if (!no) return null;
  const valores = objeto(elem(no, "valores")) ?? {};
  const uf = objeto(elem(valores, "uf")) ?? {};
  const mun = objeto(elem(valores, "mun")) ?? {};
  const fed = objeto(elem(valores, "fed")) ?? {};
  const tot = objeto(elem(no, "totCIBS")) ?? {};
  const gIBS = objeto(elem(tot, "gIBS")) ?? {};
  const gCBS = objeto(elem(tot, "gCBS")) ?? {};
  const gMun = objeto(elem(gIBS, "gIBSMunTot")) ?? {};
  const gUF = objeto(elem(gIBS, "gIBSUFTot")) ?? {};
  return {
    xLocalidadeIncid: texto(elem(no, "xLocalidadeIncid")),
    uf: texto(elem(no, "uf")),
    cLocalidadeIncid: texto(elem(no, "cLocalidadeIncid")),
    valores: {
      vBC: num(elem(valores, "vBC")),
      vCalcReeRepRes: num(elem(valores, "vCalcReeRepRes")),
      uf: {
        pIBSUF: numPtr(elem(uf, "pIBSUF")),
        pAliqEfetUF: numPtr(elem(uf, "pAliqEfetUF")),
        pRedAliqUF: numPtr(elem(uf, "pRedAliqUF")),
      },
      mun: {
        pIBSMun: numPtr(elem(mun, "pIBSMun")),
        pAliqEfetMun: numPtr(elem(mun, "pAliqEfetMun")),
        pRedAliqMun: numPtr(elem(mun, "pRedAliqMun")),
      },
      fed: {
        pCBS: numPtr(elem(fed, "pCBS")),
        pAliqEfetCBS: numPtr(elem(fed, "pAliqEfetCBS")),
        pRedAliqCBS: numPtr(elem(fed, "pRedAliqCBS")),
      },
    },
    totCIBS: {
      gIBS: {
        vIBSTot: num(elem(gIBS, "vIBSTot")),
        gIBSMunTot: { vIBSMun: numPtr(elem(gMun, "vIBSMun")) },
        gIBSUFTot: { vIBSUF: numPtr(elem(gUF, "vIBSUF")) },
      },
      gCBS: { vCBS: num(elem(gCBS, "vCBS")) },
      vTotNF: num(elem(tot, "vTotNF")),
    },
  };
}

// ─── Enriquecimento e cálculos (preparation.go) ──────────────────────────────

function resolver(codigo: string | undefined): { nome: string; uf: string } | null {
  if (!codigo) return null;
  const cod = parseInt(codigo, 10);
  if (!Number.isFinite(cod)) return null;
  const m = buscarMunicipio(cod);
  if (!m) return null;
  return { nome: m.Nome, uf: m.UFSigla };
}

function enriquecerMunicipios(nota: NFSe): void {
  const inc = resolver(nota.InfNFSe.cLocIncid);
  if (inc) {
    nota.InfNFSe.xLocIncid = inc.nome;
    nota.InfNFSe.xUFIncid = inc.uf;
  }
  const emit = resolver(nota.InfNFSe.emit.enderNac?.cMun);
  if (emit && nota.InfNFSe.emit.enderNac) {
    nota.InfNFSe.emit.enderNac.xMun = emit.nome;
    nota.InfNFSe.emit.enderNac.UF = emit.uf;
  }
  const toma = nota.InfNFSe.DPS.infDPS.toma;
  const tomaEnd = resolver(toma?.end?.endNac?.cMun);
  if (toma && toma.end?.endNac && tomaEnd) {
    toma.end.endNac.xMun = tomaEnd.nome;
    toma.end.endNac.UF = tomaEnd.uf;
  }
  const dest = nota.InfNFSe.DPS.infDPS.IBSCBS?.dest;
  const destEnd = resolver(dest?.end?.endNac?.cMun);
  if (dest?.end?.endNac && destEnd) {
    dest.end.endNac.xMun = destEnd.nome;
    dest.end.endNac.UF = destEnd.uf;
  }
  const interm = nota.InfNFSe.DPS.infDPS.interm;
  const intermEnd = resolver(interm?.end?.endNac?.cMun);
  if (interm?.end?.endNac && intermEnd) {
    interm.end.endNac.xMun = intermEnd.nome;
    interm.end.endNac.UF = intermEnd.uf;
  }
  const ibscbs = nota.InfNFSe.IBSCBS;
  const locIncid = resolver(ibscbs?.cLocalidadeIncid);
  if (ibscbs && locIncid) {
    ibscbs.xLocalidadeIncid = locIncid.nome;
    ibscbs.uf = locIncid.uf;
  }
  const locPrest = nota.InfNFSe.DPS.infDPS.serv.locPrest;
  const lp = resolver(locPrest.cLocPrestacao);
  if (lp) locPrest.UF = lp.uf;
}

function calcularExclusoesReducoesBC(nota: NFSe): void {
  const valoresDps = nota.InfNFSe.DPS.infDPS.valores;
  let total =
    valoresDps.vDescCondIncond.vDescIncond +
    nota.InfNFSe.valores.vISSQN +
    nota.InfNFSe.valores.vCalcDR;
  if (nota.InfNFSe.IBSCBS) total += nota.InfNFSe.IBSCBS.valores.vCalcReeRepRes;
  const pis = valoresDps.trib.tribFed?.piscofins;
  if (valoresDps.trib.tribFed && pis) {
    total += pis.vPis + pis.vCofins;
  }
  nota.VExclusoesReducoesBC = total;
}

/** Linha fixa de totais aproximados (Lei 12.741/2012) — danfse_tax_totals.go. */
function montarLinhaTotaisTributos(nota: NFSe): string {
  const t = nota.InfNFSe.DPS.infDPS.valores.trib.totTrib;
  const { vTotTribFed, vTotTribEst, vTotTribMun } = t.vTotTrib;
  if (vTotTribFed > 0 || vTotTribEst > 0 || vTotTribMun > 0) {
    return (
      `Totais aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: ${formatarMoeda(vTotTribFed)}; ` +
      `Estaduais: ${formatarMoeda(vTotTribEst)}; Municipais: ${formatarMoeda(vTotTribMun)};`
    );
  }
  const { pTotTribFed, pTotTribEst, pTotTribMun } = t.pTotTrib;
  if (pTotTribFed > 0 || pTotTribEst > 0 || pTotTribMun > 0) {
    return (
      `Totais aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: ${formatarPercentual(pTotTribFed)}; ` +
      `Estaduais: ${formatarPercentual(pTotTribEst)}; Municipais: ${formatarPercentual(pTotTribMun)};`
    );
  }
  return "Totais aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: R$ 0,00; Estaduais: R$ 0,00; Municipais: R$ 0,00;";
}

interface CampoCompl {
  label: string;
  valor: string;
}

function montarTextoCompl(nota: NFSe): string {
  const dps = nota.InfNFSe.DPS.infDPS;
  let inscImob = (dps.serv.obra?.inscImobFisc ?? "").trim();
  if (inscImob === "" && dps.IBSCBS?.imovel) {
    inscImob = (dps.IBSCBS.imovel.inscImobFisc ?? "").trim();
  }
  const grupos: CampoCompl[][] = [
    [{ label: "Inf. Cont.:", valor: (dps.serv.infoCompl.xInfComp ?? "").trim() }],
    [{ label: "NFS-e Subst.:", valor: (dps.subst?.chSubstda ?? "").trim() }],
    [{ label: "Doc. Ref.:", valor: (dps.serv.infoCompl.docRef ?? "").trim() }],
    [
      { label: "Cod. Obra:", valor: (dps.serv.obra?.cObra ?? "").trim() },
      { label: "Insc. Imob.:", valor: inscImob },
    ],
    [{ label: "Cod. Evt.:", valor: (dps.serv.atvEvento?.idAtvEvt ?? "").trim() }],
    [{ label: "Doc. Tec.:", valor: (dps.serv.infoCompl.idDocTec ?? "").trim() }],
    [{ label: "Núm. Ped.:", valor: (dps.serv.infoCompl.xPed ?? "").trim() }, { label: "Item Ped.:", valor: "" }, { label: "Inf. A. T. Mun.:", valor: (dps.serv.infoCompl.xOutInf ?? "").trim() }],
  ];
  const partes: string[] = [];
  for (const grupo of grupos) {
    for (const c of grupo) {
      if (c.valor !== "") partes.push(`${c.label} ${c.valor}`);
    }
  }
  return partes.join(" | ");
}

/** NT-008: truncamento da descrição complementar preservando a linha de totais. */
function truncarTextoComplPreservandoTotais(
  textoBase: string,
  linhaTributos: string,
  limite: number,
): string {
  if (textoBase === "") return linhaTributos;
  const runes = Array.from(textoBase);
  if (runes.length <= limite - 3) {
    return linhaTributos === "" ? textoBase : `${textoBase} | ${linhaTributos}`;
  }
  const limiteDescricao = Math.max(limite - 3, 0);
  const descricao = runes.slice(0, limiteDescricao).join("").replace(/[ \n]+$/, "") + "...";
  return linhaTributos === "" ? descricao : `${descricao} | ${linhaTributos}`;
}

function calcularLinhas(nota: NFSe): void {
  const textoDescricaoServico = (nota.InfNFSe.DPS.infDPS.serv.cServ.xDescServ ?? "").trim();
  const textoBase = montarTextoCompl(nota);
  const linhaTributos = montarLinhaTotaisTributos(nota);

  const textoInformacoesComplementares =
    textoBase === "" ? linhaTributos : `${textoBase} | ${linhaTributos}`;

  nota.TextoDescServOriginal = textoDescricaoServico;
  nota.TextoComplOriginal = textoInformacoesComplementares;
  nota.ExibicaoDescServ = truncarComReticencias(textoDescricaoServico, MAX_CARACTERES_DESCRICAO - 3);
  nota.ExibicaoLinhaTributos = linhaTributos;
  nota.ExibicaoCompl = truncarTextoComplPreservandoTotais(
    textoBase,
    linhaTributos,
    MAX_CARACTERES_INFO_COMPL,
  );
}
