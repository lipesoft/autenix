const RESTAURANT_TIME_ZONE = "America/Sao_Paulo";

function dataISOEmFuso(data = new Date(), timeZone = RESTAURANT_TIME_ZONE) {
  const valor = data instanceof Date ? data : new Date(data);
  if (!Number.isFinite(valor.getTime())) {
    throw new TypeError("Data invalida");
  }

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(valor);
  const porTipo = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${porTipo.year}-${porTipo.month}-${porTipo.day}`;
}

function deslocarDataISO(dataISO, dias) {
  const data = new Date(`${dataISO}T00:00:00.000Z`);
  if (!Number.isFinite(data.getTime())) {
    throw new TypeError("Data ISO invalida");
  }
  data.setUTCDate(data.getUTCDate() + Number(dias));
  return data.toISOString().slice(0, 10);
}

function intervaloRelatorio({ periodo, dataInicio, dataFim, agora = new Date() } = {}) {
  const hoje = dataISOEmFuso(agora);
  if (dataInicio) {
    return { dataInicio, dataFim: dataFim || hoje };
  }

  if (periodo === "semana") {
    return { dataInicio: deslocarDataISO(hoje, -7), dataFim: hoje };
  }
  if (periodo === "mes") {
    return { dataInicio: deslocarDataISO(hoje, -30), dataFim: hoje };
  }
  if (periodo === "ano") {
    return { dataInicio: `${hoje.slice(0, 4)}-01-01`, dataFim: hoje };
  }
  return { dataInicio: hoje, dataFim: hoje };
}

module.exports = {
  RESTAURANT_TIME_ZONE,
  dataISOEmFuso,
  deslocarDataISO,
  intervaloRelatorio,
};
