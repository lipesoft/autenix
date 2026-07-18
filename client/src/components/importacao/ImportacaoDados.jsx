import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  LoaderCircle,
  RefreshCw,
  Undo2,
  Upload,
} from "lucide-react";
import { API_URL } from "../../services/api.js";
import { authFetch } from "../../services/auth.js";
import {
  criarPlanilha,
  formatoArquivo,
  mapearAutomaticamente,
  mapearLinhas,
  MAX_ARQUIVO_IMPORTACAO_BYTES,
  parseCsv,
  validarMapeamento,
} from "./importacao-arquivos.js";
import "./ImportacaoDados.css";

const TIPOS = {
  produtos: {
    label: "Produtos",
    descricao: "Importa cardapio com categoria, preco, descricao e imagem.",
    campos: [
      { id: "categoria", label: "Categoria", aliases: ["category", "grupo", "secao"] },
      { id: "nome", label: "Nome", obrigatorio: true, aliases: ["produto", "name"] },
      { id: "descricao", label: "Descricao", aliases: ["description", "detalhes"] },
      { id: "preco", label: "Preco", obrigatorio: true, aliases: ["valor", "price", "preco_r$"] },
      { id: "imagem", label: "Imagem", aliases: ["foto", "url_imagem", "image", "image_url"] },
      { id: "disponivel", label: "Disponivel", aliases: ["ativo", "status_produto"] },
    ],
  },
  categorias: {
    label: "Categorias",
    descricao: "Cria secoes do cardapio e suas ordens.",
    campos: [
      { id: "nome", label: "Nome", obrigatorio: true, aliases: ["categoria", "name"] },
      { id: "ordem", label: "Ordem", aliases: ["order", "posicao"] },
    ],
  },
  mesas: {
    label: "Mesas",
    descricao: "Cria mesas ou balcoes do restaurante.",
    campos: [
      { id: "numero", label: "Numero", obrigatorio: true, aliases: ["mesa", "identificacao"] },
      { id: "status", label: "Status", aliases: ["situacao"] },
    ],
  },
  usuarios: {
    label: "Usuarios",
    descricao: "Cria equipe com perfil, login e senha temporaria.",
    campos: [
      { id: "nome", label: "Nome", obrigatorio: true, aliases: ["name", "usuario"] },
      { id: "login", label: "Login", aliases: ["user", "username"] },
      { id: "role", label: "Perfil", aliases: ["perfil", "funcao", "cargo"] },
      { id: "senha", label: "Senha", aliases: ["password", "senha_temporaria"] },
      { id: "ativo", label: "Ativo", aliases: ["active", "habilitado"] },
    ],
  },
};

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

function formatarData(valor) {
  if (!valor) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
}

export default function ImportacaoDados({ onImported }) {
  const [tipo, setTipo] = useState("produtos");
  const [csvText, setCsvText] = useState("");
  const [arquivoNome, setArquivoNome] = useState("");
  const [formato, setFormato] = useState("");
  const [parsed, setParsed] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [atualizarExistentes, setAtualizarExistentes] = useState(false);
  const [analise, setAnalise] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [status, setStatus] = useState({ tipo: "idle", mensagem: "" });
  const [historico, setHistorico] = useState([]);
  const [historicoStatus, setHistoricoStatus] = useState("loading");
  const [detalhe, setDetalhe] = useState(null);
  const [rollbackPendente, setRollbackPendente] = useState(null);
  const [rollbackStatus, setRollbackStatus] = useState({ tipo: "idle", mensagem: "" });

  const campos = TIPOS[tipo].campos;
  const errosMapeamento = useMemo(
    () => (parsed ? validarMapeamento(mapeamento, campos) : []),
    [campos, mapeamento, parsed],
  );
  const linhasMapeadas = useMemo(
    () => (parsed && errosMapeamento.length === 0
      ? mapearLinhas(parsed, mapeamento, campos)
      : []),
    [campos, errosMapeamento.length, mapeamento, parsed],
  );
  const linhasValidas = linhasMapeadas.length;
  const preview = useMemo(() => analise?.preview?.slice(0, 80) || [], [analise]);

  const carregarHistorico = useCallback(async () => {
    setHistoricoStatus("loading");
    try {
      const resposta = await authFetch(`${API_URL}/api/importacoes?limite=20`);
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao carregar historico.");
      setHistorico(dados.historico || []);
      setHistoricoStatus("success");
    } catch {
      setHistoricoStatus("error");
    }
  }, []);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  const abrirDetalhe = async (importacaoId) => {
    if (detalhe?.id === importacaoId) {
      setDetalhe(null);
      return;
    }
    setHistoricoStatus("loading-detail");
    try {
      const resposta = await authFetch(`${API_URL}/api/importacoes/${importacaoId}`);
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao abrir importacao.");
      setDetalhe(dados);
      setHistoricoStatus("success");
    } catch {
      setHistoricoStatus("error");
    }
  };

  const executarRollback = async () => {
    if (!rollbackPendente) return;
    setRollbackStatus({ tipo: "loading", mensagem: "Desfazendo importacao..." });
    try {
      const resposta = await authFetch(
        `${API_URL}/api/importacoes/${rollbackPendente.id}/rollback`,
        { method: "POST" },
      );
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao desfazer importacao.");
      const tipoRevertido = rollbackPendente.tipo;
      setRollbackPendente(null);
      setDetalhe(null);
      setRollbackStatus({ tipo: "success", mensagem: "Importacao desfeita com sucesso." });
      onImported?.(tipoRevertido);
      await carregarHistorico();
    } catch (error) {
      setRollbackStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const resetAnalise = () => {
    setAnalise(null);
    setResultado(null);
    setStatus({ tipo: "idle", mensagem: "" });
  };

  const carregarPlanilha = (planilha, nome, formatoArquivoAtual, texto = "") => {
    setCsvText(texto);
    setArquivoNome(nome);
    setFormato(formatoArquivoAtual);
    setParsed(planilha);
    setMapeamento(mapearAutomaticamente(planilha.colunas, campos));
    setAnalise(null);
    setResultado(null);
    setStatus({
      tipo: "success",
      mensagem: `${planilha.rows.length} linha(s) carregada(s). Confira o mapeamento.`,
    });
  };

  const carregarTexto = (texto, nome = "conteudo-colado.csv") => {
    try {
      carregarPlanilha(parseCsv(texto), nome, "csv", texto);
    } catch (error) {
      setParsed(null);
      setMapeamento({});
      setAnalise(null);
      setResultado(null);
      setStatus({ tipo: "error", mensagem: error.message });
    }
  };

  const selecionarArquivo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const formatoSelecionado = formatoArquivo(file.name);
    if (!formatoSelecionado) {
      setStatus({ tipo: "error", mensagem: "Envie um arquivo CSV ou XLSX." });
      return;
    }
    if (file.size > MAX_ARQUIVO_IMPORTACAO_BYTES) {
      setStatus({ tipo: "error", mensagem: "O arquivo deve ter no maximo 5 MB." });
      return;
    }

    setStatus({ tipo: "loading", mensagem: "Lendo arquivo..." });
    try {
      if (formatoSelecionado === "csv") {
        const texto = await file.text();
        carregarPlanilha(parseCsv(texto), file.name, formatoSelecionado, texto);
        return;
      }
      const { readSheet } = await import("read-excel-file/browser");
      const matriz = await readSheet(file);
      carregarPlanilha(criarPlanilha(matriz), file.name, formatoSelecionado);
    } catch (error) {
      setParsed(null);
      setMapeamento({});
      setStatus({ tipo: "error", mensagem: error.message || "Nao foi possivel ler o arquivo." });
    }
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
    rows: linhasMapeadas,
    atualizar_existentes: atualizarExistentes,
    arquivo_nome: arquivoNome || "conteudo-colado.csv",
    formato: formato || "csv",
    mapeamento: Object.fromEntries(
      campos.map((campo) => [
        campo.id,
        parsed?.colunas.find((coluna) => coluna.id === mapeamento[campo.id])?.nome || "",
      ]),
    ),
  });

  const validar = async () => {
    if (!parsed?.rows?.length) {
      setStatus({ tipo: "error", mensagem: "Carregue um CSV ou XLSX antes de validar." });
      return;
    }
    if (errosMapeamento.length) {
      setStatus({ tipo: "error", mensagem: errosMapeamento[0] });
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
      setStatus({ tipo: "error", mensagem: "Valide o arquivo sem erros antes de executar." });
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
      setDetalhe(null);
      await carregarHistorico();
    } catch (error) {
      setStatus({ tipo: "error", mensagem: error.message });
    }
  };

  return (
    <div className="import-panel">
      <div className="import-heading">
        <div>
          <span>Importacao de dados</span>
          <h2>Migre dados de outro sistema via CSV ou Excel</h2>
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
              setMapeamento(parsed ? mapearAutomaticamente(parsed.colunas, item.campos) : {});
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
        <div className="import-card-title">Arquivo de dados</div>
        <div className="import-template">
          Campos aceitos: {campos.map((campo) => campo.id).join(", ")}
        </div>
        <label className="import-drop">
          <Upload size={22} />
          <strong>{arquivoNome || "Selecionar arquivo CSV ou XLSX"}</strong>
          <small>Primeira planilha do Excel, ate 500 linhas e 5 MB.</small>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={selecionarArquivo}
          />
        </label>
        <label className="import-paste-label" htmlFor="import-csv-texto">
          Colar CSV manualmente
        </label>
        <textarea
          id="import-csv-texto"
          value={csvText}
          onChange={(event) => {
            setCsvText(event.target.value);
            setParsed(null);
            setMapeamento({});
            setArquivoNome("");
            setFormato("");
            setAnalise(null);
            setResultado(null);
          }}
          placeholder={`${campos.map((campo) => campo.id).join(";")}\n...`}
          rows={5}
        />

        {parsed && (
          <div className="import-mapping">
            <div className="import-mapping-heading">
              <Columns3 size={17} />
              <div>
                <strong>Mapeamento de colunas</strong>
                <small>Confirme de onde vem cada campo antes de validar.</small>
              </div>
            </div>
            <div className="import-mapping-grid">
              {campos.map((campo) => (
                <label key={campo.id}>
                  <span>
                    {campo.label}
                    {campo.obrigatorio && <b>Obrigatorio</b>}
                  </span>
                  <select
                    value={mapeamento[campo.id] || ""}
                    aria-required={campo.obrigatorio || undefined}
                    onChange={(event) => {
                      setMapeamento((atual) => ({
                        ...atual,
                        [campo.id]: event.target.value,
                      }));
                      resetAnalise();
                    }}
                  >
                    <option value="">Nao importar</option>
                    {parsed.colunas.map((coluna) => (
                      <option
                        key={coluna.id}
                        value={coluna.id}
                        disabled={Object.entries(mapeamento).some(
                          ([campoId, colunaId]) => campoId !== campo.id && colunaId === coluna.id,
                        )}
                      >
                        {coluna.nome}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {errosMapeamento.length > 0 && (
              <div className="import-mapping-errors">{errosMapeamento.join(" ")}</div>
            )}
          </div>
        )}

        <div className="import-actions">
          <button
            type="button"
            className="import-secondary"
            onClick={() => carregarTexto(csvText)}
            disabled={!csvText.trim() || status.tipo === "loading"}
          >
            <RefreshCw size={16} />
            Ler CSV colado
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
          {status.mensagem || "Aguardando arquivo CSV ou XLSX."}
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

      <div className="import-card import-history">
        <div className="import-history-heading">
          <div>
            <History size={17} />
            <div>
              <div className="import-card-title">Historico de importacoes</div>
              <small>Ultimas operacoes realizadas neste restaurante.</small>
            </div>
          </div>
          <button
            type="button"
            className="import-secondary import-icon-button"
            onClick={carregarHistorico}
            disabled={historicoStatus === "loading"}
            aria-label="Atualizar historico"
            title="Atualizar historico"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {historicoStatus === "loading" && historico.length === 0 && (
          <div className="import-history-empty">Carregando historico...</div>
        )}
        {historicoStatus === "error" && (
          <div className="import-history-error">Nao foi possivel carregar o historico.</div>
        )}
        {historicoStatus !== "loading" && historicoStatus !== "error" && historico.length === 0 && (
          <div className="import-history-empty">Nenhuma importacao realizada.</div>
        )}

        {historico.length > 0 && (
          <div className="import-table-wrap">
            <table className="import-table import-history-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Arquivo</th>
                  <th>Tipo</th>
                  <th>Resultado</th>
                  <th>Responsavel</th>
                  <th>Status</th>
                  <th aria-label="Acoes" />
                </tr>
              </thead>
              <tbody>
                {historico.map((item) => (
                  <tr key={item.id}>
                    <td>{formatarData(item.criado_em)}</td>
                    <td>
                      <strong>{item.arquivo_nome}</strong>
                      <small>{String(item.formato).toUpperCase()}</small>
                    </td>
                    <td>{TIPOS[item.tipo]?.label || item.tipo}</td>
                    <td>{resumoTexto(item)}</td>
                    <td>{item.usuario}</td>
                    <td>
                      <span className={`import-history-status is-${item.status}`}>
                        {item.status === "revertida" ? "Revertida" : "Concluida"}
                      </span>
                    </td>
                    <td>
                      <div className="import-history-actions">
                        <button
                          type="button"
                          className="import-secondary import-detail-button"
                          onClick={() => abrirDetalhe(item.id)}
                          disabled={historicoStatus === "loading-detail"}
                        >
                          <Eye size={15} />
                          {detalhe?.id === item.id ? "Fechar" : "Itens"}
                        </button>
                        {item.rollback_disponivel && (
                          <button
                            type="button"
                            className="import-secondary import-rollback-button"
                            onClick={() => {
                              setRollbackPendente(item);
                              setRollbackStatus({ tipo: "idle", mensagem: "" });
                            }}
                          >
                            <Undo2 size={15} />
                            Desfazer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rollbackPendente && (
          <div className="import-rollback-confirm" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Desfazer {rollbackPendente.arquivo_nome}?</strong>
              <span>
                Os {rollbackPendente.itens_afetados} registro(s) serao restaurados ao estado anterior.
              </span>
            </div>
            <div>
              <button
                type="button"
                className="import-secondary"
                onClick={() => setRollbackPendente(null)}
                disabled={rollbackStatus.tipo === "loading"}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="import-primary import-rollback-confirm-button"
                onClick={executarRollback}
                disabled={rollbackStatus.tipo === "loading"}
              >
                {rollbackStatus.tipo === "loading"
                  ? <LoaderCircle className="import-spin" size={16} />
                  : <Undo2 size={16} />}
                Confirmar
              </button>
            </div>
          </div>
        )}

        {rollbackStatus.mensagem && (
          <div className={`import-status import-status-${rollbackStatus.tipo}`} role="status">
            {rollbackStatus.mensagem}
          </div>
        )}

        {detalhe && (
          <div className="import-history-detail">
            <div>
              <strong>{detalhe.arquivo_nome}</strong>
              <span>{detalhe.itens_afetados} registro(s) alterado(s)</span>
            </div>
            <div className="import-history-items">
              {detalhe.itens.map((item) => (
                <span key={`${item.ordem}-${item.entidade}-${item.registro_id}`}>
                  {item.ordem}. {acaoLabel(item.acao)} {TIPOS[item.entidade]?.label || item.entidade} #{item.registro_id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
