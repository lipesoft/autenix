ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS cor_texto_principal TEXT,
  ADD COLUMN IF NOT EXISTS cor_texto_secundario TEXT,
  ADD COLUMN IF NOT EXISTS cor_titulo TEXT,
  ADD COLUMN IF NOT EXISTS cor_texto_inverso TEXT;

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_cor_texto_principal_formato_check,
  DROP CONSTRAINT IF EXISTS restaurantes_cor_texto_secundario_formato_check,
  DROP CONSTRAINT IF EXISTS restaurantes_cor_titulo_formato_check,
  DROP CONSTRAINT IF EXISTS restaurantes_cor_texto_inverso_formato_check;

ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_cor_texto_principal_formato_check
    CHECK (cor_texto_principal IS NULL OR cor_texto_principal ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT restaurantes_cor_texto_secundario_formato_check
    CHECK (cor_texto_secundario IS NULL OR cor_texto_secundario ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT restaurantes_cor_titulo_formato_check
    CHECK (cor_titulo IS NULL OR cor_titulo ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT restaurantes_cor_texto_inverso_formato_check
    CHECK (cor_texto_inverso IS NULL OR cor_texto_inverso ~ '^#[0-9A-Fa-f]{6}$');
