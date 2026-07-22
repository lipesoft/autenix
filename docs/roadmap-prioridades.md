# Roadmap de prioridades

Status atualizado apos a base multi-restaurante, painel da plataforma, white label,
reservas, seguranca por sessao de mesa, Importacao de Dados 2.0, historico
comercial, notificacoes e higiene operacional inicial.

## Visao executiva

- Produto operacional para restaurante: 80% a 85% concluido.
- Plataforma SaaS multi-restaurante: 65% a 70% concluida.
- Produto pronto para escala comercial mais ampla: 50% a 60% concluido.
- Estimativa para pilotos pagos com poucos restaurantes: 2 a 3 semanas.
- Estimativa para SaaS v1 confiavel: 6 a 8 semanas.
- Estimativa para escalar com seguranca para muitos restaurantes: 10 a 14
  semanas.

## Prioridade imediata - Higiene operacional antes de pilotos

- Implementado: `server/node_modules` removido do versionamento com
  `git rm -r --cached server/node_modules`, mantendo `node_modules/` no
  `.gitignore`, para reduzir clone, diff e ruído de CI.
- Implementado: lookup de restaurante por slug centralizado com opcao
  `buscarRestaurantePorSlug(slug, { incluirArquivado: true })`, removendo query
  crua duplicada no fluxo de inicializacao.
- Implementado: middleware de log estruturado por request com
  `timestamp`, `request_id`, `method`, `path`, `status`, `latencia_ms`,
  `restaurante_id`, `role` e `user_id`, sem registrar body, senha, token,
  email completo, telefone completo ou segredo.
- Implementado: `/api/health` e `/api/health/readiness` com resposta segura,
  versao da API, ambiente, timestamp, banco e status resumido de Storage sem
  expor credenciais.
- Implementado: pool PostgreSQL configuravel por ambiente com
  `DB_POOL_MAX`, `DB_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS` e
  `DB_STATEMENT_TIMEOUT_MS`.

## Antes dos pilotos pagos - Validacao operacional

- Implementado: scripts k6 separados para carga leve, piloto e pico controlado
  do polling, com bloqueio obrigatorio para producao sem
  `ALLOW_PRODUCTION_LOAD_TEST=true`.
- Implementado: executada carga real de polling autenticado em producao com
  tenant de validacao, sessao segura de mesa e tokens de admin, garcom,
  cozinha e financeiro. Resultado do perfil piloto: 1.723 requisicoes,
  28,33 RPS, 0 erros, 0 respostas 5xx, 0 respostas 429, p95 global de
  1030 ms e p99 global de 1416 ms.
- Parcial: validacao de entrada centralizada com Zod iniciada nos endpoints de
  pedidos, itens, chamadas, fechamento de mesa, importacao, autenticacao,
  usuarios e parametros de mesa/QR.
- Implementado: base Playwright com cinco specs E2E para fluxo operacional,
  seguranca de sessao de mesa, isolamento multi-tenant, reservas e importacao,
  protegidas por `E2E_ALLOW_WRITE=true` e variaveis de ambiente.
- Implementado: suite E2E completa executada contra producao controlada com
  dois restaurantes de validacao, cobrindo fluxo operacional, sessao de mesa,
  isolamento multi-tenant, reservas e importacao.
- Implementado: smoke E2E somente leitura para producao, validando landing,
  health, readiness, cardapio publico e protecao do diagnostico tecnico sem
  criar dados no banco.

## Prioridade 0 - Seguranca e isolamento

- Implementado: RLS ativado nas tabelas publicas principais do Supabase.
- Implementado: backend tenant-aware usando `restaurante_id` e contexto
  `app.restaurante_id` por transacao.
- Implementado: painel da plataforma separado do login dos restaurantes.
- Implementado: QR Code de mesa com token de sessao, hash no banco e expiracao.
- Implementado: `service_role` usado somente no backend para Storage, nao no
  frontend.
- Implementado: `SELECT` direto de `anon` e `authenticated` revogado em
  `categorias` e `produtos`; o cardapio passa somente pelo backend tenant-aware.
- Implementado: policies publicas antigas `categorias_public_read_active` e
  `produtos_public_read_active` removidas.
- Implementado: usuario, role e restaurante ativo revalidados no banco em cada
  requisicao autenticada e na conexao Socket.IO.
- Implementado: rate limit em pedido, chamada, cancelamento, reserva,
  acompanhamento, disponibilidade e demais leituras publicas.
- Implementado: upload com validacao da assinatura real, limite de pixels,
  remocao de metadados e conversao segura para WebP.
- Implementado: respostas 500 de endpoints sensiveis de cardapio, mesas,
  pedidos, chamadas, importacao, login e usuarios passaram a usar mensagens
  seguras sem expor erro interno ao frontend.
- Pendente: rotacionar tokens operacionais compartilhados fora da Vercel e
  manter somente variaveis criptografadas no provedor.
- Implementado: advisors do Supabase executados sem alertas de seguranca; as
  chaves estrangeiras compostas apontadas pelo advisor foram indexadas.
- Pendente: reavaliar indices marcados como nao usados depois de acumular trafego
  real suficiente para uma decisao segura.

## Prioridade 1 - Planos e controle comercial

- Implementado: cadastro de restaurantes no painel da plataforma com planos,
  limites, mensalidade, status de cobranca, status comercial e ciclo de cobranca.
- Implementado: campos comerciais de inicio do contrato, ultimo contato,
  responsavel comercial e motivo de suspensao.
- Implementado: limites do plano aplicados na operacao: mesas, usuarios,
  produtos e importacao.
- Implementado: alertas comerciais para trial vencendo, cobranca vencida ou
  atrasada e uso alto/limite atingido.
- Implementado: base para upgrades, downgrades e cobranca futura.
- Implementado: historico formal de mudancas de plano, status comercial,
  suspensao/reativacao e arquivamento, com usuario da plataforma, snapshots,
  migration RLS e visualizacao no modal de edicao do restaurante.

## Prioridade 1.1 - Importacao de dados

- Implementado: importacao CSV e XLSX de categorias, produtos, mesas e usuarios pelo
  painel administrativo do restaurante.
- Implementado: validacao previa, preview de acoes, modelos CSV e respeito aos
  limites do plano.
- Implementado: mapeamento manual e automatico das colunas antes da validacao.
- Implementado: historico formal de importacoes com usuario,
  data, tipo, quantidade de linhas, criados, atualizados, ignorados e erros.
- Implementado: detalhe dos registros afetados sem expor snapshots internos ou
  hashes de senha no frontend.
- Implementado: rollback transacional por 24 horas, isolado por restaurante e
  bloqueado quando o registro foi alterado ou usado depois da importacao.
- Implementado: importacao de imagens de produtos por arquivo, vinculando a
  coluna `imagem` do CSV/XLSX aos uploads enviados para o Supabase Storage.
- Implementado: presets de importacao por sistema concorrente para Saipos,
  Consumer, Anota AI e Goomer, com aliases adicionais para colunas comuns de
  cardapio.
- Pendente: criar importadores dedicados para layouts proprietarios quando
  houver arquivos reais de exportacao de cada concorrente.

## Prioridade 2 - Onboarding de restaurante

- Implementado: fluxo guiado no painel da plataforma para identidade, plano,
  operacao inicial, master e marca.
- Implementado: onboarding com login e senha proprios do Autenix, sem Google Auth
  nesta fase.
- Implementado: credenciais e links principais exibidos depois da criacao,
  incluindo central, admin, setores, cardapio e importacao inicial.
- Pendente: transformar o cadastro em autoatendimento publico no futuro.
- Pendente: convite automatico por email/WhatsApp com credenciais e links.

## Prioridade 2.1 - White label avancado

- Implementado: configuracao de cores de fonte no white label do restaurante.
- Implementado: separacao de cor de texto principal, texto secundario, titulos
  e textos sobre fundos escuros/destaque.
- Implementado: aplicacao das cores no tema global das areas do restaurante
  via variaveis de marca.
- Implementado: preview visual de fontes antes de salvar a identidade do
  restaurante.
- Pendente: auditoria automatica de contraste/acessibilidade antes de salvar.

## Prioridade 3 - Reservas

- Implementado: area publica `/r/{slug}/reservas` para solicitacao de reserva.
- Implementado: aba Reservas no painel administrativo com criacao interna,
  listagem, vinculo opcional de mesa e mudanca de status.
- Implementado: aba Reservas na sessao do garcom para visualizar agenda,
  confirmar chegada, vincular mesa, acomodar, cancelar e reabrir reservas.
- Implementado: reservas ligadas ao `restaurante_id` com RLS e acesso somente
  pelo backend tenant-aware.
- Implementado: fila de espera para atendimento imediato, com status `fila` e
  `chamada`.
- Implementado: link publico de acompanhamento por codigo seguro da reserva.
- Implementado: tela publica para o cliente acompanhar status, posicao na fila,
  quantidade de grupos na frente e atualizacao automatica.
- Implementado: garcom e admin podem colocar reserva na fila, chamar cliente,
  voltar para fila, vincular mesa e acomodar.
- Implementado: tela publica de reserva simplificada e objetiva.
- Implementado: WhatsApp do restaurante no white label para contato do cliente.
- Implementado: compartilhamento de reserva no garcom/admin com WhatsApp,
  email quando informado e copia do link de acompanhamento.
- Implementado: historico/auditoria de reservas com eventos de criacao,
  mudanca de status, troca de mesa e compartilhamento.
- Implementado: regras avancadas de disponibilidade por horario, capacidade e
  salao, com configuracao no Admin e bloqueio no backend.
- Implementado: outbox `reservas_notificacoes` com RLS para registrar
  notificacoes automaticas de reserva criada, confirmada, fila, chamada,
  cancelada e concluida.
- Implementado: historico de reservas registra evento `notificacao_automatica`
  e exibe o novo rotulo no garcom/admin.
- Implementado: envio automatico opcional por webhook de backend via
  `RESERVA_NOTIFICACAO_WEBHOOK_URL`, sem expor token no frontend.
- Parcial: envio real por email/WhatsApp depende de configurar provedor
  dedicado. Sem webhook, as notificacoes ficam registradas como
  `sem_provedor`.

## Prioridade 3.1 - Seguranca do cardapio publico

- Feito: trocar QR Code publico simples por QR Code com token de sessao da
  mesa.
- Feito: criar tabela de sessoes de mesa com `restaurante_id`, `mesa_id`,
  token seguro, status, criado_em, expira_em e encerrado_em.
- Feito: gerar uma nova sessao/token ao gerar o QR seguro da mesa na Central ou
  no painel administrativo.
- Feito: marcar a mesa como ocupada ao gerar o QR seguro do atendimento.
- Feito: validar no backend se o token pertence ao restaurante e a mesa antes
  de permitir pedido, cancelamento de item ou chamada de garcom.
- Feito: bloquear pedidos publicos quando a mesa estiver fechada,
  com sessao expirada ou token invalido.
- Feito: permitir que garcom autenticado crie pedidos apenas nas mesas do
  proprio restaurante, sem reutilizar ou enfraquecer o token publico do QR Code.
- Feito: encerrar e invalidar automaticamente a sessao ao fechar a mesa.
- Feito: atualizar o QR Code para apontar para `/r/{slug}/mesa/{id}?sessao=...`.
- Feito: criar tela amigavel de "sessao encerrada" ou "atendimento nao
  iniciado" quando alguem abrir link antigo.
- Feito: proteger tambem o Socket.IO publico da mesa com o token de sessao.
- Feito: criar botao operacional explicito de "iniciar atendimento" e
  "encerrar atendimento" na Central e na aba Mesas do Admin.
- Feito: bloquear encerramento operacional quando ainda existem pedidos abertos,
  orientando fechar a conta primeiro.
- Feito: leitura direta de `categorias` e `produtos` fechada na Data API do
  Supabase; consultas ao cardapio passam pela API do Autenix.
- Pendente: decidir se o cardapio pode continuar visivel em modo consulta sem
  sessao ou se deve ficar sempre bloqueado como esta nesta fase.
- Pendente: avaliar em fase posterior restricao opcional por IP/Wi-Fi do
  restaurante ou dispositivo autorizado para setores internos.

## Prioridade 4 - Planos na landing page

- Implementado: secao de planos comerciais na landing page com Essencial,
  Profissional e Enterprise.
- Implementado: exibicao de limites e diferencas principais de recursos por
  plano.
- Implementado: formulario comercial de demonstracao na landing, com plano de
  interesse vindo dos cards.
- Implementado: animacoes suaves de entrada por scroll na landing page.
- Implementado: CTA de reserva na landing quando ela esta no contexto de um
  restaurante.
- Pendente: substituir o envio por email local por um fluxo comercial persistido
  no backend ou CRM.
- Pendente: adicionar cadastro publico self-service.
- Pendente: conectar a escolha do plano ao onboarding/self-service quando o
  fluxo SaaS estiver pronto.

## Prioridade 5 - SaaS e cobranca

- Implementado: dashboard SaaS no painel da plataforma com MRR previsto,
  clientes ativos, trials e alertas comerciais.
- Implementado: alertas de vencimento, atraso e limite de uso.
- Pendente: integrar gateway de pagamento.
- Pendente: gerar cobrancas, notas/recibos e reconciliacao automatica.

## Prioridade 6 - Observabilidade e operacao

- Implementado: logs estruturados no backend com request id,
  restaurante_id, role, status da resposta e latencia.
- Implementado: health check tecnico `/api/health` e readiness
  `/api/health/readiness`.
- Implementado: rotina manual `npm run ops:cleanup`, com dry-run por padrao,
  lock de concorrencia, execucao por tenant e expiracao idempotente de sessoes
  de mesa vencidas.
- Implementado: monitor sintetico `npm run ops:health` para API, readiness e
  frontend, com saida JSON e exit code para cron, CI ou monitor externo.
- Implementado: painel tecnico simples no portal da plataforma, consumindo
  endpoint protegido `/api/platform/diagnostico` com saude de banco, storage,
  sessoes de mesa, reservas, notificacoes, importacoes e pedidos sem expor
  dados sensiveis.
- Implementado: documentacao operacional em `docs/entrega-piloto.md` com
  checklist de entrega, onboarding, suporte, backup/restore e incidentes.
- Parcial: monitoramento de erros em producao validado por Runtime Errors da
  Vercel durante a entrega; ainda falta configurar alerta externo recorrente.
- Pendente: alertas para falha de deploy, erro 5xx, banco indisponivel e pico de
  tentativas de login.
- Pendente: agendar a rotina operacional por cron futuro e ampliar limpeza de
  uploads temporarios orfaos quando houver metadados suficientes.
- Parcial: plano de backup e restore documentado; ainda falta teste real de
  restore em staging/Supabase.

## Prioridade 7 - Escalabilidade e arquitetura

- Implementado: fallback operacional de sincronizacao em producao sem depender
  de Socket.IO, com polling por tela, sincronizacao ao voltar a aba para foco e
  Socket.IO restrito ao dev ou ativado explicitamente por flag.
- Pendente: evoluir o tempo real para um servico persistente compativel ou para
  Supabase Realtime quando o volume justificar broadcast real entre instancias.
- Implementado: scripts de teste de carga sintetico do polling com k6 para
  perfis leve, piloto e pico controlado.
- Implementado: teste de carga autenticado de piloto executado em producao
  controlada com paineis simultaneos e sessao publica de mesa.
- Pendente: quebrar `client/src/App.jsx` em telas e componentes menores.
- Pendente: quebrar `server/index.js` em modulos por dominio: auth, plataforma,
  restaurantes, pedidos, mesas, reservas, financeiro, importacao e upload.
- Implementado: lint antigo do frontend resolvido; `npm run lint` passa sem
  erros ou avisos e pode ser usado como quality gate em CI.
- Implementado: testes E2E com Playwright adicionados e executados com
  credenciais temporarias em ambiente controlado, cobrindo login operacional,
  pedidos, fechamento de mesa, reservas, importacao e isolamento multi-tenant.
- Implementado: scripts separados `test:e2e:smoke` e `test:e2e:controlled`
  para diferenciar validacao segura de producao e fluxo completo com escrita.
- Pendente: adicionar cache controlado para cardapio por restaurante, invalidando
  ao editar categoria/produto.
- Pendente: revisar pool de conexoes e estrategia de conexao no Supabase para
  volume maior.
- Pendente: criar jobs agendados para expiracao de sessoes, alertas comerciais e
  manutencao operacional.
- Pendente: avaliar separacao futura de servicos se o Socket.IO crescer mais que
  o restante da API.

## Prioridade 8 - Banco de dados e governanca

- Implementado: migrations incrementais com historico privado, checksum, lock
  de concorrencia, status e baseline controlado para bancos existentes.
- Implementado: horario real de fechamento dos pedidos em `TIMESTAMPTZ`, com
  relatorios e filtros diarios no fuso `America/Sao_Paulo`.
- Implementado: indices das chaves estrangeiras compostas de reservas, eventos
  e sessoes de mesa adicionados conforme o advisor do Supabase.
- Parcial: auditoria formal de planos e status comercial implementada.
- Pendente: criar auditoria geral para usuarios, produtos, mesas,
  configuracoes e operacoes financeiras.
- Pendente: soft delete completo com rastreio de quem arquivou/excluiu.
- Pendente: revisar indices com dados reais depois dos primeiros restaurantes em
  producao.
- Pendente: formalizar politica de retencao de historico de pedidos, chamadas,
  reservas, logs e importacoes.
- Parcial: script `npm run test:rls` aceita `RLS_DATABASE_URL` para validar com
  `autenix_backend`; falta executar com a credencial correta em ambiente
  controlado.

## Fase futura - Autenticacao Google

- Avaliar login com Google depois que o multi-restaurante estiver mais maduro.
- Permitir Google Auth principalmente para admins, masters e financeiro.
- Manter login e senha simples para garcom, cozinha e operacao diaria.
- Criar vinculo seguro entre conta Google, usuario, role e restaurante_id.
- Suportar usuarios com acesso a mais de um restaurante.
- Criar fluxo de convite por email para associar colaboradores.

## Pendencias tecnicas paralelas

- Expandir validacao com Zod para produtos, categorias, configuracoes de
  reservas, plataforma e demais rotas administrativas.
- Executar e evoluir os testes Playwright em staging com credenciais reais de
  dois restaurantes.
- Executar teste de carga k6 e ajustar pool/queries com base nas metricas.
- Testar restore real do Supabase em ambiente seguro.
- Tela interna de suporte para localizar restaurante, usuario, reserva e mesa
  sem acessar dados de outro tenant indevidamente.
- Portal publico self-service para cadastro de restaurante.
- Convites por email/WhatsApp para masters e colaboradores.
