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

## Matriz de acesso

| Tabela | `anon` / `authenticated` na Data API | Backend |
| --- | --- | --- |
| `restaurantes` | Bloqueado | Descoberta e provisionamento |
| `categorias` | Bloqueado | Isolado por restaurante |
| `produtos` | Bloqueado | Isolado por restaurante |
| `usuarios` | Bloqueado | Isolado por restaurante |
| `mesas` | Bloqueado | Isolado por restaurante |
| `pedidos` | Bloqueado | Isolado por restaurante |
| `itens_pedido` | Bloqueado | Isolado por restaurante |
| `chamadas` | Bloqueado | Isolado por restaurante |
| `configuracoes` | Bloqueado | Isolado por restaurante |

Cardapio, mesa, pedido e chamada passam pelo backend tenant-aware. Nenhuma tabela
operacional e liberada diretamente pela Data API.

## Isolamento multi-tenant

As tabelas possuem `restaurante_id NOT NULL`, chaves estrangeiras compostas e
indices iniciados pelo tenant. A role `autenix_backend` nao usa `BYPASSRLS`.
Cada transacao operacional define:

```sql
SELECT set_config('app.restaurante_id', '<id>', true);
```

As policies comparam a linha com esse valor. O contexto e local a transacao e
nao vaza entre conexoes reutilizadas pelo pool.

## Proximas evolucoes

1. Adicionar token publico por comanda para fortalecer autoria de cancelamentos.
2. Definir limites por plano e restaurante.
3. Versionar personalizacao de logo e cores por tenant.
4. Avaliar Supabase Auth; nesse caso, guardar tenant e papel em `app_metadata`,
   nunca em `user_metadata`.

## Aplicacao

```bash
cd server
MIGRATION_DATABASE_URL=<conexao-proprietaria> npm run migrate
```

`MIGRATION_DATABASE_URL` precisa usar uma conexao autorizada a executar DDL. A
`DATABASE_URL` de runtime usa `autenix_backend` e nao deve receber esse poder.

As migrations `005_multi_tenant_foundation.sql` e
`006_enforce_tenant_isolation.sql` seguem o fluxo expand/contract documentado em
`docs/multi-tenant.md`. A senha da role nao faz parte das migrations e deve ser
provisionada por canal seguro.

## Producao

- Frontend: `https://autenix.vercel.app`
- API: `https://autenix-api.vercel.app`
- Health check: `GET /api/health`
- Variaveis da API: `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`,
  `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `TRUST_PROXY` e `PUBLIC_APP_URL`
- Variavel do frontend: `VITE_API_URL`

Depois de cada migration ou deploy, execute os advisors do Supabase, valide o
health check e teste os acessos com e sem JWT antes de promover a versao.
