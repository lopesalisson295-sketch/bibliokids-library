import { useEffect, useState } from "react";
import { BookOpen, Plus, Search, Pencil, Trash2, X, Image as ImageIcon, History, CheckCircle2, AlertTriangle, ArrowLeftRight, Users } from "lucide-react";
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

type Livro = Tables<"livros">;

const emptyForm = {
  titulo: "",
  autor: "",
  editora: "",
  genero: "",
  isbn: "",
  ano_publicacao: "",
  capa_url: "",
};

const Acervo = () => {
  const [livros, setLivros] = useState<Livro[]>([]);
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
  const { toast } = useToast();

  useEffect(() => {
    fetchLivros();
  }, []);

  const fetchLivros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("livros")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      toast({ title: "Erro ao buscar livros", description: error.message, variant: "destructive" });
    } else {
      setLivros(data || []);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setDialogOpen(true);
  };

  const openEditDialog = (livro: Livro) => {
    setEditingId(livro.id);
    setImageFile(null);
    setForm({
      titulo: livro.titulo,
      autor: livro.autor,
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
    setDialogOpen(false);
    fetchLivros();
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
  }, [form.isbn]);

  const fetchBookByIsbn = async (isbnToFetch?: string) => {
    const targetIsbn = isbnToFetch || form.isbn;
    if (!targetIsbn) return;

    setFetchingIsbn(true);
    try {
      let cleanIsbn = targetIsbn.replace(/[^0-9X]/gi, "");

      if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
        toast({ title: "ISBN inválido", description: "O ISBN deve ter 10 ou 13 dígitos.", variant: "destructive" });
        setFetchingIsbn(false);
        return;
      }

      // Auto-corrigir dígito verificador do ISBN-13
      const fixIsbn13CheckDigit = (isbn: string): string => {
        if (isbn.length !== 13) return isbn;
        const digits = isbn.slice(0, 12).split("").map(Number);
        let sum = 0;
        for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3);
        const checkDigit = (10 - (sum % 10)) % 10;
        return isbn.slice(0, 12) + String(checkDigit);
      };

      // Auto-corrigir dígito verificador do ISBN-10
      const fixIsbn10CheckDigit = (isbn: string): string => {
        if (isbn.length !== 10) return isbn;
        const digits = isbn.slice(0, 9).split("").map(Number);
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
        const remainder = (11 - (sum % 11)) % 11;
        return isbn.slice(0, 9) + (remainder === 10 ? "X" : String(remainder));
      };

      // Converter ISBN-13 → ISBN-10
      const isbn13to10 = (isbn13: string): string => {
        if (isbn13.length !== 13 || !isbn13.startsWith("978")) return "";
        const core = isbn13.slice(3, 12);
        const digits = core.split("").map(Number);
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
        const remainder = (11 - (sum % 11)) % 11;
        return core + (remainder === 10 ? "X" : String(remainder));
      };

      // Converter ISBN-10 → ISBN-13
      const isbn10to13 = (isbn10: string): string => {
        if (isbn10.length !== 10) return "";
        const core = "978" + isbn10.slice(0, 9);
        const digits = core.split("").map(Number);
        let sum = 0;
        for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3);
        const checkDigit = (10 - (sum % 10)) % 10;
        return core + String(checkDigit);
      };

      // Corrigir check digit
      const correctedIsbn = cleanIsbn.length === 13
        ? fixIsbn13CheckDigit(cleanIsbn)
        : fixIsbn10CheckDigit(cleanIsbn);

      // Gerar o par ISBN-10/ISBN-13
      const altIsbn = correctedIsbn.length === 13
        ? isbn13to10(correctedIsbn)
        : isbn10to13(correctedIsbn);

      // Criar lista de variantes: corrigido, alternativo (10↔13), original
      const isbnVariants = [...new Set([correctedIsbn, altIsbn, cleanIsbn].filter(v => v && (v.length === 10 || v.length === 13)))];

      // Upgrade de thumbnail do Google Books para melhor qualidade
      const upgradeGoogleCover = (url: string): string => {
        if (!url) return url;
        return url
          .replace("&edge=curl", "")
          .replace(/zoom=\d/, "zoom=0")
          .replace("http:", "https:");
      };


      // ========================
      // TRADUTOR DE GÊNEROS COM PRIORIDADE
      // ========================
      const genrePriority: [RegExp, string][] = [
        [/fantasy|fantasia|magic|magia|wizard|feiticeiro|bruxa|witchcraft|witch|sorcery|alchemy|good and evil|supernatural/i, "Fantasia"],
        [/science fiction|sci-fi|ficção científica|dystopi|distopi/i, "Ficção Científica"],
        [/adventure|aventura|action/i, "Aventura"],
        [/mystery|mistério|detective|thriller|suspense|crime|policial/i, "Suspense"],
        [/horror|terror|creepy|scary|ghost story|história de terror/i, "Terror"],
        [/romance|love|amor|romantic|paixão|passion|love story|história de amor|chick lit/i, "Romance"],
        [/drama|tragic|trágic|coming of age|amadurecimento|contemporary|contemporâne/i, "Drama"],
        [/fairy tale|conto de fadas|fable|fábula/i, "Conto de Fadas"],
        [/historical fiction|ficção histórica|historical/i, "Ficção Histórica"],
        [/biography|biografia|autobiography|autobiografia|memoir|memória/i, "Biografia"],
        [/poetry|poesia|poem|poems/i, "Poesia"],
        [/humor|comedy|comédia|funny|engraçad/i, "Comédia"],
        [/education|educação|educational|didátic|pedagog|textbook|livro didático/i, "Educação"],
        [/religion|religião|spiritual|espiritual|bible|bíblia|faith/i, "Religião"],
        [/science|ciência|scientific|científic/i, "Ciência"],
        [/\bart\b|arte|music|música|painting|pintura/i, "Arte"],
        [/cooking|culinária|cookbook|receita|recipe|gastronom/i, "Culinária"],
        [/sport|esporte|athletic|atlético|football|futebol/i, "Esportes"],
        [/self-help|self help|autoajuda|auto-ajuda|motivational|motivacion/i, "Autoajuda"],
        [/\bhistory\b|história/i, "História"],
        [/juvenile|children|infantil|infanto|young adult|teen|adolescent|middle grade|picture book|livro infantil/i, "Infanto-juvenil"],
        [/\bfiction\b|ficção|novel|novela|^fiction$/i, "Ficção"],
      ];

      const translateGenre = (rawGenre: string): string => {
        if (!rawGenre) return "";
        const cleaned = rawGenre.replace(/^(JUVENILE|YOUNG ADULT)\s*(FICTION|NONFICTION)\s*[\/\-]\s*/i, "").trim();
        if (cleaned !== rawGenre && cleaned.length > 2) {
          for (const [regex, label] of genrePriority) { if (regex.test(cleaned)) return label; }
        }
        const segments = rawGenre.split(/[\/]/).map(s => s.trim()).filter(s => s.length > 1);
        const specificSegments = segments.filter(s => !/^\s*(fiction|ficção|nonfiction)\s*$/i.test(s));
        for (const seg of specificSegments) {
          for (const [regex, label] of genrePriority) { if (regex.test(seg)) return label; }
        }
        for (const [regex, label] of genrePriority) { if (regex.test(rawGenre)) return label; }
        if (cleaned.length > 30) return cleaned.split(/[,|;]/)[0].trim();
        return cleaned;
      };

      const bestGenreFromCategories = (categories: string[]): string => {
        let bestGenre = "";
        let bestPriority = 999;
        for (const cat of categories) {
          const translated = translateGenre(cat);
          if (!translated) continue;
          const idx = genrePriority.findIndex(([regex]) => regex.test(cat));
          if (idx >= 0 && idx < bestPriority) { bestPriority = idx; bestGenre = translated; }
          else if (idx === -1 && !bestGenre) { bestGenre = translated; }
        }
        return bestGenre;
      };

      // ========================================
      // BUSCA PARALELA DE ALTA PERFORMANCE
      // ========================================
      const tryFetchWithIsbn = async (isbn: string) => {
        const bookData = { titulo: "", autor: "", editora: "", ano: "", genero: "", capa_url: "" };
        let allCategories: string[] = [];

        // === ONDA 1: Google Books + BrasilAPI + OpenLibrary Books (EM PARALELO) ===
        const [googleResult, brasilResult, openLibResult] = await Promise.allSettled([
          // Google Books
          fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null),
          // Brasil API
          fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null),
          // OpenLibrary Books
          fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null),
        ]);

        // Processar Google Books
        const googleData = googleResult.status === "fulfilled" ? googleResult.value : null;
        let googleVolumeId = "";
        if (googleData?.items?.length > 0) {
          const v = googleData.items[0].volumeInfo;
          googleVolumeId = googleData.items[0].id || "";
          bookData.titulo = v.title || "";
          bookData.autor = v.authors ? v.authors.join(", ") : "";
          bookData.editora = v.publisher || "";
          bookData.ano = v.publishedDate ? v.publishedDate.substring(0, 4) : "";
          bookData.capa_url = upgradeGoogleCover(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "");
          if (v.categories) allCategories.push(...v.categories);
        }

        // Processar Brasil API (complementa, não sobrescreve)
        const bData = brasilResult.status === "fulfilled" ? brasilResult.value : null;
        if (bData) {
          if (bData.title) bookData.titulo = bData.title; // título em PT preferido
          if (bData.authors?.length > 0) bookData.autor = bData.authors.join(", ");
          if (bData.publisher) bookData.editora = bData.publisher;
          if (!bookData.ano && bData.year) bookData.ano = String(bData.year);
          if (bData.cover_url) bookData.capa_url = bData.cover_url;
          if (bData.subjects?.length > 0) {
            const valid = bData.subjects.filter((s: string) => !s.startsWith("series:"));
            allCategories.push(...valid);
          }
        }

        // Processar OpenLibrary Books
        const olData = openLibResult.status === "fulfilled" ? openLibResult.value : null;
        const olBook = olData?.[`ISBN:${isbn}`];
        if (olBook) {
          if (!bookData.titulo && olBook.title) bookData.titulo = olBook.title;
          if (!bookData.autor && olBook.authors) bookData.autor = olBook.authors.map((a: any) => a.name).join(", ");
          if (!bookData.editora && olBook.publishers) bookData.editora = olBook.publishers.map((p: any) => p.name).join(", ");
          if (!bookData.ano && olBook.publish_date) bookData.ano = olBook.publish_date.match(/\d{4}/)?.[0] || "";
          if (!bookData.capa_url && olBook.cover) bookData.capa_url = olBook.cover.large || olBook.cover.medium || "";
          if (olBook.subjects) {
            for (const s of olBook.subjects) {
              allCategories.push(s.name || s);
            }
          }
        }

        // Aplicar gênero das categorias coletadas
        if (allCategories.length > 0) {
          const genre = bestGenreFromCategories(allCategories);
          if (genre) bookData.genero = genre;
        }

        // === ONDA 2: Detalhes extras EM PARALELO (só se precisa) ===
        const wave2Promises: Promise<void>[] = [];

        // Google Volume Detail (melhor capa + mais categorias)
        if (googleVolumeId) {
          wave2Promises.push(
            fetch(`https://www.googleapis.com/books/v1/volumes/${googleVolumeId}`)
              .then(r => r.ok ? r.json() : null)
              .then(data => {
                const dv = data?.volumeInfo;
                if (!dv) return;
                if (!bookData.editora && dv.publisher) bookData.editora = dv.publisher;
                if (dv.imageLinks) {
                  const best = dv.imageLinks.extraLarge || dv.imageLinks.large || dv.imageLinks.medium || dv.imageLinks.small || dv.imageLinks.thumbnail || "";
                  if (best) bookData.capa_url = upgradeGoogleCover(best);
                }
                if (dv.categories && !bookData.genero) {
                  const genre = bestGenreFromCategories(dv.categories);
                  if (genre) bookData.genero = genre;
                }
              })
              .catch(() => { })
          );
        }

        // OpenLibrary Edition API (ano preciso da edição)
        wave2Promises.push(
          fetch(`https://openlibrary.org/isbn/${isbn}.json`)
            .then(r => r.ok ? r.json() : null)
            .then(edData => {
              if (!edData) return;
              if (edData.publish_date) {
                const yearMatch = edData.publish_date.match(/\d{4}/);
                if (yearMatch) {
                  const edYear = yearMatch[0];
                  if (!bookData.ano || parseInt(edYear) > parseInt(bookData.ano)) {
                    bookData.ano = edYear;
                  }
                }
              }
              if (!bookData.editora && edData.publishers?.length > 0) {
                bookData.editora = edData.publishers[0];
              }
            })
            .catch(() => { })
        );

        // OpenLibrary Search (gênero + dados faltantes)
        if (!bookData.genero || !bookData.titulo) {
          wave2Promises.push(
            fetch(`https://openlibrary.org/search.json?isbn=${isbn}&limit=1`)
              .then(r => r.ok ? r.json() : null)
              .then(async (searchData) => {
                const doc = searchData?.docs?.[0];
                if (!doc) return;
                if (!bookData.titulo && doc.title) bookData.titulo = doc.title;
                if (!bookData.autor && doc.author_name) bookData.autor = doc.author_name.join(", ");
                if (!bookData.editora && doc.publisher) bookData.editora = doc.publisher[0];
                if (!bookData.capa_url && doc.cover_i) {
                  bookData.capa_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
                }
                if (!bookData.genero && doc.subject) {
                  const genre = bestGenreFromCategories(doc.subject.slice(0, 15));
                  if (genre) bookData.genero = genre;
                }
                // Works API para gêneros mais ricos
                if (!bookData.genero && doc.key) {
                  try {
                    const worksRes = await fetch(`https://openlibrary.org${doc.key}.json`);
                    if (worksRes.ok) {
                      const worksData = await worksRes.json();
                      if (worksData.subjects?.length > 0) {
                        const genre = bestGenreFromCategories(worksData.subjects.slice(0, 15));
                        if (genre) bookData.genero = genre;
                      }
                    }
                  } catch (e) { /* silencioso */ }
                }
              })
              .catch(() => { })
          );
        }

        await Promise.allSettled(wave2Promises);

        // === ONDA 3: Capa de último recurso (se ainda não tem) ===
        if (!bookData.capa_url) {
          try {
            const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
            const coverCheck = await fetch(coverUrl, { method: "HEAD", redirect: "manual" });
            if (coverCheck.status === 200 || coverCheck.status === 302) {
              bookData.capa_url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
            }
          } catch (e) { /* silencioso */ }
        }

        return bookData;
      };

      // ========================================
      // BUSCA COM VARIANTES DE ISBN
      // ========================================
      let bookData = { titulo: "", autor: "", editora: "", ano: "", genero: "", capa_url: "" };
      let usedIsbn = correctedIsbn;

      for (const isbnVariant of isbnVariants) {
        const result = await tryFetchWithIsbn(isbnVariant);
        if (result.titulo) {
          bookData = result;
          usedIsbn = isbnVariant;
          break;
        }
        // Mesclar dados parciais
        if (!bookData.capa_url && result.capa_url) bookData.capa_url = result.capa_url;
        if (!bookData.genero && result.genero) bookData.genero = result.genero;
      }

      // Busca extra de capa com todas as variantes
      if (bookData.titulo && !bookData.capa_url) {
        const coverChecks = isbnVariants.map(v =>
          fetch(`https://covers.openlibrary.org/b/isbn/${v}-L.jpg?default=false`, { method: "HEAD", redirect: "manual" })
            .then(r => (r.status === 200 || r.status === 302) ? v : null)
            .catch(() => null)
        );
        const coverResults = await Promise.allSettled(coverChecks);
        for (const r of coverResults) {
          if (r.status === "fulfilled" && r.value) {
            bookData.capa_url = `https://covers.openlibrary.org/b/isbn/${r.value}-L.jpg`;
            break;
          }
        }
      }

      // Google Books por título (último recurso para capa e gênero)
      if (bookData.titulo && (!bookData.capa_url || !bookData.genero)) {
        try {
          const titleQuery = encodeURIComponent(bookData.titulo + (bookData.autor ? " " + bookData.autor : ""));
          const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${titleQuery}&maxResults=5`);
          if (gRes.ok) {
            const gData = await gRes.json();
            for (const item of (gData.items || [])) {
              const vi = item.volumeInfo;
              if (!bookData.capa_url && vi?.imageLinks) {
                const cover = vi.imageLinks.medium || vi.imageLinks.small || vi.imageLinks.thumbnail || "";
                if (cover) bookData.capa_url = upgradeGoogleCover(cover);
              }
              if (!bookData.genero && vi?.categories) {
                const genre = bestGenreFromCategories(vi.categories);
                if (genre) bookData.genero = genre;
              }
              if (bookData.capa_url && bookData.genero) break;
            }
          }
        } catch (e) { /* silencioso */ }
      }

      // ========================================
      // RESULTADO FINAL + MENSAGENS DETALHADAS
      // ========================================
      if (bookData.titulo && !bookData.genero) bookData.genero = "Geral";
      if (bookData.titulo && !bookData.autor) bookData.autor = "Autor Desconhecido";

      if (bookData.titulo || bookData.autor) {
        setForm(prev => ({
          ...prev,
          titulo: bookData.titulo || prev.titulo,
          autor: bookData.autor || prev.autor,
          editora: bookData.editora || prev.editora,
          ano_publicacao: bookData.ano || prev.ano_publicacao,
          genero: bookData.genero || prev.genero,
          capa_url: bookData.capa_url || prev.capa_url,
          isbn: usedIsbn,
        }));

        // Mensagem detalhada do que foi encontrado e o que falta
        const found = [];
        const missing = [];
        if (bookData.titulo) found.push("título"); else missing.push("título");
        if (bookData.autor && bookData.autor !== "Autor Desconhecido") found.push("autor"); else missing.push("autor");
        if (bookData.editora) found.push("editora"); else missing.push("editora");
        if (bookData.ano) found.push("ano"); else missing.push("ano");
        if (bookData.genero && bookData.genero !== "Geral") found.push("gênero"); else missing.push("gênero");
        if (bookData.capa_url) found.push("capa"); else missing.push("capa");

        const correctedMsg = usedIsbn !== cleanIsbn ? "\n📝 ISBN corrigido automaticamente." : "";

        if (missing.length === 0) {
          toast({ title: "✅ Dados completos!", description: `Todos os campos preenchidos automaticamente.${correctedMsg}` });
        } else if (missing.length <= 2) {
          toast({ title: `✅ Quase tudo encontrado!`, description: `Faltou: ${missing.join(", ")}. Preencha manualmente.${correctedMsg}` });
        } else {
          toast({ title: `⚠️ Dados parciais encontrados`, description: `Encontrado: ${found.join(", ")}.\nFaltou: ${missing.join(", ")}.${correctedMsg}` });
        }
      } else {
        toast({ title: "❌ Livro não encontrado", description: "Nenhuma base de dados reconheceu este ISBN. Verifique o número ou preencha os dados manualmente.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro na busca", description: "Ocorreu um erro inesperado ao buscar dados. Tente novamente.", variant: "destructive" });
    } finally {
      setFetchingIsbn(false);
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
        <Button onClick={openCreateDialog} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Cadastrar Livro
        </Button>
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
          {filtered.map((livro) => (
            <Card key={livro.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4 min-w-0 flex-1">
                    {livro.capa_url ? (
                      <img src={livro.capa_url} alt={livro.titulo} className="w-16 h-24 object-cover rounded shadow-sm flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-24 bg-amber-100 flex items-center justify-center rounded shadow-sm flex-shrink-0">
                        <BookOpen className="h-8 w-8 text-amber-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground truncate text-lg">{livro.titulo}</h3>
                      <p className="text-sm text-foreground/80 mt-1"><span className="text-muted-foreground">Autor:</span> {livro.autor}</p>

                      <div className="flex flex-col gap-1 mt-3 bg-muted/30 p-2 rounded">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                          <p className="text-xs"><span className="text-muted-foreground">Gênero:</span> {livro.genero || "—"}</p>
                          <p className="text-xs"><span className="text-muted-foreground">Ano:</span> {livro.ano_publicacao || "—"}</p>
                          <p className="text-xs"><span className="text-muted-foreground">Editora:</span> {livro.editora || "—"}</p>
                          <p className="text-xs"><span className="text-muted-foreground">ISBN:</span> {livro.isbn || "—"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistoryDialog(livro)} title="Histórico de empréstimos">
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(livro)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeletingId(livro.id); setDeleteDialogOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Livro" : "Cadastrar Livro"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize as informações do livro." : "Preencha os dados do novo livro."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">

            {/* Auto Fetch por ISBN */}
            <div className="space-y-2 bg-blue-50/50 p-3.5 rounded-lg border border-blue-100">
              <Label htmlFor="isbn" className="text-blue-800 font-semibold flex items-center gap-1.5">
                <Search className="h-4 w-4" /> Busca Rápida por ISBN
              </Label>
              <div className="flex gap-2">
                <Input
                  id="isbn"
                  value={form.isbn}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      fetchBookByIsbn(form.isbn);
                    }
                  }}
                  className="bg-white border-blue-200 focus-visible:ring-blue-500"
                  placeholder="Escaneie o código de barras ou digite..."
                />
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-sm"
                  onClick={() => fetchBookByIsbn()}
                  disabled={fetchingIsbn || !form.isbn}
                >
                  {fetchingIsbn ? "Buscando..." : "Buscar Dados"}
                </Button>
              </div>
              <p className="text-[11px] text-blue-600/80 leading-tight">
                Dica: Use um leitor de código de barras físico. O sistema detecta e preenche tudo sozinho!
              </p>
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

            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input id="titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Nome do livro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="autor">Autor *</Label>
              <Input id="autor" value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} placeholder="Nome do autor" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editora">Editora</Label>
                <Input id="editora" value={form.editora} onChange={(e) => setForm({ ...form, editora: e.target.value })} placeholder="Editora" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genero">Gênero</Label>
                <Input id="genero" value={form.genero} onChange={(e) => setForm({ ...form, genero: e.target.value })} placeholder="Ex: Aventura" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ano">Ano de Publicação</Label>
                <Input id="ano" type="number" value={form.ano_publicacao} onChange={(e) => setForm({ ...form, ano_publicacao: e.target.value })} placeholder="Ex: 2024" />
              </div>
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
        <AlertDialogContent>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-amber-500" />
              Histórico do Livro
            </DialogTitle>
            <DialogDescription>
              {historyLivro && (
                <span className="flex items-center gap-2 mt-1">
                  {historyLivro.capa_url ? (
                    <img src={historyLivro.capa_url} alt={historyLivro.titulo} className="w-6 h-8 object-cover rounded" />
                  ) : (
                    <div className="w-6 h-8 bg-amber-100 flex items-center justify-center rounded">
                      <BookOpen className="h-3 w-3 text-amber-500" />
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
    </div>
  );
};

export default Acervo;
