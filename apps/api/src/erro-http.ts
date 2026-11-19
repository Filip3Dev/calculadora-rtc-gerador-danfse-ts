/**
 * Erro HTTP com mensagem de apresentação (equivale echo.NewHTTPError 4xx).
 */
export class ErroHttp extends Error {
  constructor(
    readonly status: number,
    readonly mensagem: string,
  ) {
    super(mensagem);
  }
}
