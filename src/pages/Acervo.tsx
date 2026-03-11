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
import ImageLightbox from "@/components/ImageLightbox";

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
  const { toast } = useToast();

  const openLightbox = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  };

  useEffect(() => {
    fetchLivros();
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

      // ========================================
      // UTILITÁRIOS
      // ========================================
      const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 6000): Promise<Response> => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      };

      const safeFetchJson = async (url: string, ms = 6000) => {
        try {
          const r = await fetchWithTimeout(url, {}, ms);
          return r.ok ? await r.json() : null;
        } catch { return null; }
      };

      // Corrigir check digits
      const fixIsbn13 = (isbn: string): string => {
        if (isbn.length !== 13) return isbn;
        const d = isbn.slice(0, 12).split("").map(Number);
        let s = 0; for (let i = 0; i < 12; i++) s += d[i] * (i % 2 === 0 ? 1 : 3);
        return isbn.slice(0, 12) + String((10 - (s % 10)) % 10);
      };
      const fixIsbn10 = (isbn: string): string => {
        if (isbn.length !== 10) return isbn;
        const d = isbn.slice(0, 9).split("").map(Number);
        let s = 0; for (let i = 0; i < 9; i++) s += d[i] * (10 - i);
        const r = (11 - (s % 11)) % 11;
        return isbn.slice(0, 9) + (r === 10 ? "X" : String(r));
      };
      const isbn13to10 = (i13: string): string => {
        if (i13.length !== 13 || !i13.startsWith("978")) return "";
        const core = i13.slice(3, 12), d = core.split("").map(Number);
        let s = 0; for (let i = 0; i < 9; i++) s += d[i] * (10 - i);
        const r = (11 - (s % 11)) % 11;
        return core + (r === 10 ? "X" : String(r));
      };
      const isbn10to13 = (i10: string): string => {
        if (i10.length !== 10) return "";
        const core = "978" + i10.slice(0, 9), d = core.split("").map(Number);
        let s = 0; for (let i = 0; i < 12; i++) s += d[i] * (i % 2 === 0 ? 1 : 3);
        return core + String((10 - (s % 10)) % 10);
      };

      const correctedIsbn = cleanIsbn.length === 13 ? fixIsbn13(cleanIsbn) : fixIsbn10(cleanIsbn);
      const altIsbn = correctedIsbn.length === 13 ? isbn13to10(correctedIsbn) : isbn10to13(correctedIsbn);
      const allIsbns = [...new Set([correctedIsbn, altIsbn, cleanIsbn].filter(v => v && (v.length === 10 || v.length === 13)))];

      const upgradeGoogleCover = (url: string): string =>
        url ? url.replace("&edge=curl", "").replace(/zoom=\d/, "zoom=0").replace("http:", "https:") : "";

      // ========================================
      // TRADUTOR DE GÊNEROS
      // ========================================
      const genrePriority: [RegExp, string][] = [
        [/fantasy|fantasia|magic|magia|wizard|feiticeiro|bruxa|witchcraft|witch|sorcery|alchemy|good and evil|supernatural|mytholog/i, "Fantasia"],
        [/science fiction|sci-fi|ficção científica|dystopi|distopi|futurist/i, "Ficção Científica"],
        [/adventure|aventura|action|quest|journey|viagem/i, "Aventura"],
        [/mystery|mistério|detective|thriller|suspense|crime|policial|investigat/i, "Suspense"],
        [/horror|terror|creepy|scary|ghost story|história de terror|sobrenatural/i, "Terror"],
        [/romance|love|amor|romantic|paixão|passion|love story|história de amor|chick lit|relacionamento|relationship/i, "Romance"],
        [/drama|tragic|trágic|coming of age|amadurecimento|contemporary|contemporâne|literary fiction|ficção literária/i, "Drama"],
        [/fairy tale|conto de fadas|fable|fábula|folklore|folclore/i, "Conto de Fadas"],
        [/historical fiction|ficção histórica|historical novel/i, "Ficção Histórica"],
        [/biography|biografia|autobiography|autobiografia|memoir|memória/i, "Biografia"],
        [/poetry|poesia|poem|poems|poema/i, "Poesia"],
        [/humor|comedy|comédia|funny|engraçad|satir/i, "Comédia"],
        [/education|educação|educational|didátic|pedagog|textbook|livro didático|ensino|teaching/i, "Educação"],
        [/religion|religião|spiritual|espiritual|bible|bíblia|faith|gospel|evangel/i, "Religião"],
        [/science|ciência|scientific|científic|physics|biology|chemistry|biolog|físic|químic/i, "Ciência"],
        [/\bart\b|arte|music|música|painting|pintura|drawing|desenho/i, "Arte"],
        [/cooking|culinária|cookbook|receita|recipe|gastronom|food|comida/i, "Culinária"],
        [/sport|esporte|athletic|atlético|football|futebol|soccer/i, "Esportes"],
        [/self-help|self help|autoajuda|auto-ajuda|motivational|motivacion|personal development|desenvolvimento pessoal/i, "Autoajuda"],
        [/philosophy|filosofia|philosophical|filosóf/i, "Filosofia"],
        [/psychology|psicologia|psychological|psicológ|mental health|saúde mental/i, "Psicologia"],
        [/business|negócios|management|gestão|marketing|entrepreneurship|empreended/i, "Negócios"],
        [/technology|tecnologia|programming|programação|computer|computad|software|digital/i, "Tecnologia"],
        [/\bhistory\b|história|historical/i, "História"],
        [/juvenile|children|infantil|infanto|young adult|teen|adolescent|middle grade|picture book|livro infantil|kids/i, "Infanto-juvenil"],
        [/\bfiction\b|ficção|novel|novela|^fiction$/i, "Ficção"],
      ];

      const translateGenre = (raw: string): string => {
        if (!raw) return "";
        const cleaned = raw.replace(/^(JUVENILE|YOUNG ADULT)\s*(FICTION|NONFICTION)\s*[\/\-]\s*/i, "").trim();
        if (cleaned !== raw && cleaned.length > 2) {
          for (const [rx, lbl] of genrePriority) if (rx.test(cleaned)) return lbl;
        }
        const segs = raw.split(/[\/]/).map(s => s.trim()).filter(s => s.length > 1);
        const spec = segs.filter(s => !/^\s*(fiction|ficção|nonfiction)\s*$/i.test(s));
        for (const seg of spec) for (const [rx, lbl] of genrePriority) if (rx.test(seg)) return lbl;
        for (const [rx, lbl] of genrePriority) if (rx.test(raw)) return lbl;
        return cleaned.length > 30 ? cleaned.split(/[,|;]/)[0].trim() : cleaned;
      };

      const bestGenre = (cats: string[]): string => {
        let best = "", bestP = 999;
        for (const c of cats) {
          const t = translateGenre(c);
          if (!t) continue;
          const idx = genrePriority.findIndex(([rx]) => rx.test(c));
          if (idx >= 0 && idx < bestP) { bestP = idx; best = t; }
          else if (idx === -1 && !best) best = t;
        }
        return best;
      };

      // Detectar gênero pela descrição do livro
      const genreFromDescription = (desc: string): string => {
        if (!desc) return "";
        const d = desc.toLowerCase();
        const descPatterns: [RegExp, string][] = [
          [/romance|amor|paixão|coração|sentimento|love|heart|relationship|relacionamento/i, "Romance"],
          [/magia|magic|bruxa|wizard|feiticeiro|dragão|dragon|elfo|elf|poder mágico|enchanted|encantad/i, "Fantasia"],
          [/mistério|detective|investig|crime|assassin|murder|pista|clue|suspect|suspeit/i, "Suspense"],
          [/terror|horror|medo|fear|assombr|haunt|demon|demônio|scream|grito/i, "Terror"],
          [/aventura|adventure|jornada|journey|expedição|expedition|busca|quest/i, "Aventura"],
          [/futuro|future|robô|robot|espacial|space|alien|tecnologia avançada|dystopi|distopi/i, "Ficção Científica"],
          [/guerra|war|batalha|battle|exército|army|soldado|soldier|históric/i, "Ficção Histórica"],
          [/vida|life|família|family|crescer|grow|amadurec|coming.of.age|existên|identity|identidade/i, "Drama"],
          [/engraçad|humor|funny|comédia|comedy|rir|laugh|hilári/i, "Comédia"],
          [/universo paralelo|parallel|multiverso|multiverse|realidade alternativa|alternate|possibilidades|possibilities|vidas? alternativa/i, "Drama"],
        ];
        for (const [rx, lbl] of descPatterns) if (rx.test(d)) return lbl;
        return "";
      };

      // ========================================
      // BUSCA PARALELA SUPREMA
      // ========================================
      const tryFetchWithIsbn = async (isbn: string) => {
        const b = { titulo: "", autor: "", editora: "", ano: "", genero: "", capa_url: "", descricao: "" };
        let allCats: string[] = [];
        let googleVolumeId = "";

        // === ONDA 1: 5 APIs EM PARALELO ===
        const [googleR, googleWideR, brasilR, olBooksR, olEditionR] = await Promise.allSettled([
          safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`),
          safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=${isbn}`),
          safeFetchJson(`https://brasilapi.com.br/api/isbn/v1/${isbn}?providers=mercado-editorial,cbl,open-library`),
          safeFetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`),
          safeFetchJson(`https://openlibrary.org/isbn/${isbn}.json`),
        ]);

        // Google Books (estrito)
        const gd = googleR.status === "fulfilled" ? googleR.value : null;
        let bestGoogle = gd?.items?.length > 0 ? gd.items[0] : null;

        // Google Books (amplo - para corrigir ISBNs reutilizados por editoras)
        const gW = googleWideR.status === "fulfilled" ? googleWideR.value : null;
        if (!bestGoogle && gW?.items?.length > 0) {
          bestGoogle = gW.items[0]; // Pega o primeiro resultado da busca ampla
        }

        if (bestGoogle) {
          const v = bestGoogle.volumeInfo;
          googleVolumeId = bestGoogle.id || "";
          b.titulo = v.title || "";
          b.autor = v.authors ? v.authors.join(", ") : "";
          b.editora = v.publisher || "";
          b.ano = v.publishedDate ? v.publishedDate.substring(0, 4) : "";
          b.capa_url = upgradeGoogleCover(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "");
          b.descricao = v.description || "";
          if (v.categories) allCats.push(...v.categories);
        }

        // BrasilAPI (com providers brasileiros)
        const bd = brasilR.status === "fulfilled" ? brasilR.value : null;
        if (bd && !bd.message) {
          if (!b.titulo && bd.title) b.titulo = bd.title;
          if (!b.autor && bd.authors?.length > 0) b.autor = bd.authors.join(", ");
          if (!b.editora && bd.publisher) b.editora = bd.publisher;
          if (!b.ano && bd.year) b.ano = String(bd.year);
          if (!b.capa_url && bd.cover_url) b.capa_url = bd.cover_url;
          if (bd.synopsis) b.descricao = bd.synopsis || b.descricao;
          if (bd.subjects?.length > 0) {
            allCats.push(...bd.subjects.filter((s: string) => !s.startsWith("series:")));
          }
        }

        // OpenLibrary Books
        const olb = olBooksR.status === "fulfilled" ? olBooksR.value : null;
        const olBook = olb?.[`ISBN:${isbn}`];
        if (olBook) {
          if (!b.titulo && olBook.title) b.titulo = olBook.title;
          if (!b.autor && olBook.authors) b.autor = olBook.authors.map((a: any) => a.name).join(", ");
          if (!b.editora && olBook.publishers) b.editora = olBook.publishers.map((p: any) => p.name).join(", ");
          if (!b.ano && olBook.publish_date) b.ano = olBook.publish_date.match(/\d{4}/)?.[0] || "";
          if (!b.capa_url && olBook.cover) b.capa_url = olBook.cover.large || olBook.cover.medium || "";
          if (olBook.subjects) olBook.subjects.forEach((s: any) => allCats.push(s.name || s));
        }

        // OpenLibrary Edition (ano preciso)
        const olE = olEditionR.status === "fulfilled" ? olEditionR.value : null;
        if (olE) {
          if (olE.publish_date) {
            const ym = olE.publish_date.match(/\d{4}/);
            if (ym && (!b.ano || parseInt(ym[0]) > parseInt(b.ano))) b.ano = ym[0];
          }
          if (!b.editora && olE.publishers?.length > 0) b.editora = olE.publishers[0];
        }

        // Aplicar gênero das categorias
        if (allCats.length > 0) {
          const g = bestGenre(allCats);
          if (g) b.genero = g;
        }

        // === ONDA 2: Detalhes extras EM PARALELO ===
        const wave2: Promise<void>[] = [];

        // Google Volume Detail (melhor capa)
        if (googleVolumeId) {
          wave2.push(
            safeFetchJson(`https://www.googleapis.com/books/v1/volumes/${googleVolumeId}`).then(data => {
              const dv = data?.volumeInfo;
              if (!dv) return;
              if (!b.editora && dv.publisher) b.editora = dv.publisher;
              if (!b.descricao && dv.description) b.descricao = dv.description;
              if (dv.imageLinks) {
                const best = dv.imageLinks.extraLarge || dv.imageLinks.large || dv.imageLinks.medium || dv.imageLinks.small || dv.imageLinks.thumbnail || "";
                if (best) b.capa_url = upgradeGoogleCover(best);
              }
              if (dv.categories && !b.genero) {
                const g = bestGenre(dv.categories);
                if (g) b.genero = g;
              }
            })
          );
        }

        // OpenLibrary Search + Works (gênero + capa)
        if (!b.genero || !b.capa_url) {
          wave2.push(
            safeFetchJson(`https://openlibrary.org/search.json?isbn=${isbn}&limit=1`).then(async (sd) => {
              const doc = sd?.docs?.[0];
              if (!doc) return;
              if (!b.titulo && doc.title) b.titulo = doc.title;
              if (!b.autor && doc.author_name) b.autor = doc.author_name.join(", ");
              if (!b.editora && doc.publisher) b.editora = doc.publisher[0];
              if (!b.capa_url && doc.cover_i) b.capa_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
              if (!b.genero && doc.subject) {
                const g = bestGenre(doc.subject.slice(0, 20));
                if (g) b.genero = g;
              }
              // Works API
              if (!b.genero && doc.key) {
                const wd = await safeFetchJson(`https://openlibrary.org${doc.key}.json`);
                if (wd?.subjects?.length > 0) {
                  const g = bestGenre(wd.subjects.slice(0, 20));
                  if (g) b.genero = g;
                }
                // Descrição da obra
                if (!b.descricao && wd?.description) {
                  b.descricao = typeof wd.description === "string" ? wd.description : wd.description.value || "";
                }
              }
            })
          );
        }

        await Promise.allSettled(wave2);

        // Detectar gênero pela descrição se ainda não tem
        if (!b.genero && b.descricao) {
          b.genero = genreFromDescription(b.descricao);
        }

        // Capa de último recurso via OpenLibrary Covers
        if (!b.capa_url) {
          try {
            const r = await fetchWithTimeout(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, { method: "HEAD", redirect: "manual" }, 4000);
            if (r.status === 200 || r.status === 302) b.capa_url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
          } catch { /* silencioso */ }
        }

        return b;
      };

      // ========================================
      // EXECUTAR BUSCA COM TODAS AS VARIANTES
      // ========================================
      let bookData = { titulo: "", autor: "", editora: "", ano: "", genero: "", capa_url: "", descricao: "" };
      let usedIsbn = correctedIsbn;

      for (const isbn of allIsbns) {
        const result = await tryFetchWithIsbn(isbn);
        if (result.titulo) {
          bookData = result;
          usedIsbn = isbn;
          break;
        }
        // Mesclar dados parciais
        if (!bookData.capa_url && result.capa_url) bookData.capa_url = result.capa_url;
        if (!bookData.genero && result.genero) bookData.genero = result.genero;
      }

      // ========================================
      // BUSCA AGRESSIVA DE CAPA EM PARALELO
      // ========================================
      if (bookData.titulo && !bookData.capa_url) {
        // Tentar OpenLibrary covers com todas as variantes em paralelo
        const coverResults = await Promise.allSettled(
          allIsbns.map(v =>
            fetchWithTimeout(`https://covers.openlibrary.org/b/isbn/${v}-L.jpg?default=false`, { method: "HEAD", redirect: "manual" }, 4000)
              .then(r => (r.status === 200 || r.status === 302) ? v : null)
              .catch(() => null)
          )
        );
        for (const r of coverResults) {
          if (r.status === "fulfilled" && r.value) {
            bookData.capa_url = `https://covers.openlibrary.org/b/isbn/${r.value}-L.jpg`;
            break;
          }
        }
      }

      // Google Books por título+autor como último recurso para capa e gênero
      if (bookData.titulo && (!bookData.capa_url || !bookData.genero)) {
        const gData = await safeFetchJson(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(bookData.titulo + (bookData.autor ? " " + bookData.autor : ""))}&maxResults=5`
        );
        for (const item of (gData?.items || [])) {
          const vi = item.volumeInfo;
          if (!bookData.capa_url && vi?.imageLinks) {
            const c = vi.imageLinks.medium || vi.imageLinks.small || vi.imageLinks.thumbnail || "";
            if (c) bookData.capa_url = upgradeGoogleCover(c);
          }
          if (!bookData.genero && vi?.categories) {
            const g = bestGenre(vi.categories);
            if (g) bookData.genero = g;
          }
          if (!bookData.genero && vi?.description) {
            const g = genreFromDescription(vi.description);
            if (g) bookData.genero = g;
          }
          if (bookData.capa_url && bookData.genero) break;
        }
      }

      // ========================================
      // RESULTADO FINAL
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

        const found: string[] = [], missing: string[] = [];
        if (bookData.titulo) found.push("título"); else missing.push("título");
        if (bookData.autor && bookData.autor !== "Autor Desconhecido") found.push("autor"); else missing.push("autor");
        if (bookData.editora) found.push("editora"); else missing.push("editora");
        if (bookData.ano) found.push("ano"); else missing.push("ano");
        if (bookData.genero && bookData.genero !== "Geral") found.push("gênero"); else missing.push("gênero");
        if (bookData.capa_url) found.push("capa"); else missing.push("capa");

        const correctedMsg = usedIsbn !== cleanIsbn ? "\n📝 ISBN corrigido automaticamente." : "";
        if (missing.length === 0) {
          toast({ title: "✅ Dados completos!", description: `Todos os 6 campos preenchidos automaticamente.${correctedMsg}` });
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
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mt-2">
                    <div className="flex gap-4 min-w-0 flex-1">
                      {livro.capa_url ? (
                        <img
                          src={livro.capa_url}
                          alt={livro.titulo}
                          className="w-16 h-24 object-cover rounded shadow-sm flex-shrink-0 clickable-image"
                          onClick={() => openLightbox(livro.capa_url!, livro.titulo)}
                        />
                      ) : (
                        <div className="w-16 h-24 bg-amber-100 flex items-center justify-center rounded shadow-sm flex-shrink-0">
                          <BookOpen className="h-8 w-8 text-amber-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-2">{livro.titulo}</h3>
                        <p className="text-sm text-foreground/80 mt-1 truncate"><span className="text-muted-foreground">Autor:</span> {livro.autor}</p>

                        <div className="flex flex-col gap-1.5 mt-3 bg-muted/30 p-2.5 rounded text-xs">
                          <p className="break-words"><span className="text-muted-foreground font-medium">Gênero:</span> {livro.genero || "—"}</p>
                          <p className="break-words"><span className="text-muted-foreground font-medium">Ano:</span> {livro.ano_publicacao || "—"}</p>
                          <p className="break-words"><span className="text-muted-foreground font-medium">Editora:</span> {livro.editora || "—"}</p>
                          <p className="break-words"><span className="text-muted-foreground font-medium">ISBN:</span> {livro.isbn || "—"}</p>
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
            );
          })}
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

export default Acervo;
