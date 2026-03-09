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

            // === ONDA 1: 4 APIs EM PARALELO ===
            const [googleR, brasilR, olBooksR, olEditionR] = await Promise.allSettled([
                safeFetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`),
                safeFetchJson(`https://brasilapi.com.br/api/isbn/v1/${isbn}?providers=mercado-editorial,cbl,open-library`),
                safeFetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`),
                safeFetchJson(`https://openlibrary.org/isbn/${isbn}.json`),
            ]);

            // Google Books
            const gd = googleR.status === "fulfilled" ? googleR.value : null;
            if (gd?.items?.length > 0) {
                const v = gd.items[0].volumeInfo;
                googleVolumeId = gd.items[0].id || "";
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
                if (bd.title) b.titulo = bd.title; // Prefere título em PT
                if (bd.authors?.length > 0) b.autor = bd.authors.join(", ");
                if (bd.publisher) b.editora = bd.publisher;
                if (!b.ano && bd.year) b.ano = String(bd.year);
                if (bd.cover_url) b.capa_url = bd.cover_url;
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
