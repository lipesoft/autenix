const CONFIG_RESERVAS_PADRAO = {
  ativo: 1,
  dias_semana: [0, 1, 2, 3, 4, 5, 6],
  hora_inicio: "18:00",
  hora_fim: "23:00",
  intervalo_minutos: 30,
  duracao_minutos: 90,
  antecedencia_minutos: 60,
  horizonte_dias: 30,
  limite_reservas_horario: 0,
  limite_pessoas_horario: 0,
  permitir_fila: 1,
};

const STATUS_RESERVA_BLOQUEIAM_CAPACIDADE = [
  "pendente",
  "confirmada",
  "fila",
  "chamada",
];

class ReservaDisponibilidadeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReservaDisponibilidadeValidationError";
    this.statusCode = 400;
  }
}

function texto(valor) {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

function normalizarInteiro(valor, campo, min, max, padrao) {
  const entrada = valor === undefined || valor === null || valor === "" ? padrao : valor;
  const numero = Number(entrada);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw new ReservaDisponibilidadeValidationError(
      `${campo} deve ser um numero entre ${min} e ${max}`,
    );
  }
  return numero;
}

function normalizarFlag(valor, padrao = 1) {
  if (valor === undefined || valor === null || valor === "") return padrao ? 1 : 0;
  if (valor === true || valor === 1 || valor === "1" || valor === "true") return 1;
  if (valor === false || valor === 0 || valor === "0" || valor === "false") return 0;
  throw new ReservaDisponibilidadeValidationError("Campo booleano invalido");
}

function minutosDoHorario(horario) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(texto(horario));
  if (!match) {
    throw new ReservaDisponibilidadeValidationError("Horario deve estar no formato HH:MM");
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function horarioDosMinutos(minutos) {
  const horas = String(Math.floor(minutos / 60)).padStart(2, "0");
  const mins = String(minutos % 60).padStart(2, "0");
  return `${horas}:${mins}`;
}

function normalizarHorario(horario, campo) {
  return horarioDosMinutos(minutosDoHorario(horario || CONFIG_RESERVAS_PADRAO[campo]));
}

function normalizarDiasSemana(valor) {
  let dias = valor;
  if (typeof valor === "string") {
    try {
      dias = JSON.parse(valor);
    } catch {
      dias = valor.split(",");
    }
  }
  if (!Array.isArray(dias)) dias = CONFIG_RESERVAS_PADRAO.dias_semana;
  const normalizados = [...new Set(dias.map((dia) => Number(dia)))]
    .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6)
    .sort((a, b) => a - b);
  if (!normalizados.length) {
    throw new ReservaDisponibilidadeValidationError("Selecione pelo menos um dia de reserva");
  }
  return normalizados;
}

function normalizarConfiguracaoReservas(payload = {}) {
  const config = {
    ativo: normalizarFlag(payload.ativo, CONFIG_RESERVAS_PADRAO.ativo),
    dias_semana: normalizarDiasSemana(
      payload.dias_semana ?? CONFIG_RESERVAS_PADRAO.dias_semana,
    ),
    hora_inicio: normalizarHorario(
      payload.hora_inicio || CONFIG_RESERVAS_PADRAO.hora_inicio,
      "hora_inicio",
    ),
    hora_fim: normalizarHorario(
      payload.hora_fim || CONFIG_RESERVAS_PADRAO.hora_fim,
      "hora_fim",
    ),
    intervalo_minutos: normalizarInteiro(
      payload.intervalo_minutos,
      "Intervalo",
      15,
      240,
      CONFIG_RESERVAS_PADRAO.intervalo_minutos,
    ),
    duracao_minutos: normalizarInteiro(
      payload.duracao_minutos,
      "Duracao",
      15,
      360,
      CONFIG_RESERVAS_PADRAO.duracao_minutos,
    ),
    antecedencia_minutos: normalizarInteiro(
      payload.antecedencia_minutos,
      "Antecedencia",
      0,
      10080,
      CONFIG_RESERVAS_PADRAO.antecedencia_minutos,
    ),
    horizonte_dias: normalizarInteiro(
      payload.horizonte_dias,
      "Horizonte",
      1,
      365,
      CONFIG_RESERVAS_PADRAO.horizonte_dias,
    ),
    limite_reservas_horario: normalizarInteiro(
      payload.limite_reservas_horario,
      "Limite de reservas por horario",
      0,
      500,
      CONFIG_RESERVAS_PADRAO.limite_reservas_horario,
    ),
    limite_pessoas_horario: normalizarInteiro(
      payload.limite_pessoas_horario,
      "Limite de pessoas por horario",
      0,
      5000,
      CONFIG_RESERVAS_PADRAO.limite_pessoas_horario,
    ),
    permitir_fila: normalizarFlag(
      payload.permitir_fila,
      CONFIG_RESERVAS_PADRAO.permitir_fila,
    ),
  };

  if (minutosDoHorario(config.hora_fim) <= minutosDoHorario(config.hora_inicio)) {
    throw new ReservaDisponibilidadeValidationError(
      "Horario final deve ser maior que o inicial",
    );
  }
  if (
    minutosDoHorario(config.hora_inicio) + config.duracao_minutos >
    minutosDoHorario(config.hora_fim)
  ) {
    throw new ReservaDisponibilidadeValidationError(
      "Duracao da reserva nao cabe dentro do horario configurado",
    );
  }
  return config;
}

function normalizarSalaoReserva(payload = {}) {
  const nome = texto(payload.nome);
  if (nome.length < 2 || nome.length > 80) {
    throw new ReservaDisponibilidadeValidationError(
      "Nome do salao deve ter entre 2 e 80 caracteres",
    );
  }
  return {
    nome,
    capacidade_pessoas: normalizarInteiro(
      payload.capacidade_pessoas,
      "Capacidade do salao",
      1,
      5000,
      40,
    ),
    ativo: normalizarFlag(payload.ativo, 1),
    ordem: normalizarInteiro(payload.ordem, "Ordem", 0, 9999, 0),
  };
}

function diaSemanaData(data) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto(data));
  if (!match) {
    throw new ReservaDisponibilidadeValidationError("Data deve estar no formato YYYY-MM-DD");
  }
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data) {
    throw new ReservaDisponibilidadeValidationError("Data invalida");
  }
  return parsed.getUTCDay();
}

function dataHoraReserva(data, horario, offset = "-03:00") {
  const valor = new Date(`${data}T${horario}:00${offset}`);
  if (Number.isNaN(valor.getTime())) {
    throw new ReservaDisponibilidadeValidationError("Data ou horario invalido");
  }
  return valor;
}

function gerarHorariosReserva(configuracao) {
  const config = normalizarConfiguracaoReservas(configuracao);
  const inicio = minutosDoHorario(config.hora_inicio);
  const fim = minutosDoHorario(config.hora_fim);
  const horarios = [];
  for (
    let minuto = inicio;
    minuto + config.duracao_minutos <= fim;
    minuto += config.intervalo_minutos
  ) {
    horarios.push(horarioDosMinutos(minuto));
  }
  return horarios;
}

function avaliarSlotReserva({
  configuracao,
  data_reserva,
  horario,
  quantidade_pessoas,
  salao = null,
  reservas_horario = 0,
  pessoas_horario = 0,
  pessoas_salao_horario = 0,
  agora = new Date(),
  timezone_offset = "-03:00",
}) {
  const config = normalizarConfiguracaoReservas(configuracao);
  const horarioNormalizado = horarioDosMinutos(minutosDoHorario(horario));
  const quantidade = normalizarInteiro(
    quantidade_pessoas,
    "Quantidade de pessoas",
    1,
    100,
    2,
  );

  const indisponivel = (motivo, codigo) => ({
    disponivel: false,
    motivo,
    codigo,
    horario: horarioNormalizado,
  });

  if (!config.ativo) {
    return indisponivel("Reservas online pausadas no momento.", "reservas_pausadas");
  }

  if (!config.dias_semana.includes(diaSemanaData(data_reserva))) {
    return indisponivel("Restaurante nao recebe reservas neste dia.", "dia_fechado");
  }

  const inicio = minutosDoHorario(config.hora_inicio);
  const fim = minutosDoHorario(config.hora_fim);
  const minuto = minutosDoHorario(horarioNormalizado);
  if (minuto < inicio || minuto + config.duracao_minutos > fim) {
    return indisponivel("Horario fora da janela de reservas.", "fora_da_janela");
  }

  if ((minuto - inicio) % config.intervalo_minutos !== 0) {
    return indisponivel("Horario fora da grade configurada.", "fora_da_grade");
  }

  const dataHora = dataHoraReserva(data_reserva, horarioNormalizado, timezone_offset);
  const minDiff = Math.floor((dataHora.getTime() - agora.getTime()) / 60000);
  if (minDiff < config.antecedencia_minutos) {
    return indisponivel("Horario exige mais antecedencia.", "antecedencia");
  }
  const horizonteMs = config.horizonte_dias * 24 * 60 * 60 * 1000;
  if (dataHora.getTime() > agora.getTime() + horizonteMs) {
    return indisponivel("Data fora do periodo aberto para reservas.", "horizonte");
  }

  if (
    config.limite_reservas_horario > 0 &&
    Number(reservas_horario) + 1 > config.limite_reservas_horario
  ) {
    return indisponivel("Limite de reservas atingido neste horario.", "limite_reservas");
  }

  if (
    config.limite_pessoas_horario > 0 &&
    Number(pessoas_horario) + quantidade > config.limite_pessoas_horario
  ) {
    return indisponivel("Limite de pessoas atingido neste horario.", "limite_pessoas");
  }

  if (
    salao?.capacidade_pessoas > 0 &&
    Number(pessoas_salao_horario) + quantidade > Number(salao.capacidade_pessoas)
  ) {
    return indisponivel("Capacidade do salao atingida neste horario.", "capacidade_salao");
  }

  return {
    disponivel: true,
    motivo: "",
    codigo: "disponivel",
    horario: horarioNormalizado,
  };
}

module.exports = {
  CONFIG_RESERVAS_PADRAO,
  STATUS_RESERVA_BLOQUEIAM_CAPACIDADE,
  ReservaDisponibilidadeValidationError,
  avaliarSlotReserva,
  gerarHorariosReserva,
  horarioDosMinutos,
  minutosDoHorario,
  normalizarConfiguracaoReservas,
  normalizarSalaoReserva,
};
