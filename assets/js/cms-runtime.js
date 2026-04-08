(function () {
    "use strict";

    const config = window.HARDWARE_SITE_CONFIG || {};
    const storageKeys = config.storageKeys || {
        overrides: "hardwareSiteOverrides.v1",
        adminCreds: "hardwareAdminCredentials.v1",
        adminSession: "hardwareAdminSession.v1"
    };
    const remoteApiPath = (config.api && config.api.overridesPath) || "/api/overrides";
    const authApiBase = (config.api && config.api.authBase) || "/api/auth";
    const localSessionTtlMs = 12 * 60 * 60 * 1000;
    let lastStorageError = "";
    let remoteApiDisabled = false;
    let authStateCache = null;
    let authStateCacheTs = 0;

    function safeJsonParse(text, fallbackValue) {
        if (typeof text !== "string" || !text.trim()) return fallbackValue;
        try {
            return JSON.parse(text);
        } catch (_) {
            return fallbackValue;
        }
    }

    function storageGet(key, fallbackValue) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return fallbackValue;
            lastStorageError = "";
            return value;
        } catch (error) {
            lastStorageError = error && error.name ? error.name : "storage_get_failed";
            return fallbackValue;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            lastStorageError = "";
            return true;
        } catch (error) {
            lastStorageError = error && error.name ? error.name : "storage_set_failed";
            return false;
        }
    }

    function storageRemove(key) {
        try {
            localStorage.removeItem(key);
            lastStorageError = "";
            return true;
        } catch (error) {
            lastStorageError = error && error.name ? error.name : "storage_remove_failed";
            return false;
        }
    }

    function getLastStorageError() {
        return lastStorageError || "";
    }

    function hasRemoteApi() {
        return !remoteApiDisabled && /^https?:$/i.test(String(window.location.protocol || "")) && typeof fetch === "function";
    }

    function isPrivateRuntimeHost() {
        const protocol = String(window.location.protocol || "").toLowerCase();
        const host = String(window.location.hostname || "").toLowerCase();
        if (protocol === "file:") return true;
        if (!host) return true;
        if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) return true;
        if (/^10\./.test(host)) return true;
        if (/^192\.168\./.test(host)) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
        return false;
    }

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

    function getOverrides() {
        const raw = storageGet(storageKeys.overrides, "");
        return normalizeOverrides(safeJsonParse(raw, {}));
    }

    function saveOverrides(nextOverrides) {
        const normalized = normalizeOverrides(nextOverrides);
        return storageSet(storageKeys.overrides, JSON.stringify(normalized));
    }

    function clearOverrides() {
        return storageRemove(storageKeys.overrides);
    }

    function syncOverridesFromServer() {
        if (!hasRemoteApi()) return Promise.resolve({ ok: false, skipped: true, error: "remote_api_unavailable" });

        return fetch(remoteApiPath, {
            method: "GET",
            cache: "no-store",
            headers: { "Accept": "application/json" }
        }).then(function (response) {
            if (!response.ok) {
                if (response.status === 404 || response.status === 405) remoteApiDisabled = true;
                return { ok: false, error: "http_" + response.status };
            }
            return response.json().then(function (payload) {
                const incoming = normalizeOverrides(payload && payload.overrides ? payload.overrides : payload);
                const current = normalizeOverrides(getOverrides());
                const incomingText = JSON.stringify(incoming);
                const currentText = JSON.stringify(current);

                if (incomingText === currentText) {
                    return { ok: true, changed: false, payload: incoming };
                }

                const saved = saveOverrides(incoming);
                if (!saved) {
                    return { ok: false, error: "local_storage_write_failed" };
                }

                return { ok: true, changed: true, payload: incoming };
            }).catch(function () {
                return { ok: false, error: "invalid_remote_json" };
            });
        }).catch(function () {
            remoteApiDisabled = true;
            return { ok: false, error: "remote_fetch_failed" };
        });
    }

    function syncOverridesToServer(payload) {
        if (!hasRemoteApi()) return Promise.resolve({ ok: false, skipped: true, error: "remote_api_unavailable" });

        const normalized = normalizeOverrides(payload);
        return fetch(remoteApiPath, {
            method: "PUT",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ overrides: normalized })
        }).then(function (response) {
            if (!response.ok) {
                if (response.status === 404 || response.status === 405) remoteApiDisabled = true;
                return { ok: false, error: "http_" + response.status };
            }
            return response.json().then(function () {
                return { ok: true };
            }).catch(function () {
                return { ok: true };
            });
        }).catch(function () {
            remoteApiDisabled = true;
            return { ok: false, error: "remote_put_failed" };
        });
    }

    function getDefaultCredentials() {
        const admin = config.admin || {};
        const username = String(admin.defaultUsername || "").trim();
        const password = String(admin.defaultPassword || "").trim();
        return {
            username: username,
            password: password
        };
    }

    function shouldUseRemoteAuth() {
        return hasRemoteApi() || !isPrivateRuntimeHost();
    }

    function resetAuthCache() {
        authStateCache = null;
        authStateCacheTs = 0;
    }

    function fetchJson(url, options) {
        return fetch(url, Object.assign({
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
                "Accept": "application/json"
            }
        }, options || {})).then(function (response) {
            return response.json().catch(function () {
                return {};
            }).then(function (payload) {
                return {
                    ok: response.ok,
                    status: response.status,
                    payload: payload || {}
                };
            });
        }).catch(function () {
            return {
                ok: false,
                status: 0,
                payload: { error: "network_error" }
            };
        });
    }

    function getCurrentUser(forceRefresh) {
        if (!shouldUseRemoteAuth()) {
            const localLoggedIn = isAuthenticated();
            if (!localLoggedIn) return Promise.resolve(null);
            const creds = getCredentials();
            return Promise.resolve({
                id: "local-admin",
                email: creds.username,
                role: "admin",
                active: true
            });
        }

        const stale = forceRefresh === true || !authStateCache || (Date.now() - authStateCacheTs > 15_000);
        if (!stale) return Promise.resolve(authStateCache);

        return fetchJson(authApiBase + "/me").then(function (result) {
            const authenticated = !!(result.ok && result.payload && result.payload.authenticated && result.payload.user);
            authStateCache = authenticated ? result.payload.user : null;
            authStateCacheTs = Date.now();
            return authStateCache;
        });
    }

    function getCredentials() {
        const stored = safeJsonParse(storageGet(storageKeys.adminCreds, ""), null);
        if (!stored || typeof stored.username !== "string" || typeof stored.password !== "string") {
            return getDefaultCredentials();
        }
        return {
            username: stored.username,
            password: stored.password
        };
    }

    function setCredentials(username, password) {
        if (shouldUseRemoteAuth()) return false;
        if (typeof username !== "string" || typeof password !== "string") return false;
        const cleanUser = username.trim();
        const cleanPass = password.trim();
        if (!cleanUser || !cleanPass) return false;
        return storageSet(storageKeys.adminCreds, JSON.stringify({
            username: cleanUser,
            password: cleanPass
        }));
    }

    function login(username, password) {
        if (shouldUseRemoteAuth()) {
            return fetchJson(authApiBase + "/login", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: String(username || "").trim(),
                    password: String(password || "")
                })
            }).then(function (result) {
                const authenticated = !!(result.ok && result.payload && result.payload.authenticated && result.payload.user);
                authStateCache = authenticated ? result.payload.user : null;
                authStateCacheTs = Date.now();
                return authenticated;
            });
        }

        const cleanUser = String(username || "").trim();
        const cleanPass = String(password || "").trim();
        const creds = getCredentials();
        if (!creds.username || !creds.password) return false;
        if (cleanUser !== creds.username || cleanPass !== creds.password) return false;

        return storageSet(storageKeys.adminSession, JSON.stringify({
            active: true,
            ts: Date.now()
        }));
    }

    function logout() {
        if (shouldUseRemoteAuth()) {
            return fetchJson(authApiBase + "/logout", {
                method: "POST"
            }).then(function () {
                resetAuthCache();
                return true;
            });
        }
        return storageRemove(storageKeys.adminSession);
    }

    function isAuthenticated() {
        if (shouldUseRemoteAuth()) {
            return getCurrentUser().then(function (user) {
                return !!user;
            });
        }
        const payload = safeJsonParse(storageGet(storageKeys.adminSession, ""), null);
        const valid = !!(payload && payload.active === true && typeof payload.ts === "number" && (Date.now() - payload.ts) < localSessionTtlMs);
        if (!valid && payload) storageRemove(storageKeys.adminSession);
        return valid;
    }

    function listUsers() {
        if (!shouldUseRemoteAuth()) return Promise.resolve([]);
        return fetchJson(authApiBase + "/users").then(function (result) {
            return result.ok && Array.isArray(result.payload.users) ? result.payload.users : [];
        });
    }

    function createUser(payload) {
        if (!shouldUseRemoteAuth()) return Promise.resolve({ ok: false, error: "remote_auth_unavailable" });
        return fetchJson(authApiBase + "/users", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload || {})
        }).then(function (result) {
            return {
                ok: result.ok,
                error: result.payload && result.payload.error ? result.payload.error : "",
                user: result.payload && result.payload.user ? result.payload.user : null
            };
        });
    }

    function updateUser(userId, payload) {
        if (!shouldUseRemoteAuth()) return Promise.resolve({ ok: false, error: "remote_auth_unavailable" });
        return fetchJson(authApiBase + "/users/" + encodeURIComponent(String(userId || "")), {
            method: "PATCH",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload || {})
        }).then(function (result) {
            return {
                ok: result.ok,
                error: result.payload && result.payload.error ? result.payload.error : "",
                user: result.payload && result.payload.user ? result.payload.user : null
            };
        });
    }

    function getEditableDefs() {
        const editable = config.editable || {};
        return {
            meta: Array.isArray(editable.meta) ? editable.meta : [],
            toggles: Array.isArray(editable.toggles) ? editable.toggles : [],
            fields: Array.isArray(editable.fields) ? editable.fields : [],
            links: Array.isArray(editable.links) ? editable.links : [],
            media: Array.isArray(editable.media) ? editable.media : [],
            translations: typeof editable.translations === "object" && editable.translations ? editable.translations : {}
        };
    }

    function sanitizeClassList(rawValue) {
        return String(rawValue || "")
            .split(/\s+/)
            .filter(function (token) {
                return /^[a-zA-Z0-9_-]{1,64}$/.test(token);
            })
            .join(" ");
    }

    function sanitizeLimitedHtml(rawValue) {
        const html = String(rawValue || "");
        if (!html) return "";
        if (typeof document === "undefined" || typeof document.createElement !== "function") {
            return html.replace(/<[^>]*>/g, "");
        }

        const template = document.createElement("template");
        template.innerHTML = html;
        const allowedTags = {
            B: true,
            BR: true,
            EM: true,
            I: true,
            SMALL: true,
            SPAN: true,
            STRONG: true,
            U: true
        };

        function cleanNode(node) {
            if (!node) return null;
            if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
            if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode("");

            const tag = String(node.tagName || "").toUpperCase();
            if (!allowedTags[tag]) {
                return document.createTextNode(node.textContent || "");
            }

            const cleanEl = document.createElement(tag.toLowerCase());
            const safeClass = sanitizeClassList(node.getAttribute("class"));
            if (safeClass) cleanEl.setAttribute("class", safeClass);
            Array.from(node.childNodes || []).forEach(function (child) {
                cleanEl.appendChild(cleanNode(child));
            });
            return cleanEl;
        }

        const wrapper = document.createElement("div");
        Array.from(template.content.childNodes || []).forEach(function (child) {
            wrapper.appendChild(cleanNode(child));
        });
        return wrapper.innerHTML;
    }

    function sanitizeUrlValue(rawValue, attrName) {
        const value = String(rawValue || "").trim();
        if (!value) return "";
        if (/^(javascript|vbscript|data):/i.test(value)) return "";
        if (/^[#/?]/.test(value) || /^\.\.?\//.test(value)) return value;

        try {
            const parsed = new URL(value, window.location.href);
            const protocol = String(parsed.protocol || "").toLowerCase();
            if (attrName === "action") {
                return protocol === "https:" || protocol === "http:" ? parsed.href : "";
            }
            if (attrName === "href") {
                return /^(https?:|mailto:|tel:)/.test(protocol) ? parsed.href : "";
            }
            return protocol === "https:" || protocol === "http:" ? parsed.href : "";
        } catch (_) {
            return "";
        }
    }

    function normalizeMediaOverrideValue(rawValue) {
        if (typeof rawValue === "string") return { src: rawValue, alt: "" };
        if (!rawValue || typeof rawValue !== "object") return { src: "", alt: "" };
        return {
            src: typeof rawValue.src === "string" ? rawValue.src : "",
            alt: typeof rawValue.alt === "string" ? rawValue.alt : ""
        };
    }

    function normalizeToggleDefault(item) {
        return typeof item.defaultValue === "boolean" ? item.defaultValue : true;
    }

    function getMergedEditableState() {
        const defs = getEditableDefs();
        const overrides = getOverrides();

        const meta = {};
        defs.meta.forEach(function (item) {
            const defaultValue = typeof item.defaultValue === "string" ? item.defaultValue : "";
            const overrideValue = overrides.meta[item.key];
            meta[item.key] = typeof overrideValue === "string" ? overrideValue : defaultValue;
        });

        const toggles = {};
        defs.toggles.forEach(function (item) {
            const defaultValue = normalizeToggleDefault(item);
            const overrideValue = overrides.toggles[item.key];
            toggles[item.key] = typeof overrideValue === "boolean" ? overrideValue : defaultValue;
        });

        const fields = {};
        defs.fields.forEach(function (item) {
            const defaultValue = typeof item.defaultValue === "string" ? item.defaultValue : "";
            const overrideValue = overrides.fields[item.key];
            fields[item.key] = typeof overrideValue === "string" ? overrideValue : defaultValue;
        });

        const links = {};
        defs.links.forEach(function (item) {
            const defaultValue = typeof item.defaultValue === "string" ? item.defaultValue : "";
            const overrideValue = overrides.links[item.key];
            links[item.key] = typeof overrideValue === "string" ? overrideValue : defaultValue;
        });

        const media = {};
        defs.media.forEach(function (item) {
            const defaultSrc = typeof item.defaultValue === "string" ? item.defaultValue : "";
            const defaultAlt = typeof item.defaultAlt === "string" ? item.defaultAlt : "";
            const overrideMedia = normalizeMediaOverrideValue(overrides.media[item.key]);
            media[item.key] = {
                src: overrideMedia.src || defaultSrc,
                alt: overrideMedia.alt || defaultAlt
            };
        });

        const translations = {};
        Object.keys(defs.translations).forEach(function (lang) {
            translations[lang] = {};
            const langDefs = Array.isArray(defs.translations[lang]) ? defs.translations[lang] : [];
            langDefs.forEach(function (item) {
                const defaultValue = typeof item.defaultValue === "string" ? item.defaultValue : "";
                const overrideLang = overrides.translations[lang] || {};
                const overrideValue = overrideLang[item.key];
                translations[lang][item.key] = typeof overrideValue === "string" ? overrideValue : defaultValue;
            });
        });

        return {
            meta: meta,
            toggles: toggles,
            fields: fields,
            links: links,
            media: media,
            translations: translations
        };
    }

    function mergeOverridePayload(payload) {
        const current = getOverrides();
        const normalizedPayload = normalizeOverrides(payload);

        return {
            meta: Object.assign({}, current.meta, normalizedPayload.meta),
            toggles: Object.assign({}, current.toggles, normalizedPayload.toggles),
            fields: Object.assign({}, current.fields, normalizedPayload.fields),
            links: Object.assign({}, current.links, normalizedPayload.links),
            media: Object.assign({}, current.media, normalizedPayload.media),
            translations: Object.assign({}, current.translations, normalizedPayload.translations)
        };
    }

    function setAllOverrides(payload) {
        return saveOverrides(payload);
    }

    function upsertOverrides(payload) {
        return saveOverrides(mergeOverridePayload(payload));
    }

    function removeOverrideKey(group, key, lang) {
        const current = getOverrides();
        if (group === "translations") {
            if (!lang || !current.translations[lang]) return saveOverrides(current);
            delete current.translations[lang][key];
            return saveOverrides(current);
        }
        if (current[group] && typeof current[group] === "object") {
            delete current[group][key];
        }
        return saveOverrides(current);
    }

    function applyDomOverrides(doc) {
        const overrides = getOverrides();
        const defs = getEditableDefs().fields;

        defs.forEach(function (item) {
            const customValue = overrides.fields[item.key];
            if (typeof customValue !== "string" || !item.selector) return;
            doc.querySelectorAll(item.selector).forEach(function (el) {
                if ((item.mode || "text") === "html") el.innerHTML = sanitizeLimitedHtml(customValue);
                else el.textContent = customValue;
            });
        });
    }

    function buildSoundcloudWidgetSrc(playlistUrl) {
        const cleanPlaylist = String(playlistUrl || "").trim();
        if (!cleanPlaylist) return "";
        return "https://w.soundcloud.com/player/?url=" + encodeURIComponent(cleanPlaylist) + "&color=%23ff003c&auto_play=false&hide_related=false&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false&enable_api=true";
    }

    function resolveLinkValue(item, rawValue) {
        const clean = String(rawValue || "").trim();
        if (!clean) return "";
        if (item.transform === "soundcloudPlaylist") {
            return buildSoundcloudWidgetSrc(clean);
        }
        return clean;
    }

    function applyLinkOverrides(doc) {
        const overrides = getOverrides();
        const defs = getEditableDefs().links;

        defs.forEach(function (item) {
            const customValue = overrides.links[item.key];
            if (typeof customValue !== "string" || !item.selector) return;
            const resolvedValue = resolveLinkValue(item, customValue);
            const safeValue = sanitizeUrlValue(resolvedValue, item.attr || "href");
            if (!safeValue) return;
            doc.querySelectorAll(item.selector).forEach(function (el) {
                el.setAttribute(item.attr || "href", safeValue);
            });
        });
    }

    function normalizeAssetPath(rawValue) {
        let value = String(rawValue || "").trim();
        if (!value) return "";

        if (/^file:\/\//i.test(value)) {
            try {
                value = decodeURIComponent(value.replace(/^file:\/+/, ""));
            } catch (_) {
                value = value.replace(/^file:\/+/, "");
            }
        }

        value = value.replace(/\\/g, "/");
        const assetMatch = value.match(/(?:^|\/)(assets\/.+)$/i);
        if (assetMatch) value = assetMatch[1];
        if (!assetMatch && /^[a-zA-Z]:\//.test(value)) return "";
        value = value.replace(/^\.\/+/, "");
        return value;
    }

    function isExternalMediaUrl(value) {
        return /^(data:|https?:\/\/|blob:|\/\/)/i.test(String(value || ""));
    }

    function appendMediaBust(value, token) {
        const clean = String(value || "");
        if (!clean || !token) return clean;

        const hashIndex = clean.indexOf("#");
        const hash = hashIndex >= 0 ? clean.slice(hashIndex) : "";
        const withoutHash = hashIndex >= 0 ? clean.slice(0, hashIndex) : clean;
        const queryIndex = withoutHash.indexOf("?");
        const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
        const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
        const params = new URLSearchParams(query);
        params.set("mt", token);
        const nextQuery = params.toString();
        return path + (nextQuery ? "?" + nextQuery : "") + hash;
    }

    function resolveMediaValue(rawValue, cacheToken) {
        const clean = String(rawValue || "").trim();
        if (!clean) return "";
        if (isExternalMediaUrl(clean)) return clean;

        const normalized = normalizeAssetPath(clean);
        if (!normalized) return "";

        const encoded = encodeURI(normalized);
        return appendMediaBust(encoded, cacheToken);
    }

    function applyMediaOverrides(doc) {
        const overrides = getOverrides();
        const defs = getEditableDefs().media;
        const cacheToken = String(Date.now());

        defs.forEach(function (item) {
            const overrideMedia = normalizeMediaOverrideValue(overrides.media[item.key]);
            const customSrc = String(overrideMedia.src || "").trim();
            const customAlt = String(overrideMedia.alt || "").trim();
            if (!item.selector) return;
            const resolvedSrc = resolveMediaValue(customSrc, cacheToken);

            doc.querySelectorAll(item.selector).forEach(function (el) {
                if (resolvedSrc) el.setAttribute(item.attr || "src", resolvedSrc);
            });

            if (item.altSelector && customAlt) {
                doc.querySelectorAll(item.altSelector).forEach(function (el) {
                    el.setAttribute(item.altAttr || "alt", customAlt);
                });
            }
        });
    }

    function applyToggleOverrides(doc) {
        const defs = getEditableDefs().toggles;
        const overrides = getOverrides();

        defs.forEach(function (item) {
            if (!item.selector) return;
            const defaultState = normalizeToggleDefault(item);
            const customValue = overrides.toggles[item.key];
            const enabled = typeof customValue === "boolean" ? customValue : defaultState;
            doc.querySelectorAll(item.selector).forEach(function (el) {
                el.classList.toggle("cms-hidden", !enabled);
                if (enabled) {
                    el.removeAttribute("aria-hidden");
                } else {
                    el.setAttribute("aria-hidden", "true");
                }
            });
        });
    }

    function applyTranslationsOverrides(translations) {
        if (!translations || typeof translations !== "object") return;

        const overrides = getOverrides();
        const translationOverrides = overrides.translations || {};

        Object.keys(translationOverrides).forEach(function (lang) {
            const langValues = translationOverrides[lang];
            if (!langValues || typeof langValues !== "object") return;
            if (!translations[lang] || typeof translations[lang] !== "object") translations[lang] = {};
            Object.assign(translations[lang], langValues);
        });
    }

    function getEventDateMs(fallbackIso) {
        const overrides = getOverrides();
        const defaultIso = (config.event && config.event.defaultDateIso) || fallbackIso || "";
        const candidate = (overrides.meta && overrides.meta.eventDateIso) || defaultIso;
        const ts = new Date(candidate).getTime();

        if (!Number.isNaN(ts)) return ts;

        const fallbackTs = new Date(defaultIso).getTime();
        return Number.isNaN(fallbackTs) ? Date.now() : fallbackTs;
    }

    function getEventDateIso(fallbackIso) {
        const overrides = getOverrides();
        const defaultIso = (config.event && config.event.defaultDateIso) || fallbackIso || "";
        const candidate = String((overrides.meta && overrides.meta.eventDateIso) || defaultIso || "").trim();
        return Number.isNaN(new Date(candidate).getTime()) ? defaultIso : candidate;
    }

    function exportOverrides() {
        return JSON.stringify(getOverrides(), null, 2);
    }

    function importOverrides(rawText) {
        const parsed = safeJsonParse(rawText, null);
        if (!parsed) return { ok: false, error: "JSON invalido" };
        const ok = saveOverrides(parsed);
        return ok ? { ok: true } : { ok: false, error: "Falha ao salvar no navegador" };
    }

    function reapplySiteOverrides() {
        if (!document.querySelector("#main-title")) return;
        applyDomOverrides(document);
        applyLinkOverrides(document);
        applyMediaOverrides(document);
        applyToggleOverrides(document);
        if (typeof window.dispatchEvent === "function") {
            window.dispatchEvent(new CustomEvent("hardware:overrides-applied"));
        }
    }

    window.HardwareCMS = {
        getEditableDefs: getEditableDefs,
        getMergedEditableState: getMergedEditableState,
        getOverrides: getOverrides,
        setAllOverrides: setAllOverrides,
        upsertOverrides: upsertOverrides,
        clearOverrides: clearOverrides,
        removeOverrideKey: removeOverrideKey,
        exportOverrides: exportOverrides,
        importOverrides: importOverrides,
        getLastStorageError: getLastStorageError,
        getCurrentUser: getCurrentUser,
        getCredentials: getCredentials,
        setCredentials: setCredentials,
        login: login,
        logout: logout,
        isAuthenticated: isAuthenticated,
        listUsers: listUsers,
        createUser: createUser,
        updateUser: updateUser,
        applyDomOverrides: applyDomOverrides,
        applyLinkOverrides: applyLinkOverrides,
        applyMediaOverrides: applyMediaOverrides,
        applyToggleOverrides: applyToggleOverrides,
        applyTranslationsOverrides: applyTranslationsOverrides,
        getEventDateMs: getEventDateMs,
        getEventDateIso: getEventDateIso,
        buildSoundcloudWidgetSrc: buildSoundcloudWidgetSrc,
        hasRemoteApi: hasRemoteApi,
        syncOverridesFromServer: syncOverridesFromServer,
        syncOverridesToServer: syncOverridesToServer,
        reapplySiteOverrides: reapplySiteOverrides
    };

    if (document.querySelector("#main-title")) {
        const isPreviewMode = /(?:[?&]previewTs=)/.test(String(window.location.search || ""));
        if (hasRemoteApi()) {
            let remoteSyncTimer = null;
            let pollingDelay = 12000;

            function runRemoteSync() {
                if (document.hidden) {
                    pollingDelay = 20000;
                    scheduleNextSync();
                    return;
                }

                syncOverridesFromServer().then(function (result) {
                    if (result && result.ok && result.changed) {
                        reapplySiteOverrides();
                    }
                    pollingDelay = result && result.ok ? 12000 : 24000;
                    scheduleNextSync();
                }).catch(function () {
                    pollingDelay = 30000;
                    scheduleNextSync();
                });
            }

            function scheduleNextSync() {
                if (remoteSyncTimer) clearTimeout(remoteSyncTimer);
                remoteSyncTimer = setTimeout(runRemoteSync, pollingDelay);
            }

            syncOverridesFromServer().then(function (result) {
                if (result && result.ok && result.changed) {
                    reapplySiteOverrides();
                } else {
                    reapplySiteOverrides();
                }
                if (!isPreviewMode) {
                    pollingDelay = result && result.ok ? 12000 : 24000;
                    scheduleNextSync();
                }
            });

            if (!isPreviewMode) {
                document.addEventListener("visibilitychange", function () {
                    if (!document.hidden) runRemoteSync();
                });
            }
        } else {
            reapplySiteOverrides();
        }
    }
}());
