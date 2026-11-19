/**
 * Contratos puros — porte de domain/presentation/danfse_document.go e
 * domain/models/models.go (estrutura da NFS-e Nacional/DPS).
 */

// ─── Apresentação (alimenta o renderer) ─────────────────────────────────────

export interface MarcaDagua {
  Texto: string;
  TamanhoFonte: number;
  ColorR: number;
  ColorG: number;
  ColorB: number;
  Angulo: number;
  Opacidade: number;
}

export interface DadosCabecalho {
  MarcaDagua?: string;
  ExibicaoDescServ?: string;
  ExibicaoCompl?: string;
  ExibicaoLinhaTributos?: string;
  Municipio: string;
  UF: string;
  AmbienteGerador: string;
  TipoAmbiente: string;
}

export interface DadosAcesso {
  ChaveAcesso: string;
  CodigoQR: string;
  NumeroNFSe: string;
  Competencia: string;
  DataHoraEmissaoNFSe: string;
  NumeroDPS: string;
  SerieDPS: string;
  DataHoraEmissaoDPS: string;
  TipoEmitente: string;
  Situacao: string;
  Finalidade: string;
}

export interface SecaoParte {
  Titulo: string;
  CNPJCPFNIF: string;
  InscricaoMunicipal: string;
  Telefone: string;
  Nome: string;
  MunicipioUF: string;
  CodigoIBGECEP: string;
  Endereco: string;
  Email: string;
  Visivel: boolean;
  MensagemSupressao: string;
  SimplesNacional: string;
  RegimeApuracaoSN: string;
}

export interface DadosPartes {
  Emitente: SecaoParte;
  Tomador: SecaoParte;
  Destinatario: SecaoParte;
  Intermediario: SecaoParte;
}

export interface DadosServico {
  CodigoTribNacMun: string;
  CodigoNBS: string;
  LocalPrestacaoUF: string;
  XTribNac: string;
  DescServ: string;
  DescServOriginal: string;
}

export interface DadosTributacaoMunicipal {
  TribISSQN: string;
  MunicipioUFPAISIncid: string;
  RegEspTrib: string;
  TpImunidade: string;
  SuspensaoExig: string;
  NProcessoSusp: string;
  BeneficioMunicipal: string;
  CalculoBM: string;
  TotalDeducoes: string;
  DescontoIncond: string;
  BCISSQN: string;
  AliqAplic: string;
  RetISSQN: string;
  ISSQNApurado: string;
  Visivel: boolean;
  MensagemSupressao: string;
}

export interface DadosTributacaoFederal {
  IRRF: string;
  ContribPrevidRet: string;
  ContribSocRet: string;
  PISDebito: string;
  COFINSDebito: string;
  DescContribRet: string;
  ExibirPisCofins: boolean;
  Visivel: boolean;
}

export interface DadosTributacaoIBSCBS {
  CSTcClassTrib: string;
  IndOpCodIBGELocalidadeUF: string;
  ExclusoesReducoesBC: string;
  BCPosExclusoes: string;
  RedAliqIBSRedAliqCBS: string;
  AliqIBSUFIBSMun: string;
  AliqEfetMunIBS: string;
  ValorMunIBS: string;
  AliqEfetEstIBS: string;
  ValorEstIBS: string;
  ValorTotalIBS: string;
  AliqCBS: string;
  AliqEfetCBS: string;
  ValorTotalCBS: string;
  Visivel: boolean;
}

export interface DadosTotais {
  ValorOperacaoServico: string;
  DescontoIncond: string;
  DescontoCond: string;
  TotalRetencoes: string;
  ValorLiquido: string;
  TotalIBSCBS: string;
  ValorLiquidoIBSCBS: string;
}

export interface DadosInformacoesComplementares {
  Conteudo: string;
  ConteudoOriginal: string;
  LinhaTributos: string;
  Visivel: boolean;
}

export interface DocumentoDanfse {
  MarcaDagua: MarcaDagua;
  Cabecalho: DadosCabecalho;
  Acesso: DadosAcesso;
  Partes: DadosPartes;
  Servico: DadosServico;
  Tributacoes: {
    Municipal: DadosTributacaoMunicipal;
    Federal: DadosTributacaoFederal;
    IBSCBS: DadosTributacaoIBSCBS;
  };
  Totais: DadosTotais;
  InformacoesComplementares: DadosInformacoesComplementares;
  Canhoto: { Visivel: boolean };
}

// ─── Models (espelho do XML — campos ausentes = null/0, como o encoding/xml) ─

export interface Endereco {
  xLgr?: string;
  nro?: string;
  xCpl?: string;
  xBairro?: string;
  xMun?: string;
  cMun?: string;
  UF?: string;
  CEP?: string;
}

export interface EndExt {
  xCidade?: string;
  cPais?: string;
  cEndPost?: string;
}

export interface RegTrib {
  opSimpNac: number;
  regApTribSN: number;
  regEspTrib: number;
}

export interface TribMun {
  tribISSQN: number;
  tpRetISSQN: number;
  cPaisResult?: string;
  tpImunidade: number;
  exigSusp?: { tpSusp: number; nProcesso?: string };
  BM?: { nBM?: string; vRedBCBM: number };
}

export interface PisCofins {
  vBCPisCofins: number;
  vCofins: number;
  vPis: number;
  tpRetPisCofins: number;
}

export interface TribFed {
  vRetIRRF: number;
  vRetCSLL: number;
  vRetCP: number;
  piscofins?: PisCofins | null;
}

export interface TotTrib {
  vTotTrib: { vTotTribFed: number; vTotTribEst: number; vTotTribMun: number };
  pTotTrib: { pTotTribFed: number; pTotTribEst: number; pTotTribMun: number };
}

export interface ValoresDPS {
  vServPrest: { vServ: number };
  vDescCondIncond: { vDescCond: number; vDescIncond: number };
  vDedRed: { pDR: number; vDR: number };
  trib: {
    tribMun?: TribMun | null;
    tribFed?: TribFed | null;
    totTrib: TotTrib;
  };
}

export interface Destinatario {
  CNPJ?: string;
  CPF?: string;
  NIF?: string;
  xNome?: string;
  fone?: string;
  email?: string;
  end?: EnderecoTomador | null;
}

export interface EndNac {
  xLgr?: string;
  nro?: string;
  xCpl?: string;
  xBairro?: string;
  cMun?: string;
  xMun?: string;
  UF?: string;
  CEP?: string;
}

export interface EnderecoTomador {
  xLgr?: string;
  nro?: string;
  xCpl?: string;
  xBairro?: string;
  endNac?: EndNac | null;
  endExt?: EndExt | null;
}

export interface Emitente {
  CNPJ?: string;
  CPF?: string;
  NIF?: string;
  cNaoNIF: number;
  IM?: string;
  xNome?: string;
  xFant?: string;
  fone?: string;
  email?: string;
  enderNac?: Endereco;
  enderExt?: EndExt | null;
}

export interface Tomador {
  CNPJ?: string;
  CPF?: string;
  NIF?: string;
  cNaoNIF: number;
  IM?: string;
  xNome?: string;
  fone?: string;
  email?: string;
  end?: EnderecoTomador | null;
}

export interface Interm {
  CNPJ?: string;
  CPF?: string;
  NIF?: string;
  cNaoNIF: number;
  IM?: string;
  xNome?: string;
  fone?: string;
  email?: string;
  end?: { xLgr?: string; nro?: string; xCpl?: string; xBairro?: string; endNac?: EndNac | null; endExt?: EndExt | null };
}

export interface CServ {
  cTribNac?: string;
  cTribMun?: string;
  xDescServ?: string;
  cNBS?: string;
}

export interface LocPrest {
  cLocPrestacao?: string;
  cPaisPrestacao?: string;
  UF?: string;
  pais?: string;
}

export interface InfoCompl {
  xInfComp?: string;
  idDocTec?: string;
  docRef?: string;
  xPed?: string;
  xOutInf?: string;
}

export interface IBSCBSDPS {
  finNFSe?: number | null;
  cIndOp?: string;
  imovel?: { inscImobFisc?: string } | null;
  dest?: Destinatario | null;
  valores: { trib: { gIBSCBS: { CST?: string; cClassTrib?: string } } };
}

export interface AliqIBSUF {
  pIBSUF?: number | null;
  pAliqEfetUF?: number | null;
  pRedAliqUF?: number | null;
}
export interface AliqIBSMun {
  pIBSMun?: number | null;
  pAliqEfetMun?: number | null;
  pRedAliqMun?: number | null;
}
export interface AliqCBS {
  pCBS?: number | null;
  pAliqEfetCBS?: number | null;
  pRedAliqCBS?: number | null;
}

export interface IBSCBSResp {
  xLocalidadeIncid?: string;
  uf?: string;
  cLocalidadeIncid?: string;
  valores: {
    vBC: number;
    vCalcReeRepRes: number;
    uf: AliqIBSUF;
    mun: AliqIBSMun;
    fed: AliqCBS;
  };
  totCIBS: {
    gIBS: {
      vIBSTot: number;
      gIBSMunTot: { vIBSMun?: number | null };
      gIBSUFTot: { vIBSUF?: number | null };
    };
    gCBS: { vCBS: number };
    vTotNF: number;
  };
}

export interface InfDPS {
  Id?: string;
  nDPS?: string;
  serie?: string;
  dhEmi?: string;
  dCompet?: string;
  cLocEmi?: string;
  xUFEmi?: string;
  tpEmit: number;
  tpAmb: number;
  prest?: { regTrib: RegTrib } | null;
  toma?: Tomador | null;
  interm?: Interm | null;
  serv: {
    cServ: CServ;
    obra?: { cObra?: string; inscImobFisc?: string };
    infoCompl: InfoCompl;
    locPrest: LocPrest;
    atvEvento?: { idAtvEvt?: string };
  };
  valores: ValoresDPS;
  subst?: { chSubstda?: string };
  IBSCBS?: IBSCBSDPS | null;
}

export interface ValoresNFSe {
  vLiq: number;
  vBC: number;
  vISSQN: number;
  pAliqAplic?: number | null;
  vCalcBM: number;
  tpBM: number;
  vCalcDR: number;
  vTotalRet: number;
}

export interface InfNFSe {
  Id: string;
  situacao?: string;
  qrcode?: string;
  dhProc?: string;
  nNFSe?: string;
  ambGer?: string;
  cStat?: string;
  xLocEmi?: string;
  cLocIncid?: string;
  xLocIncid?: string;
  xUFIncid?: string;
  xPaisIncid?: string;
  xTribNac?: string;
  xTribMun?: string;
  xLocPrestacao?: string;
  cPaisPrestacao?: string;
  DPS: { infDPS: InfDPS };
  emit: Emitente;
  valores: ValoresNFSe;
  IBSCBS?: IBSCBSResp | null;
}

/** Modelo de nível superior após o parse + enriquecimento da preparação. */
export interface NFSe {
  Versao: string;
  MarcaDagua: string;
  ExibicaoDescServ: string;
  ExibicaoCompl: string;
  ExibicaoLinhaTributos: string;
  VExclusoesReducoesBC: number;
  TextoDescServOriginal: string;
  TextoComplOriginal: string;
  InfNFSe: InfNFSe;
}
