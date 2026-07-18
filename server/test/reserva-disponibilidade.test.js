const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  ReservaDisponibilidadeValidationError,
  avaliarSlotReserva,
  gerarHorariosReserva,
  normalizarConfiguracaoReservas,
  normalizarSalaoReserva,
} = require("../lib/reserva-disponibilidade");

test("normaliza configuracao de disponibilidade", () => {
  const config = normalizarConfiguracaoReservas({
    ativo: true,
    dias_semana: [2, 4, 6],
    hora_inicio: "18:00:00",
    hora_fim: "23:00",
    intervalo_minutos: "30",
    duracao_minutos: "90",
    limite_reservas_horario: "",
  });

  assert.equal(config.ativo, 1);
  assert.deepEqual(config.dias_semana, [2, 4, 6]);
  assert.equal(config.hora_inicio, "18:00");
  assert.equal(config.limite_reservas_horario, 0);
});

test("gera horarios dentro da janela configurada", () => {
  const horarios = gerarHorariosReserva({
    hora_inicio: "18:00",
    hora_fim: "20:00",
    intervalo_minutos: 30,
    duracao_minutos: 60,
  });

  assert.deepEqual(horarios, ["18:00", "18:30", "19:00"]);
});

test("avalia slot disponivel com capacidade", () => {
  const resultado = avaliarSlotReserva({
    configuracao: {
      dias_semana: [1, 2, 3, 4, 5],
      hora_inicio: "18:00",
      hora_fim: "23:00",
      limite_reservas_horario: 2,
      limite_pessoas_horario: 10,
    },
    data_reserva: "2026-07-20",
    horario: "19:00",
    quantidade_pessoas: 4,
    reservas_horario: 1,
    pessoas_horario: 4,
    salao: { capacidade_pessoas: 12 },
    pessoas_salao_horario: 4,
    agora: new Date("2026-07-18T12:00:00-03:00"),
  });

  assert.equal(resultado.disponivel, true);
});

test("bloqueia por dia, grade e capacidade", () => {
  const base = {
    configuracao: {
      dias_semana: [1],
      hora_inicio: "18:00",
      hora_fim: "23:00",
      intervalo_minutos: 30,
      duracao_minutos: 90,
    },
    data_reserva: "2026-07-21",
    horario: "19:10",
    quantidade_pessoas: 2,
    agora: new Date("2026-07-18T12:00:00-03:00"),
  };

  assert.equal(avaliarSlotReserva(base).codigo, "dia_fechado");
  assert.equal(
    avaliarSlotReserva({ ...base, data_reserva: "2026-07-20" }).codigo,
    "fora_da_grade",
  );
  assert.equal(
    avaliarSlotReserva({
      ...base,
      data_reserva: "2026-07-20",
      horario: "19:00",
      salao: { capacidade_pessoas: 4 },
      pessoas_salao_horario: 3,
    }).codigo,
    "capacidade_salao",
  );
});

test("normaliza salao de reserva", () => {
  const salao = normalizarSalaoReserva({
    nome: " Varanda ",
    capacidade_pessoas: "28",
    ativo: "1",
  });

  assert.equal(salao.nome, "Varanda");
  assert.equal(salao.capacidade_pessoas, 28);
  assert.equal(salao.ativo, 1);
  assert.throws(
    () => normalizarSalaoReserva({ nome: "A", capacidade_pessoas: 0 }),
    ReservaDisponibilidadeValidationError,
  );
});
