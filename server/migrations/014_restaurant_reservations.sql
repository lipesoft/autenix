CREATE TABLE IF NOT EXISTS public.reservas (
  id SERIAL PRIMARY KEY,
  restaurante_id INTEGER NOT NULL,
  mesa_id INTEGER,
  nome_cliente TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  data_reserva DATE NOT NULL,
  horario TIME NOT NULL,
  quantidade_pessoas INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacao TEXT,
  origem TEXT NOT NULL DEFAULT 'publica',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmada_em TIMESTAMP,
  cancelada_em TIMESTAMP,
  concluida_em TIMESTAMP
);

ALTER TABLE public.reservas
  DROP CONSTRAINT IF EXISTS reservas_restaurante_id_fkey,
  DROP CONSTRAINT IF EXISTS reservas_mesa_restaurante_fkey,
  DROP CONSTRAINT IF EXISTS reservas_status_check,
  DROP CONSTRAINT IF EXISTS reservas_origem_check,
  DROP CONSTRAINT IF EXISTS reservas_quantidade_pessoas_check,
  DROP CONSTRAINT IF EXISTS reservas_nome_cliente_tamanho_check,
  DROP CONSTRAINT IF EXISTS reservas_telefone_tamanho_check,
  DROP CONSTRAINT IF EXISTS reservas_email_tamanho_check,
  DROP CONSTRAINT IF EXISTS reservas_observacao_tamanho_check;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_restaurante_id_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT reservas_mesa_restaurante_fkey
    FOREIGN KEY (mesa_id, restaurante_id)
    REFERENCES public.mesas(id, restaurante_id) ON DELETE SET NULL (mesa_id),
  ADD CONSTRAINT reservas_status_check
    CHECK (status IN ('pendente', 'confirmada', 'cancelada', 'concluida')),
  ADD CONSTRAINT reservas_origem_check
    CHECK (origem IN ('publica', 'admin')),
  ADD CONSTRAINT reservas_quantidade_pessoas_check
    CHECK (quantidade_pessoas BETWEEN 1 AND 100),
  ADD CONSTRAINT reservas_nome_cliente_tamanho_check
    CHECK (char_length(nome_cliente) BETWEEN 2 AND 120),
  ADD CONSTRAINT reservas_telefone_tamanho_check
    CHECK (char_length(telefone) BETWEEN 8 AND 30),
  ADD CONSTRAINT reservas_email_tamanho_check
    CHECK (email IS NULL OR char_length(email) <= 160),
  ADD CONSTRAINT reservas_observacao_tamanho_check
    CHECK (observacao IS NULL OR char_length(observacao) <= 500);

CREATE INDEX IF NOT EXISTS idx_reservas_restaurante_data_horario
  ON public.reservas (restaurante_id, data_reserva, horario);

CREATE INDEX IF NOT EXISTS idx_reservas_restaurante_status_data
  ON public.reservas (restaurante_id, status, data_reserva);

CREATE INDEX IF NOT EXISTS idx_reservas_restaurante_mesa_data
  ON public.reservas (restaurante_id, mesa_id, data_reserva)
  WHERE mesa_id IS NOT NULL;

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.reservas
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.reservas_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.reservas TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.reservas_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservas TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.reservas_id_seq TO autenix_backend;

DROP POLICY IF EXISTS reservas_backend_crud ON public.reservas;
CREATE POLICY reservas_backend_crud
  ON public.reservas FOR ALL TO autenix_backend
  USING (
    restaurante_id = NULLIF(
      (SELECT current_setting('app.restaurante_id', true)), ''
    )::INTEGER
  )
  WITH CHECK (
    restaurante_id = NULLIF(
      (SELECT current_setting('app.restaurante_id', true)), ''
    )::INTEGER
  );
