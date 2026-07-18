ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS status_comercial TEXT,
  ADD COLUMN IF NOT EXISTS data_inicio_contrato DATE,
  ADD COLUMN IF NOT EXISTS ultimo_contato_comercial_em DATE,
  ADD COLUMN IF NOT EXISTS responsavel_comercial TEXT,
  ADD COLUMN IF NOT EXISTS motivo_suspensao TEXT;

UPDATE public.restaurantes
SET status_comercial = CASE
    WHEN excluido_em IS NOT NULL THEN 'cancelado'
    WHEN ativo = 0 THEN 'suspenso'
    WHEN status_cobranca = 'trial' THEN 'trial'
    WHEN status_cobranca = 'isento' THEN 'isento'
    ELSE 'cliente'
  END,
  data_inicio_contrato = COALESCE(data_inicio_contrato, criado_em::date)
WHERE status_comercial IS NULL;

ALTER TABLE public.restaurantes
  ALTER COLUMN status_comercial SET DEFAULT 'trial',
  ALTER COLUMN status_comercial SET NOT NULL;

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_status_comercial_check,
  DROP CONSTRAINT IF EXISTS restaurantes_responsavel_comercial_tamanho_check,
  DROP CONSTRAINT IF EXISTS restaurantes_motivo_suspensao_tamanho_check;

ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_status_comercial_check
    CHECK (status_comercial IN ('lead', 'trial', 'cliente', 'suspenso', 'cancelado', 'isento')),
  ADD CONSTRAINT restaurantes_responsavel_comercial_tamanho_check
    CHECK (responsavel_comercial IS NULL OR char_length(responsavel_comercial) <= 120),
  ADD CONSTRAINT restaurantes_motivo_suspensao_tamanho_check
    CHECK (motivo_suspensao IS NULL OR char_length(motivo_suspensao) <= 500);

CREATE INDEX IF NOT EXISTS idx_restaurantes_status_comercial
  ON public.restaurantes (status_comercial, status_cobranca, proxima_cobranca_em)
  WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurantes_contato_comercial
  ON public.restaurantes (ultimo_contato_comercial_em)
  WHERE excluido_em IS NULL;
