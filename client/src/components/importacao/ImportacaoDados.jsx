import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import { API_URL } from "../../services/api.js";
import { authFetch } from "../../services/auth.js";
import "./ImportacaoDados.css";

const TIPOS = {
  produtos: {
    label: "Produtos",
    descricao: "Importa cardapio com categoria, preco, descricao e imagem.",
    colunas: "categoria;nome;descricao;preco;imagem;disponivel",
  },
  categorias: {
    label: "Categorias",
    descricao: "Cria secoes do cardapio e suas ordens.",
    colunas: "nome;ordem",
  },
  mesas: {
    label: "Mesas",
    descricao: "Cria mesas ou balcoes do restaurante.",
    colunas: "numero;status",
  },
  usuarios: {
    label: "Usuarios",
    descricao: "Cria equipe com perfil, login e senha temporaria.",
    colunas: "nome;login;role;senha;ativo",
  },
};

function contarSeparador(linha, separador) {
  let total = 0;
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const char = linha[i];
    if (char === '"') dentroAspas = !dentroAspas;
    if (!dentroAspas && char === separador) total += 1;
  }
  return total;
}

function detectarSeparador(texto) {
  const primeiraLinha = texto.split(/\r?\n/).find((linha) => linha.trim()) || "";
  return contarSeparador(primeiraLinha, ";") >= contarSeparador(primeiraLinha, ",")
    ? ";"
    : ",";
}

function parseCsv(texto) {
  const conteudo = String(texto || "").replace(/^\uFEFF/, "");
  const separador = detectarSeparador(conteudo);
  const linhas = [];
  let linha = [];
  let valor = "";
  let dentroAspas = false;

  for (let i = 0; i < conteudo.length; i += 1) {
    const char = conteudo[i];
    const proximo = conteudo[i + 1];

    if (char === '"' && dentroAspas && proximo === '"') {
      valor += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      dentroAspas = !dentroAspas;
      continue;
    }

    if (!dentroAspas && char === separador) {
      linha.push(valor.trim());
      valor = "";
      continue;
    }

    if (!dentroAspas && (char === "\n" || char === "\r")) {
      if (char === "\r" && proximo === "\n") i += 1;
      linha.push(valor.trim());
      if (linha.some(Boolean)) linhas.push(linha);
      linha = [];
      valor = "";
      continue;
    }

    valor += char;
  }

  if (valor || linha.length) {
    linha.push(valor.trim());
    if (linha.some(Boolean)) linhas.push(linha);
  }

  if (linhas.length < 2) {
    throw new Error("CSV precisa ter cabecalho e pelo menos uma linha de dados.");
  }

  const headers = linhas[0].map((header, index) => header || `coluna_${index + 1}`);
  const rows = linhas.slice(1).map((valores) =>
    headers.reduce((acc, header, index) => {
      acc[header] = valores[index] ?? "";
      return acc;
    }, {}),
  );

  return { headers, rows };
}

function acaoLabel(acao) {
  return {
    criar: "Criar",
    atualizar: "Atualizar",
    ignorar: "Ignorar",
    invalida: "Invalida",
  }[acao] || acao;
}

function resumoTexto(resumo) {
  if (!resumo) return "Nenhuma analise feita.";
  return `${resumo.criar} criar, ${resumo.atualizar} atualizar, ${resumo.ignorar} ignorar, ${resumo.invalidas} invalidas`;
}

export default function ImportacaoDados({ onImported }) {
  const [tipo, setTipo] = useState("produtos");
  const [csvText, setCsvText] = useState("");
  const [arquivoNome, setArquivoNome] = useState("");
  const [parsed, setParsed] = useState(null);
  const [atualizarExistentes, setAtualizarExistentes] = useState(false);
  const [analise, setAnalise] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [status, setStatus] = useState({ tipo: "idle", mensagem: "" });

  const linhasValidas = parsed?.rows?.length || 0;
  const preview = useMemo(() => analise?.preview?.slice(0, 80) || [], [analise]);

  const resetAnalise = () => {
    setAnalise(null);
    setResultado(null);
    setStatus({ tipo: "idle", mensagem: "" });
  };

  const carregarTexto = (texto, nome = "") => {
    try {
      const csv = parseCsv(texto);
      setCsvText(texto);
      setArquivoNome(nome);
      setParsed(csv);
      setAnalise(null);
      setResultado(null);
      setStatus({
        tipo: "success",
        mensagem: `${csv.rows.length} linha(s) carregada(s).`,
      });
    } catch (error) {
      setParsed(null);
      setAnalise(null);
      setResultado(null);
      setStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const selecionarArquivo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setStatus({ tipo: "error", mensagem: "Envie um arquivo CSV." });
      return;
    }
    carregarTexto(await file.text(), file.name);
  };

  const baixarModelo = async () => {
    setStatus({ tipo: "loading", mensagem: "Gerando modelo..." });
    try {
      const resposta = await authFetch(`${API_URL}/api/importacoes/modelo/${tipo}`);
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.erro || "Nao foi possivel baixar o modelo.");
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `autenix-${tipo}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ tipo: "success", mensagem: "Modelo CSV baixado." });
    } catch (error) {
      setStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const payload = () => ({
    tipo,
    rows: parsed?.rows || [],
    atualizar_existentes: atualizarExistentes,
  });

  const validar = async () => {
    if (!parsed?.rows?.length) {
      setStatus({ tipo: "error", mensagem: "Carregue ou cole um CSV antes de validar." });
      return;
    }
    setStatus({ tipo: "loading", mensagem: "Validando importacao..." });
    setResultado(null);
    try {
      const resposta = await authFetch(`${API_URL}/api/importacoes/validar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao validar importacao.");
      setAnalise(dados);
      setStatus({
        tipo: dados.pode_executar ? "success" : "warning",
        mensagem: dados.pode_executar
          ? "Arquivo validado. Revise o preview antes de importar."
          : "Existem erros ou limites a corrigir antes de importar.",
      });
    } catch (error) {
      setStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const executar = async () => {
    if (!analise?.pode_executar) {
      setStatus({ tipo: "error", mensagem: "Valide um CSV sem erros antes de executar." });
      return;
    }
    setStatus({ tipo: "loading", mensagem: "Importando dados..." });
    try {
      const resposta = await authFetch(`${API_URL}/api/importacoes/executar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao executar importacao.");
      setResultado(dados.importacao);
      setAnalise(dados.analise);
      setStatus({ tipo: "success", mensagem: "Importacao concluida." });
      onImported?.(tipo);
    } catch (error) {
      setStatus({ tipo: "error", mensagem: error.message });
    }
  };

  return (
    <div className="import-panel">
      <div className="import-heading">
        <div>
          <span>Importacao de dados</span>
          <h2>Migre dados de outro sistema via CSV</h2>
        </div>
        <button type="button" className="import-secondary" onClick={baixarModelo}>
          <Download size={16} />
          Modelo CSV
        </button>
      </div>

      <div className="import-type-grid">
        {Object.entries(TIPOS).map(([id, item]) => (
          <button
            key={id}
            type="button"
            className={`import-type ${tipo === id ? "is-active" : ""}`}
            onClick={() => {
              setTipo(id);
              resetAnalise();
            }}
          >
            <FileSpreadsheet size={18} />
            <strong>{item.label}</strong>
            <small>{item.descricao}</small>
          </button>
        ))}
      </div>

      <div className="import-card">
        <div className="import-card-title">Arquivo CSV</div>
        <div className="import-template">Colunas: {TIPOS[tipo].colunas}</div>
        <label className="import-drop">
          <Upload size={22} />
          <strong>{arquivoNome || "Selecionar arquivo CSV"}</strong>
          <small>Tambem e possivel colar o conteudo no campo abaixo.</small>
          <input type="file" accept=".csv,text/csv" onChange={selecionarArquivo} />
        </label>
        <textarea
          value={csvText}
          onChange={(event) => {
            setCsvText(event.target.value);
            setParsed(null);
            setAnalise(null);
            setResultado(null);
          }}
          placeholder={`${TIPOS[tipo].colunas}\n...`}
          rows={7}
        />
        <div className="import-actions">
          <button
            type="button"
            className="import-secondary"
            onClick={() => carregarTexto(csvText)}
            disabled={!csvText.trim() || status.tipo === "loading"}
          >
            <RefreshCw size={16} />
            Ler CSV
          </button>
          <label className="import-check">
            <input
              type="checkbox"
              checked={atualizarExistentes}
              onChange={(event) => {
                setAtualizarExistentes(event.target.checked);
                resetAnalise();
              }}
            />
            Atualizar registros existentes
          </label>
          <button
            type="button"
            className="import-primary"
            onClick={validar}
            disabled={!linhasValidas || status.tipo === "loading"}
          >
            {status.tipo === "loading" ? <LoaderCircle className="import-spin" size={16} /> : <CheckCircle2 size={16} />}
            Validar
          </button>
          <button
            type="button"
            className="import-primary import-primary-strong"
            onClick={executar}
            disabled={!analise?.pode_executar || status.tipo === "loading"}
          >
            Importar
          </button>
        </div>
        <div className={`import-status import-status-${status.tipo}`} role="status">
          {status.mensagem || "Aguardando arquivo CSV."}
        </div>
      </div>

      {analise && (
        <div className="import-card">
          <div className="import-summary">
            <div>
              <span>Resumo</span>
              <strong>{resumoTexto(analise.resumo)}</strong>
            </div>
            <div>
              <span>Total lido</span>
              <strong>{analise.total_linhas}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{analise.pode_executar ? "Pronto" : "Revisar"}</strong>
            </div>
          </div>

          {analise.erros?.length > 0 && (
            <div className="import-errors">
              {analise.erros.map((erro) => (
                <div key={erro}>{erro}</div>
              ))}
            </div>
          )}

          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Acao</th>
                  <th>Registro</th>
                  <th>Erros</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((item) => (
                  <tr key={`${item.linha}-${item.acao}`} className={`is-${item.acao}`}>
                    <td>{item.linha}</td>
                    <td>{acaoLabel(item.acao)}</td>
                    <td>{item.dados.nome || item.dados.numero || item.dados.login}</td>
                    <td>{item.erros?.join("; ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analise.preview.length > preview.length && (
            <div className="import-more">
              Mostrando {preview.length} de {analise.preview.length} linhas.
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className="import-card import-result">
          <div className="import-card-title">Importacao concluida</div>
          <p>{resumoTexto(resultado)}</p>
          {resultado.credenciais?.length > 0 && (
            <div className="import-credentials">
              <strong>Senhas temporarias geradas</strong>
              {resultado.credenciais.map((credencial) => (
                <code key={credencial.login}>
                  {credencial.nome}: {credencial.login} / {credencial.senha}
                </code>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
