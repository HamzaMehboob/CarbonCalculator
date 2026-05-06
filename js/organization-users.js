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

document.addEventListener('DOMContentLoaded', () => {
    if (!ensureAdminAccess()) return;

    const orgName = localStorage.getItem('organizationName') || 'Organization';
    const heading = document.getElementById('orgNameHeading');
    if (heading) heading.textContent = orgName;

    document.getElementById('addUserForm')?.addEventListener('submit', handleAddUser);
    document.getElementById('orgLogoutBtn')?.addEventListener('click', () => {
        clearAuthSession();
        window.location.href = 'index.html';
    });
});
