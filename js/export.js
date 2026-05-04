// ============================================
// CARBON CALCULATOR - EXPORT FUNCTIONS
// PDF and Excel Export
// ============================================

// ============================================
// EXPORT TO PDF
// ============================================

function exportToPDF() {
    // Check if jsPDF is loaded
    if (!window.jspdf) {
        alert('PDF export library is loading. Please wait a moment and try again.');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
    
    // Get company info
    const companyName = document.getElementById('companyNameInput').value || 'My Company';
    const companyNotes = document.getElementById('companyNotes').value || '';
    const currentDate = new Date().toLocaleDateString();

    // Get financial KPIs from DOM (try main widget id, then Accounts dashboard id)
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
    
    // Get totals
    const totals = window.carbonCalc.getCategoryTotals();
    const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
    const yearComparison = window.carbonCalc.getYearComparison();
    
    let yPos = 20;
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(19, 181, 234);
    doc.text('🌱 Carbon Emissions Report', 105, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('GHG Protocol Compliant', 105, yPos, { align: 'center' });
    
    yPos += 15;
    
    // Company Information
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Company Information', 20, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Company: ${companyName}`, 20, yPos);
    
    yPos += 6;
    doc.text(`Report Date: ${currentDate}`, 20, yPos);
    
    yPos += 6;
    doc.text(`Country: ${window.carbonCalc.getCountry()}`, 20, yPos);
    
    if (companyNotes) {
        yPos += 6;
        const splitNotes = doc.splitTextToSize(`Notes: ${companyNotes}`, 170);
        doc.text(splitNotes, 20, yPos);
        yPos += splitNotes.length * 5;
    }
    
    yPos += 10;
    
    // Summary Box
    doc.setFillColor(19, 181, 234);
    doc.rect(20, yPos, 170, 30, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL EMISSIONS', 105, yPos + 10, { align: 'center' });
    
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(`${grandTotal.toFixed(3)} tCO₂e`, 105, yPos + 22, { align: 'center' });
    doc.setFont(undefined, 'normal');
    
    yPos += 40;
    
    // Category Breakdown
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Emissions by Category', 20, yPos);
    
    yPos += 8;
    
    const categories = [
        { name: 'Water', key: 'water', color: [19, 181, 234] },
        { name: 'Energy', key: 'energy', color: [255, 193, 7] },
        { name: 'Waste', key: 'waste', color: [40, 167, 69] },
        { name: 'Transport', key: 'transport', color: [220, 53, 69] },
        { name: 'Refrigerants', key: 'refrigerants', color: [108, 117, 125] }
    ];
    
    categories.forEach(cat => {
        const value = totals[cat.key] || 0;
        const percentage = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(1) : 0;
        
        // Category bar (only draw if we have a valid total to avoid NaN/Infinity issues)
        if (grandTotal > 0 && value > 0) {
            doc.setFillColor(...cat.color);
            const barWidth = Math.max(0, (value / grandTotal) * 150);
            doc.rect(20, yPos, barWidth, 6, 'F');
        }
        
        // Category label
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(`${cat.name}: ${value.toFixed(3)} tCO₂e (${percentage}%)`, 20, yPos + 12);
        
        yPos += 18;
    });
    
    yPos += 5;
    
    // Year-over-Year Comparison
    if (yPos > 240) {
        doc.addPage();
        yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Year-over-Year Comparison', 20, yPos);
    
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    
    // Dynamic year comparison
    const years = Object.keys(yearComparison).sort((a, b) => parseInt(a) - parseInt(b));
    years.forEach((year, index) => {
        if (index > 0) yPos += 6;
        doc.text(`${year}: ${yearComparison[year].toFixed(3)} tCO₂e`, 20, yPos);
    });
    
    // Calculate change if there are at least 2 years
    if (years.length >= 2) {
        const latestYear = years[years.length - 1];
        const previousYear = years[years.length - 2];
        const change = yearComparison[latestYear] - yearComparison[previousYear];
        const changePercent = yearComparison[previousYear] > 0 ? ((change / yearComparison[previousYear]) * 100).toFixed(1) : 0;
        const changeText = change >= 0 ? `+${change.toFixed(3)}` : change.toFixed(3);
        yPos += 6;
        doc.text(`Change (${previousYear} to ${latestYear}): ${changeText} tCO₂e (${changePercent}%)`, 20, yPos);
    }
    
    yPos += 15;
    
    // Scope Breakdown (GHG Protocol)
    const scopes = window.carbonCalc.getScopeBreakdown();
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('GHG Protocol Scopes', 20, yPos);
    
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Scope 1 (Direct Emissions): ${scopes.scope1.toFixed(3)} tCO₂e`, 20, yPos);
    
    yPos += 6;
    doc.text(`Scope 2 (Indirect - Electricity): ${scopes.scope2.toFixed(3)} tCO₂e`, 20, yPos);
    
    yPos += 6;
    doc.text(`Scope 3 (Other Indirect): ${scopes.scope3.toFixed(3)} tCO₂e`, 20, yPos);

    // Financial Summary (Accounts)
    yPos += 12;
    if (yPos > 260) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Financial Summary (Accounts)', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Business Bank Account: $${financials.bankBalance.toFixed(2)}`, 20, yPos);

    yPos += 6;
    doc.text(`Business Savings: $${financials.savingsBalance.toFixed(2)}`, 20, yPos);

    yPos += 6;
    doc.text(`Total Cash In: $${financials.cashIn.toFixed(2)}`, 20, yPos);

    yPos += 6;
    doc.text(`Total Cash Out: $${financials.cashOut.toFixed(2)}`, 20, yPos);

    yPos += 6;
    doc.text(`Invoices Owed to You: $${financials.invoicesOwed.toFixed(2)}`, 20, yPos);

    yPos += 6;
    doc.text(`Bills to Pay: $${financials.billsToPay.toFixed(2)}`, 20, yPos);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Carbon Calculator Phase 1 - GHG Protocol Compliant', 105, 285, { align: 'center' });
    doc.text(`${currentDate}`, 105, 290, { align: 'center' });
    
        // Save PDF
        const fileName = `Carbon_Report_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        // Show success message
        if (typeof showNotification !== 'undefined') {
            showNotification(
                appState.currentLanguage === 'en' 
                    ? '✅ PDF exported successfully!' 
                    : '✅ PDF exportado com sucesso!',
                'success'
            );
        } else {
            alert(appState.currentLanguage === 'en' ? 'PDF exported successfully!' : 'PDF exportado com sucesso!');
        }
    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Error exporting PDF: ' + error.message);
    }
}

// ============================================
// EXPORT TO EXCEL
// ============================================

function exportToExcel() {
    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined' || !XLSX.utils) {
        alert('Excel export library is loading. Please wait a moment and try again.');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();
    
    // Get company info
    const companyName = document.getElementById('companyNameInput').value || 'My Company';
    const companyNotes = document.getElementById('companyNotes').value || '';

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
            category.charAt(0).toUpperCase() + category.slice(1),
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
    const categories = ['water', 'energy', 'waste', 'transport', 'refrigerants'];
    
    categories.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const sheetData = exportTableToArray(table, category);
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            const sheetName = category.charAt(0).toUpperCase() + category.slice(1);
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
    XLSX.writeFile(wb, fileName);
    
    // Show success message
    showNotification(
        appState.currentLanguage === 'en' 
            ? '✅ Excel exported successfully!' 
            : '✅ Excel exportado com sucesso!',
        'success'
    );
    } catch (error) {
        console.error('Excel Export Error:', error);
        alert('Error exporting Excel: ' + error.message);
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
    if (!window.carbonCalc || !window.carbonCalc.getConversionFactors || !window.carbonCalc.getCountry || !window.carbonCalc.getYearComparison) {
        alert('Conversion factors are not available in the frontend.');
        return;
    }

    try {
        const factorsDb = window.carbonCalc.getConversionFactors();
        const countryKey = window.carbonCalc.getCountry(); // e.g. 'UK' or 'BRAZIL'
        const factors = factorsDb[countryKey];

        if (!factors) {
            alert('No factors found for the selected database: ' + countryKey);
            return;
        }

        const wb = XLSX.utils.book_new();

        // Determine years to export from existing year comparison
        const yearComparison = window.carbonCalc.getYearComparison();
        let yearKeys = Object.keys(yearComparison || {})
            .map(y => parseInt(y, 10))
            .filter(y => !isNaN(y))
            .sort((a, b) => a - b);

        if (yearKeys.length === 0) {
            yearKeys = [new Date().getFullYear()];
        }

        yearKeys.forEach(year => {
            const rows = Object.entries(factors).map(([factorKey, value]) => ({
                Factor: factorKey,
                Value: value
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const sheetName = String(year).substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Factors');
        });

        const fileName = `Conversion_Factors_${countryKey}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch (error) {
        console.error('Factors Excel Export Error:', error);
        alert('Error exporting factors: ' + error.message);
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
    reader.onload = function (e) {
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

            const userName = prompt(
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
                const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:5000/api';
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
    
    // Add category name as title
    data.push([category.charAt(0).toUpperCase() + category.slice(1) + ' Data']);
    data.push([]);
    
    // Get headers
    const headerCells = table.querySelectorAll('thead th');
    headerCells.forEach(cell => {
        const text = cell.textContent.trim();
        if (text) headers.push(text);
    });
    data.push(headers);
    
    // Get rows
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');
        
        cells.forEach((cell, index) => {
            const input = cell.querySelector('input');
            if (input) {
                const value = input.value || '0';
                rowData.push(value);
            } else {
                const text = cell.textContent.trim();
                if (text && index < headers.length - 1) { // Exclude delete button column
                    rowData.push(text);
                }
            }
        });
        
        if (rowData.length > 0) {
            data.push(rowData);
        }
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

function _unitForCategory(categoryKey) {
    switch (categoryKey) {
        case 'water': return 'm³';
        case 'energy': return 'kWh';
        case 'waste': return 'tonnes';
        case 'transport': return 'km';
        case 'refrigerants': return 'kg';
        default: return '';
    }
}

function _categoryLabel(categoryKey) {
    const map = {
        water: 'Water',
        energy: 'Energy',
        waste: 'Waste',
        transport: 'Transport',
        refrigerants: 'Refrigerants',
    };
    return map[categoryKey] || categoryKey;
}

function _ensureCarbonCalc() {
    if (!window.carbonCalc) {
        alert('Conversion factors are not available in the frontend.');
        return false;
    }
    return true;
}

function printConversionFactorsReportPDF() {
    const jsPDFCtor = _ensurePdfReady();
    if (!jsPDFCtor) return;

    if (!_ensureCarbonCalc()) return;

    const checked = Array.from(document.querySelectorAll('.conversion-factor-checkbox:checked'));
    if (checked.length === 0) {
        alert('Select at least one conversion factor to include.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const companyName = document.getElementById('companyNameInput')?.value || 'My Company';
    const currentDate = new Date().toLocaleDateString();
    const countryKey = window.carbonCalc.getCountry();

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

    yPos += 10;

    const factorsDb = window.carbonCalc.getConversionFactors();
    const factors = factorsDb[countryKey] || {};

    const unitByKey = (key) => {
        if (key === 'water' || key === 'wastewater') return 'kg CO2e per m³';
        if (key === 'electricity' || key === 'naturalGas' || key === 'diesel') return 'kg CO2e per kWh';
        if (key === 'waste' || key === 'wasteRecycled' || key === 'waste_composted') return 'kg CO2e per tonne';
        if (key.startsWith('transport_')) return 'kg CO2e per km';
        if (key.startsWith('flights_')) return 'kg CO2e per passenger-km';
        if (key.startsWith('refrigerant_')) return 'kg CO2e per kg';
        return '';
    };

    const keys = checked.map(cb => cb.dataset.factorKey).filter(Boolean);

    // Simple table layout
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const left = 20;
    const colIdxX = left + 2;
    const colKeyX = left + 16;
    const colValX = 110;
    const colUnitX = 160;

    // Header row
    doc.setFillColor(19, 181, 234);
    doc.rect(left, yPos, 180, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Factor', colKeyX + 2, yPos + 4);
    doc.text('Value', colValX + 2, yPos + 4);
    doc.setTextColor(255, 255, 255);
    doc.text('Unit', colUnitX + 2, yPos + 4);

    yPos += 10;

    keys.forEach((k, idx) => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }

        const value = factors[k];
        if (value === undefined) return;

        const name = k;
        const unit = unitByKey(k);

        doc.setTextColor(0, 0, 0);
        doc.text(String(idx + 1).padStart(2, '0'), colIdxX, yPos);
        doc.text(name, colKeyX, yPos);
        doc.text(Number(value).toFixed(6).replace(/\.?0+$/, ''), colValX, yPos);
        if (unit) {
            const wrapped = doc.splitTextToSize(unit, 45);
            doc.text(wrapped, colUnitX, yPos);
        }

        yPos += 6;
    });

    const fileName = `Conversion_Factors_Used_${countryKey}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

function printInputDataSummaryPDF() {
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

    const categories = ['water', 'energy', 'waste', 'transport', 'refrigerants'];

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
    doc.save(fileName);
}

function printInputEmissionsReportPDF() {
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
    doc.text('Input Emissions (KgCO2e)', 105, yPos, { align: 'center' });

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Company: ${companyName}`, 20, yPos);
    doc.text(`Date: ${currentDate}`, 120, yPos);
    yPos += 6;
    doc.text(`Database/Country: ${countryKey}`, 20, yPos);

    yPos += 10;

    const factorsDb = window.carbonCalc.getConversionFactors();
    const factors = factorsDb[countryKey] || {};
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const categories = ['water', 'energy', 'waste', 'transport', 'refrigerants'];
    categories.forEach((catKey, catIdx) => {
        const table = document.getElementById(`${catKey}Table`);
        if (!table) return;

        if (catIdx > 0) yPos += 4;
        if (yPos > 245) { doc.addPage(); yPos = 20; }

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`${_categoryLabel(catKey)} Emissions`, 20, yPos);
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

            const co2Cell = row.querySelector('.co2-cell')?.textContent || '0';
            const co2T = parseFloat(String(co2Cell).replace(/[^\d.-]/g, '')) || 0;
            const kgCO2eTotal = co2T * 1000;

            const factor = factors[emissionKey] || 0;
            const monthInputs = Array.from(row.querySelectorAll('input.month-input'));
            const monthVals = monthInputs.map(i => Number(i.value) || 0);
            const monthKg = monthVals.map(v => v * factor);

            const headerLine = `${rowIdx + 1}. ${desc} (${year}) | Total: ${kgCO2eTotal.toFixed(2)} kgCO2e`;
            const headerWrapped = doc.splitTextToSize(headerLine, 180);
            doc.text(headerWrapped, 20, yPos);
            yPos += headerWrapped.length * 4;

            const monthLine = monthLabels.map((m, i) => `${m}:${monthKg[i].toFixed(0)}`).join(' ');
            const monthWrapped = doc.splitTextToSize(monthLine, 180);
            doc.text(monthWrapped, 20, yPos);
            yPos += monthWrapped.length * 4;
        });
    });

    const fileName = `Input_Emissions_${countryKey}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

// Expose in case HTML inline handlers want the global reference
window.printConversionFactorsReportPDF = printConversionFactorsReportPDF;
window.printInputDataSummaryPDF = printInputDataSummaryPDF;
window.printInputEmissionsReportPDF = printInputEmissionsReportPDF;

async function generateFinalReportDOCX() {
    if (!_ensureCarbonCalc()) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Please login first.');
        return;
    }

    const orgName = localStorage.getItem('companyName') || 'Organization';
    const activeSiteInput = document.querySelector('.site-item.active .site-name-input');
    const siteName = activeSiteInput?.value?.trim() || 'Site';

    const categoryTotalsT = window.carbonCalc.getCategoryTotals();
    const scopeT = window.carbonCalc.getScopeBreakdown();

    const totals_kg = {
        water: (categoryTotalsT.water || 0) * 1000,
        energy: (categoryTotalsT.energy || 0) * 1000,
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

    // Prefer the General Info fields from the UI for the DOCX template placeholders.
    const issueDateInput = document.getElementById('issueDateInput');
    const issueDateRaw = issueDateInput?.value || '';
    // type="date" => yyyy-mm-dd
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

    const organization_profile = document.getElementById('organizationProfileInput')?.value?.trim() || '';
    const org_registered_address = document.getElementById('orgRegisteredAddressInput')?.value?.trim() || '';
    const scope_streams_summary = document.getElementById('scopeStreamsSummaryInput')?.value?.trim() || '';
    const assessment_period_detail = document.getElementById('assessmentPeriodDetailInput')?.value?.trim() || '';
    const assessment_general_notes = document.getElementById('assessmentGeneralNotesInput')?.value?.trim() || '';
    const assessment_extra_note1 = document.getElementById('assessmentExtraNote1Input')?.value?.trim() || '';
    const assessment_extra_note2 = document.getElementById('assessmentExtraNote2Input')?.value?.trim() || '';
    const buildings_assessed = document.getElementById('buildingsAssessedInput')?.value?.trim() || '';
    const assessment_base_year = document.getElementById('assessmentBaseYearInput')?.value?.trim() || '';

    const grand_total_kg = (Object.values(totals_kg).reduce((a, b) => a + b, 0)) || 0;

    const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:5000/api';
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
        grand_total_kg,
    };
    if (company_logo_data_url) {
        payload.company_logo_data_url = company_logo_data_url;
    }
    if (organization_profile) payload.organization_profile = organization_profile;
    if (org_registered_address) payload.org_registered_address = org_registered_address;
    if (scope_streams_summary) payload.scope_streams_summary = scope_streams_summary;
    if (assessment_period_detail) payload.assessment_period_detail = assessment_period_detail;
    if (assessment_general_notes) payload.assessment_general_notes = assessment_general_notes;
    if (assessment_extra_note1) payload.assessment_extra_note1 = assessment_extra_note1;
    if (assessment_extra_note2) payload.assessment_extra_note2 = assessment_extra_note2;
    if (buildings_assessed) payload.buildings_assessed_count = buildings_assessed;
    if (assessment_base_year) payload.assessment_base_year = assessment_base_year;

    try {
        const res = await fetch(`${apiBase}/reports/final`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const msg = await res.text();
            alert('Failed to generate Final report: ' + msg);
            return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        let fileName = 'Final_Report.docx';
        const disp = res.headers.get('content-disposition') || '';
        const match = disp.match(/filename[^;=\n]*=((['\"]).*?\\2|[^;\\n]*)/i);
        if (match && match[1]) {
            fileName = match[1].replace(/['\"]/g, '').trim();
        }

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
    } catch (err) {
        console.error(err);
        alert('Error generating Final report. See console for details.');
    }
}

window.generateFinalReportDOCX = generateFinalReportDOCX;

