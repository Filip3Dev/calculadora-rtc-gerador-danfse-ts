/**
 * Catálogo de localidades IBGE — porte de domain/localidade (ADR002).
 * Dados extraídos de localidades_generated.go (28 estados, 5.525 municípios),
 * consultados em memória por busca binária sobre código.
 */
import dados from "./localidades.json" with { type: "json" };

export interface Estado {
  codigo: number;
  nome: string;
  sigla: string;
}
export interface Municipio {
  codigo: number;
  nome: string;
  ufCodigo: number;
}

const estados: readonly Estado[] = dados.estados;
const municipios: readonly Municipio[] = dados.municipios; // ordenado por código

export interface MunicipioResolvido {
  Codigo: number;
  Nome: string;
  UFCodigo: number;
  UFSigla: string;
  UFFormato: string; // "Nome (SIGLA)"
}

/** Busca binária por código de município (BuscarMunicipioGerado). */
export function buscarMunicipio(codigo: number): MunicipioResolvido | null {
  let lo = 0;
  let hi = municipios.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const m = municipios[mid];
    if (m.codigo === codigo) {
      const uf = estados.find((e) => e.codigo === m.ufCodigo);
      return {
        Codigo: m.codigo,
        Nome: m.nome,
        UFCodigo: m.ufCodigo,
        UFSigla: uf?.sigla ?? "",
        UFFormato: uf ? `${uf.nome} (${uf.sigla})` : "",
      };
    }
    if (m.codigo < codigo) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}
