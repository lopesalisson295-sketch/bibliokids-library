
-- Create livros table
CREATE TABLE public.livros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  autor TEXT NOT NULL,
  isbn TEXT UNIQUE,
  editora TEXT,
  ano_publicacao INTEGER,
  genero TEXT,
  capa_url TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create alunos table
CREATE TABLE public.alunos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  turma TEXT NOT NULL,
  qr_code_url TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create emprestimos table
CREATE TABLE public.emprestimos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  livro_id UUID NOT NULL REFERENCES public.livros(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  data_emprestimo TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_devolucao_prevista TIMESTAMP WITH TIME ZONE NOT NULL,
  data_devolucao_realizada TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'ativo',
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.livros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emprestimos ENABLE ROW LEVEL SECURITY;

-- RLS policies for livros (authenticated users only)
CREATE POLICY "Authenticated users can view livros" ON public.livros FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert livros" ON public.livros FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update livros" ON public.livros FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete livros" ON public.livros FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for alunos
CREATE POLICY "Authenticated users can view alunos" ON public.alunos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert alunos" ON public.alunos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update alunos" ON public.alunos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete alunos" ON public.alunos FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for emprestimos
CREATE POLICY "Authenticated users can view emprestimos" ON public.emprestimos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert emprestimos" ON public.emprestimos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update emprestimos" ON public.emprestimos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete emprestimos" ON public.emprestimos FOR DELETE USING (auth.uid() IS NOT NULL);

-- Storage bucket for book covers
INSERT INTO storage.buckets (id, name, public) VALUES ('capas', 'capas', true);

CREATE POLICY "Anyone can view capas" ON storage.objects FOR SELECT USING (bucket_id = 'capas');
CREATE POLICY "Authenticated users can upload capas" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'capas' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update capas" ON storage.objects FOR UPDATE USING (bucket_id = 'capas' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete capas" ON storage.objects FOR DELETE USING (bucket_id = 'capas' AND auth.uid() IS NOT NULL);
