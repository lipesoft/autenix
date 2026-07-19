ALTER TABLE public.reservas_eventos
  DROP CONSTRAINT IF EXISTS reservas_eventos_tipo_check;

ALTER TABLE public.reservas_eventos
  ADD CONSTRAINT reservas_eventos_tipo_check
    CHECK (
      tipo IN (
        'criada',
        'status_alterado',
        'mesa_alterada',
        'compartilhamento',
        'notificacao_automatica'
      )
    );

CREATE TABLE IF NOT EXISTS public.reservas_notificacoes (
  id BIGSERIAL PRIMARY KEY,
  restaurante_id INTEGER NOT NULL,
  reserva_id INTEGER NOT NULL,
  canal TEXT NOT NULL,
  evento TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  assunto TEXT,
  mensagem TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  tentativas INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado_em TIMESTAMPTZ
);

ALTER TABLE public.reservas_notificacoes
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_reserva_fkey,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_restaurante_fkey,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_canal_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_evento_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_status_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_destinatario_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_assunto_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_mensagem_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_payload_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_provider_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_provider_message_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_tentativas_check,
  DROP CONSTRAINT IF EXISTS reservas_notificacoes_erro_check;

ALTER TABLE public.reservas_notificacoes
  ADD CONSTRAINT reservas_notificacoes_restaurante_fkey
    FOREIGN KEY (restaurante_id)
    REFERENCES public.restaurantes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT reservas_notificacoes_reserva_fkey
    FOREIGN KEY (reserva_id, restaurante_id)
    REFERENCES public.reservas(id, restaurante_id) ON DELETE CASCADE,
  ADD CONSTRAINT reservas_notificacoes_canal_check
    CHECK (canal IN ('whatsapp', 'email')),
  ADD CONSTRAINT reservas_notificacoes_evento_check
    CHECK (evento IN ('criada', 'confirmada', 'fila', 'chamada', 'cancelada', 'concluida')),
  ADD CONSTRAINT reservas_notificacoes_status_check
    CHECK (status IN ('pendente', 'enviado', 'erro', 'sem_provedor')),
  ADD CONSTRAINT reservas_notificacoes_destinatario_check
    CHECK (char_length(destinatario) BETWEEN 3 AND 180),
  ADD CONSTRAINT reservas_notificacoes_assunto_check
    CHECK (assunto IS NULL OR char_length(assunto) <= 160),
  ADD CONSTRAINT reservas_notificacoes_mensagem_check
    CHECK (char_length(mensagem) BETWEEN 10 AND 2000),
  ADD CONSTRAINT reservas_notificacoes_payload_check
    CHECK (jsonb_typeof(payload) = 'object'),
  ADD CONSTRAINT reservas_notificacoes_provider_check
    CHECK (provider IS NULL OR char_length(provider) <= 80),
  ADD CONSTRAINT reservas_notificacoes_provider_message_check
    CHECK (provider_message_id IS NULL OR char_length(provider_message_id) <= 180),
  ADD CONSTRAINT reservas_notificacoes_tentativas_check
    CHECK (tentativas >= 0),
  ADD CONSTRAINT reservas_notificacoes_erro_check
    CHECK (erro IS NULL OR char_length(erro) <= 500);

CREATE INDEX IF NOT EXISTS idx_reservas_notificacoes_reserva_criado
  ON public.reservas_notificacoes (restaurante_id, reserva_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_reservas_notificacoes_status_criado
  ON public.reservas_notificacoes (status, criado_em)
  WHERE status IN ('pendente', 'erro');

ALTER TABLE public.reservas_notificacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.reservas_notificacoes
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.reservas_notificacoes_id_seq
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.reservas_notificacoes TO service_role;
GRANT ALL PRIVILEGES ON SEQUENCE public.reservas_notificacoes_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservas_notificacoes TO autenix_backend;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.reservas_notificacoes_id_seq TO autenix_backend;

DROP POLICY IF EXISTS reservas_notificacoes_backend_crud ON public.reservas_notificacoes;
CREATE POLICY reservas_notificacoes_backend_crud
  ON public.reservas_notificacoes FOR ALL TO autenix_backend
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
