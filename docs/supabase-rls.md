# Supabase RLS

## Arquitetura atual

O frontend nao usa `supabase-js`, a Data API ou chaves do Supabase. Toda operacao
passa pela API Express e pelo Socket.IO. O backend usa `pg` com `DATABASE_URL`,
autenticacao JWT propria e consultas parametrizadas.

A API de producao usa a role `autenix_backend`. Ela nao e superusuario, nao tem
`BYPASSRLS`, nao cria objetos no schema e recebe apenas os privilegios e policies
necessarios para operar as tabelas do sistema. A senha existe somente nas
variaveis criptografadas da Vercel.

A chave `service_role` nao e usada e nunca deve ser adicionada ao frontend. Caso
seja adotada no futuro, deve existir apenas no backend ou em funcoes server-side.

## Matriz de acesso temporaria

| Tabela | `anon` / `authenticated` na Data API | Backend |
| --- | --- | --- |
| `categorias` | `SELECT` somente com `ativo = 1` | Leitura e escrita |
| `produtos` | `SELECT` somente com `disponivel = 1` e categoria ativa | Leitura e escrita |
| `usuarios` | Bloqueado | Leitura e escrita |
| `mesas` | Bloqueado | Leitura e escrita |
| `pedidos` | Bloqueado | Leitura e escrita |
| `itens_pedido` | Bloqueado | Leitura e escrita |
| `chamadas` | Bloqueado | Leitura e escrita |
| `configuracoes` | Bloqueado | Leitura e escrita |

As operacoes publicas de mesa, pedido e chamada continuam passando pelo backend,
onde existem validacoes, rate limit, CORS e regras de negocio. Elas nao sao
liberadas diretamente pela Data API.

## Limitacao atual

Ainda nao existem `restaurante_id` ou `user_id` nas tabelas. O JWT da aplicacao
ja reserva `restaurante_id`, mas o banco ainda nao consegue aplicar isolamento
por restaurante. Por isso, as policies operacionais desta fase sao de negacao
total para `anon` e `authenticated`.

## Fase 2: multi-tenant

1. Criar `restaurantes` e adicionar `restaurante_id NOT NULL` com chave
   estrangeira em todas as tabelas de dominio.
2. Relacionar usuarios a um restaurante e, caso o Supabase Auth seja adotado,
   armazenar o papel e o restaurante em `app_metadata`, nunca em
   `user_metadata`.
3. Fazer backfill dos dados existentes antes de tornar `restaurante_id`
   obrigatorio.
4. Indexar `restaurante_id` em todas as tabelas usadas pelas policies.
5. Trocar as policies temporarias por filtros de tenant e testar isolamento com
   pelo menos dois restaurantes.
6. Restringir as policies da role `autenix_backend` por restaurante quando o
   tenant estiver disponivel, em vez de permitir acesso a todas as linhas.

## Aplicacao

```bash
cd server
MIGRATION_DATABASE_URL=<conexao-proprietaria> npm run migrate
```

`MIGRATION_DATABASE_URL` precisa usar uma conexao autorizada a executar DDL. A
`DATABASE_URL` de runtime usa `autenix_backend` e nao deve receber esse poder.

As migrations `002_secure_public_rls.sql`, `003_index_foreign_keys.sql` e
`004_backend_runtime_role.sql` sao idempotentes e podem ser reaplicadas pelo
runner atual. A senha da role nao faz parte das migrations e deve ser provisionada
por canal seguro.

## Producao

- Frontend: `https://autenix.vercel.app`
- API: `https://autenix-api.vercel.app`
- Health check: `GET /api/health`
- Variaveis da API: `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`,
  `JWT_EXPIRES_IN`, `CORS_ORIGIN` e `TRUST_PROXY`
- Variavel do frontend: `VITE_API_URL`

Depois de cada migration ou deploy, execute os advisors do Supabase, valide o
health check e teste os acessos com e sem JWT antes de promover a versao.
