class LocalAccountManager {
    constructor() {
        this.ACCOUNTS_KEY = "seyirAtlasiAccounts";
        this.SESSION_KEY = "seyirAtlasiSession";
        this.LIBRARY_KEY = "seyirAtlasiUserLibrary";
        this.THEME_KEY = "seyirAtlasiTheme";

        this.accounts = this.readStorage(
            this.ACCOUNTS_KEY,
            []
        );

        this.session =
            this.readSession();

        this.setupTheme();
        this.setupEvents();
        this.render();
    }

    readStorage(key, fallbackValue) {
        try {
            const storedValue =
                localStorage.getItem(key);

            return storedValue
                ? JSON.parse(storedValue)
                : fallbackValue;
        } catch {
            return fallbackValue;
        }
    }

    writeStorage(key, value) {
        try {
            localStorage.setItem(
                key,
                JSON.stringify(value)
            );

            return true;
        } catch {
            this.showFeedback(
                "Bilgiler tarayıcıya kaydedilemedi.",
                true
            );

            return false;
        }
    }

    readSession() {
        try {
            const storedSession =
                localStorage.getItem(
                    this.SESSION_KEY
                ) ||
                sessionStorage.getItem(
                    this.SESSION_KEY
                );

            return storedSession
                ? JSON.parse(storedSession)
                : null;
        } catch {
            return null;
        }
    }

    setupTheme() {
        const savedTheme =
            localStorage.getItem(
                this.THEME_KEY
            ) || "dark";

        this.applyTheme(savedTheme);

        document
            .getElementById("themeToggle")
            ?.addEventListener(
                "click",
                () => {
                    const nextTheme =
                        document.documentElement
                            .dataset.theme ===
                        "light"
                            ? "dark"
                            : "light";

                    localStorage.setItem(
                        this.THEME_KEY,
                        nextTheme
                    );

                    this.applyTheme(nextTheme);
                }
            );
    }

    applyTheme(theme) {
        document.documentElement.dataset.theme =
            theme;

        const toggle =
            document.getElementById(
                "themeToggle"
            );

        if (!toggle) {
            return;
        }

        const isLight =
            theme === "light";

        toggle.innerHTML = isLight
            ? `<svg class="theme-icon theme-icon-moon" aria-hidden="true" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>`
            : `<svg class="theme-icon theme-icon-sun" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

        toggle.setAttribute(
            "aria-label",
            isLight
                ? "Karanlık temaya geç"
                : "Açık temaya geç"
        );
    }

    setupEvents() {
        document
            .querySelectorAll(
                "[data-auth-tab]"
            )
            .forEach((tab) => {
                tab.addEventListener(
                    "click",
                    () => {
                        this.switchTab(
                            tab.dataset.authTab
                        );
                    }
                );
            });

        document
            .getElementById("loginForm")
            ?.addEventListener(
                "submit",
                (event) => {
                    this.handleLogin(event);
                }
            );

        document
            .getElementById("registerForm")
            ?.addEventListener(
                "submit",
                (event) => {
                    this.handleRegister(event);
                }
            );

        document
            .getElementById("logoutBtn")
            ?.addEventListener(
                "click",
                () => {
                    this.logout();
                }
            );

        document
            .getElementById(
                "registerPassword"
            )
            ?.addEventListener(
                "input",
                (event) => {
                    this.updatePasswordSecurity(
                        event.target.value
                    );
                    this.validatePasswordConfirmation();
                }
            );

        document
            .getElementById(
                "registerPasswordConfirm"
            )
            ?.addEventListener(
                "input",
                () => {
                    this.validatePasswordConfirmation();
                }
            );

        document
            .querySelectorAll(
                "[data-password-toggle]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        this.togglePasswordVisibility(
                            button
                        );
                    }
                );
            });

        document
            .getElementById(
                "profileEditToggle"
            )
            ?.addEventListener(
                "click",
                () => {
                    this.toggleProfileEdit(
                        true
                    );
                }
            );

        document
            .getElementById(
                "profileEditCancel"
            )
            ?.addEventListener(
                "click",
                () => {
                    this.toggleProfileEdit(
                        false
                    );
                }
            );

        document
            .getElementById(
                "profileEditForm"
            )
            ?.addEventListener(
                "submit",
                (event) => {
                    this.handleProfileUpdate(
                        event
                    );
                }
            );
    }

    switchTab(tabName) {
        const isLogin =
            tabName === "login";

        document.getElementById(
            "loginForm"
        ).hidden = !isLogin;

        document.getElementById(
            "registerForm"
        ).hidden = isLogin;

        document
            .querySelectorAll(
                "[data-auth-tab]"
            )
            .forEach((tab) => {
                const isActive =
                    tab.dataset.authTab ===
                    tabName;

                tab.classList.toggle(
                    "is-active",
                    isActive
                );

                tab.setAttribute(
                    "aria-selected",
                    String(isActive)
                );
            });

        this.showFeedback("");
    }

    normalizeEmail(email) {
        return String(email)
            .trim()
            .toLocaleLowerCase("tr-TR");
    }

    createSalt() {
        const bytes =
            crypto.getRandomValues(
                new Uint8Array(16)
            );

        return Array.from(bytes)
            .map((byte) => {
                return byte
                    .toString(16)
                    .padStart(2, "0");
            })
            .join("");
    }

    async hashPassword(password, salt) {
        const data =
            new TextEncoder().encode(
                `${salt}:${password}`
            );

        const digest =
            await crypto.subtle.digest(
                "SHA-256",
                data
            );

        return Array.from(
            new Uint8Array(digest)
        )
            .map((byte) => {
                return byte
                    .toString(16)
                    .padStart(2, "0");
            })
            .join("");
    }

    getPasswordRules(password) {
        return {
            length:
                password.length >= 8,
            uppercase:
                /[A-ZÇĞİÖŞÜ]/.test(
                    password
                ),
            lowercase:
                /[a-zçğıöşü]/.test(
                    password
                ),
            number:
                /\d/.test(password)
        };
    }

    togglePasswordVisibility(button) {
        const input =
            button
                .closest(
                    ".password-input-wrap"
                )
                ?.querySelector("input");

        if (!input) {
            return;
        }

        const shouldShow =
            input.type === "password";

        input.type =
            shouldShow
                ? "text"
                : "password";

        button.classList.toggle(
            "is-visible",
            shouldShow
        );

        button.setAttribute(
            "aria-label",
            shouldShow
                ? "Şifreyi gizle"
                : "Şifreyi göster"
        );
    }

    updatePasswordSecurity(password) {
        const rules =
            this.getPasswordRules(
                password
            );

        const completedCount =
            Object.values(rules)
                .filter(Boolean)
                .length;

        Object.entries(rules).forEach(
            ([ruleName, isComplete]) => {
                document
                    .querySelector(
                        `[data-password-rule="${ruleName}"]`
                    )
                    ?.classList.toggle(
                        "is-complete",
                        isComplete
                    );
            }
        );

        const strengthBar =
            document.getElementById(
                "strengthBar"
            );

        if (strengthBar) {
            strengthBar.style.width =
                `${completedCount * 25}%`;

            strengthBar.dataset.level =
                String(completedCount);
        }
    }

    validatePasswordConfirmation() {
        const password =
            document.getElementById(
                "registerPassword"
            )?.value || "";

        const confirmation =
            document.getElementById(
                "registerPasswordConfirm"
            );

        if (!confirmation) {
            return true;
        }

        const passwordsMatch =
            !confirmation.value ||
            confirmation.value === password;

        confirmation.setCustomValidity(
            passwordsMatch
                ? ""
                : "Şifreler eşleşmiyor."
        );

        return passwordsMatch &&
            confirmation.value === password;
    }

    async handleRegister(event) {
        event.preventDefault();

        const formData =
            new FormData(event.currentTarget);

        const name =
            String(formData.get("name"))
                .trim();

        const email =
            this.normalizeEmail(
                formData.get("email")
            );

        const password =
            String(
                formData.get("password")
            );

        const passwordConfirm =
            String(
                formData.get(
                    "passwordConfirm"
                )
            );

        if (
            password !==
            passwordConfirm
        ) {
            this.validatePasswordConfirmation();
            this.showFeedback(
                "Şifreler eşleşmiyor.",
                true
            );

            document
                .getElementById(
                    "registerPasswordConfirm"
                )
                ?.focus();

            return;
        }

        const passwordRules =
            this.getPasswordRules(
                password
            );

        if (
            name.length < 2 ||
            !Object.values(
                passwordRules
            ).every(Boolean)
        ) {
            this.showFeedback(
                "Şifren tüm güvenlik koşullarını karşılamalı.",
                true
            );

            return;
        }

        if (
            this.accounts.some(
                (account) => {
                    return account.email ===
                        email;
                }
            )
        ) {
            this.showFeedback(
                "Bu e-posta ile daha önce profil oluşturulmuş.",
                true
            );

            return;
        }

        const salt =
            this.createSalt();

        const passwordHash =
            await this.hashPassword(
                password,
                salt
            );

        const account = {
            id:
                crypto.randomUUID?.() ||
                `${Date.now()}`,
            name,
            email,
            salt,
            passwordHash,
            avatar:
                "images/avatar/1.svg",
            createdAt:
                new Date().toISOString()
        };

        this.accounts.push(account);

        if (
            !this.writeStorage(
                this.ACCOUNTS_KEY,
                this.accounts
            )
        ) {
            this.accounts.pop();
            return;
        }

        this.startSession(account);
        event.currentTarget.reset();
        this.validatePasswordConfirmation();
        this.updatePasswordSecurity("");
        this.render();
    }

    async handleLogin(event) {
        event.preventDefault();

        const formData =
            new FormData(event.currentTarget);

        const email =
            this.normalizeEmail(
                formData.get("email")
            );

        const password =
            String(
                formData.get("password")
            );

        const shouldRemember =
            formData.get("remember") ===
            "on";

        const account =
            this.accounts.find(
                (item) => {
                    return item.email ===
                        email;
                }
            );

        if (!account) {
            this.showFeedback(
                "E-posta veya şifre hatalı.",
                true
            );

            return;
        }

        const passwordHash =
            await this.hashPassword(
                password,
                account.salt
            );

        if (
            passwordHash !==
            account.passwordHash
        ) {
            this.showFeedback(
                "E-posta veya şifre hatalı.",
                true
            );

            return;
        }

        this.startSession(
            account,
            shouldRemember
        );
        event.currentTarget.reset();
        this.render();
    }

    startSession(
        account,
        shouldRemember = true
    ) {
        this.session = {
            accountId: account.id,
            startedAt:
                new Date().toISOString()
        };

        try {
            localStorage.removeItem(
                this.SESSION_KEY
            );
            sessionStorage.removeItem(
                this.SESSION_KEY
            );

            (
                shouldRemember
                    ? localStorage
                    : sessionStorage
            ).setItem(
                this.SESSION_KEY,
                JSON.stringify(
                    this.session
                )
            );
        } catch {
            this.showFeedback(
                "Oturum bilgisi kaydedilemedi.",
                true
            );
        }

        this.migrateGuestLibrary(
            account.id
        );
    }

    migrateGuestLibrary(accountId) {
        const accountLibraryKey =
            `${this.LIBRARY_KEY}:${accountId}`;

        if (
            localStorage.getItem(
                accountLibraryKey
            )
        ) {
            return;
        }

        const guestLibrary =
            localStorage.getItem(
                this.LIBRARY_KEY
            );

        if (guestLibrary) {
            localStorage.setItem(
                accountLibraryKey,
                guestLibrary
            );
        }
    }

    logout() {
        this.session = null;
        localStorage.removeItem(
            this.SESSION_KEY
        );
        sessionStorage.removeItem(
            this.SESSION_KEY
        );
        this.render();
        this.switchTab("login");
    }

    getCurrentAccount() {
        if (!this.session?.accountId) {
            return null;
        }

        return (
            this.accounts.find(
                (account) => {
                    return account.id ===
                        this.session.accountId;
                }
            ) || null
        );
    }

    getInitials(name) {
        return name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => {
                return part[0]
                    .toLocaleUpperCase("tr-TR");
            })
            .join("");
    }

    getAvatarPath(account) {
        const avatar =
            String(
                account?.avatar || ""
            );

        return /^images\/avatar\/(?:[1-9]|1\d|2[01])\.svg$/
            .test(avatar)
                ? avatar
                : "images/avatar/1.svg";
    }

    toggleProfileEdit(shouldOpen) {
        const form =
            document.getElementById(
                "profileEditForm"
            );

        if (!form) {
            return;
        }

        form.hidden = !shouldOpen;

        if (shouldOpen) {
            const account =
                this.getCurrentAccount();

            if (!account) {
                return;
            }

            document.getElementById(
                "profileNameInput"
            ).value = account.name;

            const selectedAvatar =
                this.getAvatarPath(account);

            const avatarInput =
                form.querySelector(
                    `[name="avatar"][value="${selectedAvatar}"]`
                ) ||
                form.querySelector(
                    '[name="avatar"]'
                );

            if (avatarInput) {
                avatarInput.checked = true;
            }

            document.getElementById(
                "profileNameInput"
            ).focus();
        }
    }

    handleProfileUpdate(event) {
        event.preventDefault();

        const account =
            this.getCurrentAccount();

        if (!account) {
            return;
        }

        const formData =
            new FormData(event.currentTarget);

        const name =
            String(
                formData.get("name")
            ).trim();

        if (name.length < 2) {
            return;
        }

        account.name = name;
        account.avatar =
            String(
                formData.get(
                    "avatar"
                ) || "images/avatar/1.svg"
            );

        if (
            this.writeStorage(
                this.ACCOUNTS_KEY,
                this.accounts
            )
        ) {
            this.toggleProfileEdit(false);
            this.render();

            if (
                typeof window.showToast ===
                "function"
            ) {
                window.showToast(
                    "Profil bilgilerin güncellendi."
                );
            }
        }
    }

    render() {
        const account =
            this.getCurrentAccount();

        const authView =
            document.getElementById(
                "authView"
            );

        const profileView =
            document.getElementById(
                "profileView"
            );

        authView.hidden =
            Boolean(account);

        profileView.hidden =
            !account;

        if (!account) {
            return;
        }

        const library =
            this.readStorage(
                `${this.LIBRARY_KEY}:${account.id}`,
                {
                    favorites: {},
                    watchlist: {},
                    watched: {},
                    ratings: {}
                }
            );

        const seriesLibrary =
            this.readStorage(
                `seyirAtlasiSeriesLibrary:${account.id}`,
                {
                    favorites: {},
                    watchlist: {},
                    watched: {}
                }
            );

        document.getElementById(
            "profileName"
        ).textContent = account.name;

        document.getElementById(
            "profileEmail"
        ).textContent = account.email;

        const profileAvatar =
            document.getElementById(
                "profileAvatar"
            );

        profileAvatar.textContent = "";
        profileAvatar.style.backgroundImage =
            `url("${this.getAvatarPath(account)}")`;

        document.getElementById(
            "favoriteCount"
        ).textContent =
            Object.keys(
                library.favorites || {}
            ).length +
            Object.keys(
                seriesLibrary.favorites || {}
            ).length;

        document.getElementById(
            "watchlistCount"
        ).textContent =
            Object.keys(
                library.watchlist || {}
            ).length +
            Object.keys(
                seriesLibrary.watchlist || {}
            ).length;

        document.getElementById(
            "watchedCount"
        ).textContent =
            Object.keys(
                library.watched || {}
            ).length +
            Object.keys(
                seriesLibrary.watched || {}
            ).length;

        document.getElementById(
            "ratingCount"
        ).textContent =
            Object.keys(
                library.ratings || {}
            ).length;

        this.renderRecentMovies(
            library,
            seriesLibrary
        );
    }

    renderRecentMovies(
        library,
        seriesLibrary = {}
    ) {
        const grid =
            document.getElementById(
                "profileRecentGrid"
            );

        const empty =
            document.getElementById(
                "profileEmpty"
            );

        if (!grid || !empty) {
            return;
        }

        const moviesById = new Map();

        [
            library.favorites || {},
            library.watchlist || {},
            library.watched || {},
            seriesLibrary.favorites || {},
            seriesLibrary.watchlist || {},
            seriesLibrary.watched || {}
        ].forEach((collection) => {
            Object.values(collection)
                .forEach((movie) => {
                    const mediaKey =
                        `${
                            movie.media_type === "tv" ||
                            movie.name
                                ? "tv"
                                : "movie"
                        }:${String(movie.id)}`;
                    const current =
                        moviesById.get(
                            mediaKey
                        );

                    if (
                        !current ||
                        String(movie.saved_at || "") >
                            String(current.saved_at || "")
                    ) {
                        moviesById.set(
                            mediaKey,
                            movie
                        );
                    }
                });
        });

        const recentMovies =
            Array.from(moviesById.values())
                .sort((first, second) => {
                    return String(
                        second.saved_at || ""
                    ).localeCompare(
                        String(
                            first.saved_at || ""
                        )
                    );
                })
                .slice(0, 5);

        grid.replaceChildren();
        grid.hidden =
            recentMovies.length === 0;
        empty.hidden =
            recentMovies.length > 0;

        recentMovies.forEach((movie) => {
            const card =
                document.createElement("a");

            card.className =
                "profile-recent-card";
            const isSeries =
                movie.media_type === "tv" ||
                Boolean(movie.name);
            const itemTitle =
                movie.title ||
                movie.name ||
                (isSeries
                    ? "İsimsiz Dizi"
                    : "İsimsiz Film");
            card.href = isSeries
                ? "series-list.html"
                : "movie-list.html";
            card.setAttribute(
                "aria-label",
                `${itemTitle} listede görüntüle`
            );

            const poster =
                document.createElement("div");
            poster.className =
                "profile-recent-poster";

            if (movie.poster_path) {
                const image =
                    document.createElement("img");
                image.src =
                    `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
                image.alt =
                    `${itemTitle} afişi`;
                image.loading = "lazy";
                poster.appendChild(image);
            } else {
                poster.textContent = "🎬";
                poster.classList.add(
                    "is-placeholder"
                );
            }

            const title =
                document.createElement("strong");
            title.textContent =
                itemTitle;

            const year =
                document.createElement("span");
            year.textContent =
                String(
                    movie.release_date ||
                    movie.first_air_date ||
                    ""
                ).slice(0, 4) ||
                "Listende";

            card.append(
                poster,
                title,
                year
            );
            grid.appendChild(card);
        });
    }

    showFeedback(message, isError = false) {
        const feedback =
            document.getElementById(
                "accountFeedback"
            );

        if (!feedback) {
            return;
        }

        feedback.textContent = message;
        feedback.classList.toggle(
            "is-error",
            isError
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        new LocalAccountManager();
    }
);
