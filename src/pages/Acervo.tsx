import { useEffect, useState, useRef, useCallback } from "react";
import { BookOpen, Plus, Search, Pencil, Trash2, X, Image as ImageIcon, History, CheckCircle2, AlertTriangle, ArrowLeftRight, Users, Zap, RotateCcw, Loader2, ScanBarcode, ChevronRight, Package, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { uploadImage } from "@/utils/uploadImage";
import { format, isAfter } from "date-fns";
import ImageLightbox from "@/components/ImageLightbox";
import { searchBookByIsbn, searchBookByTitleAuthor, getSearchStats, cleanIsbnInput } from "@/services/bookSearchService";
import BarcodeScanner from "@/components/BarcodeScanner";

type Livro = Tables<"livros">;

const emptyForm = {
  titulo: "",
  autor: "",
  tradutor: "",
  editora: "",
  genero: "",
  isbn: "",
  ano_publicacao: "",
  capa_url: "",
};

const Acervo = () => {
  const [livros, setLivros] = useState<Livro[]>([]);
  const [borrowedBookIds, setBorrowedBookIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filterGenero, setFilterGenero] = useState("todos");
  const [filterAno, setFilterAno] = useState("todos");
  const [filterEditora, setFilterEditora] = useState("todos");
  const [fetchingIsbn, setFetchingIsbn] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyLivro, setHistoryLivro] = useState<Livro | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [lightboxAlt, setLightboxAlt] = useState("");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isProcessingScanner, setIsProcessingScanner] = useState(false);

  // ⚡ MODO METRALHADORA: Cadastro em série ultra-rápido
  const [turboMode, setTurboMode] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [searchProgress, setSearchProgress] = useState("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const isbnInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const openLightbox = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  };

  useEffect(() => {
    fetchLivros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLivros = async () => {
    setLoading(true);

    // Fetch books
    const { data: booksData, error: booksError } = await supabase
      .from("livros")
      .select("*")
      .order("criado_em", { ascending: false });

    // Fetch active loans to determine availability
    const { data: loansData, error: loansError } = await supabase
      .from("emprestimos")
      .select("livro_id, status")
      .neq("status", "devolvido");

    if (booksError) {
      toast({ title: "Erro ao buscar livros", description: booksError.message, variant: "destructive" });
    } else {
      setLivros(booksData || []);
    }

    if (!loansError && loansData) {
      const borrowedIds = new Set(loansData.map(l => l.livro_id));
      setBorrowedBookIds(borrowedIds);
    }

    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setSearchProgress("");
    setLastSavedTitle("");
    setDialogOpen(true);
    // Auto-focus no campo ISBN após abrir
    setTimeout(() => isbnInputRef.current?.focus(), 150);
  };

  // ⚡ Abrir em modo turbo (metralhadora)
  const openTurboDialog = () => {
    setTurboMode(true);
    setSessionCount(0);
    openCreateDialog();
  };

  const openEditDialog = (livro: Livro) => {
    setEditingId(livro.id);
    setImageFile(null);
    setForm({
      titulo: livro.titulo,
      autor: livro.autor,
      tradutor: livro.tradutor || "",
      editora: livro.editora || "",
      genero: livro.genero || "",
      isbn: livro.isbn || "",
      ano_publicacao: livro.ano_publicacao?.toString() || "",
      capa_url: livro.capa_url || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.autor.trim()) {
      toast({ title: "Preencha título e autor", variant: "destructive" });
      return;
    }

    setSaving(true);
    let capaUrlToSave = form.capa_url;

    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        capaUrlToSave = uploadedUrl;
      }
    }

    const payload = {
      titulo: form.titulo.trim(),
      autor: form.autor.trim(),
      tradutor: form.tradutor.trim() || null,
      editora: form.editora.trim() || null,
      genero: form.genero.trim() || null,
      isbn: form.isbn.trim() || null,
      ano_publicacao: form.ano_publicacao ? parseInt(form.ano_publicacao) : null,
      capa_url: capaUrlToSave || null,
    };

    if (editingId) {
      const { error } = await supabase.from("livros").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Livro atualizado!" });
      }
    } else {
      const { error } = await supabase.from("livros").insert(payload);
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Livro cadastrado!" });
      }
    }

    setSaving(false);

    // ⚡ MODO METRALHADORA: Limpa e prepara pro próximo
    if (turboMode && !editingId) {
      setLastSavedTitle(form.titulo);
      setSessionCount(prev => prev + 1);
      setForm(emptyForm);
      setImageFile(null);
      setSearchProgress("");
      // Re-focus no ISBN para escanear o próximo
      setTimeout(() => isbnInputRef.current?.focus(), 200);
    } else {
      setDialogOpen(false);
      if (turboMode) setTurboMode(false);
    }
    fetchLivros();
  };

  // ⚡ AUTO-SAVE: Salva automaticamente quando todos os dados estão completos
  const turboAutoSave = useCallback(async (bookForm: typeof emptyForm) => {
    if (!autoSaveEnabled || !turboMode || saving || editingId) return;
    // Só auto-save se tiver título, autor E capa (dados completos)
    if (!bookForm.titulo.trim() || !bookForm.autor.trim() || !bookForm.capa_url) return;

    setSaving(true);
    const payload = {
      titulo: bookForm.titulo.trim(),
      autor: bookForm.autor.trim(),
      tradutor: bookForm.tradutor.trim() || null,
      editora: bookForm.editora.trim() || null,
      genero: bookForm.genero.trim() || null,
      isbn: bookForm.isbn.trim() || null,
      ano_publicacao: bookForm.ano_publicacao ? parseInt(bookForm.ano_publicacao) : null,
      capa_url: bookForm.capa_url || null,
    };

    const { error } = await supabase.from("livros").insert(payload);
    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      setLastSavedTitle(bookForm.titulo);
      setSessionCount(prev => prev + 1);
      toast({ title: `⚡ Salvo automaticamente!`, description: `"${bookForm.titulo}" cadastrado. Escaneie o próximo!` });
    }
    setSaving(false);
    setForm(emptyForm);
    setImageFile(null);
    setSearchProgress("");
    setTimeout(() => isbnInputRef.current?.focus(), 200);
    fetchLivros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled, turboMode, saving, editingId, toast]);

  const closeCameraScanner = () => {
    setCameraScannerOpen(false);
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  };

  const openCameraScanner = async () => {
    // getUserMedia MUST be called in the direct click handler context (user gesture)
    // This is the ONLY way mobile browsers will show the permission prompt
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }
      });
      setCameraStream(stream);
      setCameraScannerOpen(true);
    } catch (err: any) {
      console.error("Camera permission error:", err);
      toast({
        title: "Acesso à câmera negado",
        description: "Vá nas configurações do navegador e permita o acesso à câmera para este site. No Chrome: toque nos 3 pontos (⋮) → Configurações do site → Câmera → Permitir.",
        variant: "destructive"
      });
    }
  };

  const handleBarcodeScanned = async (decodedText: string) => {
    const cleanedText = decodedText.trim();
    if (!cleanedText || isProcessingScanner) return;

    setIsProcessingScanner(true);
    setForm(prev => ({ ...prev, isbn: cleanedText }));
    
    if (!turboMode) {
      closeCameraScanner();
    }

    toast({
      title: "⚡ Código lido!",
      description: `ISBN ${cleanedText} capturado. Buscando dados do livro...`
    });

    try {
      await fetchBookByIsbn(cleanedText);
    } catch (err) {
      console.error("Erro na busca automática:", err);
    } finally {
      if (turboMode) {
        setTimeout(() => {
          setIsProcessingScanner(false);
        }, 2000);
      } else {
        setIsProcessingScanner(false);
      }
    }
  };

  // Auto-fetch quando escaneia o ISBN (10 ou 13 digitos)
  useEffect(() => {
    const cleanIsbn = form.isbn.replace(/[^0-9X]/gi, "");
    if ((cleanIsbn.length === 13 || cleanIsbn.length === 10) && !fetchingIsbn && !form.titulo) {
      const timer = setTimeout(() => {
        fetchBookByIsbn(cleanIsbn);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.isbn]);

  const fetchBookByIsbn = async (isbnToFetch?: string) => {
    const targetIsbn = isbnToFetch || form.isbn;
    if (!targetIsbn) return;

    setFetchingIsbn(true);
    setSearchProgress("Preparando busca...");
    try {
      const clean = cleanIsbnInput(targetIsbn);
      if (clean.length !== 10 && clean.length !== 13) {
        toast({ title: "ISBN inválido", description: "O ISBN deve ter 10 ou 13 dígitos.", variant: "destructive" });
        return;
      }

      // Busca completa via serviço (cache + 7 APIs em paralelo)
      const result = await searchBookByIsbn(targetIsbn, setSearchProgress);

      if (result) {
        setForm(prev => ({
          ...prev,
          titulo: result.titulo || prev.titulo,
          autor: result.autor || prev.autor,
          tradutor: result.tradutor || prev.tradutor,
          editora: result.editora || prev.editora,
          ano_publicacao: result.ano || prev.ano_publicacao,
          genero: result.genero || prev.genero,
          capa_url: result.capa_url || prev.capa_url,
          isbn: result.isbn,
        }));

        const { found, missing } = getSearchStats(result);
        const correctedMsg = result.isbn !== clean ? "\n📝 ISBN corrigido automaticamente." : "";

        if (missing.length === 0) {
          toast({ title: "✅ Dados completos!", description: `Todos os 6 campos preenchidos. Fonte: ${result.fonte}${correctedMsg}` });
          // ⚡ AUTO-SAVE no modo turbo quando dados completos
          if (turboMode && autoSaveEnabled) {
            const autoForm = {
              ...emptyForm,
              titulo: result.titulo,
              autor: result.autor,
              tradutor: result.tradutor,
              editora: result.editora,
              ano_publicacao: result.ano,
              genero: result.genero,
              capa_url: result.capa_url,
              isbn: result.isbn,
            };
            setTimeout(() => turboAutoSave(autoForm), 500);
          }
        } else if (missing.length <= 2) {
          toast({ title: "✅ Quase tudo encontrado!", description: `Faltou: ${missing.join(", ")}. Preencha manualmente.${correctedMsg}` });
        } else {
          toast({ title: "⚠️ Dados parciais", description: `Encontrado: ${found.join(", ")}.\nFaltou: ${missing.join(", ")}.${correctedMsg}` });
        }
      } else {
        toast({ title: "❌ Livro não encontrado", description: "Nenhuma base reconheceu este ISBN. Verifique o número ou preencha manualmente.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro na busca", description: "Ocorreu um erro inesperado ao buscar dados. Tente novamente.", variant: "destructive" });
    } finally {
      setFetchingIsbn(false);
      setSearchProgress("");
    }
  };

  const fetchBookByTitleAndAuthor = async () => {
    if (!form.titulo.trim() && !form.autor.trim()) {
      toast({ title: "Preencha o título ou autor", description: "Digite pelo menos o título ou o autor.", variant: "destructive" });
      return;
    }

    setFetchingIsbn(true);
    setSearchProgress("Buscando por título/autor...");
    try {
      const result = await searchBookByTitleAuthor(form.titulo, form.autor, setSearchProgress);

      if (result) {
        setForm(prev => ({
          ...prev,
          titulo: result.titulo || prev.titulo,
          autor: result.autor || prev.autor,
          editora: result.editora || prev.editora,
          ano_publicacao: result.ano || prev.ano_publicacao,
          capa_url: result.capa_url || prev.capa_url,
          genero: result.genero || prev.genero,
          isbn: result.isbn || prev.isbn,
        }));
        toast({ title: "✅ Busca concluída", description: "Dados adicionais preenchidos com sucesso." });
      } else {
        toast({ title: "Sem resultados", description: "Não encontramos nenhum dado com esse título e/ou autor nas bases.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro na busca", description: "Ocorreu um erro inesperado ao buscar dados adicionais.", variant: "destructive" });
    } finally {
      setFetchingIsbn(false);
      setSearchProgress("");
    }
  };


  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("livros").delete().eq("id", deletingId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "🗑️ Livro excluído!" });
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
    fetchLivros();
  };

  const filtered = livros.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = l.titulo.toLowerCase().includes(q) ||
      l.autor.toLowerCase().includes(q) ||
      (l.genero || "").toLowerCase().includes(q);

    const matchGenero = filterGenero === "todos" || l.genero === filterGenero;
    const matchAno = filterAno === "todos" || String(l.ano_publicacao) === filterAno;
    const matchEditora = filterEditora === "todos" || l.editora === filterEditora;

    return matchSearch && matchGenero && matchAno && matchEditora;
  });

  const openHistoryDialog = async (livro: Livro) => {
    setHistoryLivro(livro);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);

    const { data: emprestimos } = await supabase
      .from("emprestimos")
      .select("*")
      .eq("livro_id", livro.id)
      .order("data_emprestimo", { ascending: false });

    if (emprestimos && emprestimos.length > 0) {
      const alunoIds = [...new Set(emprestimos.map(e => e.aluno_id))];
      const { data: alunos } = await supabase
        .from("alunos")
        .select("*")
        .in("id", alunoIds);

      const alunosMap = Object.fromEntries((alunos || []).map(a => [a.id, a]));
      const now = new Date();

      const enriched = emprestimos.map(e => {
        const aluno = alunosMap[e.aluno_id];
        let realStatus = e.status;
        if (realStatus !== "devolvido" && isAfter(now, new Date(e.data_devolucao_prevista))) {
          realStatus = "atrasado";
        }
        return {
          ...e,
          aluno_nome: aluno?.nome || "Desconhecido",
          aluno_turma: aluno?.turma || "",
          aluno_foto_url: aluno?.foto_url || "",
          realStatus,
        };
      });

      setHistoryData(enriched);
    } else {
      setHistoryData([]);
    }

    setHistoryLoading(false);
  };

  const uniqueGeneros = [...new Set(livros.map(l => l.genero).filter(Boolean))].sort();
  const uniqueAnos = [...new Set(livros.map(l => l.ano_publicacao).filter(Boolean))].sort();
  const uniqueEditoras = [...new Set(livros.map(l => l.editora).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Acervo</h1>
        <div className="flex gap-2">
          <Button onClick={openTurboDialog} variant="outline" className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 shadow-sm">
            <Zap className="mr-2 h-4 w-4" /> Modo Turbo
          </Button>
          <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Cadastrar Livro
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, autor ou gênero..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Gênero</Label>
            <Select value={filterGenero} onValueChange={setFilterGenero}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os gêneros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os gêneros</SelectItem>
                {uniqueGeneros.map(g => (
                  <SelectItem key={g as string} value={g as string}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os anos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                {uniqueAnos.map(a => (
                  <SelectItem key={String(a)} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Editora</Label>
            <Select value={filterEditora} onValueChange={setFilterEditora}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as editoras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as editoras</SelectItem>
                {uniqueEditoras.map(e => (
                  <SelectItem key={e as string} value={e as string}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">
            {search ? "Nenhum livro encontrado" : "Nenhum livro cadastrado ainda"}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? "Tente outra busca." : 'Clique em "Cadastrar Livro" para começar.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((livro) => {
            const isBorrowed = borrowedBookIds.has(livro.id);

            return (
              <Card key={livro.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group relative">
                <div className="absolute top-2 right-2 z-10">
                  {isBorrowed ? (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 shadow-sm border border-red-200 cursor-default px-2 py-0.5 font-medium">Emprestado</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-sm border border-emerald-200 cursor-default px-2 py-0.5 font-medium">Disponível</Badge>
                  )}
                </div>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mt-2">
                    <div className="flex gap-3 sm:gap-4 min-w-0 flex-1 w-full">
                      {livro.capa_url ? (
                        <img
                          src={livro.capa_url}
                          alt={livro.titulo}
                          className="w-16 h-24 object-cover rounded shadow-sm flex-shrink-0 clickable-image"
                          onClick={() => openLightbox(livro.capa_url!, livro.titulo)}
                        />
                      ) : (
                        <div className="w-16 h-24 bg-primary/10 flex items-center justify-center rounded shadow-sm flex-shrink-0">
                          <BookOpen className="h-8 w-8 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-2">{livro.titulo}</h3>
                        <p className="text-sm text-foreground/80 mt-1 leading-snug break-words"><span className="text-muted-foreground">Autor:</span> {livro.autor}</p>

                        <div className="flex flex-col gap-1.5 mt-3 bg-muted/30 p-2.5 rounded text-xs">
                          {livro.tradutor && (
                            <p className="break-words"><span className="text-muted-foreground font-medium">Tradutor:</span> {livro.tradutor}</p>
                          )}
                          <p className="break-words"><span className="text-muted-foreground font-medium">Gênero:</span> {livro.genero || "—"}</p>
                          <p className="break-words"><span className="text-muted-foreground font-medium">Ano:</span> {livro.ano_publicacao || "—"}</p>
                          <p className="break-words"><span className="text-muted-foreground font-medium">Editora:</span> {livro.editora || "—"}</p>
                          <p className="break-words"><span className="text-muted-foreground font-medium">ISBN:</span> {livro.isbn || "—"}</p>
                        </div>
                      </div>
                    </div>
                    {/* Botões de Ação Adaptados para Mobile */}
                    <div className="flex sm:flex-col gap-1 self-end sm:self-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-slate-100/60 dark:bg-slate-900/60 p-1 sm:p-0 rounded-lg border sm:border-0 border-border/40 w-full sm:w-auto justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" onClick={() => openHistoryDialog(livro)} title="Histórico de empréstimos">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" onClick={() => openEditDialog(livro)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => { setDeletingId(livro.id); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) { setTurboMode(false); setSearchProgress(""); }
      }}>
        <DialogContent 
          className="w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {turboMode && <Zap className="h-5 w-5 text-amber-500" />}
              {editingId ? "Editar Livro" : turboMode ? "Cadastro Turbo" : "Cadastrar Livro"}
              {turboMode && sessionCount > 0 && (
                <Badge className="bg-green-100 text-green-800 border-green-200 ml-2">
                  <Package className="h-3 w-3 mr-1" /> {sessionCount} cadastrado{sessionCount > 1 ? "s" : ""}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize as informações do livro." :
                turboMode ? "Escaneie o ISBN → dados preenchidos → salvo automaticamente! 🔄" :
                "Preencha os dados do novo livro."}
            </DialogDescription>
          </DialogHeader>

          {/* ⚡ Banner do último livro salvo (modo turbo) */}
          {turboMode && lastSavedTitle && (
            <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-green-800 truncate">
                <strong>Salvo:</strong> {lastSavedTitle}
              </span>
              <ChevronRight className="h-4 w-4 text-green-400 shrink-0" />
              <span className="text-green-600 text-xs whitespace-nowrap">Próximo →</span>
            </div>
          )}

          <div className="space-y-4">

            {/* Auto Fetch por ISBN — SEÇÃO PRINCIPAL */}
            <div className={`space-y-2 p-3.5 rounded-lg border ${turboMode ? 'bg-amber-50/60 border-amber-200' : 'bg-blue-50/50 border-blue-100'}`}>
              <Label htmlFor="isbn" className={`font-semibold flex items-center gap-1.5 ${turboMode ? 'text-amber-800' : 'text-blue-800'}`}>
                <ScanBarcode className="h-4 w-4" /> {turboMode ? "⚡ Escaneie o ISBN" : "Busca Rápida por ISBN"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="isbn"
                  ref={isbnInputRef}
                  value={form.isbn}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      fetchBookByIsbn(form.isbn);
                    }
                  }}
                  className={`bg-white ${turboMode ? 'border-amber-300 focus-visible:ring-amber-500 text-lg font-mono' : 'border-blue-200 focus-visible:ring-blue-500'}`}
                  placeholder={turboMode ? "Aponte o leitor aqui..." : "Escaneie o código de barras ou digite..."}
                  autoFocus={!editingId}
                />
                <Button
                  type="button"
                  variant="outline"
                  className={`shrink-0 border shadow-sm h-10 w-10 p-0 ${turboMode ? 'border-amber-250 bg-amber-50 hover:bg-amber-100 text-amber-700' : 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700'}`}
                  onClick={openCameraScanner}
                  title="Escanear com a câmera do celular"
                >
                  <Camera className="h-4.5 w-4.5" />
                </Button>
                <Button
                  type="button"
                  className={`shrink-0 shadow-sm ${turboMode ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  onClick={() => fetchBookByIsbn()}
                  disabled={fetchingIsbn || !form.isbn}
                >
                  {fetchingIsbn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>

              {/* Indicador de progresso animado */}
              {searchProgress && (
                <div className="flex items-center gap-2 text-xs text-blue-700 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{searchProgress}</span>
                </div>
              )}

              {/* Toggle auto-save (modo turbo) */}
              {turboMode && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-amber-700/80 leading-tight">
                    {autoSaveEnabled ? "Auto-save ativado: dados completos = salvo!" : "Auto-save desativado."}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                  >
                    {autoSaveEnabled ? "Desativar" : "Ativar"} auto-save
                  </Button>
                </div>
              )}
              {!turboMode && (
                <p className="text-[11px] text-blue-600/80 leading-tight">
                  Dica: Use um leitor de código de barras físico. O sistema detecta e preenche tudo sozinho!
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Capa do Livro</Label>
              <div className="flex items-center gap-4">
                {imageFile || form.capa_url ? (
                  <div className="relative w-16 h-24 border rounded shadow-sm overflow-hidden flex-shrink-0">
                    <img
                      src={imageFile ? URL.createObjectURL(imageFile) : form.capa_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => { setImageFile(null); setForm({ ...form, capa_url: "" }); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-16 h-24 bg-muted flex flex-col items-center justify-center rounded border border-dashed flex-shrink-0 text-muted-foreground">
                    <ImageIcon className="h-6 w-6 mb-1" />
                    <span className="text-[10px]">Sem Capa</span>
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImageFile(file);
                  }}
                />
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-xl border border-border/60 bg-slate-50/50 shadow-sm relative">
              <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1 rounded-bl-lg rounded-tr-xl border-b border-l border-border/60 text-[10px] font-medium text-slate-500">
                Sem ISBN?
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="titulo" className="text-slate-800">Título *</Label>
                <Input id="titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Nome do livro" className="bg-white" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="autor" className="text-slate-800">Autor *</Label>
                  <Input id="autor" value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} placeholder="Nome do autor" className="bg-white" />
                </div>
                <div className="space-y-2 flex items-end">
                  <Button 
                    type="button" 
                    className="w-full bg-slate-700 hover:bg-slate-800 text-white shadow"
                    onClick={fetchBookByTitleAndAuthor}
                    disabled={fetchingIsbn || (!form.titulo && !form.autor)}
                  >
                    <Search className="mr-2 h-4 w-4" /> {fetchingIsbn ? "Buscando..." : "Buscar Título/Autor"}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tradutor">Tradutor</Label>
                <Input id="tradutor" value={form.tradutor} onChange={(e) => setForm({ ...form, tradutor: e.target.value })} placeholder="Nome do tradutor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editora">Editora</Label>
                <Input id="editora" value={form.editora} onChange={(e) => setForm({ ...form, editora: e.target.value })} placeholder="Editora" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="genero">Gênero</Label>
                <Input id="genero" value={form.genero} onChange={(e) => setForm({ ...form, genero: e.target.value })} placeholder="Ex: Aventura" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ano">Ano de Publicação</Label>
                <Input id="ano" type="number" value={form.ano_publicacao} onChange={(e) => setForm({ ...form, ano_publicacao: e.target.value })} placeholder="Ex: 2024" />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {turboMode ? (
              <>
                <Button variant="outline" onClick={() => { setDialogOpen(false); setTurboMode(false); }}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar ({sessionCount})
                </Button>
                <Button onClick={handleSave} disabled={saving || !form.titulo.trim()} className="bg-amber-600 hover:bg-amber-700">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                  {saving ? "Salvando..." : "Salvar e Próximo"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-5">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir livro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O livro será removido permanentemente do acervo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico do Livro
            </DialogTitle>
            <DialogDescription>
              {historyLivro && (
                <span className="flex items-center gap-2 mt-1">
                  {historyLivro.capa_url ? (
                    <img src={historyLivro.capa_url} alt={historyLivro.titulo} className="w-6 h-8 object-cover rounded" />
                  ) : (
                    <div className="w-6 h-8 bg-primary/10 flex items-center justify-center rounded">
                      <BookOpen className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <span className="font-medium text-foreground">{historyLivro.titulo}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Este livro ainda não foi emprestado.</p>
            </div>
          ) : (
            <>
              {/* Counters */}
              <div className="flex gap-3 mb-4">
                <Badge variant="outline" className="text-xs">
                  {historyData.length} empréstimo{historyData.length !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {new Set(historyData.map(e => e.aluno_id)).size} aluno{new Set(historyData.map(e => e.aluno_id)).size !== 1 ? "s" : ""}
                </Badge>
                {historyData.filter(e => e.realStatus === "ativo" || e.realStatus === "atrasado").length > 0 && (
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                    {historyData.filter(e => e.realStatus === "ativo" || e.realStatus === "atrasado").length} em aberto
                  </Badge>
                )}
              </div>

              {/* List */}
              <div className="space-y-3">
                {historyData.map((emp) => {
                  const StatusIcon = emp.realStatus === "devolvido" ? CheckCircle2 : emp.realStatus === "atrasado" ? AlertTriangle : ArrowLeftRight;
                  const statusColor = emp.realStatus === "devolvido" ? "text-emerald-500" : emp.realStatus === "atrasado" ? "text-red-500" : "text-blue-500";
                  const statusBg = emp.realStatus === "devolvido" ? "bg-emerald-50" : emp.realStatus === "atrasado" ? "bg-red-50" : "bg-blue-50";
                  const statusLabel = emp.realStatus === "devolvido" ? "Devolvido" : emp.realStatus === "atrasado" ? "Atrasado" : "Ativo";

                  return (
                    <div key={emp.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors">
                      <div className={`mt-0.5 p-1.5 rounded-md flex-shrink-0 ${statusBg}`}>
                        <StatusIcon className={`h-3.5 w-3.5 ${statusColor}`} />
                      </div>
                      {emp.aluno_foto_url ? (
                        <img src={emp.aluno_foto_url} alt={emp.aluno_nome} className="w-8 h-8 rounded-full object-cover shadow-sm flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0">
                          {emp.aluno_nome.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{emp.aluno_nome}</p>
                        {emp.aluno_turma && <p className="text-[11px] text-muted-foreground">Turma {emp.aluno_turma}</p>}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            <span className="font-medium">Empréstimo:</span> {format(new Date(emp.data_emprestimo), "dd/MM/yyyy")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] text-muted-foreground">
                            <span className="font-medium">Devolução:</span> {format(new Date(emp.data_devolucao_prevista), "dd/MM/yyyy")}
                          </span>
                        </div>
                        {emp.data_devolucao_realizada && (
                          <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            Devolvido em {format(new Date(emp.data_devolucao_realizada), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                      <Badge className={`text-[10px] flex-shrink-0 ${emp.realStatus === "devolvido" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : emp.realStatus === "atrasado" ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-blue-100 text-blue-700 hover:bg-blue-100"}`}>
                        {statusLabel}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxUrl}
        alt={lightboxAlt}
        open={!!lightboxUrl}
        onClose={() => setLightboxUrl("")}
      />

      {/* Overlay para o Leitor de Câmera (Barcode Scanner) */}
      {cameraScannerOpen && cameraStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <BarcodeScanner 
            stream={cameraStream}
            onScanSuccess={handleBarcodeScanned}
            onClose={closeCameraScanner}
            isProcessing={isProcessingScanner}
          />
        </div>
      )}
    </div>
  );
};

export default Acervo;
