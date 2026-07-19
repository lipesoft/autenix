ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ;

UPDATE public.pedidos
SET finalizado_em = criado_em AT TIME ZONE 'UTC'
WHERE status = 'finalizado'
  AND finalizado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_restaurante_finalizado_em
  ON public.pedidos (restaurante_id, finalizado_em DESC)
  WHERE status = 'finalizado';

COMMENT ON COLUMN public.pedidos.finalizado_em IS
  'Instante real do fechamento do pedido, armazenado com fuso horario.';
