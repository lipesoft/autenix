CREATE INDEX IF NOT EXISTS idx_reservas_mesa_restaurante_fk
  ON public.reservas (mesa_id, restaurante_id);

CREATE INDEX IF NOT EXISTS idx_reservas_salao_restaurante_fk
  ON public.reservas (salao_id, restaurante_id);

CREATE INDEX IF NOT EXISTS idx_reservas_eventos_reserva_restaurante_fk
  ON public.reservas_eventos (reserva_id, restaurante_id);

CREATE INDEX IF NOT EXISTS idx_reservas_eventos_usuario_restaurante_fk
  ON public.reservas_eventos (usuario_id, restaurante_id);

CREATE INDEX IF NOT EXISTS idx_sessoes_mesa_mesa_restaurante_fk
  ON public.sessoes_mesa (mesa_id, restaurante_id);

CREATE INDEX IF NOT EXISTS idx_sessoes_mesa_usuario_restaurante_fk
  ON public.sessoes_mesa (criado_por_usuario_id, restaurante_id);
