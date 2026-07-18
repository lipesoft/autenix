ALTER TABLE public.reservas
  DROP CONSTRAINT IF EXISTS reservas_id_restaurante_key;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_id_restaurante_key UNIQUE (id, restaurante_id);

CREATE TABLE IF NOT EXISTS public.reservas_eventos (
  id SERIAL PRIMARY KEY,
  restaurante_id INTEGER NOT NULL,
  reserva_id INTEGER NOT NULL,
  usuario_id INTEGER,
  usuario_nome TEXT,
  usuario_role TEXT,
  origem TEXT NOT NULL DEFAULT 'sistema',
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status_anterior TEXT,
  status_novo TEXT,
  mesa_id_anterior INTEGER,
  mesa_id_novo INTEGER,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.reservas_eventos
  DROP CONSTRAINT IF EXISTS reservas_eventos_restaurante_id_fkey,
  DROP CONSTRAINT IF EXISTS reservas_eventos_reserva_fkey,
  DROP CONSTRAINT IF EXISTS reservas_eventos_usuario_fkey,
  DROP CONSTRAINT IF EXISTS reservas_eventos_origem_check,
  DROP CONSTRAINT IF EXISTS reservas_eventos_tipo_check,
  DROP CONSTRAINT IF EXISTS reservas_eventos_descricao_tamanho_check,
  DROP CONSTRAINT IF EXISTS reservas_eventos_usuario_nome_tamanho_check,
  DROP CONSTRAINT IF EXISTS reservas_eventos_usuario_role_tamanho_check;

ALTER TABLE public.reservas_eventos
  ADD CONSTRAINT reservas_eventos_restaurante_id_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT reservas_eventos_reserva_fkey
    FOREIGN KEY (reserva_id, restaurante_id)
    REFERENCES public.reservas(id, restaurante_id) ON DELETE CASCADE,
  ADD CONSTRAINT reservas_eventos_usuario_fkey
    FOREIGN KEY (usuario_id, restaurante_id)
    REFERENCES public.usuarios(id, restaurante_id) ON DELETE SET NULL (usuario_id),
  ADD CONSTRAINT reservas_eventos_origem_check
    CHECK (origem IN ('publica', 'admin', 'garcom', 'sistema')),
  ADD CONSTRAINT reservas_eventos_tipo_check
    CHECK (tipo IN ('criada', 'status_alterado', 'mesa_alterada', 'compartilhamento')),
  ADD CONSTRAINT reservas_eventos_descricao_tamanho_check
    CHECK (char_length(descricao) BETWEEN 2 AND 500),
  ADD CONSTRAINT reservas_eventos_usuario_nome_tamanho_check
    CHECK (usuario_nome IS NULL OR char_length(usuario_nome) <= 120),
  ADD CONSTRAINT reservas_eventos_usuario_role_tamanho_check
    CHECK (usuario_role IS NULL OR char_length(usuario_role) <= 30);

CREATE INDEX IF NOT EXISTS idx_reservas_eventos_reserva_criado
  ON public.reservas_eventos (restaurante_id, reserva_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_reservas_eventos_usuario_criado
  ON public.reservas_eventos (restaurante_id, usuario_id, criado_em DESC)
  WHERE usuario_id IS NOT NULL;

ALTER TABLE public.reservas_eventos ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.reservas_eventos
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.reservas_eventos_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.reservas_eventos TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.reservas_eventos_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservas_eventos TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.reservas_eventos_id_seq TO autenix_backend;

DROP POLICY IF EXISTS reservas_eventos_backend_crud ON public.reservas_eventos;
CREATE POLICY reservas_eventos_backend_crud
  ON public.reservas_eventos FOR ALL TO autenix_backend
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
