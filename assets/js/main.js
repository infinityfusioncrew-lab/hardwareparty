                function debounce(fn, wait) {
            let timer = null;
            return function debounced() {
                const context = this;
                const args = arguments;
                clearTimeout(timer);
                timer = setTimeout(function () {
                    fn.apply(context, args);
                }, wait);
            };
        }

        function sanitizeClassList(rawValue) {
            return String(rawValue || '')
                .split(/\s+/)
                .filter(function (token) {
                    return /^[a-zA-Z0-9_-]{1,64}$/.test(token);
                })
                .join(' ');
        }

        function sanitizeLimitedHtml(rawValue) {
            const html = String(rawValue || '');
            if (!html) return '';
            if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
                return html.replace(/<[^>]*>/g, '');
            }

            const template = document.createElement('template');
            template.innerHTML = html;
            const allowedTags = { B: true, BR: true, EM: true, I: true, SMALL: true, SPAN: true, STRONG: true, U: true };

            function cleanNode(node) {
                if (!node) return null;
                if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
                if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode('');

                const tagName = String(node.tagName || '').toUpperCase();
                if (!allowedTags[tagName]) {
                    return document.createTextNode(node.textContent || '');
                }

                const cleanEl = document.createElement(tagName.toLowerCase());
                const safeClass = sanitizeClassList(node.getAttribute('class'));
                if (safeClass) cleanEl.setAttribute('class', safeClass);
                Array.from(node.childNodes || []).forEach(function (child) {
                    cleanEl.appendChild(cleanNode(child));
                });
                return cleanEl;
            }

            const wrapper = document.createElement('div');
            Array.from(template.content.childNodes || []).forEach(function (child) {
                wrapper.appendChild(cleanNode(child));
            });
            return wrapper.innerHTML;
        }

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
        const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        const coarsePointerQuery = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
        let performanceMode = 'full';

        function evaluatePerformanceMode() {
            const memory = Number(navigator.deviceMemory || 0);
            const cores = Number(navigator.hardwareConcurrency || 0);
            const smallScreen = window.innerWidth <= 820;
            const lowMemory = memory > 0 && memory <= 2;
            const lowCpu = cores > 0 && cores <= 4;
            const reducedMotion = !!(reduceMotionQuery && reduceMotionQuery.matches);
            const coarsePointer = !!(coarsePointerQuery && coarsePointerQuery.matches);
            const saveData = !!(connection && connection.saveData);
            const slowNetwork = !!(connection && /(^|-)2g$|slow-2g/i.test(String(connection.effectiveType || '')));
            const lowPower = lowMemory || lowCpu || saveData || slowNetwork || reducedMotion;
            if (lowPower) return 'lite';
            if (smallScreen && coarsePointer) return 'balanced';
            return 'full';
        }

        function applyPerformanceMode(nextMode) {
            performanceMode = nextMode || 'full';
            document.body.classList.toggle('performance-lite', performanceMode === 'lite');
            document.body.classList.toggle('performance-balanced', performanceMode === 'balanced');
            window.__hardwarePerformanceMode = performanceMode;
        }

        function syncViewportEffectsMode() {
            const desktopMode = performanceMode === 'full' && window.innerWidth >= 1180;
            document.body.classList.toggle('desktop-cinematic', desktopMode);
        }

        const refreshPerformanceMode = debounce(function () {
            const prevMode = performanceMode;
            applyPerformanceMode(evaluatePerformanceMode());
            syncViewportEffectsMode();
            if (prevMode !== performanceMode && typeof window.__restartHardwareParticles === 'function') {
                window.__restartHardwareParticles();
            }
        }, 180);

        applyPerformanceMode(evaluatePerformanceMode());
        syncViewportEffectsMode();
        window.addEventListener('resize', refreshPerformanceMode, { passive: true });
        if (connection && typeof connection.addEventListener === 'function') {
            connection.addEventListener('change', refreshPerformanceMode);
        }
        if (reduceMotionQuery) {
            if (typeof reduceMotionQuery.addEventListener === 'function') {
                reduceMotionQuery.addEventListener('change', refreshPerformanceMode);
            } else if (typeof reduceMotionQuery.addListener === 'function') {
                reduceMotionQuery.addListener(refreshPerformanceMode);
            }
        }

        // PRELOADER
        const preloader = document.getElementById('preloader');
        const loaderFill = document.getElementById('loader-bar-fill');
        const loaderProgress = document.getElementById('loader-progress');
        const loaderPhase = document.getElementById('loader-phase');
        const PRELOAD_MAX_MS = performanceMode === 'lite' ? 950 : 1350;
        const PRELOAD_MIN_MS = 280;
        const preloadStart = Date.now();
        let preloadValue = 0;
        let pageIsReady = false;
        let preloaderClosed = false;
        const preloadPhases = [
            'SINCRONIZANDO PISTA',
            'ALINHANDO SINAL',
            'LIBERANDO ACESSO'
        ];

        function setPreloadValue(value) {
            const clamped = Math.max(0, Math.min(100, value));
            preloadValue = clamped;
            if (loaderFill) loaderFill.style.width = `${clamped}%`;
            if (loaderProgress) loaderProgress.textContent = `${Math.round(clamped)}%`;
            if (loaderPhase) {
                const phaseIndex = Math.min(preloadPhases.length - 1, Math.floor((clamped / 100) * preloadPhases.length));
                loaderPhase.textContent = preloadPhases[phaseIndex];
            }
        }

        function closePreloader() {
            if (preloaderClosed) return;
            if (!preloader) {
                preloaderClosed = true;
                document.body.classList.add('loaded');
                return;
            }
            preloaderClosed = true;
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
                requestAnimationFrame(() => {
                    document.body.classList.add('loaded');
                });
            }, 320);
        }

        function markPageReady() {
            pageIsReady = true;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                requestAnimationFrame(markPageReady);
            }, { once: true });
        } else {
            markPageReady();
        }
        setTimeout(markPageReady, 900);

        const preloadTimer = setInterval(() => {
            const elapsed = Date.now() - preloadStart;

            if (!pageIsReady) {
                const simulated = Math.min(96, (elapsed / PRELOAD_MAX_MS) * 100);
                setPreloadValue(Math.max(preloadValue, simulated));
            } else {
                setPreloadValue(preloadValue + (performanceMode === 'lite' ? 8 : 5.6));
            }

            const reachedMax = elapsed >= PRELOAD_MAX_MS;
            const hiddenFastExit = document.hidden && elapsed > PRELOAD_MIN_MS + 120;
            const canCloseByReady = pageIsReady && elapsed >= PRELOAD_MIN_MS && preloadValue >= 99;

            if (reachedMax || hiddenFastExit || canCloseByReady) {
                setPreloadValue(100);
                clearInterval(preloadTimer);
                closePreloader();
            }
        }, 50);
function safeStorageGet(storageName, key) {
            try {
                const storageObj = window[storageName];
                if (!storageObj) return null;
                return storageObj.getItem(key);
            } catch (e) {
                return null;
            }
        }
        function safeStorageSet(storageName, key, value) {
            try {
                const storageObj = window[storageName];
                if (!storageObj) return false;
                storageObj.setItem(key, value);
                return true;
            } catch (e) {
                return false;
            }
        }

        const cmsOverrideKey = (window.HARDWARE_SITE_CONFIG &&
            window.HARDWARE_SITE_CONFIG.storageKeys &&
            window.HARDWARE_SITE_CONFIG.storageKeys.overrides) || 'hardwareSiteOverrides.v1';
        let cmsReloadTimer = null;
        window.addEventListener('storage', (event) => {
            if (!event || event.key !== cmsOverrideKey) return;
            if (cmsReloadTimer) clearTimeout(cmsReloadTimer);
            cmsReloadTimer = setTimeout(() => {
                window.location.reload();
            }, 140);
        });

        // COOKIE BANNER LOGIC
        if (safeStorageGet('localStorage', 'cookiesAccepted') !== 'true') {
            setTimeout(() => {
                const cookieBanner = document.getElementById('cookie-banner');
                if (cookieBanner) cookieBanner.classList.add('show');
            }, 2000);
        }
        function acceptCookies() {
            safeStorageSet('localStorage', 'cookiesAccepted', 'true');
            const cookieBanner = document.getElementById('cookie-banner');
            if (cookieBanner) cookieBanner.classList.remove('show');
        }

                // CANVAS
        const canvas = document.getElementById('particles-canvas');
        const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;
        let particlesArray = [];
        let isMobile = window.innerWidth < 768;
        let animationId = null;
        let frameCount = 0;
        let particleResizeTimer = null;

        function shouldDisableParticles() {
            return performanceMode === 'lite' || !!(reduceMotionQuery && reduceMotionQuery.matches);
        }

        class Particle {
            constructor() {
                this.reset(true);
            }
            reset(initial) {
                if (!canvas) return;
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                const compact = performanceMode !== 'full';
                this.size = Math.random() * (compact ? 1.5 : (isMobile ? 1.8 : 2.2)) + 0.35;
                this.speedX = (Math.random() - 0.5) * (compact ? 0.28 : (isMobile ? 0.32 : 0.42));
                this.speedY = (Math.random() - 0.5) * (compact ? 0.28 : (isMobile ? 0.32 : 0.42));
                this.color = Math.random() > 0.82 ? 'rgba(0, 243, 255, 0.86)' : 'rgba(120, 220, 255, 0.55)';
                if (!initial) {
                    this.x = Math.random() > 0.5 ? 0 : canvas.width;
                    this.y = Math.random() * canvas.height;
                }
            }
            update() {
                if (!canvas) return;
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x < -3 || this.x > canvas.width + 3 || this.y < -3 || this.y > canvas.height + 3) {
                    this.reset(false);
                }
            }
            draw() {
                if (!ctx) return;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function configureCanvasSize() {
            if (!canvas) return;
            const ratio = Math.min(window.devicePixelRatio || 1, performanceMode === 'full' ? 1.5 : 1.1);
            const width = Math.floor(window.innerWidth * ratio);
            const height = Math.floor(window.innerHeight * ratio);
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';
            if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        }

        function initParticles() {
            if (!canvas || !ctx) return;
            particlesArray = [];
            if (shouldDisableParticles()) return;
            const total = performanceMode === 'full' ? (isMobile ? 28 : 74) : (isMobile ? 18 : 34);
            for (let i = 0; i < total; i++) particlesArray.push(new Particle());
        }

        function connectParticles() {
            if (!ctx || !canvas || performanceMode !== 'full') return;
            const maxDistance = isMobile ? 68 : 114;
            const maxDistanceSq = maxDistance * maxDistance;

            for (let i = 0; i < particlesArray.length; i++) {
                const p1 = particlesArray[i];
                for (let j = i + 1; j < particlesArray.length; j++) {
                    const p2 = particlesArray[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < maxDistanceSq) {
                        const alpha = 0.2 * (1 - distSq / maxDistanceSq);
                        ctx.strokeStyle = `rgba(0, 243, 255, ${alpha * 0.72})`;
                        ctx.lineWidth = 0.52;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }
        }

        function animateParticles() {
            if (!canvas || !ctx) return;
            if (shouldDisableParticles()) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                animationId = null;
                return;
            }
            frameCount++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].update();
                particlesArray[i].draw();
            }
            if (performanceMode === 'full') {
                if (!isMobile || frameCount % 2 === 0) connectParticles();
            } else if (frameCount % 3 === 0) {
                connectParticles();
            }
            animationId = requestAnimationFrame(animateParticles);
        }

        function stopParticles() {
            if (animationId !== null) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }

        function restartParticles() {
            stopParticles();
            isMobile = window.innerWidth < 768;
            configureCanvasSize();
            initParticles();
            if (!document.hidden && !shouldDisableParticles()) {
                animateParticles();
            } else if (ctx && canvas) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        window.__restartHardwareParticles = restartParticles;

        if (canvas && ctx) {
            configureCanvasSize();
            initParticles();
            if (!shouldDisableParticles()) animateParticles();

            window.addEventListener('resize', function () {
                if (particleResizeTimer) clearTimeout(particleResizeTimer);
                particleResizeTimer = setTimeout(restartParticles, 140);
            }, { passive: true });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    stopParticles();
                } else if (!shouldDisableParticles()) {
                    restartParticles();
                }
            });
        }
// NEWSLETTER
        function handleNewsletter(e) {
            e.preventDefault(); const form = e.target; const btn = form.querySelector('.newsletter-btn'); const msg = document.getElementById('newsletter-success'); const data = new FormData(form);
            const originalBtnText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.style.opacity = '0.7'; btn.disabled = true;
            fetch(form.action, { method: form.method, body: data, headers: { 'Accept': 'application/json' } }).then(response => {
                if (response.ok) { form.style.display = 'none'; msg.style.display = 'block'; } 
                else { response.json().then(data => { alert("Erro ao enviar."); }); btn.innerHTML = originalBtnText; btn.style.opacity = '1'; btn.disabled = false; }
            }).catch(error => { alert("Erro de conexao."); btn.innerHTML = originalBtnText; btn.style.opacity = '1'; btn.disabled = false; });
        }

                // SCROLL REVEAL & DECODE EFFECT
        function applyStagger(container) {
            const items = container.querySelectorAll('[data-stagger]');
            items.forEach((item, index) => {
                item.style.setProperty('--stagger-delay', `${index * 95}ms`);
            });
        }

        const revealTargets = Array.from(document.querySelectorAll('.reveal'));

        const nightPhaseStage = document.getElementById('night-phase-stage');
        const nightPhaseTitle = document.getElementById('night-phase-title');
        const nightPhaseText = document.getElementById('night-phase-text');
        const nightPhaseMetric1 = document.getElementById('night-phase-metric-1');
        const nightPhaseMetric2 = document.getElementById('night-phase-metric-2');
        const nightPhaseMetric3 = document.getElementById('night-phase-metric-3');
        const nightPhaseTabs = Array.from(document.querySelectorAll('.night-phase-tab'));
        const nightPhaseStates = {
            warmup: {
                title: '20H / CHEGADA',
                text: 'Primeiro contato com a festa: fila controlada, lista VIP em andamento, bar ganhando movimento e pista ainda respirando espaço. E a fase em que o publico chega, reconhece o lugar, encontra os amigos e entende a proposta da noite sem atropelo.',
                metrics: ['ENTRADA / LISTA VIP', 'LUZ / SUBIDA GRADUAL', 'FLUXO / CHEGADA']
            },
            peak: {
                title: '01H / PICO',
                text: 'Nesse ponto a pista ja esta tomada, o bar opera no auge, a luz fica mais agressiva e a energia coletiva sobe de verdade. E a fase em que o corpo responde mais ao grave, a cabine chama o publico para frente e a noite entrega seu momento mais intenso.',
                metrics: ['PISTA / DENSIDADE MAXIMA', 'LUZ / IMPACTO DIRETO', 'ENERGIA / PRESSAO TOTAL']
            },
            closing: {
                title: '04H / ENCERRAMENTO',
                text: 'Na reta final a madrugada muda de temperatura: menos ansiedade de chegada e mais sensacao de travessia completa. E quando sobra resistencia de pista, conversa de canto, memoria de set e aquele clima de fim de noite que continua no corpo mesmo depois da saida.',
                metrics: ['MADRUGADA / RITO FINAL', 'CLIMA / BAIXA LUZ', 'MEMORIA / FIM DE NOITE']
            }
        };

        function setNightPhase(phaseKey) {
            if (!nightPhaseStage || !nightPhaseTitle || !nightPhaseText) return;
            const phase = nightPhaseStates[phaseKey] || nightPhaseStates.warmup;
            nightPhaseStage.classList.remove('is-warmup', 'is-peak', 'is-closing');
            nightPhaseStage.classList.add('is-' + (phaseKey || 'warmup'));
            nightPhaseTitle.textContent = phase.title;
            nightPhaseText.textContent = phase.text;
            if (nightPhaseMetric1) nightPhaseMetric1.textContent = phase.metrics[0];
            if (nightPhaseMetric2) nightPhaseMetric2.textContent = phase.metrics[1];
            if (nightPhaseMetric3) nightPhaseMetric3.textContent = phase.metrics[2];
            nightPhaseTabs.forEach((tab) => {
                tab.classList.toggle('is-active', tab.dataset.phase === phaseKey);
            });
        }

        if (nightPhaseTabs.length) {
            nightPhaseTabs.forEach((tab) => {
                tab.addEventListener('click', () => {
                    setNightPhase(tab.dataset.phase || 'warmup');
                });
            });
            setNightPhase('warmup');
        }

        function revealElement(target) {
            if (!target || target.classList.contains('active')) return;
            applyStagger(target);
            target.classList.add('active');
        }

        function checkRevealFallback() {
            const windowHeight = window.innerHeight;
            for (let i = 0; i < revealTargets.length; i++) {
                const target = revealTargets[i];
                if (!target || target.classList.contains('active')) continue;
                const elementTop = target.getBoundingClientRect().top;
                if (elementTop < windowHeight - 52) revealElement(target);
            }
        }

        if ('IntersectionObserver' in window) {
            const revealObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    revealElement(entry.target);
                    observer.unobserve(entry.target);
                });
            }, {
                root: null,
                threshold: 0.12,
                rootMargin: '0px 0px -8% 0px'
            });
            revealTargets.forEach((target) => revealObserver.observe(target));
        } else {
            window.addEventListener('scroll', debounce(checkRevealFallback, 80), { passive: true });
            checkRevealFallback();
        }

        const heroTitle = document.getElementById('main-title');
        let scrollFxRaf = null;
        function applyScrollFx() {
            const y = window.scrollY || 0;
            if (heroTitle && performanceMode === 'full') {
                heroTitle.style.transform = `translate3d(0, ${Math.min(y * 0.05, 26)}px, 0)`;
            } else if (heroTitle) {
                heroTitle.style.transform = 'translate3d(0,0,0)';
            }
            scrollFxRaf = null;
        }
        function onScrollFx() {
            if (scrollFxRaf !== null) return;
            scrollFxRaf = requestAnimationFrame(applyScrollFx);
        }
        window.addEventListener('scroll', onScrollFx, { passive: true });
        requestAnimationFrame(() => {
            applyScrollFx();
            if (!('IntersectionObserver' in window)) checkRevealFallback();
        });
// MATRIX / DECODE TEXT EFFECT LOGIC
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
        const textElements = document.querySelectorAll(".scramble-text");

        function runScramble(target) {
            if (!target || target.dataset.scrambleDone === '1') {
                if (target && target.dataset && target.dataset.value) target.textContent = target.dataset.value;
                return;
            }
            let iteration = 0;
            const originalText = target.dataset.value || target.textContent;
            clearInterval(target.interval);

            target.interval = setInterval(() => {
                target.textContent = originalText
                    .split("")
                    .map((char, index) => {
                        if (char === " ") return " ";
                        if (index < iteration) return originalText[index];
                        return letters[Math.floor(Math.random() * letters.length)];
                    })
                    .join("");

                if (iteration >= originalText.length) {
                    target.textContent = originalText;
                    target.dataset.scrambleDone = '1';
                    clearInterval(target.interval);
                }

                iteration += 1 / 3;
            }, 30);
        }

        textElements.forEach(el => {
            el.dataset.value = el.textContent;
        });
        if (performanceMode === 'lite') {
            textElements.forEach(el => {
                el.textContent = el.dataset.value || el.textContent;
                el.dataset.scrambleDone = '1';
            });
        } else if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    runScramble(entry.target);
                    observer.unobserve(entry.target);
                });
            }, { threshold: 0.5 });
            textElements.forEach(el => observer.observe(el));
        } else {
            textElements.forEach(el => runScramble(el));
        }

        function normalizeLocalMediaPath(rawValue) {
            let value = String(rawValue || '').trim();
            if (!value) return '';
            if (/^(data:|https?:\/\/|blob:|\/\/)/i.test(value)) return value;

            if (/^file:\/\//i.test(value)) {
                try {
                    value = decodeURIComponent(value.replace(/^file:\/+/, ''));
                } catch (_) {
                    value = value.replace(/^file:\/+/, '');
                }
            }

            value = value.replace(/\\/g, '/');
            const assetMatch = value.match(/(?:^|\/)(assets\/.+)$/i);
            if (assetMatch) value = assetMatch[1];
            if (!assetMatch && /^[a-zA-Z]:\//.test(value)) return '';
            value = value.replace(/^\.\/+/, '');
            return encodeURI(value);
        }

        function withMediaBust(rawValue, token) {
            const src = normalizeLocalMediaPath(rawValue);
            if (!src || /^(data:|https?:\/\/|blob:|\/\/)/i.test(src)) return src;

            const hashIndex = src.indexOf('#');
            const hash = hashIndex >= 0 ? src.slice(hashIndex) : '';
            const withoutHash = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
            const queryIndex = withoutHash.indexOf('?');
            const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
            const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';
            const params = new URLSearchParams(query);
            params.set('mt', token);
            const nextQuery = params.toString();
            return path + (nextQuery ? '?' + nextQuery : '') + hash;
        }

        function refreshDjMediaSources() {
            const token = String(Date.now());
            const selectors = [
                "[id^='dj'][id$='-photo']",
                "[id^='dj'][id$='-logo']"
            ];
            document.querySelectorAll(selectors.join(',')).forEach((el) => {
                const current = String(el.getAttribute('src') || '').trim();
                if (!current) return;
                const next = withMediaBust(current, token);
                if (next && next !== current) el.setAttribute('src', next);
            });
        }
        refreshDjMediaSources();

        function initMapPreviewLazy() {
            const mapFrame = document.getElementById('map-preview-iframe');
            if (!mapFrame) return;

            const loadMap = () => {
                if (mapFrame.dataset.loaded === '1') return;
                const nextSrc = String(mapFrame.getAttribute('data-src') || mapFrame.getAttribute('src') || '').trim();
                if (!nextSrc) return;
                mapFrame.setAttribute('src', nextSrc);
                mapFrame.dataset.loaded = '1';
            };

            if (mapFrame.getAttribute('src')) {
                mapFrame.dataset.loaded = '1';
                return;
            }

            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries, obs) => {
                    entries.forEach((entry) => {
                        if (!entry.isIntersecting) return;
                        loadMap();
                        obs.disconnect();
                    });
                }, {
                    root: null,
                    threshold: 0.05,
                    rootMargin: performanceMode === 'lite' ? '40px 0px' : '220px 0px'
                });
                observer.observe(mapFrame);
            } else {
                const loadOnIntent = () => {
                    loadMap();
                    document.removeEventListener('pointerdown', loadOnIntent, true);
                    document.removeEventListener('touchstart', loadOnIntent, true);
                };
                document.addEventListener('pointerdown', loadOnIntent, true);
                document.addEventListener('touchstart', loadOnIntent, true);
            }
        }
        initMapPreviewLazy();

        function initDjLogos() {
            document.querySelectorAll('.dj-logo-wrap').forEach((wrap) => {
                const logo = wrap.querySelector('.dj-logo-img');
                if (!logo) return;

                const showFallback = () => wrap.classList.add('show-logo-fallback');
                const hideFallback = () => wrap.classList.remove('show-logo-fallback');

                logo.addEventListener('error', showFallback);
                logo.addEventListener('load', () => {
                    if (logo.naturalWidth > 0) hideFallback();
                    else showFallback();
                });

                if (!logo.getAttribute('src')) showFallback();
                else if (logo.complete && logo.naturalWidth === 0) showFallback();
            });
        }
        initDjLogos();

        function normalizeDjCardLayout() {
            document.querySelectorAll('.artist-card').forEach((card) => {
                const mediaWrap = card.querySelector('.lineup-photo-wrap');
                const body = card.querySelector('.lineup-body');
                if (!mediaWrap || !body) return;
                if (body.parentElement !== mediaWrap) mediaWrap.appendChild(body);
            });
        }
        normalizeDjCardLayout();

        function renderAlphabeticalLineup() {
            const list = document.getElementById('alphabetical-lineup-list');
            if (!list) return;

            const fallbackNames = Array.from(list.querySelectorAll('.alphabetical-lineup-name, .alphabetical-lineup-item'))
                .map((item) => String(item.textContent || '').trim())
                .filter(Boolean);
            const names = [];
            for (let djIndex = 1; djIndex <= 9; djIndex++) {
                const card = document.getElementById('dj-card-' + djIndex);
                const nameEl = document.getElementById('dj' + djIndex + '-name');
                if (!nameEl) continue;
                if (card && card.classList.contains('cms-hidden')) continue;

                const name = String(nameEl.textContent || '').trim();
                if (!name) continue;
                names.push(name);
            }

            const resolvedNames = (names.length ? names : fallbackNames)
                .filter((name, index, collection) => collection.indexOf(name) === index)
                .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
            list.innerHTML = '';
            list.className = 'alphabetical-lineup-layout';

            if (!resolvedNames.length) {
                const empty = document.createElement('span');
                empty.className = 'alphabetical-lineup-empty';
                empty.setAttribute('data-translate', 'alpha_lineup_empty');
                empty.textContent = 'NOMES EM ATUALIZACAO';
                list.appendChild(empty);
                return;
            }

            resolvedNames.forEach((name) => {
                const label = document.createElement('span');
                label.className = 'alphabetical-lineup-name';
                label.textContent = name;
                list.appendChild(label);
            });
        }
        renderAlphabeticalLineup();

        function initScheduleInteractions() {
            const scheduleRows = document.querySelectorAll('.dj-schedule-row');
            if (!scheduleRows.length) return;
            const liveTiltEnabled = performanceMode === 'full' && !(coarsePointerQuery && coarsePointerQuery.matches);

            scheduleRows.forEach((row) => {
                const card = row.querySelector('.dj-schedule-card');
                if (!card) return;
                let touchResetTimer = null;

                function updateTilt(clientX, clientY) {
                    const rect = card.getBoundingClientRect();
                    if (!rect.width || !rect.height) return;

                    const relativeX = (clientX - rect.left) / rect.width;
                    const relativeY = (clientY - rect.top) / rect.height;
                    const tiltY = ((relativeX - 0.5) * 6).toFixed(2);
                    const tiltX = (((0.5 - relativeY) * 4)).toFixed(2);

                    row.style.setProperty('--schedule-tilt-x', tiltX + 'deg');
                    row.style.setProperty('--schedule-tilt-y', tiltY + 'deg');
                    row.style.setProperty('--schedule-glow-x', (relativeX * 100).toFixed(1) + '%');
                    row.style.setProperty('--schedule-glow-y', (relativeY * 100).toFixed(1) + '%');
                }

                function resetTilt() {
                    row.classList.remove('is-active');
                    row.style.removeProperty('--schedule-tilt-x');
                    row.style.removeProperty('--schedule-tilt-y');
                    row.style.removeProperty('--schedule-glow-x');
                    row.style.removeProperty('--schedule-glow-y');
                }

                card.addEventListener('pointerenter', () => {
                    row.classList.add('is-active');
                });
                if (liveTiltEnabled) {
                    card.addEventListener('pointermove', (event) => {
                        row.classList.add('is-active');
                        updateTilt(event.clientX, event.clientY);
                    });
                }
                card.addEventListener('pointerdown', (event) => {
                    row.classList.add('is-active');
                    if (liveTiltEnabled) {
                        updateTilt(event.clientX, event.clientY);
                    } else {
                        if (touchResetTimer) clearTimeout(touchResetTimer);
                        touchResetTimer = setTimeout(resetTilt, 260);
                    }
                });
                ['pointerup', 'pointerleave', 'pointercancel'].forEach((eventName) => {
                    card.addEventListener(eventName, resetTilt);
                });
            });
        }
        initScheduleInteractions();

        function initLineupCardDrag() {
            const lineupGrid = document.querySelector('.lineup-grid');
            if (!lineupGrid) return;
            if (lineupGrid.closest('.cms-hidden')) return;
            const cards = Array.from(lineupGrid.querySelectorAll('.artist-card'));
            if (!cards.length) return;

            let active = false;
            let startX = 0;
            let initialScrollLeft = 0;
            let dragMoved = false;
            const dragThreshold = 4;

            const snapToNearestCard = () => {
                const gridRect = lineupGrid.getBoundingClientRect();
                const targetX = gridRect.left + gridRect.width / 2;
                let bestCard = cards[0];
                let bestDistance = Number.POSITIVE_INFINITY;

                cards.forEach((card) => {
                    const rect = card.getBoundingClientRect();
                    const center = rect.left + rect.width / 2;
                    const distance = Math.abs(center - targetX);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestCard = card;
                    }
                });

                const targetLeft = bestCard.offsetLeft - Math.max(0, (lineupGrid.clientWidth - bestCard.clientWidth) / 2);
                lineupGrid.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
            };

            const begin = (x) => {
                active = true;
                dragMoved = false;
                lineupGrid.dataset.dragJustEnded = '';
                startX = x;
                initialScrollLeft = lineupGrid.scrollLeft;
                lineupGrid.classList.add('is-grabbing');
                lineupGrid.classList.add('is-dragging');
                lineupGrid.style.scrollSnapType = 'none';
                lineupGrid.style.scrollBehavior = 'auto';
                document.body.style.cursor = 'grabbing';
            };

            const move = (x) => {
                if (!active) return;
                const walk = x - startX;
                if (Math.abs(walk) > dragThreshold) dragMoved = true;
                lineupGrid.scrollLeft = initialScrollLeft - walk;
            };

            const end = () => {
                if (!active) return;
                active = false;
                lineupGrid.classList.remove('is-grabbing');
                lineupGrid.classList.remove('is-dragging');
                document.body.style.cursor = '';
                lineupGrid.style.scrollSnapType = '';
                lineupGrid.style.scrollBehavior = '';
                if (dragMoved) {
                    lineupGrid.dataset.dragJustEnded = '1';
                    setTimeout(() => { lineupGrid.dataset.dragJustEnded = ''; }, 180);
                    snapToNearestCard();
                }
            };

            lineupGrid.addEventListener('mousedown', (event) => {
                if (event.button !== 0) return;
                if (event.target && event.target.closest('.preview-controls, button, input, a')) return;
                event.preventDefault();
                begin(event.pageX);
            });
            window.addEventListener('mousemove', (event) => {
                if (!active) return;
                event.preventDefault();
                move(event.pageX);
            });
            window.addEventListener('mouseup', end);

            lineupGrid.addEventListener('touchstart', (event) => {
                if (!event.touches || !event.touches[0]) return;
                const touchTarget = event.target;
                if (touchTarget && touchTarget.closest && touchTarget.closest('.preview-controls, button, input, a')) return;
                event.preventDefault();
                begin(event.touches[0].pageX);
            }, { passive: false });
            lineupGrid.addEventListener('touchmove', (event) => {
                if (!event.touches || !event.touches[0]) return;
                event.preventDefault();
                move(event.touches[0].pageX);
            }, { passive: false });
            lineupGrid.addEventListener('touchend', end, { passive: true });
        }
        initLineupCardDrag();

        function initLineupCardFocus() {
            const lineupGrid = document.querySelector('.lineup-grid');
            if (!lineupGrid) return;
            if (lineupGrid.closest('.cms-hidden')) return;
            const cards = Array.from(lineupGrid.querySelectorAll('.artist-card'));
            if (!cards.length) return;
            let activeCard = null;

            const setFocusCard = (nextCard) => {
                if (!nextCard || nextCard === activeCard) return;
                activeCard = nextCard;
                cards.forEach((card) => card.classList.toggle('is-focus', card === nextCard));
            };

            const pickCardByCenter = () => {
                const gridRect = lineupGrid.getBoundingClientRect();
                const centerX = gridRect.left + gridRect.width / 2;
                let bestCard = cards[0];
                let bestDistance = Number.POSITIVE_INFINITY;

                cards.forEach((card) => {
                    const rect = card.getBoundingClientRect();
                    const cardCenter = rect.left + rect.width / 2;
                    const distance = Math.abs(cardCenter - centerX);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestCard = card;
                    }
                });
                setFocusCard(bestCard);
            };

            if ('IntersectionObserver' in window) {
                const ratios = new Map();
                const observer = new IntersectionObserver((entries) => {
                    if (lineupGrid.classList.contains('is-dragging')) return;
                    entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio || 0));

                    let topCard = null;
                    let topRatio = 0;
                    cards.forEach((card) => {
                        const ratio = Number(ratios.get(card) || 0);
                        if (ratio > topRatio) {
                            topRatio = ratio;
                            topCard = card;
                        }
                    });

                    if (topCard && topRatio > 0.38) setFocusCard(topCard);
                    else pickCardByCenter();
                }, {
                    root: lineupGrid,
                    threshold: [0.2, 0.4, 0.6, 0.8, 0.95]
                });
                cards.forEach((card) => observer.observe(card));
            }

            let rafId = null;
            const onScroll = () => {
                if (lineupGrid.classList.contains('is-dragging')) return;
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(pickCardByCenter);
            };
            lineupGrid.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onScroll, { passive: true });
            pickCardByCenter();

            cards.forEach((card) => {
                const mediaWrap = card.querySelector('.lineup-photo-wrap');
                if (!mediaWrap) return;

                const clearShift = () => {
                    mediaWrap.style.setProperty('--media-shift-x', '0px');
                    mediaWrap.style.setProperty('--media-shift-y', '0px');
                };

                const applyShift = (clientX, clientY) => {
                    const rect = mediaWrap.getBoundingClientRect();
                    if (!rect.width || !rect.height) return;
                    const x = ((clientX - rect.left) / rect.width) - 0.5;
                    const y = ((clientY - rect.top) / rect.height) - 0.5;
                    const shiftX = Math.max(-1, Math.min(1, x)) * 7;
                    const shiftY = Math.max(-1, Math.min(1, y)) * 6;
                    mediaWrap.style.setProperty('--media-shift-x', shiftX.toFixed(2) + 'px');
                    mediaWrap.style.setProperty('--media-shift-y', shiftY.toFixed(2) + 'px');
                };

                mediaWrap.addEventListener('pointermove', (event) => {
                    if (performanceMode !== 'full') return;
                    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
                    applyShift(event.clientX, event.clientY);
                });
                mediaWrap.addEventListener('pointerleave', clearShift);
                mediaWrap.addEventListener('touchend', clearShift, { passive: true });
                mediaWrap.addEventListener('touchcancel', clearShift, { passive: true });

                card.addEventListener('pointerdown', (event) => {
                    if (event.pointerType === 'mouse' && event.button !== 0) return;
                    if (event.target && event.target.closest && event.target.closest('.preview-controls, button, input, a')) return;
                    card.classList.add('is-pressed');
                    if (mediaWrap && mediaWrap.style) {
                        const rect = mediaWrap.getBoundingClientRect();
                        if (rect.width && rect.height) {
                            const x = ((event.clientX - rect.left) / rect.width) * 100;
                            const y = ((event.clientY - rect.top) / rect.height) * 100;
                            mediaWrap.style.setProperty('--tap-x', Math.max(0, Math.min(100, x)).toFixed(2) + '%');
                            mediaWrap.style.setProperty('--tap-y', Math.max(0, Math.min(100, y)).toFixed(2) + '%');
                        }
                    }
                });
                ['pointerup', 'pointerleave', 'pointercancel'].forEach((eventName) => {
                    card.addEventListener(eventName, () => {
                        card.classList.remove('is-pressed');
                    });
                });
                card.addEventListener('click', (event) => {
                    if (lineupGrid.classList.contains('is-dragging')) return;
                    if (event.target && event.target.closest && event.target.closest('.preview-controls, button, input, a')) return;
                    card.classList.remove('is-tapfx');
                    // Force restart of tap animation.
                    void card.offsetWidth;
                    card.classList.add('is-tapfx');
                    setTimeout(() => card.classList.remove('is-tapfx'), 360);
                });
            });
        }
        initLineupCardFocus();

        const genreBadges = Array.from(document.querySelectorAll('.resident-badge'));
        const lineupGenreDescription = document.getElementById('lineup-genre-description');
        let lineupGenreIndex = 0;
        let lineupGenreTimer = null;
        function updateGenreDescription() {
            if (!lineupGenreDescription || !genreBadges.length) return;
            const activeBadge = genreBadges[lineupGenreIndex];
            const genreKey = activeBadge ? activeBadge.getAttribute('data-genre') : '';
            if (!genreKey) return;
            const translationKey = `genre_desc_${genreKey}`;
            lineupGenreDescription.textContent = tr(translationKey, lineupGenreDescription.textContent || '');
        }
        function setActiveGenreBadge(index, shouldCenter, skipDescription) {
            if (!genreBadges.length) return;
            lineupGenreIndex = ((index % genreBadges.length) + genreBadges.length) % genreBadges.length;
            genreBadges.forEach((badge, idx) => badge.classList.toggle('is-active', idx === lineupGenreIndex));
            if (shouldCenter && window.innerWidth <= 768) {
                genreBadges[lineupGenreIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
            if (!skipDescription) updateGenreDescription();
        }
        function stopGenreAutoCycle() {
            if (!lineupGenreTimer) return;
            clearInterval(lineupGenreTimer);
            lineupGenreTimer = null;
        }
        function startGenreAutoCycle() {
            if (!genreBadges.length || performanceMode === 'lite') return;
            stopGenreAutoCycle();
            lineupGenreTimer = setInterval(() => {
                if (document.hidden) return;
                setActiveGenreBadge(lineupGenreIndex + 1, false);
            }, 3600);
        }
        if (genreBadges.length) {
            setActiveGenreBadge(0, false, true);
            genreBadges.forEach((badge, idx) => {
                badge.addEventListener('click', () => {
                    setActiveGenreBadge(idx, true);
                    startGenreAutoCycle();
                });
                badge.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setActiveGenreBadge(idx, true);
                        startGenreAutoCycle();
                    }
                });
            });
            startGenreAutoCycle();
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopGenreAutoCycle();
            else startGenreAutoCycle();
        });
        window.refreshLineupGenre = function() {
            if (!genreBadges.length) return;
            setActiveGenreBadge(lineupGenreIndex, false);
        };

        // NAV
        const topNav = document.getElementById('top-nav');
        let navScrollRaf = null;
        function updateTopNavVisibility() {
            if (topNav) topNav.classList.toggle('hidden', (window.scrollY || 0) > 50);
            navScrollRaf = null;
        }
        window.addEventListener('scroll', () => {
            if (navScrollRaf !== null) return;
            navScrollRaf = requestAnimationFrame(updateTopNavVisibility);
        }, { passive: true });
        updateTopNavVisibility();

        // EXIT INTENT POPUP LOGIC
        const exitModal = document.getElementById('exit-modal');
        function closeExitModal() {
            exitModal.style.display = 'none';
        }
        
        // Show only once per session
        if (safeStorageGet('sessionStorage', 'exitModalShown') !== 'true') {
            const shouldUseExitIntent = performanceMode === 'full' && !(coarsePointerQuery && coarsePointerQuery.matches);
            if (shouldUseExitIntent) {
                document.addEventListener('mouseleave', function(e) {
                    if (e.clientY < 0) {
                        exitModal.style.display = 'flex';
                        safeStorageSet('sessionStorage', 'exitModalShown', 'true');
                    }
                });
            }
        }
        // TRANSLATIONS
        const translations = {
            pt: {
                flag: "\uD83C\uDDE7\uD83C\uDDF7", date: "10 DE ABRIL - 20H -> 05H", pocket_tag: "POCKET EDITION", days: "Dias", hours: "Horas", minutes: "Min",
                buy: "COMPRAR INGRESSO", group: "GRUPO OFICIAL",
                demo: "<strong class=\"artist-cta-title\">Quer tocar na Hardware?</strong><small class=\"artist-cta-sub\">Envie seu Set</small>",
                demo_note: "Seleção aberta para DJs e produtores de hardtechno.",
                social_title: "CANAIS OFICIAIS",
                social_text: "Acompanhe novidades e fale com o time da festa.",
                audio_off: "SOM DESLIGADO", audio_ready: "PRONTO PARA TOCAR", audio_playing: "TOCANDO AGORA", audio_paused: "PAUSADO", audio_next: "PRÓXIMA FAIXA...", audio_finished: "FINALIZADO", audio_unavailable: "ÁUDIO INDISPONÍVEL", audio_random_badge: "CURADORIA HARDWARE",
                producer: "FALAR COM PRODUTOR", wait: "AGUARDE", secret: "POCKET EDITION", curitiba_act: "ATRAÇÃO INÉDITA", curitiba_origin: "CURITIBA - PR", brazil: "SÃO PAULO - BR",
                lineup_title: "CONHEÇA MAIS SOBRE O HARDTECHNO", lineup_cards_title: "LINE UP DJS", alpha_lineup_title: "LINE-UP EM ORDEM ALFABETICA", alpha_lineup_lead: "Leitura direta do line-up com os nomes organizados em ordem alfabetica, sem foto, sem cargo e sem ruido visual.", alpha_lineup_empty: "NOMES EM ATUALIZACAO", lineup_residents: "ENTENDA COMO CADA VERTENTE MUDA A PISTA", lineup_soon: "Explore as principais frentes do hardtechno e veja como textura, velocidade, pressão e groove transformam a experiência da noite.", lineup_hint: "Deslize nas abas para descobrir o que muda na sensação de pista em cada vertente.", lineup_card_swipe: "Arraste os cards de DJ para o lado e veja o proximo artista.", resident_slot: "RESIDENT SLOT", lineup_loading: "Loading...",
                genre_new_rave: "NEW RAVE", genre_neo_rave: "NEO RAVE", genre_industrial: "INDUSTRIAL", genre_hardtechno: "HARDTECHNO", genre_acid: "ACID TECHNO", genre_hardgroove: "HARD GROOVE", genre_schranz: "SCHRANZ", genre_raw: "RAW GROOVE",
                genre_desc_new_rave: "Grooves acelerados, energia neo-rave e drops de alto impacto para abrir a pista em estado máximo.",
                genre_desc_neo_rave: "O hardtechno atual combina velocidade, peso, repetição, tensão física e impacto direto no corpo. Aqui começa um guia rápido para entender como cada vertente altera o clima da pista HARDWARE.",
                genre_desc_industrial: "Texturas metálicas, kick seco e atmosfera mecânica para uma pressão sonora constante.",
                genre_desc_hardtechno: "BPM elevado, linhas agressivas e drive contínuo para manter a pista em pico de intensidade.",
                genre_desc_acid: "303 pulsante, camadas hipnóticas e acidez crescente para transições de alta tensão.",
                genre_desc_hardgroove: "Groove percussivo e swing de bateria inspirado na escola 90s de Ben Sims e loops funkados de pista.",
                genre_desc_schranz: "Hard techno alemã de pegada mais seca e repetitiva, com enfoque percussivo, industrial e alto impacto rítmico.",
                genre_desc_raw: "Rítmica crua, groove sujo e abordagem underground para quem curte peso sem filtro.",
                concept_title: "HARDWARE POCKET EDITION",
                concept_text: "A HARDWARE está de volta em uma edição pocket. Em parceria inédita com SKY•NA SUSHI CLUB, conectamos a cena underground à energia da pista brasileira.",
                concept_extra: "A proposta é uma experiência industrial, crua e intensa para quem vive o hardtechno em sua forma mais pura. A noite acontece das 20h às 05h, atravessando a madrugada.",
                concept_vip: "<strong>LISTA VIP:</strong> válida até 23h. Com nome na lista após 23h: R$ 30. Sem nome na lista: R$ 50. Evento 18+ com documento com foto. Retire seu ingresso no link da bio.",
                venue_title: "GOSTARIA DO NOSSO EVENTO NO SEU ESPAÇO?", venue_text: "Entre em contato para conversar sobre datas, formato e ocupação.",
                venue_btn: "PROPOR ESPAÇO", join_title: "JOIN THE SYSTEM", cat_brands: "MARCAS", cat_food: "GASTRONOMIA",
                cat_tattoo: "TATTOO", cat_fashion: "MODA", partner_btn: "CADASTRAR PROPOSTA", support: "APOIO",
                newsletter: "CADASTRE-SE PARA NOVIDADES", newsletter_cta: "GO", email_placeholder: "E-MAIL", newsletter_success: "CADASTRO REALIZADO COM SUCESSO", terms: "Termos de Uso", privacy: "Política de Privacidade",
                age_warning: "18+ COM DOCUMENTO COM FOTO", hidden: "OCULTO", location_name: "LOCAL: SKY•NA SUSHI CLUB",
                location_info: "ENDERECO: RUA BARTOLOMEU ZUNEGA, 151 - PINHEIROS", vip_info: "LISTA VIP ATE 23H. CHEGUE CEDO PARA ENTRAR SEM CORRERIA.", location_header: "INFO DO LOCAL", target_label: "TARGET: BAIRRO PINHEIROS", access_label: "ENTRADA:", safe_title: "SAFE SPACE POLICY",
                safe_text: "Zero tolerância para assédio, racismo, homofobia ou transfobia. Se você vir algo, avise nossa equipe imediatamente. Respeite a pista.", cookie_text: "NÓS USAMOS COOKIES PARA MELHORAR SUA EXPERIÊNCIA NO SISTEMA.", cookie_accept: "ACEITAR",
                exit_wait: "ESPERE!", exit_text: "Entre no grupo oficial e garanta acesso antecipado aos ingressos.", exit_btn: "ENTRAR NO GRUPO",
                nofee: "VENDA SEM TAXA (EM BREVE)", calendar: "ADICIONAR AO CALENDÁRIO",
                tools_title: "GUIA RÁPIDO DA NOITE",
                tool_route_title: "COMO CHEGAR",
                tool_route_text: "Chegue com antecedência para validar lista VIP e entrar sem correria.",
                maps_btn: "GOOGLE MAPS",
                waze_btn: "WAZE",
                tool_dress_title: "DRESS CODE E VIBE",
                tool_dress_text: "Estética industrial e urbana: preto, metálico, couro e atitude underground.",
                tool_reference_btn: "REFERÊNCIAS",
                tool_faq_title: "DÚVIDAS FREQUENTES",
                faq_1: "Lista VIP válida até 23h.",
                faq_2: "Evento para maiores de 18 anos com documento.",
                faq_3: "Ingressos no link oficial da festa.",
                tool_reminder_title: "ADICIONE NO CALENDÁRIO",
                tool_reminder_text: "Salve a data no celular para chegar com horario, lista VIP e endereco organizados.",
                reminder_whatsapp_btn: "GOOGLE AGENDA",
                reminder_telegram_btn: "BAIXAR .ICS",
                timeline_title: "RITMO DA NOITE",
                timeline_20: "20H WARM-UP",
                timeline_23: "23H LISTA VIP ENCERRA",
                timeline_02: "02H PICO DE PISTA",
                timeline_05: "05H ENCERRAMENTO"
            },
            en: {
                flag: "\uD83C\uDDFA\uD83C\uDDF8", date: "APRIL 10 - 8PM -> 5AM", pocket_tag: "POCKET EDITION", days: "Days", hours: "Hours", minutes: "Min",
                buy: "BUY TICKETS", group: "OFFICIAL GROUP",
                demo: "<strong class=\"artist-cta-title\">Want to play at Hardware?</strong><small class=\"artist-cta-sub\">Send your Set</small>",
                demo_note: "Open selection for hardtechno and neo rave DJs and producers.",
                social_title: "OFFICIAL CHANNELS",
                social_text: "Follow updates and talk directly to the party team.",
                audio_off: "AUDIO OFF", audio_ready: "READY TO PLAY", audio_playing: "NOW PLAYING", audio_paused: "PAUSED", audio_next: "NEXT TRACK...", audio_finished: "FINISHED", audio_unavailable: "AUDIO UNAVAILABLE", audio_random_badge: "RANDOM MODE",
                producer: "CONTACT", wait: "WAIT", secret: "POCKET EDITION", curitiba_act: "UNRELEASED ACT", curitiba_origin: "CURITIBA - PR", brazil: "SAO PAULO - BR",
                lineup_title: "HARDTECHNO SUBGENRES", lineup_cards_title: "DJ LINE UP", alpha_lineup_title: "ALPHABETICAL LINE-UP", alpha_lineup_lead: "A direct read of the line-up with names sorted alphabetically, with no photo, role or visual noise.", alpha_lineup_empty: "NAMES UPDATING", lineup_residents: "SUBGENRE GUIDE", lineup_soon: "Direct map from old-school roots to new-generation hybrids.", lineup_hint: "Tap a style and swipe sideways.", lineup_card_swipe: "Drag DJ cards sideways to reveal the next artist.", resident_slot: "RESIDENT SLOT", lineup_loading: "Loading...",
                genre_new_rave: "NEW RAVE", genre_neo_rave: "NEO RAVE", genre_industrial: "INDUSTRIAL", genre_hardtechno: "HARDTECHNO", genre_acid: "ACID TECHNO", genre_hardgroove: "HARD GROOVE", genre_schranz: "SCHRANZ", genre_raw: "RAW GROOVE",
                genre_desc_new_rave: "Fast grooves, neo-rave energy and high-impact drops to open the dancefloor at full power.",
                genre_desc_neo_rave: "Modern fusion of industrial hard techno, hard dance and revived 90s rave aesthetics.",
                genre_desc_industrial: "Metallic textures, dry kick and mechanical atmosphere for relentless pressure.",
                genre_desc_hardtechno: "High BPM, aggressive lines and continuous drive to keep the floor at peak intensity.",
                genre_desc_acid: "Pulsing 303 layers and rising acidity for hypnotic, tense transitions.",
                genre_desc_hardgroove: "Percussive groove and rolling swing inspired by late-90s loop-driven techno schools.",
                genre_desc_schranz: "German hard techno approach focused on repetitive percussion, rough texture and relentless force.",
                genre_desc_raw: "Raw rhythm, dirty groove and underground attitude for those who want unfiltered weight.",
                concept_title: "HARDWARE POCKET EDITION",
                concept_text: "HARDWARE returns in a pocket version, in an exclusive partnership with SKY•NA SUSHI CLUB, connecting the underground scene with Brazilian dancefloor power.",
                concept_extra: "The proposal is industrial, raw and intense, made for those who live hardtechno in its purest form. Extended night from 8PM to 5AM, running through dawn.",
                concept_vip: "<strong>VIP LIST:</strong> valid until 11PM. With list name after 11PM: R$ 30. Without list name: R$ 50. 18+ only with photo ID. Get your ticket from the bio link.",
                venue_title: "HOST OUR EVENT?", venue_text: "Get in touch to talk about dates, format and venue takeover.", venue_btn: "PROPOSE VENUE",
                join_title: "JOIN THE SYSTEM", cat_brands: "BRANDS", cat_food: "FOOD", cat_tattoo: "TATTOO",
                cat_fashion: "FASHION", partner_btn: "REGISTER PROPOSAL", support: "SUPPORT",
                newsletter: "SIGN UP FOR NEWS", newsletter_cta: "GO", email_placeholder: "E-MAIL", newsletter_success: "SIGNED UP SUCCESSFULLY", terms: "Terms of Use", privacy: "Privacy Policy",
                age_warning: "18+ ONLY - PHOTO ID REQUIRED", hidden: "HIDDEN", location_name: "LOCATION: SKY•NA SUSHI CLUB", location_info: "ADDRESS: RUA BARTOLOMEU ZUNEGA, 151 - PINHEIROS", vip_info: "VIP LIST UNTIL 11PM. ARRIVE EARLY TO ENTER WITH NO RUSH.",
                location_header: "LOCATION INFO", target_label: "TARGET: PINHEIROS DISTRICT", access_label: "ENTRY:", safe_title: "SAFE SPACE POLICY", safe_text: "Zero tolerance for harassment or discrimination.", cookie_text: "WE USE COOKIES TO IMPROVE YOUR EXPERIENCE.", cookie_accept: "ACCEPT",
                exit_wait: "WAIT!", exit_text: "Join the official group and get early access to tickets.", exit_btn: "JOIN GROUP", nofee: "NO FEE TICKET (SOON)", calendar: "ADD TO CALENDAR",
                tools_title: "NIGHT QUICK GUIDE",
                tool_route_title: "HOW TO GET THERE",
                tool_route_text: "Arrive early to validate VIP list and enter with no rush.",
                maps_btn: "GOOGLE MAPS",
                waze_btn: "WAZE",
                tool_dress_title: "DRESS CODE & VIBE",
                tool_dress_text: "Industrial urban aesthetic: black, metallic details, leather and underground attitude.",
                tool_reference_btn: "REFERENCES",
                tool_faq_title: "FAQ EXPRESS",
                faq_1: "VIP list valid until 11PM.",
                faq_2: "18+ only with photo ID.",
                faq_3: "Tickets available on the official party link.",
                tool_reminder_title: "PARTY REMINDER",
                tool_reminder_text: "Activate now and receive a reminder on event day.",
                reminder_whatsapp_btn: "WHATSAPP",
                reminder_telegram_btn: "TELEGRAM",
                timeline_title: "NIGHT FLOW",
                timeline_20: "8PM WARM-UP",
                timeline_23: "11PM VIP LIST CLOSES",
                timeline_02: "2AM PEAK TIME",
                timeline_05: "5AM CLOSING"
            },
            es: {
                flag: "\uD83C\uDDEA\uD83C\uDDF8", date: "10 ABRIL - 20H -> 05H", pocket_tag: "POCKET EDITION", days: "Dias", hours: "Horas", minutes: "Min",
                buy: "COMPRAR ENTRADAS", group: "GRUPO OFICIAL",
                demo: "<strong class=\"artist-cta-title\">Quieres tocar en Hardware?</strong><small class=\"artist-cta-sub\">Envia tu Set</small>",
                demo_note: "Seleccion abierta para DJs y productores de hardtechno y neo rave.",
                social_title: "CANALES OFICIALES",
                social_text: "Sigue novedades y habla con el equipo de la fiesta.",
                audio_off: "AUDIO APAGADO", audio_ready: "LISTO PARA REPRODUCIR", audio_playing: "SONANDO AHORA", audio_paused: "PAUSADO", audio_next: "SIGUIENTE PISTA...", audio_finished: "FINALIZADO", audio_unavailable: "AUDIO NO DISPONIBLE", audio_random_badge: "MODO ALEATORIO",
                producer: "CONTACTO", wait: "ESPERA", secret: "POCKET EDITION", curitiba_act: "ACTO INEDITO", curitiba_origin: "CURITIBA - PR", brazil: "SAO PAULO - BR",
                lineup_title: "SUBGENEROS HARDTECHNO", lineup_cards_title: "LINE UP DJS", alpha_lineup_title: "LINE-UP EN ORDEN ALFABETICO", alpha_lineup_lead: "Lectura directa del line-up con los nombres ordenados alfabeticamente, sin foto, cargo ni ruido visual.", alpha_lineup_empty: "NOMBRES EN ACTUALIZACION", lineup_residents: "GUIA DE SUBGENEROS", lineup_soon: "Mapa directo de vertientes old school y nueva generacion.", lineup_hint: "Toca un estilo y desliza al lado.", lineup_card_swipe: "Arrastra las tarjetas DJ hacia el lado para ver el siguiente artista.", resident_slot: "RESIDENT SLOT", lineup_loading: "Loading...",
                genre_new_rave: "NEW RAVE", genre_neo_rave: "NEO RAVE", genre_industrial: "INDUSTRIAL", genre_hardtechno: "HARDTECHNO", genre_acid: "ACID TECHNO", genre_hardgroove: "HARD GROOVE", genre_schranz: "SCHRANZ", genre_raw: "RAW GROOVE",
                genre_desc_new_rave: "Grooves rapidos, energia neo-rave y drops de alto impacto para abrir la pista con fuerza total.",
                genre_desc_neo_rave: "Fusion moderna entre hard techno industrial, hard dance y estetica rave noventera reinterpretada.",
                genre_desc_industrial: "Texturas metalicas, kick seco y atmosfera mecanica para una presion constante.",
                genre_desc_hardtechno: "BPM alto, lineas agresivas y drive continuo para sostener la maxima intensidad.",
                genre_desc_acid: "Capas 303 pulsantes y acidez creciente para transiciones hipnoticas de alta tension.",
                genre_desc_hardgroove: "Groove percutivo con swing marcado inspirado en la escuela loopera de finales de los 90.",
                genre_desc_schranz: "Vertiente alemana mas seca y repetitiva, centrada en percusion dura y energia constante.",
                genre_desc_raw: "Ritmica cruda, groove sucio y enfoque underground para quien busca peso sin filtro.",
                concept_title: "HARDWARE POCKET EDITION",
                concept_text: "HARDWARE vuelve en version pocket, en alianza inedita con SKY•NA SUSHI CLUB, conectando la escena underground con la fuerza de la pista brasilena.",
                concept_extra: "La propuesta es industrial, cruda e intensa, para quienes viven el hardtechno en estado puro. Extended night de 20h a 05h atravesando la madrugada.",
                concept_vip: "<strong>LISTA VIP:</strong> valida hasta las 23h. Con nombre en lista despues de 23h: R$ 30. Sin nombre en lista: R$ 50. Evento 18+ con documento. Retira tu entrada en el link de la bio.",
                venue_title: "QUIERES NUESTRO EVENTO?", venue_text: "Ponte en contacto para hablar sobre fechas, formato y ocupacion.", venue_btn: "PROPONER ESPACIO",
                join_title: "UNETE AL SISTEMA", cat_brands: "MARCAS", cat_food: "GASTRONOMIA", cat_tattoo: "TATTOO",
                cat_fashion: "MODA", partner_btn: "REGISTRAR PROPUESTA", support: "APOYO",
                newsletter: "REGISTRATE PARA NOTICIAS", newsletter_cta: "GO", email_placeholder: "E-MAIL", newsletter_success: "REGISTRO REALIZADO CON EXITO", terms: "Terminos de Uso", privacy: "Politica de Privacidad",
                age_warning: "18+ CON DOCUMENTO CON FOTO", hidden: "OCULTO", location_name: "LOCAL: SKY•NA SUSHI CLUB", location_info: "DIRECCION: RUA BARTOLOMEU ZUNEGA, 151 - PINHEIROS", vip_info: "LISTA VIP HASTA LAS 23H. LLEGA TEMPRANO PARA ENTRAR SIN PRISA.",
                location_header: "INFO DEL LOCAL", target_label: "OBJETIVO: BARRIO PINHEIROS", access_label: "ENTRADA:", safe_title: "SAFE SPACE POLICY", safe_text: "Cero tolerancia al acoso.", cookie_text: "USAMOS COOKIES PARA MEJORAR TU EXPERIENCIA.", cookie_accept: "ACEPTAR",
                exit_wait: "ESPERA!", exit_text: "Entra al grupo oficial y asegura acceso anticipado a entradas.", exit_btn: "ENTRAR AL GRUPO", nofee: "ENTRADA SIN COMISION (PRONTO)", calendar: "ANADIR AL CALENDARIO",
                tools_title: "GUIA RAPIDA DE LA NOCHE",
                tool_route_title: "COMO LLEGAR",
                tool_route_text: "Llega con anticipacion para validar la lista VIP y entrar sin filas.",
                maps_btn: "GOOGLE MAPS",
                waze_btn: "WAZE",
                tool_dress_title: "DRESS CODE Y VIBE",
                tool_dress_text: "Estetica industrial urbana: negro, metalico, cuero y actitud underground.",
                tool_reference_btn: "REFERENCIAS",
                tool_faq_title: "FAQ EXPRESS",
                faq_1: "Lista VIP valida hasta las 23h.",
                faq_2: "Evento 18+ con documento con foto.",
                faq_3: "Entradas en el link oficial de la fiesta.",
                tool_reminder_title: "RECORDATORIO",
                tool_reminder_text: "Activalo ahora y recibe recordatorio el dia del evento.",
                reminder_whatsapp_btn: "WHATSAPP",
                reminder_telegram_btn: "TELEGRAM",
                timeline_title: "RITMO DE LA NOCHE",
                timeline_20: "20H WARM-UP",
                timeline_23: "23H CIERRA LISTA VIP",
                timeline_02: "02H PICO DE PISTA",
                timeline_05: "05H CIERRE"
            },
            fr: {
                flag: "\uD83C\uDDEB\uD83C\uDDF7", date: "10 AVRIL - 20H -> 05H", pocket_tag: "POCKET EDITION", days: "Jours", hours: "Heures", minutes: "Min",
                buy: "ACHETER BILLET", group: "GROUPE OFFICIEL",
                demo: "<strong class=\"artist-cta-title\">Tu veux jouer a Hardware ?</strong><small class=\"artist-cta-sub\">Envoie ton Set</small>",
                demo_note: "Selection ouverte pour DJs et producteurs hardtechno et neo rave.",
                social_title: "CANAUX OFFICIELS",
                social_text: "Suis les actus et parle avec l'equipe de la soiree.",
                audio_off: "AUDIO COUPE", audio_ready: "PRET A LIRE", audio_playing: "LECTURE EN COURS", audio_paused: "EN PAUSE", audio_next: "PISTE SUIVANTE...", audio_finished: "TERMINE", audio_unavailable: "AUDIO INDISPONIBLE", audio_random_badge: "MODE ALEATOIRE",
                producer: "CONTACT", wait: "ATTENTE", secret: "POCKET EDITION", curitiba_act: "ACTE INEDIT", curitiba_origin: "CURITIBA - PR", brazil: "SAO PAULO - BR",
                lineup_title: "SOUS-GENRES HARDTECHNO", lineup_cards_title: "LINE UP DJS", alpha_lineup_title: "LINE-UP PAR ORDRE ALPHABETIQUE", alpha_lineup_lead: "Lecture directe du line-up avec les noms tries par ordre alphabetique, sans photo, sans role et sans bruit visuel.", alpha_lineup_empty: "NOMS EN MISE A JOUR", lineup_residents: "GUIDE DES SOUS-GENRES", lineup_soon: "Resume direct des racines old school et de la nouvelle generation.", lineup_hint: "Touche un style puis glisse lateralement.", lineup_card_swipe: "Fais glisser les cartes DJ lateralement pour afficher l'artiste suivant.", resident_slot: "RESIDENT SLOT", lineup_loading: "Loading...",
                genre_new_rave: "NEW RAVE", genre_neo_rave: "NEO RAVE", genre_industrial: "INDUSTRIAL", genre_hardtechno: "HARDTECHNO", genre_acid: "ACID TECHNO", genre_hardgroove: "HARD GROOVE", genre_schranz: "SCHRANZ", genre_raw: "RAW GROOVE",
                genre_desc_new_rave: "Grooves rapides, energie neo-rave et drops percutants pour lancer la piste a pleine puissance.",
                genre_desc_neo_rave: "Fusion moderne entre hard techno industrielle, hard dance et esthetique rave 90s revisitee.",
                genre_desc_industrial: "Textures metalliques, kick sec et atmosphere mecanique pour une pression continue.",
                genre_desc_hardtechno: "BPM eleve, lignes agressives et drive constant pour garder une intensite maximale.",
                genre_desc_acid: "Couches 303 pulsees et acidite montante pour des transitions hypnotiques.",
                genre_desc_hardgroove: "Groove percussif et swing roule inspire de l'ecole techno loop des annees 90.",
                genre_desc_schranz: "Approche allemande plus repetitive, axe percussif dur et impact rythmique constant.",
                genre_desc_raw: "Rythme brut, groove sale et approche underground pour un impact sans filtre.",
                concept_title: "HARDWARE POCKET EDITION",
                concept_text: "HARDWARE revient en version pocket, en partenariat inedit avec SKY•NA SUSHI CLUB, connectant la scene underground a la puissance du dancefloor bresilien.",
                concept_extra: "Une proposition industrielle, brute et intense pour ceux qui vivent le hardtechno a l'etat pur. Extended night de 20h a 05h en traversant la nuit.",
                concept_vip: "<strong>LISTE VIP:</strong> valable jusqu'a 23h. Avec nom apres 23h: R$ 30. Sans nom: R$ 50. Evenement 18+ avec piece d'identite. Billet via le lien en bio.",
                venue_title: "HEBERGER NOTRE EVENEMENT?", venue_text: "Contactez-nous pour parler des dates, du format et de l'occupation du lieu.", venue_btn: "PROPOSER LIEU",
                join_title: "REJOINDRE LE SYSTEME", cat_brands: "MARQUES", cat_food: "GASTRONOMIE", cat_tattoo: "TATOUAGE",
                cat_fashion: "MODE", partner_btn: "ENREGISTRER PROPOSITION", support: "SOUTIEN",
                newsletter: "INSCRIPTION NEWS", newsletter_cta: "GO", email_placeholder: "E-MAIL", newsletter_success: "INSCRIPTION REUSSIE", terms: "Conditions", privacy: "Politique de Confidentialite",
                age_warning: "18+ AVEC PIECE D'IDENTITE PHOTO", hidden: "CACHE", location_name: "LIEU: SKY•NA SUSHI CLUB", location_info: "ADRESSE: RUA BARTOLOMEU ZUNEGA, 151 - PINHEIROS", vip_info: "LISTE VIP JUSQU'A 23H. ARRIVE TOT POUR ENTRER SANS STRESS.",
                location_header: "INFOS DU LIEU", target_label: "CIBLE: QUARTIER PINHEIROS", access_label: "ENTREE:", safe_title: "SAFE SPACE POLICY", safe_text: "Tolerance zero contre le harcelement.", cookie_text: "NOUS UTILISONS DES COOKIES POUR AMELIORER VOTRE EXPERIENCE.", cookie_accept: "ACCEPTER",
                exit_wait: "ATTENDEZ!", exit_text: "Rejoignez le groupe officiel pour un acces anticipe aux billets.", exit_btn: "REJOINDRE LE GROUPE", nofee: "BILLET SANS FRAIS (BIENTOT)", calendar: "AJOUTER AU CALENDRIER",
                tools_title: "GUIDE RAPIDE DE LA NUIT",
                tool_route_title: "COMMENT ARRIVER",
                tool_route_text: "Arrive tot pour valider la liste VIP et entrer sans stress.",
                maps_btn: "GOOGLE MAPS",
                waze_btn: "WAZE",
                tool_dress_title: "DRESS CODE & VIBE",
                tool_dress_text: "Esthetique industrielle urbaine: noir, metallique, cuir et attitude underground.",
                tool_reference_btn: "REFERENCES",
                tool_faq_title: "FAQ EXPRESS",
                faq_1: "Liste VIP valable jusqu'a 23h.",
                faq_2: "Evenement 18+ avec piece photo.",
                faq_3: "Billets via le lien officiel.",
                tool_reminder_title: "RAPPEL SOIREE",
                tool_reminder_text: "Active maintenant et recois un rappel le jour J.",
                reminder_whatsapp_btn: "WHATSAPP",
                reminder_telegram_btn: "TELEGRAM",
                timeline_title: "RYTHME DE LA NUIT",
                timeline_20: "20H WARM-UP",
                timeline_23: "23H FIN LISTE VIP",
                timeline_02: "02H PLEINE INTENSITE",
                timeline_05: "05H FERMETURE"
            },
            de: {
                flag: "\uD83C\uDDE9\uD83C\uDDEA", date: "10 APRIL - 20 UHR -> 05 UHR", pocket_tag: "POCKET EDITION", days: "Tage", hours: "Stunden", minutes: "Min",
                buy: "TICKET KAUFEN", group: "OFFIZIELLE GRUPPE",
                demo: "<strong class=\"artist-cta-title\">Willst du bei Hardware spielen?</strong><small class=\"artist-cta-sub\">Sende dein Set</small>",
                demo_note: "Offene Auswahl fur Hardtechno- und Neo-Rave-DJs und Produzenten.",
                social_title: "OFFIZIELLE KANAELE",
                social_text: "Folge den Updates und sprich direkt mit dem Team.",
                audio_off: "AUDIO AUS", audio_ready: "BEREIT ZUM ABSPIELEN", audio_playing: "JETZT LAEUFT", audio_paused: "PAUSIERT", audio_next: "NAECHSTER TRACK...", audio_finished: "BEENDET", audio_unavailable: "AUDIO NICHT VERFUEGBAR", audio_random_badge: "RANDOM MODUS",
                producer: "KONTAKT", wait: "WARTEN", secret: "POCKET EDITION", curitiba_act: "UNRELEASED ACT", curitiba_origin: "CURITIBA - PR", brazil: "SAO PAULO - BR",
                lineup_title: "HARDTECHNO SUBGENRES", lineup_cards_title: "DJ LINE UP", alpha_lineup_title: "LINE-UP IN ALPHABETISCHER REIHENFOLGE", alpha_lineup_lead: "Direkte Ubersicht des Line-ups mit alphabetisch sortierten Namen, ohne Foto, Rolle oder visuellem Larm.", alpha_lineup_empty: "NAMEN WERDEN AKTUALISIERT", lineup_residents: "SUBGENRE-GUIDE", lineup_soon: "Direkter Uberblick von Oldschool-Wurzeln bis zu neuen Hybriden.", lineup_hint: "Style antippen und seitlich wischen.", lineup_card_swipe: "Ziehe die DJ-Karten seitlich, um den nachsten Artist zu sehen.", resident_slot: "RESIDENT SLOT", lineup_loading: "Loading...",
                genre_new_rave: "NEW RAVE", genre_neo_rave: "NEO RAVE", genre_industrial: "INDUSTRIAL", genre_hardtechno: "HARDTECHNO", genre_acid: "ACID TECHNO", genre_hardgroove: "HARD GROOVE", genre_schranz: "SCHRANZ", genre_raw: "RAW GROOVE",
                genre_desc_new_rave: "Schnelle Grooves, Neo-Rave-Energie und starke Drops fur einen kraftvollen Floor-Start.",
                genre_desc_neo_rave: "Moderne Fusion aus industriellem Hard Techno, Hard Dance und neu interpretierter 90er-Rave-Asthetik.",
                genre_desc_industrial: "Metallische Texturen, trockene Kick und mechanische Atmosphare fur konstanten Druck.",
                genre_desc_hardtechno: "Hoher BPM, aggressive Linien und permanenter Drive fur maximale Intensitat.",
                genre_desc_acid: "Pulsierende 303-Layer und steigende Acid-Spannung fur hypnotische Ubergange.",
                genre_desc_hardgroove: "Percussiver Groove mit rollendem Swing, inspiriert von der Loop-Techno-Schule der spaten 90er.",
                genre_desc_schranz: "Deutsch gepragte harte, repetitive Richtung mit Fokus auf Percussion und roher Energie.",
                genre_desc_raw: "Rohes Rhythmusbild, dreckiger Groove und Underground-Ansatz fur ungefilterten Druck.",
                concept_title: "HARDWARE POCKET EDITION",
                concept_text: "HARDWARE ist zuruck als Pocket-Version, in exklusiver Partnerschaft mit SKY•NA SUSHI CLUB, und verbindet Underground-Szene mit brasilianischer Dancefloor-Energie.",
                concept_extra: "Das Konzept ist industriell, roh und intensiv fur alle, die Hardtechno in Reinform leben. Extended night von 20:00 bis 05:00 durch die ganze Nacht.",
                concept_vip: "<strong>VIP-LISTE:</strong> gultig bis 23:00. Mit Name nach 23:00: R$ 30. Ohne Name: R$ 50. Event 18+ mit Lichtbildausweis. Ticket uber den Link in der Bio.",
                venue_title: "UNSER EVENT BEI IHNEN?", venue_text: "Kontaktieren Sie uns, um uber Termine, Format und Venue-Takeover zu sprechen.", venue_btn: "ORT VORSCHLAGEN",
                join_title: "JOIN THE SYSTEM", cat_brands: "MARKEN", cat_food: "GASTRONOMIE", cat_tattoo: "TATTOO",
                cat_fashion: "MODE", partner_btn: "VORSCHLAG REGISTRIEREN", support: "SUPPORT",
                newsletter: "NEWS ANMELDEN", newsletter_cta: "GO", email_placeholder: "E-MAIL", newsletter_success: "ANMELDUNG ERFOLGREICH", terms: "Nutzungsbedingungen", privacy: "Datenschutz",
                age_warning: "18+ MIT LICHTBILDAUSWEIS", hidden: "VERSTECKT", location_name: "ORT: SKY•NA SUSHI CLUB", location_info: "ADRESSE: RUA BARTOLOMEU ZUNEGA, 151 - PINHEIROS", vip_info: "VIP-LISTE BIS 23:00. KOMM FRUH, UM OHNE STRESS REINZUKOMMEN.",
                location_header: "LOCATION INFO", target_label: "ZIEL: STADTTEIL PINHEIROS", access_label: "EINLASS:", safe_title: "SAFE SPACE POLICY", safe_text: "Null Toleranz gegen Belastigung.", cookie_text: "WIR NUTZEN COOKIES, UM DEINE ERFAHRUNG ZU VERBESSERN.", cookie_accept: "AKZEPTIEREN",
                exit_wait: "WARTEN!", exit_text: "Tritt der offiziellen Gruppe bei und sichere dir fruhen Ticketzugang.", exit_btn: "GRUPPE BEITRETEN", nofee: "OHNE GEBUHR (BALD)", calendar: "ZUM KALENDER",
                tools_title: "SCHNELLGUIDE FUR DIE NACHT",
                tool_route_title: "ANFAHRT",
                tool_route_text: "Komm fruh, um die VIP-Liste zu validieren und ohne Stress reinzukommen.",
                maps_btn: "GOOGLE MAPS",
                waze_btn: "WAZE",
                tool_dress_title: "DRESS CODE & VIBE",
                tool_dress_text: "Industrielle urbane Asthetik: Schwarz, Metall, Leder und Underground-Attitude.",
                tool_reference_btn: "REFERENZEN",
                tool_faq_title: "FAQ EXPRESS",
                faq_1: "VIP-Liste gultig bis 23:00.",
                faq_2: "18+ nur mit Lichtbildausweis.",
                faq_3: "Tickets uber den offiziellen Link.",
                tool_reminder_title: "EVENT-ERINNERUNG",
                tool_reminder_text: "Jetzt aktivieren und am Eventtag erinnert werden.",
                reminder_whatsapp_btn: "WHATSAPP",
                reminder_telegram_btn: "TELEGRAM",
                timeline_title: "NACHT-ABLAUF",
                timeline_20: "20:00 WARM-UP",
                timeline_23: "23:00 VIP-LISTE ENDET",
                timeline_02: "02:00 PEAK TIME",
                timeline_05: "05:00 ENDE"
            },
            zh: {
                flag: "\uD83C\uDDE8\uD83C\uDDF3", date: "4月10日 - 20:00 -> 05:00", pocket_tag: "POCKET EDITION", days: "天", hours: "小时", minutes: "分",
                buy: "购买门票", group: "官方群组",
                demo: "<strong class=\"artist-cta-title\">想在 Hardware 演出吗？</strong><small class=\"artist-cta-sub\">发送你的 Set</small>",
                demo_note: "面向 hardtechno 与 neo rave DJ/制作人的开放征集。",
                social_title: "官方频道",
                social_text: "关注最新动态并直接联系活动团队。",
                audio_off: "音频关闭", audio_ready: "准备播放", audio_playing: "正在播放", audio_paused: "已暂停", audio_next: "下一首...", audio_finished: "播放结束", audio_unavailable: "音频不可用", audio_random_badge: "随机模式",
                producer: "联系主办方", wait: "请稍候", secret: "POCKET EDITION", curitiba_act: "全新企划", curitiba_origin: "CURITIBA - PR", brazil: "SAO PAULO - BR",
                lineup_title: "HARDTECHNO 子风格", lineup_cards_title: "DJ LINE UP", alpha_lineup_title: "按字母排序的 LINE-UP", alpha_lineup_lead: "按字母顺序直接查看 line-up 名单，不带照片、身份标签或多余视觉干扰。", alpha_lineup_empty: "名单更新中", lineup_residents: "子风格指南", lineup_soon: "从老派根源到新世代混合风格的快速导览。", lineup_hint: "点击风格并左右滑动。", lineup_card_swipe: "左右拖动 DJ 卡片，查看下一位艺人。", resident_slot: "RESIDENT SLOT", lineup_loading: "加载中...",
                genre_new_rave: "新锐 RAVE", genre_neo_rave: "NEO RAVE", genre_industrial: "工业", genre_hardtechno: "硬核 TECHNO", genre_acid: "酸性 TECHNO", genre_hardgroove: "HARD GROOVE", genre_schranz: "SCHRANZ", genre_raw: "原始律动",
                genre_desc_new_rave: "高速律动与 neo-rave 能量，为整晚开场带来高冲击。",
                genre_desc_neo_rave: "将工业硬科技、硬舞曲与90年代 rave 美学重新融合的当代路线。",
                genre_desc_industrial: "金属质感、干脆鼓点和机械氛围，形成持续压迫感。",
                genre_desc_hardtechno: "高 BPM、强硬线条与连续推进，让舞池保持峰值强度。",
                genre_desc_acid: "303 酸性层层推进，制造催眠且紧张的过渡段落。",
                genre_desc_hardgroove: "强调打击乐律动与滚动 swing，承接90年代 loop techno 的舞池基因。",
                genre_desc_schranz: "德国系更硬更重复的方向，重心在粗粝打击与持续冲击力。",
                genre_desc_raw: "更粗粝的节奏与地下质感，适合偏好原始冲击力的人群。",
                concept_title: "HARDWARE POCKET EDITION",
                concept_text: "HARDWARE 以口袋版回归，并与 SKY•NA SUSHI CLUB 首次合作，将地下场景与巴西舞池能量连接在一起。",
                concept_extra: "本次体验工业、粗粝且高强度，献给热爱纯粹 hardtechno 的你。活动从20:00持续至05:00，整晚贯穿到清晨。",
                concept_vip: "<strong>VIP 名单：</strong>23:00前有效。23:00后名单价：R$ 30；无名单：R$ 50。18+，需携带带照片证件。门票请在主页链接领取。",
                venue_title: "想在你的场地举办我们的活动？", venue_text: "欢迎联系沟通档期、形式和场地合作。", venue_btn: "提交场地",
                join_title: "加入系统", cat_brands: "品牌", cat_food: "餐饮", cat_tattoo: "纹身",
                cat_fashion: "时尚", partner_btn: "提交合作提案", support: "支持单位",
                newsletter: "订阅最新消息", newsletter_cta: "发送", email_placeholder: "电子邮箱", newsletter_success: "订阅成功", terms: "使用条款", privacy: "隐私政策",
                age_warning: "仅限18岁以上并需照片证件", hidden: "隐藏", location_name: "地点：SKY•NA SUSHI CLUB", location_info: "地址：RUA BARTOLOMEU ZUNEGA, 151 - PINHEIROS", vip_info: "VIP 名单有效至 23:00。建议提早到场，避免入场匆忙。",
                location_header: "场地信息", target_label: "目标：PINHEIROS 区", access_label: "入场：", safe_title: "安全空间政策", safe_text: "对骚扰与歧视零容忍。", cookie_text: "我们使用 Cookie 来提升你的使用体验。", cookie_accept: "接受",
                exit_wait: "稍等！", exit_text: "加入官方群组，抢先获取门票信息。", exit_btn: "加入群组", nofee: "免手续费门票（即将开放）", calendar: "加入日历",
                tools_title: "夜场快速指南",
                tool_route_title: "到场路线",
                tool_route_text: "建议提前到场，完成 VIP 名单验证并顺畅入场。",
                maps_btn: "GOOGLE MAPS",
                waze_btn: "WAZE",
                tool_dress_title: "穿搭与氛围",
                tool_dress_text: "工业都市风：黑色、金属元素、皮革与地下气质。",
                tool_reference_btn: "灵感参考",
                tool_faq_title: "快速 FAQ",
                faq_1: "VIP 名单有效至 23:00。",
                faq_2: "活动仅限 18+，需照片证件。",
                faq_3: "门票请走官方链接。",
                tool_reminder_title: "活动提醒",
                tool_reminder_text: "现在开启，活动当天自动提醒。",
                reminder_whatsapp_btn: "WHATSAPP",
                reminder_telegram_btn: "TELEGRAM",
                timeline_title: "夜晚节奏",
                timeline_20: "20:00 WARM-UP",
                timeline_23: "23:00 VIP 截止",
                timeline_02: "02:00 强度高峰",
                timeline_05: "05:00 收场"
            }
        };

        const modalTexts = {
            pt: {
                terms: "<strong>1. INGRESSOS</strong> A compra do ingresso é pessoal e intransferível.<br><strong>2. REEMBOLSO</strong> O reembolso pode ser solicitado em até 7 dias.",
                privacy: "<strong>1. COLETA DE DADOS</strong> Coletamos seu e-mail para envio de informações.<br><strong>2. USO DE IMAGEM</strong> Ao participar do evento, você autoriza o uso de imagem para divulgação."
            }
        };

        if (window.HardwareCMS) {
            window.HardwareCMS.applyTranslationsOverrides(translations);
            window.HardwareCMS.applyDomOverrides(document);
            window.HardwareCMS.applyLinkOverrides(document);
            window.HardwareCMS.applyMediaOverrides(document);
        }

        const siteOrigin = 'https://hardwareparty.com.br';
        const shareImageUrl = `${siteOrigin}/assets/img/share-card.svg`;
        const fallbackEventDateIso = '2026-04-10T20:00:00-03:00';
        const eventDurationMs = 9 * 60 * 60 * 1000;

        function getEffectiveEventDateIso() {
            if (window.HardwareCMS && typeof window.HardwareCMS.getEventDateIso === 'function') {
                return window.HardwareCMS.getEventDateIso(fallbackEventDateIso);
            }
            return fallbackEventDateIso;
        }

        function formatCalendarUtc(date) {
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            return `${year}${month}${day}T${hours}${minutes}00Z`;
        }

        function buildCalendarLink(eventDateIso) {
            const start = new Date(eventDateIso);
            const end = new Date(start.getTime() + eventDurationMs);
            const eventTitle = 'HARDWARE Pocket Edition';
            const eventDetails = 'Pocket Edition da HARDWARE. Hardtechno e Neo Rave em Sao Paulo.';
            const eventLocation = 'Rua Bartolomeu Zunega, 151 - Pinheiros - Sao Paulo';
            return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${formatCalendarUtc(start)}/${formatCalendarUtc(end)}&details=${encodeURIComponent(eventDetails)}&location=${encodeURIComponent(eventLocation)}`;
        }

        function syncEventMetadata() {
            const eventDateIso = getEffectiveEventDateIso();
            const start = new Date(eventDateIso);
            const end = new Date(start.getTime() + eventDurationMs);
            const eventDateLabel = (document.querySelector('.event-date-display')?.textContent || '10 DE ABRIL - 20H -> 05H').trim();
            const pageDescription = `HARDWARE Pocket Edition: ${eventDateLabel}. Hardtechno & Neo Rave em Sao Paulo. Ingressos limitados.`;
            const socialDescription = `${eventDateLabel} - SAO PAULO. Pocket Edition.`;

            const metaDescription = document.getElementById('meta-description');
            if (metaDescription) metaDescription.setAttribute('content', pageDescription);

            const metaOgDescription = document.getElementById('meta-og-description');
            if (metaOgDescription) metaOgDescription.setAttribute('content', socialDescription);

            const metaOgTitle = document.getElementById('meta-og-title');
            if (metaOgTitle) metaOgTitle.setAttribute('content', document.title);

            const metaOgImage = document.getElementById('meta-og-image');
            if (metaOgImage) metaOgImage.setAttribute('content', shareImageUrl);

            const metaOgImageAlt = document.getElementById('meta-og-image-alt');
            if (metaOgImageAlt) metaOgImageAlt.setAttribute('content', 'HARDWARE Pocket Edition em Sao Paulo');

            const metaOgUrl = document.getElementById('meta-og-url');
            if (metaOgUrl) metaOgUrl.setAttribute('content', `${siteOrigin}/`);

            const metaTwitterTitle = document.getElementById('meta-twitter-title');
            if (metaTwitterTitle) metaTwitterTitle.setAttribute('content', document.title);

            const metaTwitterDescription = document.getElementById('meta-twitter-description');
            if (metaTwitterDescription) metaTwitterDescription.setAttribute('content', socialDescription);

            const metaTwitterImage = document.getElementById('meta-twitter-image');
            if (metaTwitterImage) metaTwitterImage.setAttribute('content', shareImageUrl);

            const canonicalUrl = document.getElementById('canonical-url');
            if (canonicalUrl) canonicalUrl.setAttribute('href', `${siteOrigin}/`);

            const schemaEl = document.getElementById('event-schema');
            if (schemaEl) {
                try {
                    const schema = JSON.parse(schemaEl.textContent);
                    schema.startDate = eventDateIso;
                    schema.endDate = end.toISOString();
                    schema.image = [shareImageUrl];
                    schema.url = `${siteOrigin}/`;
                    schema.description = pageDescription;
                    schemaEl.textContent = JSON.stringify(schema);
                } catch (e) {}
            }

            const overrides = (window.HardwareCMS && typeof window.HardwareCMS.getOverrides === 'function')
                ? window.HardwareCMS.getOverrides()
                : {};
            const hasCalendarOverride = !!(overrides && overrides.links && String(overrides.links.calendarLink || '').trim());
            const calendarButton = document.querySelector("a[data-translate='calendar']");
            if (calendarButton && !hasCalendarOverride) {
                calendarButton.setAttribute('href', buildCalendarLink(eventDateIso));
            }
        }

        let currentLang = 'pt';
        const htmlTranslationKeys = new Set(['demo', 'concept_vip']);
        function applyLanguage(lang) {
            currentLang = lang; document.getElementById('current-flag').innerText = translations[lang]?.flag || "\uD83C\uDDE7\uD83C\uDDF7";
            document.querySelectorAll('[data-translate]').forEach(el => {
                const key = el.getAttribute('data-translate');
                if (translations[lang] && translations[lang][key]) {
                    const translatedValue = translations[lang][key];
                    if (htmlTranslationKeys.has(key)) el.innerHTML = sanitizeLimitedHtml(translatedValue);
                    else el.textContent = translatedValue;
                }
            });
            document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
                const key = el.getAttribute('data-translate-placeholder');
                if (translations[lang] && translations[lang][key]) el.setAttribute('placeholder', translations[lang][key]);
            });
            textElements.forEach(el => {
                el.dataset.value = el.textContent;
            });
            if (window.syncAudioLanguage) window.syncAudioLanguage();
            if (window.refreshLineupGenre) window.refreshLineupGenre();
            if (window.renderAlphabeticalLineup) window.renderAlphabeticalLineup();
            syncEventMetadata();
            document.getElementById('lang-menu').classList.remove('show');
        }
        function toggleLangMenu() { document.getElementById('lang-menu').classList.toggle('show'); }
        function changeLanguage(lang) { applyLanguage(lang); }
        applyLanguage('pt');
        window.renderAlphabeticalLineup = renderAlphabeticalLineup;
        window.addEventListener('hardware:overrides-applied', function() {
            renderAlphabeticalLineup();
            syncEventMetadata();
            updateCountdown();
        });

        const modal = document.getElementById('policy-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        function openModal(type) {
            if (type !== 'terms' && type !== 'privacy') return;
            const text = (modalTexts[currentLang] && modalTexts[currentLang][type]) || (modalTexts.pt && modalTexts.pt[type]) || "";
            const title = (translations[currentLang] && translations[currentLang][type]) || (translations.pt && translations.pt[type]) || "";
            modalTitle.textContent = String(title).toUpperCase();
            modalBody.innerHTML = sanitizeLimitedHtml(text);
            modal.classList.add('active');
        }
        function closeModal() { modal.classList.remove('active'); }
        modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });

        const body = document.body; const html = document.documentElement;
        const accessBtn = document.getElementById('access-btn'); const accessIcon = document.getElementById('access-icon');
        accessBtn.addEventListener('click', () => {
            body.classList.toggle('light-mode'); html.classList.toggle('light-mode');
            if (body.classList.contains('light-mode')) { accessIcon.classList.remove('fa-eye'); accessIcon.classList.add('fa-sun'); } 
            else { accessIcon.classList.remove('fa-sun'); accessIcon.classList.add('fa-eye'); }
        });

        // AUDIO FIX & LOGIC (DOCK PLAYER)
        var widgetIframe = document.getElementById('sc-widget');
        var audioFeatureAvailable = !!widgetIframe;
        var widget = null;
        var widgetBindDone = false;
        var widgetLoadPromise = null;
        var soundcloudApiUrl = 'https://w.soundcloud.com/player/api.js';
        var btn = document.getElementById('audio-btn');
        var icon = document.getElementById('audio-icon');
        var dock = document.getElementById('audio-dock');
        var dockHome = document.getElementById('audio-dock-home');
        var dockAnchor = document.getElementById('audio-dock-anchor');
        var statusText = document.getElementById('audio-status');
        var trackText = document.getElementById('audio-track');
        var audioBadge = document.getElementById('audio-badge');
        var volumeControl = document.getElementById('audio-volume');
        var muteBtn = document.getElementById('audio-mute-btn');
        var muteIcon = document.getElementById('audio-mute-icon');
        var prevBtn = document.getElementById('audio-prev-btn');
        var nextBtn = document.getElementById('audio-next-btn');
        var floatControl = document.getElementById('audio-float');
        var floatToggle = document.getElementById('audio-float-toggle');
        var floatIcon = document.getElementById('audio-float-icon');
        var floatPanel = document.getElementById('audio-float-panel');
        var floatVolume = document.getElementById('audio-float-volume');
        var floatMuteBtn = document.getElementById('audio-float-mute');
        var floatMuteIcon = document.getElementById('audio-float-mute-icon');
        var floatActiveTimer = null;
        var isWidgetReady = false;
        var storageVolumeKey = 'hardwareAudioVolume';
        var storageMutedKey = 'hardwareAudioMuted';
        var lastVolumeBeforeMute = 35;
        var isMuted = false;
        var playlistSounds = [];
        var currentTrackIndex = -1;
        var hasFirstPlay = false;
        var currentAudioState = 'off';

        try {
            var savedVolume = Number(localStorage.getItem(storageVolumeKey));
            if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100 && volumeControl) {
                volumeControl.value = String(savedVolume);
                if (floatVolume) floatVolume.value = String(savedVolume);
                if (savedVolume > 0) lastVolumeBeforeMute = savedVolume;
            }
            isMuted = localStorage.getItem(storageMutedKey) === '1';
            if (isMuted && volumeControl) volumeControl.value = '0';
            if (isMuted && floatVolume) floatVolume.value = '0';
        } catch (e) {}

        function saveAudioState() {
            try {
                if (volumeControl) localStorage.setItem(storageVolumeKey, String(Number(volumeControl.value)));
                localStorage.setItem(storageMutedKey, isMuted ? '1' : '0');
            } catch (e) {}
        }
        function tr(key, fallback) {
            return (translations[currentLang] && translations[currentLang][key]) ? translations[currentLang][key] : fallback;
        }
        function setAudioStatus(state) {
            currentAudioState = state;
            if (!statusText) return;
            const fallback = {
                off: 'SOM DESLIGADO',
                ready: 'PRONTO PARA TOCAR',
                playing: 'TOCANDO AGORA',
                paused: 'PAUSADO',
                next: 'PRÓXIMA FAIXA...',
                finished: 'FINALIZADO',
                unavailable: 'ÁUDIO INDISPONÍVEL'
            };
            statusText.textContent = tr(`audio_${state}`, fallback[state] || fallback.off);
        }
        window.syncAudioLanguage = function() {
            if (audioBadge) audioBadge.textContent = tr('audio_random_badge', 'RANDOM MODE');
            setAudioStatus(currentAudioState);
        };

        function ensureWidgetIframeSrc() {
            if (!widgetIframe) return '';
            const current = String(widgetIframe.getAttribute('src') || '').trim();
            if (current && current !== 'about:blank') return current;
            const pending = String(widgetIframe.getAttribute('data-src') || '').trim();
            if (pending) {
                widgetIframe.setAttribute('src', pending);
                return pending;
            }
            return '';
        }

        function loadSoundcloudApi() {
            if (window.SC && typeof window.SC.Widget === 'function') return Promise.resolve(true);

            const existing = document.getElementById('sc-widget-api');
            if (existing && existing.dataset.loaded === '1') return Promise.resolve(true);
            if (existing && existing.dataset.failed === '1') return Promise.resolve(false);
            if (existing && existing.dataset.loading === '1') {
                return new Promise((resolve) => {
                    existing.addEventListener('load', () => resolve(true), { once: true });
                    existing.addEventListener('error', () => resolve(false), { once: true });
                });
            }

            return new Promise((resolve) => {
                const script = existing || document.createElement('script');
                script.id = 'sc-widget-api';
                script.src = soundcloudApiUrl;
                script.async = true;
                script.defer = true;
                script.dataset.loading = '1';
                script.onload = () => {
                    script.dataset.loading = '0';
                    script.dataset.loaded = '1';
                    resolve(true);
                };
                script.onerror = () => {
                    script.dataset.loading = '0';
                    script.dataset.failed = '1';
                    resolve(false);
                };
                if (!existing) document.head.appendChild(script);
            });
        }

        function setAudioUnavailableState() {
            audioFeatureAvailable = false;
            setAudioStatus('unavailable');
            if (dock) dock.classList.add('audio-unavailable');
            if (btn) {
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            }
            if (prevBtn) {
                prevBtn.disabled = true;
                prevBtn.setAttribute('aria-disabled', 'true');
            }
            if (nextBtn) {
                nextBtn.disabled = true;
                nextBtn.setAttribute('aria-disabled', 'true');
            }
            if (muteBtn) {
                muteBtn.disabled = true;
                muteBtn.setAttribute('aria-disabled', 'true');
            }
            if (volumeControl) {
                volumeControl.disabled = true;
                volumeControl.setAttribute('aria-disabled', 'true');
            }
            if (floatControl) {
                floatControl.classList.remove('is-visible');
                floatControl.setAttribute('aria-hidden', 'true');
            }
        }

        function bindWidgetEventsOnce() {
            if (widgetBindDone || !widget || !window.SC || !SC.Widget || !SC.Widget.Events) return;
            widgetBindDone = true;

            widget.bind(SC.Widget.Events.READY, function() {
                isWidgetReady = true;
                const initialVol = Number(volumeControl ? volumeControl.value : 35);
                widget.setVolume(initialVol);
                if (floatVolume) floatVolume.value = String(initialVol);
                updateMuteUi();
                saveAudioState();
                setAudioStatus('ready');
                setTrackTitle('HARDWARE RANDOM SET');
                widget.getSounds(function(sounds) {
                    playlistSounds = Array.isArray(sounds) ? sounds : [];
                });
                updateFloatingAudioControlVisibility();
            });

            widget.bind(SC.Widget.Events.PLAY, function() {
                if (icon) {
                    icon.classList.remove('fa-play');
                    icon.classList.add('fa-pause');
                }
                if (dock) dock.classList.add('audio-on');
                setAudioStatus('playing');
                syncCurrentTrackMeta();
            });
            widget.bind(SC.Widget.Events.PAUSE, function() {
                if (icon) {
                    icon.classList.remove('fa-pause');
                    icon.classList.add('fa-play');
                }
                if (dock) dock.classList.remove('audio-on');
                setAudioStatus('paused');
            });
            widget.bind(SC.Widget.Events.FINISH, function() {
                if (playlistSounds.length > 1) {
                    setAudioStatus('next');
                    playRandomTrack(true);
                    return;
                }
                if (icon) {
                    icon.classList.remove('fa-pause');
                    icon.classList.add('fa-play');
                }
                if (dock) dock.classList.remove('audio-on');
                setAudioStatus('finished');
            });
        }

        function ensureWidgetReady() {
            if (!widgetIframe) return Promise.resolve(false);
            if (isWidgetReady && widget) return Promise.resolve(true);
            if (widgetLoadPromise) return widgetLoadPromise;

            widgetLoadPromise = new Promise((resolve) => {
                const src = ensureWidgetIframeSrc();
                if (!src) {
                    resolve(false);
                    return;
                }

                loadSoundcloudApi().then((apiOk) => {
                    if (!apiOk || !window.SC || typeof window.SC.Widget !== 'function') {
                        setAudioUnavailableState();
                        resolve(false);
                        return;
                    }

                    try {
                        widget = window.SC.Widget(widgetIframe);
                        audioFeatureAvailable = true;
                    } catch (_) {
                        widget = null;
                        setAudioUnavailableState();
                        resolve(false);
                        return;
                    }

                    bindWidgetEventsOnce();
                    resolve(true);
                }).catch(() => {
                    setAudioUnavailableState();
                    resolve(false);
                });
            }).finally(() => {
                widgetLoadPromise = null;
            });

            return widgetLoadPromise;
        }

        function warmupAudioLazy() {
            if (!widgetIframe || performanceMode === 'lite' || (connection && connection.saveData)) return;

            const warmup = () => { ensureWidgetReady().then(() => {}); };
            const startIdle = () => {
                if ('requestIdleCallback' in window) {
                    window.requestIdleCallback(warmup, { timeout: 2600 });
                } else {
                    setTimeout(warmup, 2200);
                }
            };

            if ('IntersectionObserver' in window && dockAnchor) {
                const audioObserver = new IntersectionObserver((entries, obs) => {
                    entries.forEach((entry) => {
                        if (!entry.isIntersecting) return;
                        warmup();
                        obs.disconnect();
                    });
                }, { root: null, threshold: 0.01, rootMargin: '260px 0px' });
                audioObserver.observe(dockAnchor);
                startIdle();
            } else {
                startIdle();
            }
        }

        function updateMuteUi() {
            if (muteBtn && muteIcon) {
                muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
                muteIcon.classList.toggle('fa-volume-high', !isMuted);
                muteIcon.classList.toggle('fa-volume-xmark', isMuted);
            }
            if (floatMuteBtn && floatMuteIcon) {
                floatMuteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
                floatMuteIcon.classList.toggle('fa-volume-high', !isMuted);
                floatMuteIcon.classList.toggle('fa-volume-xmark', isMuted);
            }
            if (floatIcon) {
                floatIcon.classList.toggle('fa-volume-high', !isMuted);
                floatIcon.classList.toggle('fa-volume-xmark', isMuted);
            }
        }

        function applyCurrentVolume() {
            if (!isWidgetReady || !volumeControl) return;
            widget.setVolume(Number(volumeControl.value));
        }
        function setVolumeValue(nextVol, source) {
            if (!volumeControl) return;
            var clamped = Math.max(0, Math.min(100, Number(nextVol)));
            volumeControl.value = String(clamped);
            if (floatVolume && source !== floatVolume) floatVolume.value = String(clamped);
            if (clamped > 0) lastVolumeBeforeMute = clamped;
            isMuted = clamped === 0;
            updateMuteUi();
            applyCurrentVolume();
            saveAudioState();
        }
        function toggleMute() {
            if (!volumeControl) return;
            if (isMuted) {
                var restoredVolume = lastVolumeBeforeMute > 0 ? lastVolumeBeforeMute : 35;
                setVolumeValue(restoredVolume);
            } else {
                var currentVol = Number(volumeControl.value);
                if (currentVol > 0) lastVolumeBeforeMute = currentVol;
                setVolumeValue(0);
            }
        }
        function setTrackTitle(title) {
            if (!trackText) return;
            trackText.textContent = title && title.trim() ? title.trim() : 'HARDWARE RANDOM SET';
        }
        function pickRandomTrackIndex() {
            if (!playlistSounds.length) return -1;
            if (playlistSounds.length === 1) return 0;
            let index = Math.floor(Math.random() * playlistSounds.length);
            while (index === currentTrackIndex) {
                index = Math.floor(Math.random() * playlistSounds.length);
            }
            return index;
        }
        function ensurePlaylist(callback) {
            if (playlistSounds.length) {
                callback();
                return;
            }
            widget.getSounds(function(sounds) {
                playlistSounds = Array.isArray(sounds) ? sounds : [];
                callback();
            });
        }
        function playTrackByIndex(index, forcePlay) {
            if (!isWidgetReady || !playlistSounds.length) return;
            const total = playlistSounds.length;
            const normalized = ((index % total) + total) % total;
            currentTrackIndex = normalized;
            setTrackTitle(playlistSounds[normalized]?.title || 'HARDWARE RANDOM SET');
            widget.skip(normalized);
            if (forcePlay) widget.play();
        }
        function playNextTrack(forcePlay) {
            if (!playlistSounds.length) return;
            const nextIndex = currentTrackIndex >= 0 ? currentTrackIndex + 1 : 0;
            playTrackByIndex(nextIndex, forcePlay);
        }
        function playPrevTrack(forcePlay) {
            if (!playlistSounds.length) return;
            const prevIndex = currentTrackIndex >= 0 ? currentTrackIndex - 1 : playlistSounds.length - 1;
            playTrackByIndex(prevIndex, forcePlay);
        }
        function playRandomTrack(forcePlay) {
            if (!isWidgetReady) return;
            const nextIndex = pickRandomTrackIndex();
            if (nextIndex < 0) return;
            currentTrackIndex = nextIndex;
            setTrackTitle(playlistSounds[nextIndex]?.title || 'HARDWARE RANDOM SET');
            widget.skip(nextIndex);
            if (forcePlay) widget.play();
        }
        function syncCurrentTrackMeta() {
            if (!isWidgetReady) return;
            widget.getCurrentSound(function(sound) {
                if (!sound) return;
                setTrackTitle(sound.title || 'HARDWARE RANDOM SET');
                if (typeof sound.index === 'number') currentTrackIndex = sound.index;
                else {
                    const idx = playlistSounds.findIndex((s) => s && sound && s.id === sound.id);
                    if (idx >= 0) currentTrackIndex = idx;
                }
            });
        }
        function updateAudioDockLayout() {
            if (!dock || !dockAnchor) return;
            const mobile = window.innerWidth <= 768;
            if (dock.parentElement !== dockAnchor) dockAnchor.appendChild(dock);
            dock.classList.add('desktop-inline');
            dock.classList.toggle('mobile-inline', mobile);
            dock.classList.remove('faded');
        }
        function updateFloatingAudioControlVisibility() {
            if (!floatControl) return;
            const mobile = window.innerWidth <= 768;
            const shouldShow = audioFeatureAvailable && mobile && window.scrollY > 460;
            floatControl.classList.toggle('is-visible', shouldShow);
            floatControl.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
            if (!shouldShow) {
                floatControl.classList.remove('open');
                floatControl.classList.remove('is-active');
                if (floatToggle) floatToggle.setAttribute('aria-expanded', 'false');
            }
        }
        function wakeFloatingControl() {
            if (!floatControl || !floatControl.classList.contains('is-visible')) return;
            floatControl.classList.add('is-active');
            if (floatActiveTimer) clearTimeout(floatActiveTimer);
            floatActiveTimer = setTimeout(() => {
                if (floatControl && !floatControl.classList.contains('open')) {
                    floatControl.classList.remove('is-active');
                }
            }, 1800);
        }
        updateAudioDockLayout();
        updateFloatingAudioControlVisibility();
        const syncAudioDockOnResize = debounce(function() {
            updateAudioDockLayout();
            updateFloatingAudioControlVisibility();
        }, 120);
        window.addEventListener('resize', syncAudioDockOnResize, { passive: true });
        updateMuteUi();
        setAudioStatus('off');
        if (audioBadge) audioBadge.textContent = tr('audio_random_badge', 'RANDOM MODE');
        if (!widgetIframe) setAudioUnavailableState();
        else warmupAudioLazy();

        function fadePlayer() {
            return;
        }
        function unFadePlayer() {
            if (!dock) return;
            dock.classList.remove('faded');
        }

        let floatScrollRaf = null;
        window.addEventListener('scroll', function() {
            if (floatScrollRaf !== null) return;
            floatScrollRaf = requestAnimationFrame(function () {
                updateFloatingAudioControlVisibility();
                floatScrollRaf = null;
            });
        }, { passive: true });
        if (floatControl) {
            floatControl.addEventListener('mouseenter', wakeFloatingControl);
            floatControl.addEventListener('touchstart', wakeFloatingControl, { passive: true });
        }
        document.body.addEventListener('click', (e) => {
            if (dock && e.target !== dock && !dock.contains(e.target)) {
                fadePlayer();
            }
            if (floatControl && !floatControl.contains(e.target)) {
                floatControl.classList.remove('open');
                floatControl.classList.remove('is-active');
                if (floatToggle) floatToggle.setAttribute('aria-expanded', 'false');
            }
        });
        if (dock) {
            dock.addEventListener('mouseenter', unFadePlayer);
            dock.addEventListener('touchstart', unFadePlayer, { passive: true });
        }

        if (btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                ensureWidgetReady().then((ready) => {
                    if (!ready || !widget) return;
                    unFadePlayer();
                    if (!hasFirstPlay) {
                        hasFirstPlay = true;
                        if (playlistSounds.length) playRandomTrack(true);
                        else {
                            widget.getSounds(function(sounds) {
                                playlistSounds = Array.isArray(sounds) ? sounds : [];
                                if (playlistSounds.length) playRandomTrack(true);
                                else widget.play();
                            });
                        }
                        return;
                    }
                    widget.toggle();
                });
            });
        }
        function handleTrackStep(direction) {
            ensureWidgetReady().then((ready) => {
                if (!ready || !widget) return;
                unFadePlayer();
                ensurePlaylist(function() {
                    if (!playlistSounds.length) {
                        widget.play();
                        return;
                    }
                    if (!hasFirstPlay) hasFirstPlay = true;
                    if (direction > 0) playNextTrack(true);
                    else playPrevTrack(true);
                });
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handleTrackStep(1);
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handleTrackStep(-1);
            });
        }

        if (volumeControl) {
            volumeControl.addEventListener('input', function() {
                if (!isWidgetReady) ensureWidgetReady().then(() => {});
                setVolumeValue(volumeControl.value, volumeControl);
            });
        }
        if (floatVolume) {
            floatVolume.addEventListener('input', function() {
                wakeFloatingControl();
                if (!isWidgetReady) ensureWidgetReady().then(() => {});
                setVolumeValue(floatVolume.value, floatVolume);
            });
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                unFadePlayer();
                toggleMute();
            });
        }
        if (floatMuteBtn) {
            floatMuteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                wakeFloatingControl();
                toggleMute();
            });
        }
        if (floatToggle) {
            floatToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (!floatControl) return;
                const willOpen = !floatControl.classList.contains('open');
                floatControl.classList.toggle('open', willOpen);
                if (willOpen) wakeFloatingControl();
                floatToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
        }

        // COUNTDOWN FIXED
        function pulseCountdownBox(box) {
            if (!box) return;
            box.classList.remove('is-updating');
            void box.offsetWidth;
            box.classList.add('is-updating');
        }

        function setCountdownValue(id, nextValue) {
            const el = document.getElementById(id);
            if (!el) return;
            const text = String(nextValue);
            if (el.innerText !== text) {
                el.innerText = text;
                pulseCountdownBox(el.closest('.countdown-box'));
                return;
            }
            el.innerText = text;
        }

        const runtimePreviewMode = String(new URLSearchParams(window.location.search).get('preview') || '').trim().toLowerCase();

        function setTemporaryVisibility(element, shouldShow) {
            if (!element) return;
            element.classList.toggle('is-temporarily-hidden', !shouldShow);
        }

        function getEventStartMs() {
            return (window.HardwareCMS && typeof window.HardwareCMS.getEventDateMs === "function")
                ? window.HardwareCMS.getEventDateMs(fallbackEventDateIso)
                : new Date(fallbackEventDateIso).getTime();
        }

        function getScheduleRevealMs(eventStartMs) {
            const revealDate = new Date(eventStartMs);
            revealDate.setDate(revealDate.getDate() - 1);
            revealDate.setHours(12, 0, 0, 0);
            return revealDate.getTime();
        }

        function getSiteRuntimeState() {
            const eventStartMs = getEventStartMs();
            const eventEndMs = eventStartMs + eventDurationMs;
            const scheduleRevealMs = getScheduleRevealMs(eventStartMs);
            let nowMs = Date.now();

            if (runtimePreviewMode === 'sales-closed' || runtimePreviewMode === 'countdown-ended' || runtimePreviewMode === 'portaria') {
                nowMs = eventStartMs + 60 * 1000;
            } else if (runtimePreviewMode === 'event-ended' || runtimePreviewMode === 'after-event') {
                nowMs = eventEndMs + 60 * 1000;
            } else if (runtimePreviewMode === 'timetable-live') {
                nowMs = Math.min(eventStartMs - 60 * 1000, scheduleRevealMs + 60 * 1000);
            }

            let phase = 'before-reveal';
            if (nowMs >= eventEndMs) phase = 'event-ended';
            else if (nowMs >= eventStartMs) phase = 'sales-closed';
            else if (nowMs >= scheduleRevealMs) phase = 'before-start';

            return {
                nowMs,
                eventStartMs,
                eventEndMs,
                scheduleRevealMs,
                phase,
                showSchedule: phase === 'before-start' || phase === 'sales-closed',
                showCountdown: phase === 'before-reveal' || phase === 'before-start',
                showSalesStatus: phase === 'sales-closed',
                showFaq: phase !== 'event-ended',
                showSalesInfo: phase !== 'event-ended',
                hideTicketAction: phase === 'sales-closed' || phase === 'event-ended'
            };
        }

        function applyEventRuntimeState() {
            const state = getSiteRuntimeState();
            const countdownWrap = document.getElementById('countdown-wrap');
            const salesStatusBanner = document.getElementById('sales-status-banner');
            const scheduleSection = document.getElementById('dj-schedule-section');
            const ticketAction = document.getElementById('action-ticket');
            const faqSection = document.getElementById('faq-section');
            const guideSection = document.getElementById('guide-section');
            const nightPhasesSection = document.getElementById('night-phases-section');
            const salesInfoBlocks = document.querySelectorAll('.about-vip');

            document.body.classList.remove('event-before-reveal', 'event-before-start', 'event-sales-closed', 'event-ended');
            if (state.phase === 'before-reveal') document.body.classList.add('event-before-reveal');
            if (state.phase === 'before-start') document.body.classList.add('event-before-start');
            if (state.phase === 'sales-closed') document.body.classList.add('event-sales-closed');
            if (state.phase === 'event-ended') document.body.classList.add('event-ended');

            setTemporaryVisibility(countdownWrap, state.showCountdown);
            setTemporaryVisibility(salesStatusBanner, state.showSalesStatus);
            setTemporaryVisibility(scheduleSection, state.showSchedule);
            setTemporaryVisibility(ticketAction, !state.hideTicketAction);
            setTemporaryVisibility(faqSection, state.showFaq);
            setTemporaryVisibility(guideSection, state.showFaq);
            setTemporaryVisibility(nightPhasesSection, state.showFaq);
            salesInfoBlocks.forEach((element) => setTemporaryVisibility(element, state.showSalesInfo));

            return state;
        }

        function updateCountdown() {
            const state = applyEventRuntimeState();
            const distance = state.eventStartMs - state.nowMs;

            if (!state.showCountdown || distance < 0) {
                setCountdownValue("days", "00");
                setCountdownValue("hours", "00");
                setCountdownValue("minutes", "00");
                return state;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

            setCountdownValue("days", days < 10 ? "0" + days : days);
            setCountdownValue("hours", hours < 10 ? "0" + hours : hours);
            setCountdownValue("minutes", minutes < 10 ? "0" + minutes : minutes);
            return state;
        }
        let countdownTimer = null;
        function startCountdownTimer() {
            if (countdownTimer) clearInterval(countdownTimer);
            countdownTimer = setInterval(updateCountdown, 15000);
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (countdownTimer) {
                    clearInterval(countdownTimer);
                    countdownTimer = null;
                }
                return;
            }
            updateCountdown();
            startCountdownTimer();
        });
        updateCountdown();
        startCountdownTimer();



