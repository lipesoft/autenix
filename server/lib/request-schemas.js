const { z } = require("zod");
const {
  ACOES_AUDITORIA,
  ENTIDADES_AUDITORIA,
} = require("./operational-audit");

const ROLES_RESTAURANTE = ["admin", "garcom", "cozinha", "financeiro"];
const STATUS_PEDIDO = ["pendente", "preparo", "pronto", "entregue", "finalizado"];
const STATUS_ITEM = ["pendente", "preparo", "pronto"];
const FORMAS_PAGAMENTO = ["credito", "debito", "dinheiro", "pix"];
const TIPOS_IMPORTACAO = ["categorias", "produtos", "mesas", "usuarios"];
const PLANOS = ["essencial", "profissional", "enterprise"];
const CICLOS_COBRANCA = ["mensal", "anual", "experimental", "personalizado"];
const STATUS_COBRANCA = ["trial", "ativo", "pendente", "atrasado", "isento"];
const STATUS_COMERCIAL = ["lead", "trial", "cliente", "suspenso", "cancelado", "isento"];
const ACOES_AUDITORIA_LISTA = Array.from(ACOES_AUDITORIA);
const ENTIDADES_AUDITORIA_LISTA = Array.from(ENTIDADES_AUDITORIA);

function trimString(value) {
  return typeof value === "string" ? value.trim() : value;
}

function textoObrigatorio(max) {
  return z.preprocess(
    trimString,
    z.string().min(1, "obrigatorio").max(max, `maximo de ${max} caracteres`),
  );
}

function textoOpcional(max) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      return trimString(value);
    },
    z.string().max(max, `maximo de ${max} caracteres`).optional(),
  );
}

function booleanOpcional() {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      if (value === true || value === 1 || value === "1" || value === "true") return true;
      if (value === false || value === 0 || value === "0" || value === "false") return false;
      return value;
    },
    z.boolean().optional(),
  );
}

function flagNumericaOpcional() {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      if (value === true || value === 1 || value === "1" || value === "true") return 1;
      if (value === false || value === 0 || value === "0" || value === "false") return 0;
      return value;
    },
    z.coerce.number().int().min(0).max(1).optional(),
  );
}

const dataOpcionalSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return trimString(value);
  },
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve estar no formato YYYY-MM-DD")
    .optional(),
);

const horaSchema = z.preprocess(
  trimString,
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horario deve estar no formato HH:MM"),
);

const httpsUrlOpcionalSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return trimString(value);
  },
  z.string()
    .url("url invalida")
    .max(2048, "maximo de 2048 caracteres")
    .refine((value) => value.startsWith("https://"), "url deve usar HTTPS")
    .optional(),
);

const idPositivo = z.coerce.number().int("deve ser inteiro").positive("deve ser positivo");

const idParamSchema = z.object({
  id: idPositivo,
}).strict();

const mesaIdParamSchema = z.object({
  mesa_id: idPositivo,
}).strict();

const slugSchema = z.preprocess(
  trimString,
  z.string()
    .min(1, "obrigatorio")
    .max(80, "maximo de 80 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug invalido"),
);

const slugOpcionalSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return trimString(value);
  },
  slugSchema.optional(),
);

const sessaoMesaOpcionalSchema = textoOpcional(256).refine(
  (value) => !value || /^[A-Za-z0-9_-]+$/.test(value),
  "sessao invalida",
);

const pedidoItemSchema = z.object({
  produto_id: idPositivo,
  quantidade: z.coerce.number().int("deve ser inteira").min(1, "minimo 1").max(99, "maximo 99"),
  observacao: textoOpcional(300).default(""),
}).strict();

const criarPedidoBodySchema = z.object({
  mesa_id: idPositivo,
  itens: z.array(pedidoItemSchema).min(1, "adicione pelo menos um item").max(50, "maximo de 50 itens"),
  nome_cliente: textoOpcional(80),
  restaurante_slug: slugOpcionalSchema,
  sessao: sessaoMesaOpcionalSchema,
}).strict();

const listarPedidosQuerySchema = z.object({
  mesa_id: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    idPositivo.optional(),
  ),
  status: z.enum(STATUS_PEDIDO).optional(),
  restaurante_slug: slugOpcionalSchema,
  sessao: sessaoMesaOpcionalSchema,
}).strict();

const pedidoStatusBodySchema = z.object({
  status: z.enum(STATUS_PEDIDO),
  garcom_id: z.coerce.number().int().positive().optional(),
  garcom_nome: textoOpcional(120),
}).strict();

const itemStatusBodySchema = z.object({
  status: z.enum(STATUS_ITEM),
}).strict();

const cancelarItemBodySchema = z.object({
  mesa_id: idPositivo,
  restaurante_slug: slugOpcionalSchema,
  sessao: sessaoMesaOpcionalSchema,
}).strict();

const chamadaBodySchema = z.object({
  mesa_id: idPositivo,
  motivo: textoOpcional(80),
  nome_cliente: textoOpcional(80),
  restaurante_slug: slugOpcionalSchema,
  sessao: sessaoMesaOpcionalSchema,
}).strict();

const fecharMesaBodySchema = z.object({
  forma_pagamento: z.enum(FORMAS_PAGAMENTO),
  obs_pagamento: textoOpcional(300),
}).strict();

const mesaCreateBodySchema = z.object({
  numero: textoObrigatorio(30),
}).strict();

const categoriaCreateBodySchema = z.object({
  nome: textoObrigatorio(80),
}).strict();

const produtoCreateBodySchema = z.object({
  categoria_id: idPositivo,
  nome: textoObrigatorio(120),
  descricao: textoOpcional(500).default(""),
  preco: z.coerce.number().min(0, "preco minimo 0").max(999999, "preco muito alto"),
  imagem: httpsUrlOpcionalSchema,
}).strict();

const produtoUpdateBodySchema = z.object({
  id: idPositivo.optional(),
  categoria_id: idPositivo.optional(),
  nome: textoObrigatorio(120),
  descricao: textoOpcional(500).default(""),
  preco: z.coerce.number().min(0, "preco minimo 0").max(999999, "preco muito alto"),
  disponivel: flagNumericaOpcional().default(1),
  imagem: httpsUrlOpcionalSchema,
}).strict();

const loginBodySchema = z.object({
  login: textoObrigatorio(80),
  senha: z.string().min(1, "obrigatoria").max(200, "maximo de 200 caracteres"),
  restaurante_slug: slugOpcionalSchema,
}).strict();

const usuarioCreateBodySchema = z.object({
  nome: textoObrigatorio(120),
  login: textoOpcional(80),
  senha: z.string().min(6, "minimo de 6 caracteres").max(200, "maximo de 200 caracteres"),
  role: z.enum(ROLES_RESTAURANTE),
}).strict();

const usuarioUpdateBodySchema = z.object({
  nome: textoOpcional(120),
  login: textoOpcional(80),
  senha: z.string().max(200, "maximo de 200 caracteres").optional(),
  ativo: z.coerce.number().int().min(0).max(1).optional(),
  role: z.enum(ROLES_RESTAURANTE).optional(),
}).strict();

const reservaConfiguracaoBodySchema = z.object({
  ativo: flagNumericaOpcional(),
  dias_semana: z.array(
    z.coerce.number().int().min(0).max(6),
  ).min(1, "selecione pelo menos um dia").max(7, "maximo de 7 dias").optional(),
  hora_inicio: horaSchema.optional(),
  hora_fim: horaSchema.optional(),
  intervalo_minutos: z.coerce.number().int().min(15).max(240).optional(),
  duracao_minutos: z.coerce.number().int().min(15).max(360).optional(),
  antecedencia_minutos: z.coerce.number().int().min(0).max(10080).optional(),
  horizonte_dias: z.coerce.number().int().min(1).max(365).optional(),
  limite_reservas_horario: z.coerce.number().int().min(0).max(500).optional(),
  limite_pessoas_horario: z.coerce.number().int().min(0).max(5000).optional(),
  permitir_fila: flagNumericaOpcional(),
}).strict();

const reservaSalaoBodySchema = z.object({
  nome: textoObrigatorio(80),
  capacidade_pessoas: z.coerce.number().int().min(1).max(5000),
  ativo: flagNumericaOpcional().default(1),
  ordem: z.coerce.number().int().min(0).max(9999).optional(),
}).strict();

const plataformaRestauranteBodySchema = z.object({
  nome: textoObrigatorio(120),
  slug: slugOpcionalSchema,
  login: textoOpcional(64),
  nome_master: textoOpcional(100),
  senha: z.string().min(12, "minimo de 12 caracteres").max(200, "maximo de 200 caracteres").optional(),
  mesas: z.coerce.number().int().min(0).max(500).optional(),
  plano: z.enum(PLANOS).optional(),
  limite_mesas: z.coerce.number().int().min(1).max(500).optional(),
  limite_usuarios: z.coerce.number().int().min(1).max(500).optional(),
  limite_produtos: z.coerce.number().int().min(1).max(10000).optional(),
  mensalidade: textoOpcional(40),
  mensalidade_centavos: z.coerce.number().int().min(0).max(99999900).optional(),
  ciclo_cobranca: z.enum(CICLOS_COBRANCA).optional(),
  status_cobranca: z.enum(STATUS_COBRANCA).optional(),
  trial_termina_em: dataOpcionalSchema,
  proxima_cobranca_em: dataOpcionalSchema,
  observacoes_plano: textoOpcional(500),
  status_comercial: z.enum(STATUS_COMERCIAL).optional(),
  data_inicio_contrato: dataOpcionalSchema,
  ultimo_contato_comercial_em: dataOpcionalSchema,
  responsavel_comercial: textoOpcional(120),
  motivo_suspensao: textoOpcional(500),
  motivo_historico: textoOpcional(500),
  white_label_ativo: booleanOpcional(),
  nome_exibicao: textoOpcional(80),
  logo_url: httpsUrlOpcionalSchema,
  cor_primaria: textoOpcional(7),
  cor_secundaria: textoOpcional(7),
  cor_texto_principal: textoOpcional(7),
  cor_texto_secundario: textoOpcional(7),
  cor_titulo: textoOpcional(7),
  cor_texto_inverso: textoOpcional(7),
  whatsapp_numero: textoOpcional(32),
}).strict();

const plataformaRestauranteStatusBodySchema = z.object({
  ativo: z.boolean(),
}).strict();

const plataformaRedefinirMasterBodySchema = z.object({
  senha: z.string().min(12, "minimo de 12 caracteres").max(200, "maximo de 200 caracteres").optional(),
}).strict();

const plataformaMinhaSenhaBodySchema = z.object({
  senha_atual: z.string().min(1, "obrigatoria").max(200, "maximo de 200 caracteres"),
  nova_senha: z.string().min(12, "minimo de 12 caracteres").max(200, "maximo de 200 caracteres"),
}).strict();

const importacaoRowsSchema = z.array(z.record(z.string(), z.unknown()))
  .min(1, "adicione pelo menos uma linha")
  .max(500, "maximo de 500 linhas por importacao");

const importacaoBodySchema = z.object({
  tipo: z.enum(TIPOS_IMPORTACAO),
  rows: importacaoRowsSchema.optional(),
  linhas: importacaoRowsSchema.optional(),
  atualizar_existentes: z.boolean().optional(),
  permitir_imagem_local: z.boolean().optional(),
  origem_sistema: textoOpcional(80),
  arquivo_nome: textoOpcional(500),
  formato: textoOpcional(20),
  mapeamento: z.record(z.string(), z.string().max(200)).optional(),
}).strict().refine(
  (payload) => Boolean(payload.rows?.length || payload.linhas?.length),
  { message: "rows ou linhas deve conter registros", path: ["rows"] },
);

const importacaoHistoricoQuerySchema = z.object({
  limite: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(50).optional(),
  ),
}).strict();

const auditoriaQuerySchema = z.object({
  limite: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(100).default(40),
  ),
  offset: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.coerce.number().int().min(0).max(10000).default(0),
  ),
  acao: z.enum(ACOES_AUDITORIA_LISTA).optional(),
  entidade: z.enum(ENTIDADES_AUDITORIA_LISTA).optional(),
  usuario_id: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    idPositivo.optional(),
  ),
  entidade_id: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    idPositivo.optional(),
  ),
  de: dataOpcionalSchema,
  ate: dataOpcionalSchema,
}).strict();

const plataformaAuditoriaQuerySchema = auditoriaQuerySchema.extend({
  restaurante_id: idPositivo,
}).strict();

module.exports = {
  auditoriaQuerySchema,
  cancelarItemBodySchema,
  categoriaCreateBodySchema,
  chamadaBodySchema,
  criarPedidoBodySchema,
  fecharMesaBodySchema,
  idParamSchema,
  importacaoBodySchema,
  importacaoHistoricoQuerySchema,
  itemStatusBodySchema,
  listarPedidosQuerySchema,
  loginBodySchema,
  mesaCreateBodySchema,
  mesaIdParamSchema,
  pedidoStatusBodySchema,
  plataformaMinhaSenhaBodySchema,
  plataformaAuditoriaQuerySchema,
  plataformaRedefinirMasterBodySchema,
  plataformaRestauranteBodySchema,
  plataformaRestauranteStatusBodySchema,
  produtoCreateBodySchema,
  produtoUpdateBodySchema,
  reservaConfiguracaoBodySchema,
  reservaSalaoBodySchema,
  usuarioCreateBodySchema,
  usuarioUpdateBodySchema,
};
