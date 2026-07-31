class SeriesExplorer {
    constructor() {
        const usesSeparateLocalServer =
            window.location.protocol === "file:" ||
            (
                ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
                window.location.port !== "3000"
            );
        this.API_BASE_URL = usesSeparateLocalServer
            ? "http://127.0.0.1:3000/api"
            : "/api";
        this.IMAGE_URL = "https://image.tmdb.org/t/p/w500";
        this.BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";
        this.PROVIDER_URL = "https://image.tmdb.org/t/p/w92";
        this.genres = {};
        this.page = 1;
        this.query = "";
        this.filters = { genre: "", year: "", sort: "popularity.desc" };
        this.controller = null;
        this.cache = new Map();
        this.imdbCache = new Map();
        this.activeSeriesId = null;
        this.lastFocused = null;
        this.themeKey = "seyirAtlasiTheme";
        this.accountId = this.getAccountId();
        this.libraryKey = `seyirAtlasiSeriesLibrary:${this.accountId || "guest"}`;
        this.library = this.loadLibrary();
        this.favorites = new Set(Object.keys(this.library.favorites));
        this.fallback = this.createFallback();
        this.pusulaLastTitles = [];
        this.pusulaRequestController = null;
        this.init();
    }

    async init() {
        this.updatePusulaTimeCopy();
        this.applyTheme(localStorage.getItem(this.themeKey) || "dark");
        this.setupEvents();
        this.setupYears();
        this.renderLibrary();
        await this.loadGenres();
        this.renderLibrary();
        await Promise.all([this.loadTrending(), this.loadSeries()]);
    }

    updatePusulaTimeCopy() {
        const hour = Number(new Intl.DateTimeFormat("tr-TR", {
            timeZone: "Europe/Istanbul",
            hour: "2-digit",
            hourCycle: "h23"
        }).format(new Date()));
        let daypart = "bu gece";
        if (hour >= 5 && hour < 11) daypart = "bu sabah";
        else if (hour >= 11 && hour < 17) daypart = "bugün öğlen";
        else if (hour >= 17 && hour < 22) daypart = "bu akşam";
        document.querySelectorAll("[data-pusula-daypart]").forEach((element) => {
            const start = element.parentElement?.tagName === "LEGEND";
            element.textContent = start
                ? daypart[0].toLocaleUpperCase("tr-TR") + daypart.slice(1)
                : daypart;
        });
    }

    setupEvents() {
        const search = document.getElementById("seriesSearchInput");
        const genre = document.getElementById("seriesGenreFilter");
        const year = document.getElementById("seriesYearFilter");
        const sort = document.getElementById("seriesSortFilter");
        let timer;

        search?.addEventListener("input", (event) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.query = event.target.value.trim();
                this.page = 1;
                this.loadSeries();
            }, 450);
        });

        [genre, year, sort].forEach((control) => control?.addEventListener("change", () => {
            this.filters = { genre: genre.value, year: year.value, sort: sort.value };
            this.page = 1;
            this.loadSeries();
        }));

        document.getElementById("seriesClearBtn")?.addEventListener("click", () => {
            search.value = "";
            genre.value = "";
            year.value = "";
            sort.value = "popularity.desc";
            this.query = "";
            this.filters = { genre: "", year: "", sort: "popularity.desc" };
            this.page = 1;
            this.loadSeries();
        });

        document.getElementById("seriesLoadMoreBtn")?.addEventListener("click", () => {
            this.page += 1;
            this.loadSeries(true);
        });
        document.getElementById("seriesTrendingPrev")?.addEventListener("click", () => this.scrollCarousel(-1));
        document.getElementById("seriesTrendingNext")?.addEventListener("click", () => this.scrollCarousel(1));
        const recommendModal = document.getElementById("seriesRecommendModal");
        document.getElementById("seriesRecommendTrigger")?.addEventListener("click", () => {
            this.resetPusula();
            recommendModal.hidden = false;
            recommendModal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");
            document.getElementById("seriesPusulaInput")?.focus();
        });
        recommendModal?.querySelectorAll("[data-close-series-recommend]").forEach((button) => {
            button.addEventListener("click", () => {
                recommendModal.hidden = true;
                recommendModal.setAttribute("aria-hidden", "true");
                document.body.classList.remove("modal-open");
                this.resetPusula();
                document.getElementById("seriesRecommendTrigger")?.focus();
            });
        });
        document.getElementById("seriesRecommendForm")?.addEventListener("submit", (event) => {
            event.preventDefault();
            const input = document.getElementById("seriesPusulaInput");
            const message = input?.value.trim() || "";
            const preferences = this.getPusulaPreferences();
            input.value = "";
            this.createRecommendations(message, preferences);
        });
        document.getElementById("seriesPusulaQuestions")?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-pusula-value]");
            const group = button?.closest("[data-pusula-group]");
            if (!button || !group) return;
            if (group.hasAttribute("data-pusula-multiple")) {
                button.classList.toggle("is-selected");
                return;
            }
            const selected = button.classList.contains("is-selected");
            group.querySelectorAll("[data-pusula-value]")
                .forEach((item) => item.classList.remove("is-selected"));
            if (!selected) button.classList.add("is-selected");
            if (group.dataset.pusulaGroup === "type") {
                this.updatePusulaDurationOptions(button.dataset.pusulaValue);
            }
        });
        document.getElementById("seriesPusulaInput")?.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                document.getElementById("seriesRecommendForm")?.requestSubmit();
            }
        });
        document.getElementById("themeToggle")?.addEventListener("click", () => {
            const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
            localStorage.setItem(this.themeKey, next);
            this.applyTheme(next);
        });

        document.addEventListener("click", (event) => {
            const action = event.target.closest("[data-series-action]");
            if (action) {
                event.stopPropagation();
                this.toggleLibraryAction(
                    action.dataset.seriesAction,
                    action.dataset.seriesId
                );
                return;
            }
            const remove = event.target.closest("[data-series-remove]");
            if (remove) {
                event.stopPropagation();
                this.removeFromLibrary(remove.dataset.seriesRemove, remove.dataset.seriesId);
                return;
            }
            const customRemove = event.target.closest("[data-series-custom-remove]");
            if (customRemove) {
                event.stopPropagation();
                this.removeFromCustomList(customRemove.dataset.listId, customRemove.dataset.seriesId);
                return;
            }
            const deleteList = event.target.closest("[data-delete-series-list]");
            if (deleteList) {
                this.deleteCustomList(deleteList.dataset.deleteSeriesList);
                return;
            }
            const card = event.target.closest("[data-series-id]");
            if (card) {
                const recommendModal = card.closest("#seriesRecommendModal");
                if (recommendModal) {
                    recommendModal.hidden = true;
                    recommendModal.setAttribute("aria-hidden", "true");
                    document.body.classList.remove("modal-open");
                    this.resetPusula();
                }
                this.openModal(card.dataset.seriesId);
            }
        });
        document.addEventListener("keydown", (event) => {
            const card = event.target.closest("[data-series-id]");
            if (card && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                this.openModal(card.dataset.seriesId);
            }
            if (event.key === "Escape") this.closeModal();
            if (
                event.key === "Escape" &&
                recommendModal &&
                !recommendModal.hidden
            ) {
                recommendModal.hidden = true;
                recommendModal.setAttribute("aria-hidden", "true");
                document.body.classList.remove("modal-open");
                this.resetPusula();
            }
        });
        document.getElementById("seriesModalClose")?.addEventListener("click", () => this.closeModal());
        document.querySelector("[data-close-series-modal]")?.addEventListener("click", () => this.closeModal());

        const listForm = document.getElementById("seriesCustomListForm");
        document.getElementById("seriesNewListToggle")?.addEventListener("click", () => {
            listForm.hidden = false;
            listForm.querySelector("input")?.focus();
        });
        document.getElementById("seriesCustomListCancel")?.addEventListener("click", () => {
            listForm.hidden = true;
            listForm.reset();
        });
        listForm?.addEventListener("submit", (event) => this.createCustomList(event));
        document.addEventListener("change", (event) => {
            const select = event.target.closest("[data-series-list-picker]");
            if (!select || !select.value) return;
            this.addToCustomList(select.value, select.dataset.seriesId);
            select.value = "";
        });
    }

    applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        const button = document.getElementById("themeToggle");
        if (button) {
            const light = theme === "light";
            button.innerHTML = light
                ? `<svg class="theme-icon theme-icon-moon" aria-hidden="true" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>`
                : `<svg class="theme-icon theme-icon-sun" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
            button.setAttribute("aria-label", light ? "Koyu temaya geç" : "Açık temaya geç");
        }
    }

    buildUrl(endpoint, params = {}) {
        const url = new URL(`${this.API_BASE_URL}/tmdb`, window.location.href);
        url.searchParams.set("path", endpoint);
        Object.entries({ language: "tr-TR", region: "TR", ...params })
            .forEach(([key, value]) => value !== "" && value != null && url.searchParams.set(key, value));
        return url.toString();
    }

    async fetchData(endpoint, params = {}, signal) {
        const response = await fetch(this.buildUrl(endpoint, params), { signal });
        if (!response.ok) throw new Error(`TMDB ${response.status}`);
        return response.json();
    }

    async fetchImdb(item) {
        const id = String(item.id);
        if (this.imdbCache.has(id)) return this.imdbCache.get(id);
        try {
            const external = item.external_ids || await this.fetchData(`/tv/${id}/external_ids`);
            if (!external.imdb_id) return null;
            const url = new URL(`${this.API_BASE_URL}/omdb`, window.location.href);
            url.searchParams.set("i", external.imdb_id);
            url.searchParams.set("plot", "short");
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            if (data.Response === "False") return null;
            const result = { ...data, imdbId: external.imdb_id };
            this.imdbCache.set(id, result);
            return result;
        } catch {
            return null;
        }
    }

    async enrichWithImdb(items) {
        return Promise.all(items.map(async (item) => {
            const omdb = await this.fetchImdb(item);
            return {
                ...item,
                omdb,
                imdb_rating: omdb?.imdbRating && omdb.imdbRating !== "N/A"
                    ? Number(omdb.imdbRating)
                    : null
            };
        }));
    }

    async loadGenres() {
        try {
            const data = await this.fetchData("/genre/tv/list");
            const select = document.getElementById("seriesGenreFilter");
            data.genres?.forEach((genre) => {
                this.genres[genre.id] = genre.name;
                select?.insertAdjacentHTML("beforeend", `<option value="${genre.id}">${this.escape(genre.name)}</option>`);
            });
        } catch (error) {
            console.error("Dizi türleri yüklenemedi:", error);
        }
    }

    setupYears() {
        const select = document.getElementById("seriesYearFilter");
        for (let year = new Date().getFullYear(); year >= 1950; year -= 1) {
            select?.insertAdjacentHTML("beforeend", `<option value="${year}">${year}</option>`);
        }
    }

    skeleton(count, trending = false) {
        return Array.from({ length: count }, () => `
            <div class="skeleton-card ${trending ? "is-trending" : ""}" aria-hidden="true">
                <div class="skeleton-poster"></div><div class="skeleton-copy"><i></i><i></i><i></i></div>
            </div>`).join("");
    }

    async loadTrending() {
        const container = document.getElementById("seriesTrendingCarousel");
        if (!container) return;
        container.innerHTML = this.skeleton(5, true);
        try {
            let candidates = [];
            let page = 1;
            while (candidates.length < 10 && page <= 5) {
                const data = await this.fetchData("/trending/tv/week", { page });
                candidates = candidates.concat(
                    (data.results || []).filter((item) => this.hasValidTurkishSeries(item))
                );
                page += 1;
            }
            const series = await this.enrichWithImdb(
                this.uniqueSeries(candidates).slice(0, 10)
            );
            series.forEach((item) => this.cache.set(String(item.id), item));
            container.innerHTML = series.map((item, index) => this.trendingCard(item, index + 1)).join("");
        } catch {
            container.innerHTML = `<div class="error">Popüler diziler şu anda yüklenemedi.</div>`;
        }
    }

    async loadSeries(append = false) {
        const grid = document.getElementById("seriesGrid");
        if (!grid) return;
        if (!append) grid.innerHTML = this.skeleton(10);
        this.controller?.abort();
        this.controller = new AbortController();
        try {
            const endpoint = this.query ? "/search/tv" : "/discover/tv";
            const baseParams = this.query
                ? { query: this.query }
                : {
                    sort_by: this.filters.sort === "imdb_rating.desc"
                        ? "popularity.desc"
                        : this.filters.sort,
                    with_genres: this.filters.genre,
                    first_air_date_year: this.filters.year,
                    "vote_count.gte": this.filters.sort === "imdb_rating.desc" ? 200 : ""
                };
            const targetCount =
                window.matchMedia("(max-width: 580px)").matches
                    ? 15
                    : 15;
            const startPage = this.page;
            let fetchPage = startPage;
            let totalPages = startPage;
            let series = [];

            while (
                series.length < targetCount &&
                fetchPage <= totalPages &&
                fetchPage < startPage + 20
            ) {
                const data = this.query
                    ? await this.searchSeriesAcrossLanguages(
                        {
                            ...baseParams,
                            page: fetchPage
                        },
                        this.controller.signal
                    )
                    : await this.fetchData(
                        endpoint,
                        { ...baseParams, page: fetchPage },
                        this.controller.signal
                    );
                totalPages = Number(data.total_pages) || fetchPage;
                let pageSeries = (data.results || []).filter((item) => {
                    return this.query
                        ? this.hasStandardSeriesSearchResult(item)
                        : item.poster_path && this.hasValidTurkishSeries(item);
                });
                if (this.query && this.filters.genre) {
                    pageSeries = pageSeries.filter((item) => item.genre_ids?.includes(Number(this.filters.genre)));
                }
                if (this.query && this.filters.year) {
                    pageSeries = pageSeries.filter((item) => item.first_air_date?.startsWith(this.filters.year));
                }
                series = this.uniqueSeries(series.concat(pageSeries));
                fetchPage += 1;
            }

            this.page = fetchPage - 1;
            series = await this.enrichWithImdb(series.slice(0, targetCount));
            if (this.filters.sort === "imdb_rating.desc") {
                series.sort((first, second) => {
                    return Number(second.imdb_rating || 0) - Number(first.imdb_rating || 0);
                });
            }
            series.forEach((item) => this.cache.set(String(item.id), item));
            this.renderSeries(series, append);
            this.updateToolbar(series.length, append);
            document.getElementById("seriesLoadMoreBtn").hidden = this.page >= totalPages;
        } catch (error) {
            if (error.name === "AbortError") return;
            grid.innerHTML = `<div class="error">Diziler yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.</div>`;
        }
    }

    renderSeries(series, append) {
        const grid = document.getElementById("seriesGrid");
        if (!series.length && !append) {
            grid.innerHTML = `<div class="no-results"><h2>Dizi bulunamadı.</h2><p>Arama sözcüğünü veya filtrelerini değiştirmeyi dene.</p></div>`;
            return;
        }
        const html = series.map((item) => this.card(item)).join("");
        append ? grid.insertAdjacentHTML("beforeend", html) : grid.innerHTML = html;
        this.arrangeMobileArchiveRows(grid);
    }

    arrangeMobileArchiveRows(grid) {
        if (!grid) return;
        const existingRows = Array.from(
            grid.querySelectorAll(":scope > .archive-mobile-row")
        );
        const cards = [
            ...existingRows.flatMap((row) => Array.from(row.children)),
            ...Array.from(grid.querySelectorAll(":scope > .movie-card"))
        ];

        if (!window.matchMedia("(max-width: 580px)").matches) {
            if (existingRows.length) grid.replaceChildren(...cards);
            return;
        }

        if (!cards.length) return;
        const rows = [];
        for (let index = 0; index < cards.length; index += 5) {
            const row = document.createElement("div");
            row.className = "archive-mobile-row";
            row.append(...cards.slice(index, index + 5));
            rows.push(row);
        }
        grid.replaceChildren(...rows);
    }

    hasValidTurkishSeries(item) {
        const name = String(item?.name || "").trim();
        const originalName = String(item?.original_name || "").trim();
        return Boolean(
            name &&
            (
                item.original_language === "tr" ||
                (originalName && name !== originalName)
            )
        );
    }

    hasStandardSeriesSearchResult(item) {
        return Boolean(
            item?.poster_path &&
            String(item?.overview || "").trim() &&
            this.hasValidTurkishSeries(item)
        );
    }

    async searchSeriesAcrossLanguages(parameters, signal) {
        const [turkishData, englishData] = await Promise.all([
            this.fetchData(
                "/search/tv",
                { ...parameters, language: "tr-TR" },
                signal
            ),
            this.fetchData(
                "/search/tv",
                { ...parameters, language: "en-US" },
                signal
            )
        ]);
        const turkishResults = Array.isArray(turkishData.results)
            ? turkishData.results
            : [];
        const englishResults = Array.isArray(englishData.results)
            ? englishData.results
            : [];
        const turkishById = new Map(
            turkishResults.map((item) => [String(item.id), item])
        );
        const missingTurkishIds = englishResults
            .map((item) => String(item?.id || ""))
            .filter((id) => id && !turkishById.has(id));
        const localizedDetails = await Promise.allSettled(
            missingTurkishIds.map((id) => {
                return this.fetchData(
                    `/tv/${encodeURIComponent(id)}`,
                    { language: "tr-TR" },
                    signal
                );
            })
        );

        localizedDetails.forEach((result) => {
            if (result.status !== "fulfilled") return;
            const item = result.value;
            turkishById.set(String(item.id), {
                ...item,
                genre_ids: Array.isArray(item.genres)
                    ? item.genres.map((genre) => genre.id)
                    : []
            });
        });

        const merged = [];
        const seenIds = new Set();
        const resultCount = Math.max(
            turkishResults.length,
            englishResults.length
        );

        for (let index = 0; index < resultCount; index += 1) {
            [turkishResults[index], englishResults[index]].forEach(
                (candidate) => {
                    const id = String(candidate?.id || "");
                    const localizedItem = turkishById.get(id);
                    if (!id || seenIds.has(id) || !localizedItem) return;
                    seenIds.add(id);
                    merged.push(localizedItem);
                }
            );
        }

        return {
            ...turkishData,
            total_pages: Math.max(
                Number(turkishData.total_pages) || 1,
                Number(englishData.total_pages) || 1
            ),
            results: merged
        };
    }

    uniqueSeries(items) {
        return items.filter((item, index, all) => {
            return all.findIndex((candidate) => String(candidate.id) === String(item.id)) === index;
        });
    }

    card(item) {
        const name = item.name || item.original_name || "İsimsiz Dizi";
        const year = item.first_air_date?.slice(0, 4) || "—";
        const genres = this.genreNames(item.genre_ids);
        const overview = item.overview || "Bu dizi için henüz Türkçe bir açıklama bulunmuyor.";
        return `
            <article class="movie-card series-card" data-series-id="${item.id}" tabindex="0" aria-label="${this.escape(name)} dizi detayları">
                <img src="${this.poster(item.poster_path)}" alt="${this.escape(name)} dizi afişi" class="movie-poster" loading="lazy" onerror="this.onerror=null;this.src='${this.fallback}'">
                ${this.favoriteButton(item.id)}
                <div class="movie-info">
                    <div class="movie-title" title="${this.escape(name)}">${this.escape(name)}</div>
                    <div class="movie-details"><span class="movie-year">${year}</span><span class="movie-rating">IMDb ${this.imdbRating(item)}</span></div>
                    <div class="movie-genres">${this.escape(genres)}</div>
                    <div class="movie-description">${this.escape(overview)}</div>
                </div>
            </article>`;
    }

    trendingCard(item, rank) {
        const name = item.name || item.original_name || "İsimsiz Dizi";
        return `
            <article class="trending-card series-card" data-series-id="${item.id}" tabindex="0" aria-label="${this.escape(name)}">
                <img src="${this.poster(item.poster_path)}" alt="${this.escape(name)} dizi afişi" class="movie-poster" loading="lazy">
                <div class="trending-rank">#${rank}</div>${this.favoriteButton(item.id)}
                <div class="trending-overlay">
                    <div class="trending-title">${this.escape(name)}</div>
                    <div class="trending-details"><span>${item.first_air_date?.slice(0, 4) || "—"}</span><span>IMDb ${this.imdbRating(item)}</span></div>
                    <div class="trending-genres">${this.escape(this.genreNames(item.genre_ids))}</div>
                </div>
            </article>`;
    }

    favoriteButton(id) {
        const key = String(id);
        const actions = [
            ["favorites", "♥", "Favori"],
            ["watchlist", "＋", "Liste"],
            ["watched", "✓", "İzlendi"]
        ];
        return `<div class="card-quick-actions" aria-label="Dizi işlemleri">${actions.map(([collection, icon, label]) => {
            const active = Boolean(this.library[collection]?.[key]);
            return `<button type="button" class="card-quick-action ${active ? "is-active" : ""}" data-series-action="${collection}" data-series-id="${id}" aria-pressed="${active}" aria-label="Dizi: ${this.escape(label)}" title="${this.escape(label)}"><span aria-hidden="true">${icon}</span></button>`;
        }).join("")}</div>`;
    }

    toggleLibraryAction(collection, id) {
        if (!["favorites", "watchlist", "watched"].includes(collection)) return;
        if (!this.accountId) {
            window.showToast?.("Dizi listelerini kullanmak için profilinden giriş yapmalısın.", "error");
            return;
        }
        const key = String(id);
        const item = this.cache.get(key) || this.findStoredSeries(key);
        if (!item) return;
        const wasActive = Boolean(this.library[collection][key]);
        if (wasActive) delete this.library[collection][key];
        else this.library[collection][key] = this.createStoredSeries(item);
        this.saveLibrary();
        this.favorites = new Set(Object.keys(this.library.favorites));
        document.querySelectorAll(`[data-series-action="${collection}"][data-series-id="${CSS.escape(key)}"]`).forEach((button) => {
            const active = !wasActive;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
            if (button.classList.contains("card-quick-action")) {
                const icons = {
                    favorites: "♥",
                    watchlist: "＋",
                    watched: "✓"
                };
                button.innerHTML = `<span aria-hidden="true">${icons[collection]}</span>`;
            } else {
                const label = button.querySelector("span:last-child");
                const labels = {
                    favorites: active ? "Favorilerden Çıkar" : "Favorilere Ekle",
                    watchlist: active ? "İzleme Listesinden Çıkar" : "Daha Sonra İzle",
                    watched: active ? "İzlendi İşaretini Kaldır" : "İzledim"
                };
                if (label) label.textContent = labels[collection];
            }
        });
        const messages = {
            favorites: wasActive ? "Dizi favorilerinden çıkarıldı." : "Dizi favorilerine eklendi.",
            watchlist: wasActive ? "Dizi izleme listesinden çıkarıldı." : "Dizi daha sonra izlemek üzere kaydedildi.",
            watched: wasActive ? "İzlendi işareti kaldırıldı." : "Dizi izlendi olarak işaretlendi."
        };
        window.showToast?.(messages[collection]);
        this.renderLibrary();
    }

    updateToolbar(count, append) {
        const summary = document.getElementById("seriesResultsSummary");
        const chips = document.getElementById("seriesFilterChips");
        const displayed = append ? document.querySelectorAll("#seriesGrid .movie-card").length : count;
        if (summary) summary.textContent = `${displayed} dizi gösteriliyor`;
        const values = [];
        if (this.query) values.push(`“${this.query}”`);
        if (this.filters.genre) values.push(this.genres[this.filters.genre]);
        if (this.filters.year) values.push(this.filters.year);
        if (this.filters.sort !== "popularity.desc") values.push(document.getElementById("seriesSortFilter")?.selectedOptions[0]?.textContent);
        if (chips) chips.innerHTML = values.filter(Boolean).map((value) => `<span class="filter-chip">${this.escape(value)}</span>`).join("");
    }

    async openModal(id) {
        const modal = document.getElementById("seriesModal");
        const body = document.getElementById("seriesModalBody");
        if (!modal || !body) return;
        this.activeSeriesId = String(id);
        this.lastFocused = document.activeElement;
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        body.innerHTML = `<div class="modal-loading">Dizi bilgileri yükleniyor...</div>`;
        document.getElementById("seriesModalClose")?.focus();
        try {
            const details = await this.fetchData(`/tv/${id}`, {
                append_to_response: "credits,videos,similar,external_ids,watch/providers,content_ratings"
            });
            if (this.activeSeriesId !== String(id)) return;
            details.omdb = await this.fetchImdb(details);
            details.imdb_rating = details.omdb?.imdbRating && details.omdb.imdbRating !== "N/A"
                ? Number(details.omdb.imdbRating)
                : null;
            if (Array.isArray(details.similar?.results)) {
                let similarCandidates = details.similar.results;
                let similarPage = 2;
                while (
                    similarCandidates.filter((series) => {
                        return series.poster_path && this.hasValidTurkishSeries(series);
                    }).length < 8 &&
                    similarPage <= 10
                ) {
                    const more = await this.fetchData(`/tv/${id}/similar`, { page: similarPage });
                    similarCandidates = similarCandidates.concat(more.results || []);
                    similarPage += 1;
                }
                const similar = this.uniqueSeries(similarCandidates)
                    .filter((series) => series.poster_path && this.hasValidTurkishSeries(series))
                    .slice(0, 8);
                details.similar.results = await this.enrichWithImdb(similar);
            }
            this.cache.set(String(id), details);
            this.renderDetails(details);
        } catch {
            body.innerHTML = `<div class="movie-modal-error"><h2>Dizi bilgileri yüklenemedi.</h2><p>Lütfen daha sonra tekrar dene.</p></div>`;
        }
    }

    renderDetails(item) {
        const body = document.getElementById("seriesModalBody");
        if (!body) return;
        const name = item.name || item.original_name || "İsimsiz Dizi";
        const original = item.original_name && item.original_name !== name ? item.original_name : "";
        const poster = this.poster(item.poster_path);
        const backdrop = item.backdrop_path ? `${this.BACKDROP_URL}${item.backdrop_path}` : poster;
        const creators = (item.created_by || []).map((person) => person.name).join(", ") || "Bilgi yok";
        const cast = (item.credits?.cast || []).slice(0, 8);
        const trailer = (item.videos?.results || []).find((video) => video.site === "YouTube" && video.type === "Trailer");
        const providers = item["watch/providers"]?.results?.TR;
        const similar = (item.similar?.results || [])
            .filter((series) => series.poster_path && this.hasValidTurkishSeries(series))
            .slice(0, 8);
        const seasons = (item.seasons || []).filter((season) => season.season_number > 0);
        const genres = (item.genres || []).map((genre) => genre.name).join(", ") || "Tür bilgisi yok";
        body.innerHTML = `
            <div class="movie-modal-hero">
                <img src="${backdrop}" alt="" class="movie-modal-backdrop-image">
                <div class="movie-modal-hero-content">
                    <img src="${poster}" alt="${this.escape(name)} dizi afişi" class="movie-modal-poster">
                    <div class="movie-modal-heading">
                        <span class="series-detail-label">DİZİ</span>
                        <h2 class="movie-modal-title" id="modalSeriesTitle">${this.escape(name)}</h2>
                        ${original ? `<div class="movie-modal-original-title">${this.escape(original)}</div>` : ""}
                        <div class="movie-modal-meta">
                            <span>${this.date(item.first_air_date)} – ${item.status === "Ended" ? this.date(item.last_air_date) : "devam ediyor"}</span>
                            <span>${item.number_of_seasons || 0} sezon</span><span>${item.number_of_episodes || 0} bölüm</span>
                            <span class="modal-rating">IMDb ${this.imdbRating(item)}</span>
                        </div>
                        <div class="movie-modal-genres">${this.escape(genres)}</div>
                        ${this.modalLibraryActions(item)}
                    </div>
                </div>
            </div>
            <div class="movie-modal-content">
                <div class="movie-modal-main">
                    <section class="movie-modal-section"><h3 class="movie-modal-section-title">Dizi Hakkında</h3><p class="movie-modal-overview">${this.escape(item.overview || "Bu dizi için henüz Türkçe bir açıklama bulunmuyor.")}</p></section>
                    <section class="movie-modal-section"><h3 class="movie-modal-section-title">Oyuncular</h3>${this.castHTML(cast)}</section>
                    <section class="movie-modal-section"><h3 class="movie-modal-section-title">Sezonlar</h3>${this.seasonsHTML(seasons)}</section>
                    <section class="movie-modal-section"><h3 class="movie-modal-section-title">Nereden İzlenir?</h3>${this.providersHTML(providers)}</section>
                    <section class="movie-modal-section"><h3 class="movie-modal-section-title">Fragman</h3>${trailer ? `<div class="trailer-container"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}" title="${this.escape(name)} fragmanı" allowfullscreen loading="lazy"></iframe></div>` : `<p class="modal-empty-state">Fragman bulunamadı.</p>`}</section>
                    <section class="movie-modal-section"><h3 class="movie-modal-section-title">Benzer Diziler</h3><div class="similar-movies-grid">${similar.map((series) => `<article class="similar-movie-card" data-series-id="${series.id}" tabindex="0"><img src="${this.poster(series.poster_path)}" alt="${this.escape(series.name)} afişi" class="similar-movie-poster"><div class="similar-movie-info"><div class="similar-movie-title">${this.escape(series.name)}</div><div class="similar-movie-rating">IMDb ${this.imdbRating(series)}</div></div></article>`).join("") || `<p class="modal-empty-state">Benzer dizi bulunamadı.</p>`}</div></section>
                </div>
                <aside class="movie-modal-sidebar"><div class="movie-modal-facts">
                    ${this.fact("Yaratıcı", creators)}
                    ${this.fact("Durum", this.status(item.status))}
                    ${this.fact("Orijinal Dil", this.language(item.original_language))}
                    ${this.fact("Yapım Ülkeleri", this.productionCountries(item.production_countries))}
                    ${this.fact("Bölüm Süresi", item.episode_run_time?.[0] ? `${item.episode_run_time[0]} dakika` : "Bilgi yok")}
                    ${item.omdb?.imdbVotes && item.omdb.imdbVotes !== "N/A" ? this.fact("IMDb Oyları", item.omdb.imdbVotes) : ""}
                    ${item.omdb?.imdbId ? `<a class="series-imdb-link" href="https://www.imdb.com/title/${encodeURIComponent(item.omdb.imdbId)}/" target="_blank" rel="noopener noreferrer">IMDb sayfasını aç ↗</a>` : ""}
                    ${item.omdb?.Rated && item.omdb.Rated !== "N/A" ? this.fact("Yaş Sınırı", item.omdb.Rated) : ""}
                    ${item.tagline ? this.fact("Slogan", `“${item.tagline}”`) : ""}
                    ${this.awardsHTML(item.omdb)}
                </div></aside>
            </div>`;
    }

    castHTML(cast) {
        if (!cast.length) return `<p class="modal-empty-state">Oyuncu bilgisi bulunamadı.</p>`;
        return `<div class="movie-cast-list">${cast.map((person) => `<div class="movie-cast-item"><img src="${person.profile_path ? this.IMAGE_URL + person.profile_path : this.fallback}" alt="${this.escape(person.name)} profil fotoğrafı" class="movie-cast-image" loading="lazy"><div class="movie-cast-name">${this.escape(person.name)}</div><div class="movie-cast-character">${this.escape(person.character || "Rol bilgisi yok")}</div></div>`).join("")}</div>`;
    }

    seasonsHTML(seasons) {
        if (!seasons.length) return `<p class="modal-empty-state">Sezon bilgisi bulunamadı.</p>`;
        return `<div class="series-seasons">${seasons.map((season) => `<div><strong>${this.escape(season.name)}</strong><span>${season.episode_count} bölüm · ${season.air_date?.slice(0, 4) || "Tarih yok"}</span></div>`).join("")}</div>`;
    }

    providersHTML(data) {
        if (!data) return `<p class="modal-empty-state">Türkiye için platform bilgisi bulunamadı.</p>`;
        const groups = [
            ["Abonelikle İzle", data.flatrate],
            ["Kirala", data.rent],
            ["Satın Al", data.buy],
            ["Reklamlı İzle", data.ads],
            ["Ücretsiz İzle", data.free]
        ].filter(([, providers]) => Array.isArray(providers) && providers.length);
        if (!groups.length) return `<p class="modal-empty-state">Türkiye için platform bilgisi bulunamadı.</p>`;
        const tmdbLink = /^https?:\/\//.test(data.link || "") ? data.link : "#";
        return `<div class="watch-providers">
            ${groups.map(([title, providers]) => `<div class="watch-provider-group">
                <h4 class="watch-provider-group-title">${title}</h4>
                <div class="watch-provider-list">${providers.map((provider) => {
                    const link = this.providerUrl(provider.provider_name, tmdbLink);
                    return `<a href="${link}" target="_blank" rel="noopener noreferrer" class="watch-provider-item" title="${this.escape(provider.provider_name)} platformuna git">
                        <img src="${this.PROVIDER_URL}${provider.logo_path}" alt="${this.escape(provider.provider_name)} logosu" class="watch-provider-logo">
                        <span class="watch-provider-name">${this.escape(provider.provider_name)}</span>
                    </a>`;
                }).join("")}</div>
            </div>`).join("")}
            <a href="${tmdbLink}" class="watch-provider-link" target="_blank" rel="noopener noreferrer">Tüm izleme seçeneklerini görüntüle</a>
        </div>`;
    }

    providerUrl(name, fallback) {
        const normalized = String(name || "").toLocaleLowerCase("tr-TR");
        const providers = [
            ["netflix", "https://www.netflix.com/browse"],
            ["disney", "https://www.disneyplus.com/tr-tr/browse"],
            ["amazon prime", "https://www.primevideo.com/"],
            ["prime video", "https://www.primevideo.com/"],
            ["max", "https://www.max.com/tr/tr"],
            ["blutv", "https://www.blutv.com/"],
            ["mubi", "https://mubi.com/tr"],
            ["apple tv", "https://tv.apple.com/tr"],
            ["exxen", "https://www.exxen.com/"],
            ["gain", "https://www.gain.tv/"],
            ["tabii", "https://www.tabii.com/tr"],
            ["tv+", "https://tvplus.com.tr/"],
            ["google play", "https://play.google.com/store/movies"],
            ["youtube", "https://www.youtube.com/movies"]
        ];
        return providers.find(([key]) => normalized.includes(key))?.[1] || fallback;
    }

    appendPusulaMessage(text, loading = false) {
        const chat = document.getElementById("seriesPusulaChat");
        if (!chat) return null;
        const item = document.createElement("div");
        item.className = `pusula-message pusula-message-ai${loading ? " is-loading" : ""}`;
        item.innerHTML = `<span class="pusula-avatar" aria-hidden="true">✦</span><div><strong>Pusula</strong><p></p></div>`;
        item.querySelector("p").textContent = text;
        chat.appendChild(item);
        return item;
    }

    resetPusula() {
        this.pusulaRequestController?.abort();
        this.pusulaRequestController = null;
        this.pusulaLastTitles = [];
        document.getElementById("seriesRecommendForm")?.reset();
        document.querySelectorAll(
            "#seriesPusulaQuestions [data-pusula-group] .is-selected"
        ).forEach((button) => button.classList.remove("is-selected"));
        this.updatePusulaDurationOptions("dizi");
        const chat = document.getElementById("seriesPusulaChat");
        if (chat) {
            chat.innerHTML = `
                <div class="pusula-message pusula-message-ai">
                    <span class="pusula-avatar" aria-hidden="true">✦</span>
                    <div><strong>Pusula</strong><p>Bazen tek bir his yönünü bulmaya yeter. İstersen sana en uygun seçenekleri seç, istersen aklındakileri kendi cümlelerinle dök.</p></div>
                </div>`;
        }
        document.querySelector(
            "#seriesRecommendForm button[type='submit']"
        )?.removeAttribute("disabled");
    }

    getPusulaPreferences() {
        const preferences = {};
        document.querySelectorAll(
            "#seriesPusulaQuestions [data-pusula-group]"
        ).forEach((group) => {
            const selected = [...group.querySelectorAll(
                ".is-selected[data-pusula-value]"
            )];
            if (selected.length) {
                preferences[group.dataset.pusulaGroup] = selected
                    .map((item) => item.dataset.pusulaValue)
                    .join(" ve ");
            }
        });
        return preferences;
    }

    updatePusulaDurationOptions(type) {
        const container = document.querySelector(
            "#seriesPusulaQuestions [data-pusula-duration-options]"
        );
        if (!container) return;
        const options = type === "film"
            ? [
                ["90 dakikadan kısa", "Çıtır çerez"],
                ["yaklaşık 2 saat", "Tam kıvamında"],
                ["uzun, sürükleyici bir film", "Uzun soluklu"]
            ]
            : type === "fark etmez"
                ? [
                    ["90 dakikaya kadar", "Çıtır çerez"],
                    ["1-2 saat", "Tam kıvamında"],
                    ["uzun, sürükleyici bir yapım", "Uzun soluklu"]
                ]
                : [
                    ["tek bölüm, 30 dakikaya kadar", "Çıtır çerez"],
                    ["tek bölüm, yaklaşık 1 saat", "Tam kıvamında"],
                    ["birkaç bölüm art arda izlenecek uzun bir hikâye", "Uzun soluklu"]
                ];
        const buttons = container.querySelectorAll("[data-pusula-value]");
        options.forEach(([value, label], index) => {
            if (!buttons[index]) return;
            buttons[index].dataset.pusulaValue = value;
            buttons[index].textContent = label;
        });
    }

    describePusulaSelections() {
        return [...document.querySelectorAll(
            "#seriesPusulaQuestions .is-selected[data-pusula-value]"
        )].map((button) => button.textContent.trim()).join(" · ");
    }

    async findPusulaTitles(recommendations = []) {
        const matches = await Promise.all(
            recommendations.slice(0, 3).map(async (recommendation) => {
                const mediaType = recommendation.type === "film" ? "movie" : "tv";
                const params = {
                    query: recommendation.title,
                    include_adult: false,
                    page: 1
                };
                params[mediaType === "tv" ? "first_air_date_year" : "year"] =
                    recommendation.year || undefined;
                const data = await this.fetchData(`/search/${mediaType}`, params);
                const item = (data.results || [])[0];
                return item
                    ? { item, reason: recommendation.reason, mediaType }
                    : null;
            })
        );
        return matches.filter(Boolean);
    }

    pusulaResultCard(item, reason, mediaType) {
        if (mediaType === "tv") {
            this.cache.set(String(item.id), item);
            return `<div class="pusula-result">${this.card(item)}<p>${this.escape(reason)}</p></div>`;
        }
        const title = item.title || item.original_title || "İsimsiz film";
        const year = String(item.release_date || "").slice(0, 4) || "—";
        const poster = item.poster_path
            ? `${this.IMAGE_URL}${item.poster_path}`
            : this.fallback;
        return `
            <div class="pusula-result">
                <article class="movie-card pusula-series-card" data-pusula-movie tabindex="0">
                    <img class="movie-poster" src="${poster}" alt="${this.escape(title)} afişi">
                    <div class="movie-info">
                        <h3 class="movie-title">${this.escape(title)}</h3>
                        <div class="movie-meta"><span>${year}</span><span>★ ${Number(item.vote_average || 0).toFixed(1)}</span></div>
                        <small>Film arşivinde incele →</small>
                    </div>
                </article>
                <p>${this.escape(reason)}</p>
            </div>`;
    }

    appendPusulaActions(chat, preferences) {
        const actions = document.createElement("div");
        actions.className = "pusula-result-actions";
        actions.innerHTML = `
            <div class="pusula-route-again">
                <span>Bu rota içine sinmedi mi?</span>
                <div class="pusula-route-buttons">
                    <button type="button" data-pusula-followup>Başka öneriler getir</button>
                    <button type="button" data-pusula-new-route>Yeni rota oluştur</button>
                </div>
            </div>`;
        chat.appendChild(actions);
        actions.querySelector("[data-pusula-followup]")?.addEventListener("click", () => {
            const excluded = this.pusulaLastTitles.length
                ? ` Şunları tekrar önerme: ${this.pusulaLastTitles.join(", ")}.`
                : "";
            this.createRecommendations(
                `Önceki önerileri tekrarlamadan tamamen farklı üç yapım öner.${excluded}`,
                preferences
            );
        });
        actions.querySelector("[data-pusula-new-route]")?.addEventListener("click", () => {
            this.resetPusula();
            document.querySelector("#seriesPusulaQuestions button")?.focus();
        });
    }

    async createRecommendations(message, preferences = {}) {
        const chat = document.getElementById("seriesPusulaChat");
        const form = document.getElementById("seriesRecommendForm");
        if (!chat || !form) return;
        const summary = this.describePusulaSelections();
        const requestMessage = message ||
            (summary
                ? `Seçimlerime göre bir rota çiz: ${summary}.`
                : "Bana film ve diziler arasından sürpriz bir rota çiz.");
        chat.innerHTML = "";
        const loading = this.appendPusulaMessage("Rotanı düşünüyorum…", true);
        const submit = form.querySelector("button[type='submit']");
        submit.disabled = true;
        this.pusulaRequestController?.abort();
        this.pusulaRequestController = new AbortController();

        try {
            const pusulaEndpoint = `${this.API_BASE_URL}/pusula`;
            const response = await fetch(pusulaEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: requestMessage,
                    preferences,
                    history: []
                }),
                signal: this.pusulaRequestController.signal
            });
            const responseText = await response.text();
            let data;
            try {
                data = responseText ? JSON.parse(responseText) : {};
            } catch {
                throw new Error("Pusula sunucusundan geçerli bir yanıt alınamadı.");
            }
            if (!responseText) throw new Error("Pusula sunucusu boş yanıt verdi.");
            if (!response.ok) throw new Error(data.error || "Pusula yanıt veremedi.");

            loading?.remove();
            this.appendPusulaMessage(data.reply);
            this.pusulaLastTitles = (data.recommendations || [])
                .map((item) => item.title)
                .filter(Boolean);
            const matches = await this.findPusulaTitles(data.recommendations);
            if (matches.length) {
                const results = document.createElement("div");
                results.className = "pusula-results recommend-grid";
                results.innerHTML = matches.map(({ item, reason, mediaType }) =>
                    this.pusulaResultCard(item, reason, mediaType)
                ).join("");
                chat.appendChild(results);
                results.querySelectorAll("[data-pusula-movie]").forEach((card) => {
                    card.addEventListener("click", () => {
                        window.location.href = "index.html#discoverSection";
                    });
                });
            }
            this.appendPusulaActions(chat, preferences);
            chat.scrollTop = 0;
        } catch (error) {
            if (error.name === "AbortError") return;
            loading?.remove();
            this.appendPusulaMessage(
                error.message || "Şu an bağlantı kuramadım. Biraz sonra tekrar deneyelim."
            );
        } finally {
            submit.disabled = false;
            document.getElementById("seriesPusulaInput")?.focus();
        }
    }

    fact(label, value) {
        return `<div class="movie-modal-fact"><span class="movie-modal-fact-label">${this.escape(label)}</span><span class="movie-modal-fact-value">${this.escape(value)}</span></div>`;
    }

    productionCountries(countries = []) {
        const translations = {
            US: "Amerika Birleşik Devletleri", GB: "Birleşik Krallık", TR: "Türkiye",
            FR: "Fransa", DE: "Almanya", IT: "İtalya", ES: "İspanya",
            JP: "Japonya", KR: "Güney Kore", CN: "Çin", CA: "Kanada",
            AU: "Avustralya", IN: "Hindistan", RU: "Rusya", MX: "Meksika",
            BR: "Brezilya", AR: "Arjantin", SE: "İsveç", NO: "Norveç",
            DK: "Danimarka", FI: "Finlandiya", NL: "Hollanda", BE: "Belçika",
            IE: "İrlanda", NZ: "Yeni Zelanda", AT: "Avusturya", CH: "İsviçre",
            PL: "Polonya", GR: "Yunanistan", ZA: "Güney Afrika",
            HK: "Hong Kong", TW: "Tayvan"
        };
        const displayNames = typeof Intl.DisplayNames === "function"
            ? new Intl.DisplayNames(["tr"], { type: "region" })
            : null;
        const names = countries.map((country) => {
            if (!country.iso_3166_1) return country.name;
            if (translations[country.iso_3166_1]) return translations[country.iso_3166_1];
            try {
                return displayNames?.of(country.iso_3166_1) || country.name;
            } catch {
                return country.name;
            }
        }).filter(Boolean);
        return names.join(", ") || "Ülke bilgisi bulunmuyor";
    }

    awardsHTML(omdb) {
        if (!omdb?.Awards || omdb.Awards === "N/A") {
            return `<div class="movie-modal-fact movie-modal-fact-highlight"><span class="movie-modal-fact-label">Ödüller</span><span class="movie-modal-fact-value">Bu yapım için ödül bilgisi bulunmuyor.</span></div>`;
        }
        return `<div class="movie-modal-fact movie-modal-fact-highlight"><span class="movie-modal-fact-label">Ödüller</span><span class="movie-modal-fact-value">${this.escape(this.formatAwards(omdb.Awards))}</span></div>`;
    }

    formatAwards(value) {
        const text = String(value);
        const count = (pattern) => Number(text.match(pattern)?.[1] || 0);
        const oscarWins = count(/won\s+(\d+)\s+oscars?/i);
        const oscarNominations = count(/nominated\s+for\s+(\d+)\s+oscars?/i);
        const wins = count(/(\d+)\s+wins?/i);
        const nominations = count(/(\d+)\s+nominations?/i);
        const parts = [];
        if (oscarWins) parts.push(`${oscarWins} Oscar ödülü`);
        else if (oscarNominations) parts.push(`${oscarNominations} Oscar adaylığı`);
        if (wins && !oscarWins) parts.push(`${wins} ödül`);
        if (nominations && !oscarNominations) parts.push(`${nominations} adaylık`);
        if (parts.length) return `${parts.join(", ")}!`;
        return text
            .replace(/\s*&\s*/g, ", ")
            .replace(/\bwins?\b/gi, "ödül")
            .replace(/\bnominations?\b/gi, "adaylık")
            .replace(/\btotal\b/gi, "")
            .replace(/[.!?,\s]+$/, "") + "!";
    }

    modalLibraryActions(item) {
        const id = String(item.id);
        const customLists = Object.values(this.library.customLists || {});
        return `<div class="movie-user-actions series-user-actions">
            <button type="button" class="movie-user-action ${this.library.favorites[id] ? "is-active" : ""}" data-series-action="favorites" data-series-id="${id}">
                <span aria-hidden="true">♥</span><span>${this.library.favorites[id] ? "Favorilerden Çıkar" : "Favorilere Ekle"}</span>
            </button>
            <button type="button" class="movie-user-action ${this.library.watched[id] ? "is-active" : ""}" data-series-action="watched" data-series-id="${id}">
                <span aria-hidden="true">✓</span><span>${this.library.watched[id] ? "İzlendi İşaretini Kaldır" : "İzledim"}</span>
            </button>
            <button type="button" class="movie-user-action ${this.library.watchlist[id] ? "is-active" : ""}" data-series-action="watchlist" data-series-id="${id}">
                <span aria-hidden="true">＋</span><span>${this.library.watchlist[id] ? "İzleme Listesinden Çıkar" : "Daha Sonra İzle"}</span>
            </button>
            ${customLists.length ? `<label class="movie-custom-list-select"><span>Özel liste</span><select data-series-list-picker data-series-id="${id}"><option value="">Listeye ekle…</option>${customLists.map((list) => `<option value="${this.escape(list.id)}">${this.escape(list.name)}</option>`).join("")}</select></label>` : ""}
        </div>`;
    }

    getAccountId() {
        try {
            const raw = localStorage.getItem("seyirAtlasiSession") || sessionStorage.getItem("seyirAtlasiSession");
            return raw ? String(JSON.parse(raw).accountId || "") : "";
        } catch {
            return "";
        }
    }

    loadLibrary() {
        const empty = { favorites: {}, watchlist: {}, watched: {}, customLists: {} };
        const saved = this.readJSON(this.libraryKey, empty);
        return {
            favorites: saved.favorites || {},
            watchlist: saved.watchlist || {},
            watched: saved.watched || {},
            customLists: saved.customLists || {}
        };
    }

    saveLibrary() {
        localStorage.setItem(this.libraryKey, JSON.stringify(this.library));
    }

    createStoredSeries(item) {
        return {
            id: String(item.id),
            name: item.name || item.original_name || "İsimsiz Dizi",
            original_name: item.original_name || item.name || "",
            original_language: item.original_language || "tr",
            poster_path: item.poster_path || "",
            first_air_date: item.first_air_date || "",
            vote_average: Number(item.vote_average) || 0,
            imdb_rating: Number(item.imdb_rating || item.omdb?.imdbRating) || null,
            genre_ids: item.genre_ids || item.genres?.map((genre) => genre.id) || [],
            overview: item.overview || "",
            media_type: "tv",
            saved_at: new Date().toISOString()
        };
    }

    findStoredSeries(id) {
        for (const collection of ["favorites", "watchlist", "watched"]) {
            if (this.library[collection]?.[id]) return this.library[collection][id];
        }
        for (const list of Object.values(this.library.customLists || {})) {
            if (list.series?.[id]) return list.series[id];
        }
        return null;
    }

    removeFromLibrary(collection, id) {
        if (!this.library[collection]?.[id]) return;
        delete this.library[collection][id];
        this.saveLibrary();
        this.favorites = new Set(Object.keys(this.library.favorites));
        this.renderLibrary();
        window.showToast?.("Dizi listeden çıkarıldı.");
    }

    createCustomList(event) {
        event.preventDefault();
        if (!this.accountId) return;
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") || "").trim().slice(0, 48);
        const description = String(data.get("description") || "").trim().slice(0, 140);
        if (!name) return;
        const id = crypto.randomUUID?.() || `dizi-listesi-${Date.now()}`;
        this.library.customLists[id] = { id, name, description, series: {}, created_at: new Date().toISOString() };
        this.saveLibrary();
        event.currentTarget.reset();
        event.currentTarget.hidden = true;
        this.renderLibrary();
        window.showToast?.("Yeni dizi listen oluşturuldu.");
    }

    deleteCustomList(id) {
        const list = this.library.customLists[id];
        if (!list || !window.confirm(`“${list.name}” listesini silmek istiyor musun?`)) return;
        delete this.library.customLists[id];
        this.saveLibrary();
        this.renderLibrary();
    }

    addToCustomList(listId, seriesId) {
        const list = this.library.customLists[listId];
        const item = this.cache.get(String(seriesId)) || this.findStoredSeries(String(seriesId));
        if (!list || !item) return;
        list.series ||= {};
        list.series[String(seriesId)] = this.createStoredSeries(item);
        this.saveLibrary();
        this.renderLibrary();
        window.showToast?.(`Dizi “${list.name}” listesine eklendi.`);
    }

    removeFromCustomList(listId, seriesId) {
        const list = this.library.customLists[listId];
        if (!list?.series) return;
        delete list.series[String(seriesId)];
        this.saveLibrary();
        this.renderLibrary();
    }

    libraryCard(item, collection = "", listId = "") {
        this.cache.set(String(item.id), item);
        const remove = listId
            ? `<button type="button" class="library-quick-remove" data-series-custom-remove data-list-id="${this.escape(listId)}" data-series-id="${item.id}" aria-label="Diziyi listeden çıkar">×</button>`
            : `<button type="button" class="library-quick-remove" data-series-remove="${collection}" data-series-id="${item.id}" aria-label="Diziyi listeden çıkar">×</button>`;
        return this.card(item).replace("</article>", `${remove}</article>`);
    }

    renderLibrary() {
        const content = document.getElementById("seriesLibraryContent");
        const warning = document.getElementById("seriesLibraryAuthWarning");
        if (warning) warning.hidden = Boolean(this.accountId);
        if (content) content.hidden = !this.accountId;
        if (!content || !this.accountId) return;

        [
            ["favorites", "seriesFavoritesGrid", "Henüz favorilerine dizi eklemedin."],
            ["watched", "seriesWatchedGrid", "Henüz izlendi olarak işaretlediğin bir dizi yok."],
            ["watchlist", "seriesWatchlistGrid", "İzleme listen henüz boş."]
        ].forEach(([collection, containerId, empty]) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            const items = Object.values(this.library[collection]).sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)));
            container.innerHTML = items.length
                ? items.map((item) => this.libraryCard(item, collection)).join("")
                : `<p class="library-empty">${empty}</p>`;
        });

        const count = document.getElementById("seriesWatchlistCount");
        if (count) count.textContent = `${Object.keys(this.library.watchlist).length} dizi`;

        const listsContainer = document.getElementById("seriesCustomListsContainer");
        if (!listsContainer) return;
        const lists = Object.values(this.library.customLists).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        listsContainer.innerHTML = lists.map((list) => {
            const items = Object.values(list.series || {});
            return `<article class="custom-list-card"><header class="custom-list-header"><div><span>${items.length} dizi</span><h3>${this.escape(list.name)}</h3>${list.description ? `<p>${this.escape(list.description)}</p>` : ""}</div><div class="custom-list-actions"><button type="button" data-delete-series-list="${this.escape(list.id)}">Sil</button></div></header><div class="movies-grid library-grid">${items.length ? items.map((item) => this.libraryCard(item, "", list.id)).join("") : `<p class="library-empty">Bu liste henüz boş. Dizi detayından bu listeye içerik ekleyebilirsin.</p>`}</div></article>`;
        }).join("");
    }

    closeModal() {
        const modal = document.getElementById("seriesModal");
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        document.getElementById("seriesModalBody").innerHTML = "";
        this.activeSeriesId = null;
        this.lastFocused?.focus?.();
    }

    scrollCarousel(direction) {
        document.getElementById("seriesTrendingCarousel")?.scrollBy({ left: direction * 520, behavior: "smooth" });
    }
    imdbRating(item) {
        return Number(item?.imdb_rating) > 0 ? Number(item.imdb_rating).toFixed(1) : "—";
    }
    poster(path) { return path ? `${this.IMAGE_URL}${path}` : this.fallback; }
    genreNames(ids = []) { return ids.map((id) => this.genres[id]).filter(Boolean).slice(0, 3).join(", ") || "Tür bilgisi yok"; }
    rating(value) { return Number(value) > 0 ? Number(value).toFixed(1) : "—"; }
    date(value) { if (!value) return "Tarih yok"; return new Intl.DateTimeFormat("tr-TR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
    status(value) { return ({ Returning: "Devam ediyor", "Returning Series": "Devam ediyor", Ended: "Sona erdi", Canceled: "İptal edildi", "In Production": "Yapım aşamasında", Planned: "Planlandı" })[value] || value || "Bilgi yok"; }
    language(value) { return ({ tr: "Türkçe", en: "İngilizce", ko: "Korece", ja: "Japonca", es: "İspanyolca", de: "Almanca", fr: "Fransızca", it: "İtalyanca", zh: "Çince" })[value] || value?.toLocaleUpperCase("tr-TR") || "Bilgi yok"; }
    escape(value) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }
    readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
    createFallback() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#080d23"/><stop offset="1" stop-color="#405fb5"/></linearGradient></defs><rect width="500" height="750" fill="url(#g)"/><text x="250" y="360" text-anchor="middle" fill="#fff" font-family="Arial" font-size="34" font-weight="bold">SeyirAtlası</text><text x="250" y="410" text-anchor="middle" fill="#c7d2fe" font-family="Arial" font-size="20">Afiş bulunamadı</text></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }
}

document.addEventListener("DOMContentLoaded", () => new SeriesExplorer());
