# Entrega e piloto controlado

Este guia prepara o Autenix para demonstracao e piloto controlado. Nao substitui
um runbook completo de producao, mas define o minimo operacional seguro.

## Checklist de entrega

- Variaveis obrigatorias: `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`,
  `CORS_ORIGIN`, `PUBLIC_APP_URL`, `VITE_API_URL`.
- Variaveis de Storage quando houver upload: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.
- Pool: `DB_POOL_MAX`, `DB_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS`,
  `DB_STATEMENT_TIMEOUT_MS`.
- Migrations: executar `cd server && npm run migrate:status` e confirmar
  `0 pendentes`.
- RLS: configurar `RLS_DATABASE_URL` com a role `autenix_backend` e executar
  `cd server && npm run test:rls -- --tenants ID1,ID2`.
- Backend: executar `cd server && npm test` e `npm audit --omit=dev`.
- Frontend: executar `cd client && npm test`, `npm run lint`,
  `npm run build` e `npm audit`.
- E2E smoke: executar `cd client && npm run test:e2e:smoke` contra producao ou
  staging. Esse teste e somente leitura e valida landing, health, readiness,
  cardapio publico e protecao do diagnostico da plataforma.
- E2E controlado: executar `cd client && npm run test:e2e:controlled` em
  staging/controlado com as variaveis `E2E_*` e `E2E_ALLOW_WRITE=true`.
- Carga: executar os scripts em `load-tests/k6` somente contra staging ou com
  `ALLOW_PRODUCTION_LOAD_TEST=true` em janela aprovada.
- Health: validar `GET /api/health` e `GET /api/health/readiness`.
- Fluxos manuais: login plataforma, login restaurante, pedido, cozinha,
  garcom, fechamento, financeiro, reservas, importacao, white label e planos.
- Deploy: publicar frontend e API, validar health/readiness, depois testar o
  roteiro de demonstracao.
- Rollback: manter o deployment anterior disponivel no provedor e reverter se
  health/readiness ou fluxo principal falhar.

## Checklist de onboarding

1. Criar restaurante no painel da plataforma.
2. Selecionar plano, limites, mensalidade e status comercial.
3. Configurar identidade visual, logo, cores e WhatsApp.
4. Criar ou redefinir o master do restaurante.
5. Criar mesas iniciais.
6. Cadastrar cardapio manualmente ou importar CSV/XLSX.
7. Criar acessos de garcom, cozinha e financeiro.
8. Iniciar atendimento em uma mesa e validar o primeiro pedido.
9. Configurar reservas, saloes, horarios e fila.
10. Configurar webhook opcional de notificacoes.
11. Orientar fechamento de mesa, relatorios e suporte.

## Guia de suporte

- Restaurante: localizar por slug no painel da plataforma.
- Usuario: consultar `Admin > Equipe` no restaurante correto.
- Mesa: consultar `Central` ou `Admin > Mesas`; verificar se existe sessao
  ativa.
- Reserva: consultar `Admin > Reservas` ou aba de reservas do garcom.
- Pedido: consultar cozinha, garcom ou financeiro pelo restaurante correto.
- Sessao invalida: gerar novo atendimento/QR; nunca reutilizar token antigo.
- Importacao: abrir historico, conferir registros afetados e usar rollback
  dentro de 24 horas se o registro ainda nao foi usado ou alterado.
- Reserva presa: revisar historico, status atual, mesa vinculada e notificacoes.
- Recuperacao de acesso: plataforma redefine master; restaurante redefine
  colaboradores.
- Incidente: coletar horario, `request_id`, restaurante, rota afetada e acao
  executada, sem coletar senha/token.

## Backup e restore Supabase

- Confirmar plano e retencao de backups no painel do Supabase.
- Antes de mudancas de risco, gerar backup/exportacao do banco e confirmar
  backup do Storage.
- Para exportacao manual, usar ferramenta oficial do Supabase ou `pg_dump` em
  ambiente seguro, nunca versionando dumps.
- Restore em producao exige janela, backup validado e plano de rollback.
- Teste de restore deve ocorrer em staging/desenvolvimento.
- Validacao pos-restore: migrations, login, cardapio, pedido, reservas,
  financeiro, importacao e isolamento entre restaurantes.

## Rotina operacional

Dry-run:

```bash
cd server
npm run ops:cleanup
```

Aplicar expiracao de sessoes vencidas:

```bash
cd server
npm run ops:cleanup -- --apply
```

Executar para um restaurante:

```bash
cd server
npm run ops:cleanup -- --apply --restaurante-id 1
```

A rotina usa lock de concorrencia, executa por `restaurante_id`, expira apenas
sessoes de mesa vencidas e resume notificacoes antigas pendentes/erro. Ela nao
exclui pedidos, reservas, importacoes ou historico comercial.

## Teste de carga

Sem k6 instalado, usar o smoke Node sem dependencias externas:

```bash
node load-tests/node/polling-smoke.js --profile light --base-url=https://api-staging.example.com --slug=autenix
```

Perfis disponiveis:

- `light`: 10 usuarios virtuais por 30 segundos.
- `pilot`: 20 usuarios virtuais por 60 segundos.
- `peak`: 40 usuarios virtuais por 60 segundos.

O script mede requisicoes totais, RPS, latencia media, p95, p99, erros, 5xx,
429 e metricas por endpoint. Producao tambem e bloqueada sem:

```bash
ALLOW_PRODUCTION_LOAD_TEST=true
```

Leve:

```bash
k6 run load-tests/k6/polling-light.js -e BASE_URL=https://api-staging.example.com -e RESTAURANTE_SLUG=autenix
```

Piloto:

```bash
k6 run load-tests/k6/polling-pilot.js -e BASE_URL=https://api-staging.example.com -e RESTAURANTE_SLUG=autenix
```

Pico controlado:

```bash
k6 run load-tests/k6/polling-peak.js -e BASE_URL=https://api-staging.example.com -e RESTAURANTE_SLUG=autenix
```

Para simular paineis autenticados, informar tokens especificos:
`GARCOM_TOKEN`, `COZINHA_TOKEN`, `ADMIN_TOKEN`, `FINANCEIRO_TOKEN`.

Produção e bloqueada sem:

```bash
ALLOW_PRODUCTION_LOAD_TEST=true
```

Medir: requisicoes totais, RPS, latencia media, p95, p99, erros, 5xx, 429,
endpoints mais acessados e sinais de pressao no pool do PostgreSQL.

## Monitoramento sintetico

Executar health monitor:

```bash
cd server
npm run ops:health
```

Saida esperada: JSON com `status: healthy`, latencia por endpoint e exit code
0. Em monitor externo ou cron, alertar quando:

- `status` for `degraded`;
- `/api/health/readiness` deixar de retornar `ready`;
- qualquer check exceder `HEALTH_TIMEOUT_MS`;
- houver resposta 5xx;
- o frontend deixar de retornar 2xx.

## Playwright E2E

Variaveis principais:

- `E2E_API_URL`
- `E2E_RESTAURANTE_SLUG`
- `E2E_ADMIN_LOGIN`
- `E2E_ADMIN_PASSWORD`
- `E2E_ALLOW_WRITE=true`

Para isolamento multi-tenant:

- `E2E_SECOND_RESTAURANTE_SLUG`
- `E2E_SECOND_ADMIN_LOGIN`
- `E2E_SECOND_ADMIN_PASSWORD`

Rodar:

```bash
cd client
npm run test:e2e
```

Sem variaveis, os testes de escrita ficam marcados como skip.

Smoke seguro em producao, sem escrita:

```powershell
cd client
$env:E2E_APP_URL="https://autenix.vercel.app"
$env:E2E_API_URL="https://autenix-api.vercel.app"
$env:E2E_RESTAURANTE_SLUG="<slug-restaurante-validacao>"
npm run test:e2e:smoke
```

Se o slug informado nao existir no ambiente, o smoke de cardapio fica marcado
como skip, mas health, readiness, rota protegida e landing continuam sendo
validados.

Fluxo completo com escrita somente em restaurante de validacao:

```powershell
cd client
$env:E2E_APP_URL="https://autenix.vercel.app"
$env:E2E_API_URL="https://autenix-api.vercel.app"
$env:E2E_RESTAURANTE_SLUG="<slug-restaurante-validacao-1>"
$env:E2E_ADMIN_LOGIN="<login-admin-validacao-1>"
$env:E2E_ADMIN_PASSWORD="<senha-admin-validacao-1>"
$env:E2E_SECOND_RESTAURANTE_SLUG="<slug-restaurante-validacao-2>"
$env:E2E_SECOND_ADMIN_LOGIN="<login-admin-validacao-2>"
$env:E2E_SECOND_ADMIN_PASSWORD="<senha-admin-validacao-2>"
$env:E2E_ALLOW_WRITE="true"
npm run test:e2e:controlled
```

Nao use restaurante real de cliente para `test:e2e:controlled`, porque ele cria
categorias, produtos, mesas, reservas, pedidos e importacoes de teste.

## Plano de incidente

- API fora do ar: verificar deploy, `/api/health`, `/api/health/readiness` e
  logs por `request_id`.
- Banco indisponivel: readiness retorna `unavailable`; conferir Supabase,
  pooler, limites de conexao e credenciais.
- Login indisponivel: conferir rate limit, status do restaurante, usuario ativo
  e `JWT_SECRET`.
- Cardapio indisponivel: conferir slug, restaurante ativo, categorias/produtos
  ativos e Data API fechada por RLS.
- Pedidos nao atualizando: conferir polling, rotas `/api/pedidos`, sessao de
  mesa, status da mesa e logs.
- Webhook falhando: conferir outbox de reservas, provider e URL/token no
  backend.
- Deploy com regressao: reverter deployment anterior e validar fluxo principal.
- Suspeita de vazamento entre tenants: pausar piloto, coletar `request_id`,
  restaurante, usuario, rota, horario e reproduzir com teste multi-tenant.

## Pendencias pos-entrega

- Executar carga real com dados de staging e tokens de paineis.
- Integrar monitoramento externo como Sentry ou equivalente.
- Criar painel tecnico interno com health detalhado protegido.
- Automatizar job de limpeza por cron.
- Implementar cache de cardapio por restaurante com invalidacao por alteracao
  de produto, categoria e white label.
- Formalizar politica de retencao de logs, pedidos, reservas e importacoes.
