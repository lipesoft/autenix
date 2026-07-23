CREATE TABLE IF NOT EXISTS public.consentimentos_legais (
  id BIGSERIAL PRIMARY KEY,
  restaurante_id INTEGER,
  contexto TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'web',
  politica_versao TEXT NOT NULL,
  termos_versao TEXT,
  aceite_privacidade BOOLEAN NOT NULL DEFAULT FALSE,
  aceite_termos BOOLEAN NOT NULL DEFAULT FALSE,
  cookie_necessarios BOOLEAN NOT NULL DEFAULT TRUE,
  cookie_funcionais BOOLEAN NOT NULL DEFAULT FALSE,
  cookie_estatisticas BOOLEAN NOT NULL DEFAULT FALSE,
  cookie_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.consentimentos_legais
  DROP CONSTRAINT IF EXISTS consentimentos_legais_restaurante_fkey,
  DROP CONSTRAINT IF EXISTS consentimentos_legais_contexto_check,
  DROP CONSTRAINT IF EXISTS consentimentos_legais_origem_check,
  DROP CONSTRAINT IF EXISTS consentimentos_legais_politica_versao_check,
  DROP CONSTRAINT IF EXISTS consentimentos_legais_termos_versao_check,
  DROP CONSTRAINT IF EXISTS consentimentos_legais_ip_hash_check,
  DROP CONSTRAINT IF EXISTS consentimentos_legais_user_agent_hash_check,
  DROP CONSTRAINT IF EXISTS consentimentos_legais_metadados_check;

ALTER TABLE public.consentimentos_legais
  ADD CONSTRAINT consentimentos_legais_restaurante_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE SET NULL,
  ADD CONSTRAINT consentimentos_legais_contexto_check
    CHECK (contexto IN (
      'contato_comercial',
      'reserva_publica',
      'fila_publica',
      'preferencias_cookies'
    )),
  ADD CONSTRAINT consentimentos_legais_origem_check
    CHECK (origem IN ('web')),
  ADD CONSTRAINT consentimentos_legais_politica_versao_check
    CHECK (char_length(politica_versao) BETWEEN 1 AND 20),
  ADD CONSTRAINT consentimentos_legais_termos_versao_check
    CHECK (termos_versao IS NULL OR char_length(termos_versao) <= 20),
  ADD CONSTRAINT consentimentos_legais_ip_hash_check
    CHECK (ip_hash IS NULL OR ip_hash ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT consentimentos_legais_user_agent_hash_check
    CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT consentimentos_legais_metadados_check
    CHECK (jsonb_typeof(metadados) = 'object');

CREATE INDEX IF NOT EXISTS idx_consentimentos_legais_restaurante_criado
  ON public.consentimentos_legais (restaurante_id, criado_em DESC)
  WHERE restaurante_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consentimentos_legais_contexto_criado
  ON public.consentimentos_legais (contexto, criado_em DESC);

ALTER TABLE public.consentimentos_legais ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.consentimentos_legais
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.consentimentos_legais_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.consentimentos_legais TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.consentimentos_legais_id_seq TO service_role;

GRANT SELECT, INSERT ON TABLE public.consentimentos_legais TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.consentimentos_legais_id_seq TO autenix_backend;

DROP POLICY IF EXISTS consentimentos_legais_backend_read_insert
ON public.consentimentos_legais;
CREATE POLICY consentimentos_legais_backend_read_insert
  ON public.consentimentos_legais
  FOR SELECT TO autenix_backend
  USING (true);

DROP POLICY IF EXISTS consentimentos_legais_backend_insert
ON public.consentimentos_legais;
CREATE POLICY consentimentos_legais_backend_insert
  ON public.consentimentos_legais
  FOR INSERT TO autenix_backend
  WITH CHECK (true);
