function getApiBaseUrl() {
    return typeof resolveApiBaseUrl === 'function'
        ? resolveApiBaseUrl()
        : 'https://carboncalculator-2eak.onrender.com/api';
}

function getOrgHeaders(extra) {
    const headers = { ...(extra || {}) };
    const token = localStorage.getItem('authToken');
    if (token) headers.Authorization = `Bearer ${token}`;
    const orgId = localStorage.getItem('organizationId');
    if (orgId) headers['X-Organization-Id'] = orgId;
    return headers;
}

function canViewOrganizationAuditLog() {
    if (typeof isMongoAuditLoggingEnabled === 'function' && !isMongoAuditLoggingEnabled()) {
        return false;
    }
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    const isOrgAdmin = localStorage.getItem('isOrgAdmin') === 'true';
    const isPlatformAdmin = localStorage.getItem('isPlatformAdmin') === 'true';
    const isConsultant = localStorage.getItem('isConsultant') === 'true';
    return isOrgAdmin || isPlatformAdmin || isConsultant;
}

function ensureAuditLogAccess() {
    if (!canViewOrganizationAuditLog()) {
        const back =
            localStorage.getItem('isPlatformAdmin') === 'true'
                ? 'platform-admin.html'
                : localStorage.getItem('isConsultant') === 'true'
                  ? 'consultant-workbench.html'
                  : 'organization-users.html';
        window.location.href =
            typeof isMongoAuditLoggingEnabled === 'function' &&
            !isMongoAuditLoggingEnabled()
                ? back
                : 'index.html';
        return false;
    }
    return true;
}

async function downloadOrganizationAuditLogTxt() {
    const statusEl = document.getElementById('auditLogStatus');
    if (statusEl) statusEl.textContent = 'Preparing download…';
    try {
        const response = await fetch(
            `${getApiBaseUrl()}/organization/audit-log?format=txt&limit=2000`,
            { headers: getOrgHeaders() }
        );
        if (response.status === 401 || response.status === 422) {
            if (typeof clearAuthSession === 'function') clearAuthSession();
            window.location.href = 'index.html';
            return;
        }
        if (response.status === 403) {
            if (statusEl) statusEl.textContent = 'You do not have permission to view this audit log.';
            return;
        }
        if (response.status === 404) {
            if (statusEl) {
                statusEl.textContent =
                    'Organization audit logging is disabled on this server.';
            }
            return;
        }
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            if (statusEl) statusEl.textContent = err.msg || 'Could not download audit log.';
            return;
        }
        const blob = await response.blob();
        const orgId = localStorage.getItem('organizationId') || 'organization';
        const safeId = orgId.replace(/[^\w\-]+/g, '_').slice(0, 48);
        const filename = `organization-audit-log-${safeId}.txt`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        if (statusEl) statusEl.textContent = 'Download started.';
    } catch (e) {
        console.error(e);
        if (statusEl) statusEl.textContent = 'Network error while downloading audit log.';
    }
}

async function loadAuditLogPreview() {
    const previewEl = document.getElementById('auditLogPreview');
    if (!previewEl) return;
    previewEl.textContent = 'Loading recent entries…';
    try {
        const response = await fetch(
            `${getApiBaseUrl()}/organization/audit-log?limit=30`,
            { headers: getOrgHeaders() }
        );
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            previewEl.textContent =
                response.status === 404
                    ? err.msg || 'Organization audit logging is disabled on this server.'
                    : err.msg || 'Could not load audit log.';
            return;
        }
        const data = await response.json();
        const entries = data.entries || [];
        if (!entries.length) {
            previewEl.textContent =
                'No audit entries yet. Changes to organization data in MongoDB will appear here.';
            return;
        }
        const lines = entries.map((entry) => {
            const when = entry.timestamp
                ? new Date(entry.timestamp).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
                : '';
            const who =
                entry.actor_email ||
                entry.actor_username ||
                'unknown';
            const role = entry.actor_role || 'user';
            const action = entry.action || 'change';
            const summary = entry.summary || '';
            const changeCount = Array.isArray(entry.changes) ? entry.changes.length : 0;
            return `[${when}] ${who} (${role}) — ${action}\n  ${summary} (${changeCount} detail line(s))`;
        });
        previewEl.textContent = lines.join('\n\n');
    } catch (e) {
        console.error(e);
        previewEl.textContent = 'Network error while loading preview.';
    }
}

function initAuditLogPage() {
    if (!ensureAuditLogAccess()) return;
    const orgName = localStorage.getItem('organizationName') || localStorage.getItem('companyName');
    const heading = document.getElementById('auditOrgNameHeading');
    if (heading) heading.textContent = orgName || 'Organization';

    document.getElementById('downloadAuditLogBtn')?.addEventListener('click', downloadOrganizationAuditLogTxt);
    document.getElementById('refreshAuditLogBtn')?.addEventListener('click', loadAuditLogPreview);

    document.getElementById('auditBackBtn')?.addEventListener('click', () => {
        const isPlatformAdmin = localStorage.getItem('isPlatformAdmin') === 'true';
        const isConsultant = localStorage.getItem('isConsultant') === 'true';
        const isOrgAdmin = localStorage.getItem('isOrgAdmin') === 'true';
        if (isPlatformAdmin) {
            window.location.href = 'platform-admin.html';
        } else if (isConsultant) {
            window.location.href = 'consultant-workbench.html';
        } else if (isOrgAdmin) {
            window.location.href = 'organization-users.html';
        } else {
            window.location.href = 'index.html';
        }
    });

    document.getElementById('auditOpenAppBtn')?.addEventListener('click', () => {
        localStorage.setItem('orgOpenMainApp', 'true');
        window.location.href = 'index.html';
    });

    document.getElementById('auditLogoutBtn')?.addEventListener('click', () => {
        if (typeof clearAuthSession === 'function') clearAuthSession();
        window.location.href = 'index.html';
    });

    loadAuditLogPreview();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuditLogPage);
} else {
    initAuditLogPage();
}

window.canViewOrganizationAuditLog = canViewOrganizationAuditLog;
window.downloadOrganizationAuditLogTxt = downloadOrganizationAuditLogTxt;
