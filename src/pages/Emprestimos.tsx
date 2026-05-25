import { useEffect, useState } from "react";
import { ArrowLeftRight, Plus, Search, RotateCcw, CheckCircle2, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isAfter } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import ImageLightbox from "@/components/ImageLightbox";
import { syncOverdueLoans } from "@/hooks/useAutoUpdateOverdue";

type Emprestimo = Tables<"emprestimos">;
type Livro = Tables<"livros">;
type Aluno = Tables<"alunos">;

interface EmprestimoDisplay extends Emprestimo {
  aluno_nome: string;
  aluno_turma?: string;
  aluno_foto_url?: string;
  livro_titulo: string;
  livro_autor?: string;
  livro_genero?: string;
  livro_ano?: number;
  livro_editora?: string;
  livro_capa_url?: string;
  livro_isbn?: string;
}

const Emprestimos = () => {
  const [emprestimos, setEmprestimos] = useState<EmprestimoDisplay[]>([]);
  const [livros, setLivros] = useState<Livro[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ aluno_id: "", livro_id: "", dias: localStorage.getItem("bk_default_days") || "14" });
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [lightboxAlt, setLightboxAlt] = useState("");
  const { toast } = useToast();

  const openLightbox = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);

    // ✅ Sincronizar automaticamente empréstimos atrasados no banco
    await syncOverdueLoans();

    const [empRes, livrosRes, alunosRes] = await Promise.all([
      supabase.from("emprestimos").select("*").order("criado_em", { ascending: false }),
      supabase.from("livros").select("*").order("titulo"),
      supabase.from("alunos").select("*").order("nome"),
    ]);

    const livrosData = livrosRes.data || [];
    const alunosData = alunosRes.data || [];
    setLivros(livrosData);
    setAlunos(alunosData);

    const livrosMap = Object.fromEntries(livrosData.map(l => [l.id, l]));
    const alunosMap = Object.fromEntries(alunosData.map(a => [a.id, a]));

    const display: EmprestimoDisplay[] = (empRes.data || []).map(e => {
      const livro = livrosMap[e.livro_id];
      const aluno = alunosMap[e.aluno_id];
      return {
        ...e,
        aluno_nome: aluno?.nome || "Desconhecido",
        aluno_turma: aluno?.turma,
        aluno_foto_url: aluno?.foto_url,
        livro_titulo: livro?.titulo || "Desconhecido",
        livro_autor: livro?.autor,
        livro_genero: livro?.genero,
        livro_ano: livro?.ano_publicacao,
        livro_editora: livro?.editora,
        livro_capa_url: livro?.capa_url,
        livro_isbn: livro?.isbn,
      };
    });

    setEmprestimos(display);
    setLoading(false);
  };

  const getStatus = (e: Emprestimo) => {
    if (e.status === "devolvido") return "devolvido";
    if (e.status === "atrasado") return "atrasado";
    if (isAfter(new Date(), new Date(e.data_devolucao_prevista))) return "atrasado";
    return "ativo";
  };

  const handleCreate = async () => {
    if (!form.aluno_id || !form.livro_id) {
      toast({ title: "Selecione aluno e livro", variant: "destructive" });
      return;
    }

    setSaving(true);
    const now = new Date();
    const dueDate = addDays(now, parseInt(form.dias));

    const { error } = await supabase.from("emprestimos").insert({
      aluno_id: form.aluno_id,
      livro_id: form.livro_id,
      data_emprestimo: format(now, "yyyy-MM-dd"),
      data_devolucao_prevista: format(dueDate, "yyyy-MM-dd"),
      status: "ativo",
    });

    if (error) {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Empréstimo registrado!" });
    }

    setSaving(false);
    setDialogOpen(false);
    setForm({ aluno_id: "", livro_id: "", dias: localStorage.getItem("bk_default_days") || "14" });
    fetchAll();
  };

  const handleDevolver = async (id: string) => {
    const { error } = await supabase.from("emprestimos").update({
      status: "devolvido",
      data_devolucao_realizada: format(new Date(), "yyyy-MM-dd"),
    }).eq("id", id);

    if (error) {
      toast({ title: "Erro ao devolver", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "📚 Livro devolvido!" });
    }
    fetchAll();
  };

  const handleAtrasado = async (id: string) => {
    const { error } = await supabase.from("emprestimos").update({
      status: "atrasado",
    }).eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "⚠️ Marcado como atrasado!" });
    }
    fetchAll();
  };

  const filtered = emprestimos.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = e.aluno_nome.toLowerCase().includes(q) || e.livro_titulo.toLowerCase().includes(q);
    const realStatus = getStatus(e);
    if (tab === "todos") return matchSearch;
    return matchSearch && realStatus === tab;
  });

  const statusBadge = (e: Emprestimo) => {
    const status = getStatus(e);
    if (status === "devolvido") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Devolvido</Badge>;
    if (status === "atrasado") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Atrasado</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Ativo</Badge>;
  };

  const counts = {
    todos: emprestimos.length,
    ativo: emprestimos.filter(e => getStatus(e) === "ativo").length,
    devolvido: emprestimos.filter(e => getStatus(e) === "devolvido").length,
    atrasado: emprestimos.filter(e => getStatus(e) === "atrasado").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Empréstimos</h1>
        <Button onClick={() => setDialogOpen(true)} className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Novo Empréstimo
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="todos">Todos ({counts.todos})</TabsTrigger>
          <TabsTrigger value="ativo">Ativos ({counts.ativo})</TabsTrigger>
          <TabsTrigger value="devolvido">Devolvidos ({counts.devolvido})</TabsTrigger>
          <TabsTrigger value="atrasado">Atrasados ({counts.atrasado})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por aluno ou livro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ArrowLeftRight className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">
            {search || tab !== "todos" ? "Nenhum empréstimo encontrado" : "Nenhum empréstimo registrado"}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {search || tab !== "todos" ? "Tente outra busca ou filtro." : 'Clique em "Novo Empréstimo" para registrar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((emp) => {
            const realStatus = getStatus(emp);
            return (
              <Card key={emp.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {emp.livro_capa_url ? (
                      <img
                        src={emp.livro_capa_url}
                        alt={emp.livro_titulo}
                        className="w-16 h-24 object-cover rounded shadow-sm flex-shrink-0 clickable-image"
                        onClick={() => openLightbox(emp.livro_capa_url!, emp.livro_titulo)}
                      />
                    ) : (
                      <div className={`w-16 h-24 rounded flex items-center justify-center flex-shrink-0 shadow-sm ${realStatus === "ativo" ? "bg-blue-100" : realStatus === "atrasado" ? "bg-red-100" : "bg-emerald-100"}`}>
                        <ArrowLeftRight className={`h-6 w-6 ${realStatus === "ativo" ? "text-blue-600" : realStatus === "atrasado" ? "text-red-600" : "text-emerald-600"}`} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-foreground truncate text-base">{emp.livro_titulo}</p>
                        {statusBadge(emp)}
                      </div>
                      {emp.livro_autor && (
                        <p className="text-sm text-foreground/80 mb-2">Por {emp.livro_autor}</p>
                      )}

                      <div className="flex flex-col gap-1 text-xs mb-3">
                        <div className="break-words"><span className="text-muted-foreground font-medium">Ano:</span> {emp.livro_ano || "—"}</div>
                        <div className="break-words"><span className="text-muted-foreground font-medium">Gênero:</span> {emp.livro_genero || "—"}</div>
                        <div className="break-words"><span className="text-muted-foreground font-medium">Editora:</span> {emp.livro_editora || "—"}</div>
                        <div className="break-words"><span className="text-muted-foreground font-medium">ISBN:</span> {emp.livro_isbn || "—"}</div>
                      </div>

                      <div className="bg-muted/40 p-2.5 rounded-md mt-2 flex items-center gap-3 border border-border/50">
                        {emp.aluno_foto_url ? (
                          <img
                            src={emp.aluno_foto_url}
                            alt={emp.aluno_nome}
                            className="w-10 h-10 rounded-full object-cover shadow-sm bg-muted flex-shrink-0 clickable-image"
                            onClick={() => openLightbox(emp.aluno_foto_url!, emp.aluno_nome)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                            {emp.aluno_nome.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            Emprestado para: <span className="font-medium text-foreground">{emp.aluno_nome}</span>
                            {emp.aluno_turma && <span className="text-foreground/80"> — <span className="font-medium">Turma:</span> {emp.aluno_turma}</span>}
                          </p>
                          <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground mt-1">
                            <span><span className="font-medium">Data:</span> {format(new Date(emp.data_emprestimo), "dd/MM/yyyy")}</span>
                            <span>•</span>
                            <span><span className="font-medium">Devolução:</span> {format(new Date(emp.data_devolucao_prevista), "dd/MM/yyyy")}</span>
                          </div>
                          {emp.data_devolucao_realizada && (
                            <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="h-3 w-3" />
                              Devolvido em {format(new Date(emp.data_devolucao_realizada), "dd/MM/yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {realStatus !== "devolvido" && (
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={() => handleDevolver(emp.id)}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Devolver
                      </Button>

                      {realStatus === "ativo" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleAtrasado(emp.id)}
                        >
                          <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                          Atrasado
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Empréstimo Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent 
          className="w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Novo Empréstimo</DialogTitle>
            <DialogDescription>Selecione o aluno, livro e prazo de devolução.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Aluno *</Label>
              <Select value={form.aluno_id} onValueChange={(v) => setForm({ ...form, aluno_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aluno" />
                </SelectTrigger>
                <SelectContent>
                  {alunos.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.nome} — Turma {a.turma}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.aluno_id && (() => {
                const al = alunos.find(a => a.id === form.aluno_id);
                if (!al) return null;
                return (
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border mt-3">
                    {al.foto_url ? (
                      <img
                        src={al.foto_url}
                        alt={al.nome}
                        className="w-10 h-10 object-cover rounded-full shadow-sm clickable-image"
                        onClick={() => openLightbox(al.foto_url!, al.nome)}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 flex justify-center items-center rounded-full text-white font-bold">
                        {al.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{al.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium">Turma:</span> {al.turma}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label>Livro *</Label>
              <Select value={form.livro_id} onValueChange={(v) => setForm({ ...form, livro_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o livro" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const borrowedBookIds = new Set(
                      emprestimos
                        .filter(e => {
                          const status = getStatus(e);
                          return status === "ativo" || status === "atrasado";
                        })
                        .map(e => e.livro_id)
                    );

                    return livros.map(l => {
                      const isBorrowed = borrowedBookIds.has(l.id);
                      return (
                        <SelectItem key={l.id} value={l.id} disabled={isBorrowed}>
                          {l.titulo} — {l.autor} {isBorrowed ? "(Emprestado)" : ""}
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
              {form.livro_id && (() => {
                const bl = livros.find(l => l.id === form.livro_id);
                if (!bl) return null;
                return (
                  <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg border border-border mt-3">
                    {bl.capa_url ? (
                      <img
                        src={bl.capa_url}
                        alt={bl.titulo}
                        className="w-12 h-16 object-cover rounded shadow-sm clickable-image"
                        onClick={() => openLightbox(bl.capa_url!, bl.titulo)}
                      />
                    ) : (
                      <div className="w-12 h-16 bg-blue-100 flex justify-center items-center rounded text-blue-500">
                        <BookOpen size={20} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{bl.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium">Autor:</span> {bl.autor}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground mt-1">
                        <span><span className="font-medium">Ano:</span> {bl.ano_publicacao || "—"}</span>
                        <span>• <span className="font-medium">Gênero:</span> {bl.genero || "—"}</span>
                        <span>• <span className="font-medium">Ed:</span> {bl.editora || "—"}</span>
                        <span>• <span className="font-medium">ISBN:</span> {bl.isbn || "—"}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label>Prazo de devolução (dias)</Label>
              <Input
                type="number"
                min="1"
                value={form.dias}
                onChange={(e) => setForm({ ...form, dias: e.target.value })}
                className="max-w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Registrando..." : "Registrar Empréstimo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxUrl}
        alt={lightboxAlt}
        open={!!lightboxUrl}
        onClose={() => setLightboxUrl("")}
      />
    </div>
  );
};

export default Emprestimos;
