# Importacao de dados

O painel administrativo do restaurante possui a aba `Importacao` para migrar
dados basicos de outro sistema usando arquivos CSV.

## Tipos suportados

- `Categorias`: `nome`, `ordem`
- `Produtos`: `categoria`, `nome`, `descricao`, `preco`, `imagem`, `disponivel`
- `Mesas`: `numero`, `status`
- `Usuarios`: `nome`, `login`, `role`, `senha`, `ativo`

O backend valida todas as linhas antes de gravar. A importacao so e executada
quando nao ha linhas invalidas e quando os limites do plano nao serao excedidos.

## Regras

- Apenas usuarios `admin` do restaurante podem importar dados.
- Todas as linhas sao gravadas com o `restaurante_id` do JWT.
- Produtos podem criar automaticamente categorias ainda inexistentes.
- Usuarios sem senha recebem senha temporaria gerada no momento da importacao.
- Registros existentes sao ignorados por padrao.
- A opcao `Atualizar registros existentes` permite atualizar pelo mesmo nome,
  numero ou login, dependendo do tipo importado.

## Limites

- Maximo de 500 linhas por importacao.
- Produtos respeitam `limite_produtos`.
- Mesas respeitam `limite_mesas`.
- Usuarios ativos respeitam `limite_usuarios`.

## Evolucoes pendentes

- Importar arquivos `.xlsx` diretamente.
- Criar importadores especificos para exportacoes de sistemas concorrentes.
- Salvar historico de importacoes com usuario, data e resumo.
- Permitir rollback de uma importacao recente.
