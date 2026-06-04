/**
 * API base URL — shared by app.js, export.js, organization-users.js.
 * GitHub Pages: always uses Render API (ignores stale localhost overrides in storage).
 */
(function (global) {
    const RENDER_API = 'https://carboncalculator-2eak.onrender.com/api';

    /** Must match backend/mongo_api.py ENABLE_MONGODB_AUDIT_LOGGING — hides audit UI when false. */
    const ENABLE_MONGODB_AUDIT_LOGGING = false;

    function isMongoAuditLoggingEnabled() {
        return ENABLE_MONGODB_AUDIT_LOGGING === true;
    }

    function normalizeApiBase(raw) {
        if (!raw) return '';
        let s = String(raw).trim().replace(/\/+$/, '');
        if (!/\/api$/i.test(s)) {
            s += '/api';
        }
        return s;
    }

    function isGithubPagesHost() {
        const host = (global.location && global.location.hostname) || '';
        return host === 'github.io' || host.endsWith('.github.io');
    }

    function isLocalApiBase(base) {
        return /localhost|127\.0\.0\.1/i.test(base || '');
    }

    function resolveApiBaseUrl() {
        if (global.__CARBON_API_BASE__) {
            return normalizeApiBase(global.__CARBON_API_BASE__);
        }
        try {
            const qs = new URLSearchParams(global.location.search || '');
            const fromQuery = qs.get('api');
            if (fromQuery) {
                const normalized = normalizeApiBase(fromQuery);
                global.localStorage.setItem('carbonApiBase', normalized);
                return normalized;
            }
        } catch (_e) {
            /* ignore */
        }
        if (isGithubPagesHost()) {
            return RENDER_API;
        }
        try {
            const stored = global.localStorage.getItem('carbonApiBase');
            if (stored && !isLocalApiBase(stored)) {
                return normalizeApiBase(stored);
            }
            if (stored && isLocalApiBase(stored)) {
                global.localStorage.removeItem('carbonApiBase');
            }
        } catch (_e2) {
            /* ignore */
        }
        const host = (global.location && global.location.hostname) || '';
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://127.0.0.1:5000/api';
        }
        return RENDER_API;
    }

    function getApiRootUrl() {
        return resolveApiBaseUrl().replace(/\/api\/?$/i, '') + '/';
    }

    const ORG_MAIN_APP_SESSION_KEY = 'orgMainAppUnlocked';

    function unlockOrgAdminMainApp() {
        try {
            global.sessionStorage.setItem(ORG_MAIN_APP_SESSION_KEY, 'true');
            global.localStorage.setItem('orgOpenMainApp', 'true');
        } catch (_e) {
            /* ignore */
        }
    }

    function allowOrgAdminMainApp() {
        try {
            if (global.sessionStorage.getItem(ORG_MAIN_APP_SESSION_KEY) === 'true') {
                return true;
            }
            if (global.localStorage.getItem('orgOpenMainApp') === 'true') {
                return true;
            }
        } catch (_e2) {
            /* ignore */
        }
        return false;
    }

    function clearOrgAdminMainAppUnlock() {
        try {
            global.sessionStorage.removeItem(ORG_MAIN_APP_SESSION_KEY);
            global.localStorage.removeItem('orgOpenMainApp');
        } catch (_e) {
            /* ignore */
        }
    }

    function applyOrgMainUnlockFromUrl() {
        try {
            const qs = new URLSearchParams(global.location.search || '');
            if (qs.get('orgMain') === '1') {
                unlockOrgAdminMainApp();
            }
        } catch (_e) {
            /* ignore */
        }
    }

    /** Bases to try for login. GitHub Pages → Render only. */
    function loginApiBaseCandidates() {
        if (isGithubPagesHost()) {
            return [RENDER_API];
        }
        const primary = resolveApiBaseUrl();
        const candidates = [primary];
        if (isLocalApiBase(primary) && primary !== RENDER_API) {
            candidates.push(RENDER_API);
        }
        return [...new Set(candidates)];
    }

    /** Clear auth + API override so the next login uses a fresh token and correct API. */
    function clearAuthSessionStorage() {
        try {
            global.localStorage.removeItem('loggedIn');
            global.localStorage.removeItem('loginEmail');
            global.localStorage.removeItem('userEmail');
            global.localStorage.removeItem('authToken');
            global.localStorage.removeItem('sessionExpiresAt');
            global.localStorage.removeItem('sessionLastActivity');
            global.localStorage.removeItem('organizationId');
            global.localStorage.removeItem('organizationName');
            global.localStorage.removeItem('userName');
            global.localStorage.removeItem('isOrgAdmin');
            global.localStorage.removeItem('isPlatformAdmin');
            global.localStorage.removeItem('isConsultant');
            global.localStorage.removeItem('orgOpenMainApp');
            global.localStorage.removeItem('companyName');
            global.localStorage.removeItem('carbonApiBase');
        } catch (_e) {
            /* ignore */
        }
        clearOrgAdminMainAppUnlock();
    }

    const LOGIN_TIMEOUT_MS = 120000;

    async function carbonApiFetch(url, options = {}, timeoutMs = LOGIN_TIMEOUT_MS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, {
                credentials: 'omit',
                mode: 'cors',
                ...options,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /** POST /login with long timeout; retries once while Render cold-starts. */
    async function loginPost(identifier, password) {
        const body = { login: identifier, password };
        const bases = loginApiBaseCandidates();
        let lastErr = null;
        for (const base of bases) {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                if (attempt > 0) {
                    await sleep(4000);
                }
                try {
                    const response = await carbonApiFetch(
                        `${base}/login`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        },
                        LOGIN_TIMEOUT_MS
                    );
                    if (base !== resolveApiBaseUrl()) {
                        try {
                            global.localStorage.setItem('carbonApiBase', base);
                        } catch (_e) {
                            /* ignore */
                        }
                    }
                    return response;
                } catch (err) {
                    lastErr = err;
                    console.warn('Login attempt failed:', base, attempt, err);
                }
            }
        }
        throw lastErr || new Error('Login request failed');
    }

    function loginConnectionErrorMessage(err, language) {
        let lang = language;
        if (!lang) {
            try {
                lang = global.localStorage.getItem('language') || 'en';
            } catch (_e) {
                lang = 'en';
            }
        }
        const isPt = lang === 'pt';
        if (err && err.name === 'AbortError') {
            return isPt
                ? 'O servidor demorou demais a responder. Aguarde um minuto e tente novamente.'
                : 'The server took too long to respond. Wait a minute and try again.';
        }
        return isPt
            ? 'Erro de ligação ao servidor. O Render pode estar a iniciar — aguarde até 2 minutos e tente de novo.'
            : 'Connection error reaching the server. Render may be waking up — wait up to 2 minutes and try again.';
    }

    /** Fire-and-forget ping so Render starts waking before the user submits login. */
    function warmRenderService() {
        const root = getApiRootUrl();
        carbonApiFetch(root, { method: 'GET' }, 15000).catch(() => {});
    }

    applyOrgMainUnlockFromUrl();
    if (isGithubPagesHost() || !isLocalApiBase(resolveApiBaseUrl())) {
        warmRenderService();
    }

    global.resolveApiBaseUrl = resolveApiBaseUrl;
    global.getApiRootUrl = getApiRootUrl;
    global.CARBON_RENDER_API_BASE = RENDER_API;
    global.unlockOrgAdminMainApp = unlockOrgAdminMainApp;
    global.allowOrgAdminMainApp = allowOrgAdminMainApp;
    global.clearOrgAdminMainAppUnlock = clearOrgAdminMainAppUnlock;
    global.applyOrgMainUnlockFromUrl = applyOrgMainUnlockFromUrl;
    global.loginApiBaseCandidates = loginApiBaseCandidates;
    global.isLocalApiBase = isLocalApiBase;
    global.isGithubPagesHost = isGithubPagesHost;
    global.clearAuthSessionStorage = clearAuthSessionStorage;
    global.carbonApiFetch = carbonApiFetch;
    global.loginPost = loginPost;
    global.loginConnectionErrorMessage = loginConnectionErrorMessage;
    global.LOGIN_TIMEOUT_MS = LOGIN_TIMEOUT_MS;
    global.ENABLE_MONGODB_AUDIT_LOGGING = ENABLE_MONGODB_AUDIT_LOGGING;
    global.isMongoAuditLoggingEnabled = isMongoAuditLoggingEnabled;
})(typeof window !== 'undefined' ? window : globalThis);
