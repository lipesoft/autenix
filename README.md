# Autenix

Sistema de gestao e automacao para restaurantes com cardapio digital por QR Code, pedidos em tempo real, painel da cozinha, fluxo do garcom, financeiro, admin, relatorios e exportacao PDF.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express + Socket.IO
- Banco: PostgreSQL, preparado para Supabase
- Auth: bcrypt para senhas e JWT para rotas protegidas

## Variaveis de ambiente

Copie `.env.example` para `.env` e preencha valores reais somente no ambiente local/deploy. Nunca versione segredos reais.

Obrigatorias em producao:

- `DATABASE_URL`
- `MIGRATION_DATABASE_URL` somente no ambiente que executa migrations
- `DATABASE_SSL=true` para Supabase
- `JWT_SECRET`
- `CORS_ORIGIN`
- `PUBLIC_APP_URL`, URL publica usada nos QR Codes
- `VITE_API_URL`
- `ADMIN_PASSWORD_HASH` no primeiro bootstrap do admin, se ainda nao existir admin no banco

Opcionais:

- `ADMIN_LOGIN`, padrao `admin`
- `JWT_EXPIRES_IN`, padrao `8h`
- `TRUST_PROXY=true` em Railway/proxies
- limites `RATE_LIMIT_*`, quando for necessario substituir os valores seguros
  definidos por padrao

Para gerar o hash inicial do admin:

```bash
cd server
npm run hash:password -- "sua-senha-forte"
```

Use o hash gerado em `ADMIN_PASSWORD_HASH`. A senha pura nao deve ir para `.env`, frontend, commits ou logs.

## Execucao local

Backend:

```bash
cd server
npm install
npm run migrate
npm start
```

Frontend:

```bash
cd client
npm install
npm run dev
```

Por padrao, use:

- API: `http://localhost:3001`
- Frontend Vite: `http://localhost:3000`

Se usar Docker Compose, ajuste `VITE_API_URL=http://localhost:3005` e inclua `http://localhost:5173` em `CORS_ORIGIN`.

## Autenticacao

Login:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"restaurante_slug\":\"autenix\",\"login\":\"admin\",\"senha\":\"sua-senha\"}"
```

A resposta inclui `token`. Rotas protegidas exigem:

```bash
Authorization: Bearer <token>
```

Exemplo:

```bash
curl http://localhost:3001/api/usuarios \
  -H "Authorization: Bearer <token>"
```

Rotas publicas do cliente:

- `GET /api/cardapio?restaurante_slug=...`, somente leitura via backend e com
  rate limit
- `GET /api/mesas/:id?restaurante_slug=...`, com token da sessao do QR
- `GET /api/pedidos?mesa_id=...&restaurante_slug=...`, com token da sessao
- `POST /api/pedidos`, com token da sessao
- `PATCH /api/itens/:id/cancelar`, com token da sessao
- `POST /api/chamadas`, com token da sessao

`GET /api/qrcode/:mesa_id` exige JWT de administrador.

## Multi-restaurante

As URLs canonicas usam `/r/:slug`. O JWT, as consultas PostgreSQL, as policies
RLS e as salas do Socket.IO carregam o mesmo `restaurante_id`.

Para criar um restaurante, master, categorias e mesas:

```bash
cd server
npm run tenant:create -- --nome "Restaurante Exemplo" --slug restaurante-exemplo --mesas 20
```

Fluxo completo e ordem segura de deploy: `docs/multi-tenant.md`.

## Painel da plataforma

O operador global acessa `/plataforma` com uma conta `platform_admin` separada.
Nesse painel e possivel cadastrar restaurantes, criar o master de cada cliente,
definir plano e limites, suspender, arquivar, redefinir acesso e configurar white
label. O `master` de um restaurante continua limitado ao proprio `restaurante_id`.

Fluxo e controles de seguranca: `docs/platform-admin.md`.

## Migrations

As migrations PostgreSQL ficam em `server/migrations`.

```bash
cd server
npm run migrate
```

O backend mantem o bootstrap local por compatibilidade, mas as migrations devem
ser executadas antes do primeiro startup. O historico privado impede reaplicar
arquivos e `npm run migrate:status` mostra o estado atual. Para bancos legados ja
montados, use `npm run migrate -- --baseline` uma unica vez e somente apos
validar o schema.

Detalhes de migracao SQLite/Supabase: `docs/postgres-migration.md`.

## Deploy

### Supabase

1. Crie o projeto PostgreSQL no Supabase.
2. Configure `DATABASE_URL` com a connection string.
3. Configure `DATABASE_SSL=true`.
4. Rode `npm run migrate` apontando para o banco Supabase.

### Railway backend

Root directory: `server`

Comandos:

- Build: instalacao padrao do Railway ou Dockerfile
- Start: `npm start`

Variaveis:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `DATABASE_SSL=true`
- `JWT_SECRET`
- `JWT_EXPIRES_IN=8h`
- `CORS_ORIGIN=https://seu-frontend.vercel.app`
- `TRUST_PROXY=true`
- `PUBLIC_APP_URL=https://seu-frontend.vercel.app`
- `ADMIN_LOGIN=admin`
- `ADMIN_PASSWORD_HASH=<hash-bcrypt>` no primeiro bootstrap

### Vercel frontend

Root directory: `client`

Comandos:

- Install: `npm install`
- Build: `npm run build`
- Output: `dist`

Variaveis:

- `VITE_API_URL=https://seu-backend.railway.app`

## Checklist de teste antes do deploy

- Login admin
- Login garcom
- Login cozinha
- Login financeiro
- Criacao e edicao de produtos
- Pedidos em tempo real
- Eventos Socket.IO
- Fechamento de mesa com pagamento obrigatorio
- Exportacao PDF
- Relatorios
- Reset da numeracao diaria
- Historico de comandas
- Importacao CSV e XLSX com mapeamento, historico e rollback
- Fluxo mobile, tablet e notebook

## Observacoes de seguranca

- Nao existe mais senha fixa do admin no bundle frontend.
- Senhas novas sao gravadas com bcrypt.
- Login gera JWT.
- Rotas operacionais exigem JWT e papel autorizado.
- CORS nao usa `origin: "*"`; em producao depende de `CORS_ORIGIN`.
- Login tem rate limit de 5 tentativas por minuto.
- Fluxos publicos possuem limites separados; acoes de mesa usam o hash da sessao.
- Usuarios e roles sao revalidados no banco em cada requisicao autenticada.
- Imagens sao verificadas, redimensionadas, limpas de metadados e salvas em WebP.
- `categorias` e `produtos` nao podem ser lidos diretamente pela Data API.
- Helmet esta habilitado no backend.

## Verificacoes conhecidas

- `npm run build` do frontend passa.
- `node --check` do backend e scripts passa.
- `npm test` do backend cobre autenticacao, RLS auxiliar, reservas, importacao,
  migrations, rate limit, upload, white label e provisionamento.
- `npm test`, `npm run lint` e `npm run build` do frontend passam.
