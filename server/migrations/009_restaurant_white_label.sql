ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS white_label_ativo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nome_exibicao TEXT,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_nome_exibicao_tamanho_check,
  DROP CONSTRAINT IF EXISTS restaurantes_cor_primaria_formato_check,
  DROP CONSTRAINT IF EXISTS restaurantes_cor_secundaria_formato_check,
  DROP CONSTRAINT IF EXISTS restaurantes_logo_url_tamanho_check;

ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_nome_exibicao_tamanho_check
    CHECK (
      nome_exibicao IS NULL
      OR char_length(btrim(nome_exibicao)) BETWEEN 2 AND 80
    ),
  ADD CONSTRAINT restaurantes_cor_primaria_formato_check
    CHECK (cor_primaria IS NULL OR cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT restaurantes_cor_secundaria_formato_check
    CHECK (cor_secundaria IS NULL OR cor_secundaria ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT restaurantes_logo_url_tamanho_check
    CHECK (logo_url IS NULL OR char_length(logo_url) <= 2048);

