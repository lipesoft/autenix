class RequestValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "RequestValidationError";
    this.statusCode = 400;
    this.details = details;
  }
}

function issuePath(issue) {
  return issue.path?.length ? issue.path.join(".") : "payload";
}

function formatZodIssues(issues = []) {
  return issues.map((issue) => ({
    campo: issuePath(issue),
    mensagem: issue.message,
  }));
}

function parseWithSchema(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const details = formatZodIssues(result.error.issues);
  const first = details[0];
  throw new RequestValidationError(
    first ? `${first.campo}: ${first.mensagem}` : "Payload invalido",
    details,
  );
}

function validateBody(req, schema) {
  const parsed = parseWithSchema(schema, req.body || {});
  req.body = parsed;
  return parsed;
}

function validateQuery(req, schema) {
  const parsed = parseWithSchema(schema, req.query || {});
  req.query = parsed;
  return parsed;
}

function validateParams(req, schema) {
  const parsed = parseWithSchema(schema, req.params || {});
  req.params = parsed;
  return parsed;
}

function safeErrorResponse(res, error, options = {}) {
  if (error instanceof RequestValidationError) {
    return res.status(error.statusCode).json({
      erro: error.message,
      detalhes: error.details,
    });
  }

  const statusCode = Number(error.statusCode || error.status || 500);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ erro: error.message });
  }

  const logPrefix = options.logPrefix || "Falha na API";
  console.error(`${logPrefix}:`, error.message);
  return res.status(500).json({
    erro: options.fallbackMessage || "Nao foi possivel processar a requisicao",
  });
}

module.exports = {
  RequestValidationError,
  parseWithSchema,
  safeErrorResponse,
  validateBody,
  validateParams,
  validateQuery,
};
