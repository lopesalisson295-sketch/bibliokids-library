-- ============================================
-- AUTOMAÇÃO: Atualizar empréstimos atrasados
-- ============================================
-- Esta migração cria uma função SQL que atualiza automaticamente
-- o status de empréstimos "ativo" para "atrasado" quando a data
-- de devolução prevista já passou.
--
-- A função é executada:
-- 1. Via pg_cron (se disponível) - automaticamente todos os dias à meia-noite
-- 2. Via chamada do frontend ao acessar páginas de empréstimos (fallback)

-- Criar a função que atualiza empréstimos atrasados
CREATE OR REPLACE FUNCTION public.atualizar_emprestimos_atrasados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.emprestimos
  SET status = 'atrasado'
  WHERE status = 'ativo'
    AND data_devolucao_prevista < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Dar permissão para usuários autenticados executarem a função
GRANT EXECUTE ON FUNCTION public.atualizar_emprestimos_atrasados() TO authenticated;

-- Tentar configurar o pg_cron para execução automática diária
-- (só funciona se a extensão pg_cron estiver habilitada no Supabase)
DO $$
BEGIN
  -- Verificar se pg_cron está disponível
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Agendar execução diária à meia-noite (UTC)
    PERFORM cron.schedule(
      'atualizar-emprestimos-atrasados',
      '0 0 * * *',
      'SELECT public.atualizar_emprestimos_atrasados()'
    );
    RAISE NOTICE 'pg_cron configurado: empréstimos serão atualizados automaticamente todo dia à meia-noite.';
  ELSE
    RAISE NOTICE 'pg_cron não disponível. A atualização automática será feita via frontend.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível configurar pg_cron: %. Usando fallback via frontend.', SQLERRM;
END;
$$;
