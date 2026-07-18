const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MigrationHistoryError,
  checksumMigration,
  listarPendentes,
  validarHistorico,
} = require("../lib/migration-runner");

test("gera o mesmo checksum para LF e CRLF", () => {
  assert.equal(
    checksumMigration("SELECT 1;\nSELECT 2;\n"),
    checksumMigration("SELECT 1;\r\nSELECT 2;\r\n"),
  );
});

test("lista apenas migrations ainda nao aplicadas", () => {
  const migrations = [
    { arquivo: "001.sql", checksum: "a" },
    { arquivo: "002.sql", checksum: "b" },
  ];
  assert.deepEqual(
    listarPendentes(migrations, [{ arquivo: "001.sql", checksum: "a" }]),
    [{ arquivo: "002.sql", checksum: "b" }],
  );
});

test("impede alterar migration que ja foi aplicada", () => {
  assert.throws(
    () => validarHistorico(
      [{ arquivo: "001.sql", checksum: "novo" }],
      [{ arquivo: "001.sql", checksum: "antigo" }],
    ),
    MigrationHistoryError,
  );
});

test("impede remover migration do historico do projeto", () => {
  assert.throws(
    () => validarHistorico([], [{ arquivo: "001.sql", checksum: "a" }]),
    MigrationHistoryError,
  );
});
