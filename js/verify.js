// Email verification page — same API base as app.js
const API_BASE_URL =
    (typeof window !== 'undefined' && window.__CARBON_API_BASE__) ||
    'https://carbon-calculator-api-fe1o.onrender.com/api';

function parseJsonResponse(raw) {
    if (!raw || !String(raw).trim()) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function initVerifyPage() {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email') || '';
    const emailInput = document.getElementById('verifyEmail');
    const codeInput = document.getElementById('verifyCode');
    const form = document.getElementById('verifyForm');
    const resendBtn = document.getElementById('resendCode');
    const errEl = document.getElementById('verifyError');
    const okEl = document.getElementById('verifySuccess');
    const devEl = document.getElementById('verifyDevHint');

    if (emailInput && emailParam) {
        emailInput.value = decodeURIComponent(emailParam);
    }

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errEl) errEl.textContent = '';
        if (okEl) okEl.textContent = '';

        const email = (emailInput?.value || '').trim();
        const code = (codeInput?.value || '').replace(/\D/g, '').slice(0, 6);
        if (codeInput) codeInput.value = code;

        if (!email || code.length !== 6) {
            if (errEl) errEl.textContent = 'Enter your email and the 6-digit code.';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = parseJsonResponse(await response.text());
            if (response.ok) {
                if (okEl) okEl.textContent = data.msg || 'Verified. You can log in.';
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                if (errEl) errEl.textContent = data.msg || 'Verification failed.';
            }
        } catch {
            if (errEl) errEl.textContent = 'Connection error. Is the backend running?';
        }
    });

    resendBtn?.addEventListener('click', async () => {
        if (errEl) errEl.textContent = '';
        if (okEl) okEl.textContent = '';
        if (devEl) devEl.textContent = '';

        const email = (emailInput?.value || '').trim();
        if (!email) {
            if (errEl) errEl.textContent = 'Enter your email first.';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = parseJsonResponse(await response.text());
            if (response.ok) {
                if (okEl) okEl.textContent = data.msg || 'Code sent.';
                if (devEl && data.dev_verification_code) {
                    devEl.textContent = `Dev code: ${data.dev_verification_code}`;
                }
            } else if (response.status === 429) {
                if (errEl) errEl.textContent = data.msg || 'Please wait before resending.';
            } else {
                if (errEl) errEl.textContent = data.msg || 'Could not resend.';
            }
        } catch {
            if (errEl) errEl.textContent = 'Connection error.';
        }
    });
}

document.addEventListener('DOMContentLoaded', initVerifyPage);
