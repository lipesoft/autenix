ALTER TABLE public.auditoria_operacional
  DROP CONSTRAINT IF EXISTS auditoria_operacional_acao_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_entidade_check;

ALTER TABLE public.auditoria_operacional
  ADD CONSTRAINT auditoria_operacional_acao_check
    CHECK (acao IN (
      'criacao',
      'alteracao',
      'remocao',
      'fechamento',
      'cancelamento',
      'rollback'
    )),
  ADD CONSTRAINT auditoria_operacional_entidade_check
    CHECK (entidade IN (
      'categorias',
      'produtos',
      'usuarios',
      'mesas',
      'financeiro',
      'reservas',
      'importacoes',
      'configuracoes',
      'itens_pedido'
    ));

CREATE INDEX IF NOT EXISTS idx_auditoria_operacional_acao_criado
  ON public.auditoria_operacional (restaurante_id, acao, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_operacional_request
  ON public.auditoria_operacional (restaurante_id, request_id)
  WHERE request_id IS NOT NULL;
