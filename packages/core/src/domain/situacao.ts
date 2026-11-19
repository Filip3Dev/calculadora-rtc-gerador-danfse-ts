/**
 * Situação da nota (stc) — porte de domain/enums/situacao.go.
 */
export type SituacaoNotaTipo = "valida" | "substituida" | "cancelada";

export function situacaoNotaPorSTC(stc: number): SituacaoNotaTipo | null {
  switch (stc) {
    case 0:
      return "valida";
    case 1:
      return "substituida";
    case 2:
      return "cancelada";
    default:
      return null;
  }
}

export function marcaDagua(situacao: SituacaoNotaTipo): string {
  switch (situacao) {
    case "cancelada":
      return "CANCELADA";
    case "substituida":
      return "SUBSTITUÍDA";
    default:
      return "";
  }
}
