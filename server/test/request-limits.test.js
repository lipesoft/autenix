const test = require("node:test");
const assert = require("node:assert/strict");
const { chaveSessaoOuIp } = require("../lib/request-limits");

function requestFalso({ sessao, ip = "127.0.0.1" } = {}) {
  return {
    body: sessao ? { sessao } : {},
    query: {},
    headers: {},
    ip,
    socket: { remoteAddress: ip },
  };
}

test("limita acoes por sessao da mesa sem expor o token", () => {
  const token = "token-de-sessao-com-valor-secreto-123456";
  const chave = chaveSessaoOuIp(requestFalso({ sessao: token }));

  assert.match(chave, /^mesa:[a-f0-9]{64}$/);
  assert.equal(chave.includes(token), false);
  assert.equal(chave, chaveSessaoOuIp(requestFalso({ sessao: token })));
  assert.notEqual(
    chave,
    chaveSessaoOuIp(requestFalso({ sessao: `${token}-outra` })),
  );
});

test("usa IP normalizado quando a sessao nao foi informada", () => {
  const chave = chaveSessaoOuIp(requestFalso({ ip: "2001:db8::1234" }));
  assert.match(chave, /^ip:/);
  assert.equal(chave.includes("undefined"), false);
});
