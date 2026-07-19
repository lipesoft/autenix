const crypto = require("crypto");

const MAX_LINHAS_IMPORTACAO = 500;

const TIPOS_IMPORTACAO = {
  categorias: {
    label: "Categorias",
    chave: "nome",
    colunas: ["nome", "ordem"],
    modelo: [
      { nome: "Entradas", ordem: "10" },
      { nome: "Pratos principais", ordem: "20" },
      { nome: "Bebidas", ordem: "30" },
    ],
  },
  produtos: {
    label: "Produtos",
    chave: "nome",
    colunas: ["categoria", "nome", "descricao", "preco", "imagem", "disponivel"],
    modelo: [
      {
        categoria: "Pratos principais",
        nome: "Burger Autenix",
        descricao: "Burger artesanal com molho da casa",
        preco: "34,90",
        imagem: "burger-autenix.jpg",
        disponivel: "sim",
      },
      {
        categoria: "Bebidas",
        nome: "Suco Natural",
        descricao: "Laranja, limao ou maracuja",
        preco: "9,90",
        imagem: "",
        disponivel: "sim",
      },
    ],
  },
  mesas: {
    label: "Mesas",
    chave: "numero",
    colunas: ["numero", "status"],
    modelo: [
      { numero: "1", status: "livre" },
      { numero: "2", status: "livre" },
      { numero: "Balcao", status: "livre" },
    ],
  },
  usuarios: {
    label: "Usuarios",
    chave: "login",
    colunas: ["nome", "login", "role", "senha", "ativo"],
    modelo: [
      {
        nome: "Joao Garcom",
        login: "joao_garcom",
        role: "garcom",
        senha: "",
        ativo: "sim",
      },
      {
        nome: "Equipe Cozinha",
        login: "cozinha",
        role: "cozinha",
        senha: "",
        ativo: "sim",
      },
    ],
  },
};

const HEADER_ALIASES = {
  nome: [
    "nome",
    "name",
    "produto",
    "categoria",
    "usuario",
    "item",
    "nome_item",
    "nome_do_item",
    "nome_produto",
    "descricao_produto",
  ],
  ordem: ["ordem", "order", "posicao"],
  categoria: [
    "categoria",
    "category",
    "grupo",
    "secao",
    "grupo_produto",
    "grupo_item",
    "departamento",
    "categoria_do_item",
  ],
  descricao: [
    "descricao",
    "description",
    "detalhes",
    "complemento",
    "observacao",
    "descricao_detalhada",
    "descricao_do_item",
  ],
  preco: [
    "preco",
    "valor",
    "price",
    "preco_r$",
    "valor_venda",
    "preco_venda",
    "preco_de_venda",
    "valor_unitario",
    "valor_do_item",
  ],
  imagem: [
    "imagem",
    "foto",
    "url_imagem",
    "image",
    "image_url",
    "arquivo_imagem",
    "nome_arquivo_imagem",
    "url_foto",
    "url_da_imagem",
  ],
  disponivel: ["disponivel", "ativo", "status_produto", "status", "situacao"],
  numero: ["numero", "mesa", "identificacao"],
  status: ["status", "situacao"],
  login: ["login", "usuario", "user", "username"],
  role: ["role", "perfil", "funcao", "cargo"],
  senha: ["senha", "password", "senha_temporaria"],
  ativo: ["ativo", "active", "habilitado"],
};

class ImportacaoValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ImportacaoValidationError";
    this.statusCode = statusCode;
  }
}

function normalizarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarBusca(valor) {
  return normalizarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarLoginImportacao(valor) {
  return normalizarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarDinheiro(valor) {
  const texto = normalizarTexto(valor)
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarInteiro(valor, fallback = null) {
  const numero = Number.parseInt(normalizarTexto(valor), 10);
  return Number.isInteger(numero) ? numero : fallback;
}

function normalizarBoolean(valor, fallback = true) {
  const texto = normalizarBusca(valor);
  if (!texto) return fallback;
  if (["1", "sim", "s", "true", "ativo", "disponivel", "disponivel"].includes(texto)) {
    return true;
  }
  if (["0", "nao", "n", "false", "inativo", "indisponivel"].includes(texto)) {
    return false;
  }
  return fallback;
}

function normalizarRole(valor) {
  const texto = normalizarBusca(valor || "garcom");
  const mapa = {
    admin: "admin",
    administrador: "admin",
    master: "admin",
    garcom: "garcom",
    garcon: "garcom",
    waiter: "garcom",
    cozinha: "cozinha",
    kitchen: "cozinha",
    financeiro: "financeiro",
    caixa: "financeiro",
  };
  return mapa[texto] || null;
}

function valorDaLinha(linha, campo) {
  const aliases = HEADER_ALIASES[campo] || [campo];
  const normalizados = new Map(
    Object.keys(linha || {}).map((chave) => [normalizarBusca(chave), chave]),
  );

  for (const alias of aliases) {
    const chaveOriginal = normalizados.get(normalizarBusca(alias));
    if (chaveOriginal) return linha[chaveOriginal];
  }
  return "";
}

function linhaVazia(linha) {
  return Object.values(linha || {}).every((valor) => !normalizarTexto(valor));
}

function referenciaImagemLocalSegura(valor) {
  const texto = normalizarTexto(valor);
  if (!texto || texto.length > 180) return false;
  if (texto.includes("..")) return false;
  const nomeArquivo = texto.split(/[\\/]/).pop();
  if (!nomeArquivo || nomeArquivo.length > 120) return false;
  return /\.(jpe?g|png|webp|gif)$/i.test(nomeArquivo);
}

function normalizarImagemOpcional(valor, erros, campo = "imagem", opcoes = {}) {
  const texto = normalizarTexto(valor);
  if (!texto) return "";
  if (!/^https?:\/\//i.test(texto)) {
    if (opcoes.permitirImagemLocal && referenciaImagemLocalSegura(texto)) {
      return texto;
    }
    erros.push(`${campo} deve ser uma URL http(s) ou nome de arquivo de imagem enviado`);
  }
  return texto;
}

function normalizarCategoria(linha, numeroLinha) {
  const erros = [];
  const nome = normalizarTexto(valorDaLinha(linha, "nome"));
  if (!nome) erros.push("nome e obrigatorio");
  if (nome.length > 80) erros.push("nome deve ter ate 80 caracteres");

  return {
    linha: numeroLinha,
    chave: normalizarBusca(nome),
    dados: {
      nome,
      ordem: normalizarInteiro(valorDaLinha(linha, "ordem"), 99),
    },
    erros,
  };
}

function normalizarProduto(linha, numeroLinha, opcoes = {}) {
  const erros = [];
  const nome = normalizarTexto(valorDaLinha(linha, "nome"));
  const categoria = normalizarTexto(valorDaLinha(linha, "categoria"));
  const descricao = normalizarTexto(valorDaLinha(linha, "descricao"));
  const preco = normalizarDinheiro(valorDaLinha(linha, "preco"));
  const imagem = normalizarImagemOpcional(valorDaLinha(linha, "imagem"), erros, "imagem", opcoes);
  const disponivel = normalizarBoolean(valorDaLinha(linha, "disponivel"), true);

  if (!nome) erros.push("nome e obrigatorio");
  if (nome.length > 120) erros.push("nome deve ter ate 120 caracteres");
  if (preco === null || preco < 0) erros.push("preco deve ser um numero maior ou igual a zero");
  if (descricao.length > 1000) erros.push("descricao deve ter ate 1000 caracteres");

  return {
    linha: numeroLinha,
    chave: normalizarBusca(nome),
    dados: {
      nome,
      categoria,
      categoria_chave: normalizarBusca(categoria),
      descricao,
      preco,
      imagem,
      disponivel,
    },
    erros,
  };
}

function normalizarMesa(linha, numeroLinha) {
  const erros = [];
  const numero = normalizarTexto(valorDaLinha(linha, "numero"));
  const statusTexto = normalizarBusca(valorDaLinha(linha, "status") || "livre");
  const status = ["livre", "ocupada"].includes(statusTexto) ? statusTexto : "livre";

  if (!numero) erros.push("numero e obrigatorio");
  if (numero.length > 30) erros.push("numero deve ter ate 30 caracteres");

  return {
    linha: numeroLinha,
    chave: normalizarBusca(numero),
    dados: { numero, status },
    erros,
  };
}

function normalizarUsuario(linha, numeroLinha) {
  const erros = [];
  const nome = normalizarTexto(valorDaLinha(linha, "nome"));
  const login = normalizarLoginImportacao(valorDaLinha(linha, "login") || nome);
  const role = normalizarRole(valorDaLinha(linha, "role"));
  const senha = normalizarTexto(valorDaLinha(linha, "senha"));
  const ativo = normalizarBoolean(valorDaLinha(linha, "ativo"), true);

  if (!nome) erros.push("nome e obrigatorio");
  if (!login) erros.push("login e obrigatorio");
  if (!role) erros.push("role invalido");
  if (senha && senha.length < 8) erros.push("senha deve ter pelo menos 8 caracteres");

  return {
    linha: numeroLinha,
    chave: login,
    dados: { nome, login, role, senha, senha_informada: Boolean(senha), ativo },
    erros,
  };
}

function normalizarLinhasImportacao(tipo, linhas, opcoes = {}) {
  if (!TIPOS_IMPORTACAO[tipo]) {
    throw new ImportacaoValidationError("Tipo de importacao invalido");
  }
  if (!Array.isArray(linhas)) {
    throw new ImportacaoValidationError("Linhas da importacao invalidas");
  }
  if (linhas.length > MAX_LINHAS_IMPORTACAO) {
    throw new ImportacaoValidationError(`Importe no maximo ${MAX_LINHAS_IMPORTACAO} linhas por vez`);
  }

  const normalizadores = {
    categorias: normalizarCategoria,
    produtos: normalizarProduto,
    mesas: normalizarMesa,
    usuarios: normalizarUsuario,
  };
  const normalizador = normalizadores[tipo];
  const chavesArquivo = new Set();

  return linhas
    .map((linha, indice) => ({ linha, numeroLinha: indice + 2 }))
    .filter(({ linha }) => !linhaVazia(linha))
    .map(({ linha, numeroLinha }) => {
      const item = normalizador(linha, numeroLinha, opcoes);
      if (item.chave) {
        if (chavesArquivo.has(item.chave)) {
          item.erros.push("registro duplicado no arquivo");
        }
        chavesArquivo.add(item.chave);
      }
      return item;
    });
}

function gerarSenhaTemporaria() {
  return `Autenix@${crypto.randomBytes(4).toString("hex")}`;
}

function escaparCsv(valor) {
  const texto = String(valor ?? "");
  if (/[",;\n\r]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function gerarCsvModelo(tipo) {
  const spec = TIPOS_IMPORTACAO[tipo];
  if (!spec) throw new ImportacaoValidationError("Tipo de importacao invalido");
  const linhas = [spec.colunas.join(";")];
  for (const item of spec.modelo) {
    linhas.push(spec.colunas.map((coluna) => escaparCsv(item[coluna])).join(";"));
  }
  return `${linhas.join("\n")}\n`;
}

module.exports = {
  MAX_LINHAS_IMPORTACAO,
  TIPOS_IMPORTACAO,
  ImportacaoValidationError,
  gerarCsvModelo,
  gerarSenhaTemporaria,
  normalizarBusca,
  normalizarLinhasImportacao,
};
