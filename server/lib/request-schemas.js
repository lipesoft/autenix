const { z } = require("zod");

const ROLES_RESTAURANTE = ["admin", "garcom", "cozinha", "financeiro"];
const STATUS_PEDIDO = ["pendente", "preparo", "pronto", "entregue", "finalizado"];
const STATUS_ITEM = ["pendente", "preparo", "pronto"];
const FORMAS_PAGAMENTO = ["credito", "debito", "dinheiro", "pix"];
const TIPOS_IMPORTACAO = ["categorias", "produtos", "mesas", "usuarios"];

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

module.exports = {
  cancelarItemBodySchema,
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
  usuarioCreateBodySchema,
  usuarioUpdateBodySchema,
};
