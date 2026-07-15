# Supabase RLS

## Arquitetura atual

O frontend nao usa `supabase-js`, a Data API ou chaves do Supabase. Toda operacao
passa pela API Express e pelo Socket.IO. O backend usa `pg` com `DATABASE_URL`,
autenticacao JWT propria e consultas parametrizadas.

A conexao atual e proprietaria das tabelas (`postgres`) e, por isso, nao e
bloqueada por RLS enquanto `FORCE ROW LEVEL SECURITY` permanecer desativado. A
chave `service_role` nao deve ser adicionada ao frontend. Caso seja usada no
futuro, deve existir apenas no backend ou em funcoes server-side.

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
6. Criar um papel de banco dedicado ao backend com privilegios minimos, em vez
   de manter a aplicacao conectada como proprietaria `postgres`.

## Aplicacao

```bash
cd server
npm run migrate
```

As migrations `002_secure_public_rls.sql` e `003_index_foreign_keys.sql` sao
idempotentes e podem ser reaplicadas pelo runner atual. Depois da aplicacao,
execute os advisors de seguranca e os testes de acesso por papel antes de
publicar o backend.
