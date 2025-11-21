// ============================================
// CARBON CALCULATOR - DASHBOARD
// Live Charts and KPIs
// ============================================

let pieChart = null;
let barChart = null;
let lineChart = null;
let bankReconChart = null;
let accountFlowChart = null;
let accountSummaryChart = null;

// Generate colors for year bars dynamically
function generateYearColors(count) {
    const colorPalette = [
        '#6C757D',  // Gray
        '#13B5EA',  // Blue
        '#28A745',  // Green
        '#FFC107',  // Yellow
        '#DC3545',  // Red
        '#6610F2',  // Purple
        '#FD7E14',  // Orange
        '#20C997',  // Teal
        '#E83E8C',  // Pink
        '#343A40'   // Dark
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(colorPalette[i % colorPalette.length]);
    }
    
    return colors;
}

// ============================================
// UPDATE DASHBOARD
// ============================================

function updateDashboard() {
    updateKPIs();
    updateCharts();
}

// ============================================
// UPDATE KPIs
// ============================================

function updateKPIs() {
    // Get category totals
    const totals = window.carbonCalc.getCategoryTotals();
    const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
    
    // Get year comparison (dynamic years)
    const yearComparison = window.carbonCalc.getYearComparison();
    const years = Object.keys(yearComparison).map(y => parseInt(y)).sort((a, b) => b - a); // Sort descending
    
    // Get current year (latest year) - use current year if no data
    const currentYearNum = new Date().getFullYear();
    const latestYear = years.length > 0 ? years[0] : currentYearNum;
    const lastYearValue = yearComparison[latestYear] || 0;
    const previousYear = years.length > 1 ? years[1] : (years.length > 0 && years[0] > 2020 ? years[0] - 1 : currentYearNum - 1);
    const previousYearValue = previousYear ? (yearComparison[previousYear] || 0) : 0;
    
    // Calculate change percentage
    let changePercent = 0;
    if (previousYearValue > 0) {
        changePercent = ((lastYearValue - previousYearValue) / previousYearValue) * 100;
    }
    
    // Calculate monthly average - use current year's monthly data
    const monthlyData = window.carbonCalc.getMonthlyTotals();
    // Count months with any data (even small values)
    const monthsWithData = monthlyData.filter(m => m > 0).length;
    // If we have monthly data, use it; otherwise use yearly data / 12
    const avgMonth = monthsWithData > 0 
        ? (monthlyData.reduce((sum, val) => sum + val, 0) / monthsWithData)
        : (lastYearValue > 0 ? lastYearValue / 12 : 0);
    
    // Update KPI elements
    const totalEmissionsEl = document.getElementById('totalEmissions');
    if (totalEmissionsEl) {
        totalEmissionsEl.textContent = `${grandTotal.toFixed(3)} tCO₂e`;
    }
    
    const currentYearEmissionsEl = document.getElementById('currentYearEmissions');
    if (currentYearEmissionsEl) {
        currentYearEmissionsEl.textContent = `${lastYearValue.toFixed(3)} tCO₂e`;
    }
    
    // Update last year display with dynamic year
    const lastYearElement = document.getElementById('lastYearEmissions');
    if (lastYearElement) {
        if (previousYear && yearComparison[previousYear] !== undefined) {
            lastYearElement.textContent = `${previousYearValue.toFixed(3)} tCO₂e`;
            // Update label if exists
            const lastYearLabel = lastYearElement.parentElement.querySelector('h3');
            if (lastYearLabel) {
                const labelText = lastYearLabel.textContent || lastYearLabel.innerHTML;
                lastYearLabel.innerHTML = labelText.replace(/\d{4}/, previousYear) || `Last Year (${previousYear})`;
            }
        } else {
            lastYearElement.textContent = '0.000 tCO₂e';
        }
    }
    
    const avgMonthEl = document.getElementById('avgMonthEmissions');
    if (avgMonthEl) {
        avgMonthEl.textContent = `${avgMonth.toFixed(3)} tCO₂e`;
    }
    
    // Update change indicator
    const changeElement = document.getElementById('emissionsChange');
    if (changeElement && previousYear && previousYearValue > 0) {
        const changeText = changePercent > 0 ? `+${changePercent.toFixed(1)}%` : `${changePercent.toFixed(1)}%`;
        changeElement.textContent = changeText;
        changeElement.style.color = changePercent > 0 ? '#DC3545' : '#28A745';
    } else if (changeElement) {
        changeElement.textContent = 'N/A';
        changeElement.style.color = '#6C757D';
    }
    
    // Update current year label
    const currentYearLabel = document.querySelector('[data-widget="thisyear"] h3');
    if (currentYearLabel) {
        const labelText = currentYearLabel.textContent || currentYearLabel.innerHTML;
        currentYearLabel.innerHTML = labelText.replace(/\d{4}/, latestYear) || `This Year (${latestYear})`;
    }
}

// ============================================
// UPDATE CHARTS
// ============================================

function updateCharts() {
    updatePieChart();
    updateBarChart();
    updateLineChart();
}

function updateAccountsCharts() {
    if (window.updateBankReconciliationChart) updateBankReconciliationChart();
    if (window.updateCashFlowChart) updateCashFlowChart();
    if (window.updateAccountSummaryChart) updateAccountSummaryChart();
    if (window.updateMonthlyCashFlowChart) updateMonthlyCashFlowChart();
    if (window.updateInvoicesChart) {
        if (window.initInvoicesData) window.initInvoicesData();
        window.updateInvoicesChart();
        if (window.updateInvoicesOwedWidget) window.updateInvoicesOwedWidget();
    }
    if (window.updateBillsChart) {
        if (window.initBillsData) window.initBillsData();
        window.updateBillsChart();
        if (window.updateBillsToPayWidget) window.updateBillsToPayWidget();
    }
}

// ============================================
// PIE CHART - Emissions by Category
// ============================================

function updatePieChart() {
    const totals = window.carbonCalc.getCategoryTotals();
    const labels = Object.keys(totals).map(key => {
        const translations = {
            water: appState.currentLanguage === 'en' ? 'Water' : 'Água',
            energy: appState.currentLanguage === 'en' ? 'Energy' : 'Energia',
            waste: appState.currentLanguage === 'en' ? 'Waste' : 'Resíduos',
            transport: appState.currentLanguage === 'en' ? 'Transport' : 'Transporte',
            refrigerants: appState.currentLanguage === 'en' ? 'Refrigerants' : 'Refrigerantes'
        };
        return translations[key] || key;
    });
    const data = Object.values(totals);
    
    const ctx = document.getElementById('pieChart');
    
    if (pieChart) {
        pieChart.destroy();
    }
    
    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#13B5EA',  // Water
                    '#FFC107',  // Energy
                    '#28A745',  // Waste
                    '#DC3545',  // Transport
                    '#6C757D'   // Refrigerants
                ],
                borderWidth: 2,
                borderColor: appState.darkMode ? '#23272F' : '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: appState.darkMode ? '#E8EAED' : '#2C3E50',
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value.toFixed(3)} tCO₂e (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// BAR CHART - Year-over-Year Comparison
// ============================================

function updateBarChart() {
    // Force recalculation first
    if (window.carbonCalc && window.carbonCalc.calculateAllTotals) {
        window.carbonCalc.calculateAllTotals();
    }
    
    const yearComparison = window.carbonCalc.getYearComparison();
    const years = Object.keys(yearComparison).sort((a, b) => parseInt(a) - parseInt(b)); // Sort years
    const values = years.map(year => yearComparison[year] || 0); // Get values in same order
    
    // Debug logging
    console.log('Year Comparison Data:', yearComparison);
    console.log('Years:', years);
    console.log('Values:', values);
    
    // Ensure we have at least some data
    if (years.length === 0 || values.length === 0) {
        console.log('No year data found for bar chart');
        // Create default data
        const currentYear = new Date().getFullYear();
        years.push(currentYear.toString());
        values.push(0);
        if (currentYear > 2020) {
            years.push((currentYear - 1).toString());
            values.push(0);
        }
    }
    
    // Generate colors dynamically based on number of years
    const colors = generateYearColors(years.length);
    
    const ctx = document.getElementById('barChart');
    if (!ctx) {
        console.error('Bar chart canvas not found');
        return;
    }
    
    if (barChart) {
        barChart.destroy();
    }
    
    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: appState.currentLanguage === 'en' ? 'Total Emissions (tCO₂e)' : 'Emissões Totais (tCO₂e)',
                data: values,
                backgroundColor: colors.length === years.length ? colors : generateYearColors(years.length),
                borderWidth: 0,
                borderRadius: 8,
                barThickness: 'flex',
                maxBarThickness: 50,
                minBarLength: 0
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
                            return value.toFixed(1);
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
                        maxRotation: 0,
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
                            return `${context.parsed.y.toFixed(3)} tCO₂e`;
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// LINE CHART - Monthly Emissions Trend
// ============================================

function updateLineChart() {
    const monthlyData = window.carbonCalc.getMonthlyTotals();
    const monthNames = appState.currentLanguage === 'en' 
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const ctx = document.getElementById('lineChart');
    
    if (lineChart) {
        lineChart.destroy();
    }
    
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthNames,
            datasets: [{
                label: appState.currentLanguage === 'en' ? 'Monthly Emissions (tCO₂e)' : 'Emissões Mensais (tCO₂e)',
                data: monthlyData,
                borderColor: '#13B5EA',
                backgroundColor: 'rgba(19, 181, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#13B5EA',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 2
            }]
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
                            return value.toFixed(2);
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
                        color: appState.darkMode ? '#3A3F47' : '#DEE2E6'
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
                            return `${context.parsed.y.toFixed(3)} tCO₂e`;
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// AUTO-UPDATE DASHBOARD
// ============================================

// Update dashboard when inputs change
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('month-input') || (e.target.type === 'number' && e.target.closest('.data-row'))) {
        const dashboardTab = document.querySelector('[data-content="dashboard"]');
        if (dashboardTab && dashboardTab.classList.contains('active')) {
            // Debounce updates
            clearTimeout(window.dashboardUpdateTimeout);
            window.dashboardUpdateTimeout = setTimeout(() => {
                if (window.carbonCalc && window.carbonCalc.calculateAllTotals) {
                    window.carbonCalc.calculateAllTotals();
                }
                updateDashboard();
            }, 300);
        }
    }
});

// Also listen for changes on year inputs specifically
document.addEventListener('change', function(e) {
    const row = e.target.closest('.data-row');
    if (row && e.target.type === 'number') {
        const dashboardTab = document.querySelector('[data-content="dashboard"]');
        if (dashboardTab && dashboardTab.classList.contains('active')) {
            clearTimeout(window.dashboardUpdateTimeout);
            window.dashboardUpdateTimeout = setTimeout(() => {
                if (window.carbonCalc && window.carbonCalc.calculateAllTotals) {
                    window.carbonCalc.calculateAllTotals();
                }
                updateDashboard();
            }, 200);
        }
    }
});

// ============================================
// INITIALIZE ON LOAD
// ============================================

window.addEventListener('DOMContentLoaded', function() {
    // Initial dashboard update after a delay
    setTimeout(() => {
        const dashboardTab = document.querySelector('[data-content="dashboard"]');
        if (dashboardTab && dashboardTab.classList.contains('active')) {
            updateDashboard();
        }
    }, 1000);
});

// Re-render charts on window resize
window.addEventListener('resize', function() {
    clearTimeout(window.chartResizeTimeout);
    window.chartResizeTimeout = setTimeout(() => {
        if (pieChart) updatePieChart();
        if (barChart) updateBarChart();
        if (lineChart) updateLineChart();
    }, 300);
});

// ============================================
// BANK RECONCILIATION CHART - Last 29 Days
// ============================================

function updateBankReconciliationChart() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.financials) {
        return;
    }
    
    // Get last 29 transactions (cash in + cash out combined)
    const allTransactions = [];
    
    if (site.cashTransactions) {
        if (site.cashTransactions.cashIn) {
            site.cashTransactions.cashIn.forEach(trans => {
                allTransactions.push({
                    id: trans.id,
                    date: trans.date || trans.timestamp,
                    type: 'cashIn',
                    amount: trans.amount || 0,
                    description: trans.description || ''
                });
            });
        }
        if (site.cashTransactions.cashOut) {
            site.cashTransactions.cashOut.forEach(trans => {
                allTransactions.push({
                    id: trans.id,
                    date: trans.date || trans.timestamp,
                    type: 'cashOut',
                    amount: trans.amount || 0,
                    description: trans.description || ''
                });
            });
        }
    }
    
    // Sort by date (oldest first for chronological display)
    allTransactions.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB; // Ascending (oldest first)
    });
    
    // Get last 29 transactions (most recent 29)
    const last29Transactions = allTransactions.slice(-29);
    
    // Initialize arrays
    const days = [];
    const bankBalance = [];
    const cashIn = [];
    const cashOut = [];
    
    // Calculate starting balance (current balance minus all transactions)
    let startingBalance = site.financials.bankBalance || 0;
    last29Transactions.forEach(trans => {
        if (trans.type === 'cashIn') {
            startingBalance -= trans.amount;
        } else {
            startingBalance += trans.amount;
        }
    });
    
    // Build chart data
    let currentBalance = startingBalance;
    if (last29Transactions.length > 0) {
        last29Transactions.forEach(trans => {
            const transDate = new Date(trans.date);
            days.push(transDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            if (trans.type === 'cashIn') {
                cashIn.push(trans.amount);
                cashOut.push(0);
                currentBalance += trans.amount;
            } else {
                cashIn.push(0);
                cashOut.push(trans.amount);
                currentBalance -= trans.amount;
            }
            bankBalance.push(currentBalance);
        });
    } else {
        // No transactions yet - show current balance only
        days.push(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        bankBalance.push(site.financials.bankBalance || 0);
        cashIn.push(0);
        cashOut.push(0);
    }
    
    const ctx = document.getElementById('bankReconChart');
    if (!ctx) return;
    
    if (bankReconChart) {
        bankReconChart.destroy();
    }
    
    bankReconChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: appState.currentLanguage === 'en' ? 'Bank Balance' : 'Saldo Bancário',
                    data: bankBalance,
                    borderColor: '#13B5EA',
                    backgroundColor: 'rgba(19, 181, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: appState.currentLanguage === 'en' ? 'Cash In' : 'Entrada',
                    data: cashIn,
                    borderColor: '#28A745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: appState.currentLanguage === 'en' ? 'Cash Out' : 'Saída',
                    data: cashOut,
                    borderColor: '#DC3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
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
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    ticks: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
                x: {
                    ticks: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: appState.darkMode ? '#3A3F47' : '#DEE2E6'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D'
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

// ============================================
// CASH FLOW CHART
// ============================================

function updateCashFlowChart() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.financials) {
        return;
    }
    
    const ctx = document.getElementById('cashFlowChart');
    if (!ctx) return;
    
    if (accountFlowChart) {
        accountFlowChart.destroy();
    }
    
    accountFlowChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                appState.currentLanguage === 'en' ? 'Cash In' : 'Entrada',
                appState.currentLanguage === 'en' ? 'Cash Out' : 'Saída'
            ],
            datasets: [{
                data: [
                    site.financials.cashIn || 0,
                    site.financials.cashOut || 0
                ],
                backgroundColor: ['#28A745', '#DC3545'],
                borderWidth: 2,
                borderColor: appState.darkMode ? '#1E1E1E' : '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: appState.darkMode ? '#9AA0A6' : '#6C757D',
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = '$' + context.parsed.toFixed(2);
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return label + ': ' + value + ' (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// ACCOUNT SUMMARY CHART
// ============================================

function updateAccountSummaryChart() {
    const site = appState.sites[appState.currentSite];
    if (!site || !site.financials) {
        return;
    }
    
    const ctx = document.getElementById('accountSummaryChart');
    if (!ctx) return;
    
    const data = [
        site.financials.bankBalance || 0,
        site.financials.savingsBalance || 0,
        site.financials.invoicesOwed || 0,
        site.financials.billsToPay || 0
    ];
    
    const labels = [
        appState.currentLanguage === 'en' ? 'Bank' : 'Banco',
        appState.currentLanguage === 'en' ? 'Savings' : 'Poupança',
        appState.currentLanguage === 'en' ? 'Invoices' : 'Faturas',
        appState.currentLanguage === 'en' ? 'Bills' : 'Contas'
    ];
    
    if (accountSummaryChart) {
        accountSummaryChart.destroy();
    }
    
    accountSummaryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: appState.currentLanguage === 'en' ? 'Amount ($)' : 'Valor ($)',
                data: data,
                backgroundColor: ['#13B5EA', '#28A745', '#FFC107', '#DC3545'],
                borderRadius: 8
            }]
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
}

// Export function
window.updateDashboard = updateDashboard;
window.updateBankReconciliationChart = updateBankReconciliationChart;
window.updateCashFlowChart = updateCashFlowChart;
window.updateAccountSummaryChart = updateAccountSummaryChart;


