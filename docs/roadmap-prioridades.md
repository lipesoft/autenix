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
- Implementado: reservas ligadas ao `restaurante_id` com RLS e acesso somente
  pelo backend tenant-aware.
- Pendente: regras avancadas de disponibilidade por horario, capacidade e salao.
- Pendente: criar fila de espera quando o restaurante estiver cheio ou sem mesa
  disponivel para reserva imediata.
- Pendente: permitir que o cliente acompanhe sua posicao na fila em uma tela
  publica, atualizada conforme mesas forem liberadas e pessoas na frente forem
  chamadas ou acomodadas.
- Pendente: melhorar a experiencia do cliente com uma tela de acompanhamento da
  reserva, incluindo status, horario, dados do restaurante e proximos passos.
- Pendente: confirmacao automatica por email/WhatsApp.
- Pendente: avaliar o melhor fluxo de notificacao entre WhatsApp do restaurante,
  email do cliente e link publico de acompanhamento da reserva.
- Pendente: historico/auditoria detalhada de alteracoes de status.

## Prioridade 4 - Planos na landing page

- Exibir planos comerciais quando os limites e precos estiverem estaveis.
- Adicionar CTA para contato, cadastro ou demonstracao.
- Mostrar diferencas de recursos entre Essencial, Profissional e Enterprise.

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
- Token de sessao por mesa via QR Code.
- Resolver lint antigo do `client/src/App.jsx`.
