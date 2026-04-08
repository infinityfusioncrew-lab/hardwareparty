(function () {
    "use strict";

    const cms = window.HardwareCMS;

    const authCard = document.getElementById("auth-card");
    const workspaceShell = document.getElementById("workspace-shell");

    const loginForm = document.getElementById("login-form");
    const authStatus = document.getElementById("auth-status");

    const panelStatus = document.getElementById("panel-status");
    const sessionSummary = document.getElementById("session-summary");
    const usersCard = document.getElementById("users-card");
    const userCreateForm = document.getElementById("user-create-form");
    const userCreateStatus = document.getElementById("user-create-status");
    const refreshUsersBtn = document.getElementById("refresh-users-btn");
    const usersList = document.getElementById("users-list");

    const metaContainer = document.getElementById("meta-fields");
    const toggleContainer = document.getElementById("toggle-fields");
    const fixedContainer = document.getElementById("fixed-fields");
    const mediaContainer = document.getElementById("media-fields");
    const linkContainer = document.getElementById("link-fields");
    const translationContainer = document.getElementById("translation-fields");

    const contentForm = document.getElementById("content-form");
    const saveBtn = document.getElementById("save-btn");
    const exportBtn = document.getElementById("export-btn");
    const importBtn = document.getElementById("import-btn");
    const importFile = document.getElementById("import-file");
    const resetBtn = document.getElementById("reset-btn");
    const logoutBtn = document.getElementById("logout-btn");

    const previewFrame = document.getElementById("site-preview");
    const previewFrameWrap = document.getElementById("preview-frame-wrap");
    const refreshPreviewBtn = document.getElementById("refresh-preview-btn");
    const previewDesktopBtn = document.getElementById("preview-desktop-btn");
    const previewMobileBtn = document.getElementById("preview-mobile-btn");
    const livePreviewToggle = document.getElementById("live-preview-toggle");
    const openPreviewTabBtn = document.getElementById("open-preview-tab-btn");

    const newUserEmailInput = document.getElementById("new-user-email");
    const newUserPassInput = document.getElementById("new-user-pass");
    const confirmUserPassInput = document.getElementById("confirm-user-pass");
    const newUserRoleInput = document.getElementById("new-user-role");
    const newUserActiveInput = document.getElementById("new-user-active");

    if (!cms) {
        if (authStatus) setStatus(authStatus, "Runtime CMS nao carregado.", "error");
        return;
    }

    const defs = cms.getEditableDefs();
    const mediaRefs = {};
    let livePreviewTimer = null;
    let currentSessionUser = null;
    const previewPath = "/index.html";
    const STORAGE_SOFT_LIMIT = 4_500_000;
    const MEDIA_IMAGE_DATAURL_SOFT_LIMIT = 1_050_000;
    const MEDIA_IMAGE_TARGET_LIMIT = 780_000;
    const REMOTE_UPLOAD_PATH = (window.HARDWARE_SITE_CONFIG &&
        window.HARDWARE_SITE_CONFIG.api &&
        window.HARDWARE_SITE_CONFIG.api.uploadPath) || "/api/upload";

    function setStatus(target, message, type) {
        if (!target) return;
        target.textContent = message || "";
        target.className = "status";
        if (type) target.classList.add(type);
    }

    function hostScopeLabel() {
        const host = String(window.location.host || "").trim();
        return host ? ("http://" + host) : window.location.origin;
    }

    function canUseRemoteApi() {
        return typeof cms.hasRemoteApi === "function" && cms.hasRemoteApi();
    }

    function isDataUrl(value) {
        return /^data:/i.test(String(value || ""));
    }

    function isVideoDataUrl(value) {
        return /^data:video\//i.test(String(value || ""));
    }

    function extractAssetsSubpath(value) {
        const normalized = String(value || "").replace(/\\/g, "/");
        const match = normalized.match(/(?:^|\/)(assets\/.+)$/i);
        return match ? match[1] : "";
    }

    function isFilesystemPath(value) {
        const raw = String(value || "").trim();
        if (!raw) return false;
        return /^[a-zA-Z]:[\\/]/.test(raw) || /^file:\/\//i.test(raw);
    }

    function normalizeMediaPath(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        if (/^data:/i.test(raw)) return raw;
        if (/^https?:\/\//i.test(raw)) return raw;

        let normalized = raw;
        if (/^file:\/\//i.test(normalized)) {
            try {
                normalized = decodeURIComponent(normalized.replace(/^file:\/+/, ""));
            } catch (_) {
                normalized = normalized.replace(/^file:\/+/, "");
            }
        }

        normalized = normalized.replace(/\\/g, "/");
        const assetsPath = extractAssetsSubpath(normalized);
        if (assetsPath) normalized = assetsPath;
        return normalized;
    }

    function buildSuggestedMediaPath(def, fileName) {
        const cleanName = String(fileName || "arquivo").replace(/[^\w.\-]/g, "_");
        const djMatch = String(def && def.key || "").match(/^dj(\d+)(Photo|Logo|Video)$/i);
        if (djMatch) {
            const folder = "dj" + djMatch[1];
            return "assets/djs/" + folder + "/" + cleanName;
        }
        return "assets/" + cleanName;
    }

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ""));
            };
            reader.onerror = function () {
                reject(new Error("file_read_failed"));
            };
            reader.readAsDataURL(file);
        });
    }

    function loadImageFromDataUrl(dataUrl) {
        return new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error("image_decode_failed")); };
            img.src = dataUrl;
        });
    }

    function compressImageDataUrl(dataUrl) {
        return loadImageFromDataUrl(dataUrl).then(function (img) {
            const maxWidth = 1440;
            const maxHeight = 1440;
            const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return dataUrl;

            let width = Math.max(1, Math.round(img.width * scale));
            let height = Math.max(1, Math.round(img.height * scale));
            canvas.width = width;
            canvas.height = height;

            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.86;
            let output = canvas.toDataURL("image/jpeg", quality);

            while (output.length > MEDIA_IMAGE_TARGET_LIMIT && quality > 0.34) {
                quality -= 0.07;
                output = canvas.toDataURL("image/jpeg", quality);
            }

            while (output.length > MEDIA_IMAGE_DATAURL_SOFT_LIMIT && width > 320 && height > 320) {
                width = Math.round(width * 0.84);
                height = Math.round(height * 0.84);
                canvas.width = width;
                canvas.height = height;
                ctx.fillStyle = "#000000";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                quality = Math.max(0.3, quality - 0.06);
                output = canvas.toDataURL("image/jpeg", quality);
            }

            return output;
        }).catch(function () {
            return dataUrl;
        });
    }

    function uploadImageToServer(file, def) {
        if (!canUseRemoteApi()) return Promise.resolve({ ok: false, skipped: true, error: "remote_api_unavailable" });
        if (!/^https?:$/i.test(String(window.location.protocol || ""))) {
            return Promise.resolve({ ok: false, skipped: true, error: "invalid_protocol" });
        }

        return readFileAsDataUrl(file).then(function (dataUrl) {
            return fetch(REMOTE_UPLOAD_PATH, {
                method: "POST",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    filename: String(file.name || "upload.jpg"),
                    mediaKey: String(def && def.key || ""),
                    dataUrl: dataUrl
                })
            });
        }).then(function (response) {
            if (!response.ok) {
                return response.json().catch(function () {
                    return {};
                }).then(function (payload) {
                    return { ok: false, error: payload.error || ("http_" + response.status) };
                });
            }
            return response.json().then(function (payload) {
                const path = payload && payload.path ? String(payload.path) : "";
                if (!path) return { ok: false, error: "upload_missing_path" };
                return { ok: true, path: path };
            }).catch(function () {
                return { ok: false, error: "upload_invalid_json" };
            });
        }).catch(function () {
            return { ok: false, error: "upload_request_failed" };
        });
    }

    function inputId(group, key, lang, suffix) {
        return ["fld", group, lang || "root", key, suffix || "value"].join("__");
    }

    function shouldUseTextArea(def, group) {
        if ((def.mode || "text") === "html") return true;
        const defaultValue = String(def.defaultValue || "");
        return group === "translations" || defaultValue.length > 90;
    }

    function createEditor(container, group, def, lang) {
        const id = inputId(group, def.key, lang);
        const wrapper = document.createElement("div");

        const label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = def.label || def.key;

        const useTextArea = shouldUseTextArea(def, group);
        const input = useTextArea ? document.createElement("textarea") : document.createElement("input");
        input.id = id;
        input.name = id;

        if (!useTextArea) {
            if (group === "links") input.type = "url";
            else input.type = "text";
        }

        wrapper.appendChild(label);
        wrapper.appendChild(input);

        if (def.help) {
            const help = document.createElement("div");
            help.className = "help";
            help.textContent = def.help;
            wrapper.appendChild(help);
        }

        container.appendChild(wrapper);
    }

    function createToggleEditor(container, def) {
        const id = inputId("toggles", def.key);
        const wrapper = document.createElement("label");
        wrapper.className = "toggle-item";
        wrapper.setAttribute("for", id);

        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = id;
        input.name = id;

        const textWrap = document.createElement("span");
        textWrap.className = "toggle-copy";

        const title = document.createElement("strong");
        title.textContent = def.label || def.key;

        const helper = document.createElement("small");
        helper.textContent = def.help || "Ative/desative este bloco sem remover conteudo.";

        textWrap.appendChild(title);
        textWrap.appendChild(helper);

        wrapper.appendChild(input);
        wrapper.appendChild(textWrap);
        container.appendChild(wrapper);
    }

    function updateMediaPreview(key) {
        const ref = mediaRefs[key];
        if (!ref) return;
        const src = normalizeMediaPath(ref.srcInput.value);
        if (src !== ref.srcInput.value) ref.srcInput.value = src;
        const preferredType = ref.mediaType || "image";
        const inferredType = /^data:video\//i.test(src) || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src) ? "video" : "image";
        const type = preferredType === "video" ? "video" : inferredType;

        if (!src) {
            ref.previewImg.classList.add("hidden");
            ref.previewVideo.classList.add("hidden");
            ref.previewVideo.pause();
            ref.previewVideo.removeAttribute("src");
            ref.previewVideo.load();
            ref.placeholder.classList.remove("hidden");
            return;
        }

        if (type === "video") {
            ref.previewImg.classList.add("hidden");
            ref.previewVideo.src = src;
            ref.previewVideo.classList.remove("hidden");
            ref.previewVideo.load();
            ref.previewVideo.muted = true;
            ref.previewVideo.loop = true;
            const playPromise = ref.previewVideo.play();
            if (playPromise && typeof playPromise.catch === "function") playPromise.catch(function () {});
        } else {
            ref.previewVideo.classList.add("hidden");
            ref.previewVideo.pause();
            ref.previewVideo.removeAttribute("src");
            ref.previewVideo.load();
            ref.previewImg.src = src;
            ref.previewImg.classList.remove("hidden");
        }

        ref.placeholder.classList.add("hidden");
    }

    function createMediaEditor(container, def) {
        const srcId = inputId("media", def.key, "root", "src");
        const altId = inputId("media", def.key, "root", "alt");
        const fileId = inputId("media", def.key, "root", "file");

        const item = document.createElement("article");
        item.className = "media-item";

        const title = document.createElement("h4");
        title.className = "media-item-title";
        title.textContent = def.label || def.key;
        item.appendChild(title);

        const grid = document.createElement("div");
        grid.className = "media-item-grid";

        const controlsCol = document.createElement("div");

        const srcLabel = document.createElement("label");
        srcLabel.setAttribute("for", srcId);
        const mediaKind = (def.mediaType || "image") === "video" ? "video" : "imagem";
        srcLabel.textContent = mediaKind === "video" ? "URL do video" : "URL da imagem/logo";
        const srcInput = document.createElement("input");
        srcInput.id = srcId;
        srcInput.type = "text";

        const altLabel = document.createElement("label");
        altLabel.setAttribute("for", altId);
        altLabel.textContent = "Texto alternativo (alt)";
        const altInput = document.createElement("input");
        altInput.id = altId;
        altInput.type = "text";

        controlsCol.appendChild(srcLabel);
        controlsCol.appendChild(srcInput);
        controlsCol.appendChild(altLabel);
        controlsCol.appendChild(altInput);

        if (def.help) {
            const help = document.createElement("div");
            help.className = "help";
            help.textContent = def.help;
            controlsCol.appendChild(help);
        }

        const mediaActions = document.createElement("div");
        mediaActions.className = "media-controls";

        const uploadBtn = document.createElement("button");
        uploadBtn.type = "button";
        uploadBtn.className = "btn-secondary";
        uploadBtn.textContent = "Upload local";

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "btn-secondary";
        clearBtn.textContent = "Limpar";

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = mediaKind === "video" ? "video/*" : "image/*";
        fileInput.id = fileId;
        fileInput.className = "hidden";

        mediaActions.appendChild(uploadBtn);
        mediaActions.appendChild(clearBtn);
        controlsCol.appendChild(mediaActions);
        controlsCol.appendChild(fileInput);

        const preview = document.createElement("div");
        preview.className = "media-preview";
        const previewImg = document.createElement("img");
        previewImg.className = "hidden";
        previewImg.alt = def.label || def.key;
        const previewVideo = document.createElement("video");
        previewVideo.className = "hidden";
        previewVideo.muted = true;
        previewVideo.loop = true;
        previewVideo.playsInline = true;
        const placeholder = document.createElement("span");
        placeholder.textContent = "Sem arquivo";
        placeholder.style.color = "#7a8da9";
        placeholder.style.fontSize = "0.78rem";

        preview.appendChild(previewImg);
        preview.appendChild(previewVideo);
        preview.appendChild(placeholder);

        grid.appendChild(controlsCol);
        grid.appendChild(preview);
        item.appendChild(grid);

        srcInput.addEventListener("input", function () {
            updateMediaPreview(def.key);
            scheduleLivePreview();
        });

        altInput.addEventListener("input", scheduleLivePreview);

        uploadBtn.addEventListener("click", function () {
            fileInput.value = "";
            fileInput.click();
        });

        clearBtn.addEventListener("click", function () {
            srcInput.value = "";
            updateMediaPreview(def.key);
            scheduleLivePreview();
        });

        fileInput.addEventListener("change", async function () {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;

            const isVideoField = (def.mediaType || "image") === "video" || /^video\//i.test(file.type || "");
            if (isVideoField) {
                const suggestedPath = buildSuggestedMediaPath(def, file.name);
                srcInput.value = suggestedPath;
                updateMediaPreview(def.key);
                setStatus(
                    panelStatus,
                    "Video nao usa upload em base64. Coloque na pasta do projeto e informe/corrija o caminho (ex.: " + suggestedPath + ").",
                    "warn"
                );
                scheduleLivePreview();
                return;
            }

            if (!/^image\//i.test(file.type || "")) {
                setStatus(panelStatus, "Este campo aceita apenas imagem (foto/logo).", "warn");
                return;
            }

            try {
                if (canUseRemoteApi()) {
                    const uploaded = await uploadImageToServer(file, def);
                    if (uploaded && uploaded.ok && uploaded.path) {
                        srcInput.value = uploaded.path;
                        if (!altInput.value.trim()) altInput.value = file.name;
                        updateMediaPreview(def.key);
                        scheduleLivePreview();
                        setStatus(panelStatus, "Upload enviado para o servidor local. Clique em Salvar alteracoes.", "ok");
                        return;
                    }
                }

                let result = await readFileAsDataUrl(file);
                if (result.length > MEDIA_IMAGE_DATAURL_SOFT_LIMIT || file.size > 560 * 1024) {
                    result = await compressImageDataUrl(result);
                }

                if (isDataUrl(result) && result.length > MEDIA_IMAGE_DATAURL_SOFT_LIMIT) {
                    const suggestedPath = buildSuggestedMediaPath(def, file.name);
                    srcInput.value = suggestedPath;
                    updateMediaPreview(def.key);
                    setStatus(
                        panelStatus,
                        "Imagem ainda muito grande para salvar no navegador. Coloque o arquivo na pasta do projeto e use o caminho (ex.: " + suggestedPath + ").",
                        "warn"
                    );
                    scheduleLivePreview();
                    return;
                }

                srcInput.value = result;
                if (!altInput.value.trim()) altInput.value = file.name;
                updateMediaPreview(def.key);
                scheduleLivePreview();
                setStatus(panelStatus, "Upload de imagem aplicado. Clique em Salvar alteracoes.", "ok");
            } catch (_) {
                setStatus(panelStatus, "Falha ao processar upload da imagem.", "error");
            }
        });

        mediaRefs[def.key] = {
            srcInput: srcInput,
            altInput: altInput,
            previewImg: previewImg,
            previewVideo: previewVideo,
            placeholder: placeholder,
            mediaType: def.mediaType || "image"
        };

        container.appendChild(item);
    }

    function renderEditors() {
        metaContainer.innerHTML = "";
        if (toggleContainer) toggleContainer.innerHTML = "";
        fixedContainer.innerHTML = "";
        mediaContainer.innerHTML = "";
        linkContainer.innerHTML = "";
        translationContainer.innerHTML = "";

        defs.meta.forEach(function (def) {
            createEditor(metaContainer, "meta", def);
        });

        if (toggleContainer) {
            defs.toggles.forEach(function (def) {
                createToggleEditor(toggleContainer, def);
            });
        }

        defs.fields.forEach(function (def) {
            createEditor(fixedContainer, "fields", def);
        });

        defs.media.forEach(function (def) {
            createMediaEditor(mediaContainer, def);
        });

        defs.links.forEach(function (def) {
            createEditor(linkContainer, "links", def);
        });

        const ptDefs = Array.isArray(defs.translations.pt) ? defs.translations.pt : [];
        ptDefs.forEach(function (def) {
            createEditor(translationContainer, "translations", def, "pt");
        });
    }

    function fillEditors() {
        const state = cms.getMergedEditableState();

        defs.meta.forEach(function (def) {
            const node = document.getElementById(inputId("meta", def.key));
            if (node) node.value = state.meta[def.key] || "";
        });

        defs.toggles.forEach(function (def) {
            const node = document.getElementById(inputId("toggles", def.key));
            if (!node) return;
            node.checked = !!(state.toggles && state.toggles[def.key]);
        });

        defs.fields.forEach(function (def) {
            const node = document.getElementById(inputId("fields", def.key));
            if (node) node.value = state.fields[def.key] || "";
        });

        defs.media.forEach(function (def) {
            const ref = mediaRefs[def.key];
            if (!ref) return;
            const mediaState = state.media && state.media[def.key] ? state.media[def.key] : { src: "", alt: "" };
            ref.srcInput.value = mediaState.src || "";
            ref.altInput.value = mediaState.alt || "";
            updateMediaPreview(def.key);
        });

        defs.links.forEach(function (def) {
            const node = document.getElementById(inputId("links", def.key));
            if (node) node.value = state.links[def.key] || "";
        });

        const ptDefs = Array.isArray(defs.translations.pt) ? defs.translations.pt : [];
        ptDefs.forEach(function (def) {
            const node = document.getElementById(inputId("translations", def.key, "pt"));
            if (node) node.value = (state.translations.pt && state.translations.pt[def.key]) || "";
        });
    }

    function buildOverridesFromForm() {
        const payload = {
            meta: {},
            toggles: {},
            fields: {},
            media: {},
            links: {},
            translations: { pt: {} }
        };
        const warnings = [];
        const errors = [];
        const oversizedMediaFields = [];

        defs.meta.forEach(function (def) {
            const node = document.getElementById(inputId("meta", def.key));
            if (!node) return;
            const value = String(node.value || "").trim();
            const defaultValue = String(def.defaultValue || "");
            if (value && value !== defaultValue) payload.meta[def.key] = value;
        });

        defs.toggles.forEach(function (def) {
            const node = document.getElementById(inputId("toggles", def.key));
            if (!node) return;
            const value = !!node.checked;
            const defaultValue = typeof def.defaultValue === "boolean" ? def.defaultValue : true;
            if (value !== defaultValue) payload.toggles[def.key] = value;
        });

        defs.fields.forEach(function (def) {
            const node = document.getElementById(inputId("fields", def.key));
            if (!node) return;
            const mode = def.mode || "text";
            const rawValue = String(node.value || "");
            const value = mode === "html" ? rawValue : rawValue.trim();
            const defaultValue = String(def.defaultValue || "");
            if (value && value !== defaultValue) payload.fields[def.key] = value;
        });

        defs.media.forEach(function (def) {
            const ref = mediaRefs[def.key];
            if (!ref) return;
            const srcValue = normalizeMediaPath(ref.srcInput.value);
            if (srcValue !== ref.srcInput.value) ref.srcInput.value = srcValue;
            const altValue = String(ref.altInput.value || "").trim();
            const defaultSrc = String(def.defaultValue || "");
            const defaultAlt = String(def.defaultAlt || "");

            if (isVideoDataUrl(srcValue)) {
                errors.push("Campo \"" + (def.label || def.key) + "\" usa video em base64. Use caminho/URL do arquivo (ex.: assets/djs/dj1/dj1-video.mp4).");
            } else if (isFilesystemPath(srcValue)) {
                errors.push("Campo \"" + (def.label || def.key) + "\" usa caminho de disco local. No localhost, use caminho relativo do projeto (ex.: assets/djs/dj1/dj1-photo.jpg).");
            } else if (isDataUrl(srcValue) && srcValue.length > MEDIA_IMAGE_DATAURL_SOFT_LIMIT) {
                oversizedMediaFields.push(def.label || def.key);
                errors.push("Campo \"" + (def.label || def.key) + "\" esta muito grande para salvar no navegador. Use caminho local ou URL publica.");
            }

            if (srcValue !== defaultSrc || altValue !== defaultAlt) {
                payload.media[def.key] = {
                    src: srcValue,
                    alt: altValue
                };
            }
        });

        defs.links.forEach(function (def) {
            const node = document.getElementById(inputId("links", def.key));
            if (!node) return;
            const value = String(node.value || "").trim();
            const defaultValue = String(def.defaultValue || "");
            if (value && value !== defaultValue) payload.links[def.key] = value;
        });

        const ptDefs = Array.isArray(defs.translations.pt) ? defs.translations.pt : [];
        ptDefs.forEach(function (def) {
            const node = document.getElementById(inputId("translations", def.key, "pt"));
            if (!node) return;
            const mode = def.mode || "text";
            const rawValue = String(node.value || "");
            const value = mode === "html" ? rawValue : rawValue.trim();
            const defaultValue = String(def.defaultValue || "");
            if (value && value !== defaultValue) payload.translations.pt[def.key] = value;
        });

        if (!Object.keys(payload.translations.pt).length) delete payload.translations.pt;
        if (!Object.keys(payload.meta).length) delete payload.meta;
        if (!Object.keys(payload.toggles).length) delete payload.toggles;
        if (!Object.keys(payload.fields).length) delete payload.fields;
        if (!Object.keys(payload.media).length) delete payload.media;
        if (!Object.keys(payload.links).length) delete payload.links;

        const serialized = JSON.stringify(payload);
        if (serialized.length > STORAGE_SOFT_LIMIT) {
            const message = oversizedMediaFields.length
                ? ("Tamanho excedido por midias grandes: " + oversizedMediaFields.slice(0, 4).join(", ") + ". Use upload para pasta do servidor local ou caminho de arquivo.")
                : "Tamanho dos dados excedeu o limite do navegador. Use upload para pasta do servidor local ou caminho/URL de arquivo.";
            if (canUseRemoteApi()) warnings.push(message);
            else errors.push(message);
        }

        return {
            payload: payload,
            warnings: warnings,
            errors: errors,
            estimatedSize: serialized.length
        };
    }

    function getRoleLabel(role) {
        if (role === "admin") return "Admin";
        if (role === "viewer") return "Viewer";
        return "Editor";
    }

    function formatAuthError(errorCode) {
        const code = String(errorCode || "").trim();
        if (code === "invalid_email") return "E-mail invalido.";
        if (code === "password_too_short") return "A senha precisa ter pelo menos 8 caracteres.";
        if (code === "email_exists") return "Ja existe um usuario com este e-mail.";
        if (code === "cannot_downgrade_current_admin") return "Voce nao pode remover o proprio acesso de admin.";
        if (code === "auth_required") return "Sessao expirada. Entre novamente.";
        if (code === "forbidden") return "Seu usuario nao tem permissao para esta acao.";
        return "Falha ao processar a acao.";
    }

    function resetUserCreateForm() {
        if (newUserEmailInput) newUserEmailInput.value = "";
        if (newUserPassInput) newUserPassInput.value = "";
        if (confirmUserPassInput) confirmUserPassInput.value = "";
        if (newUserRoleInput) newUserRoleInput.value = "editor";
        if (newUserActiveInput) newUserActiveInput.checked = true;
    }

    async function renderUsersList() {
        if (!usersList) return;
        usersList.innerHTML = "";

        const currentUser = typeof cms.getCurrentUser === "function" ? await cms.getCurrentUser(true) : null;
        if (!currentUser || currentUser.role !== "admin") {
            const empty = document.createElement("div");
            empty.className = "user-empty";
            empty.textContent = "Somente administradores podem gerir usuarios.";
            usersList.appendChild(empty);
            return;
        }
        const users = typeof cms.listUsers === "function" ? await cms.listUsers() : [];

        if (!users.length) {
            const empty = document.createElement("div");
            empty.className = "user-empty";
            empty.textContent = "Nenhum usuario cadastrado.";
            usersList.appendChild(empty);
            return;
        }

        users.forEach(function (user) {
            const item = document.createElement("article");
            item.className = "user-item";

            const head = document.createElement("div");
            head.className = "user-item-head";

            const titleWrap = document.createElement("div");
            const title = document.createElement("h4");
            title.className = "user-item-title";
            title.textContent = user.email || "Sem e-mail";

            const meta = document.createElement("p");
            meta.className = "user-item-meta";
            meta.textContent = "Ultimo login: " + (user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "nunca");

            titleWrap.appendChild(title);
            titleWrap.appendChild(meta);

            const badge = document.createElement("span");
            badge.className = "user-item-badge";
            badge.textContent = getRoleLabel(user.role) + (user.active ? " ativo" : " inativo");

            head.appendChild(titleWrap);
            head.appendChild(badge);

            const grid = document.createElement("div");
            grid.className = "user-item-grid";

            const roleWrap = document.createElement("div");
            const roleLabel = document.createElement("label");
            roleLabel.textContent = "Perfil";
            const roleSelect = document.createElement("select");
            roleSelect.innerHTML = '<option value="editor">Editor</option><option value="admin">Admin</option><option value="viewer">Viewer</option>';
            roleSelect.value = user.role || "editor";
            roleWrap.appendChild(roleLabel);
            roleWrap.appendChild(roleSelect);

            const activeWrap = document.createElement("div");
            activeWrap.className = "checkbox-inline";
            const activeInput = document.createElement("input");
            activeInput.type = "checkbox";
            activeInput.id = "active-" + user.id;
            activeInput.checked = user.active !== false;
            const activeLabel = document.createElement("label");
            activeLabel.setAttribute("for", activeInput.id);
            activeLabel.textContent = "Usuario ativo";
            activeWrap.appendChild(activeInput);
            activeWrap.appendChild(activeLabel);

            const passwordWrap = document.createElement("div");
            const passwordLabel = document.createElement("label");
            passwordLabel.textContent = "Nova senha (opcional)";
            const passwordInput = document.createElement("input");
            passwordInput.type = "password";
            passwordInput.placeholder = "Manter senha atual";
            passwordWrap.appendChild(passwordLabel);
            passwordWrap.appendChild(passwordInput);

            grid.appendChild(roleWrap);
            grid.appendChild(activeWrap);
            grid.appendChild(passwordWrap);

            const actions = document.createElement("div");
            actions.className = "actions";

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "btn-secondary";
            saveBtn.textContent = currentUser && currentUser.id === user.id ? "Salvar meu acesso" : "Salvar usuario";

            const status = document.createElement("div");
            status.className = "status";

            saveBtn.addEventListener("click", async function () {
                const payload = {
                    role: roleSelect.value,
                    active: activeInput.checked
                };
                const nextPassword = String(passwordInput.value || "").trim();
                if (nextPassword) payload.password = nextPassword;

                const result = await cms.updateUser(user.id, payload);
                if (!result || !result.ok) {
                    setStatus(status, formatAuthError(result && result.error), "error");
                    return;
                }
                passwordInput.value = "";
                setStatus(status, "Usuario atualizado.", "ok");
                await refreshSessionSummary();
                await renderUsersList();
            });

            actions.appendChild(saveBtn);
            item.appendChild(head);
            item.appendChild(grid);
            item.appendChild(actions);
            item.appendChild(status);
            usersList.appendChild(item);
        });
    }

    async function refreshSessionSummary() {
        if (!sessionSummary) return;
        const currentUser = typeof cms.getCurrentUser === "function" ? await cms.getCurrentUser(true) : null;
        currentSessionUser = currentUser;
        if (!currentUser) {
            setStatus(sessionSummary, "", "");
            return;
        }
        setStatus(sessionSummary, "Sessao ativa: " + currentUser.email + " (" + getRoleLabel(currentUser.role) + ").", "ok");
    }

    function syncUsersCardVisibility() {
        if (!usersCard) return;
        const canManageUsers = !!(currentSessionUser && currentSessionUser.role === "admin");
        usersCard.classList.toggle("hidden", !canManageUsers);
        if (!canManageUsers) {
            setStatus(userCreateStatus, "", "");
            if (usersList) usersList.innerHTML = "";
        }
    }

    function refreshPreview() {
        if (!previewFrame) return;
        previewFrame.src = previewPath + "?previewTs=" + Date.now();
    }

    function setPreviewMode(mode) {
        if (!previewFrameWrap) return;
        const isMobile = mode === "mobile";
        previewFrameWrap.classList.toggle("mobile-mode", isMobile);
        previewDesktopBtn.classList.toggle("is-active", !isMobile);
        previewMobileBtn.classList.toggle("is-active", isMobile);
    }

    function applyFormToStorage() {
        const build = buildOverridesFromForm();
        if (build.errors.length) {
            return {
                ok: false,
                payload: build.payload,
                error: build.errors[0],
                warnings: build.warnings,
                estimatedSize: build.estimatedSize
            };
        }

        const ok = cms.setAllOverrides(build.payload);
        if (!ok) {
            const storageReason = typeof cms.getLastStorageError === "function" ? cms.getLastStorageError() : "";
            const quotaHint = storageReason === "QuotaExceededError" ? " Limite de armazenamento excedido." : "";
            return {
                ok: false,
                payload: build.payload,
                error: "Falha ao salvar no navegador." + quotaHint + " Remova arquivos grandes em base64 e use caminho/URL.",
                warnings: build.warnings,
                estimatedSize: build.estimatedSize
            };
        }

        return {
            ok: true,
            payload: build.payload,
            warnings: build.warnings,
            estimatedSize: build.estimatedSize
        };
    }

    function scheduleLivePreview() {
        if (!livePreviewToggle || !livePreviewToggle.checked) return;
        if (livePreviewTimer) clearTimeout(livePreviewTimer);

        livePreviewTimer = setTimeout(function () {
            const result = applyFormToStorage();
            if (!result.ok) {
                setStatus(panelStatus, result.error || "Falha ao atualizar preview ao vivo.", "error");
                return;
            }
            refreshPreview();
            if (result.warnings && result.warnings.length) {
                setStatus(panelStatus, result.warnings[0], "warn");
            } else {
                setStatus(panelStatus, "Preview atualizado em tempo real (" + hostScopeLabel() + ").", "ok");
            }
        }, 520);
    }

    async function updateAccessState() {
        const loggedIn = await cms.isAuthenticated();
        authCard.classList.toggle("hidden", loggedIn);
        workspaceShell.classList.toggle("hidden", !loggedIn);

        if (!loggedIn) {
            currentSessionUser = null;
            syncUsersCardVisibility();
            return;
        }

        if (loggedIn) {
            renderEditors();
            fillEditors();
            resetUserCreateForm();
            setPreviewMode("mobile");
            refreshPreview();
            await refreshSessionSummary();
            syncUsersCardVisibility();
            if (currentSessionUser && currentSessionUser.role === "admin") {
                await renderUsersList();
            }
            if (window.location.protocol === "file:") {
                setStatus(panelStatus, "Abra o painel pelo servidor local para usar a autenticacao real.", "warn");
            } else {
                setStatus(authStatus, "", "");
                if (typeof cms.hasRemoteApi === "function" && cms.hasRemoteApi() && typeof cms.syncOverridesFromServer === "function") {
                    const pulled = await cms.syncOverridesFromServer();
                    if (pulled && pulled.ok && pulled.changed) {
                        fillEditors();
                        refreshPreview();
                        setStatus(panelStatus, "Overrides sincronizados do servidor local.", "ok");
                    }
                }
            }
        }
    }

    function downloadFile(filename, content) {
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const username = String(formData.get("username") || "");
        const password = String(formData.get("password") || "");

        const ok = await cms.login(username, password);
        if (!ok) {
            setStatus(authStatus, "Usuario ou senha invalidos.", "error");
            return;
        }

        setStatus(authStatus, "Acesso liberado.", "ok");
        await updateAccessState();
    });

    contentForm.addEventListener("input", scheduleLivePreview);
    contentForm.addEventListener("change", scheduleLivePreview);

    saveBtn.addEventListener("click", async function () {
        const build = buildOverridesFromForm();
        if (build.errors.length) {
            setStatus(panelStatus, build.errors[0] || "Falha ao salvar. Verifique permissoes de armazenamento do navegador.", "error");
            return;
        }

        let localSaved = cms.setAllOverrides(build.payload);
        let remoteSaved = { ok: false, skipped: true };

        if (canUseRemoteApi() && typeof cms.syncOverridesToServer === "function") {
            remoteSaved = await cms.syncOverridesToServer(build.payload);
            if (remoteSaved && remoteSaved.ok) {
                if (!localSaved) {
                    // Mantem o fluxo funcional no localhost/mobile mesmo quando o storage local atinge limite.
                    localSaved = true;
                }
            }
        }

        if (!localSaved) {
            setStatus(panelStatus, "Falha ao salvar localmente. Reduza uploads em base64 ou habilite servidor local para sincronizacao.", "error");
            return;
        }

        refreshPreview();
        if (build.warnings && build.warnings.length) {
            setStatus(panelStatus, "Salvo com alerta: " + build.warnings[0], "warn");
        } else if (canUseRemoteApi() && (!remoteSaved || !remoteSaved.ok)) {
            setStatus(panelStatus, "Salvo no navegador, mas sem sincronizacao com servidor local.", "warn");
        } else {
            setStatus(panelStatus, "Alteracoes salvas com sucesso no host " + hostScopeLabel() + ".", "ok");
        }
    });

    resetBtn.addEventListener("click", async function () {
        if (!window.confirm("Remover todos os overrides e voltar ao padrao?")) return;
        cms.clearOverrides();
        if (typeof cms.hasRemoteApi === "function" && cms.hasRemoteApi() && typeof cms.syncOverridesToServer === "function") {
            await cms.syncOverridesToServer({});
        }
        fillEditors();
        refreshPreview();
        setStatus(panelStatus, "Overrides removidos. Conteudo voltou para o padrao.", "warn");
    });

    exportBtn.addEventListener("click", function () {
        const json = cms.exportOverrides();
        const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
        downloadFile("hardware-overrides-" + stamp + ".json", json);
        setStatus(panelStatus, "Arquivo JSON exportado.", "ok");
    });

    importBtn.addEventListener("click", function () {
        importFile.value = "";
        importFile.click();
    });

    importFile.addEventListener("change", function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function () {
            const result = cms.importOverrides(String(reader.result || ""));
            if (!result.ok) {
                setStatus(panelStatus, result.error || "Falha ao importar JSON.", "error");
                return;
            }
            if (typeof cms.hasRemoteApi === "function" && cms.hasRemoteApi() && typeof cms.syncOverridesToServer === "function") {
                await cms.syncOverridesToServer(cms.getOverrides());
            }
            fillEditors();
            refreshPreview();
            setStatus(panelStatus, "JSON importado com sucesso.", "ok");
        };
        reader.readAsText(file);
    });

    logoutBtn.addEventListener("click", async function () {
        await cms.logout();
        await updateAccessState();
        setStatus(authStatus, "Sessao encerrada.", "warn");
    });

    refreshPreviewBtn.addEventListener("click", async function () {
        const result = applyFormToStorage();
        if (!result.ok) {
            if (canUseRemoteApi() && typeof cms.syncOverridesToServer === "function") {
                const build = buildOverridesFromForm();
                if (build.errors.length) {
                    setStatus(panelStatus, build.errors[0] || "Falha ao atualizar preview.", "error");
                    return;
                }
                const remoteSaved = await cms.syncOverridesToServer(build.payload);
                if (remoteSaved && remoteSaved.ok) {
                    refreshPreview();
                    setStatus(panelStatus, "Preview atualizado via servidor local.", "ok");
                    return;
                }
            }
            setStatus(panelStatus, result.error || "Falha ao atualizar preview.", "error");
            return;
        }
        refreshPreview();
        if (result.warnings && result.warnings.length) {
            setStatus(panelStatus, result.warnings[0], "warn");
        } else {
            setStatus(panelStatus, "Preview atualizado.", "ok");
        }
    });

    previewDesktopBtn.addEventListener("click", function () {
        setPreviewMode("desktop");
    });

    previewMobileBtn.addEventListener("click", function () {
        setPreviewMode("mobile");
    });

    livePreviewToggle.addEventListener("change", function () {
        if (!livePreviewToggle.checked) {
            setStatus(panelStatus, "Preview em tempo real desativado.", "warn");
            return;
        }
        scheduleLivePreview();
    });

    openPreviewTabBtn.addEventListener("click", async function () {
        const result = applyFormToStorage();
        if (!result.ok) {
            if (canUseRemoteApi() && typeof cms.syncOverridesToServer === "function") {
                const build = buildOverridesFromForm();
                if (build.errors.length) {
                    setStatus(panelStatus, build.errors[0] || "Falha ao abrir preview em nova aba.", "error");
                    return;
                }
                const remoteSaved = await cms.syncOverridesToServer(build.payload);
                if (!(remoteSaved && remoteSaved.ok)) {
                    setStatus(panelStatus, "Falha ao abrir preview em nova aba.", "error");
                    return;
                }
            } else {
                setStatus(panelStatus, result.error || "Falha ao abrir preview em nova aba.", "error");
                return;
            }
        }
        window.open(previewPath + "?previewTs=" + Date.now(), "_blank", "noopener");
    });

    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener("click", async function () {
            if (!currentSessionUser || currentSessionUser.role !== "admin") return;
            await refreshSessionSummary();
            await renderUsersList();
            setStatus(userCreateStatus, "Lista de usuarios atualizada.", "ok");
        });
    }

    if (userCreateForm) {
        userCreateForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (!currentSessionUser || currentSessionUser.role !== "admin") {
                setStatus(userCreateStatus, "Seu perfil nao pode cadastrar usuarios.", "error");
                return;
            }
            const email = String(newUserEmailInput ? newUserEmailInput.value : "").trim().toLowerCase();
            const password = String(newUserPassInput ? newUserPassInput.value : "").trim();
            const confirm = String(confirmUserPassInput ? confirmUserPassInput.value : "").trim();
            const role = String(newUserRoleInput ? newUserRoleInput.value : "editor").trim().toLowerCase();
            const active = !!(newUserActiveInput && newUserActiveInput.checked);

            if (!email || !password) {
                setStatus(userCreateStatus, "E-mail e senha sao obrigatorios.", "error");
                return;
            }

            if (password !== confirm) {
                setStatus(userCreateStatus, "As senhas nao conferem.", "error");
                return;
            }

            const result = await cms.createUser({
                email: email,
                password: password,
                role: role,
                active: active
            });

            if (!result || !result.ok) {
                setStatus(userCreateStatus, formatAuthError(result && result.error), "error");
                return;
            }

            resetUserCreateForm();
            await renderUsersList();
            setStatus(userCreateStatus, "Usuario cadastrado com sucesso.", "ok");
        });
    }

    updateAccessState();
}());
