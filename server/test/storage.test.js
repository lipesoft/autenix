const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const {
  UploadValidationError,
  processarImagemSegura,
} = require("../lib/storage");

async function criarImagemJpegComOrientacao() {
  return sharp({
    create: {
      width: 80,
      height: 40,
      channels: 3,
      background: { r: 242, g: 116, b: 45 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

test("converte imagem para WebP e remove metadados", async () => {
  const entrada = await criarImagemJpegComOrientacao();
  const processada = await processarImagemSegura({
    buffer: entrada,
    mimetype: "image/jpeg",
  });
  const metadata = await sharp(processada.buffer).metadata();

  assert.equal(processada.mimetype, "image/webp");
  assert.equal(processada.extension, "webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(processada.width, 40);
  assert.equal(processada.height, 80);
});

test("recusa arquivo cuja assinatura nao corresponde ao MIME", async () => {
  const png = await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer();

  await assert.rejects(
    processarImagemSegura({ buffer: png, mimetype: "image/jpeg" }),
    UploadValidationError,
  );
});

test("recusa conteudo que nao e imagem", async () => {
  await assert.rejects(
    processarImagemSegura({
      buffer: Buffer.from("arquivo malicioso"),
      mimetype: "image/png",
    }),
    UploadValidationError,
  );
});
