export const MAX_ARQUIVO_IMPORTACAO_BYTES = 5 * 1024 * 1024;
export const MAX_COLUNAS_IMPORTACAO = 50;
export const MAX_LINHAS_IMPORTACAO = 500;
export const MAX_IMAGEM_IMPORTACAO_BYTES = 3 * 1024 * 1024;
export const TIPOS_IMAGEM_IMPORTACAO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function textoCelula(valor) {
  if (valor instanceof Date) return valor.toISOString();
  return String(valor ?? "").trim();
}

export function normalizarCabecalho(valor) {
  return textoCelula(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function linhaPreenchida(linha) {
  return Array.isArray(linha) && linha.some((valor) => textoCelula(valor));
}

export function criarPlanilha(matriz) {
  if (!Array.isArray(matriz)) {
    throw new Error("Nao foi possivel ler as linhas do arquivo.");
  }

  const linhas = matriz.filter(linhaPreenchida);
  if (linhas.length < 2) {
    throw new Error("O arquivo precisa ter cabecalho e pelo menos uma linha de dados.");
  }

  const cabecalho = linhas[0];
  if (cabecalho.length > MAX_COLUNAS_IMPORTACAO) {
    throw new Error(`Use no maximo ${MAX_COLUNAS_IMPORTACAO} colunas por arquivo.`);
  }

  const colunas = cabecalho.map((valor, indice) => ({
    indice,
    id: `coluna_${indice}`,
    nome: textoCelula(valor) || `Coluna ${indice + 1}`,
  }));
  const rows = linhas.slice(1).map((linha) =>
    colunas.map(({ indice }) => {
      const valor = linha[indice];
      return valor instanceof Date ? valor.toISOString() : (valor ?? "");
    }),
  );

  if (rows.length > MAX_LINHAS_IMPORTACAO) {
    throw new Error(`Importe no maximo ${MAX_LINHAS_IMPORTACAO} linhas por vez.`);
  }

  return { colunas, rows };
}

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

export function parseCsv(texto) {
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
      linhas.push(linha);
      linha = [];
      valor = "";
      continue;
    }
    valor += char;
  }

  if (valor || linha.length) {
    linha.push(valor.trim());
    linhas.push(linha);
  }

  return criarPlanilha(linhas);
}

export function mapearAutomaticamente(colunas, campos) {
  const usadas = new Set();
  return campos.reduce((mapeamento, campo) => {
    const aliases = [campo.id, ...(campo.aliases || [])].map(normalizarCabecalho);
    const coluna = colunas.find(
      (item) => !usadas.has(item.id) && aliases.includes(normalizarCabecalho(item.nome)),
    );
    mapeamento[campo.id] = coluna?.id || "";
    if (coluna) usadas.add(coluna.id);
    return mapeamento;
  }, {});
}

export function validarMapeamento(mapeamento, campos) {
  const erros = [];
  const selecionadas = Object.values(mapeamento).filter(Boolean);
  if (new Set(selecionadas).size !== selecionadas.length) {
    erros.push("Cada coluna do arquivo so pode alimentar um campo.");
  }
  for (const campo of campos) {
    if (campo.obrigatorio && !mapeamento[campo.id]) {
      erros.push(`Mapeie o campo obrigatorio ${campo.label}.`);
    }
  }
  return erros;
}

export function mapearLinhas(planilha, mapeamento, campos) {
  const indices = new Map(planilha.colunas.map((coluna) => [coluna.id, coluna.indice]));
  return planilha.rows.map((linha) =>
    campos.reduce((registro, campo) => {
      const indice = indices.get(mapeamento[campo.id]);
      registro[campo.id] = indice === undefined ? "" : (linha[indice] ?? "");
      return registro;
    }, {}),
  );
}

export function formatoArquivo(nome) {
  const extensao = String(nome || "").toLowerCase().split(".").pop();
  return extensao === "xlsx" || extensao === "csv" ? extensao : "";
}

export function imagemImportacaoEhUrl(valor) {
  return /^https?:\/\//i.test(String(valor || "").trim());
}

export function normalizarChaveImagemImportacao(valor) {
  return String(valor || "")
    .trim()
    .split(/[\\/]/)
    .pop()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function imagemImportacaoEhReferenciaLocal(valor) {
  const chave = normalizarChaveImagemImportacao(valor);
  if (!chave || imagemImportacaoEhUrl(chave) || chave.includes("..")) return false;
  return /\.(jpe?g|png|webp|gif)$/i.test(chave);
}
