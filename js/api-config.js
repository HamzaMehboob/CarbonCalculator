/**
 * API base URL — shared by app.js, export.js, organization-users.js.
 * Local dev: http://127.0.0.1:5000/api when opened from localhost.
 * Override: ?api=http://127.0.0.1:5000/api or localStorage carbonApiBase
 */
(function (global) {
    const RENDER_API = 'https://carboncalculator-2eak.onrender.com/api';

    function normalizeApiBase(raw) {
        if (!raw) return '';
        let s = String(raw).trim().replace(/\/+$/, '');
        if (!/\/api$/i.test(s)) {
            s += '/api';
        }
        return s;
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
        try {
            const stored = global.localStorage.getItem('carbonApiBase');
            if (stored) return normalizeApiBase(stored);
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

    function isLocalApiBase(base) {
        return /localhost|127\.0\.0\.1/i.test(base || '');
    }

    /** Bases to try for login (local first, then Render if local is configured). */
    function loginApiBaseCandidates() {
        const primary = resolveApiBaseUrl();
        const candidates = [primary];
        if (isLocalApiBase(primary) && primary !== RENDER_API) {
            candidates.push(RENDER_API);
        }
        return [...new Set(candidates)];
    }

    global.resolveApiBaseUrl = resolveApiBaseUrl;
    global.getApiRootUrl = getApiRootUrl;
    global.CARBON_RENDER_API_BASE = RENDER_API;
    global.unlockOrgAdminMainApp = unlockOrgAdminMainApp;
    global.allowOrgAdminMainApp = allowOrgAdminMainApp;
    global.clearOrgAdminMainAppUnlock = clearOrgAdminMainAppUnlock;
    global.loginApiBaseCandidates = loginApiBaseCandidates;
    global.isLocalApiBase = isLocalApiBase;
})(typeof window !== 'undefined' ? window : globalThis);
