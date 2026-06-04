function getApiBaseUrl() {
    return typeof resolveApiBaseUrl === 'function'
        ? resolveApiBaseUrl()
        : 'https://carboncalculator-2eak.onrender.com/api';
}

function clearAuthSession() {
    if (typeof clearAuthSessionStorage === 'function') {
        clearAuthSessionStorage();
        return;
    }
    localStorage.clear();
}

function ensureConsultantAccess() {
    const token = localStorage.getItem('authToken');
    const isConsultant = localStorage.getItem('isConsultant') === 'true';
    if (!token || !isConsultant) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const orgId = localStorage.getItem('organizationId');
    if (orgId) headers['X-Organization-Id'] = orgId;
    return fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });
}

function openOrganization(orgId, orgName) {
    localStorage.setItem('organizationId', orgId);
    localStorage.setItem('organizationName', orgName);
    localStorage.setItem('companyName', orgName);
    localStorage.setItem('orgOpenMainApp', 'true');
    window.location.href = 'index.html';
}

let workbenchOrgIds = new Set();

async function loadWorkbench() {
    const errEl = document.getElementById('workbenchError');
    const body = document.getElementById('workbenchTableBody');
    const emptyEl = document.getElementById('workbenchEmpty');
    if (errEl) errEl.textContent = '';
    const token = localStorage.getItem('authToken');
    try {
        const response = await apiFetch('/consultant/workbench', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (errEl) errEl.textContent = data.msg || 'Could not load workbench.';
            return;
        }
        const items = data.workbench || [];
        workbenchOrgIds = new Set(items.map((m) => m.organization_id).filter(Boolean));
        const rows = items
            .map((m) => {
                const id = m.organization_id || '';
                const name = m.organization_name || id;
                return `<tr>
                    <td>${name}</td>
                    <td>
                        <button type="button" class="btn-link" data-action="open-org" data-org-id="${id}" data-org-name="${String(name).replace(/"/g, '&quot;')}">Open data</button>
                        ${
                            typeof isMongoAuditLoggingEnabled === 'function' &&
                            isMongoAuditLoggingEnabled()
                                ? `<button type="button" class="btn-link" data-action="audit-log" data-org-id="${id}" data-org-name="${String(name).replace(/"/g, '&quot;')}">Audit log</button>`
                                : ''
                        }
                        <button type="button" class="btn-link" data-action="remove-workbench" data-org-id="${id}">Remove from workbench</button>
                    </td>
                </tr>`;
            })
            .join('');
        if (body) body.innerHTML = rows;
        if (emptyEl) emptyEl.style.display = items.length ? 'none' : 'block';
        await loadAllOrganizations();
    } catch (_err) {
        if (errEl) errEl.textContent = 'Connection error loading workbench.';
    }
}

async function loadAllOrganizations() {
    const errEl = document.getElementById('allOrgsError');
    const body = document.getElementById('allOrgsTableBody');
    if (errEl) errEl.textContent = '';
    const token = localStorage.getItem('authToken');
    try {
        const response = await apiFetch('/consultant/organizations', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (errEl) errEl.textContent = data.msg || 'Could not load organizations.';
            return;
        }
        const rows = (data.organizations || [])
            .map((o) => {
                const id = o.id || o._id || '';
                const name = o.name || '';
                const inBench = workbenchOrgIds.has(id);
                const addBtn = inBench
                    ? '<span style="color: var(--text-secondary);">In workbench</span>'
                    : `<button type="button" class="btn-link" data-action="add-workbench" data-org-id="${id}">Add to workbench</button>`;
                return `<tr><td>${name}</td><td>${addBtn}</td></tr>`;
            })
            .join('');
        if (body) body.innerHTML = rows || '<tr><td colspan="2">No organizations available.</td></tr>';
    } catch (_err) {
        if (errEl) errEl.textContent = 'Connection error.';
    }
}

async function addToWorkbench(orgId) {
    const errEl = document.getElementById('allOrgsError');
    const token = localStorage.getItem('authToken');
    try {
        const response = await apiFetch('/consultant/workbench', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ organization_id: orgId }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            await loadWorkbench();
        } else if (errEl) {
            errEl.textContent = data.msg || 'Could not add to workbench.';
        }
    } catch (_err) {
        if (errEl) errEl.textContent = 'Connection error.';
    }
}

async function removeFromWorkbench(orgId) {
    if (!confirm('Remove this organization from your workbench only (data is not deleted)?')) return;
    const errEl = document.getElementById('workbenchError');
    const token = localStorage.getItem('authToken');
    try {
        const response = await apiFetch(`/consultant/workbench/${encodeURIComponent(orgId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            await loadWorkbench();
        } else if (errEl) {
            errEl.textContent = data.msg || 'Could not remove from workbench.';
        }
    } catch (_err) {
        if (errEl) errEl.textContent = 'Connection error.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!ensureConsultantAccess()) return;

    const heading = document.getElementById('consultantUserHeading');
    if (heading) {
        heading.textContent = localStorage.getItem('userName') || localStorage.getItem('loginEmail') || 'Consultant';
    }

    document.getElementById('workbenchTableBody')?.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute('data-action');
        const orgId = target.getAttribute('data-org-id');
        const orgName = target.getAttribute('data-org-name') || '';
        if (!orgId) return;
        if (action === 'open-org') {
            openOrganization(orgId, orgName);
        } else if (action === 'audit-log') {
            openOrganization(orgId, orgName);
            window.location.href = 'organization-audit-log.html';
        } else if (action === 'remove-workbench') {
            removeFromWorkbench(orgId);
        }
    });

    document.getElementById('allOrgsTableBody')?.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.getAttribute('data-action') === 'add-workbench') {
            const orgId = target.getAttribute('data-org-id');
            if (orgId) addToWorkbench(orgId);
        }
    });

    document.getElementById('consultantLogoutBtn')?.addEventListener('click', () => {
        clearAuthSession();
        window.location.href = 'index.html';
    });

    loadWorkbench();
});
