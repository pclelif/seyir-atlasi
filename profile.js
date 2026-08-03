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
        this.restoreServerSession();
        this.handleUrlState();
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

        document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => this.showRecoveryForm());
        document.getElementById("recoveryCancel")?.addEventListener("click", () => this.showRecoveryForm(false));
        document.getElementById("recoveryForm")?.addEventListener("submit", (event) => this.handleRecovery(event));
        document.getElementById("resetPasswordForm")?.addEventListener("submit", (event) => this.handlePasswordReset(event));
        document.getElementById("resendVerificationBtn")?.addEventListener("click", () => this.resendVerification());
        document.getElementById("securityToggle")?.addEventListener("click", () => { const panel = document.getElementById("profileSecurity"); panel.hidden = !panel.hidden; if (!panel.hidden) panel.scrollIntoView({ behavior: "smooth", block: "start" }); });
        document.getElementById("changePasswordForm")?.addEventListener("submit", (event) => this.handlePasswordChange(event));
        document.getElementById("deleteAccountBtn")?.addEventListener("click", () => this.handleAccountDelete());
        document.getElementById("profileSharesList")?.addEventListener("click", (event) => { const button = event.target.closest("[data-revoke-share]"); if (button) this.revokeShare(button.dataset.revokeShare); });
        document.getElementById("profileVisibilityToggle")?.addEventListener("change", (event) => this.updateProfileVisibility(event.target.checked));
        document.getElementById("exportAccountBtn")?.addEventListener("click", () => this.exportAccountData());
        document.querySelectorAll('[name="genres"]').forEach((input)=>input.addEventListener("change",()=>{const checked=document.querySelectorAll('[name="genres"]:checked');if(checked.length>3){input.checked=false;window.showToast?.("En fazla 3 tür seçebilirsin.");}}));
        document.getElementById("customAvatarFile")?.addEventListener("change", (event) => this.handleCustomAvatar(event));

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
                password.length >= 10,
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

    accountDisabledMessage() {
        this.showFeedback("Hesap özellikleri yakında aktif olacaktır.", true);
    }

    async api(path, options = {}) {
        const response = await fetch(`/api/auth/${path}`, {
            credentials: "same-origin",
            ...options,
            headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(data.error || "İşlem tamamlanamadı.");
            error.code = data.code;
            throw error;
        }
        return data;
    }

    setBusy(form, busy) {
        form.querySelectorAll("button, input").forEach((element) => { element.disabled = busy; });
        form.setAttribute("aria-busy", String(busy));
        const submit = form.querySelector('[type="submit"]');
        if (submit) {
            if (!submit.dataset.defaultText) submit.dataset.defaultText = submit.textContent;
            submit.textContent = busy
                ? submit.dataset.busyText || "Lütfen bekle…"
                : submit.dataset.defaultText;
        }
    }

    async restoreServerSession() {
        try {
            const { user } = await this.api("me", { method: "GET" });
            this.cacheAccount(user);
            this.startSession(user, true);
            await this.syncProfileLibraries(user.id);
            this.render();
            this.loadSharedLists();
        } catch {
            this.session = null;
            localStorage.removeItem(this.SESSION_KEY);
            sessionStorage.removeItem(this.SESSION_KEY);
            this.render();
        }
    }

    handleUrlState() {
        const params = new URLSearchParams(location.search);
        if (params.get("verified") === "1") this.showFeedback("E-posta adresin doğrulandı. Şimdi giriş yapabilirsin.");
        if (params.get("verified") === "0") this.showFeedback("Doğrulama bağlantısı geçersiz veya süresi dolmuş.", true);
        if (params.has("reset")) {
            document.getElementById("authTabs").hidden = true;
            document.getElementById("loginForm").hidden = true;
            document.getElementById("registerForm").hidden = true;
            document.getElementById("resetPasswordForm").hidden = false;
        }
    }

    cacheAccount(account) {
        this.accounts = [{ ...account }];
        this.writeStorage(this.ACCOUNTS_KEY, this.accounts);
    }

    async handleRegister(event) {
        event.preventDefault();
        this.accountDisabledMessage();
        return;
        const form = event.currentTarget;

        const formData =
            new FormData(form);

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

        if (name.length < 2) {
            this.showFeedback("Ad soyad alanına en az 2 karakter yazmalısın.", true);
            form.elements.name.focus();
            return;
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            this.showFeedback("Geçerli bir e-posta adresi yazmalısın.", true);
            form.elements.email.focus();
            return;
        }

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

        const termsAccepted = formData.get("termsAccepted") === "on";
        if (!termsAccepted) {
            this.showFeedback("Hesap oluşturmak için Kullanım Koşulları’nı kabul etmelisin.", true);
            return;
        }

        this.showFeedback("Hesabın oluşturuluyor, lütfen bekle…");
        this.setBusy(form, true);
        try {
            const result = await this.api("register", { method: "POST", body: JSON.stringify({ name, email, password, termsAccepted, termsVersion: "1.0" }) });
            form.reset();
            this.validatePasswordConfirmation();
            this.updatePasswordSecurity("");
            this.switchTab("login");
            document.querySelector('#loginForm [name="email"]').value = email;
            this.showFeedback(result.message);
        } catch (error) {
            if (error.code === "EMAIL_NOT_VERIFIED") {
                this.session = null;
                localStorage.removeItem(this.SESSION_KEY);
                sessionStorage.removeItem(this.SESSION_KEY);
            }
            this.showFeedback(error.message, true);
        } finally {
            this.setBusy(form, false);
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        this.accountDisabledMessage();
        return;
        const form = event.currentTarget;

        const formData =
            new FormData(form);

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

        this.setBusy(form, true);
        try {
            const { user } = await this.api("login", { method: "POST", body: JSON.stringify({ email, password, remember: shouldRemember }) });
            this.cacheAccount(user);
            this.startSession(user, shouldRemember);
            form.reset();
            this.render();
            const next = new URLSearchParams(location.search).get("next");
            if (next) {
                try {
                    const destination = new URL(next, location.href);
                    if (destination.origin === location.origin) location.href = destination.href;
                } catch { /* Geçersiz yönlendirme yok sayılır. */ }
            }
        } catch (error) {
            this.showFeedback(error.message, true);
            const resend = document.getElementById("resendVerificationBtn");
            if (resend) { resend.hidden = error.code !== "EMAIL_NOT_VERIFIED"; resend.dataset.email = email; }
        } finally {
            this.setBusy(form, false);
        }
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

    async logout() {
        try { await this.api("logout", { method: "POST", body: "{}" }); } catch { /* Yerel oturum yine kapatılır. */ }
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

        const account = this.accounts.find(
                (account) => {
                    return account.id ===
                        this.session.accountId;
                }
            ) || null;

        return account?.emailVerified === true ? account : null;
    }

    showRecoveryForm(show = true) {
        if (show) {
            const loginEmail = document.querySelector('#loginForm [name="email"]')?.value || "";
            const recoveryEmail = document.querySelector('#recoveryForm [name="email"]');
            if (recoveryEmail && !recoveryEmail.value) recoveryEmail.value = loginEmail;
        }
        document.getElementById("loginForm").hidden = show;
        document.getElementById("registerForm").hidden = true;
        document.getElementById("authTabs").hidden = show;
        document.getElementById("recoveryForm").hidden = !show;
        this.showFeedback("");
    }

    async handleRecovery(event) {
        event.preventDefault();
        this.accountDisabledMessage();
        return;
        const form = event.currentTarget; this.setBusy(form, true);
        try { const data = await this.api("forgot-password", { method: "POST", body: JSON.stringify({ email: new FormData(form).get("email") }) }); this.showFeedback(data.message); }
        catch (error) { this.showFeedback(error.message, true); }
        finally { this.setBusy(form, false); }
    }

    async handlePasswordReset(event) {
        event.preventDefault();
        this.accountDisabledMessage();
        return;
        const form = event.currentTarget; const password = String(new FormData(form).get("password"));
        this.setBusy(form, true);
        try { const data = await this.api("reset-password", { method: "POST", body: JSON.stringify({ token: new URLSearchParams(location.search).get("reset"), password }) }); history.replaceState({}, "", "profile.html"); document.getElementById("resetPasswordForm").hidden = true; document.getElementById("authTabs").hidden = false; this.switchTab("login"); this.showFeedback(data.message); }
        catch (error) { this.showFeedback(error.message, true); }
        finally { this.setBusy(form, false); }
    }

    async resendVerification() {
        this.accountDisabledMessage();
        return;
        const button = document.getElementById("resendVerificationBtn");
        try { const data = await this.api("resend-verification", { method: "POST", body: JSON.stringify({ email: button.dataset.email }) }); button.hidden = true; this.showFeedback(data.message); }
        catch (error) { this.showFeedback(error.message, true); }
    }

    async handlePasswordChange(event) {
        event.preventDefault();
        this.accountDisabledMessage();
        return;
        const form = event.currentTarget; const data = new FormData(form); this.setBusy(form, true);
        try { const result = await this.api("change-password", { method: "POST", body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) }); form.reset(); window.showToast?.(result.message); }
        catch (error) { window.showToast?.(error.message); }
        finally { this.setBusy(form, false); }
    }

    async handleAccountDelete() {
        this.accountDisabledMessage();
        return;
        if (!confirm("Hesabını kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;
        const password = prompt("Onaylamak için şifreni gir:"); if (!password) return;
        const accountId = this.session?.accountId;
        try {
            await this.api("account", { method: "DELETE", body: JSON.stringify({ password }) });
            if (accountId) { localStorage.removeItem(`${this.LIBRARY_KEY}:${accountId}`); localStorage.removeItem(`seyirAtlasiSeriesLibrary:${accountId}`); }
            this.accounts = []; this.writeStorage(this.ACCOUNTS_KEY, []); this.session = null; localStorage.removeItem(this.SESSION_KEY); sessionStorage.removeItem(this.SESSION_KEY); this.render(); this.switchTab("login"); this.showFeedback("Hesabın kalıcı olarak silindi.");
        } catch (error) { window.showToast?.(error.message); }
    }

    async loadSharedLists() {
        const container = document.getElementById("profileSharesList"); if (!container || !this.getCurrentAccount()) return;
        try {
            const response = await fetch("/api/lists/shares", { credentials: "same-origin" }); const data = await response.json(); if (!response.ok) throw new Error(data.error);
            container.innerHTML = data.shares.length ? data.shares.map((share) => `<article class="profile-share-row"><div><strong>${this.escapeHTML(share.title)}</strong><small>${share.item_count} ${share.media_type === "movie" ? "film" : "dizi"}</small></div><div><a href="${share.url}" target="_blank" rel="noopener">Görüntüle</a><button type="button" data-revoke-share="${share.share_id}">Paylaşımı Durdur</button></div></article>`).join("") : `<p class="library-empty">Henüz bağlantıyla paylaştığın bir liste yok.</p>`;
        } catch { container.innerHTML = `<p class="library-empty">Paylaşımlar şu anda yüklenemedi.</p>`; }
    }

    async syncProfileLibraries(accountId) {
        try {
            const [movies, series] = await Promise.all([
                fetch("/api/library?type=movie", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : null),
                fetch("/api/library?type=tv", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : null)
            ]);
            if (movies?.exists) localStorage.setItem(`${this.LIBRARY_KEY}:${accountId}`, JSON.stringify(movies.library));
            if (series?.exists) localStorage.setItem(`seyirAtlasiSeriesLibrary:${accountId}`, JSON.stringify(series.library));
        } catch { /* Yerel kopya çevrimdışı kullanım için korunur. */ }
    }

    async revokeShare(shareId) {
        if (!confirm("Bu paylaşımı durdurmak istiyor musun?")) return;
        try { const response = await fetch(`/api/lists/share/${encodeURIComponent(shareId)}`, { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); window.showToast?.(data.message); this.loadSharedLists(); }
        catch (error) { window.showToast?.(error.message); }
    }

    async updateProfileVisibility(isPublic) {
        this.accountDisabledMessage();
        return;
        const toggle=document.getElementById("profileVisibilityToggle"); toggle.disabled=true;
        try { const {user,url}=await this.api("profile-visibility",{method:"PATCH",body:JSON.stringify({isPublic})}); this.cacheAccount(user); this.renderProfileVisibility(user,url); window.showToast?.(isPublic?"Profilin herkese açıldı.":"Profilin gizlendi."); }
        catch(error){ toggle.checked=!isPublic; window.showToast?.(error.message); }
        finally{ toggle.disabled=false; }
    }

    renderProfileVisibility(account,url=null) {
        const toggle=document.getElementById("profileVisibilityToggle"); const label=document.getElementById("profileVisibilityLabel"); const link=document.getElementById("publicProfileLink"); if(!toggle||!label||!link)return;
        toggle.checked=Boolean(account.profilePublic); label.textContent=account.profilePublic?"Açık":"Kapalı"; link.hidden=!account.profilePublic;
        if(account.profilePublic) link.href=url||`public-profile.html?u=${encodeURIComponent(account.profileSlug)}`;
    }

    async exportAccountData() {
        this.accountDisabledMessage();
        return;
        const button=document.getElementById("exportAccountBtn"); button.disabled=true;
        try { const response=await fetch("/api/auth/export",{credentials:"same-origin"}); const data=await response.json(); if(!response.ok)throw new Error(data.error); const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`seyiratlasi-verilerim-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000); window.showToast?.("Verilerinin kopyası indirildi."); }
        catch(error){window.showToast?.(error.message);} finally{button.disabled=false;}
    }

    escapeHTML(value) {
        const node = document.createElement("span"); node.textContent = String(value || ""); return node.innerHTML;
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
        if (account?.avatar === "custom" && /^data:image\/(?:jpeg|png|webp);base64,/.test(account?.preferences?.customAvatar || "")) {
            return account.preferences.customAvatar;
        }
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

            const preferences=account.preferences||{};
            this.customAvatarData=preferences.customAvatar||"";
            const preview=document.getElementById("customAvatarPreview"); preview.src=this.customAvatarData; preview.hidden=!this.customAvatarData; document.getElementById("customAvatarPreviewBox")?.classList.toggle("has-image",Boolean(this.customAvatarData));
            form.querySelectorAll('[name="genres"]').forEach((input)=>{input.checked=(preferences.genres||[]).includes(input.value);});
            form.elements.favoriteMovie.value=preferences.favoriteMovie||"";
            form.elements.favoriteSeries.value=preferences.favoriteSeries||"";
            form.elements.favoriteCharacter.value=preferences.favoriteCharacter||"";

            document.getElementById(
                "profileNameInput"
            ).focus();
        }
    }

    async handleCustomAvatar(event) {
        const file=event.target.files?.[0]; if(!file)return;
        if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8_000_000){window.showToast?.("JPG, PNG veya WebP biçiminde en fazla 8 MB fotoğraf seç.");event.target.value="";return;}
        try {
            const bitmap=await createImageBitmap(file); const size=Math.min(bitmap.width,bitmap.height); const canvas=document.createElement("canvas"); canvas.width=256; canvas.height=256; const context=canvas.getContext("2d"); context.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,256,256); bitmap.close?.();
            this.customAvatarData=canvas.toDataURL("image/webp",.82); const preview=document.getElementById("customAvatarPreview"); preview.src=this.customAvatarData; preview.hidden=false; document.getElementById("customAvatarPreviewBox")?.classList.add("has-image"); document.getElementById("customAvatarChoice").checked=true; window.showToast?.("Fotoğrafın hazır; kaydetmeyi unutma.");
        } catch { window.showToast?.("Fotoğraf işlenemedi."); }
    }

    async handleProfileUpdate(event) {
        event.preventDefault();
        const form = event.currentTarget;

        const account =
            this.getCurrentAccount();

        if (!account) {
            return;
        }

        const formData =
            new FormData(form);

        const name =
            String(
                formData.get("name")
            ).trim();

        if (name.length < 2) {
            return;
        }

        const avatar = String(formData.get("avatar") || "images/avatar/1.svg");
        const preferences={genres:formData.getAll("genres").slice(0,3),favoriteMovie:String(formData.get("favoriteMovie")||""),favoriteSeries:String(formData.get("favoriteSeries")||""),favoriteCharacter:String(formData.get("favoriteCharacter")||""),customAvatar:formData.get("avatar")==="custom"?this.customAvatarData||"":""};
        this.setBusy(form, true);
        try {
            const { user } = await this.api("profile", { method: "PATCH", body: JSON.stringify({ name, avatar, preferences }) });
            this.cacheAccount(user);
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
        } catch (error) {
            this.showFeedback(error.message, true);
        } finally {
            this.setBusy(form, false);
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

        const watchedItems=[...Object.values(library.watched||{}),...Object.values(seriesLibrary.watched||{})]; const now=new Date();
        const inMonth=watchedItems.filter((item)=>{const date=new Date(item.saved_at);return !Number.isNaN(date.valueOf())&&date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth();}).length;
        const inYear=watchedItems.filter((item)=>{const date=new Date(item.saved_at);return !Number.isNaN(date.valueOf())&&date.getFullYear()===now.getFullYear();}).length;
        const unique=new Set([...Object.keys(library.favorites||{}),...Object.keys(library.watchlist||{}),...Object.keys(library.watched||{}),...Object.keys(seriesLibrary.favorites||{}).map(id=>`tv:${id}`),...Object.keys(seriesLibrary.watchlist||{}).map(id=>`tv:${id}`),...Object.keys(seriesLibrary.watched||{}).map(id=>`tv:${id}`)]).size;
        const ratings=Object.values(library.ratings||{}).map(Number).filter(Number.isFinite); const average=ratings.length?(ratings.reduce((sum,value)=>sum+value,0)/ratings.length).toFixed(1):"—";
        document.getElementById("monthWatchedCount").textContent=inMonth; document.getElementById("yearWatchedCount").textContent=inYear; document.getElementById("collectionTotalCount").textContent=unique; document.getElementById("averageRating").textContent=average;
        this.renderTasteSummary(account.preferences||{});
        this.renderProfileVisibility(account);

        this.renderRecentMovies(
            library,
            seriesLibrary
        );
    }

    renderTasteSummary(preferences) {
        const section=document.getElementById("profileTasteSummary"); const genres=Array.isArray(preferences.genres)?preferences.genres:[]; const favorites=[["Favori film",preferences.favoriteMovie],["Favori dizi",preferences.favoriteSeries],["Favori karakter",preferences.favoriteCharacter]].filter(([,value])=>value);
        section.hidden=!genres.length&&!favorites.length;
        document.getElementById("profileGenreChips").innerHTML=genres.map(item=>`<span>${this.escapeHTML(item)}</span>`).join("");
        document.getElementById("profileFavoriteSummary").innerHTML=favorites.map(([label,value])=>`<div><small>${label}</small><strong>${this.escapeHTML(value)}</strong></div>`).join("");
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
