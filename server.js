import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleAuth, initializeAuth } from "./auth.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const envPath = resolve(root, ".env");

try {
    const contents = await readFile(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (match && process.env[match[1]] === undefined) {
            process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
        }
    }
} catch {
    // Production environments normally provide variables without a .env file.
}

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "127.0.0.1";
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const rateBuckets = new Map();
const dataRateBuckets = new Map();
const authReady = await initializeAuth().catch((error) => {
    console.error("Veritabanı başlatılamadı:", error.message);
    return false;
});

const tmdbAllowedPaths = [
    /^\/genre\/(?:movie|tv)\/list$/,
    /^\/trending\/(?:movie|tv)\/week$/,
    /^\/discover\/(?:movie|tv)$/,
    /^\/search\/(?:movie|tv)$/,
    /^\/(?:movie|tv)\/\d+$/,
    /^\/(?:movie|tv)\/\d+\/(?:external_ids|similar)$/
];
const tmdbAllowedParameters = new Set([
    "append_to_response",
    "first_air_date_year",
    "include_adult",
    "include_video",
    "language",
    "page",
    "query",
    "region",
    "sort_by",
    "vote_count.gte",
    "with_genres",
    "year"
]);

const responseSchema = {
    type: "OBJECT",
    properties: {
        reply: {
            type: "STRING",
            description: "Kullanıcıya Türkçe, sıcak ve kısa danışman yanıtı."
        },
        recommendations: {
            type: "ARRAY",
            maxItems: 3,
            items: {
                type: "OBJECT",
                properties: {
                    title: { type: "STRING", description: "Filmin özgün veya uluslararası adı." },
                    year: { type: "INTEGER", description: "Filmin çıkış yılı." },
                    type: {
                        type: "STRING",
                        enum: ["film", "dizi"],
                        description: "Önerilen yapımın türü."
                    },
                    reason: { type: "STRING", description: "Bu kullanıcı için tek cümlelik gerekçe." }
                },
                required: ["title", "year", "type", "reason"]
            }
        }
    },
    required: ["reply", "recommendations"]
};

const systemInstruction = `Sen SeyirAtlası'nın "Pusula" adlı film danışmanısın.
Kullanıcıyla doğal Türkçe konuş. Önceki mesajları dikkate al, tercihlerindeki çelişkileri nazikçe netleştir.
Yeterli bilgi yoksa en fazla bir kısa soru sor ve recommendations dizisini boş bırak.
Yeterli bilgi varsa tam 3 gerçek yapım öner. Kullanıcının film/dizi tercihini kesinlikle uygula; "fark etmez" derse ikisini karıştırabilirsin. Aynı sohbet içinde aynı yapımı tekrarlama.
Spoiler verme. Her önerinin neden uygun olduğunu somut biçimde açıkla.
Yapım adını TMDB aramasında bulunabilecek özgün/uluslararası adıyla ve doğru çıkış yılıyla yaz.
Yanıtı 90 kelimeyi geçirmeden samimi tut.`;

function json(response, status, body) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(body));
}

async function readJson(request) {
    let raw = "";
    for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 20_000) throw new Error("İstek çok büyük.");
    }
    return JSON.parse(raw || "{}");
}

function isRateLimited(request) {
    const key = request.socket.remoteAddress || "local";
    const now = Date.now();
    const recent = (rateBuckets.get(key) || []).filter((time) => now - time < 60_000);
    recent.push(now);
    rateBuckets.set(key, recent);
    return recent.length > 12;
}

function isDataRateLimited(request) {
    const key = request.socket.remoteAddress || "local";
    const now = Date.now();
    const recent = (dataRateBuckets.get(key) || []).filter((time) => now - time < 60_000);
    recent.push(now);
    dataRateBuckets.set(key, recent);
    return recent.length > 300;
}

async function proxyJson(response, target, serviceName) {
    try {
        const upstream = await fetch(target, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15_000)
        });
        const body = await upstream.text();
        response.writeHead(upstream.status, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": upstream.ok ? "public, max-age=300" : "no-store"
        });
        return response.end(body);
    } catch (error) {
        console.error(`${serviceName}:`, error.message);
        return json(response, 502, {
            error: `${serviceName} servisine şu anda ulaşılamıyor.`
        });
    }
}

async function tmdb(request, response, requestUrl) {
    if (!process.env.TMDB_API_KEY) {
        return json(response, 503, {
            error: "TMDB_API_KEY sunucuda yapılandırılmadı."
        });
    }
    if (isDataRateLimited(request)) {
        return json(response, 429, {
            error: "Çok fazla veri isteği gönderildi. Lütfen biraz sonra tekrar deneyin."
        });
    }

    const path = requestUrl.searchParams.get("path") || "";
    if (!tmdbAllowedPaths.some((pattern) => pattern.test(path))) {
        return json(response, 400, { error: "Geçersiz TMDB yolu." });
    }

    const target = new URL(`https://api.themoviedb.org/3${path}`);
    target.searchParams.set("api_key", process.env.TMDB_API_KEY);
    target.searchParams.set("language", "tr-TR");
    target.searchParams.set("region", "TR");

    for (const [key, value] of requestUrl.searchParams) {
        if (key !== "path" && tmdbAllowedParameters.has(key) && value.length <= 500) {
            target.searchParams.set(key, value);
        }
    }

    return proxyJson(response, target, "TMDB");
}

async function omdb(request, response, requestUrl) {
    if (!process.env.OMDB_API_KEY) {
        return json(response, 503, {
            error: "OMDB_API_KEY sunucuda yapılandırılmadı."
        });
    }
    if (isDataRateLimited(request)) {
        return json(response, 429, {
            error: "Çok fazla veri isteği gönderildi. Lütfen biraz sonra tekrar deneyin."
        });
    }

    const imdbId = requestUrl.searchParams.get("i");
    const title = requestUrl.searchParams.get("t");
    if ((!imdbId && !title) || (imdbId && !/^tt\d{5,12}$/.test(imdbId))) {
        return json(response, 400, { error: "Geçersiz OMDb sorgusu." });
    }

    const target = new URL("https://www.omdbapi.com/");
    target.searchParams.set("apikey", process.env.OMDB_API_KEY);
    for (const key of ["i", "t", "type", "y", "plot"]) {
        const value = requestUrl.searchParams.get(key);
        if (value && value.length <= 300) target.searchParams.set(key, value);
    }

    return proxyJson(response, target, "OMDb");
}

async function pusula(request, response) {
    if (!process.env.GEMINI_API_KEY) {
        return json(response, 503, {
            error: "Pusula henüz yapılandırılmadı. Sunucudaki .env dosyasına GEMINI_API_KEY eklenmeli."
        });
    }
    if (isRateLimited(request)) {
        return json(response, 429, { error: "Biraz hızlı gidiyoruz; lütfen bir dakika sonra tekrar dene." });
    }

    try {
        const body = await readJson(request);
        const message = String(body.message || "").trim().slice(0, 600);
        const preferences = body.preferences && typeof body.preferences === "object"
            ? body.preferences
            : {};
        const preferenceLabels = {
            type: "Yapım türü",
            duration: "Süre",
            company: "İzleme ortamı",
            need: "Bugünkü ihtiyaç"
        };
        const preferenceText = Object.entries(preferenceLabels)
            .filter(([key]) => preferences[key])
            .map(([key, label]) => `${label}: ${String(preferences[key]).slice(0, 100)}`)
            .join("\n");

        const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
        const contents = history
            .filter((item) => ["user", "model"].includes(item?.role) && item?.text)
            .map((item) => ({
                role: item.role,
                parts: [{ text: String(item.text).slice(0, 1200) }]
            }));
        contents.push({
            role: "user",
            parts: [{
                text: [
                    preferenceText ? `Seçimlerim:\n${preferenceText}` : "",
                    message ? `Ek olarak: ${message}` : "",
                    !preferenceText && !message
                        ? "Şu an ne izleyeceğime karar veremedim. Film veya dizi olabilir; birbirinden farklı, güçlü üç sürpriz öneriyle bana bir rota çiz."
                        : ""
                ].filter(Boolean).join("\n\n")
            }]
        });

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
        const geminiResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema,
                    maxOutputTokens: 700
                }
            })
        });

        const geminiData = await geminiResponse.json();
        if (!geminiResponse.ok) {
            console.error("Gemini API:", geminiData?.error?.message || geminiResponse.status);
            return json(response, 502, { error: "Pusula şu anda yanıt veremiyor. Lütfen biraz sonra tekrar dene." });
        }

        const text = geminiData.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || "")
            .join("");
        const result = JSON.parse(text);
        return json(response, 200, {
            reply: String(result.reply || "Biraz daha ipucu verir misin?"),
            recommendations: Array.isArray(result.recommendations)
                ? result.recommendations.slice(0, 3)
                : []
        });
    } catch (error) {
        console.error("Pusula:", error.message);
        return json(response, 400, { error: "Mesaj işlenemedi. Lütfen tekrar dene." });
    }
}

const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
};

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const origin = request.headers.origin;
    if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Vary", "Origin");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    if (url.pathname.startsWith("/api/auth/") && authReady) {
        return handleAuth(request, response, url);
    }
    if (url.pathname.startsWith("/api/auth/")) {
        return json(response, 503, { error: "Hesap sistemi henüz yapılandırılmadı." });
    }
    if (request.method === "OPTIONS" && url.pathname === "/api/pusula") {
        response.writeHead(204);
        return response.end();
    }
    if (request.method === "POST" && url.pathname === "/api/pusula") {
        return pusula(request, response);
    }
    if (request.method === "GET" && url.pathname === "/api/tmdb") {
        return tmdb(request, response, url);
    }
    if (request.method === "GET" && url.pathname === "/api/omdb") {
        return omdb(request, response, url);
    }
    if (!["GET", "HEAD"].includes(request.method)) {
        return json(response, 405, { error: "Bu yöntem desteklenmiyor." });
    }

    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const filePath = resolve(root, requested);
    const privateFiles = new Set(["server.js", "auth.js", "package.json", "package-lock.json", "README.md"]);
    if (
        !filePath.startsWith(root + sep) ||
        requested.startsWith(".") ||
        privateFiles.has(requested)
    ) {
        response.writeHead(403);
        return response.end("Forbidden");
    }

    try {
        const file = await readFile(filePath);
        response.writeHead(200, {
            "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
            "Cache-Control": "no-cache"
        });
        response.end(request.method === "HEAD" ? undefined : file);
    } catch {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Sayfa bulunamadı.");
    }
});

server.listen(port, host, () => {
    console.log(`SeyirAtlası http://${host}:${port} adresinde hazır.`);
});
