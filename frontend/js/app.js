// ============================================
// CARBON CALCULATOR - PHASE 1
// Main Application Logic
// ============================================

// Global State
const appState = {
    currentLanguage: 'en',
    darkMode: false,
    loggedIn: false,
    currentSite: 'site-1',
    sites: {
        'site-1': {
            name: 'Headquarters',
            companyName: 'My Company',
            notes: '',
            data: {
                water: [],
                energy: [],
                waste: [],
                transport: [],
                refrigerants: []
            },
            financials: {
                bankBalance: 0,
                savingsBalance: 0,
                cashIn: 0,
                cashOut: 0,
                invoicesOwed: 0,
                billsToPay: 0
            },
            tabQuestions: {}
        }
    },
    hiddenWidgets: []
};

// ============================================
// LOGIN & SIGNUP SYSTEM (MongoDB Integration)
// ============================================

// Render / local API. Streamlit sets window.__CARBON_API_BASE__ in app_integrated.py when embedded.
const API_BASE_URL =
    (typeof window !== 'undefined' && window.__CARBON_API_BASE__) ||
    'https://carbon-calculator-api-fe1o.onrender.com/api';

const SESSION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_EXPIRES_AT_KEY = 'sessionExpiresAt';
const SESSION_LAST_ACTIVITY_KEY = 'sessionLastActivity';
let sessionMonitorStarted = false;
const TAB_QUESTION_PROMPTS = {
    water: 'Water tab: include meter source, estimated readings, and any anomalies.',
    energy: 'Energy tab: include billing period type (calendar/financial), tariff notes, and kWh data source.',
    waste: 'Waste tab: include weighing source, uplift frequency, and conversion assumptions.',
    transport: 'Transport tab: include business/staff travel assumptions and mileage evidence source.',
    refrigerants: 'Refrigerants tab: include top-up records, service sheets, and gas type evidence.'
};

function clearAuthSession() {
    appState.loggedIn = false;
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('loginEmail');
    localStorage.removeItem('authToken');
    localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
    localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    // Clear site data (old single-user key + new org-scoped keys)
    localStorage.removeItem('carbonCalcSites');
    const orgId = localStorage.getItem('organizationId') || 'default';
    localStorage.removeItem(`carbonCalcSites_${orgId}`);
    localStorage.removeItem('organizationId');
    localStorage.removeItem('organizationName');
    localStorage.removeItem('userName');
}

function touchSession() {
    if (!appState.loggedIn || !localStorage.getItem('authToken')) return;
    const now = Date.now();
    localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(now));
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(now + SESSION_TIMEOUT_MS));
}

function isSessionExpired() {
    const expiresAtRaw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
    if (!expiresAtRaw) return false;
    const expiresAt = parseInt(expiresAtRaw, 10);
    if (Number.isNaN(expiresAt)) return false;
    return Date.now() > expiresAt;
}

function forceLogoutForExpiredSession(showMessage = true) {
    clearAuthSession();
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
    if (showMessage) {
        alert('Your session has expired. Please login again.');
    }
}

function getActiveAuthToken() {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    if (isSessionExpired()) {
        forceLogoutForExpiredSession(true);
        return null;
    }
    touchSession();
    return token;
}

function startSessionMonitor() {
    if (sessionMonitorStarted) return;
    sessionMonitorStarted = true;

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => {
        document.addEventListener(evt, () => {
            if (appState.loggedIn) touchSession();
        }, { passive: true });
    });

    setInterval(() => {
        if (appState.loggedIn && isSessionExpired()) {
            forceLogoutForExpiredSession(true);
        }
    }, 60000);
}


// Toggle between Login and Signup forms
document.getElementById('showSignup')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('signupFormContainer').style.display = 'block';
    const v = document.getElementById('verifyFormContainer');
    if (v) v.style.display = 'none';
});

document.getElementById('showLogin')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('loginFormContainer').style.display = 'block';
    document.getElementById('signupFormContainer').style.display = 'none';
    const v = document.getElementById('verifyFormContainer');
    if (v) v.style.display = 'none';
});

function parseJsonResponse(raw) {
    if (!raw || !String(raw).trim()) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function loginFailureMessage(status, payload) {
    const msg =
        (payload && (payload.msg || payload.message || payload.error)) || '';
    if (msg) return String(msg);
    if (status === 401) {
        return appState.currentLanguage === 'pt'
            ? 'E-mail ou senha inválidos.'
            : 'Invalid email or password.';
    }
    if (status === 403) {
        return appState.currentLanguage === 'pt'
            ? 'Verifique seu e-mail antes de entrar.'
            : 'Please verify your email before logging in.';
    }
    return appState.currentLanguage === 'pt'
        ? 'Não foi possível entrar. Tente novamente.'
        : 'Could not sign in. Please try again.';
}

function showVerifyPanel(prefillEmail, devCode) {
    const loginFormContainer = document.getElementById('loginFormContainer');
    const signupFormContainer = document.getElementById('signupFormContainer');
    const verifyFormContainer = document.getElementById('verifyFormContainer');
    if (loginFormContainer) loginFormContainer.style.display = 'none';
    if (signupFormContainer) signupFormContainer.style.display = 'none';
    if (verifyFormContainer) verifyFormContainer.style.display = 'block';
    const ve = document.getElementById('verifyEmail');
    if (ve && prefillEmail) ve.value = prefillEmail;
    const verr = document.getElementById('verifyError');
    const vok = document.getElementById('verifySuccess');
    const vdev = document.getElementById('verifyDevHint');
    if (verr) verr.textContent = '';
    if (vok) vok.textContent = '';
    if (vdev) {
        vdev.textContent = devCode
            ? (appState.currentLanguage === 'pt' ? 'Código (dev): ' : 'Dev code: ') + devCode
            : '';
    }
}

// LOGIN FORM SUBMIT
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginError = document.getElementById('loginError');
    
    if (loginError) loginError.textContent = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const raw = await response.text();
        const data = parseJsonResponse(raw);
        
        if (response.ok) {
            if (!data.access_token) {
                if (loginError) {
                    loginError.textContent =
                        appState.currentLanguage === 'pt'
                            ? 'Resposta inválida do servidor.'
                            : 'Invalid response from server.';
                }
                return;
            }
            appState.loggedIn = true;
            localStorage.setItem('loggedIn', 'true');
            localStorage.setItem('loginEmail', email);
            localStorage.setItem('authToken', data.access_token);
            touchSession();
            startSessionMonitor();
            
            if (data.user) {
                localStorage.setItem('userName', data.user.full_name || '');
                localStorage.setItem('companyName', data.user.company_name || 'My Company');
                localStorage.setItem('organizationId', data.user.organization_id || '');
                localStorage.setItem('organizationName', data.user.organization_name || '');
            }
            
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'flex';
            
            // Load user data from MongoDB
            await loadUserDataFromBackend();
            
            initializeApp();
        } else {
            if (loginError) {
                loginError.textContent = '';
                if (response.status === 403 && data.needs_verification) {
                    const msg =
                        data.msg ||
                        (appState.currentLanguage === 'pt'
                            ? 'Verifique seu e-mail antes de entrar.'
                            : 'Please verify your email before logging in.');
                    loginError.appendChild(document.createTextNode(msg + ' '));
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent =
                        appState.currentLanguage === 'pt'
                            ? 'Abrir verificação'
                            : 'Open verification';
                    link.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        showVerifyPanel(data.email || email);
                    });
                    loginError.appendChild(link);
                } else {
                    loginError.textContent = loginFailureMessage(response.status, data);
                }
            }
        }
    } catch (err) {
        console.error('Login error:', err);
        if (loginError) {
            loginError.textContent =
                appState.currentLanguage === 'pt'
                    ? 'Erro de conexão. O servidor está disponível?'
                    : 'Connection error. Is the backend running?';
        }
    }
});

// SIGNUP FORM SUBMIT
document.getElementById('signupForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const full_name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const company_name = document.getElementById('signupCompany').value;
    const password = document.getElementById('signupPassword').value;
    const confirm_password = document.getElementById('signupConfirmPassword').value;
    const signupError = document.getElementById('signupError');
    const signupSuccess = document.getElementById('signupSuccess');
    
    signupError.textContent = '';
    signupSuccess.textContent = '';
    
    if (password !== confirm_password) {
        signupError.textContent = 'Passwords do not match';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                full_name, 
                email, 
                company_name, 
                password, 
                confirm_password 
            })
        });
        
        const raw = await response.text();
        const data = parseJsonResponse(raw);
        
        if (response.ok) {
            signupSuccess.textContent =
                data.msg ||
                (appState.currentLanguage === 'pt'
                    ? 'Conta criada. Verifique seu e-mail.'
                    : 'Account created. Check your email for the verification code.');
            setTimeout(() => {
                showVerifyPanel(email.trim(), data.dev_verification_code || '');
            }, 800);
        } else {
            const backendMsg =
                data.msg ||
                data.message ||
                data.error ||
                (raw && raw.length < 500 ? raw : '');
            signupError.textContent = backendMsg || 'Signup failed';
        }
    } catch (err) {
        console.error('Signup error:', err);
        signupError.textContent = 'Connection error. Is the backend running?';
    }
});

document.getElementById('verifyForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = (document.getElementById('verifyEmail')?.value || '').trim();
    const codeInput = document.getElementById('verifyCode');
    let code = (codeInput?.value || '').replace(/\D/g, '').slice(0, 6);
    if (codeInput) codeInput.value = code;
    const verr = document.getElementById('verifyError');
    const vok = document.getElementById('verifySuccess');
    if (verr) verr.textContent = '';
    if (vok) vok.textContent = '';

    if (!email || code.length !== 6) {
        if (verr) {
            verr.textContent =
                appState.currentLanguage === 'pt'
                    ? 'Informe o e-mail e o código de 6 dígitos.'
                    : 'Enter your email and the 6-digit code.';
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        const raw = await response.text();
        const data = parseJsonResponse(raw);
        if (response.ok) {
            if (vok) {
                vok.textContent =
                    data.msg ||
                    (appState.currentLanguage === 'pt'
                        ? 'Verificado. Você já pode entrar.'
                        : 'Verified. You can log in.');
            }
            setTimeout(() => {
                document.getElementById('verifyFormContainer').style.display = 'none';
                document.getElementById('loginFormContainer').style.display = 'block';
                document.getElementById('loginEmail').value = email;
                if (codeInput) codeInput.value = '';
            }, 1200);
        } else if (verr) {
            verr.textContent = data.msg || 'Verification failed.';
        }
    } catch (err) {
        console.error(err);
        if (verr) {
            verr.textContent =
                appState.currentLanguage === 'pt'
                    ? 'Erro de conexão.'
                    : 'Connection error.';
        }
    }
});

document.getElementById('resendVerificationBtn')?.addEventListener('click', async function() {
    const email = (document.getElementById('verifyEmail')?.value || '').trim();
    const verr = document.getElementById('verifyError');
    const vok = document.getElementById('verifySuccess');
    const vdev = document.getElementById('verifyDevHint');
    if (verr) verr.textContent = '';
    if (vok) vok.textContent = '';
    if (!email) {
        if (verr) {
            verr.textContent =
                appState.currentLanguage === 'pt'
                    ? 'Informe seu e-mail.'
                    : 'Enter your email first.';
        }
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
            if (vok) vok.textContent = data.msg || '';
            if (vdev && data.dev_verification_code) {
                vdev.textContent =
                    (appState.currentLanguage === 'pt' ? 'Código (dev): ' : 'Dev code: ') +
                    data.dev_verification_code;
            }
        } else if (response.status === 429 && verr) {
            verr.textContent = data.msg || '';
        } else if (verr) {
            verr.textContent = data.msg || 'Could not resend.';
        }
    } catch (err) {
        console.error(err);
        if (verr) {
            verr.textContent =
                appState.currentLanguage === 'pt' ? 'Erro de conexão.' : 'Connection error.';
        }
    }
});

document.getElementById('backToLoginFromVerify')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('verifyFormContainer').style.display = 'none';
    document.getElementById('loginFormContainer').style.display = 'block';
    const verr = document.getElementById('verifyError');
    const vok = document.getElementById('verifySuccess');
    if (verr) verr.textContent = '';
    if (vok) vok.textContent = '';
});

// BACKEND DATA PERSISTENCE
async function loadUserDataFromBackend() {
    const token = getActiveAuthToken();
    if (!token) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401) {
            forceLogoutForExpiredSession(true);
            return;
        }
        
        if (response.ok) {
            const data = await response.json();
            if (data.organization_id) {
                localStorage.setItem('organizationId', data.organization_id);
            }
            // ALWAYS overwrite local state with backend state to avoid "ghost" data from deleted clusters
            if (data.sites) {
                appState.sites = Object.keys(data.sites).length > 0 ? data.sites : {
                    'site-1': {
                        name: 'Headquarters',
                        companyName: localStorage.getItem('companyName') || 'My Company',
                        notes: '',
                        data: { water: [], energy: [], waste: [], transport: [], refrigerants: [] },
                        financials: { bankBalance: 0, savingsBalance: 0, cashIn: 0, cashOut: 0, invoicesOwed: 0, billsToPay: 0 },
                        tabQuestions: {}
                    }
                };
                saveSitesToLocalStorage(); // Sync with local cache
                rebuildSitesUIFromState();
            }
        }
    } catch (err) {
        console.error('Error loading data from backend:', err);
    }

    try {
        // Also load custom factors
        const factorsRes = await fetch(`${API_BASE_URL}/factors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (factorsRes.status === 401) {
            forceLogoutForExpiredSession(true);
            return;
        }
        if (factorsRes.ok) {
            const factorsData = await factorsRes.json();
            if (Array.isArray(factorsData) && factorsData.length > 0) {
                // Reconstruct dictionary
                const db = {};
                factorsData.forEach(item => {
                    db[item.country_key] = item;
                });
                if (window.carbonCalc && window.carbonCalc.setConversionFactors) {
                    window.carbonCalc.setConversionFactors(db);
                }
            }
        }
    } catch (err) {
        console.error('Error loading factors from backend:', err);
    }
}

async function saveUserDataToBackend() {
    if (!appState.loggedIn) return;
    
    const token = getActiveAuthToken();
    if (!token) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/data`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sites: appState.sites })
        });
        if (response.status === 401) {
            forceLogoutForExpiredSession(true);
        }
    } catch (err) {
        console.error('Error saving data to backend:', err);
    }
}

// LOGOUT
document.getElementById('logoutBtn')?.addEventListener('click', async function() {
    if (!confirm(appState.currentLanguage === 'en' ? 'Are you sure you want to logout?' : 'Tem certeza que deseja sair?')) {
        return;
    }
    try {
        if (appState.loggedIn) {
            await saveUserDataToBackend();
        }
    } catch (err) {
        console.error('Final sync before logout failed:', err);
    }
    clearAuthSession();

    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';

    document.getElementById('loginPassword').value = '';
    if (document.getElementById('signupPassword')) document.getElementById('signupPassword').value = '';
    if (document.getElementById('signupConfirmPassword')) document.getElementById('signupConfirmPassword').value = '';
});

// ============================================
// TABS NAVIGATION
// ============================================

function setActiveTab(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Update active states
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    const targetContent = document.querySelector(`[data-content="${tabName}"]`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // Update dashboard when switching to it
    if (tabName === 'dashboard') {
        if (window.updateDashboard) {
            updateDashboard();
        }
    } else if (tabName === 'accounts') {
        // Update accounts dashboard
        if (window.updateAccountsCharts) {
            updateAccountsCharts();
        }
        // Sync financial displays
        if (appState.currentSite && appState.sites[appState.currentSite] && appState.sites[appState.currentSite].financials) {
            Object.keys(appState.sites[appState.currentSite].financials).forEach(key => {
                const value = appState.sites[appState.currentSite].financials[key] || 0;
                updateFinancialDisplay(key, value);
            });
            if (window.updateBankReconciliationChart) {
                setTimeout(updateBankReconciliationChart, 100);
            }
            if (window.updateCashFlowChart) {
                setTimeout(updateCashFlowChart, 100);
            }
            if (window.updateAccountSummaryChart) {
                setTimeout(updateAccountSummaryChart, 100);
            }
        }
        // Populate bills and invoices lists when opening Accounts tab
        if (window.renderBillsTable) {
            window.renderBillsTable();
        }
        if (window.renderInvoicesTable) {
            window.renderInvoicesTable();
        }
    } else if (['water', 'energy', 'waste', 'transport', 'refrigerants'].includes(tabName)) {
        updateTabQuestionUI(tabName);
    }
}

function setActiveSubNav(subName) {
    const subNavBtns = document.querySelectorAll('.sub-nav-btn');
    const subContentSections = document.querySelectorAll('.sub-content-section');

    // Remove active class from all buttons and sections
    subNavBtns.forEach(b => b.classList.remove('active'));
    subContentSections.forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active');
    });

    // Add active class to target button
    const targetBtn = document.querySelector(`.sub-nav-btn[data-sub="${subName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    // Show target section
    const targetSection = document.getElementById(`section-${subName}`);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
        
        // Ensure Tabs Content is visible if Data Input is selected
        const tabsContent = document.getElementById('tabsContent');
        if (subName === 'data-input') {
            tabsContent.style.display = 'block';
            const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab') || 'water';
            updateTabQuestionUI(activeTab);
        } else {
            tabsContent.style.display = 'none';
        }
        if (subName === 'input-emissions') {
            updateInputEmissionsPreview();
        }
    }
}

function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            setActiveTab(tabName);
        });
    });

    // Initialize Sub Nav Buttons
    document.body.addEventListener('click', function(e) {
        const subNavBtn = e.target.closest('.sub-nav-btn');
        if (subNavBtn) {
            const subName = subNavBtn.getAttribute('data-sub');
            setActiveSubNav(subName);
        }
    });
}

// Expose tab switcher so sidebar circular buttons can use it
window.setActiveTab = setActiveTab;
window.setActiveSubNav = setActiveSubNav;

// ============================================
// SITE MANAGEMENT
// ============================================

document.getElementById('addSiteBtn')?.addEventListener('click', function() {
    const siteName = prompt(
        appState.currentLanguage === 'en' 
            ? 'Enter building/event name:' 
            : 'Digite o nome do edifício/evento:'
    );
    
    if (siteName && siteName.trim()) {
        const siteId = `site-${Date.now()}`;
        appState.sites[siteId] = {
            name: siteName.trim(),
            companyName: localStorage.getItem('companyName') || 'My Company',
            notes: localStorage.getItem('companyNotes') || '',
            data: {
                water: [],
                energy: [],
                waste: [],
                transport: [],
                refrigerants: []
            },
            financials: {
                bankBalance: 0,
                savingsBalance: 0,
                cashIn: 0,
                cashOut: 0,
                invoicesOwed: 0,
                billsToPay: 0
            },
            invoices: [],
            bills: [],
            cashTransactions: {
                cashIn: [],
                cashOut: []
            },
            monthlyCashFlow: {},
            tabQuestions: {}
        };
        
        addSiteToList(siteId, siteName.trim());
        switchSite(siteId);
        saveSitesToLocalStorage();
        saveUserDataToBackend();
    }
});

function addSiteToList(siteId, siteName) {
    const sitesList = document.getElementById('sitesList');
    const siteItem = document.createElement('li');
    siteItem.className = 'site-item';
    siteItem.setAttribute('data-site-id', siteId);
    siteItem.innerHTML = `
        <div class="site-main-item">
            <i class="fas fa-building"></i>
            <input type="text" class="site-name-input" value="${siteName}" placeholder="Site name">
            <button class="btn-delete"><i class="fas fa-times"></i></button>
        </div>
        <!-- Site Sub-navigation -->
        <div class="site-sub-nav">
            <button class="sub-nav-btn active" data-sub="data-input">
                <i class="fas fa-keyboard"></i> <span data-en="Data Input" data-pt="Entrada de Dados">Data Input</span>
            </button>
            <button class="sub-nav-btn" data-sub="general-info">
                <i class="fas fa-info-circle"></i> <span data-en="General Info" data-pt="Informações Gerais">General Info</span>
            </button>
            <button class="sub-nav-btn" data-sub="assessment-scope">
                <i class="fas fa-crosshairs"></i> <span data-en="Assessment Scope" data-pt="Escopo da Avaliação">Assessment Scope</span>
            </button>
            <button class="sub-nav-btn" data-sub="conversion-factors">
                <i class="fas fa-database"></i> <span data-en="Conversion Factor" data-pt="Fator de Conversão">Conversion Factor</span>
            </button>
            <button class="sub-nav-btn" data-sub="input-emissions">
                <i class="fas fa-cloud"></i> <span data-en="Input Emissions" data-pt="Emissões de Entrada">Input Emissions</span>
            </button>
        </div>
    `;
    
    // Handle site name editing
    const nameInput = siteItem.querySelector('.site-name-input');
    nameInput.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    nameInput.addEventListener('blur', function() {
        const newName = this.value.trim() || 'Unnamed Site';
        this.value = newName;
        if (appState.sites[siteId]) {
            appState.sites[siteId].name = newName;
            saveSitesToLocalStorage();
        }
    });
    nameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            this.blur();
        }
    });
    
    siteItem.addEventListener('click', function(e) {
        if (!e.target.closest('.btn-delete') && !e.target.closest('.site-name-input')) {
            switchSite(siteId);
        }
    });
    
    siteItem.querySelector('.btn-delete').addEventListener('click', function(e) {
        e.stopPropagation();
        deleteSite(siteId, siteItem);
    });
    
    sitesList.appendChild(siteItem);
}

function switchSite(siteId) {
    // Save current site data before switching
    if (appState.currentSite) {
        saveCurrentSiteData();
    }
    
    appState.currentSite = siteId;
    
    document.querySelectorAll('.site-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const siteElement = document.querySelector(`[data-site-id="${siteId}"]`);
    if (siteElement) {
        siteElement.classList.add('active');
    }
    
    // Load new site data (this includes notes, company name, and all tables)
    loadSiteData(siteId);
    
    // Recalculate totals
    setTimeout(() => {
        calculateAllTotals();
    }, 200);
}

function deleteSite(siteId, element) {
    if (Object.keys(appState.sites).length <= 1) {
        alert(appState.currentLanguage === 'en' 
            ? 'Cannot delete the last site!' 
            : 'Não é possível excluir o último local!');
        return;
    }
    
    if (confirm(appState.currentLanguage === 'en' 
        ? 'Delete this site?' 
        : 'Excluir este local?')) {
        delete appState.sites[siteId];
        element.remove();
        saveSitesToLocalStorage();
        saveUserDataToBackend();

        if (appState.currentSite === siteId) {
            const firstSiteId = Object.keys(appState.sites)[0];
            switchSite(firstSiteId);
        }
    }
}

// ============================================
// RESET ACCOUNTS DATA (CURRENT SITE)
// ============================================

function resetAccountsData() {
    const siteId = appState.currentSite;
    const site = appState.sites[siteId];

    if (!site) return;

    if (!confirm(appState.currentLanguage === 'en'
        ? 'Reset all account data (bank, savings, cash, invoices, bills)?'
        : 'Redefinir todos os dados de contas (banco, poupança, caixa, faturas, contas)?')) {
        return;
    }

    // Reset financial-related data
    site.financials = {
        bankBalance: 0,
        savingsBalance: 0,
        cashIn: 0,
        cashOut: 0,
        invoicesOwed: 0,
        billsToPay: 0
    };
    site.invoices = [];
    site.bills = [];
    site.cashTransactions = {
        cashIn: [],
        cashOut: []
    };
    site.monthlyCashFlow = {};

    saveSitesToLocalStorage();
    if (window.saveCurrentSiteData) {
        window.saveCurrentSiteData();
    }

    // Update all financial KPI displays to 0 for this site
    if (typeof updateFinancialDisplay === 'function') {
        Object.keys(site.financials).forEach(key => {
            updateFinancialDisplay(key, site.financials[key] || 0);
        });
    }

    // Refresh all account-related visuals if functions are available
    if (window.updateBankReconciliationChart) window.updateBankReconciliationChart();
    if (window.updateCashFlowChart) window.updateCashFlowChart();
    if (window.updateAccountSummaryChart) window.updateAccountSummaryChart();
    if (window.updateMonthlyCashFlowChart) window.updateMonthlyCashFlowChart();
    if (window.updateInvoicesChart) window.updateInvoicesChart();
    if (window.updateInvoicesOwedWidget) window.updateInvoicesOwedWidget();
    if (window.updateBillsChart) window.updateBillsChart();
    if (window.updateBillsSummary) window.updateBillsSummary();
    if (window.updateBillsToPayWidget) window.updateBillsToPayWidget();
    if (window.renderBillsTable) window.renderBillsTable();
    if (window.renderInvoicesTable) window.renderInvoicesTable();
}

// ============================================
// DATA TABLE MANAGEMENT
// ============================================

function addDataRow(category) {
    const table = document.getElementById(`${category}Table`);
    const tbody = table.querySelector('tbody');
    
    const row = document.createElement('tr');
    row.className = 'data-row';
    
    let unit = 'm³';
    if (category === 'energy') unit = 'kWh';
    else if (category === 'waste') unit = 'tonnes';
    else if (category === 'transport') unit = 'km';
    else if (category === 'refrigerants') unit = 'kg';
    
    // Build emission type selector based on category
    const emissionSelectHtml = getEmissionSelectHtml(category);

    row.innerHTML = `
        <td>${emissionSelectHtml}</td>
        <td><input type="text" placeholder="Description"></td>
        <td><input type="number" value="2025" min="2020" max="2030"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="0"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="1"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="2"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="3"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="4"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="5"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="6"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="7"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="8"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="9"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="10"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="11"></td>
        <td class="total-cell">0.00</td>
        <td class="co2-cell">0.000</td>
        <td><button class="btn-delete" onclick="deleteRow(this)"><i class="fas fa-trash"></i></button></td>
    `;
    
    tbody.appendChild(row);
    attachRowListeners(row);
}

// Build emission type dropdown HTML per category
function getEmissionSelectHtml(category, selectedKey) {
    const optionsByCategory = {
        water: [
            { key: 'water', labelEn: 'Water supply', labelPt: 'Abastecimento de água' },
            { key: 'wastewater', labelEn: 'Waste water', labelPt: 'Água residual' }
        ],
        energy: [
            { key: 'electricity', labelEn: 'Electricity (grid)', labelPt: 'Eletricidade (rede)' },
            { key: 'naturalGas', labelEn: 'Natural gas', labelPt: 'Gás natural' },
            { key: 'diesel', labelEn: 'Diesel (generator/boiler)', labelPt: 'Diesel (gerador/caldeira)' }
        ],
        waste: [
            { key: 'waste', labelEn: 'Mixed waste to landfill', labelPt: 'Resíduo misto para aterro' },
            { key: 'wasteRecycled', labelEn: 'Recycled waste', labelPt: 'Resíduo reciclado' }
        ],
        transport: [
            { key: 'transport_petrol', labelEn: 'Company vehicles - petrol', labelPt: 'Veículos - gasolina' },
            { key: 'transport_diesel', labelEn: 'Company vehicles - diesel', labelPt: 'Veículos - diesel' },
            { key: 'transport_electric', labelEn: 'Company vehicles - electric', labelPt: 'Veículos - elétrico' },
            { key: 'flights_short', labelEn: 'Flights - short-haul', labelPt: 'Voos - curta distância' },
            { key: 'flights_medium', labelEn: 'Flights - medium-haul', labelPt: 'Voos - média distância' },
            { key: 'flights_long', labelEn: 'Flights - long-haul', labelPt: 'Voos - longa distância' }
        ],
        refrigerants: [
            { key: 'refrigerant_R410A', labelEn: 'R-410A', labelPt: 'R-410A' },
            { key: 'refrigerant_R134a', labelEn: 'R-134a', labelPt: 'R-134a' },
            { key: 'refrigerant_R32', labelEn: 'R-32', labelPt: 'R-32' }
        ]
    };

    const options = optionsByCategory[category] || [];
    const defaultSelected = selectedKey || (options[0] ? options[0].key : '');

    let html = `<select class="emission-select" data-category="${category}">`;
    options.forEach(opt => {
        const selectedAttr = opt.key === defaultSelected ? 'selected' : '';
        html += `<option value="${opt.key}" ${selectedAttr} data-en="${opt.labelEn}" data-pt="${opt.labelPt}">${opt.labelEn}</option>`;
    });
    html += '</select>';
    return html;
}

function deleteRow(button) {
    if (confirm(appState.currentLanguage === 'en' 
        ? 'Delete this row?' 
        : 'Excluir esta linha?')) {
        button.closest('tr').remove();
        calculateAllTotals();
    }
}

function attachRowListeners(row) {
    const monthInputs = row.querySelectorAll('.month-input');
    const descriptionInput = row.querySelector('input[type="text"]');
    const yearInput = row.querySelector('input[type="number"]');
    const emissionSelect = row.querySelector('.emission-select');
    
    // Save on any input change
    const saveData = () => {
        calculateRowTotal(row);
        calculateCategoryTotal(row.closest('table'));
        saveCurrentSiteData(); // Save immediately on change
    };
    
    monthInputs.forEach(input => {
        const handleMonthChange = () => {
            saveData();
            // Keep dashboard in sync when any month value is updated
            if (window.updateDashboard) {
                setTimeout(window.updateDashboard, 200);
            }
        };
        input.addEventListener('input', handleMonthChange);
        input.addEventListener('blur', handleMonthChange); // Also save when leaving field
    });
    
    if (descriptionInput) {
        descriptionInput.addEventListener('input', saveData);
        descriptionInput.addEventListener('blur', saveData);
    }

    if (emissionSelect) {
        emissionSelect.addEventListener('change', () => {
            saveData();
        });
    }
    
    if (yearInput) {
        yearInput.addEventListener('change', function() {
            saveData();
            // Force dashboard update when year changes
            if (window.updateDashboard) {
                setTimeout(window.updateDashboard, 200);
            }
        });
        yearInput.addEventListener('blur', function() {
            saveData();
            // Force dashboard update when year changes
            if (window.updateDashboard) {
                setTimeout(window.updateDashboard, 200);
            }
        });
    }
}

// ============================================
// LOCAL STORAGE
// ============================================

function saveSitesToLocalStorage() {
    const orgId = localStorage.getItem('organizationId') || 'default';
    localStorage.setItem(`carbonCalcSites_${orgId}`, JSON.stringify(appState.sites));
}

/** Rebuild sidebar sites list from `appState.sites` (e.g. after Mongo load). */
function rebuildSitesUIFromState() {
    const sitesList = document.getElementById('sitesList');
    if (!sitesList || !appState.sites) return;

    const previousCurrent = appState.currentSite;
    sitesList.innerHTML = '';

    Object.keys(appState.sites).forEach(siteId => {
        const site = appState.sites[siteId];
        if (!site) return;
        addSiteToList(siteId, site.name || 'Site');
    });

    const keys = Object.keys(appState.sites);
    if (keys.length === 0) return;

    const next = previousCurrent && appState.sites[previousCurrent]
        ? previousCurrent
        : keys[0];
    appState.currentSite = next;

    document.querySelectorAll('.site-item').forEach(item => {
        const id = item.getAttribute('data-site-id');
        item.classList.toggle('active', id === next);
    });

    loadSiteData(next);
    if (typeof calculateAllTotals === 'function') {
        setTimeout(() => calculateAllTotals(), 100);
    }
}

function loadSitesFromLocalStorage() {
    const orgId = localStorage.getItem('organizationId') || 'default';
    const saved = localStorage.getItem(`carbonCalcSites_${orgId}`) || localStorage.getItem('carbonCalcSites');
    if (saved) {
        try {
            appState.sites = JSON.parse(saved);
        } catch (e) {
            console.error('loadSitesFromLocalStorage:', e);
        }
    }
    rebuildSitesUIFromState();
}

function loadSiteData(siteId) {
    const site = appState.sites[siteId];
    if (!site) return;
    
    // Load site-specific company name if exists, otherwise use global
    const siteCompanyName = site.companyName || localStorage.getItem('companyName') || 'My Company';
    document.getElementById('companyNameInput').value = siteCompanyName;
    document.getElementById('companyName').textContent = siteCompanyName;
    localStorage.setItem('companyName', siteCompanyName);
    
    // Load site-specific notes if exists, otherwise use global
    const siteNotes = site.notes !== undefined ? site.notes : (localStorage.getItem('companyNotes') || '');
    document.getElementById('companyNotes').value = siteNotes;
    
    // Clear all tables
    ['water', 'energy', 'waste', 'transport', 'refrigerants'].forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = '';
            
            // Load saved rows or add one default row
            const savedRows = site.data[category] || [];
            if (savedRows.length === 0) {
                addDataRow(category);
            } else {
                savedRows.forEach(rowData => {
                    addDataRow(category);
                    const row = tbody.lastElementChild;
                    loadRowData(row, rowData);
                });
            }
        }
    });
    
    // Load financial data
    if (site.financials) {
        Object.keys(site.financials).forEach(key => {
            const value = site.financials[key] || 0;
            updateFinancialDisplay(key, value);
        });
    }

    // Ensure per-tab question notes are available and synced to the active category.
    if (!site.tabQuestions || typeof site.tabQuestions !== 'object') {
        site.tabQuestions = {};
    }
    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab') || 'water';
    updateTabQuestionUI(activeTab);
    
    // Recalculate totals after loading
    setTimeout(() => {
        calculateAllTotals();
    }, 100);
    
    // Update dashboard if it's active
    setTimeout(() => {
        if (document.querySelector('[data-content="dashboard"]')?.classList.contains('active')) {
            updateDashboard();
        }
        if (document.getElementById('section-input-emissions')?.classList.contains('active')) {
            updateInputEmissionsPreview();
        }
    }, 200);
}

function loadRowData(row, data) {
    const inputs = row.querySelectorAll('input');
    const emissionSelect = row.querySelector('.emission-select');

    // Inputs: [description, year, months...]
    if (inputs[0]) inputs[0].value = data.description || '';
    if (inputs[1]) inputs[1].value = data.year || 2025;

    if (emissionSelect && data.emissionType) {
        emissionSelect.value = data.emissionType;
    }
    
    data.months.forEach((value, index) => {
        const monthInput = row.querySelector(`.month-input[data-month="${index}"]`);
        if (monthInput) monthInput.value = value || '';
    });
    
    calculateRowTotal(row);
}

function saveCurrentSiteData() {
    if (!appState.currentSite) return;
    
    const site = appState.sites[appState.currentSite];
    if (!site) return;
    
    // Save company notes to current site
    const notesInput = document.getElementById('companyNotes');
    if (notesInput) {
        site.notes = notesInput.value || '';
    }
    
    // Save company name to current site
    const nameInput = document.getElementById('companyNameInput');
    if (nameInput) {
        site.companyName = nameInput.value || '';
    }
    
    // Save data for each category
    ['water', 'energy', 'waste', 'transport', 'refrigerants'].forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const rows = table.querySelectorAll('.data-row');
            site.data[category] = [];
            
            rows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                const monthInputs = row.querySelectorAll('.month-input');
                const emissionSelect = row.querySelector('.emission-select');
                
                const rowData = {
                    description: inputs[0]?.value || '',
                    year: parseInt(inputs[1]?.value) || 2025,
                    months: [],
                    emissionType: emissionSelect ? emissionSelect.value : null
                };
                
                monthInputs.forEach(input => {
                    rowData.months.push(parseFloat(input.value) || 0);
                });
                
                site.data[category].push(rowData);
            });
        }
    });

    // Save per-tab additional question notes.
    if (!site.tabQuestions || typeof site.tabQuestions !== 'object') {
        site.tabQuestions = {};
    }
    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    const tabNotesInput = document.getElementById('tabQuestionNotesInput');
    if (activeTab && tabNotesInput) {
        site.tabQuestions[activeTab] = tabNotesInput.value || '';
    }
    
    // Save financial data (already saved by updateFinancialWidget, but ensure consistency)
    if (site.financials) {
        ['bankBalance', 'savingsBalance', 'cashIn', 'cashOut', 'invoicesOwed', 'billsToPay'].forEach(widgetId => {
            const element = document.getElementById(widgetId);
            if (element && element.textContent) {
                // Extract numeric value from text like "$50,000.00"
                const text = element.textContent.replace(/[$,]/g, '');
                const value = parseFloat(text) || 0;
                if (!isNaN(value)) {
                    site.financials[widgetId] = value;
                }
            }
        });
    }
    
    saveSitesToLocalStorage();
}

function updateTabQuestionUI(category) {
    const site = appState.sites[appState.currentSite];
    if (!site) return;
    if (!site.tabQuestions || typeof site.tabQuestions !== 'object') {
        site.tabQuestions = {};
    }
    const promptEl = document.getElementById('tabQuestionPromptText');
    const notesEl = document.getElementById('tabQuestionNotesInput');
    if (promptEl) {
        promptEl.textContent = TAB_QUESTION_PROMPTS[category] || 'Add supporting notes and answers for this tab.';
    }
    if (notesEl) {
        notesEl.value = site.tabQuestions[category] || '';
    }
}

function updateInputEmissionsPreview() {
    const body = document.getElementById('inputEmissionsPreviewBody');
    if (!body || !window.carbonCalc || !window.carbonCalc.getConversionFactors || !window.carbonCalc.getCountry) return;

    const factorsDb = window.carbonCalc.getConversionFactors();
    const countryKey = window.carbonCalc.getCountry();
    const factors = factorsDb[countryKey] || {};
    const categories = ['water', 'energy', 'waste', 'transport', 'refrigerants'];
    const categoryLabel = {
        water: 'Water',
        energy: 'Energy',
        waste: 'Waste',
        transport: 'Transport',
        refrigerants: 'Refrigerants'
    };

    const lines = [];
    categories.forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        table.querySelectorAll('.data-row').forEach((row) => {
            const emissionSelect = row.querySelector('.emission-select');
            const emissionType = emissionSelect?.selectedOptions?.[0]?.textContent?.trim() || emissionSelect?.value || '';
            const emissionKey = emissionSelect?.value || '';
            const desc = row.querySelector('input[type="text"]')?.value?.trim() || emissionType;
            const year = row.querySelector('input[type="number"]:not(.month-input)')?.value || '';
            const monthInputs = Array.from(row.querySelectorAll('.month-input'));
            const inputTotal = monthInputs.reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
            const factor = factors[emissionKey] || 0;
            const kg = inputTotal * factor;
            lines.push({
                category: categoryLabel[category] || category,
                emissionType,
                desc,
                year,
                inputTotal,
                factor,
                kg
            });
        });
    });

    if (lines.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-secondary);">No emissions rows yet.</td></tr>';
        return;
    }

    body.innerHTML = lines.map((line) => `
        <tr>
            <td>${line.category}</td>
            <td>${line.emissionType}</td>
            <td>${line.desc}</td>
            <td>${line.year}</td>
            <td>${line.inputTotal.toFixed(2)}</td>
            <td>${line.factor.toFixed(6).replace(/\.?0+$/, '')}</td>
            <td>${line.kg.toFixed(2)}</td>
        </tr>
    `).join('');
}

// Open cash transaction modal
function openCashTransactionModal(type) {
    const modal = document.getElementById('cashTransactionModal');
    if (!modal) return;
    
    modal.dataset.transactionType = type;
    document.getElementById('cashTransactionAmount').value = '';
    document.getElementById('cashTransactionDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('cashTransactionDescription').value = '';
    
    const title = modal.querySelector('.modal-header h3');
    if (title) {
        title.textContent = type === 'cashIn' 
            ? (appState.currentLanguage === 'en' ? 'Add Cash In' : 'Adicionar Entrada')
            : (appState.currentLanguage === 'en' ? 'Add Cash Out' : 'Adicionar Saída');
    }
    
    modal.style.display = 'flex';
    updateLanguage();
}

// Close cash transaction modal
function closeCashTransactionModal() {
    const modal = document.getElementById('cashTransactionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Save cash transaction - accumulates the amount with date
function saveCashTransaction() {
    const modal = document.getElementById('cashTransactionModal');
    const type = modal.dataset.transactionType;
    
    const amount = parseFloat(document.getElementById('cashTransactionAmount').value);
    const date = document.getElementById('cashTransactionDate').value;
    const description = document.getElementById('cashTransactionDescription').value.trim();
    
    if (!amount || amount <= 0) {
        alert(appState.currentLanguage === 'en' ? 'Please enter a valid amount' : 'Por favor, insira um valor válido');
        return;
    }
    
    if (!date) {
        alert(appState.currentLanguage === 'en' ? 'Please select a date' : 'Por favor, selecione uma data');
        return;
    }
    
    const site = appState.sites[appState.currentSite];
    if (!site) {
        console.error('No current site available');
        return;
    }
    
    if (!site.financials) {
        site.financials = {
            bankBalance: 0,
            savingsBalance: 0,
            cashIn: 0,
            cashOut: 0,
            invoicesOwed: 0,
            billsToPay: 0
        };
    }
    
    // Initialize cash transactions array if not exists
    if (!site.cashTransactions) {
        site.cashTransactions = {
            cashIn: [],
            cashOut: []
        };
    }
    
    const transactionType = type === 'cashIn' ? 'cashIn' : 'cashOut';
    const currentTotal = site.financials[transactionType] || 0;
    
    // Add transaction record with date
    const newTransaction = {
        id: `trans-${Date.now()}-${Math.random()}`,
        amount: amount,
        date: date,
        description: description || '',
        timestamp: new Date(date).getTime()
    };
    site.cashTransactions[transactionType].push(newTransaction);
    
    // Sort transactions by date
    site.cashTransactions[transactionType].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Update total by adding the transaction amount
    site.financials[transactionType] = currentTotal + amount;
    
    // Update bank account based on transaction type
    if (!site.financials.bankBalance) site.financials.bankBalance = 0;
    if (type === 'cashIn') {
        site.financials.bankBalance += amount; // Add to bank
    } else {
        site.financials.bankBalance -= amount; // Subtract from bank
    }
    
    // Update displays
    updateFinancialDisplay(transactionType, site.financials[transactionType]);
    updateFinancialDisplay('bankBalance', site.financials.bankBalance);
    
    // Save immediately
    saveSitesToLocalStorage();
    saveCurrentSiteData();
    
    // Close modal
    closeCashTransactionModal();
    
    // Update charts (bank recon, monthly cash flow, cash flow donut, account summary)
    setTimeout(() => {
        if (typeof updateBankReconciliationChart === 'function') {
            updateBankReconciliationChart();
        }
        if (typeof updateMonthlyCashFlowChart === 'function') {
            updateMonthlyCashFlowChart();
        }
        if (typeof updateCashFlowChart === 'function') {
            updateCashFlowChart();
        }
        if (typeof updateAccountSummaryChart === 'function') {
            updateAccountSummaryChart();
        }
    }, 100);
}

// Legacy function for compatibility
function addCashTransaction(widgetId, value) {
    // Redirect to new modal-based approach
    openCashTransactionModal(widgetId);
}

// Financial widget functions - For widgets other than cash in/out
function updateFinancialWidget(widgetId, value) {
    const site = appState.sites[appState.currentSite];
    if (!site) {
        console.error('No current site available');
        return;
    }
    
    if (!site.financials) {
        site.financials = {
            bankBalance: 0,
            savingsBalance: 0,
            cashIn: 0,
            cashOut: 0,
            invoicesOwed: 0,
            billsToPay: 0
        };
    }
    
    // If the input was cleared to empty string, ignore the subsequent blur event
    if (value === '' || value === null) return;
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    // Don't allow direct updates to invoicesOwed and billsToPay (they come from charts)
    if (widgetId === 'invoicesOwed' || widgetId === 'billsToPay') {
        return; // These are read-only, updated from their respective charts
    }
    
    // For other widgets, just update the value
    site.financials[widgetId] = numValue;
    
    // Update the display element
    updateFinancialDisplay(widgetId, numValue);
    
    // Save immediately
    saveSitesToLocalStorage();
    
    // Also save current site data
    saveCurrentSiteData();
    
    // Show confirmation (optional)
    const input = document.querySelector(`input[onchange*="${widgetId}"]`);
    if (input) {
        input.style.borderColor = '#28A745';
        setTimeout(() => {
            input.style.borderColor = '';
        }, 500);
    }
    
    // Update bank reconciliation chart if exists
    if (window.updateBankReconciliationChart && (widgetId === 'cashIn' || widgetId === 'cashOut' || widgetId === 'bankBalance')) {
        setTimeout(() => {
            if (typeof updateBankReconciliationChart === 'function') {
                updateBankReconciliationChart();
            }
            if (typeof updateMonthlyCashFlowChart === 'function') {
                updateMonthlyCashFlowChart();
            }
        }, 100);
    }
    
    // Clear and reset the input field smoothly if it was triggered by a manual entry
    const matchingInput = document.querySelector(`.kpi-edit[onchange*="${widgetId}"]`);
    if (matchingInput) {
        setTimeout(() => {
            if (document.activeElement !== matchingInput) {
                matchingInput.value = '';
            }
        }, 150);
    }
}

// Helper function to update financial display
function updateFinancialDisplay(widgetId, value) {
    // Update main display element
    const element = document.getElementById(widgetId);
    if (element) {
        element.textContent = `$${value.toFixed(2)}`;
    }
    
    // Update accounts dashboard display if exists
    const accountsElement = document.getElementById(widgetId + 'Accounts');
    if (accountsElement) {
        accountsElement.textContent = `$${value.toFixed(2)}`;
    }
    
    // Also update the input field value if it exists (only if not focused)
    document.querySelectorAll(`.kpi-edit[onchange*="${widgetId}"]`).forEach(input => {
        if (document.activeElement !== input) {
            input.value = '';
        }
    });
}

function toggleWidget(button) {
    const widget = button.closest('.widget-card');
    const widgetId = widget.getAttribute('data-widget');
    
    if (appState.hiddenWidgets.includes(widgetId)) {
        appState.hiddenWidgets = appState.hiddenWidgets.filter(id => id !== widgetId);
        widget.classList.remove('hidden');
    } else {
        appState.hiddenWidgets.push(widgetId);
        widget.classList.add('hidden');
    }
    
    localStorage.setItem('hiddenWidgets', JSON.stringify(appState.hiddenWidgets));
}

function toggleDashboardWidgets() {
    // Create modal for widget selection
    const modal = document.createElement('div');
    modal.className = 'widget-modal';
    modal.innerHTML = `
        <div class="widget-modal-content">
            <div class="widget-modal-header">
                <h3 data-en="Customize Dashboard" data-pt="Personalizar Painel">Customize Dashboard</h3>
                <button class="widget-modal-close" onclick="this.closest('.widget-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="widget-modal-body">
                <p data-en="Select widgets to show on dashboard:" data-pt="Selecione widgets para mostrar no painel:">Select widgets to show on dashboard:</p>
                <div class="widget-checkboxes" id="widgetCheckboxes"></div>
            </div>
            <div class="widget-modal-footer">
                <button class="btn-primary" onclick="applyWidgetSelection()">
                    <span data-en="Apply" data-pt="Aplicar">Apply</span>
                </button>
                <button class="btn-secondary" onclick="this.closest('.widget-modal').remove()">
                    <span data-en="Cancel" data-pt="Cancelar">Cancel</span>
                </button>
            </div>
        </div>
    `;
    
    // Get all widgets
    const allWidgets = [
        { id: 'emissions', name: { en: 'Total Emissions', pt: 'Emissões Totais' } },
        { id: 'thisyear', name: { en: 'This Year (2025)', pt: 'Este Ano (2025)' } },
        { id: 'lastyear', name: { en: 'Last Year (2024)', pt: 'Ano Passado (2024)' } },
        { id: 'average', name: { en: 'Average/Month', pt: 'Média/Mês' } },
        { id: 'bank-account', name: { en: 'Business Bank Account', pt: 'Conta Bancária' } },
        { id: 'savings', name: { en: 'Business Savings', pt: 'Poupança' } },
        { id: 'cashin', name: { en: 'Total Cash In', pt: 'Total de Entrada' } },
        { id: 'cashout', name: { en: 'Total Cash Out', pt: 'Total de Saída' } },
        { id: 'invoices', name: { en: 'Invoices Owed to You', pt: 'Faturas a Receber' } },
        { id: 'bills', name: { en: 'Bills to Pay', pt: 'Contas a Pagar' } },
        { id: 'pie-chart', name: { en: 'Emissions by Category (Pie Chart)', pt: 'Emissões por Categoria (Gráfico de Pizza)' } },
        { id: 'bar-chart', name: { en: 'Year Comparison (Bar Chart)', pt: 'Comparação Anual (Gráfico de Barras)' } },
        { id: 'line-chart', name: { en: 'Monthly Trend (Line Chart)', pt: 'Tendência Mensal (Gráfico de Linha)' } },
        { id: 'watchlist', name: { en: 'Account Watchlist', pt: 'Contas Monitoradas' } }
    ];
    
    const checkboxesDiv = modal.querySelector('#widgetCheckboxes');
    allWidgets.forEach(widget => {
        const isHidden = appState.hiddenWidgets.includes(widget.id);
        const checkbox = document.createElement('div');
        checkbox.className = 'widget-checkbox-item';
        checkbox.innerHTML = `
            <label>
                <input type="checkbox" ${!isHidden ? 'checked' : ''} data-widget-id="${widget.id}">
                <span>${widget.name[appState.currentLanguage] || widget.name.en}</span>
            </label>
        `;
        checkboxesDiv.appendChild(checkbox);
    });
    
    document.body.appendChild(modal);
    updateLanguage(); // Update modal text
}

function applyWidgetSelection() {
    const checkboxes = document.querySelectorAll('#widgetCheckboxes input[type="checkbox"]');
    appState.hiddenWidgets = [];
    
    checkboxes.forEach(checkbox => {
        const widgetId = checkbox.getAttribute('data-widget-id');
        if (!checkbox.checked) {
            appState.hiddenWidgets.push(widgetId);
        }
    });
    
    // Apply visibility
    document.querySelectorAll('.widget-card').forEach(widget => {
        const widgetId = widget.getAttribute('data-widget');
        if (appState.hiddenWidgets.includes(widgetId)) {
            widget.classList.add('hidden');
        } else {
            widget.classList.remove('hidden');
        }
    });
    
    localStorage.setItem('hiddenWidgets', JSON.stringify(appState.hiddenWidgets));
    document.querySelector('.widget-modal').remove();
    
    // Update dashboard if active
    if (document.querySelector('[data-content="dashboard"]')?.classList.contains('active')) {
        updateDashboard();
    }
}

window.applyWidgetSelection = applyWidgetSelection;

window.updateFinancialWidget = updateFinancialWidget;
window.addCashTransaction = addCashTransaction;
window.openCashTransactionModal = openCashTransactionModal;
window.closeCashTransactionModal = closeCashTransactionModal;
window.saveCashTransaction = saveCashTransaction;
window.toggleWidget = toggleWidget;
window.toggleDashboardWidgets = toggleDashboardWidgets;

// ============================================
// COMPANY NAME & LOGO UPDATE
// ============================================

document.getElementById('companyNameInput')?.addEventListener('input', async function() {
    const name = this.value || 'My Company';
    document.getElementById('companyName').textContent = name;
    localStorage.setItem('companyName', name);
    // Also save to current site if exists
    if (appState.currentSite && appState.sites[appState.currentSite]) {
        appState.sites[appState.currentSite].companyName = name;
        saveSitesToLocalStorage();
    }
    
    // Sync with backend profile
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            await fetch(`${API_BASE_URL}/user`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ company_name: name })
            });
        } catch (err) {
            console.error('Error syncing company name to profile:', err);
        }
    }
});

// Company Notes - Save to localStorage
document.getElementById('companyNotes')?.addEventListener('input', function() {
    const notes = this.value || '';
    localStorage.setItem('companyNotes', notes);
    // Also save to current site if exists
    if (appState.currentSite && appState.sites[appState.currentSite]) {
        appState.sites[appState.currentSite].notes = notes;
        saveSitesToLocalStorage();
    }
});

document.getElementById('companyNotes')?.addEventListener('blur', function() {
    const notes = this.value || '';
    localStorage.setItem('companyNotes', notes);
    if (appState.currentSite && appState.sites[appState.currentSite]) {
        appState.sites[appState.currentSite].notes = notes;
        saveSitesToLocalStorage();
    }
});

// ============================================
// FACTORS DATABASE / COUNTRY SELECTOR
// ============================================

document.getElementById('countrySelect')?.addEventListener('change', function() {
    const value = this.value || 'UK';
    if (window.carbonCalc && typeof window.carbonCalc.setCountry === 'function') {
        window.carbonCalc.setCountry(value);
    }
});

// Logo upload
document.getElementById('logoUpload')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const logoImg = document.getElementById('companyLogoImg');
            logoImg.src = event.target.result;
            localStorage.setItem('companyLogo', event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// ============================================
// INITIALIZATION
// ============================================

function initializeApp() {
    // Load saved preferences
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
        appState.currentLanguage = savedLanguage;
        updateLanguage();
    }
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        toggleDarkMode();
    }
    
    // Load company name
    const savedCompanyName = localStorage.getItem('companyName');
    if (savedCompanyName) {
        document.getElementById('companyNameInput').value = savedCompanyName;
        document.getElementById('companyName').textContent = savedCompanyName;
    }
    
    // Load company notes
    const savedCompanyNotes = localStorage.getItem('companyNotes');
    if (savedCompanyNotes !== null) {
        document.getElementById('companyNotes').value = savedCompanyNotes;
    }

    // Load General Info fields (drives final report + placeholders)
    const projectNumberEl = document.getElementById('projectNumberInput');
    if (projectNumberEl) {
        projectNumberEl.value = localStorage.getItem('projectNumber') || '';
    }
    const reportingPeriodEl = document.getElementById('reportingPeriodInput');
    if (reportingPeriodEl) {
        reportingPeriodEl.value = localStorage.getItem('reportingPeriod') || '';
    }
    const issueDateEl = document.getElementById('issueDateInput');
    if (issueDateEl) {
        issueDateEl.value = localStorage.getItem('issueDate') || '';
    }
    const reportVersionEl = document.getElementById('reportVersionInput');
    if (reportVersionEl) {
        reportVersionEl.value = localStorage.getItem('reportVersion') || '1.0';
    }
    const reportStatusEl = document.getElementById('reportStatusSelect');
    if (reportStatusEl) {
        reportStatusEl.value = localStorage.getItem('reportStatus') || 'Draft';
    }
    
    const savedLogo = localStorage.getItem('companyLogo');
    if (savedLogo) {
        document.getElementById('companyLogoImg').src = savedLogo;
    }
    
    // Load hidden widgets
    const savedHiddenWidgets = localStorage.getItem('hiddenWidgets');
    if (savedHiddenWidgets) {
        appState.hiddenWidgets = JSON.parse(savedHiddenWidgets);
        appState.hiddenWidgets.forEach(widgetId => {
            const widget = document.querySelector(`[data-widget="${widgetId}"]`);
            if (widget) widget.classList.add('hidden');
        });
    }
    
    // Initialize tabs
    initializeTabs();

    // Bind Assessment Scope checkboxes (Scope 1/2/3)
    const s1El = document.getElementById('scope1EnabledInput');
    const s2El = document.getElementById('scope2EnabledInput');
    const s3El = document.getElementById('scope3EnabledInput');
    if (s1El) s1El.checked = localStorage.getItem('scope1Enabled') !== 'false';
    if (s2El) s2El.checked = localStorage.getItem('scope2Enabled') !== 'false';
    if (s3El) s3El.checked = localStorage.getItem('scope3Enabled') !== 'false';

    const bindScope = (el, key) => {
        if (!el || el.dataset.scopeBound === '1') return;
        el.dataset.scopeBound = '1';
        el.addEventListener('change', () => {
            localStorage.setItem(key, el.checked ? 'true' : 'false');
            if (window.carbonCalc && window.carbonCalc.calculateAllTotals) window.carbonCalc.calculateAllTotals();
            if (window.updateDashboard) window.updateDashboard();
        });
    };
    bindScope(s1El, 'scope1Enabled');
    bindScope(s2El, 'scope2Enabled');
    bindScope(s3El, 'scope3Enabled');

    // Bind General Info inputs to localStorage
    const bindTextInput = (el, key) => {
        if (!el || el.dataset.bound === '1') return;
        el.dataset.bound = '1';
        el.addEventListener('input', () => localStorage.setItem(key, el.value || ''));
        el.addEventListener('change', () => localStorage.setItem(key, el.value || ''));
    };
    bindTextInput(projectNumberEl, 'projectNumber');
    bindTextInput(reportingPeriodEl, 'reportingPeriod');
    bindTextInput(issueDateEl, 'issueDate');
    bindTextInput(reportVersionEl, 'reportVersion');
    if (reportStatusEl && reportStatusEl.dataset.bound !== '1') {
        reportStatusEl.dataset.bound = '1';
        reportStatusEl.addEventListener('change', () => localStorage.setItem('reportStatus', reportStatusEl.value));
    }

    const orgRegisteredAddressEl = document.getElementById('orgRegisteredAddressInput');
    const organizationProfileEl = document.getElementById('organizationProfileInput');
    const buildingsAssessedEl = document.getElementById('buildingsAssessedInput');
    const assessmentBaseYearEl = document.getElementById('assessmentBaseYearInput');
    const assessmentPeriodDetailEl = document.getElementById('assessmentPeriodDetailInput');
    const scopeStreamsSummaryEl = document.getElementById('scopeStreamsSummaryInput');
    const assessmentGeneralNotesEl = document.getElementById('assessmentGeneralNotesInput');
    const assessmentExtraNote1El = document.getElementById('assessmentExtraNote1Input');
    const assessmentExtraNote2El = document.getElementById('assessmentExtraNote2Input');

    if (orgRegisteredAddressEl) {
        orgRegisteredAddressEl.value = localStorage.getItem('orgRegisteredAddress') || '';
    }
    if (organizationProfileEl) {
        organizationProfileEl.value = localStorage.getItem('organizationProfile') || '';
    }
    if (buildingsAssessedEl) {
        buildingsAssessedEl.value = localStorage.getItem('buildingsAssessedCount') || '';
    }
    if (assessmentBaseYearEl) {
        assessmentBaseYearEl.value = localStorage.getItem('assessmentBaseYear') || '';
    }
    if (assessmentPeriodDetailEl) {
        assessmentPeriodDetailEl.value = localStorage.getItem('assessmentPeriodDetail') || '';
    }
    if (scopeStreamsSummaryEl) {
        scopeStreamsSummaryEl.value = localStorage.getItem('scopeStreamsSummary') || '';
    }
    if (assessmentGeneralNotesEl) {
        assessmentGeneralNotesEl.value = localStorage.getItem('assessmentGeneralNotes') || '';
    }
    if (assessmentExtraNote1El) {
        assessmentExtraNote1El.value = localStorage.getItem('assessmentExtraNote1') || '';
    }
    if (assessmentExtraNote2El) {
        assessmentExtraNote2El.value = localStorage.getItem('assessmentExtraNote2') || '';
    }

    bindTextInput(orgRegisteredAddressEl, 'orgRegisteredAddress');
    bindTextInput(organizationProfileEl, 'organizationProfile');
    bindTextInput(buildingsAssessedEl, 'buildingsAssessedCount');
    bindTextInput(assessmentBaseYearEl, 'assessmentBaseYear');
    bindTextInput(assessmentPeriodDetailEl, 'assessmentPeriodDetail');
    bindTextInput(scopeStreamsSummaryEl, 'scopeStreamsSummary');
    bindTextInput(assessmentGeneralNotesEl, 'assessmentGeneralNotes');
    bindTextInput(assessmentExtraNote1El, 'assessmentExtraNote1');
    bindTextInput(assessmentExtraNote2El, 'assessmentExtraNote2');

    const tabQuestionNotesInput = document.getElementById('tabQuestionNotesInput');
    if (tabQuestionNotesInput && tabQuestionNotesInput.dataset.bound !== '1') {
        tabQuestionNotesInput.dataset.bound = '1';
        tabQuestionNotesInput.addEventListener('input', () => {
            const site = appState.sites[appState.currentSite];
            const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
            if (!site || !activeTab) return;
            if (!site.tabQuestions || typeof site.tabQuestions !== 'object') {
                site.tabQuestions = {};
            }
            site.tabQuestions[activeTab] = tabQuestionNotesInput.value || '';
            saveSitesToLocalStorage();
        });
        tabQuestionNotesInput.addEventListener('blur', () => saveCurrentSiteData());
    }
    
    // Load local data first for fast UI responsiveness
    loadSitesFromLocalStorage();
    
    // Sync with MongoDB backend in the background
    loadUserDataFromBackend().then(() => {
        // Refresh UI from newly synced data if backend data arrived
        if (appState.currentSite) {
            loadSiteData(appState.currentSite);
        }
    });
    
    // Ensure current site data is fully loaded after a short delay
    setTimeout(() => {
        if (appState.currentSite && appState.sites[appState.currentSite]) {
            loadSiteData(appState.currentSite);
            updateInputEmissionsPreview();
        }
    }, 100);
    
    // Attach listeners to existing rows
    document.querySelectorAll('.data-row').forEach(row => {
        attachRowListeners(row);
    });
    
    // Attach listeners to existing site name inputs
    document.querySelectorAll('.site-name-input').forEach(input => {
        input.addEventListener('blur', function() {
            const siteItem = this.closest('.site-item');
            const siteId = siteItem?.getAttribute('data-site-id');
            if (siteId && appState.sites[siteId]) {
                const newName = this.value.trim() || 'Unnamed Site';
                this.value = newName;
                appState.sites[siteId].name = newName;
                saveSitesToLocalStorage();
                saveUserDataToBackend(); // Sync backend on site name change
            }
        });
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
    });
    
    // Sync factors country selector
    try {
        if (window.carbonCalc && typeof window.carbonCalc.getCountry === 'function') {
            const savedCountry = window.carbonCalc.getCountry();
            const selectEl = document.getElementById('countrySelect');
            if (selectEl && savedCountry) {
                selectEl.value = savedCountry;
            }
        }
    } catch (err) {
        console.error('Error syncing country selector', err);
    }

    // Auto-save every 5 seconds to local storage and backend
    setInterval(() => {
        if (appState.loggedIn) {
            saveCurrentSiteData();
            saveUserDataToBackend();
        }
    }, 5000);

    if (typeof window.initCarbonPaletteUI === 'function') {
        window.initCarbonPaletteUI();
    }

    console.log('✅ Carbon Calculator Phase 1 initialized successfully!');
}

// ============================================
// WINDOW LOAD
// ============================================

window.addEventListener('DOMContentLoaded', function() {
    // Restore dark mode state first
    if (localStorage.getItem('darkMode') === 'true') {
        appState.darkMode = false; // toggleDarkMode will flip this to true
        toggleDarkMode();
    } else if (typeof window.applyCarbonPalette === 'function') {
        window.applyCarbonPalette();
    }

    updateLanguage();
    
    // Check if user was previously logged in
    const wasLoggedIn = localStorage.getItem('loggedIn') === 'true';
    const savedEmail = localStorage.getItem('loginEmail');
    const token = localStorage.getItem('authToken');
    
    if (wasLoggedIn && savedEmail && token) {
        if (isSessionExpired()) {
            forceLogoutForExpiredSession(false);
            return;
        }
        // Auto-login: set state and sync
        appState.loggedIn = true;
        touchSession();
        startSessionMonitor();
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        if (document.getElementById('loginEmail')) {
            document.getElementById('loginEmail').value = savedEmail;
        }
        
        // Load latest from backend then init
        loadUserDataFromBackend().then(() => {
            initializeApp();
        });
    } else {
        // Show login screen
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// ============================================
// DARK MODE & LANGUAGE TOGGLE
// ============================================

function toggleDarkMode() {
    appState.darkMode = !appState.darkMode;
    
    if (appState.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.removeAttribute('data-theme');
    }
    
    localStorage.setItem('darkMode', appState.darkMode);
    
    const icon = document.querySelector('#darkModeToggle i');
    if (icon) {
        icon.className = appState.darkMode ? 'fas fa-sun' : 'fas fa-moon';
    }

    if (typeof window.applyCarbonPalette === 'function') {
        window.applyCarbonPalette();
    }
}

function updateLanguage() {
    const lang = appState.currentLanguage;
    document.querySelectorAll('[data-en]').forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        }
    });
    
    // Update labels and other specific elements
    const langBtnText = document.getElementById('langText');
    if (langBtnText) langBtnText.textContent = lang.toUpperCase();
    
    const langBtnTextLogin = document.getElementById('langTextLogin');
    if (langBtnTextLogin) langBtnTextLogin.textContent = lang === 'en' ? 'PT' : 'EN';

    if (typeof window.refreshCarbonPaletteLabels === 'function') {
        window.refreshCarbonPaletteLabels();
    }
}

function toggleLanguage() {
    appState.currentLanguage = appState.currentLanguage === 'en' ? 'pt' : 'en';
    localStorage.setItem('language', appState.currentLanguage);
    updateLanguage();
}

// Attach UI Toggles
document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);
document.getElementById('langToggle')?.addEventListener('click', toggleLanguage);
document.getElementById('langToggleLogin')?.addEventListener('click', toggleLanguage);

window.toggleDarkMode = toggleDarkMode;
window.updateLanguage = updateLanguage;
window.toggleLanguage = toggleLanguage;

// Prevent data loss on page unload
window.addEventListener('beforeunload', function(e) {
    if (appState.loggedIn) {
        saveCurrentSiteData();
        saveUserDataToBackend(); // Attempt background sync
    }
});


