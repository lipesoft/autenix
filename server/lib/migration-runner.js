const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class MigrationHistoryError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationHistoryError";
  }
}

function normalizarConteudoMigration(conteudo) {
  return String(conteudo).replace(/\r\n/g, "\n");
}

function checksumMigration(conteudo) {
  return crypto
    .createHash("sha256")
    .update(normalizarConteudoMigration(conteudo))
    .digest("hex");
}

function carregarMigrations(diretorio) {
  return fs
    .readdirSync(diretorio)
    .filter((arquivo) => arquivo.endsWith(".sql"))
    .sort()
    .map((arquivo) => {
      const sql = fs.readFileSync(path.join(diretorio, arquivo), "utf8");
      return { arquivo, sql, checksum: checksumMigration(sql) };
    });
}

function validarHistorico(migrations, aplicadas) {
  const disponiveis = new Map(migrations.map((migration) => [migration.arquivo, migration]));
  for (const aplicada of aplicadas) {
    const migration = disponiveis.get(aplicada.arquivo);
    if (!migration) {
      throw new MigrationHistoryError(
        `Migration aplicada nao existe mais no projeto: ${aplicada.arquivo}`,
      );
    }
    if (migration.checksum !== aplicada.checksum) {
      throw new MigrationHistoryError(
        `Migration aplicada foi alterada: ${aplicada.arquivo}`,
      );
    }
  }
}

function listarPendentes(migrations, aplicadas) {
  const nomesAplicados = new Set(aplicadas.map((migration) => migration.arquivo));
  return migrations.filter((migration) => !nomesAplicados.has(migration.arquivo));
}

module.exports = {
  MigrationHistoryError,
  carregarMigrations,
  checksumMigration,
  listarPendentes,
  normalizarConteudoMigration,
  validarHistorico,
};
