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

window.exportToPDF = exportToPDF;
window.exportToExcel = exportToExcel;

