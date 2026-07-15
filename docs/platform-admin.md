# Administracao da plataforma

O Painel da Plataforma e exclusivo do operador global do Autenix. Ele usa uma
autenticacao separada dos restaurantes e esta disponivel em `/plataforma`.

## Perfis e limites

- `platform_admin`: cadastra e administra restaurantes pela plataforma.
- `admin`: master de um unico restaurante, com acesso ao painel administrativo.
- `garcom`, `cozinha` e `financeiro`: colaboradores limitados ao restaurante do JWT.

O token da plataforma possui `scope=platform` e nao abre rotas operacionais. O
token de um restaurante possui `restaurante_id` e nao abre rotas da plataforma.

## Cadastrar um cliente

1. Acesse `/plataforma` com o usuario global.
2. Selecione `Novo restaurante`.
3. Informe nome, slug, plano, limite e quantidade inicial de mesas.
4. Informe o nome e login do master do restaurante.
5. Deixe a senha vazia para gerar uma senha temporaria segura.
6. Entregue ao cliente o link, login e senha mostrados uma unica vez.

O cadastro cria, em uma unica transacao:

- o registro em `restaurantes` e seu `restaurante_id`;
- o usuario master com papel `admin`;
- as categorias iniciais;
- as mesas iniciais;
- o vinculo de todos os dados ao novo restaurante.

## Acoes disponiveis

- pesquisar e filtrar restaurantes;
- editar nome, slug, plano e limite de mesas;
- abrir o restaurante em uma nova guia;
- redefinir a senha do master;
- suspender ou reativar o acesso;
- arquivar o cliente preservando seus dados;
- alterar a senha do operador global.

O arquivamento e logico. A exclusao nao remove pedidos, usuarios ou historico.

## White label

O operador global pode configurar a marca durante a edicao do restaurante. O
master do restaurante tambem possui a aba `Marca` no painel administrativo.

Campos disponiveis:

- ativacao da marca propria;
- nome exibido;
- URL HTTPS da logo;
- cor principal;
- cor de destaque.

Quando a opcao esta desativada, o restaurante usa a identidade padrao Autenix.
As configuracoes sao aplicadas apenas ao `restaurante_id` autorizado.

## Seguranca

- senhas sao armazenadas somente como hash bcrypt;
- credenciais temporarias nao ficam no frontend, migration ou repositorio;
- `DATABASE_URL` e chaves privilegiadas permanecem apenas no backend;
- `platform_usuarios` tem RLS e nao concede acesso a `anon` ou `authenticated`;
- a API revalida o usuario global ativo em cada requisicao protegida;
- as operacoes de tenant usam transacao e contexto RLS por `restaurante_id`.

## Migrations

- `009_restaurant_white_label.sql`: identidade por restaurante.
- `010_platform_administration.sql`: planos, limites, arquivamento e usuarios globais.
