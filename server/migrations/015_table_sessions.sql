CREATE TABLE IF NOT EXISTS public.sessoes_mesa (
  id SERIAL PRIMARY KEY,
  restaurante_id INTEGER NOT NULL,
  mesa_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em TIMESTAMP NOT NULL,
  encerrado_em TIMESTAMP,
  ultimo_acesso_em TIMESTAMP,
  criado_por_usuario_id INTEGER
);

ALTER TABLE public.sessoes_mesa
  DROP CONSTRAINT IF EXISTS sessoes_mesa_restaurante_id_fkey,
  DROP CONSTRAINT IF EXISTS sessoes_mesa_mesa_restaurante_fkey,
  DROP CONSTRAINT IF EXISTS sessoes_mesa_usuario_restaurante_fkey,
  DROP CONSTRAINT IF EXISTS sessoes_mesa_status_check,
  DROP CONSTRAINT IF EXISTS sessoes_mesa_token_hash_tamanho_check;

ALTER TABLE public.sessoes_mesa
  ADD CONSTRAINT sessoes_mesa_restaurante_id_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT sessoes_mesa_mesa_restaurante_fkey
    FOREIGN KEY (mesa_id, restaurante_id)
    REFERENCES public.mesas(id, restaurante_id) ON DELETE RESTRICT,
  ADD CONSTRAINT sessoes_mesa_usuario_restaurante_fkey
    FOREIGN KEY (criado_por_usuario_id, restaurante_id)
    REFERENCES public.usuarios(id, restaurante_id) ON DELETE SET NULL (criado_por_usuario_id),
  ADD CONSTRAINT sessoes_mesa_status_check
    CHECK (status IN ('ativa', 'encerrada', 'expirada')),
  ADD CONSTRAINT sessoes_mesa_token_hash_tamanho_check
    CHECK (char_length(token_hash) = 64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessoes_mesa_ativa_unica
  ON public.sessoes_mesa (restaurante_id, mesa_id)
  WHERE status = 'ativa';

CREATE INDEX IF NOT EXISTS idx_sessoes_mesa_token_hash
  ON public.sessoes_mesa (token_hash);

CREATE INDEX IF NOT EXISTS idx_sessoes_mesa_restaurante_mesa_status
  ON public.sessoes_mesa (restaurante_id, mesa_id, status, expira_em);

ALTER TABLE public.sessoes_mesa ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.sessoes_mesa
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.sessoes_mesa_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.sessoes_mesa TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.sessoes_mesa_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessoes_mesa TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.sessoes_mesa_id_seq TO autenix_backend;

DROP POLICY IF EXISTS sessoes_mesa_backend_crud ON public.sessoes_mesa;
CREATE POLICY sessoes_mesa_backend_crud
  ON public.sessoes_mesa FOR ALL TO autenix_backend
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
