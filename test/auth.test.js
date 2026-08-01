import test from "node:test";
import assert from "node:assert/strict";
import { authTestHelpers } from "../auth.js";

const {
    normalizeEmail,
    validPassword,
    escapeEmailHtml,
    verificationEmail,
    passwordResetEmail,
    tokenHash
} = authTestHelpers;

const request = {
    headers: {
        host: "seyir-atlasi.onrender.com",
        "x-forwarded-proto": "https"
    }
};

test("e-posta adresini giriş için güvenli biçimde normalleştirir", () => {
    assert.equal(normalizeEmail("  Elif@Example.COM  "), "elif@example.com");
    assert.equal(normalizeEmail(null), "");
});

test("şifre güvenlik koşullarını eksiksiz uygular", () => {
    assert.equal(validPassword("Guvenli123"), true);
    assert.equal(validPassword("kucukharf123"), false, "büyük harf zorunlu");
    assert.equal(validPassword("BUYUKHARF123"), false, "küçük harf zorunlu");
    assert.equal(validPassword("GuvenliSifre"), false, "rakam zorunlu");
    assert.equal(validPassword("Kisa12a"), false, "en az 10 karakter zorunlu");
    assert.equal(validPassword(`A1${"a".repeat(127)}`), false, "128 karakter sınırı aşılmamalı");
});

test("HTML içine eklenen kullanıcı metnini kaçışlar", () => {
    assert.equal(escapeEmailHtml(`<img src=x onerror="alert('x')">`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;");
});

test("doğrulama e-postası markalı, güvenli ve doğru bağlantılıdır", () => {
    const link = "https://seyir-atlasi.onrender.com/api/auth/verify?token=test-token";
    const email = verificationEmail(request, { name: "Elif <script>" }, link);

    assert.match(email.subject, /SeyirAtlası/);
    assert.match(email.text, /24 saat/);
    assert.match(email.html, /images\/logo-email\.svg/);
    assert.match(email.html, /images\/email-stars\.svg/);
    assert.match(email.html, /E-posta adresimi doğrula/);
    assert.match(email.html, /Elif &lt;script&gt;/);
    assert.doesNotMatch(email.html, /Elif <script>/);
    assert.match(email.html, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("şifre yenileme e-postası doğrulama mailinden ayrılır", () => {
    const link = "https://seyir-atlasi.onrender.com/profile.html?reset=test-token";
    const email = passwordResetEmail(request, { name: "Elif" }, link);

    assert.match(email.subject, /şifreni yenile/i);
    assert.match(email.text, /1 saat/);
    assert.match(email.html, /Yeni şifre belirle/);
    assert.match(email.html, /yalnızca bir kez kullanılabilir/);
    assert.doesNotMatch(email.html, /E-posta adresimi doğrula/);
});

test("token değerlerini düz metin yerine sabit uzunlukta özetler", () => {
    const first = tokenHash("token-a");
    const second = tokenHash("token-b");
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.notEqual(first, second);
    assert.equal(first, tokenHash("token-a"));
});
