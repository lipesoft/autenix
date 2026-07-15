CREATE INDEX IF NOT EXISTS idx_produtos_categoria_restaurante
  ON public.produtos (categoria_id, restaurante_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_restaurante
  ON public.pedidos (mesa_id, restaurante_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido_restaurante
  ON public.itens_pedido (pedido_id, restaurante_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto_restaurante
  ON public.itens_pedido (produto_id, restaurante_id);
CREATE INDEX IF NOT EXISTS idx_chamadas_mesa_restaurante
  ON public.chamadas (mesa_id, restaurante_id);
