# AUTENIX ROADMAP

## P0 - Obrigatorio para Producao

### Feature: Seguranca

Status: 95%

Tasks

✔ RLS nas tabelas publicas principais
✔ Backend tenant-aware com `restaurante_id`
✔ Isolamento por tenant via contexto `app.restaurante_id`
✔ QR Code seguro com token de sessao da mesa
✔ Bloqueio de pedido com token invalido, expirado ou encerrado
✔ Rate limit em login, pedidos, chamadas, reservas e leituras publicas
✔ Upload seguro com validacao real de imagem e conversao WebP
✔ Mensagens de erro seguras sem stack trace no frontend
✔ Revalidacao de usuario, role e restaurante ativo a cada requisicao
✔ Bloqueio de restaurantes pausados, cancelados ou excluidos
✔ Service role fora do frontend
✔ Health Check
✔ Readiness

Pendente

□ Rotacionar tokens operacionais compartilhados fora da Vercel
□ Revisar indices apos trafego real
□ Avaliar restricao opcional por IP/Wi-Fi para setores internos

------------------------------

### Feature: LGPD e Cookies

Status: 85%

Tasks

✔ Banner de cookies
✔ Aceitar todos
✔ Recusar nao essenciais
✔ Personalizar preferencias
✔ Categorias: necessarios, funcionais, estatisticas e marketing
✔ Preferencias salvas com versao e data de aceite
✔ Politica de Privacidade
✔ Termos de Uso
✔ Consentimento no formulario comercial
✔ Consentimento em reservas e fila publica
✔ Registro backend de consentimentos
✔ Migration `consentimentos_legais`
✔ RLS na tabela de consentimentos
✔ Auditoria do `localStorage`
✔ Auditoria do `sessionStorage`
✔ Auditoria dos cookies
✔ Revisao de scripts de terceiros
✔ Bloqueio de scripts opcionais antes do consentimento

Pendente

□ Criar pagina separada de Politica de Cookies
□ Revisao juridica formal
□ DPA/contrato de operador com restaurantes clientes
□ Politica formal de retencao por tipo de dado
□ Canal operacional para solicitacoes do titular
□ Processo de exportacao, exclusao e anonimizacao por titular

------------------------------

### Feature: Observabilidade

Status: 85%

Tasks

✔ Health Check
✔ Readiness
✔ Logs estruturados
✔ Request ID por requisicao
✔ Diagnostico tecnico protegido no painel da plataforma
✔ Monitor sintetico `npm run ops:health`
✔ Runtime Errors da Vercel usado na validacao de producao

Pendente

□ Alerta de deploy
□ Alerta de erro 5xx
□ Alerta de banco indisponivel
□ Alerta de pico de tentativas de login
□ Alerta de health check degradado
□ Integracao futura com Sentry ou provedor equivalente

------------------------------

### Feature: Validacao da Entrega

Status: 90%

Tasks

✔ Lint do frontend funcionando
✔ Testes unitarios do backend
✔ Testes unitarios do frontend
✔ Build do frontend
✔ Playwright configurado
✔ E2E de fluxo operacional
✔ E2E de sessao segura da mesa
✔ E2E de isolamento multi-tenant
✔ E2E de reservas
✔ E2E de importacao
✔ Smoke seguro de producao
✔ Teste de carga k6 leve, piloto e pico controlado
✔ Carga autenticada de piloto executada em producao controlada

Pendente

□ Rodar E2E controlado em staging dedicado antes de novos pilotos
□ Automatizar quality gates em CI
□ Reduzir bundle grande apontado pelo Vite

------------------------------

### Feature: Operacao, Backup e Restore

Status: 80%

Tasks

✔ Runbook de entrega
✔ Checklist de onboarding
✔ Guia de suporte
✔ Plano de incidente
✔ Rotina manual `npm run ops:cleanup`
✔ Cleanup com dry-run por padrao
✔ Cleanup idempotente e protegido contra concorrencia
✔ Documentacao de backup e restore Supabase
✔ Procedimento de rollback de deploy

Pendente

□ Teste real de restore em ambiente seguro
□ Agendar cleanup por cron futuro
□ Limpar uploads temporarios orfaos quando houver metadados suficientes
□ Criar checklist operacional de emergencia dentro do painel

------------------------------

## P1 - Piloto

### Feature: Fluxo Operacional do Restaurante

Status: 95%

Tasks

✔ Login do restaurante
✔ Central de operacao
✔ Cadastro de categorias
✔ Cadastro de produtos
✔ Cadastro de mesas
✔ Cadastro de equipe
✔ Inicio de atendimento da mesa
✔ Geracao de QR seguro
✔ Cardapio publico por sessao
✔ Pedido do cliente
✔ Pedido do garcom
✔ Cozinha com status de preparo
✔ Notificacao ao garcom
✔ Confirmacao de entrega
✔ Fechamento da mesa
✔ Forma de pagamento
✔ Historico de comanda
✔ Relatorios financeiros

Pendente

□ Melhorar telas internas apos feedback de uso real
□ Refinar estados vazios e mensagens de erro por perfil
□ Avaliar modo offline/local assistido em etapa futura

------------------------------

### Feature: Importacao

Status: 95%

Tasks

✔ CSV
✔ XLSX
✔ Preview
✔ Mapeamento manual
✔ Mapeamento automatico
✔ Presets
✔ Importacao de categorias
✔ Importacao de produtos
✔ Importacao de mesas
✔ Importacao de usuarios
✔ Upload de imagens por arquivo
✔ Historico de importacoes
✔ Rollback em ate 24 horas
✔ Respeito aos limites do plano

Pendente

□ Layouts proprietarios
□ Importadores especificos por sistema concorrente real
□ Testar com planilhas reais de restaurantes migrados

------------------------------

### Feature: Reservas

Status: 98%

Tasks

✔ Portal publico de reservas
✔ Tela publica simplificada
✔ Fila de espera
✔ Acompanhamento publico por codigo
✔ Posicao na fila
✔ Chamada do cliente
✔ Voltar cliente para fila
✔ Vinculo com mesa
✔ Acomodacao
✔ Cancelamento
✔ Reabertura
✔ Aba Reservas no admin
✔ Aba Reservas no garcom
✔ Historico de eventos
✔ Auditoria de reservas
✔ Regras de disponibilidade
✔ Saloes
✔ Webhook opcional
✔ Outbox de notificacoes
✔ Compartilhamento por link, WhatsApp e email quando informado

Pendente

□ Integracao real de Email
□ Integracao real de WhatsApp
□ Tela de cliente para acompanhar fila em tempo real com UX mais refinada

------------------------------

### Feature: Plataforma SaaS

Status: 82%

Tasks

✔ Login separado da plataforma
✔ Painel master dos masters
✔ Cadastro de restaurante
✔ Criacao de master por restaurante
✔ Restaurante com `restaurante_id`
✔ Planos comerciais
✔ Limites de plano
✔ Dashboard SaaS
✔ MRR previsto
✔ Clientes ativos
✔ Historico Comercial
✔ Pausar cliente
✔ Reativar cliente
✔ Excluir logicamente cliente
✔ Bloqueio de acesso para pausado, cancelado ou excluido
✔ Diagnostico tecnico da plataforma
✔ Consulta segura de auditoria

Pendente

□ Gateway de pagamento
□ Cobranca recorrente
□ CRM comercial
□ Cadastro publico self-service
□ Convite automatico por email/WhatsApp
□ Suporte a usuario com multiplos restaurantes

------------------------------

### Feature: White Label

Status: 90%

Tasks

✔ Logo por restaurante
✔ Nome de exibicao
✔ Cor primaria
✔ Cor secundaria
✔ Cor de texto principal
✔ Cor de texto secundario
✔ Cor de titulo
✔ Cor de texto sobre destaque
✔ WhatsApp do restaurante
✔ Preview visual
✔ Normalizacao segura do payload

Pendente

□ Auditoria automatica de contraste antes de salvar
□ Sugestao automatica de paleta a partir da logo
□ Melhorar controle de cores de fonte por contexto

------------------------------

## P2 - Comercial e Escala

### Feature: Landing Page Comercial

Status: 92%

Tasks

✔ Landing page profissional
✔ Narrativa visual por scroll
✔ Hero com mockup do sistema
✔ Sistema em funcionamento
✔ Fluxo do QR ao relatorio
✔ Restaurante ao vivo
✔ Comparacao antes e depois
✔ Cards interativos
✔ Planos comerciais
✔ Formulario comercial
✔ Responsividade desktop/mobile
✔ Respeito a `prefers-reduced-motion`
✔ Links legais no rodape
✔ Consentimento no formulario comercial

Pendente

□ Persistir leads comerciais no backend ou CRM
□ Envio por email corporativo do Autenix
□ Cadastro publico self-service a partir do plano escolhido

------------------------------

### Feature: Onboarding de Restaurante

Status: 78%

Tasks

✔ Onboarding guiado na plataforma
✔ Identidade inicial
✔ Plano inicial
✔ Criacao de master
✔ Criacao de mesas iniciais
✔ Links principais apos cadastro
✔ Importacao inicial pelo admin

Pendente

□ Autoatendimento publico
□ Convite automatico de master
□ Convite automatico de colaboradores
□ Google Auth depois do multi-restaurante estar mais maduro

------------------------------

### Feature: Banco de Dados e Governanca

Status: 88%

Tasks

✔ Migrations incrementais
✔ Historico privado de migrations
✔ Checksum de migrations
✔ Lock de concorrencia em migrations
✔ Baseline controlado
✔ RLS nas tabelas sensiveis
✔ Auditoria operacional tenant-aware
✔ Auditoria de categorias
✔ Auditoria de produtos
✔ Auditoria de usuarios
✔ Auditoria de mesas
✔ Auditoria de financeiro
✔ Auditoria de reservas
✔ Auditoria de importacoes
✔ Auditoria de configuracoes
✔ Auditoria de white label
✔ API segura de consulta de auditoria

Pendente

□ Auditoria de cancelamento de pedido inteiro
□ Auditoria de operacoes financeiras avancadas
□ Politica formal de retencao de historico
□ Revisar indices com dados reais
□ Executar `test:rls` com credencial `autenix_backend` em staging

------------------------------

## P3 - Futuro

### Feature: Cobranca

Status: 20%

Tasks

✔ Planos definidos
✔ Limites aplicados
✔ Campos comerciais no restaurante
✔ Alertas comerciais
✔ Historico de plano

Pendente

□ Gateway
□ Checkout
□ Assinatura recorrente
□ Webhooks de pagamento
□ Reconciliacao
□ Nota ou recibo
□ Suspensao automatica por inadimplencia

------------------------------

### Feature: CRM

Status: 10%

Tasks

✔ Formulario comercial na landing
✔ Plano de interesse no formulario
✔ Historico comercial basico no restaurante

Pendente

□ Persistencia de leads
□ Funil comercial
□ Atividades e follow-up
□ Origem de lead
□ Envio de proposta
□ Integracao com email

------------------------------

### Feature: Escalabilidade Avancada

Status: 45%

Tasks

✔ Polling por tela em producao
✔ Socket.IO restrito a dev ou flag explicita
✔ Scripts de carga k6
✔ Pool PostgreSQL configuravel
✔ Health/readiness

Pendente

□ Cache controlado do cardapio por restaurante
□ Invalidacao de cache por produto/categoria/marca
□ Separar `client/src/App.jsx` em telas menores
□ Separar `server/index.js` em modulos por dominio
□ Avaliar Supabase Realtime ou servico persistente de tempo real
□ Revisar estrategia de pool com volume maior

------------------------------

### Feature: Autenticacao Google

Status: 0%

Tasks

□ Avaliar Google Auth para admins, masters e financeiro
□ Manter login simples para garcom/cozinha/operacao diaria
□ Vincular Google com usuario, role e `restaurante_id`
□ Suportar usuario com acesso a mais de um restaurante
□ Criar convite por email para associar colaboradores

Pendente

□ Decisao tecnica apos multi-restaurante mais maduro
