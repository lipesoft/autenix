ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'reserva',
  ADD COLUMN IF NOT EXISTS codigo_acompanhamento TEXT,
  ADD COLUMN IF NOT EXISTS entrou_fila_em TIMESTAMP,
  ADD COLUMN IF NOT EXISTS chamada_em TIMESTAMP;

UPDATE public.reservas
SET codigo_acompanhamento = substring(md5(random()::text || clock_timestamp()::text || id::text), 1, 16)
WHERE codigo_acompanhamento IS NULL;

UPDATE public.reservas
SET tipo = 'fila',
    entrou_fila_em = COALESCE(entrou_fila_em, criado_em)
WHERE status = 'fila';

ALTER TABLE public.reservas
  ALTER COLUMN codigo_acompanhamento SET NOT NULL;

ALTER TABLE public.reservas
  DROP CONSTRAINT IF EXISTS reservas_status_check,
  DROP CONSTRAINT IF EXISTS reservas_tipo_check,
  DROP CONSTRAINT IF EXISTS reservas_codigo_acompanhamento_tamanho_check;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_status_check
    CHECK (status IN ('pendente', 'confirmada', 'fila', 'chamada', 'cancelada', 'concluida')),
  ADD CONSTRAINT reservas_tipo_check
    CHECK (tipo IN ('reserva', 'fila')),
  ADD CONSTRAINT reservas_codigo_acompanhamento_tamanho_check
    CHECK (char_length(codigo_acompanhamento) BETWEEN 8 AND 40);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_restaurante_codigo_acompanhamento
  ON public.reservas (restaurante_id, codigo_acompanhamento);

CREATE INDEX IF NOT EXISTS idx_reservas_fila_ativa
  ON public.reservas (
    restaurante_id,
    data_reserva,
    horario,
    entrou_fila_em,
    id
  )
  WHERE status = 'fila';
