/**
 * Tabelas de mapeamento e formatação pura — porte fiel de
 * internal/domain/presentation/danfse_format.go.
 */

// ─── Tabelas de apresentação ─────────────────────────────────────────────────

const mapaNaoNIF: Record<number, string> = {
  1: "Não informado na nota de origem",
  2: "Dispensado do NIF",
  3: "Não exigência do NIF",
};

const mapaTributacaoISSQN: Record<number, string> = {
  1: "Operação Tributável",
  2: "Imunidade",
  3: "Exportação de Serviço",
  4: "Não Incidência",
};

const mapaOpcaoSimplesNacional: Record<number, string> = {
  1: "1 - Não Optante",
  2: "2 - Optante - MEI",
  3: "3 - Optante - ME/EPP",
};

const mapaSuspensaoExigibilidade: Record<number, string> = {
  1: "Exigibilidade Suspensa por Decisão Judicial",
  2: "Exigibilidade Suspensa por Processo Administrativo",
};

const mapaTipoBeneficioMunicipal: Record<number, string> = {
  1: "Isenção",
  2: "Redução da BC em 'ppBM' %'",
  3: "Redução da BC em R$ 'vInfoBM'",
  4: "Alíquota Diferenciada de 'aliqDifBM' %",
};

const mapaTipoRetencaoISSQN: Record<number, string> = {
  1: "Não Retido",
  2: "Retido pelo Tomador",
  3: "Retido pelo Intermediário",
};

const mapaTipoRetencaoPISCOFINS: Record<number, string> = {
  0: "PIS/COFINS/CSLL Não Retidos",
  1: "PIS/COFINS Retidos",
  2: "PIS/COFINS Não Retidos",
  3: "PIS/COFINS/CSLL Retidos",
  4: "PIS/COFINS Retidos, CSLL Não Retido",
  5: "PIS Retido, COFINS/CSLL Não Retido",
  6: "COFINS Retido, PIS/CSLL Não Retido",
  7: "PIS Não Retido, COFINS/CSLL Retidos",
  8: "PIS/COFINS Não Retidos, CSLL Retido",
  9: "COFINS Não Retido, PIS/CSLL Retidos",
};

const mapaTipoImunidade: Record<number, string> = {
  0: "",
  1: "Patrimônio, renda ou serviços, uns dos outros (CF88, Art 150, VI, a)",
  2: "Templos de qualquer culto (CF88, Art 150, VI, b)",
  3: "Patrimônio, renda ou serviços dos partidos políticos, inclusive suas fundações, das entidades sindicais dos trabalhadores, das instituições de educação e de assistência social, sem fins lucrativos, atendidos os requisitos da lei (CF88, Art 150, VI, c)",
  4: "Livros, jornais, periódicos e o papel destinado a sua impressão (CF88, Art 150, VI, d)",
  5: "Fonogramas e videofonogramas musicais produzidos no Brasil contendo obras musicais ou literomusicais de autores brasileiros e/ou obras em geral interpretadas por artistas brasileiros bem como os suportes materiais ou arquivos digitais que os contenham, salvo na etapa de replicação industrial de mídias ópticas de leitura a laser.   (CF88, Art 150, VI, e)",
};

const mapaRegimeEspecialTributacao: Record<number, string> = {
  0: "Nenhum",
  1: "Ato Cooperado (Cooperativa)",
  2: "Estimativa",
  3: "Microempresa Municipal",
  4: "Notário ou Registrador",
  5: "Profissional Autônomo",
  6: "Sociedade de Profissionais",
  9: "Outros",
};

const mapaRegimeApuracaoSN: Record<number, string> = {
  1: "1 - Regime de apuração dos tributos federais e municipal pelo SN",
  2: "2 - Regime de apuração dos tributos federais pelo SN e ISSQN por fora do SN",
};

const mapaTipoEmitente: Record<number, string> = {
  1: "Prestador",
  2: "Tomador",
  3: "Intermediário",
};

const mapaCStat: Record<string, string> = {
  "100": "NFS-e Regular",
  "101": "NFS-e Cancelada",
  "102": "NFS-e Substituída",
  "103": "NFS-e de Decisão Judicial ou Administrativa",
  "104": "NFS-e Emitida em Contingência",
  "105": "NFS-e de Ajuste",
};

const mapaFinalidadeNFSe: Record<number, string> = {
  0: "NFS-e regular",
  1: "NFS-e de substituição",
  2: "NFS-e de ajuste",
};

const mapaAmbienteGerador: Record<string, string> = {
  "1": "Ambiente de Produção",
  "2": "Ambiente de Homologação",
};

const mapaTipoAmbiente: Record<number, string> = {
  1: "Produção",
  2: "Homologação",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDigits(s: string): boolean {
  if (s === "") return false;
  for (const c of s) {
    if (c < "0" || c > "9") return false;
  }
  return true;
}

/** PARITY: fmt.Sprintf("%.2f") do Go — arredondamento half-even de float64. */
function fixo2(v: number): string {
  return (Math.abs(v) < Number.EPSILON ? 0 : v).toFixed(2);
}

/** PARITY: formatarMoedaAgrupada — valor absoluto, "." milhar, "," decimal, sem prefixo. */
export function moedaAgrupada(v: number): string {
  const abs = Math.abs(v);
  const [intPart, decPart] = fixo2(abs).split(".");
  let formatada = "";
  let count = 0;
  for (let i = intPart.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      formatada = "." + formatada;
    }
    formatada = intPart[i] + formatada;
    count++;
  }
  return `${formatada},${decPart}`;
}

// ─── Formatações puras ───────────────────────────────────────────────────────

/** CNPJ (14) / CPF (11) com máscara; outros tamanhos retornam como estão. */
export function formatarDocumento(s: string): string {
  s = s.trim();
  if (s.length === 11) {
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
  }
  if (s.length === 14) {
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12, 14)}`;
  }
  return s;
}

/** CEP 8 dígitos → "XX.XXX-XXX". */
export function formatarCEP(s: string): string {
  if (s.length === 8) {
    return `${s.slice(0, 2)}.${s.slice(2, 5)}-${s.slice(5, 8)}`;
  }
  return s;
}

/** Telefone: 10 dígitos → (XX) XXXX-XXXX; 11 → (XX) XXXXX-XXXX (não-dígitos removidos). */
export function formatarTelefone(s: string): string {
  const limpo = s.replace(/\D/g, "");
  if (limpo.length === 10) {
    return limpo.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  if (limpo.length === 11) {
    return limpo.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  return s;
}

/** Moeda "R$ X.XXX,XX" (negativo → prefixo "R$ -"). */
export function formatarMoeda(v: number): string {
  const prefixo = v < 0 ? "R$ -" : "R$ ";
  return prefixo + moedaAgrupada(v);
}

/** Percentual "XX,XX%". */
export function formatarPercentual(v: number): string {
  return fixo2(v).replace(".", ",") + "%";
}

/** Número percentual "XX,XX" (sem %). */
export function formatarNumeroPercentual(v: number): string {
  return fixo2(v).replace(".", ",");
}

/** "XX,XX" ou "-" quando zero. */
export function formatarNumeroPercentualOuTraco(v: number): string {
  return v === 0 ? "-" : formatarNumeroPercentual(v);
}

/** "XX,XX%" ou "-" quando zero. */
export function formatarPercentualOuTraco(v: number): string {
  return v === 0 ? "-" : formatarPercentual(v);
}

/** "R$ X.XXX,XX" sempre (inclusive R$ 0,00). */
export function formatarValorMonetario(v: number): string {
  return "R$ " + moedaAgrupada(v);
}

/** ISO "YYYY-MM-DD" → "DD/MM/YYYY"; vazio → "-"; formato inválido retorna como está. */
export function formatarData(s: string): string {
  s = s.trim();
  if (s === "") return "-";
  if (s.length === 10) {
    const ano = s.slice(0, 4);
    const mes = s.slice(5, 7);
    const dia = s.slice(8, 10);
    if (isDigits(ano) && isDigits(mes) && isDigits(dia) && s[4] === "-" && s[7] === "-") {
      return `${dia}/${mes}/${ano}`;
    }
  }
  return s;
}

/** ISO "YYYY-MM-DDTHH:MM:SS" → "DD/MM/YYYY HH:MM:SS"; regras idênticas ao Go. */
export function formatarDataHora(s: string): string {
  s = s.trim();
  if (s === "") return "-";
  if (s.length === 10) return formatarData(s);
  if (s.length < 19 || s[10] !== "T") return s;
  const data = formatarData(s.slice(0, 10));
  if (data === s.slice(0, 10)) return s;
  if (
    isDigits(s.slice(11, 13)) &&
    s[13] === ":" &&
    isDigits(s.slice(14, 16)) &&
    s[16] === ":" &&
    isDigits(s.slice(17, 19))
  ) {
    return `${data} ${s.slice(11, 19)}`;
  }
  return s;
}

/** Código tributação nacional 6 dígitos → "XX.XX.XX". */
export function formatarCodigoTributacaoNacional(s: string): string {
  s = String(s).replaceAll(".", "").trim();
  if (s.length !== 6) return s;
  return `${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4, 6)}`;
}

/** NBS 9 dígitos → "X.XXXX.XX.XXX". */
export function formatarNBS(content: string): string {
  const s = (content.match(/\d/g) ?? []).join("");
  if (s.length !== 9) return content;
  return `${s.slice(0, 1)}.${s.slice(1, 5)}.${s.slice(5, 7)}.${s.slice(7)}`;
}

/** "municipio / uf" com fallbacks "-" — FormatarMunicipioUF. */
export function formatarMunicipioUF(municipio: string, uf: string): string {
  municipio = municipio.trim();
  uf = uf.trim();
  if (municipio === "" && uf === "") return "-";
  if (municipio !== "" && uf !== "") return `${municipio} / ${uf}`;
  if (municipio !== "") return municipio;
  return uf;
}

/** IBGE + CEP formatado → "ibge / XX.XXX-XXX" com fallbacks. */
export function formatarCodigoIBGECEP(ibge: string, cep: string): string {
  ibge = ibge.trim();
  cep = cep.trim();
  if (ibge === "" && cep === "") return "-";
  let cepFmt = cep;
  if (cep !== "" && cep.length === 8) {
    cepFmt = `${cep.slice(0, 2)}.${cep.slice(2, 5)}-${cep.slice(5, 8)}`;
  }
  if (ibge !== "" && cepFmt !== "") return `${ibge} / ${cepFmt}`;
  if (ibge !== "") return ibge;
  return cepFmt;
}

/** "-" quando vazio/apenas espaços. */
export function tracoSeVazio(s: string): string {
  s = s.trim();
  return s === "" ? "-" : s;
}

/** "R$ X.XXX,XX" ou "-" para nil/zero. */
export function formatarValorMonetarioOuTraco(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "-";
  return "R$ " + moedaAgrupada(value);
}

/** Primeiro não-vazio (após trim) ou "-". */
export function primeiroNaoVazio(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    if (v !== null && v !== undefined && v.trim() !== "") return v;
  }
  return "-";
}

/** Junta partes não-vazias com ", "; tudo vazio → "-". */
export function montarEndereco(...parts: Array<string | null | undefined>): string {
  const valores = parts
    .filter((p) => p !== null && p !== undefined && p.trim() !== "")
    .map((p) => p!.trim());
  if (valores.length === 0) return "-";
  return valores.join(", ");
}

// ─── Mapeadores (mapas → texto, "-" quando ausente) ──────────────────────────

const mapear = <K extends number | string>(mapa: Record<K, string>, chave: K | null | undefined, vazioTraco = false): string => {
  if (chave === null || chave === undefined) return "-";
  const v = mapa[chave];
  if (v === undefined) return "-";
  if (vazioTraco && v === "") return "-";
  return v;
};

export const mapearCStat = (s: string | null | undefined): string =>
  s === null || s === undefined || s.trim() === "" ? "-" : (mapaCStat[s.trim()] ?? s.trim());
export const mapearTipoAmbiente = (i: number | null | undefined): string => mapear(mapaTipoAmbiente, i);
export const mapearAmbienteGerador = (s: string | null | undefined): string =>
  s === null || s === undefined ? "-" : (mapaAmbienteGerador[s] ?? "-");
export const mapearTipoEmitente = (i: number | null | undefined): string => mapear(mapaTipoEmitente, i);
export const mapearFinalidadeNFSe = (i: number | null | undefined): string => mapear(mapaFinalidadeNFSe, i);
export const mapearTributacaoISSQN = (i: number | null | undefined): string => mapear(mapaTributacaoISSQN, i);
export const mapearOpcaoSimplesNacional = (i: number | null | undefined): string => mapear(mapaOpcaoSimplesNacional, i);
export const mapearRegimeEspecialTributacao = (i: number | null | undefined): string => mapear(mapaRegimeEspecialTributacao, i);
export const mapearRegimeApuracaoSN = (i: number | null | undefined): string => mapear(mapaRegimeApuracaoSN, i);
export const mapearSuspensaoExigibilidade = (i: number | null | undefined): string => mapear(mapaSuspensaoExigibilidade, i);
export const mapearTipoBeneficioMunicipal = (i: number | null | undefined): string => mapear(mapaTipoBeneficioMunicipal, i);
export const mapearTipoRetencaoISSQN = (i: number | null | undefined): string => mapear(mapaTipoRetencaoISSQN, i);
export const mapearTipoRetencaoPISCOFINS = (i: number | null | undefined): string => mapear(mapaTipoRetencaoPISCOFINS, i);
export const mapearTipoImunidade = (i: number | null | undefined): string => mapear(mapaTipoImunidade, i, true);
export const mapearCodigoNaoNIF = (i: number | null | undefined): string => mapear(mapaNaoNIF, i);
