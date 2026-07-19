const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  dataISOEmFuso,
  intervaloRelatorio,
} = require("../lib/restaurant-time");

test("mantem o dia de Sao Paulo perto da virada em UTC", () => {
  const instante = new Date("2026-07-19T01:30:00.000Z");

  assert.equal(instante.toISOString().slice(0, 10), "2026-07-19");
  assert.equal(dataISOEmFuso(instante), "2026-07-18");
});

test("calcula periodos usando o calendario do restaurante", () => {
  const agora = new Date("2026-07-19T01:30:00.000Z");

  assert.deepEqual(intervaloRelatorio({ periodo: "semana", agora }), {
    dataInicio: "2026-07-11",
    dataFim: "2026-07-18",
  });
  assert.deepEqual(intervaloRelatorio({ periodo: "ano", agora }), {
    dataInicio: "2026-01-01",
    dataFim: "2026-07-18",
  });
});

test("preserva periodo personalizado", () => {
  assert.deepEqual(
    intervaloRelatorio({
      dataInicio: "2026-07-01",
      dataFim: "2026-07-15",
      agora: new Date("2026-07-19T01:30:00.000Z"),
    }),
    { dataInicio: "2026-07-01", dataFim: "2026-07-15" },
  );
});
