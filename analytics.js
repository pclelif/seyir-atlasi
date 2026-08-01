// Çerez, kalıcı tanımlayıcı veya üçüncü taraf analitik servisi kullanmaz.
// Sunucu yalnızca günlük toplam görüntüleme ve günlük tekil ziyaret tahmini tutar.
if (location.protocol === "http:" || location.protocol === "https:") {
    const payload = new Blob([], { type: "application/octet-stream" });
    if (!navigator.sendBeacon?.("/api/analytics/view", payload)) {
        fetch("/api/analytics/view", {
            method: "POST",
            credentials: "same-origin",
            keepalive: true
        }).catch(() => {});
    }
}
