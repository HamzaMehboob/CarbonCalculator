const API_BASE_URL = 'https://carbon-calculator-api-fe1o.onrender.com/api';

function clearAuthSession() {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('loginEmail');
    localStorage.removeItem('authToken');
    localStorage.removeItem('organizationId');
    localStorage.removeItem('organizationName');
    localStorage.removeItem('userName');
    localStorage.removeItem('isOrgAdmin');
    localStorage.removeItem('sessionExpiresAt');
    localStorage.removeItem('sessionLastActivity');
}

function ensureAdminAccess() {
    const token = localStorage.getItem('authToken');
    const isOrgAdmin = localStorage.getItem('isOrgAdmin') === 'true';
    if (!token || !isOrgAdmin) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

async function handleAddUser(e) {
    e.preventDefault();
    const errorEl = document.getElementById('addUserError');
    const successEl = document.getElementById('addUserSuccess');
    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';

    const payload = {
        full_name: (document.getElementById('newFullName')?.value || '').trim(),
        email: (document.getElementById('newEmail')?.value || '').trim(),
        username: (document.getElementById('newUsername')?.value || '').trim(),
        password: document.getElementById('newPassword')?.value || '',
        confirm_password: document.getElementById('newConfirmPassword')?.value || '',
    };

    if (!payload.username || !payload.password || !payload.confirm_password) {
        if (errorEl) errorEl.textContent = 'Username and password fields are required.';
        return;
    }

    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            if (successEl) successEl.textContent = data.msg || 'User created.';
            document.getElementById('addUserForm')?.reset();
            await loadUsers();
        } else if (response.status === 401 || response.status === 422) {
            clearAuthSession();
            window.location.href = 'index.html';
        } else {
            if (errorEl) errorEl.textContent = data.msg || 'Could not create user.';
        }
    } catch (err) {
        if (errorEl) errorEl.textContent = 'Connection error. Please try again.';
    }
}

function getUsersTableBody() {
    return document.getElementById('usersTableBody');
}

function rowHtml(user) {
    const username = user.username || '';
    const name = user.full_name || '';
    const email = user.email || '-';
    const role = user.is_org_admin ? 'Organization admin' : 'User';
    const actions = user.is_org_admin
        ? '<span style="color: var(--text-secondary);">Admin account</span>'
        : `<button class="btn-link" data-action="edit" data-username="${username}">Edit</button>
           <button class="btn-link" data-action="delete" data-username="${username}">Remove</button>`;

    return `<tr>
        <td>${username}</td>
        <td>${name}</td>
        <td>${email}</td>
        <td>${role}</td>
        <td>${actions}</td>
    </tr>`;
}

async function loadUsers() {
    const token = localStorage.getItem('authToken');
    const errEl = document.getElementById('usersError');
    if (errEl) errEl.textContent = '';
    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 422) {
            clearAuthSession();
            window.location.href = 'index.html';
            return;
        }
        if (!response.ok) {
            if (errEl) errEl.textContent = data.msg || 'Could not load users.';
            return;
        }
        const users = Array.isArray(data.users) ? data.users : [];
        const body = getUsersTableBody();
        if (!body) return;
        if (!users.length) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">No users found.</td></tr>';
            return;
        }
        body.innerHTML = users.map(rowHtml).join('');
    } catch (err) {
        if (errEl) errEl.textContent = 'Connection error loading users.';
    }
}

async function editUser(username) {
    const newFullName = prompt('Full name (leave empty to keep as-is):');
    if (newFullName === null) return;
    const newEmail = prompt('Email (leave empty to clear, keep current if unchanged):');
    if (newEmail === null) return;
    const newUsername = prompt('Username (leave empty to keep current):');
    if (newUsername === null) return;
    const newPassword = prompt('New password (leave empty to keep current):');
    if (newPassword === null) return;

    const payload = {};
    if (newFullName !== '') payload.full_name = newFullName;
    if (newEmail !== '') payload.email = newEmail;
    if (newUsername !== '') payload.username = newUsername;
    if (newPassword !== '') {
        const confirm = prompt('Confirm new password:');
        if (confirm === null) return;
        payload.password = newPassword;
        payload.confirm_password = confirm;
    }
    if (!Object.keys(payload).length) return;

    const token = localStorage.getItem('authToken');
    const errEl = document.getElementById('usersError');
    try {
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (errEl) errEl.textContent = data.msg || 'Could not update user.';
            return;
        }
        await loadUsers();
    } catch (err) {
        if (errEl) errEl.textContent = 'Connection error updating user.';
    }
}

async function deleteUser(username) {
    if (!confirm(`Remove user "${username}"?`)) return;
    const token = localStorage.getItem('authToken');
    const errEl = document.getElementById('usersError');
    try {
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (errEl) errEl.textContent = data.msg || 'Could not remove user.';
            return;
        }
        await loadUsers();
    } catch (err) {
        if (errEl) errEl.textContent = 'Connection error removing user.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!ensureAdminAccess()) return;

    const orgName = localStorage.getItem('organizationName') || 'Organization';
    const heading = document.getElementById('orgNameHeading');
    if (heading) heading.textContent = orgName;

    document.getElementById('addUserForm')?.addEventListener('submit', handleAddUser);
    document.getElementById('usersTableBody')?.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute('data-action');
        const username = target.getAttribute('data-username');
        if (!action || !username) return;
        if (action === 'edit') {
            editUser(username);
        } else if (action === 'delete') {
            deleteUser(username);
        }
    });
    document.getElementById('orgLogoutBtn')?.addEventListener('click', () => {
        clearAuthSession();
        window.location.href = 'index.html';
    });
    document.getElementById('backToSigninBtn')?.addEventListener('click', () => {
        clearAuthSession();
        window.location.href = 'index.html';
    });
    document.getElementById('openOrgDataBtn')?.addEventListener('click', () => {
        // Let org admin access the main app without being immediately redirected back.
        localStorage.setItem('orgOpenMainApp', 'true');
        window.location.href = 'index.html';
    });

    loadUsers();
});
