

# BiblioKids — Sistema de Gestão de Bibliotecas Infantis 📚

## Visão Geral
Um sistema web completo para gerenciar bibliotecas de escolas infantis, com gestão de acervo, empréstimos, alunos e relatórios. Design com paleta quente (amarelo/amber como cor primária), fonte Inter, e experiência mobile-first.

---

## 1. Design System e Tema
- Cor primária: amber-500/600 para botões e destaques
- Fundo: gray-100, textos: gray-800, cards: bg-white com shadow-sm
- Fonte Inter importada via Google Fonts
- Variáveis CSS customizadas atualizadas para refletir a paleta quente

## 2. Autenticação (Supabase Auth)
- Página de login na rota raiz (`/`) com logo "BiblioKids" em amber-600
- Formulário "Acesso para Funcionários" com campos Email e Senha
- Botão "Entrar" em amber-500, redirecionamento para `/dashboard` após login
- Proteção de rotas autenticadas

## 3. Layout Principal (Dashboard)
- **Header fixo**: logo "BiblioKids" à esquerda, saudação "Olá, [Nome]!" à direita
- **Sidebar** (w-64, bg-white, shadow-md) com itens de menu:
  - Acervo (BookOpen), Empréstimos (ArrowLeftRight), Alunos (Users), Relatórios (BarChartHorizontal), Configurações (Settings)
  - Hover e estado ativo com destaque visual
  - Responsiva: colapsa em mobile com trigger visível

## 4. Dashboard (`/dashboard`)
- Grid de cards informativos (1 col mobile, 3 cols desktop):
  - Total de Livros (ícone amber), Empréstimos Ativos (ícone azul), Livros Atrasados (ícone vermelho)
- Dados carregados do Supabase com skeleton loaders

## 5. Gestão de Acervo (`/acervo`)
- Tabela de livros cadastrados com busca/filtro
- Botão "Cadastrar Livro" abre modal (Dialog) com:
  - Campos: Título, Autor, ISBN, Editora, Ano, Gênero
  - Upload de imagem da capa (Supabase Storage)
  - Botões Cancelar e Salvar
- Empty state amigável quando sem livros
- Edição e exclusão de livros existentes

## 6. Gestão de Alunos (`/alunos`)
- Listagem de alunos com nome e turma
- Cadastro de novos alunos via modal
- Busca por nome/turma

## 7. Empréstimos (`/emprestimos`)
- Tabela com: Título do Livro, Nome do Aluno, Data Empréstimo, Devolução Prevista, Status
- Badges visuais: "Em dia" (verde), "Atrasado" (vermelho), "Devolvido" (cinza)
- Botão "Registrar Devolução" por empréstimo ativo
- Botão "Novo Empréstimo" abre fluxo de seleção de livro + aluno

## 8. Backend (Supabase / Lovable Cloud)
- **Tabela `livros`**: id, titulo, autor, isbn (unique), editora, ano_publicacao, genero, capa_url, criado_em
- **Tabela `alunos`**: id, nome, turma, qr_code_url, criado_em
- **Tabela `emprestimos`**: id, livro_id (FK), aluno_id (FK), data_emprestimo, data_devolucao_prevista, data_devolucao_realizada, status
- **Storage bucket** `capas` para imagens de capa
- **RLS** habilitado em todas as tabelas (acesso apenas para usuários autenticados)

## 9. Feedback e UX
- Toasts de sucesso ("✅ Livro cadastrado com sucesso!") e erro ("❌ Erro ao processar.")
- Skeleton loaders durante carregamento de dados
- Design mobile-first responsivo (375px+)
- Transições suaves em hovers e interações

