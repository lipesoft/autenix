ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS whatsapp_numero TEXT;

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_whatsapp_numero_formato_check;

ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_whatsapp_numero_formato_check
    CHECK (
      whatsapp_numero IS NULL
      OR whatsapp_numero ~ '^[0-9]{12,15}$'
    );
