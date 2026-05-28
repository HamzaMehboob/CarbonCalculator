/**
 * Wake the Render-hosted API as soon as the login page loads (and while the user types).
 * Loaded from index.html before Chart.js / app.js so cold-start begins early.
 */
(function (global) {
    const API_ROOT =
        (global.__CARBON_API_BASE__ || 'https://carboncalculator-2eak.onrender.com/api').replace(
            /\/api\/?$/,
            ''
        ) + '/';

    let lastPingAt = 0;
    const MIN_PING_INTERVAL_MS = 8000;

    function pingRenderBackend() {
        const now = Date.now();
        if (now - lastPingAt < MIN_PING_INTERVAL_MS) {
            return;
        }
        lastPingAt = now;
        fetch(API_ROOT, { method: 'GET', mode: 'cors', cache: 'no-store' }).catch(function () {});
    }

    function bindLoginFieldWarmup() {
        const fields = ['loginEmail', 'loginPassword'];
        let inputTimer = null;

        function onInputActivity() {
            clearTimeout(inputTimer);
            inputTimer = setTimeout(pingRenderBackend, 350);
        }

        fields.forEach(function (id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('focus', pingRenderBackend);
            el.addEventListener('input', onInputActivity);
        });
    }

    global.wakeRenderBackend = pingRenderBackend;

    pingRenderBackend();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindLoginFieldWarmup);
    } else {
        bindLoginFieldWarmup();
    }
})(typeof window !== 'undefined' ? window : globalThis);
