-- ============================================
-- ADICIONAR COLUNA: foto_url na tabela alunos
-- ============================================
-- Adiciona a coluna foto_url para suportar fotos de alunos caso não exista.

ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS foto_url TEXT;
