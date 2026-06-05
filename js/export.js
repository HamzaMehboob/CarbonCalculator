// ============================================
// CARBON CALCULATOR - EXPORT FUNCTIONS
// PDF and Excel Export
// ============================================

// ============================================
// EXPORT TO PDF (Dashboard — v1.1 statement layout)
// ============================================

const _PERF_TABLE_ROWS = [
    { scope: '1', label: 'Natural gas used for company facilities', key: 'natural_gas' },
    { scope: '2', label: 'Electricity used for company facilities', key: 'electricity' },
    { scope: '3', label: 'Electricity (transmission and distribution)', key: 'electricity_td' },
    { scope: '', label: 'Water use', key: 'water' },
    { scope: '', label: 'Wastewater', key: 'wastewater' },
    { scope: '', label: 'Waste (to energy)', key: 'waste_to_energy' },
    { scope: '', label: 'Waste (to recycling)', key: 'waste_to_recycling' },
];

function _chartImageFromCanvas(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    if (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
        const inst = Chart.getChart(el);
        if (inst && typeof inst.toBase64Image === 'function') {
            return inst.toBase64Image('image/png', 1);
        }
    }
    try {
        return el.toDataURL('image/png');
    } catch (_e) {
        return null;
    }
}

function _buildScopeDoughnutImage(scope1Kg, scope2Kg, scope3Kg) {
    const s1 = Number(scope1Kg) || 0;
    const s2 = Number(scope2Kg) || 0;
    const s3 = Number(scope3Kg) || 0;
    if (s1 + s2 + s3 <= 0 || typeof Chart === 'undefined') return null;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;height:320px;pointer-events:none;opacity:0';
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 320;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);

    const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Scope 1', 'Scope 2', 'Scope 3'],
            datasets: [{
                data: [s1, s2, s3],
                backgroundColor: ['#DC3545', '#FFC107', '#0EA5E9'],
            }],
        },
        options: {
            animation: false,
            responsive: false,
            plugins: { legend: { position: 'bottom' } },
        },
    });
    const img = chart.toBase64Image('image/png', 1);
    chart.destroy();
    wrap.remove();
    return img;
}

function _pdfAddChartImage(doc, dataUrl, x, y, w, h) {
    if (!dataUrl) return false;
    try {
        const base64 = dataUrl.split(',')[1];
        doc.addImage(base64, 'PNG', x, y, w, h);
        return true;
    } catch (_e) {
        return false;
    }
}

function _pdfDrawLabelValue(doc, label, value, x, y, maxWidth) {
    doc.setFont(undefined, 'bold');
    doc.text(String(label), x, y);
    doc.setFont(undefined, 'normal');
    const lines = doc.splitTextToSize(String(value || ''), maxWidth || 120);
    doc.text(lines, x + 62, y);
    return y + Math.max(6, lines.length * 5);
}

function _getPerfRowDisplay(key, perfRows, perfValues) {
    const emissionsKeyMap = {
        natural_gas: 'natural_gas_emissions_kg',
        electricity: 'electricity_emissions_kg',
        electricity_td: 'td_emissions_kg',
        water: 'water_emissions_kg',
        wastewater: 'wastewater_emissions_kg',
        waste_to_energy: 'waste_to_energy_kg',
        waste_to_recycling: 'waste_to_recycling_kg',
    };
    const usageKeyMap = {
        electricity_td: 'td_usage',
        waste_to_energy: 'waste_to_energy_usage',
        waste_to_recycling: 'waste_to_recycling_usage',
    };
    const factorKeyMap = {
        electricity_td: 'td_factor',
        waste_to_energy: 'waste_to_energy_factor',
        waste_to_recycling: 'waste_to_recycling_factor',
    };
    const rowData = perfRows[key] && typeof perfRows[key] === 'object' ? perfRows[key] : {};
    const usage = rowData.usage || perfValues[usageKeyMap[key] || `${key}_usage`] || '';
    const factor = rowData.factor || perfValues[factorKeyMap[key] || `${key}_factor`] || '';
    let emissionsDisp;
    if (rowData.emissions_kg == null) {
        emissionsDisp = perfValues[emissionsKeyMap[key] || `${key}_emissions_kg`] || '0.00';
    } else {
        emissionsDisp = _formatKgReport(rowData.emissions_kg);
    }
    let scopeDisp;
    if (rowData.scope_kg == null) {
        scopeDisp = key === 'natural_gas'
            ? perfValues.natural_gas_scope_kg
            : key === 'electricity'
              ? perfValues.electricity_scope_kg
              : emissionsDisp;
    } else {
        scopeDisp = _formatKgReport(rowData.scope_kg);
    }
    return { usage: String(usage || ''), factor: String(factor || ''), emissionsDisp, scopeDisp };
}

const _PDF_TABLE_HEAD_FILL = [19, 181, 234];

function _pdfHasAutoTable(doc) {
    return typeof doc.autoTable === 'function';
}

function _pdfStatementTitle(doc, y) {
    _addLogo(doc);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Carbon Emissions', 105, y, { align: 'center' });
    doc.text('Statement', 105, y + 10, { align: 'center' });
    return y + 22;
}

function _pdfDrawReportDetailPage(doc, payload) {
    let y = _pdfStatementTitle(doc, 28);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Report Detail', 14, y + 8);

    const body = [
        ['Project Number', String(payload.project_number || '')],
        ['Reporting Period', String(payload.reporting_period || '')],
        ['Registered / head office address', String(payload.org_registered_address || '')],
    ];

    if (_pdfHasAutoTable(doc)) {
        doc.autoTable({
            startY: y + 12,
            margin: { left: 14, right: 14 },
            head: [['Field', 'Value']],
            body,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3, lineColor: [180, 180, 180], lineWidth: 0.2 },
            headStyles: { fillColor: _PDF_TABLE_HEAD_FILL, textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 62, fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
            },
        });
    } else {
        let rowY = y + 18;
        body.forEach(([label, value]) => {
            rowY = _pdfDrawLabelValue(doc, label, value, 14, rowY, 120);
        });
    }
}

function _pdfDrawDocumentControlPage(doc, payload) {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Document Control', 14, 24);

    const body = [[
        payload.version ? `Version ${payload.version}` : '',
        String(payload.issue_date || ''),
    ]];

    if (_pdfHasAutoTable(doc)) {
        doc.autoTable({
            startY: 30,
            margin: { left: 14, right: 14 },
            head: [['Report version', 'Issue Date']],
            body,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 4, lineColor: [180, 180, 180], lineWidth: 0.2 },
            headStyles: { fillColor: _PDF_TABLE_HEAD_FILL, textColor: 255, fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 'auto' } },
        });
    } else {
        doc.setFontSize(10);
        doc.text(`Version ${payload.version || '1.0'}`, 14, 40);
        doc.text(String(payload.issue_date || ''), 110, 40);
    }
}

function _pdfDrawPerformanceTable(doc, payload, grandTotalKg) {
    const perfValues = _performanceValuesFromPayload(payload);
    const perfRows = payload.performance_rows || {};
    const factorYear = String(payload.reporting_year || '2024');
    const headers = [
        'Scope',
        'Carbon Emission Source',
        'Usage Data',
        `Conversion Factor ${factorYear}`,
        'Carbon Emissions (kg CO2e)',
        'Carbon Emissions by Scope (kg CO2e)',
    ];
    const body = _PERF_TABLE_ROWS.map(({ scope, label, key }) => {
        const d = _getPerfRowDisplay(key, perfRows, perfValues);
        return [scope, label, d.usage, d.factor, d.emissionsDisp, d.scopeDisp];
    });
    body.push(['', 'Total gross CO2 emissions (kg CO2e)', '', '', _formatKgReport(grandTotalKg), '']);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Performance', 14, 16);

    if (_pdfHasAutoTable(doc)) {
        doc.autoTable({
            startY: 22,
            margin: { left: 8, right: 8 },
            head: [headers],
            body,
            theme: 'grid',
            styles: {
                fontSize: 7.5,
                cellPadding: 2,
                overflow: 'linebreak',
                lineColor: [160, 160, 160],
                lineWidth: 0.15,
                valign: 'middle',
            },
            headStyles: {
                fillColor: _PDF_TABLE_HEAD_FILL,
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center',
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 58 },
                2: { cellWidth: 28, halign: 'right' },
                3: { cellWidth: 34, halign: 'right' },
                4: { cellWidth: 32, halign: 'right' },
                5: { cellWidth: 32, halign: 'right' },
            },
            didParseCell(data) {
                if (data.section === 'body' && data.row.index === body.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [245, 245, 245];
                }
            },
        });
        return;
    }

    const colWidths = [12, 52, 32, 38, 38, 38];
    let y = 22;
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    let x = 10;
    headers.forEach((h, i) => {
        const lines = doc.splitTextToSize(h, colWidths[i] - 1);
        doc.text(lines, x, y);
        x += colWidths[i];
    });
    y += 10;
    doc.setFont(undefined, 'normal');
    body.forEach((row) => {
        if (y > 190) return;
        x = 10;
        let rowHeight = 6;
        row.forEach((cell, i) => {
            const lines = doc.splitTextToSize(String(cell || ''), colWidths[i] - 1);
            doc.text(lines, x, y);
            rowHeight = Math.max(rowHeight, lines.length * 4.5);
            x += colWidths[i];
        });
        y += rowHeight + 2;
    });
}

function _pdfDrawCategoryBars(doc, totals, x, y, barMaxWidth) {
    const entries = Object.entries(totals || {})
        .map(([key, val]) => ({ key, val: Number(val) || 0 }))
        .filter((e) => e.val > 0)
        .sort((a, b) => b.val - a.val);
    const max = entries.length ? Math.max(...entries.map((e) => e.val)) : 1;
    doc.setFontSize(9);
    entries.forEach((entry, i) => {
        const rowY = y + i * 9;
        const label = _categoryLabel(entry.key).slice(0, 28);
        doc.text(label, x, rowY);
        const barW = (entry.val / max) * barMaxWidth;
        doc.setFillColor(14, 165, 233);
        doc.rect(x + 58, rowY - 4, barW, 5, 'F');
        doc.text(`${entry.val.toFixed(3)} tCO2e`, x + 58 + barW + 2, rowY);
    });
    return y + entries.length * 9 + 4;
}

async function exportDashboardReportPDF() {
    if (!_ensureCarbonCalc()) return;
    if (!window.jspdf) {
        alert('PDF export library is loading. Please wait a moment and try again.');
        return;
    }

    if (window.carbonCalc.calculateAllTotals) {
        window.carbonCalc.calculateAllTotals();
    }
    if (typeof window.updateDashboard === 'function') {
        window.updateDashboard();
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    const payload = _buildFinalReportPayload();
    const scopeKg = payload.scope_kg || {};
    const scope1 = Number(scopeKg.scope1) || 0;
    const scope2 = Number(scopeKg.scope2) || 0;
    const scope3 = Number(scopeKg.scope3) || 0;
    const totalScope = scope1 + scope2 + scope3;
    const totals = window.carbonCalc.getCategoryTotals();
    const grandTotalKg = Object.values(totals).reduce((a, b) => a + (Number(b) || 0), 0) * 1000;
    const companyName = _getCompanyNameForExport();

    const chartSnaps =
        typeof window.buildDashboardChartSnapshotsForExport === 'function'
            ? window.buildDashboardChartSnapshotsForExport()
            : typeof window.getDashboardChartExportSnapshots === 'function'
              ? window.getDashboardChartExportSnapshots()
              : {};

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    _pdfDrawReportDetailPage(doc, payload);

    doc.addPage();
    _pdfDrawDocumentControlPage(doc, payload);

    doc.addPage('a4', 'landscape');
    _pdfDrawPerformanceTable(doc, payload, grandTotalKg);

    doc.addPage('a4', 'portrait');
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL EMISSIONS', 105, 24, { align: 'center' });
    doc.setFontSize(18);
    doc.text(`${_formatKgReport(grandTotalKg)} KgCO2e`, 105, 36, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Emissions by Category', 14, 52);
    if (chartSnaps.pieChart) {
        _pdfAddChartImage(doc, chartSnaps.pieChart, 14, 58, 182, 100);
    } else {
        _pdfDrawCategoryBars(doc, totals, 14, 62, 110);
    }

    doc.addPage();
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Emissions by Scope', 14, 20);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.text(`Scope 1: ${_formatScopePctReport(scope1, totalScope)}`, 18, 30);
    doc.text(`Scope 2: ${_formatScopePctReport(scope2, totalScope)}`, 18, 38);
    doc.text(`Scope 3: ${_formatScopePctReport(scope3, totalScope)}`, 18, 46);
    const scopeImg = chartSnaps.scopeChart || _buildScopeDoughnutImage(scope1, scope2, scope3);
    if (scopeImg) {
        _pdfAddChartImage(doc, scopeImg, 14, 52, 90, 68);
    }
    doc.setFont(undefined, 'bold');
    doc.text('Year-over-Year comparison', 14, 128);
    doc.setFont(undefined, 'normal');
    if (chartSnaps.barChart) {
        _pdfAddChartImage(doc, chartSnaps.barChart, 14, 134, 182, 88);
    }

    doc.addPage();
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Monthly Emissions Trend (Total)', 14, 20);
    doc.setFont(undefined, 'normal');
    if (chartSnaps.lineChart) {
        _pdfAddChartImage(doc, chartSnaps.lineChart, 14, 26, 182, 100);
    }

    doc.addPage();
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Monthly Trend by Source (All)', 14, 20);
    doc.setFont(undefined, 'normal');
    if (chartSnaps.sourceTrendChart) {
        _pdfAddChartImage(doc, chartSnaps.sourceTrendChart, 14, 26, 182, 100);
    }

    const byCat = chartSnaps.sourceTrendByCategory || {};
    Object.keys(byCat).forEach((catKey) => {
        doc.addPage();
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Monthly Emissions Trend — ${_categoryLabel(catKey)}`, 14, 20);
        doc.setFont(undefined, 'normal');
        _pdfAddChartImage(doc, byCat[catKey], 14, 26, 182, 100);
    });

    const fileName = `Carbon_Emission_Statement_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    _pdfSaveDocument(doc, fileName);

    showNotification(
        _exportSuccessMessage(
            'Dashboard report exported as PDF successfully!',
            'Relatorio do painel exportado em PDF com sucesso!'
        ),
        'success'
    );
}

async function exportToPDF() {
    try {
        await exportDashboardReportPDF();
    } catch (err) {
        console.error('Dashboard PDF export error:', err);
        alert('Error exporting PDF: ' + (err?.message || err));
    }
}

// ============================================
// EXPORT TO EXCEL
// ============================================

function exportToExcel() {
    const accountsTab = document.querySelector('.tab-content[data-content="accounts"]');
    if (accountsTab?.classList.contains('active')) {
        exportAccountsToExcel();
        return;
    }

    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined' || !XLSX.utils) {
        alert('Excel export library is loading. Please wait a moment and try again.');
        return;
    }
    if (!_ensureCarbonCalc()) return;

    try {
        if (window.carbonCalc.calculateAllTotals) {
            window.carbonCalc.calculateAllTotals();
        }

        const wb = XLSX.utils.book_new();
    
    // Get company info
    const companyName = _getCompanyNameForExport();
    const companyNotes = document.getElementById('companyNotes')?.value || '';

    // Get financial KPIs (same helper as PDF, local copy)
    const getNumericFromElement = (id) => {
        let el = document.getElementById(id);
        if (!el) {
            el = document.getElementById(id + 'Accounts');
        }
        if (!el || !el.textContent) return 0;
        const text = el.textContent.replace(/[^0-9.\-]/g, '');
        const val = parseFloat(text);
        return isNaN(val) ? 0 : val;
    };

    const financials = {
        bankBalance: getNumericFromElement('bankBalance'),
        savingsBalance: getNumericFromElement('savingsBalance'),
        cashIn: getNumericFromElement('cashIn'),
        cashOut: getNumericFromElement('cashOut'),
        invoicesOwed: getNumericFromElement('invoicesOwed'),
        billsToPay: getNumericFromElement('billsToPay')
    };
    
    // Summary Sheet
    const summaryData = [
        ['Carbon Emissions Report'],
        ['Company:', companyName],
        ['Date:', new Date().toLocaleDateString()],
        ['Country:', window.carbonCalc.getCountry()],
        ['Notes:', companyNotes],
        [],
        ['Category', 'Emissions (tCO₂e)', 'Percentage']
    ];
    
    const totals = window.carbonCalc.getCategoryTotals();
    const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
    
    Object.entries(totals).forEach(([category, value]) => {
        const percentage = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(2) : 0;
        summaryData.push([
            _categoryLabel(category),
            value.toFixed(3),
            percentage + '%'
        ]);
    });
    
    summaryData.push([]);
    summaryData.push(['TOTAL', grandTotal.toFixed(3), '100%']);

    // Financial Summary section in Summary sheet
    summaryData.push([]);
    summaryData.push(['Financial Summary (Accounts)']);
    summaryData.push(['Metric', 'Value (USD)']);
    summaryData.push(['Business Bank Account', financials.bankBalance.toFixed(2)]);
    summaryData.push(['Business Savings', financials.savingsBalance.toFixed(2)]);
    summaryData.push(['Total Cash In', financials.cashIn.toFixed(2)]);
    summaryData.push(['Total Cash Out', financials.cashOut.toFixed(2)]);
    summaryData.push(['Invoices Owed to You', financials.invoicesOwed.toFixed(2)]);
    summaryData.push(['Bills to Pay', financials.billsToPay.toFixed(2)]);
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // Export each category as a separate sheet
    const categories = _getExportCategories();
    
    categories.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const sheetData = exportTableToArray(table, category);
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            const sheetName = _excelSheetName(category);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
    });
    
    // Monthly Summary Sheet
    const monthlyData = window.carbonCalc.getMonthlyTotals();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const monthlySheetData = [
        ['Monthly Emissions Summary'],
        [],
        ['Month', 'Emissions (tCO₂e)']
    ];
    
    monthNames.forEach((month, index) => {
        monthlySheetData.push([month, monthlyData[index].toFixed(3)]);
    });
    
    const monthlyWs = XLSX.utils.aoa_to_sheet(monthlySheetData);
    XLSX.utils.book_append_sheet(wb, monthlyWs, 'Monthly Summary');
    
    // Year Comparison Sheet
    const yearComparison = window.carbonCalc.getYearComparison();
    const yearSheetData = [
        ['Year-over-Year Comparison'],
        [],
        ['Year', 'Emissions (tCO₂e)']
    ];
    
    Object.entries(yearComparison).forEach(([year, value]) => {
        yearSheetData.push([year, value.toFixed(3)]);
    });
    
    const yearWs = XLSX.utils.aoa_to_sheet(yearSheetData);
    XLSX.utils.book_append_sheet(wb, yearWs, 'Year Comparison');
    
    // Save Excel file
    const fileName = `Carbon_Report_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    _downloadExcelWorkbook(wb, fileName);
    
    // Show success message
    const lang = window.appState?.currentLanguage === 'pt' ? 'pt' : 'en';
    showNotification(
        lang === 'en'
            ? 'Excel exported successfully!'
            : 'Excel exportado com sucesso!',
        'success'
    );
    } catch (error) {
        console.error('Excel Export Error:', error);
        _exportErrorAlert('Error exporting Excel', error);
    }
}

function _getActiveSiteForExport() {
    if (!window.appState?.sites) return null;
    const idx = window.appState.currentSite;
    return window.appState.sites[idx] || null;
}

function _getAccountsFinancialsForExport() {
    const site = _getActiveSiteForExport();
    const f = site?.financials || {};
    return {
        bankBalance: Number(f.bankBalance) || 0,
        savingsBalance: Number(f.savingsBalance) || 0,
        cashIn: Number(f.cashIn) || 0,
        cashOut: Number(f.cashOut) || 0,
        invoicesOwed: Number(f.invoicesOwed) || 0,
        billsToPay: Number(f.billsToPay) || 0,
    };
}

function _monthLabelFromIndex(monthIndex) {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = Number(monthIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx > 11) return '';
    return names[idx];
}

function exportAccountsToExcel() {
    if (typeof XLSX === 'undefined' || !XLSX.utils) {
        alert('Excel export library is loading. Please wait a moment and try again.');
        return;
    }

    try {
        const site = _getActiveSiteForExport();
        const companyName = _getCompanyNameForExport();
        const financials = _getAccountsFinancialsForExport();
        const wb = XLSX.utils.book_new();

        const summaryData = [
            ['Accounts Report'],
            ['Company:', companyName],
            ['Site:', site?.name || 'Site'],
            ['Date:', new Date().toLocaleDateString()],
            [],
            ['Financial Summary'],
            ['Metric', 'Value (USD)'],
            ['Business Bank Account', financials.bankBalance.toFixed(2)],
            ['Business Savings', financials.savingsBalance.toFixed(2)],
            ['Total Cash In', financials.cashIn.toFixed(2)],
            ['Total Cash Out', financials.cashOut.toFixed(2)],
            ['Invoices Owed to You', financials.invoicesOwed.toFixed(2)],
            ['Bills to Pay', financials.billsToPay.toFixed(2)],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

        const cashInRows = [['Cash In Transactions'], [], ['Date', 'Description', 'Amount (USD)']];
        (site?.cashTransactions?.cashIn || []).forEach((tx) => {
            cashInRows.push([
                tx.date || '',
                tx.description || '',
                Number(tx.amount || 0).toFixed(2),
            ]);
        });
        if (cashInRows.length === 3) {
            cashInRows.push(['', 'No cash-in transactions recorded', '0.00']);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cashInRows), 'Cash In');

        const cashOutRows = [['Cash Out Transactions'], [], ['Date', 'Description', 'Amount (USD)']];
        (site?.cashTransactions?.cashOut || []).forEach((tx) => {
            cashOutRows.push([
                tx.date || '',
                tx.description || '',
                Number(tx.amount || 0).toFixed(2),
            ]);
        });
        if (cashOutRows.length === 3) {
            cashOutRows.push(['', 'No cash-out transactions recorded', '0.00']);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cashOutRows), 'Cash Out');

        const invoiceRows = [['Invoices'], [], ['Status', 'Amount (USD)', 'Month', 'Year']];
        (site?.invoices || []).forEach((inv) => {
            invoiceRows.push([
                inv.status || '',
                Number(inv.amount || 0).toFixed(2),
                _monthLabelFromIndex(inv.month) || String(inv.month ?? ''),
                String(inv.year ?? ''),
            ]);
        });
        if (invoiceRows.length === 3) {
            invoiceRows.push(['', '0.00', '', '']);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invoiceRows), 'Invoices');

        const billRows = [['Bills'], [], ['Name', 'Category', 'Status', 'Due Date', 'Amount (USD)']];
        (site?.bills || []).forEach((bill) => {
            billRows.push([
                bill.name || '',
                bill.category || '',
                bill.status || '',
                bill.dueDate || '',
                Number(bill.amount || 0).toFixed(2),
            ]);
        });
        if (billRows.length === 3) {
            billRows.push(['', '', '', '', '0.00']);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(billRows), 'Bills');

        const fileName = `Accounts_Report_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        _downloadExcelWorkbook(wb, fileName);

        const lang = window.appState?.currentLanguage === 'pt' ? 'pt' : 'en';
        showNotification(
            lang === 'en'
                ? 'Accounts Excel exported successfully!'
                : 'Excel de contas exportado com sucesso!',
            'success'
        );
    } catch (error) {
        console.error('Accounts Excel Export Error:', error);
        _exportErrorAlert('Error exporting accounts Excel', error);
    }
}

// ============================================
// FACTOR DATABASE IMPORT / EXPORT (FRONTEND)
// ============================================

function exportFactorsToExcel() {
    if (typeof XLSX === 'undefined' || !XLSX.utils) {
        alert('Excel export library is loading. Please wait a moment and try again.');
        return;
    }
    if (!window.carbonCalc || !window.carbonCalc.getConversionFactors || !window.carbonCalc.getCountry) {
        alert('Conversion factors are not available in the frontend.');
        return;
    }

    try {
        const countryKey = window.carbonCalc.getCountry();
        const factorsDb = window.carbonCalc.getConversionFactors();
        const countryBucket = factorsDb[countryKey];

        if (!countryBucket || typeof countryBucket !== 'object') {
            alert('No factors found for the selected database: ' + countryKey);
            return;
        }

        let yearKeys = _getFactorCatalogYears(countryKey);
        if (yearKeys.length === 0) {
            const reportingYear = window.carbonCalc.getReportingYear?.();
            yearKeys = [reportingYear || new Date().getFullYear()];
        }

        const wb = XLSX.utils.book_new();
        let sheetCount = 0;

        yearKeys.forEach((year) => {
            const bucket = window.carbonCalc.getFactorsBucketForYear
                ? window.carbonCalc.getFactorsBucketForYear(year, countryKey)
                : countryBucket[String(year)] || {};
            const rows = _factorBucketToExcelRows(bucket);
            if (!rows.length) return;

            const ws = XLSX.utils.json_to_sheet(rows);
            const sheetName = String(year).substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Factors');
            sheetCount += 1;
        });

        if (sheetCount === 0) {
            alert(
                'No conversion factor values found to export. Check that factors are loaded (log in and open Assessment Scope) and try again.'
            );
            return;
        }

        const fileName = `Conversion_Factors_${countryKey}_${new Date().toISOString().split('T')[0]}.xlsx`;
        _downloadExcelWorkbook(wb, fileName);
    } catch (error) {
        console.error('Factors Excel Export Error:', error);
        _exportErrorAlert('Error exporting factors Excel', error);
    }
}

function importFactorsFromExcel(file, baseName) {
    if (typeof XLSX === 'undefined' || !XLSX.read) {
        alert('Excel library is loading. Please wait a moment and try again.');
        return;
    }
    if (!window.carbonCalc || !window.carbonCalc.setConversionFactors || !window.carbonCalc.getConversionFactors || !window.carbonCalc.getCountry) {
        alert('Conversion factors are not available in the frontend.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const currentDb = window.carbonCalc.getConversionFactors();
            const newDb = { ...currentDb };
            const countryKey = window.carbonCalc.getCountry(); // 'UK' or 'BRAZIL'

            const parsedSheets = [];

            workbook.SheetNames.forEach(sheetName => {
                const ws = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(ws);
                const factors = {};

                json.forEach(row => {
                    const key = (row.Factor || row.factor || '').toString().trim();
                    const raw = row.Value ?? row.value;
                    if (!key || raw === undefined || raw === null) return;
                    const v = parseFloat(raw);
                    if (!isNaN(v)) {
                        factors[key] = v;
                    }
                });

                if (Object.keys(factors).length > 0) {
                    parsedSheets.push({ name: sheetName, factors });
                }
            });

            if (parsedSheets.length === 0) {
                alert('No valid factors found in the uploaded file.');
                return;
            }

            const userName = await showAppPrompt(
                appState.currentLanguage === 'en'
                    ? 'Enter a name for this factors database (e.g. MyDB_2025):'
                    : 'Digite um nome para esta base de fatores (ex: MeuBD_2025):',
                (baseName || '').toString().trim() || ''
            );

            if (!userName || !userName.trim()) {
                alert('Import cancelled: no name provided.');
                return;
            }

            const dbKey = userName.trim().toUpperCase();

            // Merge all sheets into one factor set for this new database
            const mergedFactors = {};
            parsedSheets.forEach(sheet => {
                Object.assign(mergedFactors, sheet.factors);
            });

            newDb[dbKey] = mergedFactors;

            window.carbonCalc.setConversionFactors(newDb);

            // Add to dropdown and select it
            const selectEl = document.getElementById('countrySelect');
            if (selectEl) {
                let option = Array.from(selectEl.options).find(opt => opt.value === dbKey);
                if (!option) {
                    option = document.createElement('option');
                    option.value = dbKey;
                    option.textContent = dbKey;
                    option.setAttribute('data-en', dbKey);
                    option.setAttribute('data-pt', dbKey);
                    selectEl.appendChild(option);
                }
                selectEl.value = dbKey;
                // Trigger change to apply new factors in calculations
                const evt = new Event('change', { bubbles: true });
                selectEl.dispatchEvent(evt);
            }

            showNotification(
                appState.currentLanguage === 'en'
                    ? `✅ Factors database '${dbKey}' imported successfully.`
                    : `✅ Base de fatores '${dbKey}' importada com sucesso.`,
                'success'
            );
            
            // Sync new factors with backend if logged in
            const token = localStorage.getItem('authToken');
            if (token) {
                // Assuming API_BASE_URL is broadly available from app.js
                const apiBase =
                    typeof getApiBaseUrl === 'function'
                        ? getApiBaseUrl()
                        : typeof resolveApiBaseUrl === 'function'
                          ? resolveApiBaseUrl()
                          : 'https://carboncalculator-2eak.onrender.com/api';
                fetch(`${apiBase}/factors`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ country_key: dbKey, factors: mergedFactors })
                }).catch(err => console.error('Error auto-syncing imported factors:', err));
            }
        } catch (err) {
            console.error('Factors Excel Import Error:', err);
            alert('Error importing factors: ' + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

// ============================================
// HELPER: EXPORT TABLE TO ARRAY
// ============================================

function exportTableToArray(table, category) {
    const data = [];
    const headers = [];

    data.push([`${_categoryLabel(category)} Data`]);
    data.push([]);

    const headerCells = table.querySelectorAll('thead th');
    headerCells.forEach((cell) => {
        const text = cell.textContent.trim();
        if (text && !cell.querySelector('button')) headers.push(text);
    });
    data.push(headers);

    table.querySelectorAll('tbody tr.data-row').forEach((row) => {
        const rowData = [];
        row.querySelectorAll('td').forEach((cell, index) => {
            if (cell.querySelector('.btn-delete')) return;

            const select = cell.querySelector('select');
            const input = cell.querySelector('input');
            if (select) {
                const opt = select.options[select.selectedIndex];
                rowData.push(opt ? opt.textContent.trim() : select.value || '');
            } else if (input) {
                rowData.push(input.value ?? '');
            } else {
                const text = cell.textContent.trim();
                if (text && index < headers.length) rowData.push(text);
            }
        });

        if (rowData.length > 0) data.push(rowData);
    });

    return data;
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'success' ? '#28A745' : '#DC3545'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 600;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS animations
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

// ============================================
// EXPORT FUNCTIONS
// ============================================

window.exportToPDF = exportToPDF;
window.exportToExcel = exportToExcel;
window.exportAccountsToExcel = exportAccountsToExcel;
window.exportFactorsToExcel = exportFactorsToExcel;
window.importFactorsFromExcel = importFactorsFromExcel;

// ============================================
// ADDED: Report printing (PDF)
// ============================================

function _getReportLogoDataUrl() {
    // Prefer the uploaded company logo (if any). It is typically stored as a data: URL.
    const logoImg =
        document.getElementById('companyLogoImg') ||
        document.querySelector('img[alt="SQ Impact Logo"]') ||
        document.querySelector('img[src^="data:image"]');

    if (logoImg && logoImg.src && typeof logoImg.src === 'string' && logoImg.src.startsWith('data:image')) {
        return logoImg.src;
    }
    return null;
}

function _addLogo(doc) {
    const dataUrl = _getReportLogoDataUrl();
    if (!dataUrl) return;
    try {
        const base64 = dataUrl.split(',')[1];
        doc.addImage(base64, 'PNG', 15, 8, 18, 18);
    } catch (e) {
        // If the image is not a PNG/base64 that jsPDF can decode, just skip.
    }
}

function _ensurePdfReady() {
    if (!window.jspdf) {
        alert('PDF export library is loading. Please wait a moment and try again.');
        return null;
    }
    return window.jspdf.jsPDF;
}

function _formatKg(num) {
    const n = Number(num) || 0;
    // Keep consistent decimal formatting for tables.
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _getExportCategories() {
    return window.DATA_INPUT_CATEGORIES || [
        'water', 'energy', 'transmissionDistribution', 'waste', 'transport', 'businessTravel', 'freight',
        'staffCommute', 'wfh', 'materials', 'refrigerants',
    ];
}

function _unitForCategory(categoryKey) {
    switch (categoryKey) {
        case 'water': return 'm³';
        case 'energy':
        case 'transmissionDistribution':
            return 'kWh';
        case 'waste': return 'tonnes';
        case 'transport':
        case 'businessTravel':
        case 'staffCommute':
            return 'km';
        case 'freight': return 'tonne-km';
        case 'wfh': return 'days';
        case 'materials':
        case 'refrigerants':
            return 'kg';
        default: return '';
    }
}

function _categoryLabel(categoryKey) {
    const map = {
        water: 'Water',
        energy: 'Energy',
        transmissionDistribution: 'Transmission & distribution',
        waste: 'Waste',
        transport: 'Company fleet',
        businessTravel: 'Business travel',
        freight: 'Freighting goods',
        staffCommute: 'Staff commute',
        wfh: 'Working from home',
        materials: 'Materials',
        refrigerants: 'Refrigerants',
    };
    return map[categoryKey] || categoryKey;
}

function _excelSheetName(categoryKey) {
    return _categoryLabel(categoryKey).replace(/[\\/*?:\[\]]/g, '_').slice(0, 31);
}

function _getCompanyNameForExport() {
    return (
        document.getElementById('companyNameInput')?.value?.trim() ||
        localStorage.getItem('companyName') ||
        'My Company'
    );
}

function _downloadBlob(blob, fileName) {
    if (!blob || (typeof blob.size === 'number' && blob.size === 0)) {
        throw new Error('Generated file is empty.');
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
    }, 3000);
}

/** UI factor key → catalog/backend keys used in factor buckets. */
const _FACTOR_KEY_ALIASES = {
    water: ['water', 'water_supply'],
    wastewater: ['wastewater', 'water_treatment'],
    electricity: ['electricity', 'electricity_grid'],
    naturalGas: ['naturalGas', 'natural_gas'],
    diesel: ['diesel', 'heating_oil'],
};

function _safeCssEscape(value) {
    const s = String(value ?? '');
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(s);
    }
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function _factorValueForReportKey(factors, key) {
    if (!factors || !key) return undefined;
    const candidates = new Set([key]);
    (_FACTOR_KEY_ALIASES[key] || []).forEach((alias) => candidates.add(alias));
    Object.entries(_FACTOR_KEY_ALIASES).forEach(([uiKey, aliases]) => {
        if (aliases.includes(key)) candidates.add(uiKey);
    });
    for (const candidate of candidates) {
        const n = Number(factors[candidate]);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

function _pdfSaveDocument(doc, fileName) {
    const blob = doc.output('blob');
    _downloadBlob(blob, fileName);
}

function _exportErrorAlert(context, err) {
    console.error(context, err);
    const lang = window.appState?.currentLanguage === 'pt' ? 'pt' : 'en';
    const detail = err?.message || String(err || 'Unknown error');
    alert(
        lang === 'en'
            ? `${context}: ${detail}`
            : `${context}: ${detail}`
    );
}

function _downloadExcelWorkbook(wb, fileName) {
    if (typeof XLSX.write === 'function') {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        _downloadBlob(blob, fileName);
        return;
    }
    XLSX.writeFile(wb, fileName);
}

function _exportSuccessMessage(enKey, ptKey) {
    const lang = window.appState?.currentLanguage === 'pt' ? 'pt' : 'en';
    return lang === 'en' ? enKey : ptKey;
}

function _ensureCarbonCalc() {
    if (!window.carbonCalc) {
        alert('Conversion factors are not available in the frontend.');
        return false;
    }
    return true;
}

/** Calendar years present in the loaded conversion-factor catalog for a country. */
function _getFactorCatalogYears(countryKey) {
    const db = window.carbonCalc?.getConversionFactors?.() || {};
    const bucket = db[countryKey] || {};
    return Object.keys(bucket)
        .map((k) => parseInt(k, 10))
        .filter((y) => Number.isFinite(y))
        .sort((a, b) => a - b);
}

/** Flat UI factor bucket → rows for Excel export. */
function _factorBucketToExcelRows(bucket) {
    if (!bucket || typeof bucket !== 'object') return [];
    const rows = [];
    Object.keys(bucket).forEach((key) => {
        if (key === 'factors' || key === 'version' || key === 'source') return;
        const n = Number(bucket[key]);
        if (Number.isFinite(n) && n > 0) {
            rows.push({ Factor: key, Value: n });
        }
    });
    rows.sort((a, b) => String(a.Factor).localeCompare(String(b.Factor)));
    return rows;
}

function printConversionFactorsReportPDF() {
    try {
        const jsPDFCtor = _ensurePdfReady();
        if (!jsPDFCtor) return;
        if (!_ensureCarbonCalc()) return;

        if (window.carbonCalc.rebuildConversionFactorCheckboxes) {
            window.carbonCalc.rebuildConversionFactorCheckboxes();
        }

        const reportYear = window.carbonCalc.getReportingYear?.() || 2025;
        const countryKey = window.carbonCalc.getCountry();
        const factors = window.carbonCalc.getFactorsBucketForYear
            ? window.carbonCalc.getFactorsBucketForYear(reportYear, countryKey)
            : (window.carbonCalc.getConversionFactors()[countryKey] || {})[String(reportYear)] || {};

        let checked = Array.from(document.querySelectorAll('.conversion-factor-checkbox:checked'));
        if (!checked.length) {
            checked = Array.from(document.querySelectorAll('.conversion-factor-checkbox'));
        }
        let keys = checked.map((cb) => cb.dataset.factorKey).filter(Boolean);
        if (!keys.length) {
            keys = Object.keys(factors).filter((k) => {
                if (k === 'factors' || k === 'version' || k === 'source') return false;
                const n = _factorValueForReportKey(factors, k);
                return Number.isFinite(n);
            });
        }
        if (!keys.length) {
            alert('No conversion factors are available. Open Assessment Scope after factors load, then try again.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const companyName = document.getElementById('companyNameInput')?.value || 'My Company';
        const currentDate = new Date().toLocaleDateString();

        let yPos = 18;
        _addLogo(doc);

        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text('Conversion Factors Report', 105, yPos, { align: 'center' });

        yPos += 8;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(`Company: ${companyName}`, 20, yPos);
        doc.text(`Date: ${currentDate}`, 120, yPos);
        yPos += 6;
        doc.text(`Database/Country: ${countryKey}`, 20, yPos);

        const periodLabel = window.carbonCalc.getReportingPeriodLabel?.() || '';
        const catalogYears = _getFactorCatalogYears(countryKey);
        const yearsInUseText =
            catalogYears.length > 0
                ? catalogYears.join(', ')
                : String(reportYear);

        yPos += 6;
        doc.text(`Factor year in use (calculations & this report): ${reportYear}`, 20, yPos);
        if (periodLabel) {
            yPos += 5;
            doc.text(`Reporting period: ${periodLabel}`, 20, yPos);
        }
        yPos += 5;
        const yearsLine = doc.splitTextToSize(
            `Factor years in database (${countryKey}): ${yearsInUseText}`,
            170
        );
        doc.text(yearsLine, 20, yPos);
        yPos += yearsLine.length * 5;
        yPos += 5;
        const noteLine = doc.splitTextToSize(
            `The factor values below are taken from the ${reportYear} dataset. Emissions use this year unless you change the reporting year in Assessment Scope.`,
            170
        );
        doc.text(noteLine, 20, yPos);
        yPos += noteLine.length * 5 + 4;

        const unitByKey = (key) => {
            let inputUnit = '';
            const unitSel = document.querySelector(
                `.conversion-factor-unit[data-factor-key="${_safeCssEscape(key)}"]`
            );
            if (unitSel?.value) {
                inputUnit = unitSel.options[unitSel.selectedIndex]?.textContent || unitSel.value;
            } else if (window.carbonCalc?.getDefaultFactorUnit) {
                inputUnit = window.carbonCalc.getDefaultFactorUnit(key);
            }
            if (inputUnit) return `kg CO2e per ${inputUnit}`;
            if (key === 'water' || key === 'wastewater') return 'kg CO2e per m³';
            if (key === 'electricity' || key === 'naturalGas' || key === 'diesel') return 'kg CO2e per kWh';
            if (key === 'waste' || key === 'wasteRecycled' || key === 'waste_composted') return 'kg CO2e per tonne';
            if (key.startsWith('transport_')) return 'kg CO2e per km';
            if (key.startsWith('flights_')) return 'kg CO2e per passenger-km';
            if (key.startsWith('refrigerant_')) return 'kg CO2e per kg';
            return '';
        };

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const left = 20;
        const colIdxX = left + 2;
        const colKeyX = left + 16;
        const colValX = 110;
        const colUnitX = 160;

        doc.setFillColor(19, 181, 234);
        doc.rect(left, yPos, 180, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Factor', colKeyX + 2, yPos + 4);
        doc.text('Value', colValX + 2, yPos + 4);
        doc.text('Unit', colUnitX + 2, yPos + 4);

        yPos += 10;

        let rowsWritten = 0;
        keys.forEach((k, idx) => {
            const value = _factorValueForReportKey(factors, k);
            if (value === undefined) return;

            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            const unit = unitByKey(k);
            doc.setTextColor(0, 0, 0);
            doc.text(String(rowsWritten + 1).padStart(2, '0'), colIdxX, yPos);
            doc.text(k, colKeyX, yPos);
            doc.text(Number(value).toFixed(6).replace(/\.?0+$/, ''), colValX, yPos);
            if (unit) {
                const wrapped = doc.splitTextToSize(unit, 45);
                doc.text(wrapped, colUnitX, yPos);
            }

            yPos += 6;
            rowsWritten += 1;
        });

        if (rowsWritten === 0) {
            alert('No factor values matched the selected items for the current reporting year.');
            return;
        }

        const fileName = `Conversion_Factors_Used_${countryKey}_${new Date().toISOString().split('T')[0]}.pdf`;
        _pdfSaveDocument(doc, fileName);
    } catch (err) {
        _exportErrorAlert('Error exporting conversion factors report', err);
    }
}

function printInputDataSummaryPDF() {
    try {
    const jsPDFCtor = _ensurePdfReady();
    if (!jsPDFCtor) return;
    if (!_ensureCarbonCalc()) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const companyName = document.getElementById('companyNameInput')?.value || 'My Company';
    const currentDate = new Date().toLocaleDateString();
    const countryKey = window.carbonCalc.getCountry();

    _addLogo(doc);

    let yPos = 20;
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Input Data Summary (Raw)', 105, yPos, { align: 'center' });

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Company: ${companyName}`, 20, yPos);
    doc.text(`Date: ${currentDate}`, 120, yPos);
    yPos += 6;
    doc.text(`Database/Country: ${countryKey}`, 20, yPos);

    yPos += 10;

    const categories = _getExportCategories();

    categories.forEach((catKey, catIdx) => {
        const table = document.getElementById(`${catKey}Table`);
        if (!table) return;

        if (catIdx > 0) yPos += 4;
        if (yPos > 250) { doc.addPage(); yPos = 20; }

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`${_categoryLabel(catKey)} Inputs`, 20, yPos);

        yPos += 7;
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);

        const rows = table.querySelectorAll('.data-row');
        rows.forEach((row, rowIdx) => {
            if (yPos > 270) { doc.addPage(); yPos = 20; }

            const sel = row.querySelector('.emission-select');
            const emissionKey = sel?.value || '';

            const descInput = row.querySelector('input[type="text"]');
            const desc = descInput?.value?.trim() || emissionKey;

            const yearInput = row.querySelector('input[type="number"]:not(.month-input)');
            const year = yearInput?.value || '';

            const totalCell = row.querySelector('.total-cell')?.textContent || '';
            const unit = _unitForCategory(catKey);

            const monthInputs = Array.from(row.querySelectorAll('input.month-input'));
            const months = monthInputs.map(i => Number(i.value) || 0);
            const monthsTotal = months.reduce((a, b) => a + b, 0);

            // Show a compact line: description, year, total, and kg total (if possible)
            const co2Cell = row.querySelector('.co2-cell')?.textContent || '0';
            const co2T = parseFloat(String(co2Cell).replace(/[^\d.-]/g, '')) || 0;
            const kgCO2e = co2T * 1000;

            const line = `${rowIdx + 1}. ${desc} (${year}) | Total: ${monthsTotal.toFixed(2)} ${unit} | Emissions: ${kgCO2e.toFixed(2)} kgCO2e`;
            const wrapped = doc.splitTextToSize(line, 180);
            doc.text(wrapped, 20, yPos);
            yPos += wrapped.length * 4;
        });
    });

    const fileName = `Input_Data_Summary_${countryKey}_${new Date().toISOString().split('T')[0]}.pdf`;
    _pdfSaveDocument(doc, fileName);
    } catch (err) {
        _exportErrorAlert('Error exporting input data summary', err);
    }
}

function _resolveUnitCategoryForExport(catKey) {
    if (typeof window.resolveUnitCategoryForDataTab === 'function') {
        return window.resolveUnitCategoryForDataTab(catKey);
    }
    return catKey;
}

/** Match Input Emissions preview / calculateRowCO2 (kg CO2e). */
function _rowEmissionsKgForExport(row, catKey) {
    if (window.carbonCalc?.calculateRowTotal) {
        window.carbonCalc.calculateRowTotal(row);
    }
    const tonnes = Number(row.dataset.co2Tonnes || 0);
    if (tonnes > 0) {
        return tonnes * 1000;
    }
    const unitCategory = _resolveUnitCategoryForExport(catKey);
    const rowUnit = row.querySelector('.row-unit-select')?.value || '';
    const factor = window.carbonCalc.getRowConversionFactor
        ? window.carbonCalc.getRowConversionFactor(row, `${catKey}Table`)
        : 0;
    let baseTotal = 0;
    if (window.carbonCalc.getRowMonthsByCalendarMonth) {
        const months = window.carbonCalc.getRowMonthsByCalendarMonth(row);
        baseTotal = months.reduce(
            (sum, v) =>
                sum +
                (window.carbonCalc.toBaseUnitValue
                    ? window.carbonCalc.toBaseUnitValue(unitCategory, rowUnit, v)
                    : Number(v) || 0),
            0
        );
    } else if (window.carbonCalc.getInputRowBaseTotal) {
        baseTotal = window.carbonCalc.getInputRowBaseTotal(row, catKey);
    }
    return baseTotal * factor;
}

function _rowMonthlyEmissionsKgForExport(row, catKey) {
    const unitCategory = _resolveUnitCategoryForExport(catKey);
    const rowUnit = row.querySelector('.row-unit-select')?.value || '';
    const factor = window.carbonCalc.getRowConversionFactor
        ? window.carbonCalc.getRowConversionFactor(row, `${catKey}Table`)
        : 0;
    const months = window.carbonCalc.getRowMonthsByCalendarMonth
        ? window.carbonCalc.getRowMonthsByCalendarMonth(row)
        : Array.from(row.querySelectorAll('.month-input')).map((i) => parseFloat(i.value) || 0);
    return months.map((v) => {
        const base = window.carbonCalc.toBaseUnitValue
            ? window.carbonCalc.toBaseUnitValue(unitCategory, rowUnit, v)
            : Number(v) || 0;
        return base * factor;
    });
}

function _collectInputEmissionExportRows() {
    const categories =
        typeof getDataInputCategoryList === 'function'
            ? getDataInputCategoryList()
            : _getExportCategories();
    const rows = [];

    categories.forEach((catKey) => {
        const table = document.getElementById(`${catKey}Table`);
        if (!table) return;

        table.querySelectorAll('.data-row').forEach((row) => {
            if (window.carbonCalc.isFinancialYearAutoAddedRow) {
                const year =
                    window.carbonCalc.getRowYear?.(row) ??
                    parseInt(row.querySelector('.row-display-year')?.value, 10);
                if (window.carbonCalc.isFinancialYearAutoAddedRow(catKey, year)) {
                    return;
                }
            }

            const inputTotal = window.carbonCalc.getInputRowBaseTotal
                ? window.carbonCalc.getInputRowBaseTotal(row, catKey)
                : Array.from(row.querySelectorAll('.month-input')).reduce(
                      (sum, input) => sum + (parseFloat(input.value) || 0),
                      0
                  );
            const kgCO2eTotal = _rowEmissionsKgForExport(row, catKey);

            if (inputTotal <= 0 && kgCO2eTotal <= 0.0005) return;

            const sel = row.querySelector('.emission-select');
            const emissionKey = sel?.value || '';
            const descInput = row.querySelector('input[type="text"]');
            const desc = descInput?.value?.trim() || emissionKey;
            const year =
                window.carbonCalc.getRowYear?.(row) ??
                row.querySelector('.row-display-year')?.value ??
                row.querySelector('input[type="number"]:not(.month-input)')?.value ??
                '';

            rows.push({
                catKey,
                row,
                desc,
                year,
                kgCO2eTotal,
                monthKg: _rowMonthlyEmissionsKgForExport(row, catKey),
            });
        });
    });

    return rows;
}

function printInputEmissionsReportPDF() {
    try {
        const jsPDFCtor = _ensurePdfReady();
        if (!jsPDFCtor) return;
        if (!_ensureCarbonCalc()) return;

        if (window.carbonCalc.syncFinancialYearViewAfterDataLoad) {
            window.carbonCalc.syncFinancialYearViewAfterDataLoad();
        } else if (window.carbonCalc.syncCanonicalCalendarBeforeSave) {
            window.carbonCalc.syncCanonicalCalendarBeforeSave();
        }
        if (window.carbonCalc.calculateAllTotals) {
            window.carbonCalc.calculateAllTotals();
        }

        const exportRows = _collectInputEmissionExportRows();
        if (!exportRows.length) {
            alert(
                'No emissions to export. Enter data in Data Input tabs and ensure conversion factors are loaded, then try again.'
            );
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const companyName = document.getElementById('companyNameInput')?.value || 'My Company';
        const currentDate = new Date().toLocaleDateString();
        const countryKey = window.carbonCalc.getCountry();
        const reportYear = window.carbonCalc.getReportingYear?.() || '';
        const periodLabel = window.carbonCalc.getReportingPeriodLabel?.() || '';

        _addLogo(doc);

        let yPos = 20;
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text('Input Emissions (KgCO2e)', 105, yPos, { align: 'center' });

        yPos += 8;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(`Company: ${companyName}`, 20, yPos);
        doc.text(`Date: ${currentDate}`, 120, yPos);
        yPos += 6;
        doc.text(`Database/Country: ${countryKey}`, 20, yPos);
        if (reportYear) {
            yPos += 5;
            doc.text(`Factor year in use: ${reportYear}`, 20, yPos);
        }
        if (periodLabel) {
            yPos += 5;
            doc.text(`Reporting period: ${periodLabel}`, 20, yPos);
        }

        yPos += 10;

        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let currentCategory = '';
        let rowIdx = 0;

        exportRows.forEach((entry) => {
            if (entry.catKey !== currentCategory) {
                currentCategory = entry.catKey;
                rowIdx = 0;
                if (yPos > 245) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                doc.text(`${_categoryLabel(entry.catKey)} Emissions`, 20, yPos);
                yPos += 7;
                doc.setFontSize(9);
                doc.setTextColor(60, 60, 60);
            }

            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            const headerLine = `${rowIdx + 1}. ${entry.desc} (${entry.year}) | Total: ${entry.kgCO2eTotal.toFixed(2)} kgCO2e`;
            const headerWrapped = doc.splitTextToSize(headerLine, 180);
            doc.text(headerWrapped, 20, yPos);
            yPos += headerWrapped.length * 4;

            const monthLine = monthLabels
                .map((m, i) => `${m}:${(entry.monthKg[i] || 0).toFixed(0)}`)
                .join(' ');
            const monthWrapped = doc.splitTextToSize(monthLine, 180);
            doc.text(monthWrapped, 20, yPos);
            yPos += monthWrapped.length * 4;
            rowIdx += 1;
        });

        const fileName = `Input_Emissions_${countryKey}_${new Date().toISOString().split('T')[0]}.pdf`;
        _pdfSaveDocument(doc, fileName);
    } catch (err) {
        _exportErrorAlert('Error exporting input emissions report', err);
    }
}

// Expose in case HTML inline handlers want the global reference
window.printConversionFactorsReportPDF = printConversionFactorsReportPDF;
window.printInputDataSummaryPDF = printInputDataSummaryPDF;
window.printInputEmissionsReportPDF = printInputEmissionsReportPDF;

function _formatUsageQuantity(total, unit) {
    const n = Number(total);
    if (!Number.isFinite(n) || n <= 0) return '';
    const labels = {
        kwh: 'kWh',
        mwh: 'MWh',
        m3: 'm3',
        million_litres: 'million litres',
        tonnes: 'tonnes',
        kg: 'kg',
        km: 'km',
    };
    const label = labels[unit] || unit || '';
    const display = n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n.toFixed(2);
    return label ? `${display} ${label}` : display;
}

function _formatFactorDisplay(factor, unit) {
    const n = Number(factor);
    if (!Number.isFinite(n) || n <= 0) return '';
    const labels = {
        kwh: 'kWh',
        mwh: 'MWh',
        m3: 'm3',
        million_litres: 'm3',
        tonnes: 'tonne',
        kg: 'kg',
    };
    const u = labels[unit] || unit || '';
    return u ? `${n} kg CO2e / ${u}` : `${n} kg CO2e`;
}

function collectFinalReportPerformanceRows() {
    const rows = {
        natural_gas: { usage: '', factor: '', emissions_kg: 0, scope_kg: 0 },
        electricity: { usage: '', factor: '', emissions_kg: 0, scope_kg: 0 },
        electricity_td: { usage: '', factor: '', emissions_kg: 0, scope_kg: 0 },
        water: { usage: '', factor: '', emissions_kg: 0, scope_kg: 0 },
        wastewater: { usage: '', factor: '', emissions_kg: 0, scope_kg: 0 },
        waste_to_energy: { usage: '', factor: '', emissions_kg: 0, scope_kg: 0 },
        waste_to_recycling: { usage: '', factor: '', emissions_kg: 0, scope_kg: 0 },
    };

    const addTo = (key, usage, unit, factor, emissionsKg, scopeKg) => {
        const slot = rows[key];
        if (!slot) return;
        if (usage > 0) {
            const existing = slot._usageRaw || 0;
            slot._usageRaw = existing + usage;
            slot.usage = _formatUsageQuantity(slot._usageRaw, unit);
        }
        if (factor > 0 && !slot.factor) {
            slot.factor = _formatFactorDisplay(factor, unit);
        }
        slot.emissions_kg = (Number(slot.emissions_kg) || 0) + emissionsKg;
        slot.scope_kg = (Number(slot.scope_kg) || 0) + (scopeKg != null ? scopeKg : emissionsKg);
    };

    const categories =
        typeof getDataInputCategoryList === 'function'
            ? getDataInputCategoryList()
            : window.DATA_INPUT_CATEGORIES || [];

    categories.forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table || !window.carbonCalc?.getRowConversionFactor) return;
        table.querySelectorAll('.data-row').forEach((row) => {
            if (window.carbonCalc.rowIncludedInReportingPeriod && !window.carbonCalc.rowIncludedInReportingPeriod(row)) {
                return;
            }
            const emissionKey = row.querySelector('.emission-select')?.value || '';
            const unit = row.querySelector('.row-unit-select')?.value || '';
            const usage = window.carbonCalc.getInputRowBaseTotal
                ? window.carbonCalc.getInputRowBaseTotal(row, category)
                : 0;
            const factor = window.carbonCalc.getRowConversionFactor(row, `${category}Table`);
            const emissionsKg = usage * factor;
            if (emissionsKg <= 0 && usage <= 0) return;

            let target = 'electricity';
            let scopeKg = emissionsKg;
            if (emissionKey === 'naturalGas') {
                target = 'natural_gas';
            } else if (emissionKey === 'electricity') {
                target = 'electricity';
            } else if (
                emissionKey === 'electricity_transmission_distribution' ||
                emissionKey === 'td_district_heat_steam' ||
                category === 'transmissionDistribution'
            ) {
                target = 'electricity_td';
            } else if (emissionKey === 'water' || (category === 'water' && emissionKey !== 'wastewater')) {
                target = 'water';
            } else if (emissionKey === 'wastewater') {
                target = 'wastewater';
            } else if (emissionKey === 'waste_to_energy') {
                target = 'waste_to_energy';
            } else if (
                emissionKey === 'waste_to_recycling' ||
                emissionKey === 'waste_landfill' ||
                emissionKey === 'waste_to_composting' ||
                emissionKey === 'wasteRecycled' ||
                category === 'waste'
            ) {
                target = emissionKey === 'waste_to_energy' ? 'waste_to_energy' : 'waste_to_recycling';
            } else if (category === 'waste') {
                target = emissionKey.includes('energy') ? 'waste_to_energy' : 'waste_to_recycling';
            } else if (category === 'energy') {
                target = emissionKey === 'naturalGas' ? 'natural_gas' : 'electricity';
            }

            if (emissionKey === 'electricity') scopeKg = emissionsKg;
            if (target === 'electricity_td') {
                scopeKg = emissionsKg;
            }

            addTo(target, usage, unit, factor, emissionsKg, scopeKg);
        });
    });

    Object.values(rows).forEach((slot) => {
        delete slot._usageRaw;
    });
    return rows;
}

const _W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const _CARBON_STATEMENT_BASELINE_NEEDLE =
    'This report is based on the data collected across the 2024/25 financial year.';
const _FINAL_REPORT_TEMPLATE_FALLBACK_URLS = [
    'assets/reports/carbon-emission-statement-template-v1.1.docx',
    'assets/reports/carbon-emission-statement-template.docx',
    'requirements/Carbon%20emmission%20statement%20report%20template_v1.1.docx',
];
const _YELLOW_FIELD_MAP = [
    'natural_gas_scope_kg', 'natural_gas_emissions_kg', 'electricity_usage', 'electricity_factor',
    'electricity_emissions_kg', 'electricity_scope_kg', 'td_usage', 'td_factor', 'td_emissions_kg',
    'water_usage', 'water_factor', 'water_emissions_kg', 'wastewater_usage', 'wastewater_factor',
    'wastewater_emissions_kg', 'waste_to_energy_usage', 'waste_to_energy_factor', 'waste_to_energy_kg',
    'waste_to_recycling_usage', 'waste_to_recycling_factor', 'waste_to_recycling_kg',
];

function _formatKgReport(value) {
    const n = Number(value) || 0;
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _formatScopePctReport(partKg, totalKg) {
    if (totalKg <= 0) return '0.0%';
    return `${((100 * Number(partKg)) / Number(totalKg)).toFixed(1)}%`;
}

function _escapeXmlText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _wLocalName(tag) {
    return tag.includes('}') ? tag.split('}').pop() : tag;
}

function _elementHasYellowHighlight(el) {
    for (const child of el.getElementsByTagName('*')) {
        if (_wLocalName(child.tagName) !== 'highlight') continue;
        const val = child.getAttributeNS(_W_NS, 'val') || child.getAttribute('w:val') || child.getAttribute('val');
        if (val === 'yellow') return true;
    }
    return false;
}

function _yellowHighlightTextNodes(root) {
    const nodes = [];
    for (const el of root.getElementsByTagName('*')) {
        if (_wLocalName(el.tagName) !== 'p') continue;
        if (!_elementHasYellowHighlight(el)) continue;
        for (const t of el.getElementsByTagName('*')) {
            if (_wLocalName(t.tagName) === 't') nodes.push(t);
        }
    }
    return nodes;
}

function _cellTextNodes(tc) {
    return Array.from(tc.getElementsByTagName('*'))
        .filter((n) => _wLocalName(n.tagName) === 't')
        .map((n) => n.textContent || '')
        .join('')
        .trim();
}

function _setCellText(tc, text) {
    while (tc.firstChild) tc.removeChild(tc.firstChild);
    const p = tc.ownerDocument.createElementNS(_W_NS, 'w:p');
    const r = tc.ownerDocument.createElementNS(_W_NS, 'w:r');
    const t = tc.ownerDocument.createElementNS(_W_NS, 'w:t');
    const value = String(text ?? '');
    if (value.startsWith(' ') || value.endsWith(' ')) {
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
    t.textContent = value;
    r.appendChild(t);
    p.appendChild(r);
    tc.appendChild(p);
}

function _performanceValuesFromPayload(payload) {
    const perf = payload.performance_rows && typeof payload.performance_rows === 'object'
        ? payload.performance_rows
        : {};
    const totalsKg = payload.totals_kg || {};
    const scopeKg = payload.scope_kg || {};

    const row = (key) => (perf[key] && typeof perf[key] === 'object' ? perf[key] : {});
    const pickNum = (key, field, fallback = 0) => {
        const raw = row(key)[field];
        const n = Number(raw);
        return Number.isFinite(n) ? n : Number(fallback) || 0;
    };
    const pickStr = (key, field, fallback = '') => {
        const val = row(key)[field];
        return val == null || val === '' ? fallback : String(val);
    };

    const naturalKg = pickNum('natural_gas', 'emissions_kg', (scopeKg.scope1 || 0) * 0.5);
    const electricityKg = pickNum('electricity', 'emissions_kg', (totalsKg.energy || 0) * 0.5);
    const tdKg = pickNum('electricity_td', 'emissions_kg', 0);
    const waterKg = pickNum('water', 'emissions_kg', (totalsKg.water || 0) * 0.5);
    const wastewaterKg = pickNum('wastewater', 'emissions_kg', (totalsKg.water || 0) * 0.5);
    const wasteEnergyKg = pickNum('waste_to_energy', 'emissions_kg', 0);
    const wasteRecyclingKg = pickNum('waste_to_recycling', 'emissions_kg', (totalsKg.waste || 0) * 0.5);

    return {
        natural_gas_scope_kg: _formatKgReport(pickNum('natural_gas', 'scope_kg', naturalKg)),
        natural_gas_emissions_kg: _formatKgReport(naturalKg),
        electricity_usage: pickStr('electricity', 'usage', '0 kWh'),
        electricity_factor: pickStr('electricity', 'factor', ''),
        electricity_emissions_kg: _formatKgReport(electricityKg),
        electricity_scope_kg: _formatKgReport(pickNum('electricity', 'scope_kg', electricityKg)),
        td_usage: pickStr('electricity_td', 'usage', pickStr('electricity', 'usage', '0 kWh')),
        td_factor: pickStr('electricity_td', 'factor', ''),
        td_emissions_kg: _formatKgReport(tdKg),
        water_usage: pickStr('water', 'usage', '0 m3'),
        water_factor: pickStr('water', 'factor', ''),
        water_emissions_kg: _formatKgReport(waterKg),
        wastewater_usage: pickStr('wastewater', 'usage', pickStr('water', 'usage', '0 m3')),
        wastewater_factor: pickStr('wastewater', 'factor', ''),
        wastewater_emissions_kg: _formatKgReport(wastewaterKg),
        waste_to_energy_usage: pickStr('waste_to_energy', 'usage', '0 tonnes'),
        waste_to_energy_factor: pickStr('waste_to_energy', 'factor', ''),
        waste_to_energy_kg: _formatKgReport(wasteEnergyKg),
        waste_to_recycling_usage: pickStr('waste_to_recycling', 'usage', '0 tonnes'),
        waste_to_recycling_factor: pickStr('waste_to_recycling', 'factor', ''),
        waste_to_recycling_kg: _formatKgReport(wasteRecyclingKg),
    };
}

function _applyCarbonStatementTextReplacements(xmlStr, payload, grandTotalKg) {
    const scopeKg = payload.scope_kg || {};
    const scope1 = Number(scopeKg.scope1) || 0;
    const scope2 = Number(scopeKg.scope2) || 0;
    const scope3 = Number(scopeKg.scope3) || 0;
    const totalScope = scope1 + scope2 + scope3;
    const reportingPeriod = String(payload.reporting_period || '').trim();
    const reportingYear = String(payload.reporting_year || '').trim();
    const baseline = String(payload.assessment_base_year || reportingYear || '').trim();

    if (reportingPeriod) {
        xmlStr = xmlStr.replace(
            _CARBON_STATEMENT_BASELINE_NEEDLE,
            _escapeXmlText(`This report is based on the data collected across the ${reportingPeriod} reporting period.`)
        );
    }
    if (baseline) {
        xmlStr = xmlStr.replace('Baseline Year ', `Baseline Year ${_escapeXmlText(baseline)} `);
    }
    if (reportingYear) {
        xmlStr = xmlStr.replace('Conversion Factor 2024', `Conversion Factor ${_escapeXmlText(reportingYear)}`);
    }

    xmlStr = xmlStr.replace('22,436.71', _formatKgReport(grandTotalKg));
    xmlStr = xmlStr.replace('Scope 1: 76.9%', `Scope 1: ${_formatScopePctReport(scope1, totalScope)}`);
    xmlStr = xmlStr.replace('Scope 2: 20.6%', `Scope 2: ${_formatScopePctReport(scope2, totalScope)}`);
    xmlStr = xmlStr.replace('Scope 3: 2.4%', `Scope 3: ${_formatScopePctReport(scope3, totalScope)}`);

    return xmlStr;
}

function _fillCarbonStatementTables(root, payload, grandTotalKg) {
    const tables = Array.from(root.getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tbl');
    if (!tables.length) return;

    const projectNumber = String(payload.project_number || '').trim();
    const reportingPeriod = String(payload.reporting_period || '').trim();
    const orgAddress = String(payload.org_registered_address || '').trim();
    const version = String(payload.version || '1.0').trim();
    const issueDate = String(payload.issue_date || '').trim();

    const detailRows = Array.from(tables[0].getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tr');
    if (detailRows[0]) {
        const cells = Array.from(detailRows[0].getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tc');
        if (cells[1]) _setCellText(cells[1], projectNumber);
    }
    if (detailRows[1]) {
        const cells = Array.from(detailRows[1].getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tc');
        if (cells[1]) _setCellText(cells[1], reportingPeriod);
    }
    if (detailRows[2]) {
        const cells = Array.from(detailRows[2].getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tc');
        if (cells[1]) _setCellText(cells[1], orgAddress);
    }

    if (tables[1]) {
        const control = tables[1];
        const controlRows = Array.from(control.getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tr');
        let valueRow = controlRows.length > 1 ? controlRows[1] : null;
        if (!valueRow) {
            valueRow = control.ownerDocument.createElementNS(_W_NS, 'w:tr');
            control.appendChild(valueRow);
            for (let i = 0; i < 2; i += 1) {
                valueRow.appendChild(control.ownerDocument.createElementNS(_W_NS, 'w:tc'));
            }
        }
        const controlCells = Array.from(valueRow.getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tc');
        if (controlCells[0]) _setCellText(controlCells[0], version ? `Version ${version}` : '');
        if (controlCells[1]) _setCellText(controlCells[1], issueDate);
    }

    const perfValues = _performanceValuesFromPayload(payload);
    const rowLabels = {
        'Natural gas used for company facilities': 'natural_gas',
        'Electricity used for company facilities': 'electricity',
        'Electricity (transmission and distribution)': 'electricity_td',
        'Water use': 'water',
        Wastewater: 'wastewater',
        'Waste (to energy)': 'waste_to_energy',
        'Waste (to recycling)': 'waste_to_recycling',
    };
    const perfRows = payload.performance_rows && typeof payload.performance_rows === 'object'
        ? payload.performance_rows
        : {};

    let perfTable = null;
    for (const tbl of tables) {
        const text = Array.from(tbl.getElementsByTagName('*'))
            .filter((n) => _wLocalName(n.tagName) === 't')
            .map((n) => n.textContent || '')
            .join('');
        if (text.includes('Carbon Emission Source') && text.includes('Usage Data')) {
            perfTable = tbl;
            break;
        }
    }
    if (!perfTable && tables[3]) perfTable = tables[3];
    if (!perfTable) return;

    for (const tr of Array.from(perfTable.getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tr')) {
        const cells = Array.from(tr.getElementsByTagName('*')).filter((n) => _wLocalName(n.tagName) === 'tc');
        if (cells.length < 5) continue;
        const label = _cellTextNodes(cells[1] || cells[0]);
        if (label.includes('Total gross CO2')) {
            _setCellText(cells[cells.length - 1], _formatKgReport(grandTotalKg));
            continue;
        }
        const key = rowLabels[label];
        if (!key) continue;
        const scopeNumbers = { natural_gas: '1', electricity: '2', electricity_td: '3' };
        if (cells[0] && scopeNumbers[key]) _setCellText(cells[0], scopeNumbers[key]);
        const emissionsKeyMap = {
            natural_gas: 'natural_gas_emissions_kg',
            electricity: 'electricity_emissions_kg',
            electricity_td: 'td_emissions_kg',
            water: 'water_emissions_kg',
            wastewater: 'wastewater_emissions_kg',
            waste_to_energy: 'waste_to_energy_kg',
            waste_to_recycling: 'waste_to_recycling_kg',
        };
        const usageKeyMap = {
            electricity_td: 'td_usage',
            waste_to_energy: 'waste_to_energy_usage',
            waste_to_recycling: 'waste_to_recycling_usage',
        };
        const factorKeyMap = {
            electricity_td: 'td_factor',
            waste_to_energy: 'waste_to_energy_factor',
            waste_to_recycling: 'waste_to_recycling_factor',
        };
        const rowData = perfRows[key] && typeof perfRows[key] === 'object' ? perfRows[key] : {};
        const usage = rowData.usage || perfValues[usageKeyMap[key] || `${key}_usage`] || '';
        const factor = rowData.factor || perfValues[factorKeyMap[key] || `${key}_factor`] || '';
        let emissionsDisp;
        if (rowData.emissions_kg == null) {
            emissionsDisp = perfValues[emissionsKeyMap[key] || `${key}_emissions_kg`] || '0.00';
        } else {
            emissionsDisp = _formatKgReport(rowData.emissions_kg);
        }
        let scopeDisp;
        if (rowData.scope_kg == null) {
            scopeDisp = key === 'natural_gas'
                ? perfValues.natural_gas_scope_kg
                : key === 'electricity'
                  ? perfValues.electricity_scope_kg
                  : emissionsDisp;
        } else {
            scopeDisp = _formatKgReport(rowData.scope_kg);
        }
        if (cells[2] && usage) _setCellText(cells[2], String(usage));
        if (cells[3] && factor) _setCellText(cells[3], String(factor));
        if (cells[4]) _setCellText(cells[4], emissionsDisp);
        if (cells[5]) _setCellText(cells[5], scopeDisp);
    }
}

function _applyYellowFieldMap(root, valuesByKey) {
    const nodes = _yellowHighlightTextNodes(root);
    _YELLOW_FIELD_MAP.forEach((fieldName, idx) => {
        if (!fieldName || idx >= nodes.length) return;
        const val = valuesByKey[fieldName];
        if (val == null || val === '') return;
        nodes[idx].textContent = String(val);
    });
}

async function _fetchReportTemplateBytes() {
    const pageBase = String(window.location.href || '').replace(/[#?].*$/, '').replace(/[^/]+$/, '');
    const candidates = [];
    _FINAL_REPORT_TEMPLATE_FALLBACK_URLS.forEach((path) => {
        candidates.push(path);
        if (pageBase && !/^https?:/i.test(path)) {
            candidates.push(pageBase + path);
        }
    });

    let lastError = null;
    for (const url of candidates) {
        try {
            const resp = await fetch(url, { cache: 'no-store' });
            if (!resp.ok) continue;
            const buf = await resp.arrayBuffer();
            if (buf && buf.byteLength > 1000) return buf;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error('Carbon Emission Statement file is not available in this deployment.');
}

async function _buildFinalReportDOCXClientSide(payload) {
    if (typeof JSZip === 'undefined') {
        throw new Error('Report builder library is not loaded.');
    }
    const templateBytes = await _fetchReportTemplateBytes();
    const zip = await JSZip.loadAsync(templateBytes);
    let xmlStr = await zip.file('word/document.xml').async('string');

    const totalsKg = payload.totals_kg || {};
    const grandTotalKg = Number(payload.grand_total_kg) || Object.values(totalsKg).reduce((a, b) => a + Number(b || 0), 0);

    xmlStr = _applyCarbonStatementTextReplacements(xmlStr, payload, grandTotalKg);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length) {
        throw new Error('Could not parse the report document.');
    }
    const root = xmlDoc.documentElement;
    _fillCarbonStatementTables(root, payload, grandTotalKg);
    _applyYellowFieldMap(root, _performanceValuesFromPayload(payload));

    const serialized = new XMLSerializer().serializeToString(root);
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${serialized}`);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

function _buildFinalReportPayload() {
    const orgName =
        document.getElementById('companyNameInput')?.value?.trim() ||
        localStorage.getItem('companyName') ||
        'Organization';
    const activeSiteInput = document.querySelector('.site-item.active .site-name-input');
    const siteName = activeSiteInput?.value?.trim() || 'Site';

    if (window.carbonCalc.calculateAllTotals) {
        window.carbonCalc.calculateAllTotals();
    }

    const categoryTotalsT = window.carbonCalc.getCategoryTotals();
    const scopeT = window.carbonCalc.getScopeBreakdown();
    const totals_kg = {
        water: (categoryTotalsT.water || 0) * 1000,
        energy: (categoryTotalsT.energy || 0) * 1000,
        transmissionDistribution: (categoryTotalsT.transmissionDistribution || 0) * 1000,
        waste: (categoryTotalsT.waste || 0) * 1000,
        transport: (categoryTotalsT.transport || 0) * 1000,
        refrigerants: (categoryTotalsT.refrigerants || 0) * 1000,
    };
    const scope_kg = {
        scope1: (scopeT.scope1 || 0) * 1000,
        scope2: (scopeT.scope2 || 0) * 1000,
        scope3: (scopeT.scope3 || 0) * 1000,
    };

    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const issueDateInput = document.getElementById('issueDateInput');
    const issueDateRaw = issueDateInput?.value || '';
    let issue_date = '';
    if (issueDateRaw && issueDateRaw.includes('-')) {
        const parts = issueDateRaw.split('-');
        if (parts.length === 3) {
            issue_date = `${pad(parseInt(parts[2], 10))}/${pad(parseInt(parts[1], 10))}/${parts[0]}`;
        }
    }
    if (!issue_date) {
        issue_date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    const reportStatusSelect = document.getElementById('reportStatusSelect');
    const reportVersionInput = document.getElementById('reportVersionInput');
    const reportingPeriodInput = document.getElementById('reportingPeriodInput');
    const projectNumberInput = document.getElementById('projectNumberInput');
    const status = reportStatusSelect?.value || 'Final';
    const version = (reportVersionInput?.value || '').toString().trim() || '1.0';
    const reporting_period = (reportingPeriodInput?.value || '').toString().trim();
    const project_number = (projectNumberInput?.value || '').toString().trim();
    const company_logo_data_url = _getReportLogoDataUrl();

    const readPref = (key) =>
        (typeof window.getOrgLocalItem === 'function' ? window.getOrgLocalItem(key, '') : '') ||
        document.getElementById(`${key}Input`)?.value?.trim() ||
        '';

    const payload = {
        organization_name: orgName,
        site_name: siteName,
        issue_date,
        status,
        version,
        reporting_period,
        project_number,
        totals_kg,
        scope_kg,
        grand_total_kg: Object.values(totals_kg).reduce((a, b) => a + b, 0) || 0,
        reporting_year: window.carbonCalc.getReportingYear?.() || '',
        performance_rows: collectFinalReportPerformanceRows(),
    };

    const organization_profile = document.getElementById('organizationProfileInput')?.value?.trim() || '';
    const org_registered_address =
        document.getElementById('orgRegisteredAddressInput')?.value?.trim() ||
        readPref('orgRegisteredAddress');
    if (company_logo_data_url) payload.company_logo_data_url = company_logo_data_url;
    if (organization_profile) payload.organization_profile = organization_profile;
    if (org_registered_address) payload.org_registered_address = org_registered_address;

    const optionalFields = [
        ['scope_streams_summary', readPref('scopeStreamsSummary')],
        ['assessment_period_detail', readPref('assessmentPeriodDetail')],
        ['assessment_general_notes', readPref('assessmentGeneralNotes')],
        ['assessment_extra_note1', document.getElementById('assessmentExtraNote1Input')?.value?.trim() || readPref('assessmentExtraNote1')],
        ['assessment_extra_note2', document.getElementById('assessmentExtraNote2Input')?.value?.trim() || readPref('assessmentExtraNote2')],
        ['buildings_assessed_count', document.getElementById('buildingsAssessedInput')?.value?.trim() || readPref('buildingsAssessedCount')],
        ['assessment_base_year', document.getElementById('assessmentBaseYearInput')?.value?.trim() || readPref('assessmentBaseYear')],
    ];
    optionalFields.forEach(([key, val]) => {
        if (val) payload[key] = val;
    });

    return payload;
}

function _finalReportFileName(orgName) {
    const safeName = String(orgName || 'Organization').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'Organization';
    return `Carbon_Emission_Statement_${safeName}_${new Date().toISOString().split('T')[0]}.docx`;
}

async function _fetchFinalReportFromApi(payload, token) {
    const apiBase =
        typeof getApiBaseUrl === 'function'
            ? getApiBaseUrl()
            : typeof resolveApiBaseUrl === 'function'
              ? resolveApiBaseUrl()
              : 'https://carboncalculator-2eak.onrender.com/api';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${apiBase}/reports/final`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Server returned ${res.status}`);
    }
    const blob = await res.blob();
    let fileName = _finalReportFileName(payload.organization_name);
    const disp = res.headers.get('content-disposition') || '';
    const match = disp.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
    if (match && match[1]) {
        fileName = match[1].replace(/['"]/g, '').trim();
    }
    return { blob, fileName };
}

async function generateFinalReportDOCX() {
    try {
        if (!_ensureCarbonCalc()) return;

        if (window.carbonCalc.calculateAllTotals) {
            window.carbonCalc.calculateAllTotals();
        }

        const payload = _buildFinalReportPayload();
        let downloaded = false;
        let lastError = null;

        try {
            const blob = await _buildFinalReportDOCXClientSide(payload);
            _downloadBlob(blob, _finalReportFileName(payload.organization_name));
            downloaded = true;
        } catch (localErr) {
            console.warn('Local report builder failed, trying server.', localErr);
            lastError = localErr;
        }

        if (!downloaded) {
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const { blob, fileName } = await _fetchFinalReportFromApi(payload, token);
                    _downloadBlob(blob, fileName);
                    downloaded = true;
                } catch (apiErr) {
                    console.warn('Server report generation failed.', apiErr);
                    lastError = apiErr;
                }
            }
        }

        if (!downloaded) {
            console.error(lastError);
            const lang = window.appState?.currentLanguage === 'pt' ? 'pt' : 'en';
            const detail = lastError?.message ? ` (${lastError.message})` : '';
            alert(
                lang === 'en'
                    ? `Could not generate the Carbon Emission Statement${detail}. Open the app via a web server (not file://) and ensure assets/reports/carbon-emission-statement-template-v1.1.docx is available.`
                    : `Nao foi possivel gerar o Relatorio de Emissoes${detail}. Abra o app via servidor web e confirme que o arquivo do relatorio esta disponivel.`
            );
            return;
        }

        showNotification(
            _exportSuccessMessage(
                'Carbon Emission Statement downloaded successfully!',
                'Relatorio de Emissoes baixado com sucesso!'
            ),
            'success'
        );
    } catch (err) {
        _exportErrorAlert('Error generating Carbon Emission Statement', err);
    }
}

function generateFinalReportDOCXSafe() {
    generateFinalReportDOCX().catch((err) => {
        _exportErrorAlert('Error generating Carbon Emission Statement', err);
    });
}

window.generateFinalReportDOCX = generateFinalReportDOCXSafe;

