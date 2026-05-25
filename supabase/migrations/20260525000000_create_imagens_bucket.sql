-- ============================================
-- CRIAÇÃO DO BUCKET: imagens e políticas de RLS
-- ============================================
-- Garante a existência do bucket 'imagens' e define políticas seguras.

-- Inserir o bucket na tabela de armazenamento
INSERT INTO storage.buckets (id, name, public) 
VALUES ('imagens', 'imagens', true) 
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para o bucket 'imagens'

-- 1. Leitura pública para qualquer pessoa (anon/autenticado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Anyone can view imagens' 
          AND tablename = 'objects' 
          AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Anyone can view imagens" ON storage.objects 
        FOR SELECT USING (bucket_id = 'imagens');
    END IF;
END
$$;

-- 2. Escrita (Upload) permitida apenas para usuários autenticados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Authenticated users can upload imagens' 
          AND tablename = 'objects' 
          AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Authenticated users can upload imagens" ON storage.objects 
        FOR INSERT WITH CHECK (bucket_id = 'imagens' AND auth.uid() IS NOT NULL);
    END IF;
END
$$;

-- 3. Atualização permitida apenas para usuários autenticados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Authenticated users can update imagens' 
          AND tablename = 'objects' 
          AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Authenticated users can update imagens" ON storage.objects 
        FOR UPDATE USING (bucket_id = 'imagens' AND auth.uid() IS NOT NULL);
    END IF;
END
$$;

-- 4. Exclusão permitida apenas para usuários autenticados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Authenticated users can delete imagens' 
          AND tablename = 'objects' 
          AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Authenticated users can delete imagens" ON storage.objects 
        FOR DELETE USING (bucket_id = 'imagens' AND auth.uid() IS NOT NULL);
    END IF;
END
$$;
