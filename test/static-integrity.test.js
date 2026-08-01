import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = readdirSync(root).filter((file) => file.endsWith(".html"));

test("HTML sayfalarındaki yerel dosya referansları mevcuttur", () => {
    const missing = [];
    for (const file of htmlFiles) {
        const html = readFileSync(resolve(root, file), "utf8");
        for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
            const rawReference = match[1];
            if (/^(?:https?:|mailto:|#|data:|javascript:)/.test(rawReference)) continue;
            const reference = rawReference.split(/[?#]/)[0];
            if (reference && !reference.includes("${") && !existsSync(resolve(root, reference))) {
                missing.push(`${file}: ${rawReference}`);
            }
        }
    }
    assert.deepEqual(missing, []);
});

test("HTML sayfalarında yinelenen id bulunmaz", () => {
    const duplicates = [];
    for (const file of htmlFiles) {
        const html = readFileSync(resolve(root, file), "utf8");
        const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
        const seen = new Set();
        for (const id of ids) {
            if (seen.has(id)) duplicates.push(`${file}: ${id}`);
            seen.add(id);
        }
    }
    assert.deepEqual(duplicates, []);
});

test("e-posta görselleri dağıtıma dahildir", () => {
    assert.equal(existsSync(resolve(root, "images/logo-email.svg")), true);
    assert.equal(existsSync(resolve(root, "images/email-stars.svg")), true);
});
