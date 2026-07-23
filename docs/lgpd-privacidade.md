# LGPD e privacidade - primeira camada

Versao tecnica: 2026-07-23.

## Escopo implementado

- Banner de cookies com aceitar todos, recusar nao essenciais e personalizar.
- Categorias: necessarios, funcionais, estatisticas e marketing.
- Preferencia salva em `localStorage` com versao e data de aceite.
- Paginas publicas `/privacidade` e `/termos`.
- Formulario comercial da landing com aceite explicito.
- Reserva/fila publica com aceite explicito.
- Endpoint backend `POST /api/consentimentos` para registrar aceite.
- Tabela `public.consentimentos_legais` com RLS habilitado e acesso direto bloqueado para `anon` e `authenticated`.

## Auditoria de cookies

Nao foram encontrados usos diretos de `document.cookie` no frontend ou backend do Autenix.

Classificacao atual:

| Tecnologia | Local | Categoria | Finalidade | Observacao |
| --- | --- | --- | --- | --- |
| `sessionStorage.usuarioLogado` | Frontend restaurante | Necessarios | Sessao temporaria de login do restaurante | Nao armazena senha. Contem token JWT temporario. |
| `sessionStorage.autenixPlatformSession` | Frontend plataforma | Necessarios | Sessao temporaria da plataforma | Nao armazena senha. Contem token JWT temporario. |
| `localStorage.autenix_cookie_consent` | Frontend global | Necessarios | Lembrar preferencias de privacidade | Contem versao, data e preferencias. |

## Scripts de terceiros

Nao ha scripts de analytics, pixel, Hotjar, Clarity, Meta, Google Ads ou similares carregados no `client/index.html`.

Regra aplicada:

- Scripts de estatisticas so podem ser carregados quando `estatisticas = true`.
- Scripts de marketing so podem ser carregados quando `marketing = true`.
- Hoje nenhum script opcional e carregado antes do consentimento.

Para integracoes futuras, usar `canUseCookieCategory("estatisticas")` ou `canUseCookieCategory("marketing")`.

## Registro de consentimento

O endpoint `POST /api/consentimentos` registra:

- contexto do aceite;
- versao da Politica de Privacidade;
- versao dos Termos de Uso;
- aceite de privacidade;
- aceite de termos;
- categorias de cookies informadas;
- data/hora gerada pelo banco;
- `restaurante_id` quando houver slug valido;
- hash de IP e hash de user-agent.

Dados minimizados:

- IP bruto nao e armazenado.
- User-agent bruto nao e armazenado.
- Senha, token, service role e credenciais nao sao armazenados.

## Banco e RLS

Migration adicionada:

- `server/migrations/031_legal_consent_records.sql`

Tabela:

- `public.consentimentos_legais`

Seguranca:

- RLS habilitado.
- `anon` e `authenticated` sem privilegios diretos.
- `service_role` com acesso completo.
- `autenix_backend` com `SELECT` e `INSERT`.
- Policies restritas ao backend.

## Formularios revisados

- Landing comercial: nome, restaurante, telefone e plano.
- Reservas/fila publica: nome, telefone, e-mail opcional, data, horario, pessoas, salao e observacao.
- Login restaurante e plataforma: sem consentimento explicito, pois a base esperada e execucao do servico e seguranca. Foram adicionados links para politica e termos.

## Pontos pendentes

- Revisao juridica formal por advogado.
- DPA/contrato de operador com restaurantes clientes.
- Politica formal de retencao por tipo de dado.
- Canal operacional para atender titular em prazo LGPD.
- Processo de exportacao/exclusao/anonimizacao por titular.
- Integracao futura com provedor real de e-mail comercial.
- Inventario juridico dos subprocessadores usados em producao.
- Revisao de transferencias internacionais, se aplicavel.

## Recomendacoes futuras

- Criar painel interno para consultar consentimentos por restaurante e periodo.
- Adicionar centro de privacidade para o titular acompanhar solicitacoes.
- Criar rotina de expiracao/anonimizacao de dados antigos.
- Adicionar monitoramento para tentativa de envio de formularios sem consentimento.
- Revisar textos juridicos antes de pilotos comerciais amplos.
