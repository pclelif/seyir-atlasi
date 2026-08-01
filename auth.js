import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import nodemailer from "nodemailer";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;
const SESSION_COOKIE = "seyir_atlasi_session";
const TOKEN_TTL = { verify: 24 * 60 * 60 * 1000, reset: 60 * 60 * 1000, session: 30 * 24 * 60 * 60 * 1000 };
const allowedAvatar = /^images\/avatar\/(?:[1-9]|1\d|2[01])\.svg$/;

let pool;
let mailer;
const attempts = new Map();

function rateLimited(request) {
    const key = request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.socket.remoteAddress || "local";
    const now = Date.now();
    const recent = (attempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
    recent.push(now);
    attempts.set(key, recent);
    return recent.length > 30;
}

function reply(response, status, body, headers = {}) {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
    response.end(JSON.stringify(body));
}

async function body(request, maxBytes = 30_000) {
    let raw = "";
    for await (const chunk of request) {
        raw += chunk;
        if (raw.length > maxBytes) throw new Error("İstek çok büyük.");
    }
    return JSON.parse(raw || "{}");
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function publicUser(row) {
    return { id: row.id, name: row.name, email: row.email, avatar: row.avatar, emailVerified: Boolean(row.email_verified_at), createdAt: row.created_at };
}

function tokenHash(token) {
    return createHash("sha256").update(token).digest("hex");
}

async function passwordHash(password) {
    const salt = randomBytes(16).toString("hex");
    const derived = await scrypt(password, salt, 64);
    return `scrypt:${salt}:${Buffer.from(derived).toString("hex")}`;
}

async function passwordMatches(password, stored) {
    const [algorithm, salt, expectedHex] = String(stored).split(":");
    if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
    const actual = Buffer.from(await scrypt(password, salt, 64));
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validPassword(password) {
    return password.length >= 10 && password.length <= 128 && /[A-ZÇĞİÖŞÜ]/.test(password) && /[a-zçğıöşü]/.test(password) && /\d/.test(password);
}

function cookies(request) {
    return Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => part.trim().split(/=(.*)/s)).filter(([key]) => key).map(([key, value]) => [key, decodeURIComponent(value || "")]));
}

function cookieHeader(token, request, maxAge = Math.floor(TOKEN_TTL.session / 1000)) {
    const secure = request.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function appUrl(request) {
    const configured = String(process.env.APP_URL || "").replace(/\/$/, "");
    if (configured) return configured;
    const protocol = request.headers["x-forwarded-proto"] || "http";
    return `${protocol}://${request.headers.host}`;
}

function sameOrigin(request) {
    const origin = request.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === request.headers.host; } catch { return false; }
}

async function sendMail(to, subject, text, html) {
    if (process.env.BREVO_API_KEY && process.env.MAIL_FROM) {
        const fromMatch = String(process.env.MAIL_FROM).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
        const sender = fromMatch
            ? { name: fromMatch[1] || "SeyirAtlası", email: fromMatch[2] }
            : { name: "SeyirAtlası", email: String(process.env.MAIL_FROM).trim() };
        const upstream = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "api-key": process.env.BREVO_API_KEY
            },
            body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
            signal: AbortSignal.timeout(15_000)
        });
        if (!upstream.ok) {
            const errorBody = await upstream.text();
            throw new Error(`Brevo API ${upstream.status}: ${errorBody.slice(0, 300)}`);
        }
        return true;
    }
    if (!mailer || !process.env.MAIL_FROM) {
        if (process.env.NODE_ENV !== "production") console.log(`[E-posta geliştirme modu] ${to}: ${text}`);
        return false;
    }
    await mailer.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
    return true;
}

function emailConfigured() {
    return Boolean(process.env.MAIL_FROM && (process.env.BREVO_API_KEY || mailer));
}

async function createPurposeToken(userId, purpose) {
    const token = randomBytes(32).toString("base64url");
    await pool.query("DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2", [userId, purpose]);
    await pool.query("INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)", [userId, tokenHash(token), purpose, new Date(Date.now() + TOKEN_TTL[purpose])]);
    return token;
}

async function currentUser(request) {
    const token = cookies(request)[SESSION_COOKIE];
    if (!token) return null;
    const result = await pool.query(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()`, [tokenHash(token)]);
    return result.rows[0] || null;
}

export async function initializeAuth() {
    if (!process.env.DATABASE_URL) {
        console.warn("DATABASE_URL tanımlı değil; hesap API'si devre dışı.");
        return false;
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }, max: 10 });
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(80) NOT NULL,
            email VARCHAR(254) NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            avatar VARCHAR(80) NOT NULL DEFAULT 'images/avatar/1.svg',
            email_verified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id BIGSERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash CHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS auth_tokens (
            id BIGSERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash CHAR(64) NOT NULL UNIQUE,
            purpose VARCHAR(12) NOT NULL CHECK (purpose IN ('verify', 'reset')),
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS auth_tokens_lookup_idx ON auth_tokens(token_hash, purpose);
        CREATE TABLE IF NOT EXISTS user_libraries (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            media_type VARCHAR(8) NOT NULL CHECK (media_type IN ('movie', 'tv')),
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, media_type)
        );
        CREATE TABLE IF NOT EXISTS shared_lists (
            id BIGSERIAL PRIMARY KEY,
            share_id VARCHAR(24) NOT NULL UNIQUE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            media_type VARCHAR(8) NOT NULL CHECK (media_type IN ('movie', 'tv')),
            title VARCHAR(80) NOT NULL,
            description VARCHAR(240) NOT NULL DEFAULT '',
            items JSONB NOT NULL DEFAULT '[]'::jsonb,
            ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
            is_public BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS shared_lists_user_id_idx ON shared_lists(user_id);
    `);
    if (process.env.SMTP_HOST) {
        mailer = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 15_000
        });
    }
    return true;
}

function cleanLibrary(value, mediaType) {
    const data = value && typeof value === "object" ? value : {};
    const cleanObject = (item) => item && typeof item === "object" && !Array.isArray(item) ? item : {};
    const result = {
        favorites: cleanObject(data.favorites),
        watchlist: cleanObject(data.watchlist),
        watched: cleanObject(data.watched),
        customLists: cleanObject(data.customLists)
    };
    if (mediaType === "movie") result.ratings = cleanObject(data.ratings);
    return result;
}

export async function handleLibrary(request, response, url) {
    if (!pool) { reply(response, 503, { error: "Veritabanı hazır değil." }); return true; }
    try {
        const publicMatch = url.pathname.match(/^\/api\/lists\/public\/([A-Za-z0-9_-]{8,24})$/);
        if (request.method === "GET" && publicMatch) {
            const result = await pool.query(`SELECT s.share_id, s.media_type, s.title, s.description, s.items, s.ratings, s.updated_at, u.name AS owner_name, u.avatar AS owner_avatar FROM shared_lists s JOIN users u ON u.id=s.user_id WHERE s.share_id=$1 AND s.is_public=TRUE`, [publicMatch[1]]);
            if (!result.rowCount) return reply(response, 404, { error: "Paylaşılan liste bulunamadı." }), true;
            return reply(response, 200, { list: result.rows[0] }), true;
        }
        if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request)) return reply(response, 403, { error: "Geçersiz istek kaynağı." }), true;
        const user = await currentUser(request);
        if (!user) return reply(response, 401, { error: "Oturum süresi dolmuş." }), true;

        if (url.pathname === "/api/library" && request.method === "GET") {
            const mediaType = url.searchParams.get("type");
            if (!['movie', 'tv'].includes(mediaType)) return reply(response, 400, { error: "Geçersiz medya türü." }), true;
            const result = await pool.query("SELECT data, updated_at FROM user_libraries WHERE user_id=$1 AND media_type=$2", [user.id, mediaType]);
            return reply(response, 200, result.rowCount ? { exists: true, library: result.rows[0].data, updatedAt: result.rows[0].updated_at } : { exists: false, library: null }), true;
        }
        if (url.pathname === "/api/library" && request.method === "PUT") {
            const data = await body(request, 2_500_000); const mediaType = String(data.type || "");
            if (!['movie', 'tv'].includes(mediaType)) return reply(response, 400, { error: "Geçersiz medya türü." }), true;
            const library = cleanLibrary(data.library, mediaType);
            if (JSON.stringify(library).length > 2_000_000) return reply(response, 413, { error: "Koleksiyon çok büyük." }), true;
            await pool.query(`INSERT INTO user_libraries(user_id,media_type,data) VALUES($1,$2,$3) ON CONFLICT(user_id,media_type) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`, [user.id, mediaType, library]);
            return reply(response, 200, { message: "Koleksiyon eşitlendi." }), true;
        }
        if (url.pathname === "/api/lists/share" && request.method === "POST") {
            const data = await body(request, 2_500_000); const mediaType = String(data.type || ""); const title = String(data.title || "").trim().slice(0,80); const description = String(data.description || "").trim().slice(0,240); const items = Array.isArray(data.items) ? data.items.slice(0,500) : [];
            if (!['movie','tv'].includes(mediaType) || !title) return reply(response,400,{error:"Liste bilgileri geçersiz."}),true;
            const shareId = randomBytes(9).toString("base64url");
            await pool.query("INSERT INTO shared_lists(share_id,user_id,media_type,title,description,items,ratings) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)", [shareId,user.id,mediaType,title,description,JSON.stringify(items),JSON.stringify(cleanLibrary({ratings:data.ratings},'movie').ratings)]);
            return reply(response,201,{ shareId, url:`${appUrl(request)}/shared-list.html?id=${shareId}` }),true;
        }
        if (url.pathname === "/api/lists/shares" && request.method === "GET") {
            const result = await pool.query("SELECT share_id,media_type,title,description,jsonb_array_length(items) AS item_count,created_at,updated_at FROM shared_lists WHERE user_id=$1 AND is_public=TRUE ORDER BY updated_at DESC",[user.id]);
            return reply(response,200,{shares:result.rows.map(row=>({...row,url:`${appUrl(request)}/shared-list.html?id=${row.share_id}`}))}),true;
        }
        const revokeMatch=url.pathname.match(/^\/api\/lists\/share\/([A-Za-z0-9_-]{8,24})$/);
        if (request.method === "DELETE" && revokeMatch) {
            const result=await pool.query("UPDATE shared_lists SET is_public=FALSE,updated_at=NOW() WHERE share_id=$1 AND user_id=$2 AND is_public=TRUE RETURNING id",[revokeMatch[1],user.id]);
            if(!result.rowCount) return reply(response,404,{error:"Paylaşım bulunamadı."}),true;
            return reply(response,200,{message:"Paylaşım bağlantısı kapatıldı."}),true;
        }
        if (publicMatch && request.method === "POST" && url.pathname.endsWith("/copy")) return reply(response,404,{error:"Uç nokta bulunamadı."}),true;
        const copyMatch = url.pathname.match(/^\/api\/lists\/public\/([A-Za-z0-9_-]{8,24})\/copy$/);
        if (request.method === "POST" && copyMatch) {
            const shared = await pool.query("SELECT * FROM shared_lists WHERE share_id=$1 AND is_public=TRUE",[copyMatch[1]]);
            if (!shared.rowCount) return reply(response,404,{error:"Paylaşılan liste bulunamadı."}),true;
            const item=shared.rows[0]; const current=await pool.query("SELECT data FROM user_libraries WHERE user_id=$1 AND media_type=$2",[user.id,item.media_type]); const library=cleanLibrary(current.rows[0]?.data,item.media_type); const id=randomBytes(9).toString("base64url"); const collection=Object.fromEntries((item.items||[]).map(entry=>[String(entry.id),entry]));
            library.customLists[id]={id,name:`${item.title} (kopya)`,description:item.description,[item.media_type==='movie'?'movies':'series']:collection,created_at:new Date().toISOString()};
            await pool.query(`INSERT INTO user_libraries(user_id,media_type,data) VALUES($1,$2,$3) ON CONFLICT(user_id,media_type) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`,[user.id,item.media_type,library]);
            return reply(response,201,{message:"Liste hesabına kopyalandı.",type:item.media_type}),true;
        }
        reply(response,404,{error:"Uç nokta bulunamadı."}); return true;
    } catch (error) { console.error("Library:",error.message); reply(response,500,{error:"Liste işlemi tamamlanamadı."}); return true; }
}

export async function handleAuth(request, response, url) {
    if (!url.pathname.startsWith("/api/auth/")) return false;
    if (!pool) { reply(response, 503, { error: "Hesap sistemi henüz yapılandırılmadı." }); return true; }
    if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request)) { reply(response, 403, { error: "Geçersiz istek kaynağı." }); return true; }
    if (!["GET", "HEAD"].includes(request.method) && rateLimited(request)) { reply(response, 429, { error: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene." }); return true; }

    try {
        if (request.method === "GET" && url.pathname === "/api/auth/status") {
            return reply(response, 200, {
                database: "ready",
                email: process.env.BREVO_API_KEY ? "brevo" : mailer ? "smtp" : "missing",
                sender: process.env.MAIL_FROM ? "configured" : "missing"
            }), true;
        }
        if (request.method === "POST" && url.pathname === "/api/auth/register") {
            if (!emailConfigured()) return reply(response, 503, { error: "E-posta servisi henüz yapılandırılmadı." }), true;
            const data = await body(request); const name = String(data.name || "").trim().replace(/\s+/g, " "); const email = normalizeEmail(data.email); const password = String(data.password || "");
            if (name.length < 2 || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || !validPassword(password)) return reply(response, 400, { error: "Bilgileri ve şifre koşullarını kontrol et." }), true;
            const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
            if (existing.rowCount) return reply(response, 409, { error: "Bu e-posta adresi zaten kayıtlı." }), true;
            const result = await pool.query("INSERT INTO users(name, email, password_hash) VALUES($1,$2,$3) RETURNING *", [name, email, await passwordHash(password)]);
            const token = await createPurposeToken(result.rows[0].id, "verify"); const link = `${appUrl(request)}/api/auth/verify?token=${encodeURIComponent(token)}`;
            await sendMail(email, "SeyirAtlası e-posta doğrulama", `E-posta adresini doğrula: ${link}`, `<h2>SeyirAtlası'na hoş geldin</h2><p>Hesabını etkinleştirmek için aşağıdaki bağlantıyı kullan:</p><p><a href="${link}">E-posta adresimi doğrula</a></p><p>Bağlantı 24 saat geçerlidir.</p>`);
            return reply(response, 201, { message: "Hesabın oluşturuldu. E-postana gönderdiğimiz bağlantıyla hesabını doğrula.", emailSent: true }), true;
        }
        if (request.method === "POST" && url.pathname === "/api/auth/login") {
            const data = await body(request); const result = await pool.query("SELECT * FROM users WHERE email = $1", [normalizeEmail(data.email)]); const user = result.rows[0];
            if (!user || !(await passwordMatches(String(data.password || ""), user.password_hash))) return reply(response, 401, { error: "E-posta veya şifre hatalı." }), true;
            if (!user.email_verified_at) return reply(response, 403, { error: "Giriş yapmadan önce e-posta adresini doğrulamalısın.", code: "EMAIL_NOT_VERIFIED" }), true;
            const token = randomBytes(32).toString("base64url"); const ttl = data.remember ? TOKEN_TTL.session : 24 * 60 * 60 * 1000;
            await pool.query("INSERT INTO sessions(user_id, token_hash, expires_at) VALUES($1,$2,$3)", [user.id, tokenHash(token), new Date(Date.now() + ttl)]);
            return reply(response, 200, { user: publicUser(user) }, { "Set-Cookie": cookieHeader(token, request, Math.floor(ttl / 1000)) }), true;
        }
        if (request.method === "POST" && url.pathname === "/api/auth/logout") {
            const token = cookies(request)[SESSION_COOKIE]; if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
            return reply(response, 200, { message: "Oturum kapatıldı." }, { "Set-Cookie": cookieHeader("", request, 0) }), true;
        }
        if (request.method === "GET" && url.pathname === "/api/auth/me") {
            const user = await currentUser(request); return reply(response, user ? 200 : 401, user ? { user: publicUser(user) } : { error: "Oturum bulunamadı." }), true;
        }
        if (request.method === "PATCH" && url.pathname === "/api/auth/profile") {
            const user = await currentUser(request); if (!user) return reply(response, 401, { error: "Oturum süresi dolmuş." }), true;
            const data = await body(request); const name = String(data.name || "").trim().replace(/\s+/g, " "); const avatar = String(data.avatar || "");
            if (name.length < 2 || name.length > 80 || !allowedAvatar.test(avatar)) return reply(response, 400, { error: "Profil bilgileri geçersiz." }), true;
            const result = await pool.query("UPDATE users SET name=$1, avatar=$2, updated_at=NOW() WHERE id=$3 RETURNING *", [name, avatar, user.id]);
            return reply(response, 200, { user: publicUser(result.rows[0]) }), true;
        }
        if (request.method === "POST" && url.pathname === "/api/auth/change-password") {
            const user = await currentUser(request); if (!user) return reply(response, 401, { error: "Oturum süresi dolmuş." }), true;
            const data = await body(request); const nextPassword = String(data.newPassword || "");
            if (!(await passwordMatches(String(data.currentPassword || ""), user.password_hash))) return reply(response, 401, { error: "Mevcut şifren hatalı." }), true;
            if (!validPassword(nextPassword)) return reply(response, 400, { error: "Yeni şifre güvenlik koşullarını karşılamıyor." }), true;
            await pool.query("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", [await passwordHash(nextPassword), user.id]);
            await pool.query("DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2", [user.id, tokenHash(cookies(request)[SESSION_COOKIE] || "")]);
            return reply(response, 200, { message: "Şifren güncellendi; diğer cihazlardaki oturumlar kapatıldı." }), true;
        }
        if (request.method === "DELETE" && url.pathname === "/api/auth/account") {
            const user = await currentUser(request); if (!user) return reply(response, 401, { error: "Oturum süresi dolmuş." }), true;
            const data = await body(request);
            if (!(await passwordMatches(String(data.password || ""), user.password_hash))) return reply(response, 401, { error: "Şifren hatalı; hesap silinmedi." }), true;
            await pool.query("DELETE FROM users WHERE id=$1", [user.id]);
            return reply(response, 200, { message: "Hesabın kalıcı olarak silindi." }, { "Set-Cookie": cookieHeader("", request, 0) }), true;
        }
        if (request.method === "POST" && url.pathname === "/api/auth/resend-verification") {
            if (!emailConfigured()) return reply(response, 503, { error: "E-posta servisi henüz yapılandırılmadı." }), true;
            const data = await body(request); const result = await pool.query("SELECT * FROM users WHERE email=$1", [normalizeEmail(data.email)]); const user = result.rows[0];
            if (user && !user.email_verified_at) { const token = await createPurposeToken(user.id, "verify"); const link = `${appUrl(request)}/api/auth/verify?token=${encodeURIComponent(token)}`; await sendMail(user.email, "SeyirAtlası e-posta doğrulama", `E-posta adresini doğrula: ${link}`, `<p><a href="${link}">E-posta adresimi doğrula</a></p>`); }
            return reply(response, 200, { message: "Adres kayıtlıysa doğrulama e-postası gönderildi." }), true;
        }
        if (request.method === "GET" && url.pathname === "/api/auth/verify") {
            const result = await pool.query("UPDATE auth_tokens SET used_at=NOW() WHERE token_hash=$1 AND purpose='verify' AND used_at IS NULL AND expires_at>NOW() RETURNING user_id", [tokenHash(url.searchParams.get("token") || "")]);
            if (result.rowCount) await pool.query("UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW()), updated_at=NOW() WHERE id=$1", [result.rows[0].user_id]);
            response.writeHead(303, { Location: `/profile.html?verified=${result.rowCount ? "1" : "0"}` }); response.end(); return true;
        }
        if (request.method === "POST" && url.pathname === "/api/auth/forgot-password") {
            if (!emailConfigured()) return reply(response, 503, { error: "E-posta servisi henüz yapılandırılmadı." }), true;
            const data = await body(request); const result = await pool.query("SELECT * FROM users WHERE email=$1", [normalizeEmail(data.email)]); const user = result.rows[0];
            if (user) { const token = await createPurposeToken(user.id, "reset"); const link = `${appUrl(request)}/profile.html?reset=${encodeURIComponent(token)}`; await sendMail(user.email, "SeyirAtlası şifre yenileme", `Şifreni yenile: ${link}`, `<p><a href="${link}">Yeni şifre belirle</a></p><p>Bağlantı 1 saat geçerlidir.</p>`); }
            return reply(response, 200, { message: "Adres kayıtlıysa şifre yenileme e-postası gönderildi." }), true;
        }
        if (request.method === "POST" && url.pathname === "/api/auth/reset-password") {
            const data = await body(request); const password = String(data.password || ""); if (!validPassword(password)) return reply(response, 400, { error: "Yeni şifre güvenlik koşullarını karşılamıyor." }), true;
            const client = await pool.connect(); try { await client.query("BEGIN"); const result = await client.query("UPDATE auth_tokens SET used_at=NOW() WHERE token_hash=$1 AND purpose='reset' AND used_at IS NULL AND expires_at>NOW() RETURNING user_id", [tokenHash(String(data.token || ""))]); if (!result.rowCount) { await client.query("ROLLBACK"); return reply(response, 400, { error: "Şifre yenileme bağlantısı geçersiz veya süresi dolmuş." }), true; } await client.query("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", [await passwordHash(password), result.rows[0].user_id]); await client.query("DELETE FROM sessions WHERE user_id=$1", [result.rows[0].user_id]); await client.query("COMMIT"); } finally { client.release(); }
            return reply(response, 200, { message: "Şifren yenilendi. Şimdi giriş yapabilirsin." }), true;
        }
        reply(response, 404, { error: "Uç nokta bulunamadı." }); return true;
    } catch (error) {
        console.error("Auth:", error.message); reply(response, 500, { error: "İşlem şu anda tamamlanamadı." }); return true;
    }
}
