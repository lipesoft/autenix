# Multi-tenant no Autenix

Cada restaurante possui um registro em `public.restaurantes` e um `restaurante_id`
obrigatorio em todas as tabelas operacionais. O slug identifica o restaurante nas
URLs publicas e no login; o ID e usado como limite interno de dados.

## Rotas

- `/r/:slug`: landing e login do restaurante
- `/r/:slug/central`: Central de Operacao
- `/r/:slug/admin`: administracao
- `/r/:slug/garcom`: atendimento
- `/r/:slug/cozinha`: cozinha
- `/r/:slug/financeiro`: financeiro
- `/r/:slug/mesa/:id`: cardapio e pedidos da mesa

As rotas antigas continuam apontando para o tenant `autenix` por compatibilidade.

## Criar restaurante e master

Execute com uma conexao de banco autorizada. A senha pode ser informada ou gerada
automaticamente e exibida uma unica vez no terminal.

```bash
cd server
npm run tenant:create -- --nome "Restaurante Exemplo" --slug restaurante-exemplo --mesas 20
```

O comando cria:

- restaurante e ID proprio;
- usuario `master` com papel `admin`;
- categorias iniciais;
- quantidade configuravel de mesas;
- links tenant-aware para equipe e clientes.

Para definir credenciais explicitamente:

```bash
npm run tenant:create -- --nome "Restaurante Exemplo" --slug restaurante-exemplo --login master --senha "uma-senha-forte-aqui" --mesas 20
```

## Isolamento

O backend inclui `restaurante_id` no JWT e abre uma transacao por tenant com
`set_config('app.restaurante_id', ..., true)`. As policies RLS comparam cada linha
com esse contexto. Socket.IO usa salas separadas por restaurante e por mesa.

O frontend nunca recebe `service_role`, `DATABASE_URL` ou qualquer segredo do
banco. Cardapio publico, pedidos e chamadas passam pela API Express e exigem slug
e mesa validos.

## Ordem de deploy

1. Aplicar `005_multi_tenant_foundation.sql` para expandir e preencher o esquema.
2. Publicar a API e o frontend tenant-aware.
3. Aplicar `006_enforce_tenant_isolation.sql` para tornar IDs obrigatorios e
   restringir a role do backend por RLS.
4. Executar os testes de isolamento com dois restaurantes.

Essa ordem evita indisponibilidade durante a transicao do esquema antigo.
