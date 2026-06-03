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

function ensurePlatformAdminAccess() {
    const token = localStorage.getItem('authToken');
    const isPlatformAdmin = localStorage.getItem('isPlatformAdmin') === 'true';
    if (!token || !isPlatformAdmin) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

async function apiFetch(path, options = {}) {
    return fetch(`${getApiBaseUrl()}${path}`, options);
}

function formatDate(value) {
    if (!value) return '-';
    try {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
    } catch (_e) {
        return '-';
    }
}

function openOrganization(orgId, orgName) {
    localStorage.setItem('organizationId', orgId);
    localStorage.setItem('organizationName', orgName);
    localStorage.setItem('companyName', orgName);
    localStorage.setItem('orgOpenMainApp', 'true');
    window.location.href = 'index.html';
}

async function loadConsultants() {
    const errEl = document.getElementById('consultantsError');
    if (errEl) errEl.textContent = '';
    const token = localStorage.getItem('authToken');
    const body = document.getElementById('consultantsTableBody');
    try {
        const response = await apiFetch('/admin/consultants', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (errEl) errEl.textContent = data.msg || 'Could not load consultants.';
            return;
        }
        const rows = (data.consultants || [])
            .map((c) => {
                const uname = c.username || '';
                const count = c.workbench_count != null ? c.workbench_count : (c.memberships || []).length;
                return `<tr>
                    <td>${uname}</td>
                    <td>${c.full_name || ''}</td>
                    <td>${c.email || '-'}</td>
                    <td>${count}</td>
                    <td><button type="button" class="btn-link" data-action="remove-consultant" data-username="${uname}">Remove</button></td>
                </tr>`;
            })
            .join('');
        if (body) body.innerHTML = rows || '<tr><td colspan="5">No consultants yet.</td></tr>';
    } catch (_err) {
        if (errEl) errEl.textContent = 'Connection error loading consultants.';
    }
}

async function loadOrganizations() {
    const errEl = document.getElementById('orgsError');
    if (errEl) errEl.textContent = '';
    const token = localStorage.getItem('authToken');
    const body = document.getElementById('orgsTableBody');
    try {
        const response = await apiFetch('/admin/organizations', {
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
                return `<tr>
                    <td>${name}</td>
                    <td>${formatDate(o.created_at)}</td>
                    <td>
                        <button type="button" class="btn-link" data-action="open-org" data-org-id="${id}" data-org-name="${name.replace(/"/g, '&quot;')}">Open data</button>
                        <button type="button" class="btn-link" data-action="delete-org" data-org-id="${id}" data-org-name="${name.replace(/"/g, '&quot;')}">Remove</button>
                    </td>
                </tr>`;
            })
            .join('');
        if (body) body.innerHTML = rows || '<tr><td colspan="3">No organizations yet.</td></tr>';
    } catch (_err) {
        if (errEl) errEl.textContent = 'Connection error loading organizations.';
    }
}

async function handleAddConsultant(e) {
    e.preventDefault();
    const errorEl = document.getElementById('consultantFormError');
    const successEl = document.getElementById('consultantFormSuccess');
    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';

    const payload = {
        full_name: (document.getElementById('consultantFullName')?.value || '').trim(),
        email: (document.getElementById('consultantEmail')?.value || '').trim(),
        username: (document.getElementById('consultantUsername')?.value || '').trim(),
        password: document.getElementById('consultantPassword')?.value || '',
        confirm_password: document.getElementById('consultantConfirmPassword')?.value || '',
    };

    const token = localStorage.getItem('authToken');
    try {
        const response = await apiFetch('/admin/consultants', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            if (successEl) successEl.textContent = data.msg || 'Consultant added.';
            document.getElementById('addConsultantForm')?.reset();
            await loadConsultants();
        } else if (errorEl) {
            errorEl.textContent = data.msg || 'Could not add consultant.';
        }
    } catch (_err) {
        if (errorEl) errorEl.textContent = 'Connection error.';
    }
}

async function handleAddOrg(e) {
    e.preventDefault();
    const errorEl = document.getElementById('orgsError');
    const successEl = document.getElementById('orgsSuccess');
    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';

    const name = (document.getElementById('newOrgName')?.value || '').trim();
    const token = localStorage.getItem('authToken');
    try {
        const response = await apiFetch('/admin/organizations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            if (successEl) successEl.textContent = data.msg || 'Organization added.';
            document.getElementById('addOrgForm')?.reset();
            await loadOrganizations();
        } else if (errorEl) {
            errorEl.textContent = data.msg || 'Could not add organization.';
        }
    } catch (_err) {
        if (errorEl) errorEl.textContent = 'Connection error.';
    }
}

async function deleteOrganization(orgId, orgName) {
    const adminPassword = prompt(
        `Removing "${orgName}" deletes all its data and users.\n\nEnter your admin password to confirm:`
    );
    if (adminPassword === null) return;

    const errEl = document.getElementById('orgsError');
    const token = localStorage.getItem('authToken');
    try {
        const response = await apiFetch(`/admin/organizations/${encodeURIComponent(orgId)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ admin_password: adminPassword }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            await loadOrganizations();
        } else if (errEl) {
            errEl.textContent = data.msg || 'Could not remove organization.';
        }
    } catch (_err) {
        if (errEl) errEl.textContent = 'Connection error.';
    }
}

async function removeConsultant(username) {
    if (!confirm(`Remove consultant "${username}"?`)) return;
    const errEl = document.getElementById('consultantsError');
    const token = localStorage.getItem('authToken');
    try {
        const response = await apiFetch(`/admin/consultants/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            await loadConsultants();
        } else if (errEl) {
            errEl.textContent = data.msg || 'Could not remove consultant.';
        }
    } catch (_err) {
        if (errEl) errEl.textContent = 'Connection error.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!ensurePlatformAdminAccess()) return;

    const heading = document.getElementById('adminUserHeading');
    if (heading) {
        heading.textContent = localStorage.getItem('userName') || localStorage.getItem('loginEmail') || 'Admin';
    }

    document.getElementById('addConsultantForm')?.addEventListener('submit', handleAddConsultant);
    document.getElementById('addOrgForm')?.addEventListener('submit', handleAddOrg);

    document.getElementById('consultantsTableBody')?.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.getAttribute('data-action') === 'remove-consultant') {
            const username = target.getAttribute('data-username');
            if (username) removeConsultant(username);
        }
    });

    document.getElementById('orgsTableBody')?.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute('data-action');
        const orgId = target.getAttribute('data-org-id');
        const orgName = target.getAttribute('data-org-name') || '';
        if (!orgId) return;
        if (action === 'open-org') {
            openOrganization(orgId, orgName);
        } else if (action === 'delete-org') {
            deleteOrganization(orgId, orgName);
        }
    });

    document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
        clearAuthSession();
        window.location.href = 'index.html';
    });

    loadConsultants();
    loadOrganizations();
});
