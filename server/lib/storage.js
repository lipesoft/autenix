const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const MIME_TO_EXTENSION = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const ALLOWED_IMAGE_MIMES = new Set(MIME_TO_EXTENSION.keys());
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "autenix-assets";
const maxImageMbConfig = Number(process.env.UPLOAD_MAX_IMAGE_MB || 3);
const MAX_IMAGE_MB = Number.isFinite(maxImageMbConfig) && maxImageMbConfig > 0
  ? maxImageMbConfig
  : 3;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

let supabaseClient = null;

class UploadValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "UploadValidationError";
    this.statusCode = statusCode;
  }
}

class StorageConfigurationError extends Error {
  constructor() {
    super("Storage de imagens nao configurado");
    this.name = "StorageConfigurationError";
    this.statusCode = 503;
  }
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new StorageConfigurationError();
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}

function validarArquivoImagem(file) {
  if (!file) {
    throw new UploadValidationError("Envie uma imagem para continuar");
  }
  if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
    throw new UploadValidationError("Use uma imagem JPG, PNG, WEBP ou GIF");
  }
  if (!file.buffer?.length) {
    throw new UploadValidationError("Arquivo de imagem vazio");
  }
}

function normalizarTipo(tipo) {
  const tipoSeguro = String(tipo || "produto").trim().toLowerCase();
  if (["produto", "logo", "marca"].includes(tipoSeguro)) return tipoSeguro;
  return "midia";
}

function montarCaminhoImagem(restauranteId, tipo, file) {
  const id = Number(restauranteId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new UploadValidationError("Restaurante invalido");
  }

  const extensao = MIME_TO_EXTENSION.get(file.mimetype);
  const arquivo = `${Date.now()}-${crypto.randomUUID()}.${extensao}`;
  return `restaurantes/${id}/${normalizarTipo(tipo)}/${arquivo}`;
}

async function enviarImagemRestaurante({ restauranteId, tipo, file }) {
  validarArquivoImagem(file);

  const caminho = montarCaminhoImagem(restauranteId, tipo, file);
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(caminho, file.buffer, {
    cacheControl: "3600",
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    const uploadError = new Error(error.message || "Falha ao salvar imagem");
    uploadError.statusCode = error.statusCode || 500;
    throw uploadError;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(caminho);
  return {
    bucket: STORAGE_BUCKET,
    path: caminho,
    url: data.publicUrl,
  };
}

module.exports = {
  ALLOWED_IMAGE_MIMES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  UploadValidationError,
  StorageConfigurationError,
  enviarImagemRestaurante,
  normalizarTipo,
};
