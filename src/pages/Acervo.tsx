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
      const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 5000): Promise<Response> => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      };

      const safeFetchJson = async (url: string, ms = 5000) => {
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
      // TRADUTOR DE GÊNEROS (EXPANDIDO)
      // ========================================
      const genrePriority: [RegExp, string][] = [
        [/fantasy|fantasia|magic|magia|wizard|feiticeiro|bruxa|witchcraft|witch|sorcery|alchemy|good and evil|supernatural|mytholog|fadas|fairy|enchant|encantad/i, "Fantasia"],
        [/science fiction|sci-fi|ficção científica|dystopi|distopi|futurist|cyberpunk|steampunk/i, "Ficção Científica"],
        [/adventure|aventura|action|quest|journey|viagem|expedição|exploraç/i, "Aventura"],
        [/mystery|mistério|detective|thriller|suspense|crime|policial|investigat|enigma|noir/i, "Suspense"],
        [/horror|terror|creepy|scary|ghost story|história de terror|sobrenatural|macabr|sinistro|assombr/i, "Terror"],
        [/romance|love|amor|romantic|paixão|passion|love story|história de amor|chick lit|relacionamento|relationship/i, "Romance"],
        [/drama|tragic|trágic|coming of age|amadurecimento|contemporary|contemporâne|literary fiction|ficção literária|crônica|cronica/i, "Drama"],
        [/fairy tale|conto de fadas|fable|fábula|folklore|folclore|lenda|legend|mito|myth/i, "Conto de Fadas"],
        [/historical fiction|ficção histórica|historical novel|romance histórico/i, "Ficção Histórica"],
        [/biography|biografia|autobiography|autobiografia|memoir|memória|memórias/i, "Biografia"],
        [/poetry|poesia|poem|poems|poema|soneto|haiku|verso/i, "Poesia"],
        [/humor|comedy|comédia|funny|engraçad|satir|sátira|piada/i, "Comédia"],
        [/education|educação|educational|didátic|pedagog|textbook|livro didático|ensino|teaching|escolar|paradidátic/i, "Educação"],
        [/religion|religião|spiritual|espiritual|bible|bíblia|faith|gospel|evangel|teolog/i, "Religião"],
        [/science|ciência|scientific|científic|physics|biology|chemistry|biolog|físic|químic|astronomia|geolog/i, "Ciência"],
        [/\bart\b|arte|music|música|painting|pintura|drawing|desenho|fotografia|photograph|cinema|teatro|theater/i, "Arte"],
        [/cooking|culinária|cookbook|receita|recipe|gastronom|food|comida|chef/i, "Culinária"],
        [/sport|esporte|athletic|atlético|football|futebol|soccer|olymp|olímpic|basquet|volei/i, "Esportes"],
        [/self-help|self help|autoajuda|auto-ajuda|motivational|motivacion|personal development|desenvolvimento pessoal|superação/i, "Autoajuda"],
        [/philosophy|filosofia|philosophical|filosóf|ética|ethics/i, "Filosofia"],
        [/psychology|psicologia|psychological|psicológ|mental health|saúde mental|comportament/i, "Psicologia"],
        [/business|negócios|management|gestão|marketing|entrepreneurship|empreended|financ|economia|econom/i, "Negócios"],
        [/technology|tecnologia|programming|programação|computer|computad|software|digital|inteligência artificial|ai\b|machine learning/i, "Tecnologia"],
        [/\bhistory\b|história|historical|guerra mundial|world war|civilizaç|civilization/i, "História"],
        [/literatura brasileira|brazilian literature|literatura nacional|cordel|sertão|nordeste/i, "Literatura Brasileira"],
        [/graphic novel|hq|quadrinhos|comics|manga|mangá|gibi/i, "HQ / Quadrinhos"],
        [/juvenile|children|infantil|infanto|young adult|teen|adolescent|middle grade|picture book|livro infantil|kids|criança/i, "Infanto-juvenil"],
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

      const extractTranslators = (names: any[], knownAuthors?: string[]): { authors: string, translators: string } => {
        if (!names || !Array.isArray(names) || names.length === 0) return { authors: "", translators: "" };
        const authorsList: string[] = [];
        const translatorsList: string[] = [];
        names.forEach(name => {
          if (typeof name !== 'string') return;
          const cleanName = name.replace(/,\s*$/, "").trim(); // Removendo vírgula sobressalente do final!
          if (!cleanName) return;
          if (/traduto|translato|traduçã/i.test(cleanName)) {
            translatorsList.push(cleanName.replace(/\s*\(\s*(Tradutor|Translator|Tradução|Trad)\s*\)/i, "").trim());
          } else if (knownAuthors && knownAuthors.length > 0 && names.length > knownAuthors.length) {
            // Se veio uma lista de autores originais (ex: do Google) e essa lista atual tem MAIS pessoas,
            // quem NÃO está na lista original provavelmente é o tradutor!
            const isOriginalAuthor = knownAuthors.some(ka => ka.toLowerCase().includes(cleanName.toLowerCase()) || cleanName.toLowerCase().includes(ka.toLowerCase()));
            if (!isOriginalAuthor) {
              translatorsList.push(cleanName);
            } else {
              authorsList.push(cleanName);
            }
          } else {
            authorsList.push(cleanName);
          }
        });
        return {
          authors: authorsList.join(", "),
          translators: translatorsList.join(", ")
        };
      };

      // Detectar gênero pela descrição do livro
      const genreFromDescription = (desc: string): string => {
        if (!desc) return "";
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
          [/quadrinhos|comics|manga|graphic novel|hq|gibi/i, "HQ / Quadrinhos"],
          [/poesia|poema|verso|rima|poetry|poem/i, "Poesia"],
          [/sertão|nordeste|cangaço|caatinga|cordel/i, "Literatura Brasileira"],
          [/universo paralelo|parallel|multiverso|multiverse|realidade alternativa|alternate|possibilidades|possibilities|vidas? alternativa/i, "Drama"],
        ];
        for (const [rx, lbl] of descPatterns) if (rx.test(desc)) return lbl;
        return "";
      };

      // ========================================
      // BUSCA ULTRA-PARALELA — TODAS AS VARIANTES AO MESMO TEMPO
      // ========================================
      type BookResult = { titulo: string; autor: string; tradutor: string; editora: string; ano: string; genero: string; capa_url: string; descricao: string; cats: string[]; googleVolumeId: string; score: number };

      const fetchSingleIsbn = async (isbn: string): Promise<BookResult> => {
        const b: BookResult = { titulo: "", autor: "", tradutor: "", editora: "", ano: "", genero: "", capa_url: "", descricao: "", cats: [], googleVolumeId: "", score: 0 };

        // === TODAS AS APIs EM PARALELO ===
        const [googleR, googlePtR, brasilR, olBooksR, olEditionR] = await Promise.allSettled([
          safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=3`),
          safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&langRestrict=pt&maxResults=3`),
          safeFetchJson(`https://brasilapi.com.br/api/isbn/v1/${isbn}?providers=mercado-editorial,cbl,open-library`, 8000),
          safeFetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`),
          safeFetchJson(`https://openlibrary.org/isbn/${isbn}.json`),
        ]);

        // Google Books em PT (prioridade)
        const gPt = googlePtR.status === "fulfilled" ? googlePtR.value : null;
        const gd = googleR.status === "fulfilled" ? googleR.value : null;

        // Prefere resultado em PT, senão usa resultado geral
        let bestGoogle = gPt?.items?.length > 0 ? gPt.items[0] : (gd?.items?.length > 0 ? gd.items[0] : null);

        // Tenta achar um match exato pelo ISBN nos resultados do Google
        const allGoogleItems = [...(gPt?.items || []), ...(gd?.items || [])];
        for (const item of allGoogleItems) {
          const ids = item.volumeInfo?.industryIdentifiers || [];
          if (ids.some((id: any) => id.identifier === isbn)) {
            bestGoogle = item;
            break;
          }
        }

        if (bestGoogle) {
          const v = bestGoogle.volumeInfo;
          b.googleVolumeId = bestGoogle.id || "";
          b.titulo = v.title || "";
          if (v.subtitle) b.titulo += ": " + v.subtitle;
          if (v.authors) {
            const ext = extractTranslators(v.authors);
            b.autor = ext.authors;
            b.tradutor = ext.translators;
          }
          b.editora = v.publisher || "";
          b.ano = v.publishedDate ? v.publishedDate.substring(0, 4) : "";
          b.capa_url = upgradeGoogleCover(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "");
          b.descricao = v.description || "";
          if (v.categories) b.cats.push(...v.categories);
          if (v.language === "pt") b.score += 5; // Bonus para resultados em PT
        }

        // BrasilAPI — SEMPRE sobrescreve para dados PT-BR
        const bd = brasilR.status === "fulfilled" ? brasilR.value : null;
        if (bd && !bd.message) {
          if (bd.title) { b.titulo = bd.title; b.score += 10; } // Maior confiança para dados BR
          if (bd.authors?.length > 0) {
            // Se o Google achar os autores originais, passamos para a BrasilAPI usar como crivo
            const knownOriginals = bestGoogle?.volumeInfo?.authors || [];
            const ext = extractTranslators(bd.authors, knownOriginals);
            b.autor = ext.authors || b.autor;
            if (ext.translators) b.tradutor = ext.translators;
          }
          if (bd.publisher) b.editora = bd.publisher;
          if (bd.year) b.ano = String(bd.year);
          if (bd.cover_url) b.capa_url = bd.cover_url;
          if (bd.synopsis) b.descricao = bd.synopsis;
          if (bd.subjects?.length > 0) {
            b.cats.push(...bd.subjects.filter((s: string) => !s.startsWith("series:")));
          }
        }

        // OpenLibrary Books
        const olb = olBooksR.status === "fulfilled" ? olBooksR.value : null;
        const olBook = olb?.[`ISBN:${isbn}`];
        if (olBook) {
          if (!b.titulo && olBook.title) b.titulo = olBook.title;
          if (olBook.authors) {
            const ext = extractTranslators(olBook.authors.map((a: any) => a.name));
            if (!b.autor && ext.authors) b.autor = ext.authors;
            if (!b.tradutor && ext.translators) b.tradutor = ext.translators;
          }
          if (!b.editora && olBook.publishers) b.editora = olBook.publishers.map((p: any) => p.name).join(", ");
          if (!b.ano && olBook.publish_date) b.ano = olBook.publish_date.match(/\d{4}/)?.[0] || "";
          if (!b.capa_url && olBook.cover) b.capa_url = olBook.cover.large || olBook.cover.medium || "";
          if (olBook.subjects) olBook.subjects.forEach((s: any) => b.cats.push(s.name || s));
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

        // Calcular score de completude
        if (b.titulo) b.score += 3;
        if (b.autor) b.score += 2;
        if (b.editora) b.score += 1;
        if (b.ano) b.score += 1;
        if (b.capa_url) b.score += 2;

        return b;
      };

      // ========================================
      // EXECUTAR TODAS AS VARIANTES EM PARALELO (MUITO MAIS RÁPIDO)
      // ========================================
      const allResults = await Promise.allSettled(allIsbns.map(isbn => fetchSingleIsbn(isbn)));

      // Coletar todos os resultados bem-sucedidos
      const validResults: { isbn: string; data: BookResult }[] = [];
      for (let i = 0; i < allResults.length; i++) {
        if (allResults[i].status === "fulfilled") {
          validResults.push({ isbn: allIsbns[i], data: (allResults[i] as PromiseFulfilledResult<BookResult>).value });
        }
      }

      // Selecionar o melhor resultado pelo score
      validResults.sort((a, b) => b.data.score - a.data.score);

      // Merge inteligente: pegar o melhor e preencher gaps com outros
      let bookData = { titulo: "", autor: "", tradutor: "", editora: "", ano: "", genero: "", capa_url: "", descricao: "" };
      let usedIsbn = correctedIsbn;
      let allCats: string[] = [];
      let bestGoogleVolumeId = "";

      if (validResults.length > 0) {
        const best = validResults[0];
        bookData.titulo = best.data.titulo;
        bookData.autor = best.data.autor;
        bookData.tradutor = best.data.tradutor;
        bookData.editora = best.data.editora;
        bookData.ano = best.data.ano;
        bookData.capa_url = best.data.capa_url;
        bookData.descricao = best.data.descricao;
        allCats = [...best.data.cats];
        bestGoogleVolumeId = best.data.googleVolumeId;
        if (best.data.titulo) usedIsbn = best.isbn;

        // Preencher gaps com dados de outros resultados
        for (let i = 1; i < validResults.length; i++) {
          const other = validResults[i].data;
          if (!bookData.titulo && other.titulo) { bookData.titulo = other.titulo; usedIsbn = validResults[i].isbn; }
          if (!bookData.autor && other.autor) bookData.autor = other.autor;
          if (!bookData.tradutor && other.tradutor) bookData.tradutor = other.tradutor;
          if (!bookData.editora && other.editora) bookData.editora = other.editora;
          if (!bookData.ano && other.ano) bookData.ano = other.ano;
          if (!bookData.capa_url && other.capa_url) bookData.capa_url = other.capa_url;
          if (!bookData.descricao && other.descricao) bookData.descricao = other.descricao;
          if (!bestGoogleVolumeId && other.googleVolumeId) bestGoogleVolumeId = other.googleVolumeId;
          allCats.push(...other.cats);
        }
      }

      // Aplicar gênero das categorias combinadas
      if (allCats.length > 0) {
        const g = bestGenre(allCats);
        if (g) bookData.genero = g;
      }

      // ========================================
      // ONDA 2 (APENAS SE FALTAM DADOS) — em paralelo
      // ========================================
      const needsCover = !bookData.capa_url;
      const needsGenre = !bookData.genero;

      if (bookData.titulo && (needsCover || needsGenre || !bookData.editora)) {
        const wave2: Promise<void>[] = [];

        // Google Volume Detail (melhor capa + editora + gênero)
        if (bestGoogleVolumeId && (needsCover || !bookData.editora || needsGenre)) {
          wave2.push(
            safeFetchJson(`https://www.googleapis.com/books/v1/volumes/${bestGoogleVolumeId}`).then(data => {
              const dv = data?.volumeInfo;
              if (!dv) return;
              if (!bookData.editora && dv.publisher) bookData.editora = dv.publisher;
              if (!bookData.descricao && dv.description) bookData.descricao = dv.description;
              if (dv.imageLinks) {
                const best = dv.imageLinks.extraLarge || dv.imageLinks.large || dv.imageLinks.medium || dv.imageLinks.small || dv.imageLinks.thumbnail || "";
                if (best && !bookData.capa_url) bookData.capa_url = upgradeGoogleCover(best);
              }
              if (dv.categories && !bookData.genero) {
                const g = bestGenre(dv.categories);
                if (g) bookData.genero = g;
              }
            })
          );
        }

        // OpenLibrary Search (gênero + capa fallback)
        if (needsGenre || needsCover) {
          const olQuery = bookData.titulo ? `title=${encodeURIComponent(bookData.titulo)}${bookData.autor ? `&author=${encodeURIComponent(bookData.autor)}` : ''}` : `isbn=${correctedIsbn}`;
          wave2.push(
            safeFetchJson(`https://openlibrary.org/search.json?${olQuery}&limit=1`).then(async (sd) => {
              const doc = sd?.docs?.[0];
              if (!doc) return;
              if (!bookData.titulo && doc.title) bookData.titulo = doc.title;
              if (doc.author_name) {
                const ext = extractTranslators(doc.author_name);
                if (!bookData.autor && ext.authors) bookData.autor = ext.authors;
                if (!bookData.tradutor && ext.translators) bookData.tradutor = ext.translators;
              }
              if (!bookData.editora && doc.publisher) bookData.editora = doc.publisher[0];
              if (!bookData.capa_url && doc.cover_i) bookData.capa_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
              if (!bookData.genero && doc.subject) {
                const g = bestGenre(doc.subject.slice(0, 20));
                if (g) bookData.genero = g;
              }
              if (!bookData.genero && doc.key) {
                const wd = await safeFetchJson(`https://openlibrary.org${doc.key}.json`);
                if (wd?.subjects?.length > 0) {
                  const g = bestGenre(wd.subjects.slice(0, 20));
                  if (g) bookData.genero = g;
                }
                if (!bookData.descricao && wd?.description) {
                  bookData.descricao = typeof wd.description === "string" ? wd.description : wd.description.value || "";
                }
              }
            })
          );
        }

        // Capas via OpenLibrary Covers (todas as variantes em paralelo)
        if (needsCover) {
          wave2.push(
            Promise.allSettled(
              allIsbns.map(v =>
                fetchWithTimeout(`https://covers.openlibrary.org/b/isbn/${v}-L.jpg?default=false`, { method: "HEAD", redirect: "manual" }, 4000)
                  .then(r => (r.status === 200 || r.status === 302) ? v : null)
                  .catch(() => null)
              )
            ).then(results => {
              for (const r of results) {
                if (r.status === "fulfilled" && r.value && !bookData.capa_url) {
                  bookData.capa_url = `https://covers.openlibrary.org/b/isbn/${r.value}-L.jpg`;
                  break;
                }
              }
            })
          );
        }

        await Promise.allSettled(wave2);
      }

      // Detectar gênero pela descrição se ainda não tem
      if (!bookData.genero && bookData.descricao) {
        bookData.genero = genreFromDescription(bookData.descricao);
      }

      // ========================================
      // 3. BUSCA DE TRADUÇÃO & FALLBACK FINAL
      // ========================================
      // Se a pontuação for < 10, significa que não achou nem na BrasilAPI nem no Google-PT. 
      // Provavelmente é um livro estrangeiro. Vamos tentar achar a edição traduzida!
      const isLikelyForeign = validResults.length > 0 && validResults[0].data.score < 10;

      if (bookData.titulo && (!bookData.capa_url || !bookData.genero || isLikelyForeign)) {
        // CORREÇÃO: Usar intitle e inauthor corretamente em vez de misturar
        const tituloLimpo = bookData.titulo.replace(/[^\w\s\u00C0-\u00FF]/gi, ' ').trim();
        const primeiroAutor = bookData.autor.split(',')[0].trim();
        const autorLimpo = primeiroAutor.replace(/[^\w\s\u00C0-\u00FF]/gi, ' ').trim();
        
        const qParts = [];
        if (tituloLimpo) qParts.push(`intitle:${tituloLimpo}`);
        if (autorLimpo && autorLimpo !== "Autor Desconhecido") qParts.push(`inauthor:${autorLimpo}`);
        const queryStr = encodeURIComponent(qParts.length > 0 ? qParts.join("+") : bookData.titulo);

        const gData = await safeFetchJson(
          `https://www.googleapis.com/books/v1/volumes?q=${queryStr}&langRestrict=pt&maxResults=5`
        );

        let translatedFound = false;

        for (const item of (gData?.items || [])) {
          const vi = item.volumeInfo;

          // Se for estrangeiro e o Google achou uma versão em PT-BR, substituímos os dados básicos pela tradução!
          if (isLikelyForeign && !translatedFound && vi?.language === "pt" && vi?.title) {
            bookData.titulo = vi.title; // Título traduzido!
            if (vi.authors) {
              const ext = extractTranslators(vi.authors);
              bookData.autor = ext.authors;
              bookData.tradutor = ext.translators;
            }
            if (vi.publisher) bookData.editora = vi.publisher;
            if (vi.description) {
              bookData.descricao = vi.description;
              const newG = genreFromDescription(vi.description);
              if (newG) bookData.genero = newG;
            }
            translatedFound = true;
          }

          if (!bookData.capa_url && vi?.imageLinks) {
            const c = vi.imageLinks.extraLarge || vi.imageLinks.large || vi.imageLinks.medium || vi.imageLinks.small || vi.imageLinks.thumbnail || "";
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
          if (bookData.capa_url && bookData.genero && (!isLikelyForeign || translatedFound)) break;
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
          tradutor: bookData.tradutor || prev.tradutor,
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

  const fetchBookByTitleAndAuthor = async () => {
    if (!form.titulo.trim() && !form.autor.trim()) {
      toast({ title: "Preencha o título ou autor", description: "Digite pelo menos o título ou o autor.", variant: "destructive" });
      return;
    }

    setFetchingIsbn(true);
    try {
      const fetchWithTimeout = (url: string, ms = 7000) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      };

      const safeFetchJson = async (url: string) => {
        try {
          const r = await fetchWithTimeout(url, 7000);
          return r.ok ? await r.json() : null;
        } catch { return null; }
      };

      const tituloLimpo = form.titulo.replace(/[^\w\s\u00C0-\u00FF]/gi, ' ').trim();
      const primeiroAutor = form.autor.split(',')[0].trim();
      const autorLimpo = primeiroAutor.replace(/[^\w\s\u00C0-\u00FF]/gi, ' ').trim();
      
      const qParts = [];
      if (tituloLimpo) qParts.push(`intitle:${tituloLimpo}`);
      if (autorLimpo) qParts.push(`inauthor:${autorLimpo}`);
      const queryStrGoogle = encodeURIComponent(qParts.length > 0 ? qParts.join("+") : (form.titulo || form.autor));
      const queryStrOL = encodeURIComponent((form.titulo + " " + primeiroAutor).trim());

      const [googlePtR, googleR, olR] = await Promise.allSettled([
        safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=${queryStrGoogle}&langRestrict=pt&maxResults=4`),
        safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=${queryStrGoogle}&maxResults=4`),
        safeFetchJson(`https://openlibrary.org/search.json?q=${queryStrOL}&limit=3`)
      ]);

      const gPt = googlePtR.status === "fulfilled" ? googlePtR.value : null;
      const gd = googleR.status === "fulfilled" ? googleR.value : null;

      let bestGoogle = gPt?.items?.length > 0 ? gPt.items[0] : (gd?.items?.length > 0 ? gd.items[0] : null);

      let bookData = { titulo: form.titulo, autor: form.autor, tradutor: form.tradutor, editora: form.editora, ano: form.ano_publicacao, genero: form.genero, capa_url: form.capa_url, isbn: form.isbn };
      let newDataFound = false;

      if (bestGoogle) {
        const v = bestGoogle.volumeInfo;
        newDataFound = true;
        if (!bookData.titulo && v.title) bookData.titulo = v.title + (v.subtitle ? ": " + v.subtitle : "");
        if (!bookData.autor && v.authors) bookData.autor = v.authors.join(", ");
        if (!bookData.editora && v.publisher) bookData.editora = v.publisher;
        if (!bookData.ano && v.publishedDate) bookData.ano = v.publishedDate.substring(0, 4);
        if (!bookData.capa_url && v.imageLinks) {
            bookData.capa_url = (v.imageLinks.extraLarge || v.imageLinks.large || v.imageLinks.medium || v.imageLinks.thumbnail || "").replace("http:", "https:").replace("&edge=curl", "");
        }
        if (!bookData.isbn && v.industryIdentifiers) {
           const id = v.industryIdentifiers.find((i: any) => i.type === "ISBN_13") || v.industryIdentifiers.find((i: any) => i.type === "ISBN_10");
           if (id) bookData.isbn = id.identifier;
        }
        if (!bookData.genero && v.categories && v.categories.length > 0) {
            bookData.genero = v.categories[0]; 
        }
      }

      const olData = olR.status === "fulfilled" ? olR.value : null;
      if (olData && olData.docs && olData.docs.length > 0) {
        const doc = olData.docs[0];
        newDataFound = true;
        if (!bookData.titulo && doc.title) bookData.titulo = doc.title;
        if (!bookData.autor && doc.author_name) bookData.autor = doc.author_name[0];
        if (!bookData.editora && doc.publisher) bookData.editora = doc.publisher[0];
        if (!bookData.capa_url && doc.cover_i) bookData.capa_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        if (!bookData.ano && doc.first_publish_year) bookData.ano = String(doc.first_publish_year);
      }

      setForm(prev => ({
        ...prev,
        titulo: bookData.titulo || prev.titulo,
        autor: bookData.autor || prev.autor,
        editora: bookData.editora || prev.editora,
        ano_publicacao: bookData.ano || prev.ano_publicacao,
        capa_url: bookData.capa_url || prev.capa_url,
        genero: bookData.genero || prev.genero,
        isbn: bookData.isbn || prev.isbn,
      }));

      if (newDataFound) {
        toast({ title: "✅ Busca concluída", description: "Dados adicionais preenchidos com sucesso." });
      } else {
        toast({ title: "Sem resultados", description: "Infelizmente não encontramos nenhum dado a mais com esse título e/ou autor nas bases de dados.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro na busca", description: "Ocorreu um erro inesperado ao buscar dados adicionais.", variant: "destructive" });
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
        <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
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
    </div>
  );
};

export default Acervo;
