/**
 * Presenter — porte fiel de danfse_presenter.go: mapeia NFSe enriquecido →
 * DocumentoDanfse pronto para renderização. Puro, sem I/O.
 */
import type { DocumentoDanfse, NFSe, SecaoParte } from "../domain/tipos.js";
import {
  formatarCodigoIBGECEP,
  formatarCodigoTributacaoNacional,
  formatarData,
  formatarDataHora,
  formatarDocumento,
  formatarMunicipioUF,
  formatarNBS,
  formatarPercentualOuTraco,
  formatarNumeroPercentualOuTraco,
  formatarTelefone,
  formatarValorMonetario,
  formatarValorMonetarioOuTraco,
  mapearAmbienteGerador,
  mapearCStat,
  mapearFinalidadeNFSe,
  mapearOpcaoSimplesNacional,
  mapearRegimeApuracaoSN,
  mapearRegimeEspecialTributacao,
  mapearSuspensaoExigibilidade,
  mapearTipoAmbiente,
  mapearTipoBeneficioMunicipal,
  mapearTipoEmitente,
  mapearTipoImunidade,
  mapearTipoRetencaoISSQN,
  mapearTipoRetencaoPISCOFINS,
  mapearTributacaoISSQN,
  montarEndereco,
  primeiroNaoVazio,
  tracoSeVazio,
} from "../domain/format.js";

export function apresentar(nota: NFSe): DocumentoDanfse {
  return {
    MarcaDagua: {
      Texto: nota.MarcaDagua,
      TamanhoFonte: 60,
      ColorR: 0.35,
      ColorG: 0.35,
      ColorB: 0.35,
      Angulo: 45,
      Opacidade: 0.35,
    },
    Cabecalho: {
      MarcaDagua: nota.MarcaDagua,
      ExibicaoDescServ: nota.ExibicaoDescServ,
      ExibicaoCompl: nota.ExibicaoCompl,
      ExibicaoLinhaTributos: nota.ExibicaoLinhaTributos,
      Municipio: nota.InfNFSe.emit.enderNac?.xMun ?? "",
      UF: nota.InfNFSe.emit.enderNac?.UF ?? "",
      AmbienteGerador: mapearAmbienteGerador(nota.InfNFSe.ambGer),
      TipoAmbiente: mapearTipoAmbiente(nota.InfNFSe.DPS.infDPS.tpAmb),
    },
    Acesso: montarAcesso(nota),
    Partes: montarPartes(nota),
    Servico: montarServico(nota),
    Tributacoes: {
      Municipal: montarTributacaoMunicipal(nota),
      Federal: montarTributacaoFederal(nota),
      IBSCBS: montarTributacaoIBSCBS(nota),
    },
    Totais: montarTotais(nota),
    InformacoesComplementares: {
      Conteudo: nota.ExibicaoCompl,
      ConteudoOriginal: nota.TextoComplOriginal,
      LinhaTributos: nota.ExibicaoLinhaTributos,
      Visivel: true,
    },
    Canhoto: { Visivel: true },
  };
}

function montarAcesso(nota: NFSe): DocumentoDanfse["Acesso"] {
  const dps = nota.InfNFSe.DPS.infDPS;
  let finalidade = "-";
  if (dps.IBSCBS && dps.IBSCBS.finNFSe !== null && dps.IBSCBS.finNFSe !== undefined) {
    finalidade = mapearFinalidadeNFSe(dps.IBSCBS.finNFSe);
  }
  return {
    ChaveAcesso: tracoSeVazio(nota.InfNFSe.Id.replaceAll("NFS", "")),
    CodigoQR: nota.InfNFSe.qrcode ?? "",
    NumeroNFSe: tracoSeVazio(nota.InfNFSe.nNFSe ?? ""),
    Competencia: formatarData(dps.dCompet ?? ""),
    DataHoraEmissaoNFSe: formatarDataHora(nota.InfNFSe.dhProc ?? ""),
    NumeroDPS: tracoSeVazio(dps.nDPS ?? ""),
    SerieDPS: tracoSeVazio(dps.serie ?? ""),
    DataHoraEmissaoDPS: formatarDataHora(dps.dhEmi ?? ""),
    TipoEmitente: mapearTipoEmitente(dps.tpEmit),
    Situacao: mapearCStat(nota.InfNFSe.cStat),
    Finalidade: finalidade,
  };
}

function montarPartes(nota: NFSe): DocumentoDanfse["Partes"] {
  const dps = nota.InfNFSe.DPS.infDPS;
  const destinatario = montarDestinatario(nota);
  return {
    Emitente: montarEmitente(nota),
    Tomador: dps.toma
      ? montarTomador(dps.toma)
      : { ...parteVazia(), MensagemSupressao: "TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e" },
    Destinatario:
      destinatario.Visivel || destinatario.MensagemSupressao !== ""
        ? destinatario
        : { ...parteVazia(), MensagemSupressao: "DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e" },
    Intermediario: dps.interm
      ? montarIntermediario(dps.interm)
      : { ...parteVazia(), MensagemSupressao: "INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e" },
  };
}

function parteVazia(): SecaoParte {
  return {
    Titulo: "",
    CNPJCPFNIF: "",
    InscricaoMunicipal: "",
    Telefone: "",
    Nome: "",
    MunicipioUF: "",
    CodigoIBGECEP: "",
    Endereco: "",
    Email: "",
    Visivel: false,
    MensagemSupressao: "",
    SimplesNacional: "",
    RegimeApuracaoSN: "",
  };
}

function montarEmitente(nota: NFSe): SecaoParte {
  const dps = nota.InfNFSe.DPS.infDPS;
  const e = nota.InfNFSe.emit;
  const end = e.enderNac ?? {};
  let simplesNacional = "-";
  let regimeApuracaoSN = "-";
  if (dps.prest) {
    simplesNacional = mapearOpcaoSimplesNacional(dps.prest.regTrib.opSimpNac);
    regimeApuracaoSN = mapearRegimeApuracaoSN(dps.prest.regTrib.regApTribSN);
  }
  return {
    Titulo: "PRESTADOR / FORNECEDOR",
    CNPJCPFNIF: tracoSeVazio(formatarDocumento(primeiroNaoVazio(e.CNPJ, e.CPF, e.NIF))),
    InscricaoMunicipal: tracoSeVazio(e.IM ?? ""),
    Telefone: tracoSeVazio(formatarTelefone(e.fone ?? "")),
    Nome: tracoSeVazio(e.xNome ?? ""),
    MunicipioUF: formatarMunicipioUF(end.xMun ?? "", end.UF ?? ""),
    CodigoIBGECEP: formatarCodigoIBGECEP(end.cMun ?? "", end.CEP ?? ""),
    Endereco: tracoSeVazio(montarEndereco(end.xLgr, end.nro, end.xCpl, end.xBairro)),
    Email: tracoSeVazio(e.email ?? ""),
    Visivel: true,
    SimplesNacional: simplesNacional,
    RegimeApuracaoSN: regimeApuracaoSN,
    MensagemSupressao: "",
  };
}

function montarTomador(t: NonNullable<NFSe["InfNFSe"]["DPS"]["infDPS"]["toma"]>): SecaoParte {
  const endNac = t.end?.endNac;
  return {
    Titulo: "TOMADOR / ADQUIRENTE",
    CNPJCPFNIF: tracoSeVazio(formatarDocumento(primeiroNaoVazio(t.CNPJ, t.CPF, t.NIF))),
    InscricaoMunicipal: tracoSeVazio(t.IM ?? ""),
    Telefone: tracoSeVazio(formatarTelefone(t.fone ?? "")),
    Nome: tracoSeVazio(t.xNome ?? ""),
    MunicipioUF: endNac ? formatarMunicipioUF(endNac.xMun ?? "", endNac.UF ?? "") : "-",
    CodigoIBGECEP: endNac ? formatarCodigoIBGECEP(endNac.cMun ?? "", endNac.CEP ?? "") : "-",
    Endereco: t.end
      ? tracoSeVazio(montarEndereco(t.end.xLgr, t.end.nro, t.end.xCpl, t.end.xBairro))
      : "-",
    Email: tracoSeVazio(t.email ?? ""),
    Visivel: true,
    MensagemSupressao: "",
    SimplesNacional: "",
    RegimeApuracaoSN: "",
  };
}

function montarDestinatario(nota: NFSe): SecaoParte {
  const dps = nota.InfNFSe.DPS.infDPS;
  const dest = dps.IBSCBS?.dest;
  if (!dps.IBSCBS || !dest) {
    return parteVazia();
  }
  if (destinatarioEhTomador(nota)) {
    return {
      ...parteVazia(),
      MensagemSupressao: "O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO",
    };
  }
  const endNac = dest.end?.endNac;
  return {
    Titulo: "DESTINATÁRIO DA OPERAÇÃO",
    CNPJCPFNIF: tracoSeVazio(formatarDocumento(primeiroNaoVazio(dest.CNPJ, dest.CPF, dest.NIF))),
    InscricaoMunicipal: "",
    Telefone: tracoSeVazio(formatarTelefone(dest.fone ?? "")),
    Nome: tracoSeVazio(dest.xNome ?? ""),
    MunicipioUF: endNac ? formatarMunicipioUF(endNac.xMun ?? "", endNac.UF ?? "") : "-",
    CodigoIBGECEP: endNac ? formatarCodigoIBGECEP(endNac.cMun ?? "", endNac.CEP ?? "") : "-",
    Endereco: dest.end
      ? tracoSeVazio(montarEndereco(dest.end.xLgr, dest.end.nro, dest.end.xCpl, dest.end.xBairro))
      : "-",
    Email: tracoSeVazio(dest.email ?? ""),
    Visivel: true,
    MensagemSupressao: "",
    SimplesNacional: "",
    RegimeApuracaoSN: "",
  };
}

function montarIntermediario(i: NonNullable<NFSe["InfNFSe"]["DPS"]["infDPS"]["interm"]>): SecaoParte {
  const endNac = i.end?.endNac;
  return {
    Titulo: "INTERMEDIÁRIO DA OPERAÇÃO",
    CNPJCPFNIF: tracoSeVazio(formatarDocumento(primeiroNaoVazio(i.CNPJ, i.CPF, i.NIF))),
    InscricaoMunicipal: tracoSeVazio(i.IM ?? ""),
    Telefone: tracoSeVazio(formatarTelefone(i.fone ?? "")),
    Nome: tracoSeVazio(i.xNome ?? ""),
    MunicipioUF: endNac ? formatarMunicipioUF(endNac.xMun ?? "", endNac.UF ?? "") : "-",
    CodigoIBGECEP: endNac ? formatarCodigoIBGECEP(endNac.cMun ?? "", endNac.CEP ?? "") : "-",
    Endereco: tracoSeVazio(montarEndereco(i.end?.xLgr, i.end?.nro, i.end?.xCpl, i.end?.xBairro)),
    Email: tracoSeVazio(i.email ?? ""),
    Visivel: true,
    MensagemSupressao: "",
    SimplesNacional: "",
    RegimeApuracaoSN: "",
  };
}

function montarServico(nota: NFSe): DocumentoDanfse["Servico"] {
  const dps = nota.InfNFSe.DPS.infDPS;
  const cs = dps.serv.cServ;
  return {
    CodigoTribNacMun: codigoTributacaoNacionalOuMunicipal(cs.cTribNac, cs.cTribMun),
    CodigoNBS: tracoSeVazio(formatarNBS(cs.cNBS ?? "")),
    LocalPrestacaoUF: combinarComBarra(
      nota.InfNFSe.xLocPrestacao ?? "",
      dps.serv.locPrest.UF ?? "",
      codigoPaisOuBR(dps.serv.locPrest.cPaisPrestacao),
    ),
    XTribNac: tracoSeVazio(primeiroNaoVazio(nota.InfNFSe.xTribMun, nota.InfNFSe.xTribNac)),
    DescServ: nota.ExibicaoDescServ,
    DescServOriginal: nota.TextoDescServOriginal,
  };
}

function codigoTributacaoNacionalOuMunicipal(nacional?: string, municipal?: string): string {
  const nac = (nacional ?? "").trim();
  const mun = (municipal ?? "").trim();
  if (nac === "") return mun;
  if (mun === "") return formatarCodigoTributacaoNacional(nac);
  return `${formatarCodigoTributacaoNacional(nac)} / ${mun}`;
}

function montarTributacaoMunicipal(nota: NFSe): DocumentoDanfse["Tributacoes"]["Municipal"] {
  const dps = nota.InfNFSe.DPS.infDPS;
  const trib = dps.valores.trib.tribMun ?? {
    tribISSQN: 0,
    tpRetISSQN: 0,
    tpImunidade: 0,
    exigSusp: { tpSusp: 0 },
  };

  let calculoBM = nota.InfNFSe.valores.vCalcBM;
  if (calculoBM === 0) calculoBM = trib.BM?.vRedBCBM ?? 0;

  const regEsp = dps.prest ? dps.prest.regTrib.regEspTrib : 0;
  const exibirOpcionais =
    nota.InfNFSe.valores.tpBM > 0 ||
    nota.InfNFSe.valores.vCalcBM > 0 ||
    dps.valores.vDedRed.vDR > 0 ||
    dps.valores.vDescCondIncond.vDescIncond > 0;

  const retorno: DocumentoDanfse["Tributacoes"]["Municipal"] = {
    TribISSQN: mapearTributacaoISSQN(trib.tribISSQN),
    MunicipioUFPAISIncid: combinarComBarra(
      nota.InfNFSe.xLocIncid ?? "",
      nota.InfNFSe.xUFIncid ?? "",
      codigoPaisOuBR(trib.cPaisResult),
    ),
    RegEspTrib: mapearRegimeEspecialTributacao(regEsp),
    TpImunidade: mapearTipoImunidade(trib.tpImunidade),
    SuspensaoExig: mapearSuspensaoExigibilidade(trib.exigSusp?.tpSusp ?? 0),
    NProcessoSusp: tracoSeVazio(trib.exigSusp?.nProcesso ?? ""),
    BeneficioMunicipal: mapearTipoBeneficioMunicipal(nota.InfNFSe.valores.tpBM),
    CalculoBM: formatarValorMonetarioOuTraco(calculoBM),
    TotalDeducoes: formatarValorMonetarioOuTraco(dps.valores.vDedRed.vDR),
    DescontoIncond: formatarValorMonetarioOuTraco(dps.valores.vDescCondIncond.vDescIncond),
    BCISSQN: formatarValorMonetarioOuTraco(nota.InfNFSe.valores.vBC),
    AliqAplic: formatarNumeroPercentualOuTraco(nota.InfNFSe.valores.pAliqAplic ?? 0),
    RetISSQN: mapearTipoRetencaoISSQN(trib.tpRetISSQN),
    ISSQNApurado: formatarValorMonetarioOuTraco(nota.InfNFSe.valores.vISSQN),
    Visivel: true,
    MensagemSupressao: "",
  };

  if (!exibirOpcionais) {
    retorno.BeneficioMunicipal = "-";
    retorno.CalculoBM = "-";
    retorno.TotalDeducoes = "-";
    retorno.DescontoIncond = "-";
  }

  if (!temDadosTributacaoMunicipal(nota, trib, regEsp, calculoBM)) {
    retorno.Visivel = false;
    retorno.MensagemSupressao = "TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN";
  }

  return retorno;
}

function temDadosTributacaoMunicipal(
  nota: NFSe,
  trib: NonNullable<NFSe["InfNFSe"]["DPS"]["infDPS"]["valores"]["trib"]["tribMun"]>,
  regEsp: number,
  calculoBM: number,
): boolean {
  return (
    trib.tribISSQN !== 0 ||
    (nota.InfNFSe.xLocIncid ?? "").trim() !== "" ||
    (nota.InfNFSe.xUFIncid ?? "").trim() !== "" ||
    (trib.cPaisResult ?? "").trim() !== "" ||
    regEsp !== 0 ||
    trib.tpImunidade !== 0 ||
    (trib.exigSusp?.tpSusp ?? 0) !== 0 ||
    (trib.exigSusp?.nProcesso ?? "").trim() !== "" ||
    nota.InfNFSe.valores.tpBM !== 0 ||
    calculoBM !== 0 ||
    nota.InfNFSe.DPS.infDPS.valores.vDedRed.vDR !== 0 ||
    nota.InfNFSe.DPS.infDPS.valores.vDescCondIncond.vDescIncond !== 0 ||
    nota.InfNFSe.valores.vBC !== 0 ||
    nota.InfNFSe.valores.pAliqAplic !== null ||
    trib.tpRetISSQN !== 0 ||
    nota.InfNFSe.valores.vISSQN !== 0
  );
}

function montarTributacaoFederal(nota: NFSe): DocumentoDanfse["Tributacoes"]["Federal"] {
  const dps = nota.InfNFSe.DPS.infDPS;
  const trib = dps.valores.trib.tribFed ?? { vRetIRRF: 0, vRetCSLL: 0, vRetCP: 0, piscofins: null };

  const retorno: DocumentoDanfse["Tributacoes"]["Federal"] = {
    IRRF: formatarValorMonetarioOuTraco(trib.vRetIRRF),
    ContribPrevidRet: formatarValorMonetarioOuTraco(trib.vRetCP),
    ContribSocRet: formatarValorMonetarioOuTraco(trib.vRetCSLL),
    PISDebito: "-",
    COFINSDebito: "-",
    DescContribRet: "-",
    ExibirPisCofins: exibirPisCofins(dps.dCompet ?? ""),
    Visivel: true,
  };

  if (trib.piscofins) {
    const tpRet = trib.piscofins.tpRetPisCofins;
    if (tpRet === 1) {
      // NT-008 v1.02 §2.4.5: tpRetPisCofins=1 → PIS/COFINS próprios = 0,00
      retorno.PISDebito = formatarValorMonetario(0);
      retorno.COFINSDebito = formatarValorMonetario(0);
      const sumCSLL = trib.vRetCSLL + trib.piscofins.vPis + trib.piscofins.vCofins;
      retorno.ContribSocRet = formatarValorMonetario(sumCSLL);
    } else {
      retorno.PISDebito = formatarValorMonetarioOuTraco(trib.piscofins.vPis);
      retorno.COFINSDebito = formatarValorMonetarioOuTraco(trib.piscofins.vCofins);
    }
    retorno.DescContribRet = mapearTipoRetencaoPISCOFINS(tpRet);
  }

  return retorno;
}

/** Competência ≤ 2026-12-31 exibe PIS/COFINS; vazia/inválida → true (compat). */
function exibirPisCofins(dCompet: string): boolean {
  if (dCompet === "") return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dCompet.trim());
  if (!m) return true;
  const ano = +m[1];
  const mes = +m[2];
  const dia = +m[3];
  if (ano < 2026) return true;
  if (ano > 2026) return false;
  return mes < 12 || (mes === 12 && dia <= 31);
}

function montarTributacaoIBSCBS(nota: NFSe): DocumentoDanfse["Tributacoes"]["IBSCBS"] {
  const dps = nota.InfNFSe.DPS.infDPS;
  const t = nota.InfNFSe.IBSCBS;

  let cst = "-";
  let cClassTrib = "-";
  let cIndOp = "-";
  if (nota.InfNFSe.IBSCBS && dps.IBSCBS) {
    cst = tracoSeVazio(dps.IBSCBS.valores.trib.gIBSCBS.CST ?? "");
    cClassTrib = tracoSeVazio(dps.IBSCBS.valores.trib.gIBSCBS.cClassTrib ?? "");
    cIndOp = tracoSeVazio(dps.IBSCBS.cIndOp ?? "");
  }

  const valores = t?.valores ?? {
    vBC: 0,
    vCalcReeRepRes: 0,
    uf: {},
    mun: {},
    fed: {},
  };
  const tot = t?.totCIBS ?? {
    gIBS: { vIBSTot: 0, gIBSMunTot: {}, gIBSUFTot: {} },
    gCBS: { vCBS: 0 },
    vTotNF: 0,
  };
  const ptr = (v: number | null | undefined) => v ?? 0;

  return {
    CSTcClassTrib: combinarValoresComBarra(cst, cClassTrib),
    IndOpCodIBGELocalidadeUF: combinarValoresComBarra(
      cIndOp,
      tracoSeVazio(t?.cLocalidadeIncid ?? ""),
      tracoSeVazio(t?.xLocalidadeIncid ?? ""),
      tracoSeVazio(t?.uf ?? ""),
    ),
    ExclusoesReducoesBC: formatarValorMonetarioOuTraco(nota.VExclusoesReducoesBC),
    BCPosExclusoes: formatarValorMonetarioOuTraco(valores.vBC),
    RedAliqIBSRedAliqCBS: combinarValoresComBarra(
      formatarPercentualOuTraco(ptr(valores.uf?.pRedAliqUF)),
      formatarPercentualOuTraco(ptr(valores.mun?.pRedAliqMun)),
      formatarPercentualOuTraco(ptr(valores.fed?.pRedAliqCBS)),
    ),
    AliqIBSUFIBSMun: combinarValoresComBarra(
      formatarPercentualOuTraco(ptr(valores.uf?.pIBSUF)),
      formatarPercentualOuTraco(ptr(valores.mun?.pIBSMun)),
    ),
    AliqEfetMunIBS: formatarPercentualOuTraco(ptr(valores.mun?.pAliqEfetMun)),
    ValorMunIBS: formatarValorMonetarioOuTraco(ptr(tot.gIBS.gIBSMunTot?.vIBSMun)),
    AliqEfetEstIBS: formatarPercentualOuTraco(ptr(valores.uf?.pAliqEfetUF)),
    ValorEstIBS: formatarValorMonetarioOuTraco(ptr(tot.gIBS.gIBSUFTot?.vIBSUF)),
    ValorTotalIBS: formatarValorMonetarioOuTraco(tot.gIBS.vIBSTot),
    AliqCBS: formatarPercentualOuTraco(ptr(valores.fed?.pCBS)),
    AliqEfetCBS: formatarPercentualOuTraco(ptr(valores.fed?.pAliqEfetCBS)),
    ValorTotalCBS: formatarValorMonetarioOuTraco(tot.gCBS.vCBS),
    Visivel: true,
  };
}

function montarTotais(nota: NFSe): DocumentoDanfse["Totais"] {
  const dps = nota.InfNFSe.DPS.infDPS;
  const t = nota.InfNFSe.IBSCBS;
  let totalIBSCBS = "-";
  let valorLiquidoIBSCBS = "-";
  if (t) {
    const soma = t.totCIBS.gIBS.vIBSTot + t.totCIBS.gCBS.vCBS;
    if (soma !== 0) totalIBSCBS = formatarValorMonetarioOuTraco(soma);
    if (t.totCIBS.vTotNF !== 0) valorLiquidoIBSCBS = formatarValorMonetarioOuTraco(t.totCIBS.vTotNF);
  }
  return {
    ValorOperacaoServico: formatarValorMonetario(dps.valores.vServPrest.vServ),
    DescontoIncond: formatarValorMonetarioOuTraco(dps.valores.vDescCondIncond.vDescIncond),
    DescontoCond: formatarValorMonetarioOuTraco(dps.valores.vDescCondIncond.vDescCond),
    TotalRetencoes: formatarValorMonetarioOuTraco(nota.InfNFSe.valores.vTotalRet),
    ValorLiquido: formatarValorMonetario(nota.InfNFSe.valores.vLiq),
    TotalIBSCBS: totalIBSCBS,
    ValorLiquidoIBSCBS: valorLiquidoIBSCBS,
  };
}

// ─── Helpers puros ───────────────────────────────────────────────────────────

/** tracoSeVazio em cada parte + junta com " / "; nada informado → "-". */
function combinarComBarra(...valores: Array<string | null | undefined>): string {
  const partes: string[] = [];
  let temInformacao = false;
  for (const v of valores) {
    const parte = tracoSeVazio(v ?? "");
    if (parte !== "-") temInformacao = true;
    partes.push(parte);
  }
  return temInformacao ? partes.join(" / ") : "-";
}

/** Junta valores já formatados com " / "; vazio→"-"; nenhum real → "-". */
function combinarValoresComBarra(...valores: string[]): string {
  const partes: string[] = [];
  let temInformacao = false;
  for (const v of valores) {
    const trimmed = v.trim();
    if (trimmed === "") partes.push("-");
    else {
      partes.push(v);
      if (trimmed !== "-") temInformacao = true;
    }
  }
  return temInformacao ? partes.join(" / ") : "-";
}

function destinatarioEhTomador(nota: NFSe): boolean {
  const dps = nota.InfNFSe.DPS.infDPS;
  const toma = dps.toma;
  const dest = dps.IBSCBS?.dest;
  if (!toma || !dest) return false;
  const pares: Array<[string | undefined, string | undefined]> = [
    [toma.CNPJ, dest.CNPJ],
    [toma.CPF, dest.CPF],
    [toma.NIF, dest.NIF],
  ];
  for (const [a, b] of pares) {
    if (a !== undefined && a.trim() !== "" && a === b) return true;
  }
  return false;
}

/** trim + uppercase; vazio → "BR". */
function codigoPaisOuBR(s: string | undefined): string {
  const t = (s ?? "").trim();
  if (t === "") return "BR";
  return t.toUpperCase();
}
