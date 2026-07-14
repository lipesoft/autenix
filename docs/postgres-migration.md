# Migracao PostgreSQL / Supabase

## Estado encontrado

O repositorio atual nao contem arquivo SQLite (`.db`, `.sqlite`, `.sqlite3`) para importacao automatica. O backend ja estava usando `pg` com `DATABASE_URL`, enquanto o README antigo ainda citava SQLite.

O schema operacional atual foi consolidado em:

- `server/migrations/001_postgres_schema.sql`
- `server/index.js`, funcao `initDB`, mantida para compatibilidade no startup

## Aplicar schema no Supabase

1. Crie o projeto no Supabase.
2. Configure a connection string em `DATABASE_URL`.
3. Configure `DATABASE_SSL=true`.
4. Rode:

```bash
cd server
npm run migrate
```

## Importar dados de um SQLite legado

Como o arquivo SQLite nao esta no repositorio, a importacao de dados precisa ser feita quando o arquivo legado estiver disponivel.

Ordem recomendada de importacao para preservar relacionamentos:

1. `usuarios`
2. `categorias`
3. `produtos`
4. `mesas`
5. `pedidos`
6. `itens_pedido`
7. `chamadas`
8. `configuracoes`

Depois de importar mantendo IDs originais, ajuste as sequences do PostgreSQL:

```sql
SELECT setval('usuarios_id_seq', COALESCE((SELECT MAX(id) FROM usuarios), 1));
SELECT setval('categorias_id_seq', COALESCE((SELECT MAX(id) FROM categorias), 1));
SELECT setval('produtos_id_seq', COALESCE((SELECT MAX(id) FROM produtos), 1));
SELECT setval('mesas_id_seq', COALESCE((SELECT MAX(id) FROM mesas), 1));
SELECT setval('pedidos_id_seq', COALESCE((SELECT MAX(id) FROM pedidos), 1));
SELECT setval('itens_pedido_id_seq', COALESCE((SELECT MAX(id) FROM itens_pedido), 1));
SELECT setval('chamadas_id_seq', COALESCE((SELECT MAX(id) FROM chamadas), 1));
```

## Senhas legadas

Se a tabela `usuarios.senha` vier de SQLite com senha em texto puro, o backend converte automaticamente para bcrypt durante a inicializacao.

Execute essa primeira inicializacao em ambiente controlado, confirme que os logins funcionam e faca backup do banco convertido.

## Pendencia

Importacao automatica SQLite -> PostgreSQL nao foi implementada porque o dump/arquivo SQLite de origem nao existe neste workspace. Quando o arquivo for fornecido, o proximo passo e criar um script de importacao que leia o SQLite e grave no PostgreSQL via `DATABASE_URL`.
