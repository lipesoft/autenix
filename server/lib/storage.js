const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const MIME_TO_FORMAT = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const ALLOWED_IMAGE_MIMES = new Set(MIME_TO_FORMAT.keys());
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "autenix-assets";
const maxImageMbConfig = Number(process.env.UPLOAD_MAX_IMAGE_MB || 3);
const MAX_IMAGE_MB = Number.isFinite(maxImageMbConfig) && maxImageMbConfig > 0
  ? maxImageMbConfig
  : 3;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_IMAGE_DIMENSION = 8_000;
const OUTPUT_MAX_DIMENSION = 2_400;

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

async function processarImagemSegura(file) {
  validarArquivoImagem(file);
  let imagem;
  let metadata;
  try {
    imagem = sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    });
    metadata = await imagem.metadata();
  } catch {
    throw new UploadValidationError("O arquivo nao contem uma imagem valida");
  }

  const formatoEsperado = MIME_TO_FORMAT.get(file.mimetype);
  if (!metadata.format || metadata.format !== formatoEsperado) {
    throw new UploadValidationError(
      "O conteudo do arquivo nao corresponde ao formato informado",
    );
  }
  if (!metadata.width || !metadata.height) {
    throw new UploadValidationError("Nao foi possivel identificar as dimensoes da imagem");
  }
  if (
    metadata.width > MAX_IMAGE_DIMENSION
    || metadata.height > MAX_IMAGE_DIMENSION
    || metadata.width * metadata.height > MAX_IMAGE_PIXELS
  ) {
    throw new UploadValidationError(
      `A imagem deve ter no maximo ${MAX_IMAGE_DIMENSION}px por lado`,
    );
  }
  if (Number(metadata.pages || 1) > 1) {
    throw new UploadValidationError("Imagens animadas nao sao permitidas");
  }

  try {
    const { data, info } = await imagem
      .rotate()
      .resize({
        width: OUTPUT_MAX_DIMENSION,
        height: OUTPUT_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, alphaQuality: 90, effort: 4, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

    if (!data.length || data.length > MAX_IMAGE_BYTES) {
      throw new UploadValidationError(
        `A imagem processada ultrapassa o limite de ${MAX_IMAGE_MB}MB`,
        413,
      );
    }
    return {
      buffer: data,
      mimetype: "image/webp",
      extension: "webp",
      width: info.width,
      height: info.height,
      size: data.length,
    };
  } catch (error) {
    if (error instanceof UploadValidationError) throw error;
    throw new UploadValidationError("Nao foi possivel processar esta imagem");
  }
}

function normalizarTipo(tipo) {
  const tipoSeguro = String(tipo || "produto").trim().toLowerCase();
  if (["produto", "logo", "marca"].includes(tipoSeguro)) return tipoSeguro;
  return "midia";
}

function montarCaminhoImagem(restauranteId, tipo, extension = "webp") {
  const id = Number(restauranteId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new UploadValidationError("Restaurante invalido");
  }

  const arquivo = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  return `restaurantes/${id}/${normalizarTipo(tipo)}/${arquivo}`;
}

async function enviarImagemRestaurante({ restauranteId, tipo, file }) {
  const imagem = await processarImagemSegura(file);

  const caminho = montarCaminhoImagem(restauranteId, tipo, imagem.extension);
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(caminho, imagem.buffer, {
    cacheControl: "3600",
    contentType: imagem.mimetype,
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
    formato: imagem.mimetype,
    largura: imagem.width,
    altura: imagem.height,
    tamanho_bytes: imagem.size,
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
  processarImagemSegura,
};
