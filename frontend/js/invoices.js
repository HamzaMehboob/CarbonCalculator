// ============================================
// INVOICE MANAGEMENT
// ============================================

let invoicesChart = null;
let monthlyCashFlowChart = null;

// Initialize invoices data structure
function initInvoicesData() {
    const site = appState.sites[appState.currentSite];
    if (!site) return;
    
    if (!site.invoices) {
        site.invoices = [];
    }
    if (!site.monthlyCashFlow) {
        site.monthlyCashFlow = {};
    }
    
    saveSitesToLocalStorage();
}

// Open invoice modal
function openInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (!modal) return;
    
    // Reset form
    document.getElementById('invoiceAmount').value = '';
    document.getElementById('invoiceMonth').value = new Date().getMonth();
    document.getElementById('invoiceYear').value = new Date().getFullYear();
    document.getElementById('invoiceStatus').value = 'awaiting';
    
    // Remove edit mode
    modal.dataset.editId = '';
    
    modal.style.display = 'flex';
    updateLanguage();
}

// Close invoice modal
function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Save invoice
function saveInvoice() {
    const amount = parseFloat(document.getElementById('invoiceAmount').value);
    const month = parseInt(document.getElementById('invoiceMonth').value);
    const year = parseInt(document.getElementById('invoiceYear').value);
    const status = document.getElementById('invoiceStatus').value;
    const editId = document.getElementById('invoiceModal').dataset.editId;
    
    if (!amount || amount <= 0) {
        alert(appState.currentLanguage === 'en' ? 'Please enter a valid invoice amount' : 'Por favor, insira um valor válido');
        return;
    }
    
    const site = appState.sites[appState.currentSite];
    if (!site) return;
    
    initInvoicesData();
    
    const invoiceData = {
        id: editId || `inv-${Date.now()}`,
        amount: amount,
        month: month,
        year: year,
        status: status,
        date: new Date(year, month, 1).toISOString()
    };
    
    if (editId) {
        // Update existing invoice
        const index = site.invoices.findIndex(inv => inv.id === editId);
        if (index !== -1) {
            site.invoices[index] = invoiceData;
        }
    } else {
        // Add new invoice
        site.invoices.push(invoiceData);
    }
    
    saveSitesToLocalStorage();
    closeInvoiceModal();
    updateInvoicesChart();
    updateInvoicesSummary();
    updateInvoicesOwedWidget();
}

// Update invoices owed widget from invoices data
function updateInvoicesOwedWidget() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.invoices) return;
    
    // Calculate total from all unpaid invoices
    const totalOwed = site.invoices
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    // Update site financials
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
    site.financials.invoicesOwed = totalOwed;
    
    // Update display widgets
    const widget = document.getElementById('invoicesOwedAccounts');
    if (widget) {
        widget.textContent = `$${totalOwed.toFixed(2)}`;
    }
    
    saveSitesToLocalStorage();
}

// Delete invoice
function deleteInvoice(invoiceId) {
    if (!confirm(appState.currentLanguage === 'en' ? 'Are you sure you want to delete this invoice?' : 'Tem certeza que deseja excluir esta fatura?')) {
        return;
    }
    
    const site = appState.sites[appState.currentSite];
    if (!site || !site.invoices) return;
    
    site.invoices = site.invoices.filter(inv => inv.id !== invoiceId);
    saveSitesToLocalStorage();
    updateInvoicesChart();
    updateInvoicesSummary();
}

// Edit invoice
function editInvoice(invoiceId) {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.invoices) return;
    
    const invoice = site.invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    document.getElementById('invoiceAmount').value = invoice.amount;
    document.getElementById('invoiceMonth').value = invoice.month;
    document.getElementById('invoiceYear').value = invoice.year;
    document.getElementById('invoiceStatus').value = invoice.status;
    document.getElementById('invoiceModal').dataset.editId = invoiceId;
    
    document.getElementById('invoiceModal').style.display = 'flex';
    updateLanguage();
}

// Update invoices summary
function updateInvoicesSummary() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.invoices) return;
    
    const summaryDiv = document.getElementById('invoicesSummary');
    if (!summaryDiv) return;
    
    const now = new Date();
    const draft = site.invoices.filter(inv => inv.status === 'draft');
    const awaiting = site.invoices.filter(inv => inv.status === 'awaiting');
    const overdue = site.invoices.filter(inv => inv.status === 'overdue');
    
    const draftTotal = draft.reduce((sum, inv) => sum + inv.amount, 0);
    const awaitingTotal = awaiting.reduce((sum, inv) => sum + inv.amount, 0);
    const overdueTotal = overdue.reduce((sum, inv) => sum + inv.amount, 0);
    
    summaryDiv.innerHTML = `
        <div class="invoices-stats">
            <div class="invoice-stat">
                <span>${draft.length} <span data-en="Draft invoices" data-pt="Faturas em rascunho">Draft invoices</span></span>
                <strong>$${draftTotal.toFixed(2)}</strong>
            </div>
            <div class="invoice-stat">
                <span>${awaiting.length} <span data-en="Awaiting payment" data-pt="Aguardando pagamento">Awaiting payment</span></span>
                <strong>$${awaitingTotal.toFixed(2)}</strong>
            </div>
            <div class="invoice-stat overdue">
                <span>${overdue.length} <span data-en="Overdue" data-pt="Vencido">Overdue</span></span>
                <strong>$${overdueTotal.toFixed(2)}</strong>
            </div>
        </div>
    `;
    
    updateLanguage();
}

// Update invoices chart
function updateInvoicesChart() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.invoices) return;
    
    const ctx = document.getElementById('invoicesChart');
    if (!ctx) return;
    
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Group invoices by time period
    const periods = {
        'Older': { amount: 0, invoices: [] },
        '31 Mar-6 Apr': { amount: 0, invoices: [] },
        'This week': { amount: 0, invoices: [] },
        '14-20 Apr': { amount: 0, invoices: [] },
        '21-27 Apr': { amount: 0, invoices: [] },
        'Future': { amount: 0, invoices: [] }
    };
    
    site.invoices.filter(inv => inv.status !== 'paid').forEach(invoice => {
        const invDate = new Date(invoice.year, invoice.month, 1);
        const daysDiff = Math.floor((invDate - currentDate) / (1000 * 60 * 60 * 24));
        
        let period = 'Future';
        if (daysDiff < -30) {
            period = 'Older';
        } else if (daysDiff < -14) {
            period = '31 Mar-6 Apr';
        } else if (daysDiff < -7) {
            period = 'This week';
        } else if (daysDiff < 0) {
            period = '14-20 Apr';
        } else if (daysDiff < 7) {
            period = '21-27 Apr';
        }
        
        periods[period].amount += invoice.amount;
        periods[period].invoices.push(invoice);
    });
    
    const labels = Object.keys(periods);
    const data = labels.map(label => periods[label].amount);
    
    if (invoicesChart) {
        invoicesChart.destroy();
    }
    
    invoicesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: appState.currentLanguage === 'en' ? 'Invoice Amount ($)' : 'Valor da Fatura ($)',
                data: data,
                backgroundColor: labels.map((label, index) => {
                    if (label === 'This week') return '#13B5EA';
                    if (label === 'Overdue' || label === 'Older') return '#DC3545';
                    return '#6C757D';
                }),
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 2,
            layout: {
                padding: {
                    top: 20,
                    bottom: 20,
                    left: 10,
                    right: 10
                }
            },
            indexAxis: 'x',
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    ticks: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        color: appState.darkMode ? '#3A3F47' : '#DEE2E6',
                        drawBorder: false
                    }
                },
                x: {
                    position: 'bottom',
                    ticks: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        maxRotation: 45,
                        minRotation: 0
                    },
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            }
        }
    });
    
    updateInvoicesSummary();
}

// Update monthly cash flow chart
function updateMonthlyCashFlowChart() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.financials) return;
    
    const ctx = document.getElementById('monthlyCashFlowChart');
    if (!ctx) return;
    
    // Get monthly cash in/out data from transactions
    const monthNames = appState.currentLanguage === 'en' 
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // Get last 6 months
    const now = new Date();
    const months = [];
    const cashIn = [];
    const cashOut = [];
    const monthlyData = {}; // { '2025-0': { cashIn: 0, cashOut: 0 }, ... }
    
    // Aggregate transactions by month
    if (site.cashTransactions) {
        if (site.cashTransactions.cashIn) {
            site.cashTransactions.cashIn.forEach(trans => {
                const transDate = new Date(trans.date || trans.timestamp);
                const monthKey = `${transDate.getFullYear()}-${transDate.getMonth()}`;
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { cashIn: 0, cashOut: 0 };
                }
                monthlyData[monthKey].cashIn += trans.amount || 0;
            });
        }
        if (site.cashTransactions.cashOut) {
            site.cashTransactions.cashOut.forEach(trans => {
                const transDate = new Date(trans.date || trans.timestamp);
                const monthKey = `${transDate.getFullYear()}-${transDate.getMonth()}`;
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { cashIn: 0, cashOut: 0 };
                }
                monthlyData[monthKey].cashOut += trans.amount || 0;
            });
        }
    }
    
    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        months.push(monthNames[date.getMonth()]);
        
        // Get monthly data from transactions
        if (monthlyData[monthKey]) {
            cashIn.push(monthlyData[monthKey].cashIn || 0);
            cashOut.push(monthlyData[monthKey].cashOut || 0);
        } else {
            cashIn.push(0);
            cashOut.push(0);
        }
    }
    
    if (monthlyCashFlowChart) {
        monthlyCashFlowChart.destroy();
    }
    
    monthlyCashFlowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: appState.currentLanguage === 'en' ? 'Cash In' : 'Entrada',
                    data: cashIn,
                    backgroundColor: '#28A745',
                    borderRadius: 8
                },
                {
                    label: appState.currentLanguage === 'en' ? 'Cash Out' : 'Saída',
                    data: cashOut,
                    backgroundColor: '#6C757D',
                    borderRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        color: appState.darkMode ? '#3A3F47' : '#DEE2E6'
                    }
                },
                x: {
                    ticks: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// Initialize bills data structure
function initBillsData() {
    const site = appState.sites[appState.currentSite];
    if (!site) return;
    
    if (!site.bills) {
        site.bills = [];
    }
    
    saveSitesToLocalStorage();
}

// Open bill modal
function openBillModal() {
    const modal = document.getElementById('billModal');
    if (!modal) return;
    
    // Reset form
    document.getElementById('billName').value = '';
    document.getElementById('billCategory').value = '';
    document.getElementById('billAmount').value = '';
    document.getElementById('billDueDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('billStatus').value = 'awaiting';
    
    // Remove edit mode
    modal.dataset.editId = '';
    
    modal.style.display = 'flex';
    updateLanguage();
}

// Close bill modal
function closeBillModal() {
    const modal = document.getElementById('billModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Save bill
function saveBill() {
    const name = document.getElementById('billName').value.trim();
    const category = document.getElementById('billCategory').value.trim();
    const amount = parseFloat(document.getElementById('billAmount').value);
    const dueDate = document.getElementById('billDueDate').value;
    const status = document.getElementById('billStatus').value;
    const editId = document.getElementById('billModal').dataset.editId;
    
    if (!name || !amount || amount <= 0) {
        alert(appState.currentLanguage === 'en' ? 'Please enter a valid bill name and amount' : 'Por favor, insira um nome e valor válidos');
        return;
    }
    
    const site = appState.sites[appState.currentSite];
    if (!site) {
        console.error('No site available');
        return;
    }
    
    initBillsData();
    
    const billData = {
        id: editId || `bill-${Date.now()}-${Math.random()}`,
        name: name,
        category: category,
        amount: amount,
        dueDate: dueDate,
        status: status,
        date: new Date().toISOString()
    };
    
    if (editId) {
        // Update existing bill
        const index = site.bills.findIndex(bill => bill.id === editId);
        if (index !== -1) {
            site.bills[index] = billData;
        }
    } else {
        // Add new bill
        if (!site.bills) {
            site.bills = [];
        }
        site.bills.push(billData);
    }
    
    // Save immediately
    saveSitesToLocalStorage();
    if (window.saveCurrentSiteData) {
        window.saveCurrentSiteData();
    }
    
    closeBillModal();
    
    // Force update immediately - no delay
    if (window.updateBillsChart) {
        window.updateBillsChart();
    }
    if (window.updateBillsSummary) {
        window.updateBillsSummary();
    }
    if (window.updateBillsToPayWidget) {
        window.updateBillsToPayWidget();
    }
    
    // Also update Accounts Dashboard if active
    const accountsTab = document.querySelector('[data-content="accounts"]');
    if (accountsTab && accountsTab.classList.contains('active')) {
        if (window.updateAccountsCharts) {
            setTimeout(() => {
                window.updateAccountsCharts();
            }, 100);
        }
    }
    
    // Debug logging
    console.log('Bill saved:', billData);
    console.log('Total bills:', site.bills.length);
}

// Delete bill
function deleteBill(billId) {
    if (!confirm(appState.currentLanguage === 'en' ? 'Are you sure you want to delete this bill?' : 'Tem certeza que deseja excluir esta conta?')) {
        return;
    }
    
    const site = appState.sites[appState.currentSite];
    if (!site || !site.bills) return;
    
    site.bills = site.bills.filter(bill => bill.id !== billId);
    saveSitesToLocalStorage();
    updateBillsChart();
    updateBillsSummary();
    updateBillsToPayWidget();
}

// Edit bill
function editBill(billId) {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.bills) return;
    
    const bill = site.bills.find(b => b.id === billId);
    if (!bill) return;
    
    document.getElementById('billName').value = bill.name || '';
    document.getElementById('billCategory').value = bill.category || '';
    document.getElementById('billAmount').value = bill.amount || '';
    document.getElementById('billDueDate').value = bill.dueDate || new Date().toISOString().split('T')[0];
    document.getElementById('billStatus').value = bill.status || 'awaiting';
    document.getElementById('billModal').dataset.editId = billId;
    
    document.getElementById('billModal').style.display = 'flex';
    updateLanguage();
}

// Update bills summary
function updateBillsSummary() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.bills) return;
    
    const summaryDiv = document.getElementById('billsSummary');
    if (!summaryDiv) return;
    
    const draft = site.bills.filter(bill => bill.status === 'draft');
    const awaiting = site.bills.filter(bill => bill.status === 'awaiting');
    const overdue = site.bills.filter(bill => bill.status === 'overdue');
    
    const draftTotal = draft.reduce((sum, bill) => sum + bill.amount, 0);
    const awaitingTotal = awaiting.reduce((sum, bill) => sum + bill.amount, 0);
    const overdueTotal = overdue.reduce((sum, bill) => sum + bill.amount, 0);
    
    summaryDiv.innerHTML = `
        <div class="invoices-stats">
            <div class="invoice-stat">
                <span>${draft.length} <span data-en="Draft bills" data-pt="Contas em rascunho">Draft bills</span></span>
                <strong>$${draftTotal.toFixed(2)}</strong>
            </div>
            <div class="invoice-stat">
                <span>${awaiting.length} <span data-en="Awaiting payment" data-pt="Aguardando pagamento">Awaiting payment</span></span>
                <strong>$${awaitingTotal.toFixed(2)}</strong>
            </div>
            <div class="invoice-stat overdue">
                <span>${overdue.length} <span data-en="Overdue" data-pt="Vencido">Overdue</span></span>
                <strong>$${overdueTotal.toFixed(2)}</strong>
            </div>
        </div>
    `;
    
    updateLanguage();
}

// Update bills chart
function updateBillsChart() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.bills) return;
    
    const ctx = document.getElementById('billsChart');
    if (!ctx) return;
    
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Group bills by time period
    const periods = {
        'Older': { amount: 0, bills: [] },
        '31 Mar-6 Apr': { amount: 0, bills: [] },
        'This week': { amount: 0, bills: [] },
        '14-20 Apr': { amount: 0, bills: [] },
        '21-27 Apr': { amount: 0, bills: [] },
        'Future': { amount: 0, bills: [] }
    };
    
    site.bills.filter(bill => bill.status !== 'paid').forEach(bill => {
        const dueDate = new Date(bill.dueDate);
        const daysDiff = Math.floor((dueDate - currentDate) / (1000 * 60 * 60 * 24));
        
        let period = 'Future';
        if (daysDiff < -30) {
            period = 'Older';
        } else if (daysDiff < -14) {
            period = '31 Mar-6 Apr';
        } else if (daysDiff < -7) {
            period = 'This week';
        } else if (daysDiff < 0) {
            period = '14-20 Apr';
        } else if (daysDiff < 7) {
            period = '21-27 Apr';
        }
        
        periods[period].amount += bill.amount;
        periods[period].bills.push(bill);
    });
    
    const labels = Object.keys(periods);
    const data = labels.map(label => periods[label].amount);
    
    if (window.billsChart) {
        window.billsChart.destroy();
    }
    
    window.billsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: appState.currentLanguage === 'en' ? 'Bill Amount ($)' : 'Valor da Conta ($)',
                data: data,
                backgroundColor: labels.map((label, index) => {
                    if (label === 'This week') return '#DC3545';
                    if (label === 'Older') return '#6C757D';
                    return '#6C757D';
                }),
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 2,
            layout: {
                padding: {
                    top: 20,
                    bottom: 20,
                    left: 10,
                    right: 10
                }
            },
            indexAxis: 'x',
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    ticks: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        color: appState.darkMode ? '#3A3F47' : '#DEE2E6',
                        drawBorder: false
                    }
                },
                x: {
                    position: 'bottom',
                    ticks: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        maxRotation: 45,
                        minRotation: 0
                    },
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            }
        }
    });
    
    updateBillsSummary();
}

// Update bills to pay widget from bills data
function updateBillsToPayWidget() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.bills) return;
    
    // Calculate total from all unpaid bills
    const totalToPay = site.bills
        .filter(bill => bill.status !== 'paid')
        .reduce((sum, bill) => sum + (bill.amount || 0), 0);
    
    // Update site financials
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
    site.financials.billsToPay = totalToPay;
    
    // Update display widgets
    const widget = document.getElementById('billsToPayAccounts');
    if (widget) {
        widget.textContent = `$${totalToPay.toFixed(2)}`;
    }
    
    saveSitesToLocalStorage();
}

// Export functions
window.openInvoiceModal = openInvoiceModal;
window.closeInvoiceModal = closeInvoiceModal;
window.saveInvoice = saveInvoice;
window.deleteInvoice = deleteInvoice;
window.editInvoice = editInvoice;
window.updateInvoicesChart = updateInvoicesChart;
window.updateInvoicesOwedWidget = updateInvoicesOwedWidget;
window.updateMonthlyCashFlowChart = updateMonthlyCashFlowChart;
window.openBillModal = openBillModal;
window.closeBillModal = closeBillModal;
window.saveBill = saveBill;
window.deleteBill = deleteBill;
window.editBill = editBill;
window.updateBillsChart = updateBillsChart;
window.updateBillsToPayWidget = updateBillsToPayWidget;
window.initBillsData = initBillsData;
window.saveBill = saveBill;
window.updateBillsChart = updateBillsChart;
window.updateBillsSummary = updateBillsSummary;

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    // Close invoice modal on outside click
    const invoiceModal = document.getElementById('invoiceModal');
    if (invoiceModal) {
        invoiceModal.addEventListener('click', function(e) {
            if (e.target === invoiceModal) {
                closeInvoiceModal();
            }
        });
    }
    
    // Close bill modal on outside click
    const billModal = document.getElementById('billModal');
    if (billModal) {
        billModal.addEventListener('click', function(e) {
            if (e.target === billModal) {
                closeBillModal();
            }
        });
    }
    
    // Close cash transaction modal on outside click
    const cashTransactionModal = document.getElementById('cashTransactionModal');
    if (cashTransactionModal) {
        cashTransactionModal.addEventListener('click', function(e) {
            if (e.target === cashTransactionModal) {
                closeCashTransactionModal();
            }
        });
    }
});

