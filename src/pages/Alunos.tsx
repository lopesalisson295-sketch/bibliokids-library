import { useEffect, useState } from "react";
import { Users, Plus, Search, Pencil, Trash2, X, Image as ImageIcon, History, BookOpen, CheckCircle2, AlertTriangle, ArrowLeftRight } from "lucide-react";
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

type Aluno = Tables<"alunos">;

const emptyForm = { nome: "", turma: "", foto_url: "" };

const Alunos = () => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filterTurma, setFilterTurma] = useState("todas");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyAluno, setHistoryAluno] = useState<Aluno | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [lightboxAlt, setLightboxAlt] = useState("");
  const { toast } = useToast();

  const openLightbox = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  };

  useEffect(() => {
    fetchAlunos();
  }, []);

  const fetchAlunos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("alunos")
      .select("*")
      .order("nome", { ascending: true });

    if (error) {
      toast({ title: "Erro ao buscar alunos", description: error.message, variant: "destructive" });
    } else {
      setAlunos(data || []);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setDialogOpen(true);
  };

  const openEditDialog = (aluno: Aluno) => {
    setEditingId(aluno.id);
    setImageFile(null);
    setForm({ nome: aluno.nome, turma: aluno.turma, foto_url: aluno.foto_url || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.turma.trim()) {
      toast({ title: "Preencha nome e turma", variant: "destructive" });
      return;
    }

    setSaving(true);
    let fotoUrlToSave = form.foto_url;

    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        fotoUrlToSave = uploadedUrl;
      }
    }

    const payload = {
      nome: form.nome.trim(),
      turma: form.turma.trim(),
      foto_url: fotoUrlToSave || null
    };

    if (editingId) {
      const { error } = await supabase.from("alunos").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Aluno atualizado!" });
      }
    } else {
      const { error } = await supabase.from("alunos").insert(payload);
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Aluno cadastrado!" });
      }
    }

    setSaving(false);
    setDialogOpen(false);
    fetchAlunos();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("alunos").delete().eq("id", deletingId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "🗑️ Aluno excluído!" });
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
    fetchAlunos();
  };

  const allTurmas = [...new Set(alunos.map(a => a.turma))].sort();

  const filtered = alunos.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = a.nome.toLowerCase().includes(q) || a.turma.toLowerCase().includes(q);
    const matchTurma = filterTurma === "todas" || a.turma === filterTurma;
    return matchSearch && matchTurma;
  });

  const openHistoryDialog = async (aluno: Aluno) => {
    setHistoryAluno(aluno);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);

    const { data: emprestimos } = await supabase
      .from("emprestimos")
      .select("*")
      .eq("aluno_id", aluno.id)
      .order("data_emprestimo", { ascending: false });

    if (emprestimos && emprestimos.length > 0) {
      const livroIds = [...new Set(emprestimos.map(e => e.livro_id))];
      const { data: livros } = await supabase
        .from("livros")
        .select("*")
        .in("id", livroIds);

      const livrosMap = Object.fromEntries((livros || []).map(l => [l.id, l]));
      const now = new Date();

      const enriched = emprestimos.map(e => {
        const livro = livrosMap[e.livro_id];
        let realStatus = e.status;
        if (realStatus !== "devolvido" && isAfter(now, new Date(e.data_devolucao_prevista))) {
          realStatus = "atrasado";
        }
        return {
          ...e,
          livro_titulo: livro?.titulo || "Desconhecido",
          livro_autor: livro?.autor || "",
          livro_capa_url: livro?.capa_url || "",
          realStatus,
        };
      });

      setHistoryData(enriched);
    } else {
      setHistoryData([]);
    }

    setHistoryLoading(false);
  };

  // Group by turma
  const turmas = [...new Set(filtered.map(a => a.turma))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Alunos</h1>
        <Button onClick={openCreateDialog} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Cadastrar Aluno
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou turma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="w-full sm:w-64">
          <Select value={filterTurma} onValueChange={setFilterTurma}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as turmas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as turmas</SelectItem>
              {allTurmas.map(t => (
                <SelectItem key={t} value={t}>Turma {t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      {!loading && alunos.length > 0 && (
        <div className="flex gap-4 text-sm">
          <Badge variant="outline">{alunos.length} alunos</Badge>
          <Badge variant="outline">{new Set(alunos.map(a => a.turma)).size} turmas</Badge>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">
            {search ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado ainda"}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? "Tente outra busca." : 'Clique em "Cadastrar Aluno" para começar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {turmas.map(turma => (
            <div key={turma}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Turma {turma}
                <Badge variant="secondary" className="text-xs ml-1">{filtered.filter(a => a.turma === turma).length}</Badge>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.filter(a => a.turma === turma).map(aluno => (
                  <Card key={aluno.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-200 group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {aluno.foto_url ? (
                          <img
                            src={aluno.foto_url}
                            alt={aluno.nome}
                            className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0 clickable-image"
                            onClick={() => openLightbox(aluno.foto_url!, aluno.nome)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {aluno.nome.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{aluno.nome}</p>
                          <p className="text-xs text-muted-foreground">Turma {aluno.turma}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-slate-100/60 dark:bg-slate-900/60 p-1 md:p-0 rounded-lg border md:border-0 border-border/40 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" onClick={() => openHistoryDialog(aluno)} title="Histórico de empréstimos">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" onClick={() => openEditDialog(aluno)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => { setDeletingId(aluno.id); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Aluno" : "Cadastrar Aluno"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize os dados do aluno." : "Preencha os dados do novo aluno."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Foto do Aluno</Label>
              <div className="flex items-center gap-4">
                {imageFile || form.foto_url ? (
                  <div className="relative w-16 h-16 border rounded-full shadow-sm overflow-hidden flex-shrink-0">
                    <img
                      src={imageFile ? URL.createObjectURL(imageFile) : form.foto_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-5 w-5 rounded-full"
                      onClick={() => { setImageFile(null); setForm({ ...form, foto_url: "" }); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-muted flex flex-col items-center justify-center rounded-full border border-dashed flex-shrink-0 text-muted-foreground">
                    <ImageIcon className="h-5 w-5 mb-0.5" />
                    <span className="text-[9px]">Foto</span>
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

            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do aluno" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="turma">Turma *</Label>
              <Input id="turma" value={form.turma} onChange={(e) => setForm({ ...form, turma: e.target.value })} placeholder="Ex: 3º Ano A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-5">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O aluno será removido permanentemente.
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
              <History className="h-5 w-5 text-emerald-500" />
              Histórico de Empréstimos
            </DialogTitle>
            <DialogDescription>
              {historyAluno && (
                <span className="flex items-center gap-2 mt-1">
                  {historyAluno.foto_url ? (
                    <img src={historyAluno.foto_url} alt={historyAluno.nome} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-[10px]">
                      {historyAluno.nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-foreground">{historyAluno.nome}</span>
                  <Badge variant="secondary" className="text-[10px]">Turma {historyAluno.turma}</Badge>
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
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Este aluno ainda não possui empréstimos registrados.</p>
            </div>
          ) : (
            <>
              {/* Counters */}
              <div className="flex gap-3 mb-4">
                <Badge variant="outline" className="text-xs">
                  {historyData.length} empréstimo{historyData.length !== 1 ? "s" : ""}
                </Badge>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                  {historyData.filter(e => e.realStatus === "devolvido").length} devolvido{historyData.filter(e => e.realStatus === "devolvido").length !== 1 ? "s" : ""}
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
                      {emp.livro_capa_url ? (
                        <img src={emp.livro_capa_url} alt={emp.livro_titulo} className="w-10 h-14 object-cover rounded shadow-sm flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-14 bg-primary/10 flex items-center justify-center rounded shadow-sm flex-shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{emp.livro_titulo}</p>
                        {emp.livro_autor && <p className="text-[11px] text-muted-foreground">{emp.livro_autor}</p>}
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
    </div>
  );
};

export default Alunos;
