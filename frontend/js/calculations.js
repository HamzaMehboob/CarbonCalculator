// ============================================
// CARBON CALCULATOR - CALCULATIONS ENGINE
// UK 2025 & Brazil Conversion Factors
// ============================================

// Conversion Factors Database (kg CO2e per unit)
const CONVERSION_FACTORS = {
    // UK 2025 Factors (official government data)
    UK: {
        water: 0.344,           // per m³
        electricity: 0.177,     // per kWh
        naturalGas: 0.183,      // per kWh
        waste: 21.28,           // per tonne (average mixed waste)
        wasteRecycled: 0.021,   // per tonne
        transport_petrol: 0.168, // per km (average car)
        transport_diesel: 0.171, // per km (average car)
        transport_electric: 0.053, // per km
        flights_short: 0.156,   // per passenger-km (<500km)
        flights_medium: 0.112,  // per passenger-km (500-3700km)
        flights_long: 0.103,    // per passenger-km (>3700km)
        refrigerant_R410A: 2088, // per kg (GWP)
        refrigerant_R134a: 1430, // per kg
        refrigerant_R32: 675,    // per kg
    },
    
    // Brazil Factors (latest available)
    BRAZIL: {
        water: 0.421,           // per m³
        electricity: 0.233,     // per kWh (grid average)
        naturalGas: 0.202,      // per kWh
        waste: 25.84,           // per tonne
        wasteRecycled: 0.025,   // per tonne
        transport_petrol: 0.175, // per km
        transport_diesel: 0.182, // per km
        transport_electric: 0.062, // per km
        flights_short: 0.165,   // per passenger-km
        flights_medium: 0.118,  // per passenger-km
        flights_long: 0.109,    // per passenger-km
        refrigerant_R410A: 2088,
        refrigerant_R134a: 1430,
        refrigerant_R32: 675,
    }
};

// Current country selection (default UK)
let currentCountry = 'UK';

// ============================================
// CALCULATION FUNCTIONS
// ============================================

function calculateRowTotal(row) {
    const monthInputs = row.querySelectorAll('.month-input');
    let total = 0;
    
    monthInputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        total += value;
    });
    
    const totalCell = row.querySelector('.total-cell');
    totalCell.textContent = total.toFixed(2);
    
    calculateRowCO2(row, total);
    
    return total;
}

function calculateRowCO2(row, total) {
    const table = row.closest('table');
    const tableId = table.id;
    
    let conversionFactor = 0;
    
    // Determine conversion factor based on table type
    switch(tableId) {
        case 'waterTable':
            conversionFactor = CONVERSION_FACTORS[currentCountry].water;
            break;
        case 'energyTable':
            conversionFactor = CONVERSION_FACTORS[currentCountry].electricity;
            break;
        case 'wasteTable':
            conversionFactor = CONVERSION_FACTORS[currentCountry].waste;
            break;
        case 'transportTable':
            conversionFactor = CONVERSION_FACTORS[currentCountry].transport_petrol;
            break;
        case 'refrigerantsTable':
            conversionFactor = CONVERSION_FACTORS[currentCountry].refrigerant_R410A;
            break;
    }
    
    const co2e = (total * conversionFactor) / 1000; // Convert to tonnes
    const co2Cell = row.querySelector('.co2-cell');
    co2Cell.textContent = co2e.toFixed(3);
    
    return co2e;
}

function calculateCategoryTotal(table) {
    const rows = table.querySelectorAll('.data-row');
    let categoryTotal = 0;
    
    rows.forEach(row => {
        const co2Cell = row.querySelector('.co2-cell');
        const co2Value = parseFloat(co2Cell.textContent) || 0;
        categoryTotal += co2Value;
    });
    
    // Update category summary
    const tableId = table.id;
    const categoryName = tableId.replace('Table', '');
    const summaryElement = document.getElementById(`${categoryName}Total`);
    
    if (summaryElement) {
        summaryElement.textContent = `${categoryTotal.toFixed(3)} tCO₂e`;
    }
    
    // Update dashboard if it's active
    const dashboardTab = document.querySelector('[data-content="dashboard"]');
    if (dashboardTab && dashboardTab.classList.contains('active')) {
        updateDashboard();
    }
    
    return categoryTotal;
}

function calculateAllTotals() {
    const tables = ['water', 'energy', 'waste', 'transport', 'refrigerants'];
    let grandTotal = 0;
    
    tables.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const rows = table.querySelectorAll('.data-row');
            rows.forEach(row => {
                calculateRowTotal(row);
            });
            const categoryTotal = calculateCategoryTotal(table);
            grandTotal += categoryTotal;
        }
    });
    
    return grandTotal;
}

// ============================================
// CATEGORY TOTALS
// ============================================

function getCategoryTotals() {
    const totals = {
        water: 0,
        energy: 0,
        waste: 0,
        transport: 0,
        refrigerants: 0
    };
    
    Object.keys(totals).forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const rows = table.querySelectorAll('.data-row');
            rows.forEach(row => {
                const co2Cell = row.querySelector('.co2-cell');
                const value = parseFloat(co2Cell.textContent) || 0;
                totals[category] += value;
            });
        }
    });
    
    return totals;
}

// ============================================
// MONTHLY BREAKDOWN
// ============================================

function getMonthlyTotals() {
    const monthlyData = Array(12).fill(0);
    
    const tables = ['water', 'energy', 'waste', 'transport', 'refrigerants'];
    
    tables.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const rows = table.querySelectorAll('.data-row');
            rows.forEach(row => {
                const monthInputs = row.querySelectorAll('.month-input');
                
                // Get conversion factor for this category
                let conversionFactor = 0;
                switch(category) {
                    case 'water':
                        conversionFactor = CONVERSION_FACTORS[currentCountry].water;
                        break;
                    case 'energy':
                        conversionFactor = CONVERSION_FACTORS[currentCountry].electricity;
                        break;
                    case 'waste':
                        conversionFactor = CONVERSION_FACTORS[currentCountry].waste;
                        break;
                    case 'transport':
                        conversionFactor = CONVERSION_FACTORS[currentCountry].transport_petrol;
                        break;
                    case 'refrigerants':
                        conversionFactor = CONVERSION_FACTORS[currentCountry].refrigerant_R410A;
                        break;
                }
                
                monthInputs.forEach((input, index) => {
                    const value = parseFloat(input.value) || 0;
                    const co2e = (value * conversionFactor) / 1000;
                    monthlyData[index] += co2e;
                });
            });
        }
    });
    
    return monthlyData;
}

// ============================================
// YEAR-OVER-YEAR COMPARISON
// ============================================

function getYearComparison() {
    const years = {}; // Dynamic years object
    
    // First, ensure all rows are calculated
    calculateAllTotals();
    
    const tables = ['water', 'energy', 'waste', 'transport', 'refrigerants'];
    
    tables.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const rows = table.querySelectorAll('.data-row');
            rows.forEach(row => {
                // Get all inputs in row - year is always the second input
                const inputs = row.querySelectorAll('input');
                if (inputs.length >= 2) {
                    // First input is description (text), second is year (number)
                    const yearInput = inputs[1];
                    if (yearInput && yearInput.type === 'number') {
                        const year = parseInt(yearInput.value);
                        if (!isNaN(year) && year >= 2020 && year <= 2030) {
                            // Calculate row total to get CO2 value
                            if (window.carbonCalc && window.carbonCalc.calculateRowTotal) {
                                window.carbonCalc.calculateRowTotal(row);
                            }
                            
                            // Calculate CO2 value directly from row data
                            let co2Value = 0;
                            
                            // Get month inputs
                            const monthInputs = row.querySelectorAll('.month-input');
                            monthInputs.forEach((input, index) => {
                                const monthValue = parseFloat(input.value) || 0;
                                if (monthValue > 0) {
                                    // Get category conversion factor
                                    const category = table.id.replace('Table', '');
                                    const factors = CONVERSION_FACTORS[currentCountry] || CONVERSION_FACTORS['UK'];
                                    const factor = factors[category] || factors['energy'] || 0.5;
                                    co2Value += monthValue * factor;
                                }
                            });
                            
                            // Also try to get from CO2 cell as fallback
                            const co2Cell = row.querySelector('.co2-cell');
                            if (co2Cell && co2Cell.textContent && co2Value === 0) {
                                const co2Text = co2Cell.textContent.trim().replace(/[^\d.-]/g, '');
                                co2Value = parseFloat(co2Text) || 0;
                            }
                            
                            // Initialize year if not exists
                            if (!years[year]) {
                                years[year] = 0;
                            }
                            years[year] += co2Value;
                        }
                    }
                }
            });
        }
    });
    
    // If no years found, return default structure with current year
    if (Object.keys(years).length === 0) {
        const currentYear = new Date().getFullYear();
        years[currentYear] = 0;
        if (currentYear > 2020) {
            years[currentYear - 1] = 0;
        }
    }
    
    // Sort years in ascending order
    const sortedYears = Object.keys(years)
        .map(y => parseInt(y))
        .sort((a, b) => a - b);
    
    const sortedData = {};
    sortedYears.forEach(year => {
        sortedData[year] = years[year] || 0;
    });
    
    return sortedData;
}

// ============================================
// COUNTRY SELECTION
// ============================================

function setCountry(country) {
    currentCountry = country.toUpperCase();
    localStorage.setItem('carbonCalcCountry', currentCountry);
    
    // Recalculate all values
    calculateAllTotals();
    updateDashboard();
}

function getCountry() {
    const saved = localStorage.getItem('carbonCalcCountry');
    return saved || 'UK';
}

// ============================================
// SCOPE CALCULATIONS (GHG Protocol)
// ============================================

function getScopeBreakdown() {
    const totals = getCategoryTotals();
    
    return {
        scope1: totals.refrigerants, // Direct emissions
        scope2: totals.energy,        // Indirect from electricity
        scope3: totals.water + totals.waste + totals.transport // Other indirect
    };
}

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('DOMContentLoaded', function() {
    // Load saved country
    currentCountry = getCountry();
    
    // Initial calculation
    setTimeout(() => {
        calculateAllTotals();
    }, 500);
});

// Export functions for use in other modules
window.carbonCalc = {
    calculateRowTotal,
    calculateCategoryTotal,
    calculateAllTotals,
    getCategoryTotals,
    getMonthlyTotals,
    getYearComparison,
    getScopeBreakdown,
    setCountry,
    getCountry,
    CONVERSION_FACTORS
};


