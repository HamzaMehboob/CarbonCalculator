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
            }
        }
    },
    hiddenWidgets: []
};

// ============================================
// LOGIN SYSTEM
// ============================================

document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Simple authentication (replace with backend API in production)
    if (email === 'admin@company.com' && password === 'admin123') {
        appState.loggedIn = true;
        localStorage.setItem('loggedIn', 'true'); // Save login state
        localStorage.setItem('loginEmail', email); // Save email for convenience
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        initializeApp();
    } else {
        document.getElementById('loginError').textContent = 
            appState.currentLanguage === 'en' 
                ? 'Invalid email or password' 
                : 'E-mail ou senha inválidos';
    }
});

// ============================================
// LANGUAGE TOGGLE
// ============================================

function toggleLanguage() {
    appState.currentLanguage = appState.currentLanguage === 'en' ? 'pt' : 'en';
    updateLanguage();
    localStorage.setItem('language', appState.currentLanguage);
}

function updateLanguage() {
    const elements = document.querySelectorAll('[data-en][data-pt]');
    elements.forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = el.getAttribute(`data-${appState.currentLanguage}`);
        } else {
            el.textContent = el.getAttribute(`data-${appState.currentLanguage}`);
        }
    });
    
    document.getElementById('langText').textContent = appState.currentLanguage.toUpperCase();
    document.getElementById('langTextLogin').textContent = appState.currentLanguage === 'en' ? 'PT' : 'EN';
}

document.getElementById('langToggle')?.addEventListener('click', toggleLanguage);
document.getElementById('langToggleLogin')?.addEventListener('click', toggleLanguage);

// ============================================
// DARK MODE TOGGLE
// ============================================

function toggleDarkMode() {
    appState.darkMode = !appState.darkMode;
    document.body.setAttribute('data-theme', appState.darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', appState.darkMode);
    
    const icon = document.querySelector('#darkModeToggle i');
    icon.className = appState.darkMode ? 'fas fa-sun' : 'fas fa-moon';
}

document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);

// ============================================
// LOGOUT
// ============================================

document.getElementById('logoutBtn')?.addEventListener('click', function() {
    if (confirm(appState.currentLanguage === 'en' ? 'Are you sure you want to logout?' : 'Tem certeza que deseja sair?')) {
        appState.loggedIn = false;
        localStorage.removeItem('loggedIn'); // Remove login state
        localStorage.removeItem('loginEmail');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    }
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
}

// Expose tab switcher so sidebar circular buttons can use it
window.setActiveTab = setActiveTab;

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
            monthlyCashFlow: {}
        };
        
        addSiteToList(siteId, siteName.trim());
        switchSite(siteId);
        saveSitesToLocalStorage();
    }
});

function addSiteToList(siteId, siteName) {
    const sitesList = document.getElementById('sitesList');
    const siteItem = document.createElement('li');
    siteItem.className = 'site-item';
    siteItem.setAttribute('data-site-id', siteId);
    siteItem.innerHTML = `
        <i class="fas fa-building"></i>
        <input type="text" class="site-name-input" value="${siteName}" placeholder="Site name">
        <button class="btn-delete"><i class="fas fa-times"></i></button>
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
    localStorage.setItem('carbonCalcSites', JSON.stringify(appState.sites));
}

function loadSitesFromLocalStorage() {
    const saved = localStorage.getItem('carbonCalcSites');
    if (saved) {
        appState.sites = JSON.parse(saved);
        
        const sitesList = document.getElementById('sitesList');
        sitesList.innerHTML = '';
        
        Object.keys(appState.sites).forEach(siteId => {
            addSiteToList(siteId, appState.sites[siteId].name);
        });
        
        if (Object.keys(appState.sites).length > 0) {
            const firstSite = Object.keys(appState.sites)[0];
            switchSite(firstSite);
        }
    }
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
    
    // Recalculate totals after loading
    setTimeout(() => {
        calculateAllTotals();
    }, 100);
    
    // Update dashboard if it's active
    setTimeout(() => {
        if (document.querySelector('[data-content="dashboard"]')?.classList.contains('active')) {
            updateDashboard();
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
    
    const numValue = parseFloat(value) || 0;
    
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
            input.value = value;
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

document.getElementById('companyNameInput')?.addEventListener('input', function() {
    const name = this.value || 'My Company';
    document.getElementById('companyName').textContent = name;
    localStorage.setItem('companyName', name);
    // Also save to current site if exists
    if (appState.currentSite && appState.sites[appState.currentSite]) {
        appState.sites[appState.currentSite].companyName = name;
        saveSitesToLocalStorage();
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
    
    // Load sites (this will also load site data and switch to first site)
    loadSitesFromLocalStorage();
    
    // Ensure current site data is fully loaded after a short delay
    // This ensures all DOM elements are ready
    setTimeout(() => {
        if (appState.currentSite && appState.sites[appState.currentSite]) {
            loadSiteData(appState.currentSite);
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
            }
        });
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
    });
    
    // Sync factors country selector with saved value (if calculations module is loaded)
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

    // Auto-save every 30 seconds
    setInterval(saveCurrentSiteData, 30000);
    
    console.log('✅ Carbon Calculator Phase 1 initialized successfully!');
}

// ============================================
// WINDOW LOAD
// ============================================

window.addEventListener('DOMContentLoaded', function() {
    updateLanguage();
    
    // Check if user was previously logged in
    const wasLoggedIn = localStorage.getItem('loggedIn') === 'true';
    const savedEmail = localStorage.getItem('loginEmail');
    
    if (wasLoggedIn && savedEmail) {
        // Auto-login if previously logged in
        appState.loggedIn = true;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        if (document.getElementById('loginEmail')) {
            document.getElementById('loginEmail').value = savedEmail;
        }
        initializeApp();
    } else {
        // Show login screen
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// Prevent data loss on page unload
window.addEventListener('beforeunload', function(e) {
    if (appState.loggedIn) {
        saveCurrentSiteData();
    }
});


