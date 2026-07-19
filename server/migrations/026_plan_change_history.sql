CREATE TABLE IF NOT EXISTS public.restaurante_plano_historico (
  id BIGSERIAL PRIMARY KEY,
  restaurante_id INTEGER NOT NULL,
  platform_usuario_id INTEGER,
  platform_usuario_nome TEXT,
  platform_usuario_login TEXT,
  acao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB NOT NULL,
  motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.restaurante_plano_historico
  DROP CONSTRAINT IF EXISTS restaurante_plano_historico_restaurante_fkey,
  DROP CONSTRAINT IF EXISTS restaurante_plano_historico_platform_usuario_fkey,
  DROP CONSTRAINT IF EXISTS restaurante_plano_historico_acao_check,
  DROP CONSTRAINT IF EXISTS restaurante_plano_historico_usuario_nome_check,
  DROP CONSTRAINT IF EXISTS restaurante_plano_historico_usuario_login_check,
  DROP CONSTRAINT IF EXISTS restaurante_plano_historico_motivo_check,
  DROP CONSTRAINT IF EXISTS restaurante_plano_historico_dados_anteriores_check,
  DROP CONSTRAINT IF EXISTS restaurante_plano_historico_dados_novos_check;

ALTER TABLE public.restaurante_plano_historico
  ADD CONSTRAINT restaurante_plano_historico_restaurante_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT restaurante_plano_historico_platform_usuario_fkey
    FOREIGN KEY (platform_usuario_id)
    REFERENCES public.platform_usuarios(id) ON DELETE SET NULL,
  ADD CONSTRAINT restaurante_plano_historico_acao_check
    CHECK (acao IN ('criacao', 'alteracao_plano', 'alteracao_status', 'arquivamento')),
  ADD CONSTRAINT restaurante_plano_historico_usuario_nome_check
    CHECK (platform_usuario_nome IS NULL OR char_length(platform_usuario_nome) <= 120),
  ADD CONSTRAINT restaurante_plano_historico_usuario_login_check
    CHECK (platform_usuario_login IS NULL OR char_length(platform_usuario_login) <= 120),
  ADD CONSTRAINT restaurante_plano_historico_motivo_check
    CHECK (motivo IS NULL OR char_length(motivo) <= 500),
  ADD CONSTRAINT restaurante_plano_historico_dados_anteriores_check
    CHECK (dados_anteriores IS NULL OR jsonb_typeof(dados_anteriores) = 'object'),
  ADD CONSTRAINT restaurante_plano_historico_dados_novos_check
    CHECK (jsonb_typeof(dados_novos) = 'object');

CREATE INDEX IF NOT EXISTS idx_restaurante_plano_historico_restaurante_criado
  ON public.restaurante_plano_historico (restaurante_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_restaurante_plano_historico_platform_usuario_fk
  ON public.restaurante_plano_historico (platform_usuario_id)
  WHERE platform_usuario_id IS NOT NULL;

ALTER TABLE public.restaurante_plano_historico ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.restaurante_plano_historico
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.restaurante_plano_historico_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.restaurante_plano_historico TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.restaurante_plano_historico_id_seq TO service_role;

GRANT SELECT, INSERT ON TABLE public.restaurante_plano_historico TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.restaurante_plano_historico_id_seq TO autenix_backend;

DROP POLICY IF EXISTS restaurante_plano_historico_backend_read_insert
ON public.restaurante_plano_historico;
CREATE POLICY restaurante_plano_historico_backend_read_insert
  ON public.restaurante_plano_historico FOR ALL TO autenix_backend
  USING (true) WITH CHECK (true);

