CREATE TABLE IF NOT EXISTS public.auditoria_operacional (
  id BIGSERIAL PRIMARY KEY,
  restaurante_id INTEGER NOT NULL,
  usuario_id INTEGER,
  usuario_nome TEXT,
  usuario_login TEXT,
  usuario_role TEXT,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id INTEGER,
  dados_anteriores JSONB,
  dados_novos JSONB,
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.auditoria_operacional
  DROP CONSTRAINT IF EXISTS auditoria_operacional_restaurante_fkey,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_acao_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_entidade_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_usuario_nome_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_usuario_login_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_usuario_role_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_request_id_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_dados_anteriores_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_dados_novos_check,
  DROP CONSTRAINT IF EXISTS auditoria_operacional_metadados_check;

ALTER TABLE public.auditoria_operacional
  ADD CONSTRAINT auditoria_operacional_restaurante_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT auditoria_operacional_acao_check
    CHECK (acao IN ('criacao', 'alteracao', 'remocao', 'fechamento')),
  ADD CONSTRAINT auditoria_operacional_entidade_check
    CHECK (entidade IN ('categorias', 'produtos', 'usuarios', 'mesas', 'financeiro')),
  ADD CONSTRAINT auditoria_operacional_usuario_nome_check
    CHECK (usuario_nome IS NULL OR char_length(usuario_nome) <= 120),
  ADD CONSTRAINT auditoria_operacional_usuario_login_check
    CHECK (usuario_login IS NULL OR char_length(usuario_login) <= 120),
  ADD CONSTRAINT auditoria_operacional_usuario_role_check
    CHECK (usuario_role IS NULL OR char_length(usuario_role) <= 40),
  ADD CONSTRAINT auditoria_operacional_request_id_check
    CHECK (request_id IS NULL OR char_length(request_id) <= 120),
  ADD CONSTRAINT auditoria_operacional_dados_anteriores_check
    CHECK (dados_anteriores IS NULL OR jsonb_typeof(dados_anteriores) = 'object'),
  ADD CONSTRAINT auditoria_operacional_dados_novos_check
    CHECK (dados_novos IS NULL OR jsonb_typeof(dados_novos) = 'object'),
  ADD CONSTRAINT auditoria_operacional_metadados_check
    CHECK (jsonb_typeof(metadados) = 'object');

CREATE INDEX IF NOT EXISTS idx_auditoria_operacional_restaurante_criado
  ON public.auditoria_operacional (restaurante_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_operacional_entidade
  ON public.auditoria_operacional (restaurante_id, entidade, entidade_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_operacional_usuario
  ON public.auditoria_operacional (restaurante_id, usuario_id, criado_em DESC)
  WHERE usuario_id IS NOT NULL;

ALTER TABLE public.auditoria_operacional ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.auditoria_operacional
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.auditoria_operacional_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.auditoria_operacional TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.auditoria_operacional_id_seq TO service_role;

GRANT SELECT, INSERT ON TABLE public.auditoria_operacional TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.auditoria_operacional_id_seq TO autenix_backend;

DROP POLICY IF EXISTS auditoria_operacional_backend_read_insert
ON public.auditoria_operacional;
CREATE POLICY auditoria_operacional_backend_read_insert
  ON public.auditoria_operacional FOR ALL TO autenix_backend
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
