ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS limite_usuarios INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS limite_produtos INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS mensalidade_centavos INTEGER NOT NULL DEFAULT 9900,
  ADD COLUMN IF NOT EXISTS ciclo_cobranca TEXT NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS status_cobranca TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_termina_em DATE,
  ADD COLUMN IF NOT EXISTS proxima_cobranca_em DATE,
  ADD COLUMN IF NOT EXISTS observacoes_plano TEXT;

UPDATE public.restaurantes
SET limite_usuarios = CASE plano
    WHEN 'profissional' THEN GREATEST(limite_usuarios, 15)
    WHEN 'enterprise' THEN GREATEST(limite_usuarios, 100)
    ELSE GREATEST(limite_usuarios, 5)
  END,
  limite_produtos = CASE plano
    WHEN 'profissional' THEN GREATEST(limite_produtos, 400)
    WHEN 'enterprise' THEN GREATEST(limite_produtos, 2000)
    ELSE GREATEST(limite_produtos, 120)
  END,
  mensalidade_centavos = CASE
    WHEN mensalidade_centavos <> 9900 THEN mensalidade_centavos
    WHEN plano = 'profissional' THEN 19900
    WHEN plano = 'enterprise' THEN 0
    ELSE 9900
  END,
  atualizado_em = NOW();

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_limite_usuarios_check,
  DROP CONSTRAINT IF EXISTS restaurantes_limite_produtos_check,
  DROP CONSTRAINT IF EXISTS restaurantes_mensalidade_centavos_check,
  DROP CONSTRAINT IF EXISTS restaurantes_ciclo_cobranca_check,
  DROP CONSTRAINT IF EXISTS restaurantes_status_cobranca_check,
  DROP CONSTRAINT IF EXISTS restaurantes_observacoes_plano_tamanho_check;

ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_limite_usuarios_check
    CHECK (limite_usuarios BETWEEN 1 AND 500),
  ADD CONSTRAINT restaurantes_limite_produtos_check
    CHECK (limite_produtos BETWEEN 1 AND 10000),
  ADD CONSTRAINT restaurantes_mensalidade_centavos_check
    CHECK (mensalidade_centavos BETWEEN 0 AND 99999900),
  ADD CONSTRAINT restaurantes_ciclo_cobranca_check
    CHECK (ciclo_cobranca IN ('mensal', 'anual', 'experimental', 'personalizado')),
  ADD CONSTRAINT restaurantes_status_cobranca_check
    CHECK (status_cobranca IN ('trial', 'ativo', 'pendente', 'atrasado', 'isento')),
  ADD CONSTRAINT restaurantes_observacoes_plano_tamanho_check
    CHECK (observacoes_plano IS NULL OR char_length(observacoes_plano) <= 500);

CREATE INDEX IF NOT EXISTS idx_restaurantes_status_cobranca
  ON public.restaurantes (status_cobranca, proxima_cobranca_em)
  WHERE excluido_em IS NULL;
