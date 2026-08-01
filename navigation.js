class SideNavigation {
    constructor() {
        this.menu =
            document.querySelector(
                "[data-side-menu]"
            );
        this.toggle =
            document.querySelector(
                "[data-menu-toggle]"
            );
        this.lastFocusedElement = null;

        if (!this.menu || !this.toggle) {
            return;
        }

        this.setupContextualLists();
        this.setupArchiveAlignment();
        this.renderAccountStatus();
        this.setupToastContainer();
        this.setupEvents();
        this.requireCurrentTerms();
    }

    setupArchiveAlignment() {
        const archiveHashes =
            new Set([
                "#discoverSection",
                "#seriesArchive"
            ]);
        let alignmentObserver = null;
        let alignmentTimeout = null;

        const alignTarget = (
            hash,
            behavior = "smooth"
        ) => {
            if (!archiveHashes.has(hash)) {
                return;
            }

            const target =
                document.querySelector(hash);
            const navbar =
                document.querySelector(
                    ".navbar"
                );

            if (!target) {
                return;
            }

            const navbarHeight =
                navbar?.getBoundingClientRect()
                    .height || 72;
            const targetTop =
                window.scrollY +
                target.getBoundingClientRect()
                    .top -
                navbarHeight -
                18;

            window.scrollTo({
                top: Math.max(0, targetTop),
                behavior
            });
        };

        const stopStableAlignment = () => {
            alignmentObserver?.disconnect();
            alignmentObserver = null;
            clearTimeout(alignmentTimeout);
            alignmentTimeout = null;
        };

        const keepTargetAligned = (hash) => {
            stopStableAlignment();

            const target =
                document.querySelector(hash);
            const contentBeforeTarget =
                target?.previousElementSibling;

            if (
                !target ||
                !contentBeforeTarget ||
                typeof ResizeObserver ===
                    "undefined"
            ) {
                return;
            }

            alignmentObserver =
                new ResizeObserver(() => {
                    if (
                        window.location.hash ===
                        hash
                    ) {
                        alignTarget(hash, "auto");
                    }
                });
            alignmentObserver.observe(
                contentBeforeTarget
            );

            alignmentTimeout = setTimeout(
                stopStableAlignment,
                5000
            );
        };

        window.addEventListener(
            "wheel",
            stopStableAlignment,
            { passive: true }
        );
        window.addEventListener(
            "touchstart",
            stopStableAlignment,
            { passive: true }
        );

        document.addEventListener(
            "click",
            (event) => {
                const link =
                    event.target.closest(
                        "a[href]"
                    );

                if (!link) {
                    return;
                }

                let url;

                try {
                    url = new URL(
                        link.href,
                        window.location.href
                    );
                } catch {
                    return;
                }

                const samePage =
                    url.origin ===
                        window.location.origin &&
                    url.pathname ===
                        window.location.pathname;

                if (
                    !samePage ||
                    !archiveHashes.has(
                        url.hash
                    )
                ) {
                    return;
                }

                event.preventDefault();
                window.history.pushState(
                    null,
                    "",
                    url.hash
                );
                this.close();

                requestAnimationFrame(() => {
                    alignTarget(
                        url.hash
                    );
                    keepTargetAligned(
                        url.hash
                    );
                });
            }
        );

        const alignInitialHash = () => {
            if (
                !archiveHashes.has(
                    window.location.hash
                )
            ) {
                return;
            }

            alignTarget(
                window.location.hash,
                "auto"
            );
            keepTargetAligned(
                window.location.hash
            );

            setTimeout(
                () => {
                    alignTarget(
                        window.location.hash,
                        "auto"
                    );
                },
                500
            );
        };

        window.addEventListener(
            "load",
            alignInitialHash
        );

        window.addEventListener(
            "hashchange",
            () => {
                alignTarget(
                    window.location.hash,
                    "auto"
                );
            }
        );
    }

    setupContextualLists() {
        const page =
            window.location.pathname
                .split("/")
                .pop() ||
            "index.html";

        if (
            document.body.classList
                .contains("series-page")
        ) {
            localStorage.setItem(
                "seyirAtlasiLastPanel",
                "series"
            );
        } else if (
            page === "index.html" ||
            page === "" ||
            page === "movie-list.html"
        ) {
            localStorage.setItem(
                "seyirAtlasiLastPanel",
                "movies"
            );
        }

        const target =
            localStorage.getItem(
                "seyirAtlasiLastPanel"
            ) === "series"
                ? "series-list.html"
                : "movie-list.html";

        document
            .querySelectorAll(
                "[data-contextual-list]"
            )
            .forEach((link) => {
                link.href = target;
            });
    }

    getCurrentAccount() {
        try {
            const sessionValue =
                localStorage.getItem(
                    "seyirAtlasiSession"
                ) ||
                sessionStorage.getItem(
                    "seyirAtlasiSession"
                );

            if (!sessionValue) {
                return null;
            }

            const session =
                JSON.parse(sessionValue);

            const accounts =
                JSON.parse(
                    localStorage.getItem(
                        "seyirAtlasiAccounts"
                    ) || "[]"
                );

            const account = accounts.find((account) => {
                    return account.id ===
                        session.accountId;
                }) || null;

            return account?.emailVerified === true ? account : null;
        } catch {
            return null;
        }
    }

    getInitials(name) {
        return String(name)
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

    renderAccountStatus() {
        const panel =
            this.menu.querySelector(
                ".side-menu-panel"
            );

        const label =
            panel?.querySelector(
                ".side-menu-label"
            );

        if (!panel || !label) {
            return;
        }

        const account =
            this.getCurrentAccount();

        const status =
            document.createElement("div");

        status.className =
            "side-account-status";

        if (account) {
            status.innerHTML = `
                <div
                    class="side-account-avatar has-image"
                    style="background-image:url('${this.getAvatarPath(account)}')"
                ></div>
                <div class="side-account-copy">
                    <strong>${this.escapeHTML(account.name)}</strong>
                    <small>Oturum açık</small>
                </div>
            `;
        } else {
            status.innerHTML = `
                <div class="side-account-avatar is-guest">?</div>
                <div class="side-account-copy">
                    <strong>Misafir</strong>
                    <small>Listelerini kaydetmek için</small>
                </div>
                <a href="profile.html" class="side-account-login">Giriş yap</a>
            `;
        }

        panel.insertBefore(
            status,
            label
        );
    }

    escapeHTML(value) {
        const element =
            document.createElement("div");
        element.textContent =
            String(value || "");
        return element.innerHTML;
    }

    setupToastContainer() {
        let container =
            document.getElementById(
                "toastContainer"
            );

        if (!container) {
            container =
                document.createElement("div");
            container.id = "toastContainer";
            container.className =
                "toast-container";
            container.setAttribute(
                "aria-live",
                "polite"
            );
            document.body.appendChild(
                container
            );
        }

        window.showToast = (
            message,
            type = "success"
        ) => {
            const toast =
                document.createElement(
                    "div"
                );

            toast.className =
                `app-toast is-${type}`;
            toast.innerHTML = `
                <span aria-hidden="true">${type === "error" ? "!" : "✓"}</span>
                <p>${this.escapeHTML(message)}</p>
            `;

            container.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.add(
                    "is-visible"
                );
            });

            setTimeout(() => {
                toast.classList.remove(
                    "is-visible"
                );
                setTimeout(
                    () => toast.remove(),
                    260
                );
            }, 2800);
        };
    }

    async requireCurrentTerms() {
        try {
            const response = await fetch("/api/auth/me", { credentials: "same-origin" });
            if (!response.ok) return;
            const { user } = await response.json();
            if (user?.termsAccepted) return;

            const modal = document.createElement("div");
            modal.className = "terms-renewal";
            modal.setAttribute("role", "dialog");
            modal.setAttribute("aria-modal", "true");
            modal.setAttribute("aria-labelledby", "termsRenewalTitle");
            modal.innerHTML = `<div class="terms-renewal-card"><span class="legal-eyebrow">Bir defalık işlem</span><h2 id="termsRenewalTitle">Koşullarımızı güncelledik</h2><p>SeyirAtlası’nı kullanmaya devam etmek için sadeleştirdiğimiz <a href="kullanim-kosullari.html" target="_blank">Kullanım Koşulları</a>nı inceleyip kabul etmelisin. Verilerinin kullanımını <a href="kvkk.html" target="_blank">KVKK Aydınlatma Metni</a>nde görebilirsin.</p><label><input type="checkbox"><span>Kullanım Koşulları’nı okudum ve kabul ediyorum.</span></label><div><button type="button" data-accept-terms disabled>Kabul et ve devam et</button><button type="button" data-decline-terms>Çıkış yap</button></div><small class="terms-renewal-error" aria-live="polite"></small></div>`;
            document.body.append(modal);
            document.body.classList.add("modal-open");
            const checkbox = modal.querySelector('input[type="checkbox"]');
            const accept = modal.querySelector("[data-accept-terms]");
            const decline = modal.querySelector("[data-decline-terms]");
            const error = modal.querySelector(".terms-renewal-error");
            checkbox.addEventListener("change", () => { accept.disabled = !checkbox.checked; });
            accept.addEventListener("click", async () => {
                accept.disabled = true;
                try {
                    const result = await fetch("/api/auth/accept-terms", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termsAccepted: true, termsVersion: "1.0" }) });
                    const data = await result.json();
                    if (!result.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
                    modal.remove();
                    document.body.classList.remove("modal-open");
                    window.showToast?.(data.message);
                } catch (requestError) {
                    error.textContent = requestError.message;
                    accept.disabled = false;
                }
            });
            decline.addEventListener("click", async () => {
                decline.disabled = true;
                try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" }); } catch { /* Yerel oturum yine temizlenir. */ }
                localStorage.removeItem("seyirAtlasiSession");
                sessionStorage.removeItem("seyirAtlasiSession");
                location.href = "profile.html";
            });
            checkbox.focus();
        } catch {
            // Hesap servisi kapalıysa sayfanın geri kalanı çalışmaya devam eder.
        }
    }

    setupEvents() {
        this.toggle.addEventListener(
            "click",
            () => {
                this.open();
            }
        );

        this.menu
            .querySelectorAll(
                "[data-menu-close]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        this.close();
                    }
                );
            });

        document.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Escape" &&
                    this.menu.classList
                        .contains("is-open")
                ) {
                    this.close();
                }
            }
        );
    }

    open() {
        this.lastFocusedElement =
            document.activeElement;

        this.menu.classList.add(
            "is-open"
        );
        this.menu.setAttribute(
            "aria-hidden",
            "false"
        );
        this.toggle.setAttribute(
            "aria-expanded",
            "true"
        );
        this.toggle.setAttribute(
            "aria-label",
            "Menüyü kapat"
        );
        document.body.classList.add(
            "side-menu-open"
        );

        this.menu
            .querySelector(
                ".side-menu-close"
            )
            ?.focus();
    }

    close() {
        this.menu.classList.remove(
            "is-open"
        );
        this.menu.setAttribute(
            "aria-hidden",
            "true"
        );
        this.toggle.setAttribute(
            "aria-expanded",
            "false"
        );
        this.toggle.setAttribute(
            "aria-label",
            "Menüyü aç"
        );
        document.body.classList.remove(
            "side-menu-open"
        );

        this.lastFocusedElement?.focus();
    }
}

class CursorStarField {
    constructor() {
        this.reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        );

        if (this.reduceMotion.matches) {
            return;
        }

        this.canvas = document.createElement("canvas");
        this.canvas.className = "cursor-stars";
        this.canvas.setAttribute("aria-hidden", "true");
        document.body.prepend(this.canvas);

        this.context = this.canvas.getContext("2d");
        this.pointer = {
            x: 0,
            y: 0,
            previousX: 0,
            previousY: 0,
            vx: 0,
            vy: 0,
            active: false
        };
        this.stars = [];
        this.frame = null;
        this.lastTime = performance.now();

        this.resize = this.resize.bind(this);
        this.trackPointer = this.trackPointer.bind(this);
        this.releasePointer = this.releasePointer.bind(this);
        this.animate = this.animate.bind(this);

        window.addEventListener("resize", this.resize);
        window.addEventListener("pointermove", this.trackPointer, {
            passive: true
        });
        document.documentElement.addEventListener(
            "pointerleave",
            this.releasePointer
        );
        window.addEventListener("blur", this.releasePointer);

        this.resize();
        this.frame = requestAnimationFrame(this.animate);
    }

    resize() {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = Math.round(this.width * ratio);
        this.canvas.height = Math.round(this.height * ratio);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0);

        const desiredCount = Math.min(
            90,
            Math.max(34, Math.round((this.width * this.height) / 17000))
        );

        while (this.stars.length < desiredCount) {
            this.stars.push(this.createStar());
        }

        this.stars.length = desiredCount;
    }

    createStar() {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;

        return {
            x,
            y,
            anchorX: x,
            anchorY: y,
            vx: (Math.random() - 0.5) * 0.18,
            vy: (Math.random() - 0.5) * 0.18,
            size: 0.65 + Math.random() * 1.45,
            alpha: 0.35 + Math.random() * 0.55,
            phase: Math.random() * Math.PI * 2,
            drift: 8 + Math.random() * 20
        };
    }

    trackPointer(event) {
        if (event.pointerType === "touch") {
            return;
        }

        if (!this.pointer.active) {
            this.pointer.previousX = event.clientX;
            this.pointer.previousY = event.clientY;
        }

        this.pointer.vx =
            event.clientX - this.pointer.previousX;
        this.pointer.vy =
            event.clientY - this.pointer.previousY;
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
        this.pointer.previousX = event.clientX;
        this.pointer.previousY = event.clientY;
        this.pointer.active = true;
    }

    releasePointer() {
        this.pointer.active = false;
    }

    animate(time) {
        const step = Math.min((time - this.lastTime) / 16.67, 2);
        this.lastTime = time;
        const context = this.context;
        const isLight =
            document.documentElement.dataset.theme === "light";

        context.clearRect(0, 0, this.width, this.height);

        if (this.pointer.active) {
            const glow = context.createRadialGradient(
                this.pointer.x,
                this.pointer.y,
                0,
                this.pointer.x,
                this.pointer.y,
                150
            );
            const glowColor = isLight ? "49, 148, 199" : "143, 175, 255";
            glow.addColorStop(0, `rgba(${glowColor}, 0.065)`);
            glow.addColorStop(0.35, `rgba(${glowColor}, 0.02)`);
            glow.addColorStop(1, `rgba(${glowColor}, 0)`);
            context.fillStyle = glow;
            context.fillRect(
                this.pointer.x - 150,
                this.pointer.y - 150,
                300,
                300
            );
        }

        this.stars.forEach((star) => {
            const driftX =
                Math.cos(time * 0.00018 + star.phase) * star.drift;
            const driftY =
                Math.sin(time * 0.00015 + star.phase) * star.drift;
            const homeX = star.anchorX + driftX;
            const homeY = star.anchorY + driftY;
            let cursorInfluence = 0;

            star.vx += (homeX - star.x) * 0.00038 * step;
            star.vy += (homeY - star.y) * 0.00038 * step;

            if (this.pointer.active) {
                const dx = this.pointer.x - star.x;
                const dy = this.pointer.y - star.y;
                const distance = Math.hypot(dx, dy);
                const reach = 340;

                if (distance > 14 && distance < reach) {
                    cursorInfluence = Math.pow(1 - distance / reach, 1.7);
                    const pull = cursorInfluence * 0.052 * step;
                    const orbit = cursorInfluence * 0.012 * step;

                    star.vx += (dx / distance) * pull;
                    star.vy += (dy / distance) * pull;
                    star.vx += (-dy / distance) * orbit;
                    star.vy += (dx / distance) * orbit;

                    star.vx += this.pointer.vx * cursorInfluence * 0.0025;
                    star.vy += this.pointer.vy * cursorInfluence * 0.0025;
                } else if (distance <= 14) {
                    star.vx -= dx * 0.006 * step;
                    star.vy -= dy * 0.006 * step;
                }
            }

            star.vx *= Math.pow(0.978, step);
            star.vy *= Math.pow(0.978, step);

            const speed = Math.hypot(star.vx, star.vy);
            if (speed > 2.7) {
                star.vx = (star.vx / speed) * 2.7;
                star.vy = (star.vy / speed) * 2.7;
            }

            star.x += star.vx * step;
            star.y += star.vy * step;

            if (star.x < -20) star.x = this.width + 20;
            if (star.x > this.width + 20) star.x = -20;
            if (star.y < -20) star.y = this.height + 20;
            if (star.y > this.height + 20) star.y = -20;

            const shimmer =
                0.78 + Math.sin(time * 0.0018 + star.phase) * 0.22;
            const color = isLight ? "23, 107, 150" : "199, 210, 254";

            context.beginPath();
            context.arc(
                star.x,
                star.y,
                star.size * (1 + cursorInfluence * 0.65),
                0,
                Math.PI * 2
            );
            context.fillStyle =
                `rgba(${color}, ${Math.min(1, star.alpha * shimmer + cursorInfluence * 0.3)})`;
            context.shadowColor = `rgba(${color}, 0.7)`;
            context.shadowBlur = star.size * (4 + cursorInfluence * 7);
            context.fill();
            context.shadowBlur = 0;
        });

        this.pointer.vx *= 0.82;
        this.pointer.vy *= 0.82;
        this.frame = requestAnimationFrame(this.animate);
    }
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        let footer = document.querySelector(".footer");
        if (!footer) {
            footer = document.createElement("footer");
            footer.className = "footer";
            footer.innerHTML = `<div class="footer-inner"><a href="index.html" class="footer-brand"><img src="images/logo.svg" alt=""><span>SeyirAtlası</span></a><p>Sinema evrenindeki rotan.</p><p class="footer-copy">© 2026 SeyirAtlası</p></div>`;
            document.body.append(footer);
        }
        const footerInner = footer.querySelector(".footer-inner");
        if (footerInner && !footerInner.querySelector(".footer-legal")) {
            const legalLinks = document.createElement("nav");
            legalLinks.className = "footer-legal";
            legalLinks.setAttribute("aria-label", "Yasal bilgiler");
            legalLinks.innerHTML = `<a href="kvkk.html">KVKK Aydınlatma Metni</a><a href="gizlilik.html">Gizlilik ve Çerez</a><a href="kullanim-kosullari.html">Kullanım Koşulları</a>`;
            footerInner.append(legalLinks);
        }

        const updateVisualViewport = () => {
            const viewport = window.visualViewport;
            const height = viewport?.height || window.innerHeight;
            const offsetTop = viewport?.offsetTop || 0;

            document.documentElement.style.setProperty(
                "--visual-viewport-height",
                `${height}px`
            );
            document.documentElement.style.setProperty(
                "--visual-viewport-top",
                `${offsetTop}px`
            );
        };

        updateVisualViewport();
        window.visualViewport?.addEventListener(
            "resize",
            updateVisualViewport
        );
        window.visualViewport?.addEventListener(
            "scroll",
            updateVisualViewport
        );

        let lockedScrollY = 0;
        let pageIsLocked = false;

        const syncModalScrollLock = () => {
            const shouldLock =
                document.body.classList.contains(
                    "modal-open"
                );

            if (shouldLock && !pageIsLocked) {
                lockedScrollY = window.scrollY;
                document.body.style.position = "fixed";
                document.body.style.top = `-${lockedScrollY}px`;
                document.body.style.right = "0";
                document.body.style.left = "0";
                document.body.style.width = "100%";
                pageIsLocked = true;
                return;
            }

            if (!shouldLock && pageIsLocked) {
                document.body.style.position = "";
                document.body.style.top = "";
                document.body.style.right = "";
                document.body.style.left = "";
                document.body.style.width = "";
                window.scrollTo(0, lockedScrollY);
                pageIsLocked = false;
            }
        };

        new MutationObserver(syncModalScrollLock).observe(
            document.body,
            {
                attributes: true,
                attributeFilter: ["class"]
            }
        );
        syncModalScrollLock();

        new CursorStarField();
        new SideNavigation();
    }
);
