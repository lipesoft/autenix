DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
  ) THEN
    EXECUTE $sql$
      INSERT INTO storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
      VALUES (
        'autenix-assets',
        'autenix-assets',
        TRUE,
        3145728,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      )
      ON CONFLICT (id) DO UPDATE
      SET "public" = EXCLUDED."public",
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types
    $sql$;
  ELSE
    RAISE NOTICE 'Supabase Storage nao encontrado neste banco; bucket autenix-assets nao criado.';
  END IF;
END $$;
