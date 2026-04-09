/**
 * ========================================
 * SERVIÇO DE BUSCA DE LIVROS — ENGINE V2
 * ========================================
 * 
 * Melhorias em relação à V1:
 * 1. Cache local em memória para evitar buscas duplicadas
 * 2. Deduplicação por ISBN (não reinsere livro que já está no acervo)
 * 3. Capas em alta resolução (Google Books publisher API + OpenLibrary -L)
 * 4. BrasilAPI com TODOS os providers disponíveis
 * 5. Timeout inteligente (curto para APIs rápidas, longo para lentas)
 * 6. Fallback de capa via Google Books Publisher Content API
 * 7. Limpeza automática de dados (trim, remoção de vírgulas extras)
 * 8. Detecção melhorada de tradutores (inclusive com dados da BrasilAPI)
 */

// ==========================================
// TIPOS
// ==========================================
export type BookSearchResult = {
  titulo: string;
  autor: string;
  tradutor: string;
  editora: string;
  ano: string;
  genero: string;
  capa_url: string;
  isbn: string;
  descricao: string;
  score: number;
  fonte: string; // Qual API encontrou os dados principais
};

export type SearchProgress = (msg: string) => void;

// ==========================================
// CACHE EM MEMÓRIA — evita buscas repetidas
// ==========================================
const searchCache = new Map<string, BookSearchResult>();
const MAX_CACHE_SIZE = 100;

function getCached(isbn: string): BookSearchResult | null {
  return searchCache.get(isbn) || null;
}

function setCache(isbn: string, result: BookSearchResult) {
  if (searchCache.size >= MAX_CACHE_SIZE) {
    // Remove a entrada mais antiga
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(isbn, result);
}

// ==========================================
// UTILITÁRIOS DE REDE
// ==========================================
const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 5000): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

const safeFetchJson = async (url: string, ms = 5000): Promise<any> => {
  try {
    const r = await fetchWithTimeout(url, {}, ms);
    return r.ok ? await r.json() : null;
  } catch { return null; }
};

// ==========================================
// UTILITÁRIOS DE ISBN
// ==========================================
export const fixIsbn13 = (isbn: string): string => {
  if (isbn.length !== 13) return isbn;
  const d = isbn.slice(0, 12).split("").map(Number);
  let s = 0; for (let i = 0; i < 12; i++) s += d[i] * (i % 2 === 0 ? 1 : 3);
  return isbn.slice(0, 12) + String((10 - (s % 10)) % 10);
};

export const fixIsbn10 = (isbn: string): string => {
  if (isbn.length !== 10) return isbn;
  const d = isbn.slice(0, 9).split("").map(Number);
  let s = 0; for (let i = 0; i < 9; i++) s += d[i] * (10 - i);
  const r = (11 - (s % 11)) % 11;
  return isbn.slice(0, 9) + (r === 10 ? "X" : String(r));
};

export const isbn13to10 = (i13: string): string => {
  if (i13.length !== 13 || !i13.startsWith("978")) return "";
  const core = i13.slice(3, 12), d = core.split("").map(Number);
  let s = 0; for (let i = 0; i < 9; i++) s += d[i] * (10 - i);
  const r = (11 - (s % 11)) % 11;
  return core + (r === 10 ? "X" : String(r));
};

export const isbn10to13 = (i10: string): string => {
  if (i10.length !== 10) return "";
  const core = "978" + i10.slice(0, 9), d = core.split("").map(Number);
  let s = 0; for (let i = 0; i < 12; i++) s += d[i] * (i % 2 === 0 ? 1 : 3);
  return core + String((10 - (s % 10)) % 10);
};

export const cleanIsbnInput = (raw: string): string => raw.replace(/[^0-9X]/gi, "");

export const getAllIsbnVariants = (isbn: string): string[] => {
  const corrected = isbn.length === 13 ? fixIsbn13(isbn) : fixIsbn10(isbn);
  const alt = corrected.length === 13 ? isbn13to10(corrected) : isbn10to13(corrected);
  return [...new Set([corrected, alt, isbn].filter(v => v && (v.length === 10 || v.length === 13)))];
};

// ==========================================
// CAPA EM ALTA RESOLUÇÃO E ANTI-ERROS
// ==========================================
const upgradeGoogleCover = (url: string): string => {
  if (!url) return "";
  // Força HTTPS, remove cantos enrolados (edge=curl) e tenta puxar o zoom mais limpo
  return url.replace("&edge=curl", "")
            .replace(/zoom=[1-9]/, "zoom=0")
            .replace("http:", "https:");
};

/** 
 * Tenta obter capa de alta resolução pelo Google Books Publisher Content API 
 */
const getHighResCover = (volumeId: string): string => {
  if (!volumeId) return "";
  return `https://books.google.com/books/publisher/content/images/frontcover/${volumeId}?fife=w600-h900&source=gbs_api`;
};

// ==========================================
// TRADUTORES E AUTORES
// ==========================================
export const extractTranslators = (names: any[], knownAuthors?: string[]): { authors: string, translators: string } => {
  if (!names || !Array.isArray(names) || names.length === 0) return { authors: "", translators: "" };
  const authorsList: string[] = [];
  const translatorsList: string[] = [];
  
  names.forEach(name => {
    if (typeof name !== 'string') return;
    const cleanName = name.replace(/,\s*$/, "").trim();
    if (!cleanName) return;
    
    if (/traduto|translato|traduçã|trad\./i.test(cleanName)) {
      translatorsList.push(cleanName.replace(/\s*\(\s*(Tradutor|Translator|Tradução|Trad\.?)\s*\)/i, "").trim());
    } else if (knownAuthors && knownAuthors.length > 0 && names.length > knownAuthors.length) {
      const isOriginalAuthor = knownAuthors.some(ka => 
        ka.toLowerCase().includes(cleanName.toLowerCase()) || 
        cleanName.toLowerCase().includes(ka.toLowerCase())
      );
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

// ==========================================
// GÊNEROS — MAPEAMENTO EXPANDIDO V2
// ==========================================
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
    [/universo paralelo|parallel|multiverso|multiverse|realidade alternativa|alternate/i, "Drama"],
  ];
  for (const [rx, lbl] of descPatterns) if (rx.test(desc)) return lbl;
  return "";
};

// ==========================================
// BUSCA POR ISBN — API ÚNICA (para cada variante)
// ==========================================
type RawBookResult = {
  titulo: string;
  autor: string;
  tradutor: string;
  editora: string;
  ano: string;
  genero: string;
  capa_url: string;
  descricao: string;
  cats: string[];
  googleVolumeId: string;
  score: number;
  tem_capa_boa: boolean; // Indica se achamos uma capa local confiável
};

const fetchSingleIsbn = async (isbn: string): Promise<RawBookResult> => {
  const b: RawBookResult = { titulo: "", autor: "", tradutor: "", editora: "", ano: "", genero: "", capa_url: "", descricao: "", cats: [], googleVolumeId: "", score: 0, tem_capa_boa: false };

  // === ONDA 1: TODAS AS APIs EM PARALELO ===
  const [googleR, googlePtR, brasilR, olBooksR, olEditionR, brasilAllR] = await Promise.allSettled([
    safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=3`),
    safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&langRestrict=pt&maxResults=3`),
    safeFetchJson(`https://brasilapi.com.br/api/isbn/v1/${isbn}?providers=mercado-editorial,cbl,open-library`, 8000),
    safeFetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`),
    safeFetchJson(`https://openlibrary.org/isbn/${isbn}.json`),
    safeFetchJson(`https://brasilapi.com.br/api/isbn/v1/${isbn}`, 10000),
  ]);

  // === PROCESSAR GOOGLE BOOKS ===
  const gPt = googlePtR.status === "fulfilled" ? googlePtR.value : null;
  const gd = googleR.status === "fulfilled" ? googleR.value : null;

  let bestGoogle = gPt?.items?.length > 0 ? gPt.items[0] : (gd?.items?.length > 0 ? gd.items[0] : null);

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
    b.descricao = v.description || "";
    if (v.categories) b.cats.push(...v.categories);
    if (v.language === "pt") b.score += 5;

    // CAPA: Se for capa miniatura, rejeita temporariamente para abrir espaço para a BrasilAPI pegar a boa
    if (v.imageLinks) {
      const isHighRes = !!(v.imageLinks.extraLarge || v.imageLinks.large || v.imageLinks.medium);
      const isLowRes = !!(v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
      b.capa_url = upgradeGoogleCover(v.imageLinks.extraLarge || v.imageLinks.large || v.imageLinks.medium || v.imageLinks.thumbnail || "");
      b.tem_capa_boa = isHighRes; // Se for miniatura lixo, tem_capa_boa = false
    }
    // ESTRATÉGIA SUPREMA: se for a API do Google (e não for miniatura fraca), usar o Content Publisher API
    if (!b.tem_capa_boa && b.googleVolumeId && v.language !== "en") {
      b.capa_url = getHighResCover(b.googleVolumeId);
      b.tem_capa_boa = true;
    }
  }

  // === PROCESSAR BRASILAPI (MAIOR CONFIABILIDADE DE CAPAS NACIONAIS) ===
  const bd = brasilR.status === "fulfilled" ? brasilR.value : null;
  const bdAll = brasilAllR.status === "fulfilled" ? brasilAllR.value : null;
  const bestBd = (bd && !bd.message) ? bd : ((bdAll && !bdAll.message) ? bdAll : null);

  if (bestBd) {
    if (!b.titulo || (bestBd.title && bestBd.title.length > b.titulo.length)) { b.titulo = bestBd.title; b.score += 10; }
    if (bestBd.authors?.length > 0) {
      const ext = extractTranslators(bestBd.authors);
      b.autor = ext.authors || b.autor;
      if (ext.translators) b.tradutor = ext.translators;
    }
    if (bestBd.publisher) b.editora = bestBd.publisher;
    if (bestBd.year) b.ano = String(bestBd.year);
    if (bestBd.synopsis) b.descricao = bestBd.synopsis;
    if (bestBd.subjects?.length > 0) {
      b.cats.push(...bestBd.subjects.filter((s: string) => !s.startsWith("series:")));
    }
    if (bestBd.page_count && !b.descricao) b.descricao = `${bestBd.page_count} páginas`;
    
    // SUPREMO: Prioridade ABSOLUTA para a capa da BrasilAPI / CBL. Ela é a certa 99% das vezes para nacionais.
    if (bestBd.cover_url && (bestBd.cover_url.includes("mercadoeditorial") || bestBd.cover_url.includes("cbl") || !b.tem_capa_boa)) {
      b.capa_url = bestBd.cover_url;
      b.tem_capa_boa = true;
      b.score += 20; // Capa nacional garantida dá score gigante
    }
  }

  // === PROCESSAR OPENLIBRARY ===
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
    if (!b.tem_capa_boa && olBook.cover) {
      b.capa_url = olBook.cover.large || olBook.cover.medium || b.capa_url;
      if (olBook.cover.large) b.tem_capa_boa = true;
    }
    if (olBook.subjects) olBook.subjects.forEach((s: any) => b.cats.push(s.name || s));
  }

  const olE = olEditionR.status === "fulfilled" ? olEditionR.value : null;
  if (olE) {
    if (olE.publish_date) {
      const ym = olE.publish_date.match(/\d{4}/);
      if (ym && (!b.ano || parseInt(ym[0]) > parseInt(b.ano))) b.ano = ym[0];
    }
    if (!b.editora && olE.publishers?.length > 0) b.editora = olE.publishers[0];
    if (!b.descricao && olE.number_of_pages) b.descricao = `${olE.number_of_pages} páginas`;
  }

  // Score base complementar
  if (b.titulo) b.score += 3;
  if (b.autor) b.score += 2;
  if (b.editora) b.score += 1;
  if (b.ano) b.score += 1;
  if (b.tem_capa_boa) b.score += 5;

  return b;
};

// ==========================================
// BUSCA PRINCIPAL — ORQUESTRADOR
// ==========================================
export async function searchBookByIsbn(
  rawIsbn: string,
  onProgress?: SearchProgress
): Promise<BookSearchResult | null> {
  const cleanIsbn = cleanIsbnInput(rawIsbn);

  if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
    return null;
  }

  // Checar cache
  const cached = getCached(cleanIsbn);
  if (cached) {
    onProgress?.("✅ Resultado encontrado no cache!");
    return cached;
  }

  const allIsbns = getAllIsbnVariants(cleanIsbn);
  const correctedIsbn = allIsbns[0];

  onProgress?.("Consultando Google Books, BrasilAPI, OpenLibrary...");
  // ONDA 1 principal
  const allResults = await Promise.allSettled(allIsbns.map(isbn => fetchSingleIsbn(isbn)));

  onProgress?.("Analisando resultados e refinando capas...");

  const validResults: { isbn: string; data: RawBookResult }[] = [];
  for (let i = 0; i < allResults.length; i++) {
    if (allResults[i].status === "fulfilled" && (allResults[i] as any).value.titulo) {
      validResults.push({ isbn: allIsbns[i], data: (allResults[i] as any).value });
    }
  }
  validResults.sort((a, b) => b.data.score - a.data.score);

  let bookData = { titulo: "", autor: "", tradutor: "", editora: "", ano: "", genero: "", capa_url: "", descricao: "", tem_capa_boa: false };
  let usedIsbn = correctedIsbn;
  let allCats: string[] = [];
  let bestGoogleVolumeId = "";
  let bestFonte = "desconhecida";

  if (validResults.length > 0) {
    const best = validResults[0];
    bookData.titulo = best.data.titulo;
    bookData.autor = best.data.autor;
    bookData.tradutor = best.data.tradutor;
    bookData.editora = best.data.editora;
    bookData.ano = best.data.ano;
    bookData.capa_url = best.data.capa_url;
    bookData.descricao = best.data.descricao;
    bookData.tem_capa_boa = best.data.tem_capa_boa;
    allCats = [...best.data.cats];
    bestGoogleVolumeId = best.data.googleVolumeId;
    usedIsbn = best.isbn;
    bestFonte = best.data.score >= 20 ? "BrasilAPI" : "Google Books";

    // Preencher gaps, COM PRIORIDADE PARA CAPAS CONFIAVEIS
    for (let i = 1; i < validResults.length; i++) {
      const other = validResults[i].data;
      if (!bookData.titulo && other.titulo) bookData.titulo = other.titulo;
      if (!bookData.autor && other.autor) bookData.autor = other.autor;
      if (!bookData.tradutor && other.tradutor) bookData.tradutor = other.tradutor;
      if (!bookData.editora && other.editora) bookData.editora = other.editora;
      if (!bookData.ano && other.ano) bookData.ano = other.ano;
      if (!bookData.descricao && other.descricao) bookData.descricao = other.descricao;
      if (!bestGoogleVolumeId && other.googleVolumeId) bestGoogleVolumeId = other.googleVolumeId;
      allCats.push(...other.cats);
      
      // Merge supremo de capas: Só sobrescrever a capa principal se a atual não for boa e a Other for garantida.
      if (!bookData.tem_capa_boa && other.tem_capa_boa) {
        bookData.capa_url = other.capa_url;
        bookData.tem_capa_boa = true;
      } else if (!bookData.capa_url && other.capa_url) {
        bookData.capa_url = other.capa_url;
      }
    }
  }

  if (allCats.length > 0) {
    const g = bestGenre(allCats);
    if (g) bookData.genero = g;
  }

  // === ONDA 2: CAÇADOR DE CAPAS (SUPREMO) ===
  // Se ainda estivermos sem capa "boa" (miniatura ou erro), tentamos cirurgicamente com o ISBN ORINAL, nunca o alternativo gringo
  const needsCover = !bookData.tem_capa_boa || !bookData.capa_url;
  const needsGenre = !bookData.genero;

  if (bookData.titulo && (needsCover || needsGenre)) {
    onProgress?.("Resgatando capas em alta qualidade...");
    const wave2: Promise<void>[] = [];

    // TENTATIVA MAXIMA: API direta da Open Library para o ISBN ORIGINAL escaneado. Evita capa gringa errada.
    if (needsCover && cleanIsbn) {
      wave2.push(
        fetchWithTimeout(`https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`, { method: "HEAD", redirect: "manual" }, 3000)
          .then(r => {
             if (r.status === 200 || r.status === 302) {
               bookData.capa_url = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
               bookData.tem_capa_boa = true;
             }
          }).catch(() => {})
      );
    }

    // Google Volume Detail aprofundado se faltar coisas
    if (bestGoogleVolumeId && (!bookData.editora || needsGenre)) {
      wave2.push(
        safeFetchJson(`https://www.googleapis.com/books/v1/volumes/${bestGoogleVolumeId}`).then(data => {
          const dv = data?.volumeInfo;
          if (!dv) return;
          if (!bookData.editora && dv.publisher) bookData.editora = dv.publisher;
          if (!bookData.descricao && dv.description) bookData.descricao = dv.description;
          if (dv.categories && !bookData.genero) {
             bookData.genero = bestGenre(dv.categories) || bookData.genero;
          }
        })
      );
    }

    await Promise.allSettled(wave2);
  }

  if (!bookData.genero && bookData.descricao) {
    bookData.genero = genreFromDescription(bookData.descricao);
  }

  // === ONDA 3: Busca de tradução (livro estrangeiro) ===
  const isLikelyForeign = bestFonte === "Google Books" && (!bookData.editora || !bookData.genero);

  if (bookData.titulo && (!bookData.capa_url || !bookData.genero || isLikelyForeign)) {
    onProgress?.("Buscando versão traduzida...");
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
      if (isLikelyForeign && !translatedFound && vi?.language === "pt" && vi?.title) {
        bookData.titulo = vi.title;
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

  // === RESULTADO FINAL ===
  if (bookData.titulo && !bookData.genero) bookData.genero = "Geral";
  if (bookData.titulo && !bookData.autor) bookData.autor = "Autor Desconhecido";

  if (!bookData.titulo && !bookData.autor) {
    return null;
  }

  const result: BookSearchResult = {
    titulo: bookData.titulo.trim(),
    autor: bookData.autor.trim(),
    tradutor: bookData.tradutor.trim(),
    editora: bookData.editora.trim(),
    ano: bookData.ano.trim(),
    genero: bookData.genero.trim(),
    capa_url: bookData.capa_url.trim(),
    isbn: usedIsbn,
    descricao: bookData.descricao,
    score: validResults.length > 0 ? validResults[0].data.score : 0,
    fonte: bestFonte,
  };

  // Salvar no cache
  setCache(cleanIsbn, result);
  if (usedIsbn !== cleanIsbn) setCache(usedIsbn, result);

  return result;
}

// ==========================================
// BUSCA POR TÍTULO E AUTOR
// ==========================================
export async function searchBookByTitleAuthor(
  titulo: string,
  autor: string,
  onProgress?: SearchProgress
): Promise<Partial<BookSearchResult> | null> {
  if (!titulo.trim() && !autor.trim()) return null;

  onProgress?.("Buscando por título/autor...");

  const tituloLimpo = titulo.replace(/[^\w\s\u00C0-\u00FF]/gi, ' ').trim();
  const primeiroAutor = autor.split(',')[0].trim();
  const autorLimpo = primeiroAutor.replace(/[^\w\s\u00C0-\u00FF]/gi, ' ').trim();

  const qParts = [];
  if (tituloLimpo) qParts.push(`intitle:${tituloLimpo}`);
  if (autorLimpo) qParts.push(`inauthor:${autorLimpo}`);
  const queryStrGoogle = encodeURIComponent(qParts.length > 0 ? qParts.join("+") : (titulo || autor));
  const queryStrOL = encodeURIComponent((titulo + " " + primeiroAutor).trim());

  const [googlePtR, googleR, olR] = await Promise.allSettled([
    safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=${queryStrGoogle}&langRestrict=pt&maxResults=4`),
    safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=${queryStrGoogle}&maxResults=4`),
    safeFetchJson(`https://openlibrary.org/search.json?q=${queryStrOL}&limit=3`),
  ]);

  const gPt = googlePtR.status === "fulfilled" ? googlePtR.value : null;
  const gd = googleR.status === "fulfilled" ? googleR.value : null;
  const bestGoogle = gPt?.items?.length > 0 ? gPt.items[0] : (gd?.items?.length > 0 ? gd.items[0] : null);

  const result: Partial<BookSearchResult> = {};
  let found = false;

  if (bestGoogle) {
    const v = bestGoogle.volumeInfo;
    found = true;
    if (v.title) result.titulo = v.title + (v.subtitle ? ": " + v.subtitle : "");
    if (v.authors) result.autor = v.authors.join(", ");
    if (v.publisher) result.editora = v.publisher;
    if (v.publishedDate) result.ano = v.publishedDate.substring(0, 4);
    if (v.imageLinks) {
      result.capa_url = upgradeGoogleCover(
        v.imageLinks.extraLarge || v.imageLinks.large || v.imageLinks.medium || v.imageLinks.thumbnail || ""
      );
    }
    if (v.industryIdentifiers) {
      const id = v.industryIdentifiers.find((i: any) => i.type === "ISBN_13") || v.industryIdentifiers.find((i: any) => i.type === "ISBN_10");
      if (id) result.isbn = id.identifier;
    }
    if (v.categories?.length > 0) {
      const g = bestGenre(v.categories);
      result.genero = g || v.categories[0];
    }
  }

  const olData = olR.status === "fulfilled" ? olR.value : null;
  if (olData?.docs?.length > 0) {
    const doc = olData.docs[0];
    found = true;
    if (!result.titulo && doc.title) result.titulo = doc.title;
    if (!result.autor && doc.author_name) result.autor = doc.author_name[0];
    if (!result.editora && doc.publisher) result.editora = doc.publisher[0];
    if (!result.capa_url && doc.cover_i) result.capa_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    if (!result.ano && doc.first_publish_year) result.ano = String(doc.first_publish_year);
  }

  return found ? result : null;
}

// ==========================================
// ESTATÍSTICAS DE BUSCA
// ==========================================
export function getSearchStats(result: BookSearchResult): { found: string[], missing: string[] } {
  const found: string[] = [], missing: string[] = [];
  if (result.titulo) found.push("título"); else missing.push("título");
  if (result.autor && result.autor !== "Autor Desconhecido") found.push("autor"); else missing.push("autor");
  if (result.editora) found.push("editora"); else missing.push("editora");
  if (result.ano) found.push("ano"); else missing.push("ano");
  if (result.genero && result.genero !== "Geral") found.push("gênero"); else missing.push("gênero");
  if (result.capa_url) found.push("capa"); else missing.push("capa");
  return { found, missing };
}
