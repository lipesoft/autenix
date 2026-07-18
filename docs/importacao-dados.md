# Importacao de dados

O painel administrativo do restaurante possui a aba `Importacao` para migrar
dados basicos de outro sistema usando arquivos CSV ou XLSX.

## Tipos suportados

- `Categorias`: `nome`, `ordem`
- `Produtos`: `categoria`, `nome`, `descricao`, `preco`, `imagem`, `disponivel`
- `Mesas`: `numero`, `status`
- `Usuarios`: `nome`, `login`, `role`, `senha`, `ativo`

O backend valida todas as linhas antes de gravar. A importacao so e executada
quando nao ha linhas invalidas e quando os limites do plano nao serao excedidos.

## Leitura e mapeamento

- CSV aceita separador `;` ou `,` e conteudo colado manualmente.
- XLSX le a primeira planilha do arquivo.
- O mapeamento sugere colunas conhecidas e pode ser ajustado antes da validacao.
- Campos obrigatorios precisam estar mapeados e uma coluna de origem nao pode
  alimentar dois campos diferentes.
- O leitor XLSX e carregado sob demanda para nao aumentar o JavaScript inicial
  da landing page e dos demais paineis.

## Regras

- Apenas usuarios `admin` do restaurante podem importar dados.
- Todas as linhas sao gravadas com o `restaurante_id` do JWT.
- Produtos podem criar automaticamente categorias ainda inexistentes.
- Usuarios sem senha recebem senha temporaria gerada no momento da importacao.
- Registros existentes sao ignorados por padrao.
- A opcao `Atualizar registros existentes` permite atualizar pelo mesmo nome,
  numero ou login, dependendo do tipo importado.
- Cada execucao concluida registra arquivo, formato, usuario, data, resumo e os
  IDs efetivamente criados ou atualizados.

## Limites

- Maximo de 500 linhas por importacao.
- Maximo de 50 colunas e 5 MB por arquivo no frontend.
- Produtos respeitam `limite_produtos`.
- Mesas respeitam `limite_mesas`.
- Usuarios ativos respeitam `limite_usuarios`.

## Historico e rollback

- O historico exibe as 20 operacoes mais recentes do restaurante.
- O detalhe lista apenas entidade, acao e ID; snapshots internos e hashes de
  senha nao sao devolvidos ao navegador.
- O rollback fica disponivel por 24 horas e executa tudo em uma transacao.
- Registros criados sao removidos em ordem reversa e registros atualizados
  recebem novamente os valores anteriores.
- O rollback e recusado se o registro mudou depois da importacao, ja foi
  removido, esta sendo usado por outro fluxo ou pertence a outro restaurante.
- `importacoes` e `importacao_itens` usam RLS, nao possuem acesso de `anon` ou
  `authenticated` e sao acessadas apenas pelo backend tenant-aware.

## Evolucoes pendentes

- Criar importadores especificos para exportacoes de sistemas concorrentes.
- Importar imagens de produtos em lote e vincular ao cadastro.
