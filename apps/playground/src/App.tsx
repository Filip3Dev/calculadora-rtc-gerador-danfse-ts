/**
 * Playground do DANFSe Service — colar/enviar o XML da NFS-e Nacional e gerar
 * o PDF (params oficiais stc e canhoto).
 */
import { useRef, useState } from "react";

const EXEMPLO = `<NFSe versao="1.00">
  <infNFSe Id="NFS123" dhProc="2026-07-14T10:00:00-03:00">
    <nNFSe>1</nNFSe>
    <ambGer>1</ambGer>
    <cStat>100</cStat>
    <DPS>
      <infDPS>
        <nDPS>1</nDPS>
        <serie>1</serie>
        <dhEmi>2026-07-14T10:00:00-03:00</dhEmi>
        <dCompet>2026-07-14</dCompet>
        <tpEmit>1</tpEmit>
        <tpAmb>1</tpAmb>
        <prest><regTrib><opSimpNac>1</opSimpNac></regTrib></prest>
        <serv>
          <cServ><cTribNac>010101</cTribNac><xDescServ>Servico de Teste Completo</xDescServ></cServ>
          <infoCompl><xInfComp>Informacao complementar importante</xInfComp></infoCompl>
        </serv>
        <valores>
          <vServPrest><vServ>100</vServ></vServPrest>
          <trib><tribMun><tribISSQN>1</tribISSQN></tribMun></trib>
        </valores>
      </infDPS>
    </DPS>
    <emit>
      <CNPJ>12345678000195</CNPJ>
      <xNome>Prestador</xNome>
      <enderNac><cMun>3550308</cMun><CEP>01001000</CEP></enderNac>
    </emit>
    <valores><vLiq>100</vLiq></valores>
  </infNFSe>
</NFSe>`;

export default function App() {
  const [xml, setXml] = useState(EXEMPLO);
  const [stc, setStc] = useState("0");
  const [canhoto, setCanhoto] = useState(true);
  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  async function gerar(): Promise<void> {
    setCarregando(true);
    setErro(null);
    setUrlPdf(null);
    try {
      const resp = await fetch(`/api/danfse?stc=${stc}&canhoto=${canhoto}`, {
        method: "POST",
        headers: { "content-type": "application/xml" },
        body: xml,
      });
      if (!resp.ok) {
        const corpo = (await resp.json()) as { mensagem?: string };
        setErro(`HTTP ${resp.status} — ${corpo.mensagem ?? resp.statusText}`);
        return;
      }
      const blob = await resp.blob();
      setUrlPdf(URL.createObjectURL(blob));
    } catch (e) {
      setErro(String(e));
    } finally {
      setCarregando(false);
    }
  }

  async function abrirArquivo(file: File | undefined): Promise<void> {
    if (!file) return;
    setXml(await file.text());
  }

  return (
    <main>
      <header>
        <h1>DANFSe Service</h1>
        <p className="sub">
          Geração de DANFSe (PDF) a partir do XML da NFS-e Nacional · porte TypeScript com paridade
          visual com o serviço oficial (Go)
        </p>
      </header>

      <section className="painel">
        <div className="controles">
          <label>
            Situação (stc)
            <select value={stc} onChange={(e) => setStc(e.target.value)}>
              <option value="0">0 — Válida</option>
              <option value="1">1 — Substituída</option>
              <option value="2">2 — Cancelada</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={canhoto} onChange={(e) => setCanhoto(e.target.checked)} />
            Canhoto
          </label>
          <button onClick={() => inputArquivo.current?.click()}>Abrir XML…</button>
          <input
            ref={inputArquivo}
            type="file"
            accept=".xml,text/xml,application/xml"
            hidden
            onChange={(e) => void abrirArquivo(e.target.files?.[0])}
          />
          <button className="primario" onClick={() => void gerar()} disabled={carregando}>
            {carregando ? "Gerando…" : "Gerar DANFSe"}
          </button>
        </div>
        <textarea
          value={xml}
          onChange={(e) => setXml(e.target.value)}
          spellCheck={false}
          rows={12}
          placeholder="Cole aqui o XML completo da NFS-e Nacional…"
        />
      </section>

      {erro && <div className="box erro">{erro}</div>}

      {urlPdf && (
        <section className="resultado">
          <a className="baixar" href={urlPdf} download="danfse.pdf">
            ⬇ Baixar danfse.pdf
          </a>
          <iframe title="DANFSe" src={urlPdf} />
        </section>
      )}

      <footer>
        <span>Receita Federal · NFS-e Nacional · DANFSe v2.0 — porte TS (paridade visual)</span>
      </footer>
    </main>
  );
}
