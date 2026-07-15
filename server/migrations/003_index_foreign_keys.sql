DROP INDEX IF EXISTS public.idx_produtos_disponivel_categoria;

CREATE INDEX IF NOT EXISTS idx_produtos_categoria_disponivel
  ON public.produtos (categoria_id, disponivel);

CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto_id
  ON public.itens_pedido (produto_id);
