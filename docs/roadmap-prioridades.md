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

- Criar um fluxo guiado para cadastrar restaurante, master, mesas, categorias,
  cardapio inicial e identidade visual.
- Exibir credenciais e links principais depois da criacao.
- Deixar o cadastro pronto para virar autoatendimento no futuro.

## Prioridade 3 - Reservas

- Criar uma area de reservas por restaurante.
- Permitir nome, telefone, data, horario, quantidade de pessoas, observacao e status.
- Ligar reservas ao `restaurante_id` e, em uma segunda etapa, a mesas/saloes.

## Prioridade 4 - Planos na landing page

- Exibir planos comerciais quando os limites e precos estiverem estaveis.
- Adicionar CTA para contato, cadastro ou demonstracao.
- Mostrar diferencas de recursos entre Essencial, Profissional e Enterprise.

## Prioridade 5 - SaaS e cobranca

- Criar dashboard SaaS com receita prevista, clientes ativos, suspensos e em teste.
- Integrar gateway de pagamento.
- Criar alertas de vencimento, atraso e limite de uso.

## Pendencias tecnicas paralelas

- Logs de auditoria.
- Soft delete completo.
- Validacao com Zod nos endpoints.
- Monitoramento de erros.
- Backup automatico revisado no Supabase.
- Token de sessao por mesa via QR Code.
