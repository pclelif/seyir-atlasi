class SharedListPage {
    constructor() {
        this.shareId = new URLSearchParams(location.search).get("id") || "";
        this.list = null;
        document.getElementById("copySharedLink")?.addEventListener("click", () => this.copyLink());
        document.getElementById("copySharedList")?.addEventListener("click", () => this.copyToAccount());
        this.load();
    }

    escape(value) { const node = document.createElement("span"); node.textContent = String(value || ""); return node.innerHTML; }

    async load() {
        try {
            const response = await fetch(`/api/lists/public/${encodeURIComponent(this.shareId)}`);
            const data = await response.json(); if (!response.ok) throw new Error(data.error);
            this.list = data.list; this.render();
        } catch {
            document.getElementById("sharedListLoading").hidden = true;
            document.getElementById("sharedListError").hidden = false;
        }
    }

    render() {
        const list = this.list; const items = Array.isArray(list.items) ? list.items : [];
        document.title = `${list.title} · SeyirAtlası`;
        document.getElementById("sharedOwner").textContent = `${list.owner_name} paylaştı`;
        document.getElementById("sharedTitle").textContent = list.title;
        document.getElementById("sharedDescription").textContent = list.description || "SeyirAtlası'nda hazırlanmış kişisel seçki.";
        document.getElementById("sharedMeta").textContent = `${items.length} ${list.media_type === "movie" ? "film" : "dizi"}`;
        document.getElementById("sharedItems").innerHTML = items.length ? items.map((item) => {
            const title = item.title || item.name || "İsimsiz yapım"; const date = item.release_date || item.first_air_date || ""; const year = String(date).slice(0,4); const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "";
            const target = list.media_type === "movie" ? `index.html?film=${encodeURIComponent(item.id)}` : `series.html?dizi=${encodeURIComponent(item.id)}`;
            return `<a class="movie-card shared-list-card" href="${target}"><div class="movie-poster">${poster ? `<img src="${poster}" alt="${this.escape(title)} afişi" loading="lazy">` : `<span>✦</span>`}</div><div class="movie-info"><h3>${this.escape(title)}</h3><p>${this.escape(year)}</p></div></a>`;
        }).join("") : `<p class="library-empty">Bu liste henüz boş.</p>`;
        document.getElementById("sharedListLoading").hidden = true; document.getElementById("sharedListContent").hidden = false;
    }

    async copyLink() { try { await navigator.clipboard.writeText(location.href); this.feedback("Bağlantı kopyalandı."); } catch { this.feedback("Bağlantı kopyalanamadı.", true); } }

    async copyToAccount() {
        const button = document.getElementById("copySharedList"); button.disabled = true;
        try {
            const response = await fetch(`/api/lists/public/${encodeURIComponent(this.shareId)}/copy`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
            const data = await response.json();
            if (response.status === 401) { location.href = `profile.html?next=${encodeURIComponent(location.href)}`; return; }
            if (!response.ok) throw new Error(data.error || "Liste kopyalanamadı.");
            this.feedback(data.message); button.textContent = "Listene Eklendi";
        } catch (error) { this.feedback(error.message, true); button.disabled = false; }
    }

    feedback(message, error = false) { const node = document.getElementById("sharedFeedback"); node.textContent = message; node.classList.toggle("is-error", error); }
}
document.addEventListener("DOMContentLoaded", () => new SharedListPage());
