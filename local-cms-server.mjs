import { createServer } from "node:http";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { URL } from "node:url";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || "5500");
const rootDir = process.cwd();

const overridesFile = path.join(rootDir, "assets", "data", "overrides.json");
const authDir = path.join(rootDir, ".hardware-cms");
const usersFile = path.join(authDir, "users.json");

const adminRoute = "/cyber/";
const adminTemplateFile = path.join(rootDir, "admin.html");
const sessionCookieName = "hardware_admin_session";
const sessionTtlMs = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();

function createBootstrapAdminSeed() {
    const configuredEmail = String(process.env.HARDWARE_ADMIN_EMAIL || "").trim().toLowerCase();
    const configuredPassword = String(process.env.HARDWARE_ADMIN_PASSWORD || "").trim();
    const generatedPassword = "HW-" + randomBytes(12).toString("base64url");
    const email = configuredEmail || "admin@hardware.local";
    const password = configuredPassword || generatedPassword;
    const hashed = hashPassword(password);
    const nowIso = new Date().toISOString();

    if (!configuredPassword) {
        console.log(`[hardware-cms] bootstrap admin generated`);
        console.log(`[hardware-cms] email: ${email}`);
        console.log(`[hardware-cms] password: ${password}`);
        console.log(`[hardware-cms] dica: defina HARDWARE_ADMIN_EMAIL e HARDWARE_ADMIN_PASSWORD no ambiente para controlar a credencial inicial.`);
    }

    return {
        id: "bootstrap-admin",
        email: email,
        role: "admin",
        active: true,
        salt: hashed.salt,
        passwordHash: hashed.passwordHash,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: ""
    };
}

const seedUsers = [createBootstrapAdminSeed()];

function normalizeOverrides(rawValue) {
    const base = typeof rawValue === "object" && rawValue ? rawValue : {};
    return {
        meta: typeof base.meta === "object" && base.meta ? base.meta : {},
        toggles: typeof base.toggles === "object" && base.toggles ? base.toggles : {},
        fields: typeof base.fields === "object" && base.fields ? base.fields : {},
        links: typeof base.links === "object" && base.links ? base.links : {},
        media: typeof base.media === "object" && base.media ? base.media : {},
        translations: typeof base.translations === "object" && base.translations ? base.translations : {}
    };
}

function ensureOverridesFile() {
    const dir = path.dirname(overridesFile);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(overridesFile)) {
        writeFileSync(overridesFile, JSON.stringify(normalizeOverrides({}), null, 2), "utf8");
    }
}

function readOverrides() {
    ensureOverridesFile();
    try {
        const raw = readFileSync(overridesFile, "utf8");
        return normalizeOverrides(JSON.parse(raw));
    } catch (_) {
        const fallback = normalizeOverrides({});
        writeFileSync(overridesFile, JSON.stringify(fallback, null, 2), "utf8");
        return fallback;
    }
}

function writeOverrides(payload) {
    ensureOverridesFile();
    const normalized = normalizeOverrides(payload);
    writeFileSync(overridesFile, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        ...extraHeaders
    });
    res.end(body);
}

function sendHtmlFile(res, filePath) {
    if (!existsSync(filePath)) {
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
    }
    const stats = statSync(filePath);
    res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": stats.size,
        "Last-Modified": stats.mtime.toUTCString(),
        "Cache-Control": "no-store, max-age=0"
    });
    createReadStream(filePath).pipe(res);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => {
            raw += chunk;
            if (raw.length > 32_000_000) {
                reject(new Error("payload_too_large"));
                req.destroy();
            }
        });
        req.on("end", () => {
            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch (_) {
                reject(new Error("invalid_json"));
            }
        });
        req.on("error", reject);
    });
}

function sanitizeFilename(name) {
    const base = String(name || "upload").trim().replace(/[^\w.\-]+/g, "_");
    return base || "upload";
}

function extFromMime(mimeType) {
    const mime = String(mimeType || "").toLowerCase();
    if (mime === "image/jpeg") return ".jpg";
    if (mime === "image/png") return ".png";
    if (mime === "image/webp") return ".webp";
    if (mime === "image/gif") return ".gif";
    if (mime === "image/svg+xml") return ".svg";
    return "";
}

function ensureExt(fileName, fallbackExt) {
    const ext = path.extname(fileName || "");
    if (ext) return fileName;
    return String(fileName || "upload") + (fallbackExt || ".jpg");
}

function resolveUploadRelativePath(mediaKey, fileName, mimeType) {
    const safeName = ensureExt(sanitizeFilename(fileName), extFromMime(mimeType));
    const key = String(mediaKey || "");
    const djMatch = key.match(/^dj(\d+)(Photo|Logo)$/i);
    if (djMatch) {
        const folder = `assets/djs/dj${djMatch[1]}`;
        return path.posix.join(folder, safeName);
    }
    return path.posix.join("assets", "uploads", safeName);
}

function parseDataUrl(dataUrl) {
    const raw = String(dataUrl || "");
    const match = raw.match(/^data:([^;,]+);base64,([a-zA-Z0-9+/=]+)$/);
    if (!match) return null;
    return {
        mimeType: String(match[1] || "").toLowerCase(),
        base64: match[2] || ""
    };
}

function writeUploadedImage(payload) {
    const parsed = parseDataUrl(payload && payload.dataUrl);
    if (!parsed) return { ok: false, error: "invalid_data_url" };
    if (!/^image\//i.test(parsed.mimeType)) return { ok: false, error: "unsupported_media_type" };

    const buffer = Buffer.from(parsed.base64, "base64");
    if (!buffer.length) return { ok: false, error: "empty_upload" };
    if (buffer.length > 12_000_000) return { ok: false, error: "file_too_large" };

    const relativePath = resolveUploadRelativePath(payload && payload.mediaKey, payload && payload.filename, parsed.mimeType);
    const absolutePath = path.join(rootDir, relativePath);
    if (!absolutePath.startsWith(rootDir)) return { ok: false, error: "forbidden_path" };

    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, buffer);

    return {
        ok: true,
        path: relativePath.replace(/\\/g, "/"),
        size: buffer.length
    };
}

function safePathFromRequest(urlPath) {
    const decoded = decodeURIComponent(urlPath);
    const withoutQuery = decoded.split("?")[0];
    return path.normalize(withoutQuery).replace(/^(\.\.[/\\])+/, "");
}

function contentTypeByExt(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".html") return "text/html; charset=utf-8";
    if (ext === ".css") return "text/css; charset=utf-8";
    if (ext === ".js") return "application/javascript; charset=utf-8";
    if (ext === ".json") return "application/json; charset=utf-8";
    if (ext === ".svg") return "image/svg+xml";
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".ico") return "image/x-icon";
    if (ext === ".mp4") return "video/mp4";
    if (ext === ".webm") return "video/webm";
    if (ext === ".ogg") return "video/ogg";
    return "application/octet-stream";
}

function ensureAuthStore() {
    if (!existsSync(authDir)) mkdirSync(authDir, { recursive: true });
    if (!existsSync(usersFile)) {
        writeFileSync(usersFile, JSON.stringify({ version: 1, users: seedUsers }, null, 2), "utf8");
    }
}

function normalizeUserRecord(rawUser) {
    const base = typeof rawUser === "object" && rawUser ? rawUser : {};
    const role = String(base.role || "editor").toLowerCase();
    const safeRole = role === "admin" || role === "viewer" ? role : "editor";
    return {
        id: String(base.id || createHash("sha1").update(String(base.email || randomBytes(8).toString("hex"))).digest("hex").slice(0, 16)),
        email: String(base.email || "").trim().toLowerCase(),
        role: safeRole,
        active: base.active !== false,
        salt: String(base.salt || ""),
        passwordHash: String(base.passwordHash || ""),
        createdAt: String(base.createdAt || new Date().toISOString()),
        updatedAt: String(base.updatedAt || new Date().toISOString()),
        lastLoginAt: String(base.lastLoginAt || "")
    };
}

function readUserStore() {
    ensureAuthStore();
    try {
        const raw = JSON.parse(readFileSync(usersFile, "utf8"));
        const users = Array.isArray(raw.users) ? raw.users.map(normalizeUserRecord).filter((user) => user.email) : [];
        if (!users.length) {
            writeFileSync(usersFile, JSON.stringify({ version: 1, users: seedUsers }, null, 2), "utf8");
            return { version: 1, users: seedUsers.map(normalizeUserRecord) };
        }
        return { version: 1, users };
    } catch (_) {
        writeFileSync(usersFile, JSON.stringify({ version: 1, users: seedUsers }, null, 2), "utf8");
        return { version: 1, users: seedUsers.map(normalizeUserRecord) };
    }
}

function writeUserStore(nextUsers) {
    ensureAuthStore();
    const users = Array.isArray(nextUsers) ? nextUsers.map(normalizeUserRecord) : [];
    writeFileSync(usersFile, JSON.stringify({ version: 1, users }, null, 2), "utf8");
    return users;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
    const passwordHash = scryptSync(String(password || ""), salt, 64).toString("hex");
    return { salt, passwordHash };
}

function verifyPassword(password, user) {
    if (!user || !user.salt || !user.passwordHash) return false;
    const candidate = scryptSync(String(password || ""), user.salt, 64);
    const expected = Buffer.from(String(user.passwordHash || ""), "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
}

function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt || ""
    };
}

function parseCookies(req) {
    const header = String(req.headers.cookie || "");
    const items = header.split(";").map((chunk) => chunk.trim()).filter(Boolean);
    const out = {};
    items.forEach((item) => {
        const index = item.indexOf("=");
        if (index <= 0) return;
        const key = item.slice(0, index).trim();
        const value = item.slice(index + 1).trim();
        out[key] = decodeURIComponent(value);
    });
    return out;
}

function buildCookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    parts.push(`Path=${options.path || "/"}`);
    if (options.httpOnly !== false) parts.push("HttpOnly");
    parts.push(`SameSite=${options.sameSite || "Lax"}`);
    if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Number(options.maxAge || 0))}`);
    if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
    return parts.join("; ");
}

function setCookie(res, name, value, options) {
    const existing = res.getHeader("Set-Cookie");
    const next = buildCookie(name, value, options);
    if (!existing) {
        res.setHeader("Set-Cookie", next);
        return;
    }
    if (Array.isArray(existing)) {
        res.setHeader("Set-Cookie", existing.concat(next));
        return;
    }
    res.setHeader("Set-Cookie", [existing, next]);
}

function deleteCookie(res, name) {
    setCookie(res, name, "", {
        path: "/",
        sameSite: "Lax",
        maxAge: 0,
        expires: new Date(0)
    });
}

function cleanupSessions() {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        if (!session || session.expiresAt <= now) sessions.delete(token);
    }
}

function createSession(user) {
    cleanupSessions();
    const token = randomBytes(32).toString("hex");
    const session = {
        id: user.id,
        email: user.email,
        role: user.role,
        expiresAt: Date.now() + sessionTtlMs
    };
    sessions.set(token, session);
    return { token, session };
}

function getSessionFromRequest(req) {
    cleanupSessions();
    const cookies = parseCookies(req);
    const token = cookies[sessionCookieName];
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return { token, session };
}

function canEdit(role) {
    return role === "admin" || role === "editor";
}

function requireSession(req, res, options = {}) {
    const result = getSessionFromRequest(req);
    if (!result) {
        sendJson(res, 401, { ok: false, error: "auth_required" });
        return null;
    }
    if (options.role === "admin" && result.session.role !== "admin") {
        sendJson(res, 403, { ok: false, error: "forbidden" });
        return null;
    }
    if (options.editable && !canEdit(result.session.role)) {
        sendJson(res, 403, { ok: false, error: "forbidden" });
        return null;
    }
    return result;
}

function sendStatic(req, res, urlPath) {
    const requestPath = urlPath === "/" ? "/index.html" : urlPath;
    const safeRelative = safePathFromRequest(requestPath).replace(/^[/\\]+/, "");

    if (!safeRelative) {
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
    }

    if (
        safeRelative === "admin.html" ||
        safeRelative === "local-cms-server.mjs" ||
        safeRelative.startsWith(".hardware-cms") ||
        safeRelative.startsWith(".git") ||
        safeRelative.startsWith("scripts")
    ) {
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
    }

    let filePath = path.join(rootDir, safeRelative);
    if (!filePath.startsWith(rootDir)) {
        sendJson(res, 403, { ok: false, error: "forbidden_path" });
        return;
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
    }

    if (!existsSync(filePath)) {
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
    }

    const stats = statSync(filePath);
    const contentType = contentTypeByExt(filePath);
    const noStore = /\.(html|css|js|json)$/i.test(filePath);

    res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": stats.size,
        "Last-Modified": stats.mtime.toUTCString(),
        "Cache-Control": noStore ? "no-store, max-age=0" : "public, max-age=86400"
    });
    createReadStream(filePath).pipe(res);
}

ensureOverridesFile();
ensureAuthStore();

const server = createServer(async (req, res) => {
    try {
        const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
        const pathname = requestUrl.pathname;
        const method = String(req.method || "GET").toUpperCase();

        if (pathname === "/api/health") {
            sendJson(res, 200, { ok: true, status: "online", adminRoute });
            return;
        }

        if (pathname === adminRoute || pathname === adminRoute.slice(0, -1)) {
            sendHtmlFile(res, adminTemplateFile);
            return;
        }

        if (pathname === "/api/auth/me") {
            const current = getSessionFromRequest(req);
            if (!current) {
                sendJson(res, 200, { ok: true, authenticated: false, adminRoute });
                return;
            }

            const store = readUserStore();
            const user = store.users.find((item) => item.id === current.session.id);
            if (!user || !user.active) {
                sessions.delete(current.token);
                deleteCookie(res, sessionCookieName);
                sendJson(res, 200, { ok: true, authenticated: false, adminRoute });
                return;
            }

            sendJson(res, 200, {
                ok: true,
                authenticated: true,
                adminRoute,
                user: sanitizeUser(user)
            });
            return;
        }

        if (pathname === "/api/auth/login") {
            if (method !== "POST") {
                sendJson(res, 405, { ok: false, error: "method_not_allowed" });
                return;
            }

            const body = await parseBody(req);
            const email = String(body.email || body.username || "").trim().toLowerCase();
            const password = String(body.password || "");
            const store = readUserStore();
            const user = store.users.find((item) => item.email === email);

            if (!user || !user.active || !verifyPassword(password, user)) {
                sendJson(res, 401, { ok: false, error: "invalid_credentials" });
                return;
            }

            user.lastLoginAt = new Date().toISOString();
            user.updatedAt = user.lastLoginAt;
            writeUserStore(store.users);

            const created = createSession(user);
            setCookie(res, sessionCookieName, created.token, {
                path: "/",
                sameSite: "Lax",
                httpOnly: true,
                maxAge: sessionTtlMs / 1000
            });
            sendJson(res, 200, {
                ok: true,
                authenticated: true,
                adminRoute,
                user: sanitizeUser(user)
            });
            return;
        }

        if (pathname === "/api/auth/logout") {
            if (method !== "POST") {
                sendJson(res, 405, { ok: false, error: "method_not_allowed" });
                return;
            }
            const current = getSessionFromRequest(req);
            if (current) sessions.delete(current.token);
            deleteCookie(res, sessionCookieName);
            sendJson(res, 200, { ok: true });
            return;
        }

        if (pathname === "/api/auth/users") {
            if (method === "GET") {
                const current = requireSession(req, res, { role: "admin" });
                if (!current) return;
                const store = readUserStore();
                sendJson(res, 200, {
                    ok: true,
                    users: store.users.map(sanitizeUser),
                    currentUserId: current.session.id
                });
                return;
            }

            if (method === "POST") {
                const current = requireSession(req, res, { role: "admin" });
                if (!current) return;

                const body = await parseBody(req);
                const email = String(body.email || "").trim().toLowerCase();
                const password = String(body.password || "");
                const requestedRole = String(body.role || "editor").trim().toLowerCase();
                const active = body.active !== false;

                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    sendJson(res, 400, { ok: false, error: "invalid_email" });
                    return;
                }
                if (password.length < 8) {
                    sendJson(res, 400, { ok: false, error: "password_too_short" });
                    return;
                }

                const role = requestedRole === "admin" || requestedRole === "viewer" ? requestedRole : "editor";
                const store = readUserStore();
                if (store.users.some((item) => item.email === email)) {
                    sendJson(res, 409, { ok: false, error: "email_exists" });
                    return;
                }

                const hashed = hashPassword(password);
                const now = new Date().toISOString();
                const user = normalizeUserRecord({
                    id: createHash("sha1").update(email + now).digest("hex").slice(0, 16),
                    email,
                    role,
                    active,
                    salt: hashed.salt,
                    passwordHash: hashed.passwordHash,
                    createdAt: now,
                    updatedAt: now,
                    lastLoginAt: ""
                });

                store.users.push(user);
                writeUserStore(store.users);
                sendJson(res, 201, { ok: true, user: sanitizeUser(user) });
                return;
            }

            sendJson(res, 405, { ok: false, error: "method_not_allowed" });
            return;
        }

        if (pathname.startsWith("/api/auth/users/")) {
            if (method !== "PATCH") {
                sendJson(res, 405, { ok: false, error: "method_not_allowed" });
                return;
            }

            const current = requireSession(req, res, { role: "admin" });
            if (!current) return;

            const userId = pathname.slice("/api/auth/users/".length).trim();
            if (!userId) {
                sendJson(res, 400, { ok: false, error: "invalid_user_id" });
                return;
            }

            const body = await parseBody(req);
            const store = readUserStore();
            const user = store.users.find((item) => item.id === userId);
            if (!user) {
                sendJson(res, 404, { ok: false, error: "user_not_found" });
                return;
            }

            const nextRole = body.role !== undefined ? String(body.role || "").trim().toLowerCase() : user.role;
            const role = nextRole === "admin" || nextRole === "viewer" ? nextRole : "editor";
            const active = body.active !== undefined ? body.active !== false : user.active;
            const nextPassword = body.password !== undefined ? String(body.password || "") : "";

            if (current.session.id === user.id && (!active || role !== "admin")) {
                sendJson(res, 400, { ok: false, error: "cannot_downgrade_current_admin" });
                return;
            }
            if (nextPassword && nextPassword.length < 8) {
                sendJson(res, 400, { ok: false, error: "password_too_short" });
                return;
            }

            user.role = role;
            user.active = active;
            user.updatedAt = new Date().toISOString();

            if (nextPassword) {
                const hashed = hashPassword(nextPassword);
                user.salt = hashed.salt;
                user.passwordHash = hashed.passwordHash;
            }

            writeUserStore(store.users);
            sendJson(res, 200, { ok: true, user: sanitizeUser(user) });
            return;
        }

        if (pathname === "/api/overrides") {
            if (method === "GET") {
                const overrides = readOverrides();
                const updatedAt = existsSync(overridesFile) ? statSync(overridesFile).mtimeMs : Date.now();
                sendJson(res, 200, { ok: true, overrides, updatedAt });
                return;
            }

            if (method === "OPTIONS") {
                sendJson(res, 200, { ok: true });
                return;
            }

            if (method === "PUT" || method === "POST") {
                const current = requireSession(req, res, { editable: true });
                if (!current) return;
                const body = await parseBody(req);
                const payload = body && typeof body === "object" && body.overrides ? body.overrides : body;
                const overrides = writeOverrides(payload);
                sendJson(res, 200, { ok: true, overrides, updatedAt: Date.now() });
                return;
            }

            sendJson(res, 405, { ok: false, error: "method_not_allowed" });
            return;
        }

        if (pathname === "/api/upload") {
            if (method === "OPTIONS") {
                sendJson(res, 200, { ok: true });
                return;
            }
            if (method !== "POST") {
                sendJson(res, 405, { ok: false, error: "method_not_allowed" });
                return;
            }

            const current = requireSession(req, res, { editable: true });
            if (!current) return;

            const body = await parseBody(req);
            const uploaded = writeUploadedImage(body || {});
            if (!uploaded.ok) {
                sendJson(res, uploaded.error === "file_too_large" ? 413 : 400, uploaded);
                return;
            }
            sendJson(res, 200, uploaded);
            return;
        }

        sendStatic(req, res, pathname);
    } catch (error) {
        sendJson(res, 500, { ok: false, error: error && error.message ? error.message : "server_error" });
    }
});

server.listen(port, host, () => {
    console.log(`hardware-cms-server running on http://${host}:${port}`);
    console.log(`site: http://127.0.0.1:${port}/`);
    console.log(`admin: http://127.0.0.1:${port}${adminRoute}`);
    console.log(`root: ${rootDir}`);
    console.log(`overrides: ${overridesFile}`);
    console.log(`users: ${usersFile}`);
});
