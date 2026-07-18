# Roadmap de prioridades

Status atualizado apos a base multi-restaurante, painel da plataforma, white label
e identidade visual.

## Prioridade 1 - Planos e controle comercial

- Melhorar o cadastro de restaurantes no painel da plataforma com planos, limites,
  mensalidade, status comercial e ciclo de cobranca.
- Aplicar limites do plano na operacao: mesas, usuarios e produtos.
- Preparar a base para upgrades, downgrades e cobranca futura.

## Prioridade 1.1 - Importacao de dados

- Implementado: importacao CSV de categorias, produtos, mesas e usuarios pelo
  painel administrativo do restaurante.
- Implementado: validacao previa, preview de acoes, modelos CSV e respeito aos
  limites do plano.
- Pendente: importacao direta de `.xlsx`, importadores especificos por sistema,
  historico de importacoes e rollback.

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

- Pendente: permitir configurar cores das fontes no white label do restaurante.
- Pendente: separar cor de texto principal, texto secundario, titulos e textos
  sobre fundos escuros/destaque.
- Pendente: aplicar as cores de fonte na landing, central, admin, cardapio,
  garcom, cozinha, financeiro e reservas sem prejudicar contraste/acessibilidade.
- Pendente: adicionar preview visual antes de salvar a identidade do restaurante.

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
- Pendente: regras avancadas de disponibilidade por horario, capacidade e salao.
- Pendente: confirmacao automatica por email/WhatsApp com provedor dedicado.
- Pendente: historico/auditoria detalhada de alteracoes de status.

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
- Feito: encerrar e invalidar automaticamente a sessao ao fechar a mesa.
- Feito: atualizar o QR Code para apontar para `/r/{slug}/mesa/{id}?sessao=...`.
- Feito: criar tela amigavel de "sessao encerrada" ou "atendimento nao
  iniciado" quando alguem abrir link antigo.
- Feito: proteger tambem o Socket.IO publico da mesa com o token de sessao.
- Pendente: decidir se o cardapio pode continuar visivel em modo consulta sem
  sessao ou se deve ficar sempre bloqueado como esta nesta fase.
- Feito: criar botao operacional explicito de "iniciar atendimento" e
  "encerrar atendimento" na Central e na aba Mesas do Admin.
- Feito: bloquear encerramento operacional quando ainda existem pedidos abertos,
  orientando fechar a conta primeiro.
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

- Criar dashboard SaaS com receita prevista, clientes ativos, suspensos e em teste.
- Integrar gateway de pagamento.
- Criar alertas de vencimento, atraso e limite de uso.

## Fase futura - Autenticacao Google

- Avaliar login com Google depois que o multi-restaurante estiver mais maduro.
- Permitir Google Auth principalmente para admins, masters e financeiro.
- Manter login e senha simples para garcom, cozinha e operacao diaria.
- Criar vinculo seguro entre conta Google, usuario, role e restaurante_id.
- Suportar usuarios com acesso a mais de um restaurante.
- Criar fluxo de convite por email para associar colaboradores.

## Pendencias tecnicas paralelas

- Logs de auditoria.
- Soft delete completo.
- Validacao com Zod nos endpoints.
- Monitoramento de erros.
- Backup automatico revisado no Supabase.
- Resolver lint antigo do `client/src/App.jsx`.
