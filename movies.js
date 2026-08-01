class MovieExplorer {
    constructor() {
        /* =========================
           API AYARLARI
        ========================== */

        const usesSeparateLocalServer =
            window.location.protocol === "file:" ||
            (
                ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
                window.location.port !== "3000"
            );
        this.API_BASE_URL = usesSeparateLocalServer
            ? "http://127.0.0.1:3000/api"
            : "/api";

        this.IMAGE_BASE_URL =
            "https://image.tmdb.org/t/p/w500";

        this.BACKDROP_BASE_URL =
            "https://image.tmdb.org/t/p/w1280";

        this.PROVIDER_IMAGE_BASE_URL =
            "https://image.tmdb.org/t/p/w92";

        this.FALLBACK_IMAGE =
            this.createFallbackImage();


        /* =========================
           UYGULAMA DURUMU
        ========================== */

        this.genres = {};

        this.currentPage = 1;
        this.randomStartPage = 1;
        this.isSearching = false;
        this.currentQuery = "";

        this.currentFilters = {
            genre: "",
            year: "",
            sort: ""
        };

        this.THEME_STORAGE_KEY =
            "seyirAtlasiTheme";

        this.currentTheme =
            this.loadTheme();

        this.searchController = null;

        this.movieDetailsCache = new Map();

        this.imdbRatingCache = new Map();

        this.omdbMovieCache = new Map();

        this.USER_LIBRARY_STORAGE_KEY =
            this.getUserLibraryStorageKey();

        this.sharedList =
            this.readSharedListFromURL();

        this.isSharedView =
            Boolean(this.sharedList);

        this.userLibrary =
            this.sharedList?.library ||
            this.loadUserLibrary();

        this.lastFocusedElement = null;

        /*
         * Hızlı biçimde farklı filmlere tıklandığında
         * eski API sonucunun yeni modalı ezmesini önler.
         */
        this.activeModalMovieId = null;

        this.pusulaLastTitles = [];
        this.pusulaRequestController = null;

        this.init();
    }


    /* =========================
       UYGULAMAYI BAŞLAT
    ========================== */

    async init() {
        this.updatePusulaTimeCopy();
        this.setupEventListeners();
        await this.syncLibraryFromServer();
        this.renderUserLibrary();
        this.applyTheme(
            this.currentTheme
        );
        this.setupYearFilter();

        await this.loadGenres();

        await Promise.all([
            this.loadTrendingMovies(),
            this.loadRandomMovies()
        ]);
    }

    updatePusulaTimeCopy() {
        const hour = Number(
            new Intl.DateTimeFormat("tr-TR", {
                timeZone: "Europe/Istanbul",
                hour: "2-digit",
                hourCycle: "h23"
            }).format(new Date())
        );

        let daypart = "bu gece";
        if (hour >= 5 && hour < 11) {
            daypart = "bu sabah";
        } else if (hour >= 11 && hour < 17) {
            daypart = "bugün öğlen";
        } else if (hour >= 17 && hour < 22) {
            daypart = "bu akşam";
        }

        document.querySelectorAll("[data-pusula-daypart]").forEach((element) => {
            const atSentenceStart =
                element.parentElement?.tagName === "LEGEND";
            element.textContent = atSentenceStart
                ? daypart[0].toLocaleUpperCase("tr-TR") + daypart.slice(1)
                : daypart;
        });
    }


    /* =========================
       EVENT LISTENER'LAR
    ========================== */

    setupEventListeners() {
        const searchInput =
            document.getElementById("searchInput");

        const genreFilter =
            document.getElementById("genreFilter");

        const yearFilter =
            document.getElementById("yearFilter");

        const sortFilter =
            document.getElementById("sortFilter");

        const clearBtn =
            document.getElementById("clearBtn");

        const trendingPrev =
            document.getElementById("trendingPrev");

        const trendingNext =
            document.getElementById("trendingNext");

        const trendingCarousel =
            document.getElementById("trendingCarousel");

        const moviesGrid =
            document.getElementById("moviesGrid");

        const favoritesGrid =
            document.getElementById("favoritesGrid");

        const watchlistGrid =
            document.getElementById("watchlistGrid");

        const watchedGrid =
            document.getElementById("watchedGrid");

        const customListsContainer =
            document.getElementById(
                "customListsContainer"
            );

        const movieModal =
            document.getElementById("movieModal");

        const movieModalClose =
            document.getElementById("movieModalClose");

        const themeToggle =
            document.getElementById("themeToggle");

        const loadMoreBtn =
            document.getElementById("loadMoreBtn");

        const recommendTrigger =
            document.getElementById("recommendTrigger");

        const recommendModal =
            document.getElementById("recommendModal");

        const recommendForm =
            document.getElementById("recommendForm");

        const activeFilterChips =
            document.getElementById("activeFilterChips");

        const customListForm =
            document.getElementById(
                "customListForm"
            );

        const newListToggle =
            document.getElementById(
                "newListToggle"
            );

        const customListCancel =
            document.getElementById(
                "customListCancel"
            );

        const saveSharedListBtn =
            document.getElementById(
                "saveSharedListBtn"
            );

        let searchTimeout;

        newListToggle?.addEventListener(
            "click",
            () => {
                customListForm.hidden = false;
                customListForm
                    .querySelector("input")
                    ?.focus();
            }
        );

        customListCancel?.addEventListener(
            "click",
            () => {
                customListForm.hidden = true;
                customListForm.reset();
            }
        );

        customListForm?.addEventListener(
            "submit",
            (event) => {
                this.createCustomList(event);
            }
        );

        saveSharedListBtn?.addEventListener(
            "click",
            () => {
                this.saveSharedListToAccount();
            }
        );

        document.addEventListener(
            "click",
            (event) => {
                const shareButton =
                    event.target.closest(
                        "[data-share-list]"
                    );

                if (shareButton) {
                    this.shareUserLibrary(
                        shareButton.dataset.shareList
                    );
                    return;
                }

                const deleteListButton =
                    event.target.closest(
                        "[data-delete-custom-list]"
                    );

                if (deleteListButton) {
                    this.deleteCustomList(
                        deleteListButton.dataset
                            .deleteCustomList
                    );
                }
            }
        );

        recommendTrigger?.addEventListener("click", () => {
            this.resetPusula();
            recommendModal.hidden = false;
            recommendModal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");
            document.getElementById("pusulaInput")?.focus();
        });

        recommendModal
            ?.querySelectorAll("[data-close-recommend]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    recommendModal.hidden = true;
                    recommendModal.setAttribute("aria-hidden", "true");
                    document.body.classList.remove("modal-open");
                    this.resetPusula();
                    recommendTrigger?.focus();
                });
            });

        recommendForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const input = document.getElementById("pusulaInput");
            const message = input?.value.trim() || "";
            const preferences = this.getPusulaPreferences();
            input.value = "";
            this.createRecommendations(message, preferences);
        });

        document.getElementById("pusulaQuestions")?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-pusula-value]");
            const group = button?.closest("[data-pusula-group]");
            if (!button || !group) return;

            if (group.hasAttribute("data-pusula-multiple")) {
                button.classList.toggle("is-selected");
                return;
            }

            const canClear = true;
            const wasSelected = button.classList.contains("is-selected");
            group.querySelectorAll("[data-pusula-value]").forEach((item) => {
                item.classList.remove("is-selected");
            });
            if (!wasSelected || !canClear) button.classList.add("is-selected");

            if (group.dataset.pusulaGroup === "type") {
                this.updatePusulaDurationOptions(button.dataset.pusulaValue);
            }
        });

        document.getElementById("pusulaInput")?.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                recommendForm?.requestSubmit();
            }
        });

        activeFilterChips?.addEventListener("click", (event) => {
            const chip = event.target.closest("[data-clear-filter]");
            if (!chip) return;

            const filterName = chip.dataset.clearFilter;
            if (filterName === "query") {
                searchInput.value = "";
                this.currentQuery = "";
            } else {
                const controls = {
                    genre: genreFilter,
                    year: yearFilter,
                    sort: sortFilter
                };
                if (controls[filterName]) controls[filterName].value = "";
            }
            this.handleFilterChange();
        });


        searchInput?.addEventListener(
            "input",
            (event) => {
                clearTimeout(searchTimeout);

                searchTimeout = setTimeout(() => {
                    this.handleSearch(event.target.value);
                }, 500);
            }
        );


        genreFilter?.addEventListener(
            "change",
            () => {
                this.handleFilterChange();
            }
        );


        yearFilter?.addEventListener(
            "change",
            () => {
                this.handleFilterChange();
            }
        );


        sortFilter?.addEventListener(
            "change",
            () => {
                this.handleFilterChange();
            }
        );


        clearBtn?.addEventListener(
            "click",
            () => {
                this.clearAllFilters();
            }
        );


        trendingPrev?.addEventListener(
            "click",
            () => {
                this.scrollCarousel("prev");
            }
        );


        trendingNext?.addEventListener(
            "click",
            () => {
                this.scrollCarousel("next");
            }
        );


        /*
         * Kartlar sonradan JavaScript ile oluşturulduğu için
         * event delegation kullanıyoruz.
         */
        [
            trendingCarousel,
            moviesGrid,
            favoritesGrid,
            watchlistGrid,
            watchedGrid,
            customListsContainer
        ].forEach(
            (container) => {
                container?.addEventListener(
                    "click",
                    (event) => {
                        const quickAction =
                            event.target.closest(
                                "[data-quick-action]"
                            );

                        if (quickAction) {
                            event.stopPropagation();

                            if (
                                quickAction.dataset
                                    .quickAction ===
                                "watchlist"
                            ) {
                                const movieCard =
                                    quickAction.closest(
                                        "[data-movie-id]"
                                    );
                                this.openMovieModal(
                                    quickAction.dataset
                                        .movieId,
                                    movieCard
                                );
                                return;
                            }

                            this.toggleUserMovieAction(
                                quickAction.dataset.quickAction,
                                quickAction.dataset.movieId
                            );
                            return;
                        }

                        const removeButton =
                            event.target.closest(
                                "[data-library-remove]"
                            );

                        if (removeButton) {
                            event.stopPropagation();
                            this.removeFromUserLibrary(
                                removeButton.dataset
                                    .libraryRemove,
                                removeButton.dataset
                                    .movieId
                            );
                            return;
                        }

                        const customRemove =
                            event.target.closest(
                                "[data-custom-list-remove]"
                            );

                        if (customRemove) {
                            event.stopPropagation();
                            this.removeMovieFromCustomList(
                                customRemove.dataset
                                    .customListId,
                                customRemove.dataset
                                    .movieId
                            );
                            return;
                        }

                        const movieCard =
                            event.target.closest(
                                "[data-movie-id]"
                            );

                        if (!movieCard) {
                            return;
                        }

                        this.openMovieModal(
                            movieCard.dataset.movieId,
                            movieCard
                        );
                    }
                );


                container?.addEventListener(
                    "keydown",
                    (event) => {
                        if (
                            event.target.closest(
                                "[data-library-remove], [data-quick-action]"
                            )
                        ) {
                            return;
                        }

                        const movieCard =
                            event.target.closest(
                                "[data-movie-id]"
                            );

                        if (!movieCard) {
                            return;
                        }

                        if (
                            event.key !== "Enter" &&
                            event.key !== " "
                        ) {
                            return;
                        }

                        event.preventDefault();

                        this.openMovieModal(
                            movieCard.dataset.movieId,
                            movieCard
                        );
                    }
                );
            }
        );


        movieModalClose?.addEventListener(
            "click",
            () => {
                this.closeMovieModal();
            }
        );

        themeToggle?.addEventListener(
            "click",
            () => {
                this.toggleTheme();
            }
        );

        loadMoreBtn?.addEventListener(
            "click",
            () => {
                this.loadMoreMovies();
            }
        );


        movieModal?.addEventListener(
            "click",
            (event) => {
                const userAction =
                    event.target.closest(
                        "[data-user-action]"
                    );

                if (userAction) {
                    this.toggleUserMovieAction(
                        userAction.dataset.userAction,
                        userAction.dataset.movieId
                    );

                    return;
                }

                const watchlistToggle =
                    event.target.closest(
                        "[data-watchlist-menu-toggle]"
                    );

                if (watchlistToggle) {
                    const menu =
                        watchlistToggle
                            .nextElementSibling;
                    const shouldOpen =
                        menu.hidden;
                    menu.hidden = !shouldOpen;
                    watchlistToggle.setAttribute(
                        "aria-expanded",
                        String(shouldOpen)
                    );
                    return;
                }

                const watchlistChoice =
                    event.target.closest(
                        "[data-watchlist-choice]"
                    );

                if (watchlistChoice) {
                    this.toggleMovieInWatchlist(
                        watchlistChoice.dataset
                            .watchlistChoice,
                        watchlistChoice.dataset
                            .movieId,
                        watchlistChoice
                    );
                    return;
                }

                const newWatchlistToggle =
                    event.target.closest(
                        "[data-new-watchlist-toggle]"
                    );

                if (newWatchlistToggle) {
                    const form =
                        newWatchlistToggle
                            .nextElementSibling;
                    form.hidden = false;
                    newWatchlistToggle.hidden =
                        true;
                    form.querySelector("input")
                        ?.focus();
                    return;
                }

                /*
                 * Benzer film kartlarına tıklandığında
                 * modal kapanmasın.
                 */
                if (
                    event.target.closest(
                        "[data-similar-movie]"
                    )
                ) {
                    return;
                }

                const shouldClose =
                    event.target.dataset.closeModal ===
                    "true";

                if (shouldClose) {
                    this.closeMovieModal();
                }
            }
        );

        movieModal?.addEventListener(
            "change",
            (event) => {
                const ratingSelect =
                    event.target.closest(
                        "[data-user-rating]"
                    );

                if (!ratingSelect) {
                    return;
                }

                this.setUserMovieRating(
                    ratingSelect.dataset.movieId,
                    ratingSelect.value
                );
            }
        );

        movieModal?.addEventListener(
            "submit",
            (event) => {
                const form =
                    event.target.closest(
                        "[data-new-watchlist-form]"
                    );

                if (form) {
                    this.createWatchlistFromPicker(
                        event
                    );
                }
            }
        );


        document.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Escape" &&
                    recommendModal &&
                    !recommendModal.hidden
                ) {
                    recommendModal.hidden = true;
                    recommendModal.setAttribute("aria-hidden", "true");
                    document.body.classList.remove("modal-open");
                    this.resetPusula();
                    recommendTrigger?.focus();
                    return;
                }

                if (
                    event.key === "Escape" &&
                    movieModal &&
                    !movieModal.hidden
                ) {
                    this.closeMovieModal();
                }
            }
        );
    }


    /* =========================
       TEMA
    ========================== */

    loadTheme() {
        try {
            const savedTheme =
                localStorage.getItem(
                    this.THEME_STORAGE_KEY
                );

            if (
                savedTheme === "light" ||
                savedTheme === "dark"
            ) {
                return savedTheme;
            }
        } catch {
            /*
             * localStorage kapalıysa varsayılan tema
             * kullanılmaya devam eder.
             */
        }

        return "dark";
    }


    applyTheme(theme) {
        document.documentElement.dataset.theme =
            theme;

        const themeToggle =
            document.getElementById(
                "themeToggle"
            );

        if (!themeToggle) {
            return;
        }

        const isLight =
            theme === "light";

        themeToggle.innerHTML = isLight
            ? `<svg class="theme-icon theme-icon-moon" aria-hidden="true" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>`
            : `<svg class="theme-icon theme-icon-sun" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

        themeToggle.setAttribute(
            "aria-label",
            isLight
                ? "Karanlık temaya geç"
                : "Açık temaya geç"
        );
    }


    toggleTheme() {
        this.currentTheme =
            this.currentTheme === "light"
                ? "dark"
                : "light";

        this.applyTheme(
            this.currentTheme
        );

        try {
            localStorage.setItem(
                this.THEME_STORAGE_KEY,
                this.currentTheme
            );
        } catch {
            /*
             * Tema mevcut oturumda yine de çalışır.
             */
        }
    }


    /* =========================
       API YARDIMCILARI
    ========================== */

    buildApiUrl(endpoint, parameters = {}) {
        const url = new URL(
            `${this.API_BASE_URL}/tmdb`,
            window.location.href
        );

        const defaultParameters = {
            language: "tr",
            region: "TR"
        };

        const finalParameters = {
            ...defaultParameters,
            ...parameters
        };

        url.searchParams.set("path", endpoint);

        Object.entries(finalParameters).forEach(
            ([key, value]) => {
                if (
                    value !== undefined &&
                    value !== null &&
                    value !== ""
                ) {
                    url.searchParams.set(
                        key,
                        String(value)
                    );
                }
            }
        );

        return url.toString();
    }


    async fetchData(
        endpoint,
        parameters = {},
        options = {}
    ) {
        const url =
            this.buildApiUrl(
                endpoint,
                parameters
            );

        const response =
            await fetch(url, options);

        if (!response.ok) {
            throw new Error(
                `API isteği başarısız oldu. Durum kodu: ${response.status}`
            );
        }

        const data =
            await response.json();

        if (data.success === false) {
            throw new Error(
                data.status_message ||
                "TMDb isteği başarısız oldu."
            );
        }

        return data;
    }


    async fetchOmdbData(imdbId) {
        if (!imdbId) {
            return null;
        }

        try {
            const url =
                new URL(
                    `${this.API_BASE_URL}/omdb`,
                    window.location.href
                );

            url.searchParams.set(
                "i",
                imdbId
            );

            url.searchParams.set(
                "type",
                "movie"
            );

            const response =
                await fetch(
                    url.toString()
                );

            if (!response.ok) {
                return null;
            }

            const data =
                await response.json();

            if (
                data.Response === "False"
            ) {
                return null;
            }

            return data;
        } catch (error) {
            console.error(
                "OMDb verisi çekilirken hata oluştu:",
                error
            );

            return null;
        }
    }


    async fetchMovieImdbRating(movie) {
        const movieId =
            String(movie?.id || "");

        if (!movieId) {
            return null;
        }

        if (
            this.imdbRatingCache.has(
                movieId
            )
        ) {
            return this.imdbRatingCache.get(
                movieId
            );
        }

        try {
            const title =
                movie.original_title ||
                movie.title;

            if (!title) {
                return null;
            }

            const url =
                new URL(
                    `${this.API_BASE_URL}/omdb`,
                    window.location.href
                );

            url.searchParams.set(
                "t",
                title
            );

            url.searchParams.set(
                "type",
                "movie"
            );

            const releaseYear =
                this.getReleaseYear(
                    movie.release_date
                );

            if (
                releaseYear &&
                releaseYear !== "—"
            ) {
                url.searchParams.set(
                    "y",
                    releaseYear
                );
            }

            const response =
                await fetch(url.toString());

            if (!response.ok) {
                return null;
            }

            const data =
                await response.json();

            if (
                data.Response !== "False"
            ) {
                this.omdbMovieCache.set(
                    movieId,
                    data
                );
            }

            const rating =
                data.Response !== "False" &&
                data.imdbRating &&
                data.imdbRating !== "N/A"
                    ? Number(data.imdbRating)
                    : null;

            const validRating =
                Number.isFinite(rating)
                    ? rating
                    : null;

            this.imdbRatingCache.set(
                movieId,
                validRating
            );

            return validRating;
        } catch (error) {
            console.warn(
                "IMDb puanı alınamadı:",
                error
            );

            return null;
        }
    }


    async enrichMoviesWithImdb(movies) {
        const enrichedMovies =
            Array.isArray(movies)
                ? movies.map((movie) => ({
                    ...movie
                }))
                : [];

        const batchSize = 5;

        for (
            let index = 0;
            index < enrichedMovies.length;
            index += batchSize
        ) {
            const batch =
                enrichedMovies.slice(
                    index,
                    index + batchSize
                );

            const ratings =
                await Promise.all(
                    batch.map((movie) => {
                        return this.fetchMovieImdbRating(
                            movie
                        );
                    })
                );

            batch.forEach(
                (movie, batchIndex) => {
                    movie.imdb_rating =
                        ratings[batchIndex];
                }
            );
        }

        return enrichedMovies;
    }


    /* =========================
       TÜRLER
    ========================== */

    async loadGenres() {
        const genreSelect =
            document.getElementById(
                "genreFilter"
            );

        try {
            const data =
                await this.fetchData(
                    "/genre/movie/list"
                );

            const genres =
                Array.isArray(data.genres)
                    ? data.genres
                    : [];

            this.genres =
                genres.reduce(
                    (genreMap, genre) => {
                        genreMap[genre.id] =
                            genre.name;

                        return genreMap;
                    },
                    {}
                );

            if (!genreSelect) {
                return;
            }

            genreSelect.length = 1;

            genres.forEach((genre) => {
                const option =
                    document.createElement(
                        "option"
                    );

                option.value = genre.id;
                option.textContent =
                    genre.name;

                genreSelect.appendChild(
                    option
                );
            });
        } catch (error) {
            console.error(
                "Türler yüklenirken hata oluştu:",
                error
            );

            if (genreSelect) {
                genreSelect.title =
                    "Film türleri yüklenemedi.";
            }
        }
    }


    /* =========================
       YIL FİLTRESİ
    ========================== */

    setupYearFilter() {
        const yearSelect =
            document.getElementById(
                "yearFilter"
            );

        if (!yearSelect) {
            return;
        }

        const currentYear =
            new Date().getFullYear();

        yearSelect.length = 1;

        for (
            let year = currentYear;
            year >= 1950;
            year -= 1
        ) {
            const option =
                document.createElement(
                    "option"
                );

            option.value = year;
            option.textContent = year;

            yearSelect.appendChild(
                option
            );
        }
    }


    /* =========================
       SEYİRCİNİN FAVORİLERİ
    ========================== */

    async loadTrendingMovies() {
        const carousel =
            document.getElementById(
                "trendingCarousel"
            );

        if (!carousel) {
            return;
        }

        carousel.innerHTML =
            this.createSkeletonHTML(
                5,
                "trending"
            );

        try {
            let trendingMovies = [];
            let page = 1;

            const maxPages = 3;

            while (
                trendingMovies.length < 10 &&
                page <= maxPages
            ) {
                const data =
                    await this.fetchData(
                        "/trending/movie/week",
                        {
                            page
                        }
                    );

                const results =
                    Array.isArray(data.results)
                        ? data.results
                        : [];

                trendingMovies =
                    trendingMovies
                        .concat(results)
                        .filter((movie) => {
                            return this.hasValidTurkishTitle(
                                movie
                            );
                        });

                page += 1;
            }

            const enrichedTrendingMovies =
                await this.enrichMoviesWithImdb(
                    trendingMovies.slice(0, 10)
                );

            this.displayTrendingMovies(
                enrichedTrendingMovies
            );
        } catch (error) {
            console.error(
                "Seyircinin favorileri yüklenirken hata oluştu:",
                error
            );

            carousel.innerHTML = `
                <div class="error">
                    Seyircinin favorileri yüklenemedi.
                    Lütfen daha sonra tekrar deneyin.
                </div>
            `;
        }
    }


    displayTrendingMovies(movies) {
        const carousel =
            document.getElementById(
                "trendingCarousel"
            );

        if (!carousel) {
            return;
        }

        if (
            !Array.isArray(movies) ||
            movies.length === 0
        ) {
            carousel.innerHTML = `
                <div class="no-results">
                    <h2>
                        Gösterilecek film bulunamadı.
                    </h2>

                    <p>
                        Favori filmler şu anda görüntülenemiyor.
                    </p>
                </div>
            `;

            return;
        }

        carousel.innerHTML =
            movies
                .map((movie, index) => {
                    return this.createTrendingCard(
                        movie,
                        index + 1
                    );
                })
                .join("");
    }


    createTrendingCard(movie, rank) {
        if (!this.movieDetailsCache.has(String(movie.id))) {
            this.movieDetailsCache.set(String(movie.id), movie);
        }

        const title =
            movie.title ||
            movie.original_title ||
            "İsimsiz Film";

        const safeTitle =
            this.escapeHTML(title);

        const posterPath =
            movie.poster_path
                ? `${this.IMAGE_BASE_URL}${movie.poster_path}`
                : this.FALLBACK_IMAGE;

        const releaseYear =
            this.getReleaseYear(
                movie.release_date
            );

        const rating =
            Number.isFinite(
                Number(movie.imdb_rating)
            ) &&
            Number(movie.imdb_rating) > 0
                ? Number(
                    movie.imdb_rating
                ).toFixed(1)
                : "—";

        const genreNames =
            this.getGenreNames(
                movie.genre_ids
            );

        return `
            <article
                class="trending-card"
                data-movie-id="${movie.id}"
                tabindex="0"
                aria-label="${safeTitle}"
            >
                <img
                    src="${posterPath}"
                    alt="${safeTitle} film afişi"
                    class="movie-poster"
                    loading="lazy"
                    onerror="this.onerror=null; this.src='${this.FALLBACK_IMAGE}'"
                >

                <div class="trending-rank">
                    #${rank}
                </div>

                ${this.createQuickActionsHTML(movie)}

                <div class="trending-overlay">

                    <div class="trending-title">
                        ${safeTitle}
                    </div>

                    <div class="trending-details">

                        <span class="trending-year">
                            ${releaseYear}
                        </span>

                        <span class="trending-rating">
                            IMDb ${rating}
                        </span>

                    </div>

                    <div class="trending-genres">
                        ${this.escapeHTML(genreNames)}
                    </div>

                </div>

            </article>
        `;
    }


    /* =========================
       FİLM ARAMA
    ========================== */

    async handleSearch(query) {
        const trimmedQuery =
            query.trim();

        if (trimmedQuery !== this.currentQuery) {
            this.currentPage = 1;
        }

        this.currentQuery =
            trimmedQuery;

        if (this.searchController) {
            this.searchController.abort();
        }

        if (!trimmedQuery) {
            this.isSearching = false;

            this.updateClearButton();

            if (this.hasActiveFilters()) {
                this.setTrendingVisibility(
                    false
                );

                await this.loadFilteredMovies();
            } else {
                this.setTrendingVisibility(
                    true
                );

                await this.loadRandomMovies();
            }

            return;
        }

        this.isSearching = true;

        this.updateClearButton();

        this.setTrendingVisibility(
            false
        );

        const moviesGrid =
            document.getElementById(
                "moviesGrid"
            );

        if (moviesGrid) {
            moviesGrid.innerHTML =
                this.createSkeletonHTML(10);
        }

        this.searchController =
            new AbortController();

        try {
            const parameters = {
                query: trimmedQuery,
                page: 1,
                include_adult: false
            };

            if (
                this.currentFilters.year
            ) {
                parameters.primary_release_year =
                    this.currentFilters.year;
            }

            const searchData =
                await this.searchMoviesAcrossLanguages(
                    parameters,
                    {
                        signal:
                            this.searchController.signal
                    }
                );

            let results =
                searchData.results.filter((movie) => {
                    return this.hasStandardSearchResult(movie);
                });

            /*
             * Search endpoint'i tür filtresi kabul etmediği
             * için tür filtresi tarayıcı tarafında uygulanır.
             */
            if (
                this.currentFilters.genre
            ) {
                const selectedGenre =
                    Number(
                        this.currentFilters.genre
                    );

                results =
                    results.filter(
                        (movie) => {
                            return (
                                Array.isArray(
                                    movie.genre_ids
                                ) &&
                                movie.genre_ids.includes(
                                    selectedGenre
                                )
                            );
                        }
                    );
            }

            results =
                await this.enrichMoviesWithImdb(
                    results
                );

            if (
                this.currentFilters.sort
            ) {
                results =
                    this.sortMovies(
                        results,
                        this.currentFilters.sort
                    );
            }

            if (
                this.currentQuery !==
                trimmedQuery
            ) {
                return;
            }

            this.displayMovies(
                results,
                "moviesGrid"
            );
        } catch (error) {
            if (
                error.name ===
                "AbortError"
            ) {
                return;
            }

            console.error(
                "Film araması sırasında hata oluştu:",
                error
            );

            if (moviesGrid) {
                moviesGrid.innerHTML = `
                    <div class="error">
                        Arama işlemi başarısız oldu.
                        Lütfen tekrar deneyin.
                    </div>
                `;
            }
        }
    }


    /* =========================
       RASTGELE FİLMLER
    ========================== */

    async loadRandomMovies() {
        const moviesGrid =
            document.getElementById(
                "moviesGrid"
            );

        if (!moviesGrid) {
            return;
        }

        moviesGrid.innerHTML =
            this.createSkeletonHTML(10);

        try {
            let movies = [];
            const archiveBatchSize =
                window.matchMedia("(max-width: 580px)").matches
                    ? 15
                    : 15;

            const randomPage =
                Math.floor(
                    Math.random() * 10
                ) + 1;

            this.randomStartPage = randomPage;
            this.currentPage = 1;

            const firstPageData =
                await this.fetchData(
                    "/discover/movie",
                    {
                        page: randomPage,
                        sort_by:
                            "popularity.desc",
                        include_adult:
                            false,
                        include_video:
                            false
                    }
                );

            const firstResults =
                Array.isArray(
                    firstPageData.results
                )
                    ? firstPageData.results
                    : [];

            movies =
                firstResults.filter(
                    (movie) => {
                        return this.hasValidTurkishTitle(
                            movie
                        );
                    }
                );

            if (movies.length < archiveBatchSize) {
                const additionalPages = [];

                for (
                    let offset = 1;
                    offset <= 9;
                    offset += 1
                ) {
                    const nextPage =
                        (
                            (
                                randomPage - 1 +
                                offset
                            ) % 10
                        ) + 1;

                    additionalPages.push(
                        nextPage
                    );
                }

                const pageSettlements =
                    await Promise.allSettled(
                        additionalPages.map(
                            (page) => {
                                return this.fetchData(
                                    "/discover/movie",
                                    {
                                        page,
                                        sort_by:
                                            "popularity.desc",
                                        include_adult:
                                            false,
                                        include_video:
                                            false
                                    }
                                );
                            }
                        )
                    );

                const pageResults =
                    pageSettlements
                        .filter((result) => {
                            return result.status ===
                                "fulfilled";
                        })
                        .map((result) => {
                            return result.value;
                        });

                this.currentPage =
                    1 + additionalPages.length;

                for (
                    const pageData
                    of pageResults
                ) {
                    const pageMovies =
                        Array.isArray(
                            pageData.results
                        )
                            ? pageData.results
                            : [];

                    movies =
                        movies.concat(
                            pageMovies.filter(
                                (movie) => {
                                    return this.hasValidTurkishTitle(
                                        movie
                                    );
                                }
                            )
                        );

                    if (
                        movies.length >= archiveBatchSize
                    ) {
                        break;
                    }
                }
            }

            const enrichedMovies =
                await this.enrichMoviesWithImdb(
                    movies
                        .filter((movie, index, all) => {
                            return all.findIndex(
                                (item) => item.id === movie.id
                            ) === index;
                        })
                        .slice(0, archiveBatchSize)
                );

            this.displayMovies(
                enrichedMovies,
                "moviesGrid"
            );
        } catch (error) {
            console.error(
                "Filmler yüklenirken hata oluştu:",
                error
            );

            moviesGrid.innerHTML = `
                <div class="error">
                    Filmler yüklenemedi.
                    Lütfen daha sonra tekrar deneyin.
                </div>
            `;
        }
    }


    /* =========================
       FİLTRELER
    ========================== */

    async handleFilterChange() {
        this.currentPage = 1;
        const genreFilter =
            document.getElementById(
                "genreFilter"
            );

        const yearFilter =
            document.getElementById(
                "yearFilter"
            );

        const sortFilter =
            document.getElementById(
                "sortFilter"
            );

        const searchInput =
            document.getElementById(
                "searchInput"
            );

        this.currentFilters = {
            genre:
                genreFilter?.value || "",
            year:
                yearFilter?.value || "",
            sort:
                sortFilter?.value || ""
        };

        this.updateClearButton();

        const query =
            searchInput?.value.trim() ||
            "";

        if (query) {
            this.setTrendingVisibility(
                false
            );

            await this.handleSearch(
                query
            );

            return;
        }

        if (this.hasActiveFilters()) {
            this.setTrendingVisibility(
                false
            );

            await this.loadFilteredMovies();
        } else {
            this.setTrendingVisibility(
                true
            );

            await this.loadRandomMovies();
        }
    }


    async loadFilteredMovies() {
        const moviesGrid =
            document.getElementById(
                "moviesGrid"
            );

        if (!moviesGrid) {
            return;
        }

        moviesGrid.innerHTML =
            this.createSkeletonHTML(10);

        try {
            const parameters = {
                include_adult: false,
                include_video: false
            };

            if (
                this.currentFilters.year
            ) {
                parameters.primary_release_year =
                    this.currentFilters.year;
            }

            if (
                this.currentFilters.genre
            ) {
                parameters.with_genres =
                    this.currentFilters.genre;
            }

            parameters.sort_by =
                this.currentFilters.sort ===
                "imdb_rating.desc"
                    ? "popularity.desc"
                    : (
                        this.currentFilters.sort
                            ? this.normalizeSortValue(
                                this.currentFilters.sort
                            )
                            : "popularity.desc"
                    );

            if (
                parameters.sort_by ===
                "vote_average.desc"
            ) {
                parameters[
                    "vote_count.gte"
                ] = 100;
            }

            const firstPageData =
                await this.fetchData(
                    "/discover/movie",
                    {
                        ...parameters,
                        page: 1
                    }
                );

            let movies =
                Array.isArray(
                    firstPageData.results
                )
                    ? firstPageData.results
                    : [];

            movies =
                movies.filter(
                    (movie) => {
                        return this.hasValidTurkishTitle(
                            movie
                        );
                    }
                );

            const totalPages =
                Math.min(
                    Number(
                        firstPageData.total_pages
                    ) || 1,
                    5
                );

            this.currentPage = totalPages;

            if (totalPages > 1) {
                const additionalPages =
                    [];

                for (
                    let page = 2;
                    page <= totalPages;
                    page += 1
                ) {
                    additionalPages.push(
                        page
                    );
                }

                const responses =
                    await Promise.all(
                        additionalPages.map(
                            (page) => {
                                return this.fetchData(
                                    "/discover/movie",
                                    {
                                        ...parameters,
                                        page
                                    }
                                );
                            }
                        )
                    );

                responses.forEach(
                    (pageData) => {
                        const pageMovies =
                            Array.isArray(
                                pageData.results
                            )
                                ? pageData.results
                                : [];

                        movies =
                            movies.concat(
                                pageMovies.filter(
                                    (movie) => {
                                        return this.hasValidTurkishTitle(
                                            movie
                                        );
                                    }
                                )
                            );
                    }
                );
            }

            movies =
                await this.enrichMoviesWithImdb(
                    movies
                );

            if (this.currentFilters.sort) {
                movies = this.sortMovies(
                    movies,
                    this.currentFilters.sort
                );
            }

            this.displayMovies(
                movies,
                "moviesGrid"
            );
        } catch (error) {
            console.error(
                "Filtrelenen filmler yüklenirken hata oluştu:",
                error
            );

            moviesGrid.innerHTML = `
                <div class="error">
                    Filtrelenen filmler yüklenemedi.
                    Lütfen tekrar deneyin.
                </div>
            `;
        }
    }

    async loadMoreMovies() {
        const button =
            document.getElementById("loadMoreBtn");

        if (!button || button.disabled) {
            return;
        }

        button.disabled = true;
        button.querySelector("span").textContent =
            "Filmler Yükleniyor...";

        const startingPage = this.currentPage;

        try {
            let endpoint = "/discover/movie";
            const parameters = {
                include_adult: false
            };

            if (this.currentQuery) {
                endpoint = "/search/movie";
                parameters.query = this.currentQuery;

                if (this.currentFilters.year) {
                    parameters.primary_release_year =
                        this.currentFilters.year;
                }
            } else if (!this.hasActiveFilters()) {
                parameters.sort_by = "popularity.desc";
                parameters.include_video = false;
            } else {
                parameters.include_video = false;
                parameters.sort_by =
                    this.currentFilters.sort ===
                    "imdb_rating.desc"
                        ? "popularity.desc"
                        : (
                            this.currentFilters.sort
                                ? this.normalizeSortValue(
                                    this.currentFilters.sort
                                )
                                : "popularity.desc"
                        );

                if (this.currentFilters.genre) {
                    parameters.with_genres =
                        this.currentFilters.genre;
                }

                if (this.currentFilters.year) {
                    parameters.primary_release_year =
                        this.currentFilters.year;
                }
            }

            let movies = [];
            let requestsMade = 0;
            const archiveBatchSize =
                window.matchMedia("(max-width: 580px)").matches
                    ? 15
                    : 30;

            while (movies.length < archiveBatchSize && requestsMade < 5) {
                this.currentPage += 1;
                requestsMade += 1;

                const requestedPage =
                    !this.currentQuery &&
                    !this.hasActiveFilters()
                        ? this.randomStartPage + this.currentPage - 1
                        : this.currentPage;

                const data = this.currentQuery
                    ? await this.searchMoviesAcrossLanguages({
                        ...parameters,
                        page: requestedPage
                    })
                    : await this.fetchData(
                        endpoint,
                        {
                            ...parameters,
                            page: requestedPage
                        }
                    );

                let pageMovies =
                    Array.isArray(data.results)
                        ? data.results
                        : [];

                if (this.currentQuery && this.currentFilters.genre) {
                    const genreId =
                        Number(this.currentFilters.genre);

                    pageMovies = pageMovies.filter((movie) =>
                        movie.genre_ids?.includes(genreId)
                    );
                }

                pageMovies = pageMovies.filter((movie) => {
                    return this.currentQuery
                        ? this.hasStandardSearchResult(movie)
                        : this.hasValidTurkishTitle(movie);
                });

                movies = movies.concat(pageMovies);

                if (
                    pageMovies.length === 0 &&
                    this.currentPage >= Number(data.total_pages || 1)
                ) {
                    break;
                }
            }

            movies =
                await this.enrichMoviesWithImdb(
                    movies.slice(0, archiveBatchSize)
                );

            if (this.currentFilters.sort) {
                movies = this.sortMovies(
                    movies,
                    this.currentFilters.sort
                );
            }

            this.displayMovies(
                movies,
                "moviesGrid",
                true
            );
        } catch (error) {
            this.currentPage = startingPage;
            console.error(
                "Daha fazla film yüklenirken hata oluştu:",
                error
            );
        } finally {
            button.disabled = false;
            button.querySelector("span").textContent =
                "Daha Fazla Film Göster";
        }
    }


    /* =========================
       FİLM KARTLARI
    ========================== */

    createSkeletonHTML(
        count = 10,
        type = "grid"
    ) {
        return Array.from(
            { length: count },
            () => {
                return `
                    <div class="skeleton-card ${type === "trending" ? "is-trending" : ""}" aria-hidden="true">
                        <div class="skeleton-poster"></div>
                        <div class="skeleton-copy">
                            <i></i>
                            <i></i>
                            <i></i>
                        </div>
                    </div>
                `;
            }
        ).join("");
    }


    displayMovies(
        movies,
        containerId,
        append = false
    ) {
        const container =
            document.getElementById(
                containerId
            );

        if (!container) {
            return;
        }

        const validMovies =
            Array.isArray(movies)
                ? movies.filter(
                    (movie) => {
                        const isArchiveSearch =
                            containerId === "moviesGrid" &&
                            Boolean(this.currentQuery);

                        return isArchiveSearch
                            ? this.hasStandardSearchResult(movie)
                            : this.hasValidTurkishTitle(movie);
                    }
                )
                : [];

        if (
            validMovies.length === 0
        ) {
            this.updateResultsToolbar(0, append);
            if (append) {
                return;
            }

            container.innerHTML = `
                <div class="no-results">

                    <h2>
                        Film bulunamadı.
                    </h2>

                    <p>
                        Arama sözcüğünüzü veya filtrelerinizi
                        değiştirmeyi deneyin.
                    </p>

                </div>
            `;

            return;
        }

        const visibleMovies =
            window.matchMedia("(max-width: 580px)").matches
                ? validMovies.slice(0, 15)
                : validMovies;

        const movieCards =
            visibleMovies
                .map((movie) => {
                    return this.createMovieCard(
                        movie
                    );
                })
                .join("");

        if (append) {
            container.insertAdjacentHTML(
                "beforeend",
                movieCards
            );
        } else {
            container.innerHTML = movieCards;
        }

        this.arrangeMobileArchiveRows(container);
        this.updateResultsToolbar(visibleMovies.length, append);
    }

    arrangeMobileArchiveRows(container) {
        if (!container || container.id !== "moviesGrid") {
            return;
        }

        const existingRows =
            Array.from(
                container.querySelectorAll(
                    ":scope > .archive-mobile-row"
                )
            );

        const cards = [
            ...existingRows.flatMap((row) =>
                Array.from(row.children)
            ),
            ...Array.from(
                container.querySelectorAll(
                    ":scope > .movie-card"
                )
            )
        ];

        if (!window.matchMedia("(max-width: 580px)").matches) {
            if (existingRows.length) {
                container.replaceChildren(...cards);
            }
            return;
        }

        if (!cards.length) {
            return;
        }

        const rows = [];

        for (let index = 0; index < cards.length; index += 5) {
            const row = document.createElement("div");
            row.className = "archive-mobile-row";
            row.append(...cards.slice(index, index + 5));
            rows.push(row);
        }

        container.replaceChildren(...rows);
    }

    updateResultsToolbar(resultCount, append = false) {
        const summary = document.getElementById("resultsSummary");
        const chips = document.getElementById("activeFilterChips");
        const grid = document.getElementById("moviesGrid");
        if (!summary || !chips) return;

        const displayedCount = append
            ? grid?.querySelectorAll(".movie-card").length || resultCount
            : resultCount;

        summary.textContent = `${displayedCount} film gösteriliyor`;

        const genreSelect = document.getElementById("genreFilter");
        const yearSelect = document.getElementById("yearFilter");
        const sortSelect = document.getElementById("sortFilter");
        const activeChips = [];

        if (this.currentQuery) {
            activeChips.push(["query", `“${this.currentQuery}”`]);
        }
        if (this.currentFilters.genre) {
            activeChips.push(["genre", genreSelect?.selectedOptions[0]?.textContent.trim()]);
        }
        if (this.currentFilters.year) {
            activeChips.push(["year", yearSelect?.selectedOptions[0]?.textContent.trim()]);
        }
        if (this.currentFilters.sort) {
            activeChips.push(["sort", sortSelect?.selectedOptions[0]?.textContent.trim()]);
        }

        chips.innerHTML = activeChips
            .map(([name, label]) => `
                <button type="button" data-clear-filter="${name}" aria-label="${this.escapeHTML(label)} filtresini kaldır">
                    ${this.escapeHTML(label)} <span aria-hidden="true">×</span>
                </button>
            `)
            .join("");
    }


    hasValidTurkishTitle(movie) {
        const hasTitle =
            Boolean(
                movie.title &&
                movie.title.trim()
            );

        const isTurkishOriginal =
            movie.original_language ===
            "tr";

        const isTranslated =
            movie.title !==
            movie.original_title;

        return (
            hasTitle &&
            (
                isTurkishOriginal ||
                isTranslated
            )
        );
    }

    hasStandardSearchResult(movie) {
        return Boolean(
            movie?.poster_path &&
            String(movie?.overview || "").trim() &&
            this.hasValidTurkishTitle(movie)
        );
    }

    async searchMoviesAcrossLanguages(parameters, options = {}) {
        const [turkishData, englishData] =
            await Promise.all([
                this.fetchData(
                    "/search/movie",
                    {
                        ...parameters,
                        language: "tr-TR"
                    },
                    options
                ),
                this.fetchData(
                    "/search/movie",
                    {
                        ...parameters,
                        language: "en-US"
                    },
                    options
                )
            ]);

        const turkishResults =
            Array.isArray(turkishData.results)
                ? turkishData.results
                : [];
        const englishResults =
            Array.isArray(englishData.results)
                ? englishData.results
                : [];
        const turkishById =
            new Map(
                turkishResults.map((movie) => {
                    return [String(movie.id), movie];
                })
            );
        const missingTurkishIds =
            englishResults
                .map((movie) => String(movie?.id || ""))
                .filter((id) => id && !turkishById.has(id));
        const localizedDetails =
            await Promise.allSettled(
                missingTurkishIds.map((id) => {
                    return this.fetchData(
                        `/movie/${encodeURIComponent(id)}`,
                        {
                            language: "tr-TR"
                        },
                        options
                    );
                })
            );

        localizedDetails.forEach((result) => {
            if (result.status !== "fulfilled") {
                return;
            }

            const movie = result.value;
            turkishById.set(
                String(movie.id),
                {
                    ...movie,
                    genre_ids:
                        Array.isArray(movie.genres)
                            ? movie.genres.map((genre) => genre.id)
                            : []
                }
            );
        });

        const merged = [];
        const seenIds = new Set();
        const resultCount =
            Math.max(
                turkishResults.length,
                englishResults.length
            );

        for (let index = 0; index < resultCount; index += 1) {
            [
                turkishResults[index],
                englishResults[index]
            ].forEach((candidate) => {
                const id = String(candidate?.id || "");
                const localizedMovie = turkishById.get(id);

                if (
                    !id ||
                    seenIds.has(id) ||
                    !localizedMovie
                ) {
                    return;
                }

                seenIds.add(id);
                merged.push(localizedMovie);
            });
        }

        return {
            ...turkishData,
            total_pages:
                Math.max(
                    Number(turkishData.total_pages) || 1,
                    Number(englishData.total_pages) || 1
                ),
            results: merged
        };
    }


    createMovieCard(
        movie,
        personalRating = null,
        libraryCollection = ""
    ) {
        if (!this.movieDetailsCache.has(String(movie.id))) {
            this.movieDetailsCache.set(String(movie.id), movie);
        }

        const title =
            movie.title ||
            movie.original_title ||
            "İsimsiz Film";

        const safeTitle =
            this.escapeHTML(title);

        const posterPath =
            movie.poster_path
                ? `${this.IMAGE_BASE_URL}${movie.poster_path}`
                : this.FALLBACK_IMAGE;

        const releaseYear =
            this.getReleaseYear(
                movie.release_date
            );

        const rating =
            Number.isFinite(
                Number(movie.imdb_rating)
            ) &&
            Number(movie.imdb_rating) > 0
                ? Number(
                    movie.imdb_rating
                ).toFixed(1)
                : "—";

        const genreNames =
            this.getGenreNames(
                movie.genre_ids
            );

        const description =
            movie.overview?.trim()
                ? movie.overview
                : "Bu film için henüz Türkçe bir açıklama bulunmuyor.";

        return `
            <article
                class="movie-card"
                data-movie-id="${movie.id}"
                tabindex="0"
                aria-label="${safeTitle}"
            >
                <img
                    src="${posterPath}"
                    alt="${safeTitle} film afişi"
                    class="movie-poster"
                    loading="lazy"
                    onerror="this.onerror=null; this.src='${this.FALLBACK_IMAGE}'"
                >

                ${this.createQuickActionsHTML(movie)}

                ${
                    libraryCollection
                        ? `
                            <button
                                type="button"
                                class="library-quick-remove"
                                data-library-remove="${libraryCollection}"
                                data-movie-id="${movie.id}"
                                aria-label="${safeTitle} filmini listeden çıkar"
                                title="Listeden çıkar"
                            >
                                ×
                            </button>
                        `
                        : ""
                }

                ${
                    personalRating
                        ? `
                            <div
                                class="movie-personal-rating"
                                aria-label="Kişisel puanım ${personalRating}/10"
                            >
                                <span class="personal-rating-star" aria-hidden="true">★</span>
                                <span>${personalRating}/10</span>
                            </div>
                        `
                        : ""
                }

                <div class="movie-info">

                    <div
                        class="movie-title"
                        title="${safeTitle}"
                    >
                        ${safeTitle}
                    </div>

                    <div class="movie-details">

                        <span class="movie-year">
                            ${releaseYear}
                        </span>

                        <span class="movie-rating">
                            IMDb ${rating}
                        </span>

                    </div>

                    <div class="movie-genres">
                        ${this.escapeHTML(genreNames)}
                    </div>

                    <div class="movie-description">
                        ${this.escapeHTML(description)}
                    </div>

                </div>

            </article>
        `;
    }

    createQuickActionsHTML(movie) {
        if (this.isSharedView) {
            return "";
        }

        const movieId = String(movie.id);
        const hasAccount = Boolean(this.getActiveAccountId());
        const actions = [
            {
                name: "favorites",
                icon: "♥",
                label: "Favori",
                active: hasAccount && Boolean(this.userLibrary.favorites[movieId])
            },
            {
                name: "watchlist",
                icon: "＋",
                label: "Liste",
                active: hasAccount && Boolean(this.userLibrary.watchlist[movieId])
            },
            {
                name: "watched",
                icon: "✓",
                label: "İzlendi",
                active: hasAccount && Boolean(this.userLibrary.watched[movieId])
            }
        ];

        return `
            <div class="card-quick-actions" aria-label="Film işlemleri">
                ${actions.map((action) => `
                    <button
                        type="button"
                        class="card-quick-action ${action.active ? "is-active" : ""}"
                        data-quick-action="${action.name}"
                        data-movie-id="${movieId}"
                        aria-pressed="${action.active}"
                        aria-label="${this.escapeHTML(movie.title || "Film")}: ${action.label}"
                        title="${action.label}"
                    ><span aria-hidden="true">${action.icon}</span></button>
                `).join("")}
            </div>
        `;
    }


    /* =========================
       SIRALAMA
    ========================== */

    sortMovies(movies, sortBy) {
        const normalizedSort =
            this.normalizeSortValue(
                sortBy
            );

        const sortedMovies =
            [...movies];

        switch (normalizedSort) {
            case "imdb_rating.desc":
                return sortedMovies.sort(
                    (
                        firstMovie,
                        secondMovie
                    ) => {
                        return (
                            (
                                Number(
                                    secondMovie.imdb_rating
                                ) || 0
                            ) -
                            (
                                Number(
                                    firstMovie.imdb_rating
                                ) || 0
                            )
                        );
                    }
                );

            case "popularity.desc":
                return sortedMovies.sort(
                    (
                        firstMovie,
                        secondMovie
                    ) => {
                        return (
                            (
                                secondMovie.popularity ||
                                0
                            ) -
                            (
                                firstMovie.popularity ||
                                0
                            )
                        );
                    }
                );

            case "vote_average.desc":
                return sortedMovies.sort(
                    (
                        firstMovie,
                        secondMovie
                    ) => {
                        return (
                            (
                                secondMovie.vote_average ||
                                0
                            ) -
                            (
                                firstMovie.vote_average ||
                                0
                            )
                        );
                    }
                );

            case "primary_release_date.desc":
                return sortedMovies.sort(
                    (
                        firstMovie,
                        secondMovie
                    ) => {
                        const firstDate =
                            firstMovie.release_date
                                ? new Date(
                                    firstMovie.release_date
                                ).getTime()
                                : 0;

                        const secondDate =
                            secondMovie.release_date
                                ? new Date(
                                    secondMovie.release_date
                                ).getTime()
                                : 0;

                        return (
                            secondDate -
                            firstDate
                        );
                    }
                );

            case "title.asc":
                return sortedMovies.sort(
                    (
                        firstMovie,
                        secondMovie
                    ) => {
                        const firstTitle =
                            firstMovie.title ||
                            firstMovie.original_title ||
                            "";

                        const secondTitle =
                            secondMovie.title ||
                            secondMovie.original_title ||
                            "";

                        return firstTitle.localeCompare(
                            secondTitle,
                            "tr",
                            {
                                sensitivity:
                                    "base"
                            }
                        );
                    }
                );

            default:
                return sortedMovies;
        }
    }


    normalizeSortValue(sortValue) {
        if (
            sortValue ===
            "release_date.desc"
        ) {
            return "primary_release_date.desc";
        }

        return sortValue;
    }


    /* =========================
       FİLTRELERİ TEMİZLE
    ========================== */

    async clearAllFilters() {
        const searchInput =
            document.getElementById(
                "searchInput"
            );

        const genreFilter =
            document.getElementById(
                "genreFilter"
            );

        const yearFilter =
            document.getElementById(
                "yearFilter"
            );

        const sortFilter =
            document.getElementById(
                "sortFilter"
            );

        if (this.searchController) {
            this.searchController.abort();

            this.searchController = null;
        }

        if (searchInput) {
            searchInput.value = "";
        }

        if (genreFilter) {
            genreFilter.value = "";
        }

        if (yearFilter) {
            yearFilter.value = "";
        }

        if (sortFilter) {
            sortFilter.value = "";
        }

        this.currentFilters = {
            genre: "",
            year: "",
            sort: ""
        };

        this.currentQuery = "";
        this.currentPage = 1;
        this.isSearching = false;

        this.updateClearButton();

        this.setTrendingVisibility(
            true
        );

        await this.loadRandomMovies();
    }


    /* =========================
       CAROUSEL
    ========================== */

    scrollCarousel(direction) {
        const carousel =
            document.getElementById(
                "trendingCarousel"
            );

        if (!carousel) {
            return;
        }

        const scrollAmount =
            Math.max(
                320,
                carousel.clientWidth * 0.8
            );

        carousel.scrollBy({
            left:
                direction === "prev"
                    ? -scrollAmount
                    : scrollAmount,
            behavior: "smooth"
        });
    }


    /* =========================
       FİLM DETAY MODALI
    ========================== */

    async openMovieModal(
        movieId,
        triggerElement = null
    ) {
        const modal =
            document.getElementById(
                "movieModal"
            );

        const modalBody =
            document.getElementById(
                "movieModalBody"
            );

        const closeButton =
            document.getElementById(
                "movieModalClose"
            );

        if (
            !modal ||
            !modalBody ||
            !movieId
        ) {
            return;
        }

        const normalizedMovieId =
            String(movieId);

        this.activeModalMovieId =
            normalizedMovieId;

        this.lastFocusedElement =
            triggerElement ||
            document.activeElement;

        modal.hidden = false;

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modal-open"
        );

        modalBody.innerHTML = `
            <div class="modal-loading">
                Film bilgileri yükleniyor...
            </div>
        `;

        closeButton?.focus();

        try {
            let movieDetails;

            const cachedMovie =
                this.movieDetailsCache.get(
                    normalizedMovieId
                );

            const cachedMovieHasProviders =
                cachedMovie &&
                Object.prototype.hasOwnProperty.call(
                    cachedMovie,
                    "watch/providers"
                );

            if (
                cachedMovie?.credits &&
                cachedMovie?.external_ids &&
                cachedMovieHasProviders
            ) {
                movieDetails = cachedMovie;
            } else {
                movieDetails =
                    await this.fetchData(
                        `/movie/${normalizedMovieId}`,
                        {
                            language:
                                "tr-TR",
                            append_to_response:
                                "credits,videos,external_ids,watch/providers,similar"
                        }
                    );

                movieDetails =
                    await this.fillMissingMovieDetails(
                        normalizedMovieId,
                        movieDetails
                    );

                this.movieDetailsCache.set(
                    normalizedMovieId,
                    movieDetails
                );
            }

            /*
             * IMDb ID'si varsa OMDb verilerini çek
             */
            const imdbId =
                movieDetails.external_ids?.imdb_id;

            let omdbData =
                this.omdbMovieCache.get(
                    normalizedMovieId
                ) || null;

            if (!omdbData && imdbId) {
                omdbData =
                    await this.fetchOmdbData(
                        imdbId
                    );

                if (omdbData) {
                    this.omdbMovieCache.set(
                        normalizedMovieId,
                        omdbData
                    );
                }
            }

            movieDetails.omdb = omdbData;

            if (
                Array.isArray(
                    movieDetails.similar
                        ?.results
                )
            ) {
                let similarMovies =
                    movieDetails.similar.results;
                let similarPage = 2;

                while (
                    similarMovies.filter((movie) => {
                        return (
                            movie.poster_path &&
                            this.hasValidTurkishTitle(movie)
                        );
                    }).length < 8 &&
                    similarPage <= 10
                ) {
                    const moreSimilar =
                        await this.fetchData(
                            `/movie/${normalizedMovieId}/similar`,
                            {
                                language: "tr-TR",
                                page: similarPage
                            }
                        );

                    similarMovies =
                        similarMovies.concat(
                            moreSimilar.results || []
                        );
                    similarPage += 1;
                }

                similarMovies =
                    similarMovies
                        .filter((movie) => {
                            return (
                                movie.poster_path &&
                                this.hasValidTurkishTitle(
                                    movie
                                )
                            );
                        })
                        .filter((movie, index, all) => {
                            return all.findIndex(
                                (item) => item.id === movie.id
                            ) === index;
                        })
                        .slice(0, 8);

                movieDetails.similar.results =
                    await this.enrichMoviesWithImdb(
                        similarMovies
                    );
            }

            if (
                modal.hidden ||
                this.activeModalMovieId !==
                    normalizedMovieId
            ) {
                return;
            }

            this.displayMovieDetails(
                movieDetails
            );
        } catch (error) {
            console.error(
                "Film detayları yüklenirken hata oluştu:",
                error
            );

            if (
                modal.hidden ||
                this.activeModalMovieId !==
                    normalizedMovieId
            ) {
                return;
            }

            modalBody.innerHTML = `
                <div class="movie-modal-error">

                    <h2>
                        Film bilgileri yüklenemedi.
                    </h2>

                    <p>
                        Bağlantınızı kontrol edip filmi
                        yeniden açmayı deneyin.
                    </p>

                </div>
            `;
        }
    }
        closeMovieModal() {
        const modal =
            document.getElementById(
                "movieModal"
            );

        const modalBody =
            document.getElementById(
                "movieModalBody"
            );

        if (!modal) {
            return;
        }

        modal.hidden = true;

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "modal-open"
        );

        this.activeModalMovieId = null;

        /*
         * Modal kapandığında iframe temizlenir.
         * Böylece fragman oynamaya devam etmez.
         */
        if (modalBody) {
            modalBody.innerHTML = "";
        }

        if (
            this.lastFocusedElement &&
            typeof this.lastFocusedElement.focus ===
                "function"
        ) {
            this.lastFocusedElement.focus();
        }
    }


    displayMovieDetails(movie) {
        const modalBody =
            document.getElementById(
                "movieModalBody"
            );

        if (!modalBody) {
            return;
        }

        const title =
            movie.title ||
            movie.original_title ||
            "İsimsiz Film";

        const originalTitle =
            movie.original_title &&
            movie.original_title !== title
                ? movie.original_title
                : "";

        const posterPath =
            movie.poster_path
                ? `${this.IMAGE_BASE_URL}${movie.poster_path}`
                : this.FALLBACK_IMAGE;

        const backdropPath =
            movie.backdrop_path
                ? `${this.BACKDROP_BASE_URL}${movie.backdrop_path}`
                : posterPath;

        const releaseDate =
            movie.release_date
                ? this.formatDate(
                    movie.release_date
                )
                : "Tarih bilgisi yok";

        const runtime =
            this.formatRuntime(
                movie.runtime ||
                this.parseOmdbRuntime(
                    movie.omdb?.Runtime
                )
            );

        const rating =
            this.formatRating(
                movie.vote_average
            );

        const voteCountValue =
            Number(movie.vote_count);

        const voteCount =
            Number.isFinite(
                voteCountValue
            )
                ? voteCountValue.toLocaleString(
                    "tr-TR"
                )
                : "0";

        /*
         * IMDb verileri (varsa TMDb yerine kullan)
         */
        const imdbRating =
            movie.omdb?.imdbRating &&
            movie.omdb.imdbRating !== "N/A"
                ? movie.omdb.imdbRating
                : null;

        const imdbVotes =
            movie.omdb?.imdbVotes &&
            movie.omdb.imdbVotes !== "N/A"
                ? Number(
                    movie.omdb.imdbVotes
                        .replace(/,/g, "")
                ).toLocaleString("tr-TR")
                : null;

        const displayRating =
            imdbRating || "—";

        const displayVotes =
            imdbVotes || "—";

        const genres =
            Array.isArray(movie.genres)
                ? movie.genres
                    .map((genre) => {
                        return genre.name;
                    })
                    .filter(Boolean)
                    .join(", ")
                : "Tür bilgisi bulunmuyor";

        const overview =
            movie.overview?.trim()
                ? movie.overview
                : "Bu film için henüz Türkçe bir açıklama bulunmuyor.";

        const director =
            this.getMovieDirector(
                movie.credits
            );

        const cast =
            this.getMovieCast(
                movie.credits
            );

        const trailer =
            this.getMovieTrailer(
                movie.videos
            );

        const similarMovies =
            this.getSimilarMovies(
                movie
            );

        const imdbId =
            movie.external_ids?.imdb_id ||
            "";

        const watchProviders =
            movie["watch/providers"]
                ?.results?.TR ||
            null;

        const userActionsHTML =
            this.createUserActionsHTML(movie);

        modalBody.innerHTML = `
            <div class="movie-modal-hero">

                <img
                    src="${backdropPath}"
                    alt=""
                    class="movie-modal-backdrop-image"
                    onerror="this.onerror=null; this.src='${posterPath}'"
                >

                <div class="movie-modal-hero-content">

                    <img
                        src="${posterPath}"
                        alt="${this.escapeHTML(title)} film afişi"
                        class="movie-modal-poster"
                        onerror="this.onerror=null; this.src='${this.FALLBACK_IMAGE}'"
                    >

                    <div class="movie-modal-heading">

                        <h2
                            class="movie-modal-title"
                            id="modalMovieTitle"
                        >
                            ${this.escapeHTML(title)}
                        </h2>

                        ${
                            originalTitle
                                ? `
                                    <div class="movie-modal-original-title">
                                        ${this.escapeHTML(originalTitle)}
                                    </div>
                                `
                                : ""
                        }

                        <div class="movie-modal-meta">

                            <span>
                                ${this.escapeHTML(releaseDate)}
                            </span>

                            <span>
                                ${this.escapeHTML(runtime)}
                            </span>

                            <span class="modal-rating">
                                IMDb ${displayRating}
                            </span>

                            <span>
                                ${displayVotes} oy
                            </span>

                        </div>

                        <div class="movie-modal-genres">
                            ${this.escapeHTML(genres)}
                        </div>

                        ${userActionsHTML}

                    </div>

                </div>

            </div>


            <div class="movie-modal-content">

                <div class="movie-modal-main">

                    <section class="movie-modal-section">

                        <h3 class="movie-modal-section-title">
                            Film Hakkında
                        </h3>

                        <p class="movie-modal-overview">
                            ${this.escapeHTML(overview)}
                        </p>

                    </section>

                    <section class="movie-modal-section">

                        <h3 class="movie-modal-section-title">
                            Oyuncular
                        </h3>

                        ${this.createCastHTML(cast)}

                    </section>


                    <section class="movie-modal-section">

                        <h3 class="movie-modal-section-title">
                            Nereden İzlenir?
                        </h3>

                        ${this.createWatchProvidersHTML(
                            watchProviders
                        )}

                    </section>


                    <section class="movie-modal-section">

                        <h3 class="movie-modal-section-title">
                            Fragman
                        </h3>

                        ${this.createTrailerHTML(
                            trailer,
                            title
                        )}

                    </section>


                    <section class="movie-modal-section">

                        <h3 class="movie-modal-section-title">
                            Benzer Filmler
                        </h3>

                        ${this.createSimilarMoviesHTML(
                            similarMovies
                        )}

                    </section>

                </div>


                <aside class="movie-modal-sidebar">

                    <div class="movie-modal-facts">

                        <div class="movie-modal-fact">

                            <span class="movie-modal-fact-label">
                                Yönetmen
                            </span>

                            <span class="movie-modal-fact-value">
                                ${this.escapeHTML(director)}
                            </span>

                        </div>


                        <div class="movie-modal-fact">

                            <span class="movie-modal-fact-label">
                                Durum
                            </span>

                            <span class="movie-modal-fact-value">
                                ${this.escapeHTML(
                                    this.getMovieStatus(
                                        movie.status
                                    )
                                )}
                            </span>

                        </div>


                        <div class="movie-modal-fact">

                            <span class="movie-modal-fact-label">
                                Orijinal Dil
                            </span>

                            <span class="movie-modal-fact-value">
                                ${this.escapeHTML(
                                    this.getLanguageName(
                                        movie.original_language
                                    )
                                )}
                            </span>

                        </div>


                        <div class="movie-modal-fact">

                            <span class="movie-modal-fact-label">
                                Yapım Ülkeleri
                            </span>

                            <span class="movie-modal-fact-value">
                                ${this.escapeHTML(
                                    this.getProductionCountries(
                                        movie
                                    )
                                )}
                            </span>

                        </div>


                        ${
                            movie.tagline
                                ? `
                                    <div class="movie-modal-fact">

                                        <span class="movie-modal-fact-label">
                                            Slogan
                                        </span>

                                        <span class="movie-modal-fact-value">
                                            “${this.escapeHTML(movie.tagline)}”
                                        </span>

                                    </div>
                                `
                                : ""
                        }

                        ${this.createOmdbFactsHTML(
                            movie.omdb
                        )}

                        ${this.createAwardsFactHTML(
                            movie.omdb
                        )}

                    </div>

                </aside>

            </div>
        `;

        /*
         * Benzer film kartlarına tıklandığında
         * yeni modal açmak için event listener
         */
        const similarCards =
            modalBody.querySelectorAll(
                ".similar-movie-card"
            );

        similarCards.forEach((card) => {
            card.addEventListener(
                "click",
                (event) => {
                    event.stopPropagation();

                    const movieId =
                        event.currentTarget
                            .dataset.movieId;

                    this.openMovieModal(
                        movieId
                    );
                }
            );

            card.addEventListener(
                "keydown",
                (event) => {
                    if (
                        event.key !== "Enter" &&
                        event.key !== " "
                    ) {
                        return;
                    }

                    event.preventDefault();

                    event.stopPropagation();

                    const movieId =
                        event.currentTarget
                            .dataset.movieId;

                    this.openMovieModal(
                        movieId
                    );
                }
            );
        });
    }


    /* =========================
       KULLANICI LİSTELERİ
    ========================== */

    readSharedListFromURL() {
        const encoded =
            new URLSearchParams(
                window.location.search
            ).get("paylas");

        if (!encoded) {
            return null;
        }

        try {
            const normalized =
                encoded
                    .replace(/-/g, "+")
                    .replace(/_/g, "/");

            const padding =
                "=".repeat(
                    (4 - normalized.length % 4) % 4
                );

            const bytes =
                Uint8Array.from(
                    atob(normalized + padding),
                    (character) => {
                        return character.charCodeAt(0);
                    }
                );

            const payload =
                JSON.parse(
                    new TextDecoder()
                        .decode(bytes)
                );

            if (
                ![1, 2].includes(payload?.v)
            ) {
                return null;
            }

            const toCollection =
                (movies) => {
                    return Object.fromEntries(
                        (Array.isArray(movies)
                            ? movies
                            : []
                        )
                            .slice(0, 300)
                            .filter((movie) => {
                                return (
                                    movie &&
                                    movie.id !==
                                        undefined &&
                                    /^\d+$/.test(
                                        String(movie.id)
                                    )
                                );
                            })
                            .map((movie) => {
                                const safeMovie = {
                                    id:
                                        String(
                                            movie.id
                                        ),
                                    title:
                                        String(
                                            movie.title ||
                                            "İsimsiz Film"
                                        ).slice(0, 180),
                                    poster_path:
                                        /^\/[a-zA-Z0-9._-]+$/
                                            .test(
                                                String(
                                                    movie.poster_path ||
                                                    ""
                                                )
                                            )
                                                ? String(
                                                    movie.poster_path
                                                )
                                                : "",
                                    release_date:
                                        String(
                                            movie.release_date ||
                                            ""
                                        ).slice(0, 20),
                                    imdb_rating:
                                        Number(
                                            movie.imdb_rating
                                        ) || null,
                                    saved_at:
                                        String(
                                            movie.saved_at ||
                                            ""
                                        ).slice(0, 40)
                                };

                                return [
                                    safeMovie.id,
                                    safeMovie
                                ];
                            })
                    );
                };

            const ratings = {};

            Object.entries(
                payload.r &&
                typeof payload.r === "object"
                    ? payload.r
                    : {}
            )
                .slice(0, 300)
                .forEach(([movieId, rating]) => {
                    const numericRating =
                        Number(rating);

                    if (
                        numericRating >= 1 &&
                        numericRating <= 10
                    ) {
                        ratings[
                            String(movieId)
                        ] = numericRating;
                    }
                });

            if (payload.v === 2) {
                return {
                    ownerName:
                        String(
                            payload.n || ""
                        ).trim().slice(0, 80),
                    title:
                        String(
                            payload.t || "Film Listesi"
                        ).trim().slice(0, 80),
                    description:
                        String(
                            payload.d || ""
                        ).trim().slice(0, 180),
                    singleCollection: true,
                    library: {
                        favorites:
                            toCollection(payload.m),
                        watchlist: {},
                        watched: {},
                        ratings,
                        customLists: {}
                    }
                };
            }

            if (
                !payload.c ||
                typeof payload.c !== "object"
            ) {
                return null;
            }

            return {
                ownerName:
                    String(
                        payload.n || ""
                    ).trim().slice(0, 80),
                library: {
                    favorites:
                        toCollection(payload.c.f),
                    watchlist:
                        toCollection(payload.c.l),
                    watched:
                        toCollection(payload.c.w),
                    ratings,
                    customLists: {}
                }
            };
        } catch {
            return null;
        }
    }

    getCurrentAccountName() {
        try {
            const accountId =
                this.getActiveAccountId();

            const accounts =
                JSON.parse(
                    localStorage.getItem(
                        "seyirAtlasiAccounts"
                    ) || "[]"
                );

            return (
                accounts.find((account) => {
                    return account.id ===
                        accountId;
                })?.name ||
                "Bir sinemasever"
            );
        } catch {
            return "Bir sinemasever";
        }
    }

    getShareableList(listKey) {
        const builtInLists = {
            favorites: {
                title: "Favorilerim",
                description:
                    "En sevdiğim filmlerden oluşan seçkim.",
                movies:
                    this.userLibrary.favorites
            },
            watchlist: {
                title: "Daha Sonra İzle",
                description:
                    "İzlemeyi planladığım filmler.",
                movies:
                    this.userLibrary.watchlist
            },
            watched: {
                title: "İzlediklerim",
                description:
                    "İzlediğim filmlerden oluşan seyir geçmişim.",
                movies:
                    this.userLibrary.watched
            }
        };

        if (builtInLists[listKey]) {
            return builtInLists[listKey];
        }

        const customId =
            String(listKey || "")
                .replace(/^custom:/, "");

        const customList =
            this.userLibrary
                .customLists?.[customId];

        if (!customList) {
            return null;
        }

        return {
            title: customList.name,
            description:
                customList.description || "",
            movies: customList.movies || {}
        };
    }

    createSharedListURL(listKey) {
        const toArray =
            (collection) => {
                return Object.values(
                    collection || {}
                ).map((movie) => {
                    return {
                        id: String(movie.id),
                        title:
                            movie.title ||
                            "İsimsiz Film",
                        poster_path:
                            movie.poster_path ||
                            "",
                        release_date:
                            movie.release_date ||
                            "",
                        imdb_rating:
                            Number(
                                movie.imdb_rating
                            ) || null,
                        saved_at:
                            movie.saved_at ||
                            ""
                    };
                });
            };

        const selectedList =
            this.getShareableList(listKey);

        if (!selectedList) {
            return "";
        }

        const payload = {
            v: 2,
            n: this.getCurrentAccountName(),
            t: selectedList.title,
            d: selectedList.description,
            m: toArray(selectedList.movies),
            r: this.userLibrary.ratings || {}
        };

        const bytes =
            new TextEncoder().encode(
                JSON.stringify(payload)
            );

        let binary = "";

        bytes.forEach((byte) => {
            binary +=
                String.fromCharCode(byte);
        });

        const encoded =
            btoa(binary)
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/g, "");

        const url =
            new URL(
                "movie-list.html",
                window.location.href
            );

        url.search = "";
        url.hash = "";
        url.searchParams.set(
            "paylas",
            encoded
        );

        return url.href;
    }

    async shareUserLibrary(listKey) {
        if (
            !this.getActiveAccountId() ||
            this.isSharedView
        ) {
            return;
        }

        const selectedList =
            this.getShareableList(listKey);

        if (!selectedList) {
            return;
        }

        let shareURL;
        try {
            const response = await fetch(`${this.API_BASE_URL}/lists/share`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "movie",
                    title: selectedList.title,
                    description: selectedList.description,
                    items: Object.values(selectedList.movies || {}),
                    ratings: this.userLibrary.ratings || {}
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Liste paylaşılamadı.");
            shareURL = data.url;
        } catch (error) {
            window.showToast?.(error.message, "error");
            return;
        }

        const shareData = {
            title:
                `${selectedList.title} · SeyirAtlası`,
            text:
                `${this.getCurrentAccountName()} bu film listesini paylaştı:`,
            url: shareURL
        };

        try {
            if (
                navigator.share &&
                (
                    !navigator.canShare ||
                    navigator.canShare(shareData)
                )
            ) {
                await navigator.share(
                    shareData
                );
                return;
            }

            await navigator.clipboard.writeText(
                shareURL
            );

            window.showToast?.(
                "Paylaşım bağlantısı kopyalandı."
            );
        } catch (error) {
            if (error?.name === "AbortError") {
                return;
            }

            try {
                const input =
                    document.createElement(
                        "textarea"
                    );
                input.value = shareURL;
                input.style.position = "fixed";
                input.style.opacity = "0";
                document.body.appendChild(input);
                input.select();
                document.execCommand("copy");
                input.remove();

                window.showToast?.(
                    "Paylaşım bağlantısı kopyalandı."
                );
            } catch {
                window.showToast?.(
                    "Bağlantı kopyalanamadı.",
                    "error"
                );
            }
        }
    }

    saveSharedListToAccount() {
        const accountId =
            this.getActiveAccountId();

        if (
            !accountId ||
            !this.isSharedView
        ) {
            window.location.href =
                "profile.html";
            return;
        }

        const storageKey =
            `seyirAtlasiUserLibrary:${accountId}`;
        let ownLibrary;

        try {
            ownLibrary =
                JSON.parse(
                    localStorage.getItem(
                        storageKey
                    ) || "{}"
                );
        } catch {
            ownLibrary = {};
        }

        ownLibrary.favorites ||= {};
        ownLibrary.watchlist ||= {};
        ownLibrary.watched ||= {};
        ownLibrary.ratings ||= {};
        ownLibrary.customLists ||= {};

        const id =
            crypto.randomUUID?.() ||
            `liste-${Date.now()}`;

        ownLibrary.customLists[id] = {
            id,
            name:
                this.sharedList.title ||
                "Kaydedilen Liste",
            description:
                this.sharedList.description ||
                "",
            movies: {
                ...this.userLibrary.favorites
            },
            created_at:
                new Date().toISOString()
        };

        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify(ownLibrary)
            );
            window.showToast?.(
                "Liste, izleme listelerine kaydedildi."
            );
        } catch {
            window.showToast?.(
                "Liste kaydedilemedi.",
                "error"
            );
        }
    }

    loadUserLibrary() {
        const emptyLibrary = {
            favorites: {},
            watchlist: {},
            watched: {},
            ratings: {},
            customLists: {}
        };

        try {
            const storedLibrary =
                localStorage.getItem(
                    this.USER_LIBRARY_STORAGE_KEY
                );

            if (!storedLibrary) {
                return emptyLibrary;
            }

            const parsedLibrary =
                JSON.parse(storedLibrary);

            return {
                favorites:
                    parsedLibrary.favorites &&
                    typeof parsedLibrary.favorites ===
                        "object"
                        ? parsedLibrary.favorites
                        : {},
                watchlist:
                    parsedLibrary.watchlist &&
                    typeof parsedLibrary.watchlist ===
                        "object"
                        ? parsedLibrary.watchlist
                        : {},
                watched:
                    parsedLibrary.watched &&
                    typeof parsedLibrary.watched ===
                        "object"
                        ? parsedLibrary.watched
                        : {},
                ratings:
                    parsedLibrary.ratings &&
                    typeof parsedLibrary.ratings ===
                        "object"
                        ? parsedLibrary.ratings
                        : {},
                customLists:
                    parsedLibrary.customLists &&
                    typeof parsedLibrary.customLists ===
                        "object"
                        ? parsedLibrary.customLists
                        : {}
            };
        } catch (error) {
            console.warn(
                "Kullanıcı listeleri okunamadı:",
                error
            );

            return emptyLibrary;
        }
    }


    getUserLibraryStorageKey() {
        const accountId =
            this.getActiveAccountId();

        return accountId
            ? `seyirAtlasiUserLibrary:${accountId}`
            : "seyirAtlasiUserLibrary";
    }


    getActiveAccountId() {
        try {
            const session =
                JSON.parse(
                    localStorage.getItem(
                        "seyirAtlasiSession"
                    ) ||
                    sessionStorage.getItem(
                        "seyirAtlasiSession"
                    )
                );

            if (!session?.accountId) {
                return null;
            }

            const accounts =
                JSON.parse(
                    localStorage.getItem(
                        "seyirAtlasiAccounts"
                    ) || "[]"
                );

            const hasValidAccount =
                Array.isArray(accounts) &&
                accounts.some((account) => {
                    return account.id ===
                        session.accountId;
                });

            return hasValidAccount
                ? session.accountId
                : null;
        } catch {
            return null;
        }
    }


    saveUserLibrary() {
        try {
            localStorage.setItem(
                this.USER_LIBRARY_STORAGE_KEY,
                JSON.stringify(this.userLibrary)
            );

            this.queueLibrarySync();

            return true;
        } catch (error) {
            console.warn(
                "Kullanıcı listeleri kaydedilemedi:",
                error
            );

            this.showMovieActionFeedback(
                "Değişiklik kaydedilemedi."
            );

            return false;
        }
    }

    async syncLibraryFromServer() {
        if (!this.getActiveAccountId() || this.isSharedView) return;
        try {
            const response = await fetch(`${this.API_BASE_URL}/library?type=movie`, { credentials: "same-origin" });
            if (!response.ok) return;
            const data = await response.json();
            if (data.exists && data.library) {
                this.userLibrary = { favorites: {}, watchlist: {}, watched: {}, ratings: {}, customLists: {}, ...data.library };
                localStorage.setItem(this.USER_LIBRARY_STORAGE_KEY, JSON.stringify(this.userLibrary));
            } else {
                await this.persistLibraryToServer();
            }
        } catch (error) {
            console.warn("Film koleksiyonu eşitlenemedi:", error.message);
        }
    }

    queueLibrarySync() {
        if (!this.getActiveAccountId() || this.isSharedView) return;
        clearTimeout(this.librarySyncTimer);
        this.librarySyncTimer = setTimeout(() => this.persistLibraryToServer(), 350);
    }

    async persistLibraryToServer() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/library`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "movie", library: this.userLibrary }) });
            if (!response.ok) throw new Error((await response.json()).error || "Senkronizasyon başarısız.");
        } catch (error) {
            console.warn("Film koleksiyonu sunucuya kaydedilemedi:", error.message);
            window.showToast?.("Liste cihazda kaydedildi; sunucuyla daha sonra eşitlenecek.", "error");
        }
    }


    createStoredMovie(movie) {
        return {
            id: String(movie.id),
            title:
                movie.title ||
                movie.original_title ||
                "İsimsiz Film",
            poster_path:
                movie.poster_path || "",
            release_date:
                movie.release_date || "",
            vote_average:
                Number(movie.vote_average) || 0,
            imdb_rating:
                Number(
                    movie.imdb_rating ||
                    movie.omdb?.imdbRating
                ) || null,
            original_title:
                movie.title ||
                movie.original_title ||
                "İsimsiz Film",
            original_language: "tr",
            saved_at:
                new Date().toISOString()
        };
    }


    createUserActionsHTML(movie) {
        const movieId =
            String(movie.id);

        const hasActiveAccount =
            Boolean(
                this.getActiveAccountId()
            );

        const isFavorite =
            hasActiveAccount &&
            Boolean(
                this.userLibrary
                    .favorites[movieId]
            );

        const isInWatchlist =
            hasActiveAccount &&
            Boolean(
                this.userLibrary
                    .watchlist[movieId]
            );

        const isWatched =
            hasActiveAccount &&
            Boolean(
                this.userLibrary
                    .watched[movieId]
            );

        const userRating =
            hasActiveAccount
                ? (
                    Number(
                        this.userLibrary
                            .ratings[movieId]
                    ) || ""
                )
                : "";

        const ratingOptions =
            Array.from(
                { length: 10 },
                (_, index) => {
                    const rating =
                        index + 1;

                    return `
                        <option
                            value="${rating}"
                            ${
                                userRating === rating
                                    ? "selected"
                                    : ""
                            }
                        >
                            ${rating}
                        </option>
                    `;
                }
            ).join("");

        const watchlistChoices =
            [
                {
                    id: "default",
                    name: "Daha Sonra İzle",
                    active: isInWatchlist
                },
                ...Object.values(
                    this.userLibrary
                        .customLists || {}
                ).map((list) => {
                    return {
                        id: list.id,
                        name: list.name,
                        active: Boolean(
                            list.movies?.[movieId]
                        )
                    };
                })
            ];

        const watchlistChoiceHTML =
            watchlistChoices
                .map((list) => {
                    return `
                        <button
                            type="button"
                            class="${list.active ? "is-active" : ""}"
                            data-watchlist-choice="${this.escapeHTML(list.id)}"
                            data-movie-id="${movieId}"
                            aria-pressed="${list.active}"
                        >
                            <span aria-hidden="true">${list.active ? "✓" : "＋"}</span>
                            ${this.escapeHTML(list.name)}
                        </button>
                    `;
                })
                .join("");

        return `
            <div class="movie-user-actions">
                <button
                    type="button"
                    class="movie-user-action ${isFavorite ? "is-active" : ""}"
                    data-user-action="favorites"
                    data-movie-id="${movieId}"
                    aria-pressed="${isFavorite}"
                >
                    <span aria-hidden="true">♥</span>
                    <span data-action-label>
                        ${isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                    </span>
                </button>

                <button
                    type="button"
                    class="movie-user-action ${isWatched ? "is-active" : ""}"
                    data-user-action="watched"
                    data-movie-id="${movieId}"
                    aria-pressed="${isWatched}"
                >
                    <span aria-hidden="true">✓</span>
                    <span data-action-label>
                        ${isWatched ? "İzlendi İşaretini Kaldır" : "İzledim"}
                    </span>
                </button>

                <div class="movie-watchlist-picker">
                    <button
                        type="button"
                        class="movie-user-action"
                        data-watchlist-menu-toggle
                        aria-expanded="false"
                    >
                        <span aria-hidden="true">＋</span>
                        <span>İzleme Listeme Ekle</span>
                    </button>
                    <div class="movie-watchlist-menu" hidden>
                        ${watchlistChoiceHTML}
                        <button
                            type="button"
                            class="movie-watchlist-new"
                            data-new-watchlist-toggle
                        >
                            <span aria-hidden="true">＋</span>
                            Yeni liste oluştur
                        </button>
                        <form
                            class="movie-watchlist-new-form"
                            data-new-watchlist-form
                            data-movie-id="${movieId}"
                            hidden
                        >
                            <input
                                type="text"
                                name="name"
                                maxlength="48"
                                placeholder="Liste adı"
                                aria-label="Yeni liste adı"
                                required
                            >
                            <button type="submit">Oluştur</button>
                        </form>
                    </div>
                </div>

                <label class="movie-user-rating">
                    <span>Puanım</span>
                    <select
                        data-user-rating
                        data-movie-id="${movieId}"
                        aria-label="${this.escapeHTML(movie.title || "Film")} için kişisel puanınız"
                    >
                        <option value="">—</option>
                        ${ratingOptions}
                    </select>
                </label>

                <div
                    class="movie-action-feedback"
                    role="status"
                    aria-live="polite"
                ></div>
            </div>
        `;
    }


    toggleUserMovieAction(
        collectionName,
        movieId
    ) {
        if (!this.getActiveAccountId()) {
            this.showAuthenticationRequired();
            return;
        }

        if (
            !["favorites", "watchlist", "watched"]
                .includes(collectionName)
        ) {
            return;
        }

        const normalizedMovieId =
            String(movieId);

        const movie =
            this.movieDetailsCache.get(
                normalizedMovieId
            );

        if (!movie) {
            return;
        }

        const collection =
            this.userLibrary[
                collectionName
            ];

        const wasActive =
            Boolean(
                collection[
                    normalizedMovieId
                ]
            );

        if (wasActive) {
            delete collection[
                normalizedMovieId
            ];
        } else {
            collection[
                normalizedMovieId
            ] = this.createStoredMovie(movie);
        }

        if (!this.saveUserLibrary()) {
            if (wasActive) {
                collection[
                    normalizedMovieId
                ] = this.createStoredMovie(movie);
            } else {
                delete collection[
                    normalizedMovieId
                ];
            }

            return;
        }

        const buttons =
            document.querySelectorAll(
                `[data-user-action="${collectionName}"][data-movie-id="${normalizedMovieId}"], [data-quick-action="${collectionName}"][data-movie-id="${normalizedMovieId}"]`
            );

        const isActive =
            !wasActive;

        buttons.forEach((button) => {
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });

        const label =
            document.querySelector(
                `[data-user-action="${collectionName}"][data-movie-id="${normalizedMovieId}"] [data-action-label]`
            );

        if (label) {
            const labels = {
                favorites: isActive ? "Favorilerden Çıkar" : "Favorilere Ekle",
                watchlist: isActive ? "Listeden Çıkar" : "İzleme Listeme Ekle",
                watched: isActive ? "İzlendi İşaretini Kaldır" : "İzledim"
            };
            label.textContent = labels[collectionName];
        }

        const messages = {
            favorites: isActive ? "Film favorilerine eklendi." : "Film favorilerinden çıkarıldı.",
            watchlist: isActive ? "Film izleme listene eklendi." : "Film izleme listenden çıkarıldı.",
            watched: isActive ? "Film izlendi olarak işaretlendi." : "İzlendi işareti kaldırıldı."
        };
        this.showMovieActionFeedback(messages[collectionName]);

        this.renderUserLibrary();
    }


    setUserMovieRating(
        movieId,
        ratingValue
    ) {
        if (!this.getActiveAccountId()) {
            const ratingSelect =
                document.querySelector(
                    `[data-user-rating][data-movie-id="${movieId}"]`
                );

            if (ratingSelect) {
                ratingSelect.value = "";
            }

            this.showAuthenticationRequired();
            return;
        }

        const normalizedMovieId =
            String(movieId);

        const numericRating =
            Number(ratingValue);

        if (
            ratingValue === "" ||
            !Number.isInteger(
                numericRating
            ) ||
            numericRating < 1 ||
            numericRating > 10
        ) {
            delete this.userLibrary
                .ratings[normalizedMovieId];

            if (this.saveUserLibrary()) {
                this.showMovieActionFeedback(
                    "Kişisel puanın kaldırıldı."
                );

                this.renderUserLibrary();
            }

            return;
        }

        this.userLibrary
            .ratings[normalizedMovieId] =
                numericRating;

        if (this.saveUserLibrary()) {
            this.showMovieActionFeedback(
                `Puanın ${numericRating}/10 olarak kaydedildi.`
            );

            this.renderUserLibrary();
        }
    }


    showMovieActionFeedback(message) {
        if (
            typeof window.showToast ===
            "function"
        ) {
            window.showToast(message);
        }

        const feedback =
            document.querySelector(
                ".movie-action-feedback"
            );

        if (!feedback) {
            return;
        }

        feedback.textContent =
            message;

        clearTimeout(
            this.movieActionFeedbackTimer
        );

        this.movieActionFeedbackTimer =
            setTimeout(() => {
                feedback.textContent = "";
            }, 2800);
    }


    showAuthenticationRequired() {
        if (
            typeof window.showToast ===
            "function"
        ) {
            window.showToast(
                "Bu özellik için giriş yapmalısın.",
                "error"
            );
        }

        const feedback =
            document.querySelector(
                ".movie-action-feedback"
            );

        if (!feedback) {
            return;
        }

        feedback.innerHTML = `
            Liste ve puanlama özellikleri için
            <a href="profile.html">giriş yapmalısın.</a>
        `;

        clearTimeout(
            this.movieActionFeedbackTimer
        );
    }


    removeFromUserLibrary(
        collectionName,
        movieId
    ) {
        if (
            !["favorites", "watchlist", "watched"]
                .includes(collectionName) ||
            !this.getActiveAccountId()
        ) {
            return;
        }

        const normalizedMovieId =
            String(movieId);

        delete this.userLibrary[
            collectionName
        ][normalizedMovieId];

        if (this.saveUserLibrary()) {
            this.renderUserLibrary();

            if (
                typeof window.showToast ===
                "function"
            ) {
                const removeMessages = {
                    favorites: "Film favorilerinden çıkarıldı.",
                    watchlist: "Film izleme listesinden çıkarıldı.",
                    watched: "Film izlediklerinden çıkarıldı."
                };
                window.showToast(
                    removeMessages[collectionName]
                );
            }
        }
    }

    createCustomList(event) {
        event.preventDefault();

        if (!this.getActiveAccountId()) {
            return;
        }

        const formData =
            new FormData(event.currentTarget);
        const name =
            String(
                formData.get("name") || ""
            ).trim().slice(0, 48);
        const description =
            String(
                formData.get(
                    "description"
                ) || ""
            ).trim().slice(0, 140);

        if (!name) {
            return;
        }

        const id =
            crypto.randomUUID?.() ||
            `liste-${Date.now()}`;

        this.userLibrary.customLists ||= {};
        this.userLibrary.customLists[id] = {
            id,
            name,
            description,
            movies: {},
            created_at:
                new Date().toISOString()
        };

        if (this.saveUserLibrary()) {
            event.currentTarget.reset();
            event.currentTarget.hidden = true;
            this.renderCustomLists();
            window.showToast?.(
                "Yeni listen oluşturuldu."
            );
        }
    }

    createWatchlistFromPicker(event) {
        event.preventDefault();

        if (!this.getActiveAccountId()) {
            this.showAuthenticationRequired();
            return;
        }

        const form =
            event.currentTarget;
        const name =
            String(
                new FormData(form)
                    .get("name") || ""
            ).trim().slice(0, 48);
        const movieId =
            String(
                form.dataset.movieId
            );
        const movie =
            this.movieDetailsCache.get(
                movieId
            );

        if (!name || !movie) {
            return;
        }

        const id =
            crypto.randomUUID?.() ||
            `liste-${Date.now()}`;

        this.userLibrary.customLists ||= {};
        this.userLibrary.customLists[id] = {
            id,
            name,
            description: "",
            movies: {
                [movieId]:
                    this.createStoredMovie(movie)
            },
            created_at:
                new Date().toISOString()
        };

        if (!this.saveUserLibrary()) {
            return;
        }

        const menu =
            form.closest(
                ".movie-watchlist-menu"
            );
        const choice =
            document.createElement("button");
        choice.type = "button";
        choice.className = "is-active";
        choice.dataset.watchlistChoice = id;
        choice.dataset.movieId = movieId;
        choice.setAttribute(
            "aria-pressed",
            "true"
        );

        const icon =
            document.createElement("span");
        icon.setAttribute(
            "aria-hidden",
            "true"
        );
        icon.textContent = "✓";
        choice.append(
            icon,
            document.createTextNode(name)
        );
        menu.insertBefore(
            choice,
            form.previousElementSibling
        );

        form.reset();
        form.hidden = true;
        form.previousElementSibling.hidden =
            false;
        this.renderCustomLists();
        window.showToast?.(
            `“${name}” oluşturuldu ve film eklendi.`
        );
    }

    deleteCustomList(listId) {
        const list =
            this.userLibrary
                .customLists?.[listId];

        if (
            !list ||
            !window.confirm(
                `“${list.name}” listesini silmek istiyor musun?`
            )
        ) {
            return;
        }

        delete this.userLibrary
            .customLists[listId];

        if (this.saveUserLibrary()) {
            this.renderCustomLists();
            window.showToast?.(
                "Liste silindi."
            );
        }
    }

    addMovieToCustomList(listId, movieId) {
        if (!listId) {
            return;
        }

        const list =
            this.userLibrary
                .customLists?.[listId];
        const movie =
            this.movieDetailsCache.get(
                String(movieId)
            );

        if (!list || !movie) {
            return;
        }

        list.movies ||= {};
        list.movies[String(movieId)] =
            this.createStoredMovie(movie);

        if (this.saveUserLibrary()) {
            this.renderCustomLists();
            window.showToast?.(
                `Film “${list.name}” listesine eklendi.`
            );
        }
    }

    toggleMovieInWatchlist(
        listId,
        movieId,
        button
    ) {
        const normalizedMovieId =
            String(movieId);

        if (listId === "default") {
            this.toggleUserMovieAction(
                "watchlist",
                normalizedMovieId
            );
        } else {
            const list =
                this.userLibrary
                    .customLists?.[listId];

            if (!list) {
                return;
            }

            list.movies ||= {};

            if (list.movies[normalizedMovieId]) {
                delete list.movies[
                    normalizedMovieId
                ];
                this.saveUserLibrary();
                this.renderCustomLists();
            } else {
                this.addMovieToCustomList(
                    listId,
                    normalizedMovieId
                );
            }
        }

        const isActive =
            listId === "default"
                ? Boolean(
                    this.userLibrary
                        .watchlist[
                            normalizedMovieId
                        ]
                )
                : Boolean(
                    this.userLibrary
                        .customLists?.[listId]
                        ?.movies?.[
                            normalizedMovieId
                        ]
                );

        if (button) {
            button.classList.toggle(
                "is-active",
                isActive
            );
            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );

            const icon =
                button.querySelector("span");

            if (icon) {
                icon.textContent =
                    isActive ? "✓" : "＋";
            }
        }
    }

    removeMovieFromCustomList(
        listId,
        movieId
    ) {
        const list =
            this.userLibrary
                .customLists?.[listId];

        if (!list?.movies) {
            return;
        }

        delete list.movies[String(movieId)];

        if (this.saveUserLibrary()) {
            this.renderCustomLists();
            window.showToast?.(
                "Film listeden çıkarıldı."
            );
        }
    }

    renderCustomLists() {
        const container =
            document.getElementById(
                "customListsContainer"
            );

        if (!container || this.isSharedView) {
            return;
        }

        const lists =
            Object.values(
                this.userLibrary
                    .customLists || {}
            ).sort((first, second) => {
                return String(
                    second.created_at || ""
                ).localeCompare(
                    String(
                        first.created_at || ""
                    )
                );
            });

        if (!lists.length) {
            container.replaceChildren();
            return;
        }

        container.innerHTML =
            lists.map((list) => {
                const movies =
                    Object.values(
                        list.movies || {}
                    ).sort((first, second) => {
                        return String(
                            second.saved_at || ""
                        ).localeCompare(
                            String(
                                first.saved_at || ""
                            )
                        );
                    });

                const movieCards =
                    movies.length
                        ? movies.map((movie) => {
                            return this.createMovieCard(
                                movie,
                                Number(
                                    this.userLibrary
                                        .ratings[
                                            String(movie.id)
                                        ]
                                ) || null
                            ).replace(
                                "</article>",
                                `
                                    <button
                                        type="button"
                                        class="library-quick-remove"
                                        data-custom-list-remove
                                        data-custom-list-id="${this.escapeHTML(list.id)}"
                                        data-movie-id="${movie.id}"
                                        aria-label="Filmi bu listeden çıkar"
                                    >×</button>
                                </article>
                                `
                            );
                        }).join("")
                        : `<p class="library-empty">Bu liste henüz boş. Film detayından bu listeye film ekleyebilirsin.</p>`;

                return `
                    <article class="custom-list-card">
                        <header class="custom-list-header">
                            <div>
                                <span>${movies.length} film</span>
                                <h3>${this.escapeHTML(list.name)}</h3>
                                ${
                                    list.description
                                        ? `<p>${this.escapeHTML(list.description)}</p>`
                                        : ""
                                }
                            </div>
                            <div class="custom-list-actions">
                                <button type="button" data-share-list="custom:${this.escapeHTML(list.id)}">Paylaş</button>
                                <button type="button" data-delete-custom-list="${this.escapeHTML(list.id)}" aria-label="${this.escapeHTML(list.name)} listesini sil">Sil</button>
                            </div>
                        </header>
                        <div class="movies-grid library-grid">${movieCards}</div>
                    </article>
                `;
            }).join("");
    }


    renderUserLibrary() {
        const authWarning =
            document.getElementById(
                "libraryAuthWarning"
            );

        const libraryContent =
            document.getElementById(
                "libraryContent"
            );

        const sharedNote =
            document.getElementById(
                "sharedLibraryNote"
            );

        const hasActiveAccount =
            Boolean(
                this.getActiveAccountId()
            );

        if (authWarning) {
            authWarning.hidden =
                hasActiveAccount ||
                this.isSharedView;
        }

        if (libraryContent) {
            libraryContent.hidden =
                !hasActiveAccount &&
                !this.isSharedView;
        }

        if (sharedNote) {
            sharedNote.hidden =
                !this.isSharedView;
        }

        const saveSharedButton =
            document.getElementById(
                "saveSharedListBtn"
            );

        if (saveSharedButton) {
            saveSharedButton.hidden =
                !this.isSharedView ||
                !hasActiveAccount;
        }

        if (this.isSharedView) {
            const ownerName =
                this.sharedList.ownerName ||
                "Bir sinemasever";

            const kicker =
                document.getElementById(
                    "libraryKicker"
                );
            const title =
                document.getElementById(
                    "libraryPageTitle"
                );
            const description =
                document.getElementById(
                    "libraryPageDescription"
                );

            if (kicker) {
                kicker.textContent =
                    "Paylaşılan seçki";
            }

            if (title) {
                title.textContent =
                    `${ownerName} · ${this.sharedList.title || "Film Listesi"}`;
            }

            if (description) {
                description.textContent =
                    this.sharedList.description ||
                    "Paylaşılan kişisel film seçkisi.";
            }

            document
                .querySelectorAll(
                    "[data-share-list]"
                )
                .forEach((button) => {
                    button.hidden = true;
                });

            const customListsSection =
                document.getElementById(
                    "customListsSection"
                );

            if (customListsSection) {
                customListsSection.hidden = true;
            }

            if (
                this.sharedList
                    .singleCollection
            ) {
                document
                    .querySelectorAll(
                        "[data-library-group]"
                    )
                    .forEach((group) => {
                        group.hidden =
                            group.dataset
                                .libraryGroup !==
                            "favorites";
                    });

                const favoritesTitle =
                    document.getElementById(
                        "favoritesTitle"
                    );

                if (favoritesTitle) {
                    favoritesTitle.textContent =
                        this.sharedList.title ||
                        "Paylaşılan Liste";
                }
            }
        }

        if (
            !hasActiveAccount &&
            !this.isSharedView
        ) {
            return;
        }

        const collections = [
            {
                name: "favorites",
                containerId:
                    "favoritesGrid",
                emptyMessage:
                    "Henüz favorilerine film eklemedin."
            },
            {
                name: "watchlist",
                containerId:
                    "watchlistGrid",
                emptyMessage:
                    "İzleme listen henüz boş."
            },
            {
                name: "watched",
                containerId:
                    "watchedGrid",
                emptyMessage:
                    "Henüz izlendi olarak işaretlediğin bir film yok."
            }
        ];

        collections.forEach(
            ({
                name,
                containerId,
                emptyMessage
            }) => {
                const container =
                    document.getElementById(
                        containerId
                    );

                if (!container) {
                    return;
                }

                const movies =
                    Object.values(
                        this.userLibrary[name]
                    ).sort(
                        (firstMovie, secondMovie) => {
                            return (
                                new Date(
                                    secondMovie.saved_at
                                ) -
                                new Date(
                                    firstMovie.saved_at
                                )
                            );
                        }
                    );

                if (movies.length === 0) {
                    container.innerHTML = `
                        <p class="library-empty">
                            ${emptyMessage}
                        </p>
                    `;

                    return;
                }

                container.innerHTML =
                    movies
                        .map((movie) => {
                            return this.createMovieCard(
                                movie,
                                Number(
                                    this.userLibrary
                                        .ratings[
                                            String(movie.id)
                                        ]
                                ) || null,
                                this.isSharedView
                                    ? ""
                                    : name
                            );
                        })
                        .join("");
            }
        );

        const defaultWatchlistCount =
            document.getElementById(
                "defaultWatchlistCount"
            );

        if (defaultWatchlistCount) {
            const count =
                Object.keys(
                    this.userLibrary
                        .watchlist || {}
                ).length;
            defaultWatchlistCount.textContent =
                `${count} film`;
        }

        this.renderCustomLists();
    }


    /* =========================
       İZLEME PLATFORMLARI
    ========================== */

    createWatchProvidersHTML(providerData) {
        if (!providerData) {
            return `
                <div class="movie-trailer-unavailable">
                    Bu film için Türkiye'de izleme platformu
                    bilgisi bulunamadı.
                </div>
            `;
        }

        const providerGroups = [
            {
                title: "Abonelikle İzle",
                providers: providerData.flatrate
            },
            {
                title: "Kirala",
                providers: providerData.rent
            },
            {
                title: "Satın Al",
                providers: providerData.buy
            },
            {
                title: "Reklamlı İzle",
                providers: providerData.ads
            },
            {
                title: "Ücretsiz İzle",
                providers: providerData.free
            }
        ].filter((group) => {
            return (
                Array.isArray(group.providers) &&
                group.providers.length > 0
            );
        });

        if (providerGroups.length === 0) {
            return `
                <div class="movie-trailer-unavailable">
                    Bu film için Türkiye'de izleme platformu
                    bilgisi bulunamadı.
                </div>
            `;
        }

        const safeLink =
            this.getSafeExternalUrl(
                providerData.link
            );

        return `
            <div class="watch-providers">

                ${providerGroups
                    .map((group) => {
                        return `
                            <div class="watch-provider-group">

                                <h4 class="watch-provider-group-title">
                                    ${this.escapeHTML(group.title)}
                                </h4>

                                <div class="watch-provider-list">

                                    ${group.providers
                                        .map((provider) => {
                                            const providerName =
                                                provider.provider_name ||
                                                "Platform";

                                            const logoPath =
                                                provider.logo_path
                                                    ? `${this.PROVIDER_IMAGE_BASE_URL}${provider.logo_path}`
                                                    : this.FALLBACK_IMAGE;

                                            const providerUrl =
                                                this.getProviderDirectUrl(
                                                    providerName,
                                                    safeLink
                                                );

                                            return `
                                                <a
                                                    href="${providerUrl}"
                                                    class="watch-provider-item"
                                                    title="${this.escapeHTML(providerName)} platformuna git"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <img
                                                        src="${logoPath}"
                                                        alt="${this.escapeHTML(providerName)} logosu"
                                                        class="watch-provider-logo"
                                                        loading="lazy"
                                                        onerror="this.onerror=null; this.src='${this.FALLBACK_IMAGE}'"
                                                    >

                                                    <span class="watch-provider-name">
                                                        ${this.escapeHTML(providerName)}
                                                    </span>
                                                </a>
                                            `;
                                        })
                                        .join("")}

                                </div>

                            </div>
                        `;
                    })
                    .join("")}

                ${
                    safeLink
                        ? `
                            <a
                                href="${safeLink}"
                                class="watch-provider-link"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Tüm izleme seçeneklerini görüntüle
                            </a>
                        `
                        : ""
                }

            </div>
        `;
    }

    getProviderDirectUrl(providerName, fallbackUrl = "") {
        const normalized =
            String(providerName || "")
                .toLocaleLowerCase("tr-TR");

        const providerLinks = [
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

        const match =
            providerLinks.find(([key]) => {
                return normalized.includes(key);
            });

        return (
            match?.[1] ||
            fallbackUrl ||
            "https://www.themoviedb.org/"
        );
    }


    getSafeExternalUrl(urlValue) {
        if (!urlValue) {
            return "";
        }

        try {
            const url =
                new URL(urlValue);

            if (
                url.protocol !== "https:" &&
                url.protocol !== "http:"
            ) {
                return "";
            }

            return this.escapeHTML(
                url.toString()
            );
        } catch {
            return "";
        }
    }


    /* =========================
       MODAL YARDIMCILARI
    ========================== */

    getMovieDirector(credits) {
        const crew =
            Array.isArray(credits?.crew)
                ? credits.crew
                : [];

        const director =
            crew.find((person) => {
                return (
                    person.job ===
                    "Director"
                );
            });

        return (
            director?.name ||
            "Yönetmen bilgisi bulunmuyor"
        );
    }


    getMovieCast(credits) {
        const cast =
            Array.isArray(credits?.cast)
                ? credits.cast
                : [];

        return cast
            .filter((person) => {
                return person.name;
            })
            .slice(0, 6);
    }


    getSimilarMovies(movieData) {
        const similar =
            Array.isArray(movieData.similar?.results)
                ? movieData.similar.results
                : [];

        return similar
            .filter((movie) => {
                return movie.title || movie.original_title;
            })
            .slice(0, 8);
    }


    createCastHTML(cast) {
        if (
            !Array.isArray(cast) ||
            cast.length === 0
        ) {
            return `
                <div class="movie-trailer-unavailable">
                    Oyuncu bilgisi bulunmuyor.
                </div>
            `;
        }

        return `
            <div class="movie-cast-list">

                ${
                    cast
                        .map((person) => {
                            const character =
                                person.character ||
                                "Rol bilgisi yok";

                            const profilePath =
                                person.profile_path
                                    ? `${this.IMAGE_BASE_URL}${person.profile_path}`
                                    : this.FALLBACK_IMAGE;

                            return `
                                <div class="movie-cast-item">

                                    <img
                                        src="${profilePath}"
                                        alt="${this.escapeHTML(person.name)} profil fotoğrafı"
                                        class="movie-cast-image"
                                        loading="lazy"
                                        onerror="this.onerror=null; this.src='${this.FALLBACK_IMAGE}'"
                                    >

                                    <div class="movie-cast-name">
                                        ${this.escapeHTML(person.name)}
                                    </div>

                                    <div class="movie-cast-character">
                                        ${this.escapeHTML(character)}
                                    </div>

                                </div>
                            `;
                        })
                        .join("")
                }

            </div>
        `;
    }


    getMovieTrailer(videos) {
        const results =
            Array.isArray(
                videos?.results
            )
                ? videos.results
                : [];

        const youtubeVideos =
            results.filter((video) => {
                return (
                    video.site ===
                        "YouTube" &&
                    video.key
                );
            });

        return (
            youtubeVideos.find(
                (video) => {
                    return (
                        video.type ===
                            "Trailer" &&
                        video.official ===
                            true
                    );
                }
            ) ||
            youtubeVideos.find(
                (video) => {
                    return (
                        video.type ===
                        "Trailer"
                    );
                }
            ) ||
            youtubeVideos.find(
                (video) => {
                    return (
                        video.type ===
                        "Teaser"
                    );
                }
            ) ||
            null
        );
    }

    async fillMissingMovieDetails(
        movieId,
        localizedMovie
    ) {
        const needsFallback =
            !Number(localizedMovie?.runtime) ||
            !localizedMovie?.overview?.trim() ||
            !this.getMovieTrailer(
                localizedMovie?.videos
            );

        if (!needsFallback) {
            return localizedMovie;
        }

        try {
            const fallbackMovie =
                await this.fetchData(
                    `/movie/${movieId}`,
                    {
                        language: "en-US",
                        append_to_response: "videos"
                    }
                );

            const localizedVideos =
                localizedMovie?.videos?.results ||
                [];

            const fallbackVideos =
                fallbackMovie?.videos?.results ||
                [];

            const videos = [
                ...localizedVideos,
                ...fallbackVideos
            ].filter((video, index, all) => {
                return all.findIndex(
                    (item) =>
                        item.key === video.key
                ) === index;
            });

            return {
                ...localizedMovie,
                runtime:
                    localizedMovie.runtime ||
                    fallbackMovie.runtime,
                overview:
                    localizedMovie.overview?.trim()
                        ? localizedMovie.overview
                        : fallbackMovie.overview,
                tagline:
                    localizedMovie.tagline?.trim()
                        ? localizedMovie.tagline
                        : fallbackMovie.tagline,
                videos: {
                    ...localizedMovie.videos,
                    results: videos
                }
            };
        } catch (error) {
            console.warn(
                "Eksik film detayları tamamlanamadı:",
                error
            );

            return localizedMovie;
        }
    }

    parseOmdbRuntime(runtime) {
        const match =
            String(runtime || "").match(
                /(\d+)\s*min/i
            );

        return match
            ? Number(match[1])
            : null;
    }


    createTrailerHTML(
        trailer,
        movieTitle
    ) {
        if (!trailer) {
            const searchURL =
                `https://www.youtube.com/results?search_query=${encodeURIComponent(
                    `${movieTitle} official trailer`
                )}`;

            return `
                <div class="movie-trailer-unavailable">
                    <p>
                        Kayıtlı bir fragman bulunamadı.
                    </p>
                    <a
                        href="${searchURL}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        YouTube'da fragmanı ara ↗
                    </a>
                </div>
            `;
        }

        return `
            <div class="movie-trailer-wrapper">

                <iframe
                    src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                        trailer.key
                    )}"
                    title="${this.escapeHTML(movieTitle)} fragmanı"
                    loading="lazy"
                    allow="
                        accelerometer;
                        autoplay;
                        clipboard-write;
                        encrypted-media;
                        gyroscope;
                        picture-in-picture;
                        web-share
                    "
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen>
                </iframe>

            </div>
        `;
    }


    createSimilarMoviesHTML(similarMovies) {
        if (
            !Array.isArray(similarMovies) ||
            similarMovies.length === 0
        ) {
            return `
                <div class="movie-trailer-unavailable">
                    Benzer film bulunmuyor.
                </div>
            `;
        }

        return `
            <div class="similar-movies-grid">

                ${
                    similarMovies
                        .map((movie) => {
                            const title =
                                movie.title ||
                                movie.original_title ||
                                "İsimsiz Film";

                            const safeTitle =
                                this.escapeHTML(
                                    title
                                );

                            const posterPath =
                                movie.poster_path
                                    ? `${this.IMAGE_BASE_URL}${movie.poster_path}`
                                    : this.FALLBACK_IMAGE;

                            const rating =
                                Number(
                                    movie.imdb_rating
                                ) > 0
                                    ? Number(
                                        movie.imdb_rating
                                    ).toFixed(1)
                                    : "—";

                            return `
                                <article
                                    class="similar-movie-card"
                                    data-movie-id="${movie.id}"
                                    data-similar-movie="true"
                                    tabindex="0"
                                    role="button"
                                    aria-label="${safeTitle}"
                                >
                                    <img
                                        src="${posterPath}"
                                        alt="${safeTitle} film afişi"
                                        class="similar-movie-poster"
                                        loading="lazy"
                                        onerror="this.onerror=null; this.src='${this.FALLBACK_IMAGE}'"
                                    >

                                    <div class="similar-movie-info">
                                        <div class="similar-movie-title">
                                            ${safeTitle}
                                        </div>

                                        <div class="similar-movie-rating">
                                            IMDb ${rating}
                                        </div>
                                    </div>
                                </article>
                            `;
                        })
                        .join("")
                }

            </div>
        `;
    }


    createOmdbFactsHTML(omdbData) {
        if (!omdbData) {
            return "";
        }

        const facts = [];

        /*
         * Yaş Sınırı (Rated)
         */
        if (omdbData.Rated && 
            omdbData.Rated !== "N/A") {
            facts.push(`
                <div class="movie-modal-fact">
                    <span class="movie-modal-fact-label">
                        Yaş Sınırı
                    </span>
                    <span class="movie-modal-fact-value">
                        ${this.escapeHTML(omdbData.Rated)}
                    </span>
                </div>
            `);
        }

        return facts.join("");
    }


    createAwardsFactHTML(omdbData) {
        if (
            !omdbData?.Awards ||
            omdbData.Awards === "N/A"
        ) {
            return `
                <div class="movie-modal-fact movie-modal-fact-highlight">
                    <span class="movie-modal-fact-label">
                        Ödüller
                    </span>
                    <span class="movie-modal-fact-value">
                        Bu yapım için ödül bilgisi bulunmuyor.
                    </span>
                </div>
            `;
        }

        /*
         * Ödül metnini parse et
         * Örnek: "7 wins & 11 nominations total"
         * veya "Won 3 Oscars. 27 Nominations."
         */
        const awardText =
            this.formatAwards(
                omdbData.Awards
            );

        return `
            <div class="movie-modal-fact movie-modal-fact-highlight">
                <span class="movie-modal-fact-label">
                    Ödüller
                </span>
                <span class="movie-modal-fact-value">
                    ${this.escapeHTML(awardText)}
                </span>
            </div>
        `;
    }


    formatAwards(awards) {
        const awardText =
            String(awards);

        const getCount = (pattern) => {
            const match =
                awardText.match(pattern);

            return match
                ? Number(match[1])
                : 0;
        };

        const oscarWins =
            getCount(
                /won\s+(\d+)\s+oscars?/i
            );

        const oscarNominations =
            getCount(
                /nominated\s+for\s+(\d+)\s+oscars?/i
            );

        const totalWins =
            getCount(
                /(\d+)\s+wins?/i
            );

        const totalNominations =
            getCount(
                /(\d+)\s+nominations?/i
            );

        const parts = [];

        if (oscarWins) {
            parts.push(
                `${oscarWins} Oscar ödülü`
            );
        } else if (oscarNominations) {
            parts.push(
                `${oscarNominations} Oscar adaylığı`
            );
        }

        if (totalWins && !oscarWins) {
            parts.push(
                `${totalWins} ödül`
            );
        }

        if (
            totalNominations &&
            !oscarNominations
        ) {
            parts.push(
                `${totalNominations} adaylık`
            );
        }

        if (parts.length) {
            return `${parts.join(", ")}!`;
        }

        return awardText
            .replace(
                /\s*&\s*/g,
                ", "
            )
            .replace(
                /\bwins?\b/gi,
                "ödül"
            )
            .replace(
                /\bnominations?\b/gi,
                "adaylık"
            )
            .replace(
                /\btotal\b/gi,
                ""
            )
            .replace(
                /[.!?,\s]+$/,
                ""
            )
            + "!";
    }


    appendPusulaMessage(role, text, loading = false) {
        const chat = document.getElementById("pusulaChat");
        if (!chat) return null;

        const item = document.createElement("div");
        item.className = `pusula-message pusula-message-${role}${loading ? " is-loading" : ""}`;
        item.innerHTML = role === "ai"
            ? `<span class="pusula-avatar" aria-hidden="true">✦</span><div><strong>Pusula</strong><p></p></div>`
            : `<div><p></p></div>`;
        item.querySelector("p").textContent = text;
        chat.appendChild(item);
        chat.scrollTop = chat.scrollHeight;
        return item;
    }

    resetPusula() {
        this.pusulaRequestController?.abort();
        this.pusulaRequestController = null;
        this.pusulaLastTitles = [];

        const form = document.getElementById("recommendForm");
        form?.reset();
        form?.querySelector("button[type='submit']")?.removeAttribute("disabled");

        document.querySelectorAll(
            "[data-pusula-group] .is-selected"
        ).forEach((button) => button.classList.remove("is-selected"));
        this.updatePusulaDurationOptions("film");

        const chat = document.getElementById("pusulaChat");
        if (chat) {
            chat.innerHTML = `
                <div class="pusula-message pusula-message-ai">
                    <span class="pusula-avatar" aria-hidden="true">✦</span>
                    <div>
                        <strong>Pusula</strong>
                        <p>Bazen tek bir his yönünü bulmaya yeter. İstersen sana en uygun seçenekleri seç, istersen aklındakileri kendi cümlelerinle dök.</p>
                    </div>
                </div>
            `;
        }
    }

    getPusulaPreferences() {
        const preferences = {};
        document.querySelectorAll("[data-pusula-group]").forEach((group) => {
            const selected = [...group.querySelectorAll(".is-selected[data-pusula-value]")];
            if (selected.length) {
                preferences[group.dataset.pusulaGroup] = selected
                    .map((item) => item.dataset.pusulaValue)
                    .join(" ve ");
            }
        });
        return preferences;
    }

    updatePusulaDurationOptions(type) {
        const container = document.querySelector("[data-pusula-duration-options]");
        if (!container) return;
        const options = type === "dizi"
            ? [
                ["tek bölüm, 30 dakikaya kadar", "Çıtır çerez"],
                ["tek bölüm, yaklaşık 1 saat", "Tam kıvamında"],
                ["birkaç bölüm art arda izlenecek uzun bir hikâye", "Uzun soluklu"]
            ]
            : type === "fark etmez"
                ? [
                    ["90 dakikaya kadar", "Çıtır çerez"],
                    ["1-2 saat", "Tam kıvamında"],
                    ["uzun, sürükleyici bir yapım", "Uzun soluklu"]
                ]
                : [
                    ["90 dakikadan kısa", "Çıtır çerez"],
                    ["yaklaşık 2 saat", "Tam kıvamında"],
                    ["uzun, sürükleyici bir film", "Uzun soluklu"]
                ];
        const buttons = container.querySelectorAll("[data-pusula-value]");
        options.forEach(([value, label], index) => {
            const button = buttons[index];
            if (!button) return;
            button.dataset.pusulaValue = value;
            button.textContent = label;
        });
    }

    describePusulaRequest(message, preferences) {
        if (message) return message;
        return [...document.querySelectorAll(
            "[data-pusula-group] .is-selected[data-pusula-value]"
        )]
            .map((button) => button.textContent.trim())
            .join(" · ");
    }

    async findPusulaMovies(recommendations = []) {
        const matches = await Promise.all(
            recommendations.slice(0, 3).map(async (recommendation) => {
                const mediaType = recommendation.type === "dizi" ? "tv" : "movie";
                const data = await this.fetchData(`/search/${mediaType}`, {
                    query: recommendation.title,
                    [mediaType === "tv" ? "first_air_date_year" : "year"]:
                        recommendation.year || undefined,
                    include_adult: false,
                    page: 1
                });
                const movie = (data.results || [])[0];
                return movie ? { movie, reason: recommendation.reason, mediaType } : null;
            })
        );

        return matches.filter(Boolean);
    }

    bindPusulaCards(container) {
        container.querySelectorAll("[data-movie-id]").forEach((card) => {
            card.addEventListener("click", (event) => {
                const quickAction = event.target.closest("[data-quick-action]");
                if (quickAction) {
                    event.stopPropagation();
                    this.toggleUserMovieAction(
                        quickAction.dataset.quickAction,
                        quickAction.dataset.movieId
                    );
                    return;
                }
                const recommendModal = document.getElementById("recommendModal");
                if (card.dataset.mediaType === "tv") {
                    window.location.href = "series.html#seriesArchive";
                    return;
                }
                recommendModal.hidden = true;
                recommendModal.setAttribute("aria-hidden", "true");
                document.body.classList.remove("modal-open");
                this.resetPusula();
                this.openMovieModal(card.dataset.movieId, card);
            });
        });
    }

    createPusulaResultCard(movie, reason, mediaType) {
        if (mediaType === "movie") {
            return `<div class="pusula-result">${this.createMovieCard(movie)}<p>${this.escapeHTML(reason)}</p></div>`;
        }

        const title = movie.name || movie.original_name || "İsimsiz dizi";
        const year = String(movie.first_air_date || "").slice(0, 4) || "—";
        const poster = movie.poster_path
            ? `${this.IMAGE_BASE_URL}${movie.poster_path}`
            : this.FALLBACK_IMAGE;
        return `
            <div class="pusula-result">
                <article class="movie-card pusula-series-card" data-movie-id="${movie.id}" data-media-type="tv" tabindex="0">
                    <img class="movie-poster" src="${poster}" alt="${this.escapeHTML(title)} afişi">
                    <div class="movie-info">
                        <h3 class="movie-title">${this.escapeHTML(title)}</h3>
                        <div class="movie-meta"><span>${year}</span><span>★ ${Number(movie.vote_average || 0).toFixed(1)}</span></div>
                        <small>Dizi arşivinde incele →</small>
                    </div>
                </article>
                <p>${this.escapeHTML(reason)}</p>
            </div>
        `;
    }

    appendPusulaActions(chat, preferences) {
        const actions = document.createElement("div");
        actions.className = "pusula-result-actions";
        actions.innerHTML = `
            <div class="pusula-route-again">
                <span>Bu rota içine sinmedi mi?</span>
                <div class="pusula-route-buttons">
                    <button type="button" data-pusula-followup="Önceki önerileri tekrarlamadan tamamen farklı üç yapım öner.">Başka öneriler getir</button>
                    <button type="button" data-pusula-new-route>Yeni rota oluştur</button>
                </div>
            </div>
        `;
        chat.appendChild(actions);

        actions.querySelectorAll("[data-pusula-followup]").forEach((button) => {
            button.addEventListener("click", () => {
                const excluded = this.pusulaLastTitles.length
                    ? ` Şunları tekrar önerme: ${this.pusulaLastTitles.join(", ")}.`
                    : "";
                this.createRecommendations(
                    `${button.dataset.pusulaFollowup}${excluded}`,
                    preferences
                );
            });
        });
        actions.querySelector("[data-pusula-new-route]")?.addEventListener("click", () => {
            this.resetPusula();
            document.querySelector("[data-pusula-group='type'] button")?.focus();
        });
    }

    async createRecommendations(message, preferences = {}) {
        const chat = document.getElementById("pusulaChat");
        const form = document.getElementById("recommendForm");
        if (!chat || !form) return;

        const selectedSummary = this.describePusulaRequest("", preferences);
        const requestMessage = message ||
            (selectedSummary
                ? `Seçimlerime göre bir rota çiz: ${selectedSummary}.`
                : "Bana film ve diziler arasından sürpriz bir rota çiz.");

        chat.innerHTML = "";
        const loading = this.appendPusulaMessage("ai", "Rotanı düşünüyorum…", true);
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
                throw new Error(
                    "Pusula sunucusundan geçerli bir yanıt alınamadı. Sayfayı yenileyip tekrar dene."
                );
            }
            if (!responseText) {
                throw new Error(
                    "Pusula sunucusu boş yanıt verdi. Sunucuyu yeniden başlatıp tekrar dene."
                );
            }
            if (!response.ok) throw new Error(data.error || "Pusula yanıt veremedi.");

            loading?.remove();
            this.appendPusulaMessage("ai", data.reply);
            this.pusulaLastTitles = (data.recommendations || [])
                .map((item) => item.title)
                .filter(Boolean);

            const matches = await this.findPusulaMovies(data.recommendations);
            if (matches.length) {
                const results = document.createElement("div");
                results.className = "pusula-results recommend-grid";
                results.innerHTML = matches
                    .map(({ movie, reason, mediaType }) =>
                        this.createPusulaResultCard(movie, reason, mediaType)
                    )
                    .join("");
                chat.appendChild(results);
                this.bindPusulaCards(results);
            }
            this.appendPusulaActions(chat, preferences);
            chat.scrollTop = 0;
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error("Pusula yanıtı alınamadı:", error);
            loading?.remove();
            this.appendPusulaMessage(
                "ai",
                error.message || "Şu an bağlantı kuramadım. Biraz sonra tekrar deneyelim."
            );
        } finally {
            submit.disabled = false;
            document.getElementById("pusulaInput")?.focus();
        }
    }


    formatRuntime(runtime) {
        const totalMinutes =
            Number(runtime);

        if (
            !Number.isFinite(
                totalMinutes
            ) ||
            totalMinutes <= 0
        ) {
            return "Süre bilgisi yok";
        }

        const hours =
            Math.floor(
                totalMinutes / 60
            );

        const minutes =
            totalMinutes % 60;

        if (hours === 0) {
            return `${minutes} dk`;
        }

        if (minutes === 0) {
            return `${hours} sa`;
        }

        return `${hours} sa ${minutes} dk`;
    }


    formatDate(dateValue) {
        const date =
            new Date(dateValue);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "Tarih bilgisi yok";
        }

        return new Intl.DateTimeFormat(
            "tr-TR",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        ).format(date);
    }


    getProductionCountries(movie) {
        const countries =
            Array.isArray(
                movie.production_countries
            )
                ? movie.production_countries
                : [];

        const countryNames =
            countries
                .map((country) => {
                    if (!country.iso_3166_1) {
                        return country.name;
                    }

                    const countryTranslations = {
                        US: "Amerika Birleşik Devletleri",
                        GB: "Birleşik Krallık",
                        TR: "Türkiye",
                        FR: "Fransa",
                        DE: "Almanya",
                        IT: "İtalya",
                        ES: "İspanya",
                        JP: "Japonya",
                        KR: "Güney Kore",
                        CN: "Çin",
                        CA: "Kanada",
                        AU: "Avustralya",
                        IN: "Hindistan",
                        RU: "Rusya",
                        MX: "Meksika",
                        BR: "Brezilya",
                        AR: "Arjantin",
                        SE: "İsveç",
                        NO: "Norveç",
                        DK: "Danimarka",
                        FI: "Finlandiya",
                        NL: "Hollanda",
                        BE: "Belçika",
                        IE: "İrlanda",
                        NZ: "Yeni Zelanda",
                        AT: "Avusturya",
                        CH: "İsviçre",
                        PL: "Polonya",
                        GR: "Yunanistan",
                        ZA: "Güney Afrika",
                        HK: "Hong Kong",
                        TW: "Tayvan"
                    };

                    if (
                        countryTranslations[
                            country.iso_3166_1
                        ]
                    ) {
                        return countryTranslations[
                            country.iso_3166_1
                        ];
                    }

                    try {
                        const displayNames =
                            new Intl.DisplayNames(
                                ["tr"],
                                {
                                    type: "region"
                                }
                            );

                        return (
                            displayNames.of(
                                country.iso_3166_1
                            ) ||
                            country.name
                        );
                    } catch {
                        return country.name;
                    }
                })
                .filter(Boolean);

        return countryNames.length
            ? countryNames.join(", ")
            : "Ülke bilgisi bulunmuyor";
    }


    getMovieStatus(status) {
        const statusTranslations = {
            Rumored: "Söylenti",
            Planned: "Planlandı",
            "In Production": "Yapım Aşamasında",
            "Post Production": "Yapım Sonrası",
            Released: "Yayımlandı",
            Canceled: "İptal Edildi"
        };

        return statusTranslations[status] ||
            status ||
            "Bilinmiyor";
    }


    getLanguageName(languageCode) {
        if (!languageCode) {
            return "Dil bilgisi bulunmuyor";
        }

        try {
            const displayNames =
                new Intl.DisplayNames(
                    ["tr"],
                    {
                        type: "language"
                    }
                );

            return (
                displayNames.of(
                    languageCode
                ) ||
                languageCode.toUpperCase()
            );
        } catch {
            return languageCode.toUpperCase();
        }
    }


    /* =========================
       GENEL YARDIMCILAR
    ========================== */

    hasActiveFilters() {
        return Boolean(
            this.currentFilters.genre ||
            this.currentFilters.year ||
            this.currentFilters.sort
        );
    }


    updateClearButton() {
        const clearBtn =
            document.getElementById(
                "clearBtn"
            );

        const searchInput =
            document.getElementById(
                "searchInput"
            );

        if (!clearBtn) {
            return;
        }

        const hasSearchQuery =
            Boolean(
                searchInput?.value.trim()
            );

        const shouldShow =
            hasSearchQuery ||
            this.hasActiveFilters();

        clearBtn.classList.toggle(
            "show",
            shouldShow
        );
    }


    setTrendingVisibility(
        isVisible
    ) {
        const trendingSection =
            document.getElementById(
                "trendingSection"
            );

        if (!trendingSection) {
            return;
        }

        trendingSection.style.display =
            isVisible
                ? "block"
                : "none";
    }


    getGenreNames(genreIds) {
        if (
            !Array.isArray(genreIds) ||
            genreIds.length === 0
        ) {
            return "Tür bilgisi bulunmuyor";
        }

        const genreNames =
            genreIds
                .slice(0, 2)
                .map((genreId) => {
                    return this.genres[
                        genreId
                    ];
                })
                .filter(Boolean);

        return genreNames.length
            ? genreNames.join(", ")
            : "Tür bilgisi bulunmuyor";
    }


    getReleaseYear(releaseDate) {
        if (!releaseDate) {
            return "Yıl bilgisi yok";
        }

        const year =
            new Date(
                releaseDate
            ).getFullYear();

        return Number.isNaN(year)
            ? "Yıl bilgisi yok"
            : year;
    }


    formatRating(rating) {
        const numericRating =
            Number(rating);

        if (
            !Number.isFinite(
                numericRating
            ) ||
            numericRating <= 0
        ) {
            return "—";
        }

        return numericRating.toFixed(1);
    }


    escapeHTML(value) {
        return String(value)
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    createFallbackImage() {
        const fallbackSvg = `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="500"
                height="750"
                viewBox="0 0 500 750"
            >
                <defs>
                    <linearGradient
                        id="background"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stop-color="#0B1026"
                        />

                        <stop
                            offset="100%"
                            stop-color="#243B6B"
                        />
                    </linearGradient>
                </defs>

                <rect
                    width="500"
                    height="750"
                    fill="url(#background)"
                />

                <circle
                    cx="90"
                    cy="120"
                    r="3"
                    fill="#E5E7EB"
                    opacity=".8"
                />

                <circle
                    cx="390"
                    cy="180"
                    r="2"
                    fill="#8FAFFF"
                    opacity=".8"
                />

                <circle
                    cx="320"
                    cy="90"
                    r="2"
                    fill="#C7D2FE"
                    opacity=".7"
                />

                <text
                    x="250"
                    y="350"
                    text-anchor="middle"
                    fill="#E5E7EB"
                    font-family="Arial, sans-serif"
                    font-size="34"
                    font-weight="bold"
                >
                    SeyirAtlası
                </text>

                <text
                    x="250"
                    y="400"
                    text-anchor="middle"
                    fill="#C7D2FE"
                    font-family="Arial, sans-serif"
                    font-size="21"
                >
                    Afiş bulunamadı
                </text>
            </svg>
        `;

        return (
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(
                fallbackSvg
            )
        );
    }
}


/* =========================
   DOM YÜKLENDİĞİNDE BAŞLAT
========================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        new MovieExplorer();
    }
);
