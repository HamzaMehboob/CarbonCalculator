// ============================================
// CARBON CALCULATOR - CALCULATIONS ENGINE
// UK 2025 & Brazil Conversion Factors
// ============================================

// Conversion Factors Database (kg CO2e per unit)
// This object can be extended/overwritten via import in the frontend.
let CONVERSION_FACTORS = {
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

function getRowConversionFactor(row, tableId) {
    const category = tableId.replace('Table', '');
    const factors = CONVERSION_FACTORS[currentCountry] || CONVERSION_FACTORS['UK'];
    const emissionSelect = row.querySelector('.emission-select');

    if (emissionSelect && emissionSelect.value && factors[emissionSelect.value] !== undefined) {
        return factors[emissionSelect.value];
    }

    // Fallback to category defaults (backwards compatibility)
    switch (tableId) {
        case 'waterTable':
            return factors.water;
        case 'energyTable':
            return factors.electricity;
        case 'wasteTable':
            return factors.waste;
        case 'transportTable':
            return factors.transport_petrol;
        case 'refrigerantsTable':
            return factors.refrigerant_R410A;
        default:
            return 0;
    }
}

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
    const conversionFactor = getRowConversionFactor(row, tableId);
    
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
                const conversionFactor = getRowConversionFactor(row, `${category}Table`);

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
                            // Ensure row total & CO2 cell are up to date
                            if (window.carbonCalc && window.carbonCalc.calculateRowTotal) {
                                window.carbonCalc.calculateRowTotal(row);
                            }

                            // Read the already-calculated tCO₂e value from the CO2 cell
                            let co2Value = 0;
                            const co2Cell = row.querySelector('.co2-cell');
                            if (co2Cell && co2Cell.textContent) {
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
    
    const yearKeys = Object.keys(years).map(y => parseInt(y, 10)).filter(y => !isNaN(y));

    // If no years found, return default structure with current year and previous years (both zero)
    if (yearKeys.length === 0) {
        const currentYear = new Date().getFullYear();
        const sortedData = {};
        sortedData[currentYear - 2] = 0;
        sortedData[currentYear - 1] = 0;
        sortedData[currentYear] = 0;
        return sortedData;
    }

    // Ensure there are always "previous year" entries with zero data:
    // if the earliest year with data is 2024, we create 2023 and 2022 with value 0.
    const minYear = Math.min(...yearKeys);
    const prevYears = [minYear - 1, minYear - 2];
    prevYears.forEach(py => {
        if (py >= 2020 && !years[py]) {
            years[py] = 0;
        }
    });

    // Now sort and return all known years (including the synthetic previous years)
    const sortedData = {};
    Object.keys(years)
        .map(y => parseInt(y, 10))
        .filter(y => !isNaN(y))
        .sort((a, b) => a - b)
        .forEach(year => {
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
    // Calculate Scope breakdown by analyzing each row's emission type
    let scope1 = 0; // Direct emissions: natural gas, diesel, gasoline, fleet vehicles, refrigerants
    let scope2 = 0; // Indirect energy: electricity
    let scope3 = 0; // Other indirect: water, waste, transport (flights)
    
    const tables = ['water', 'energy', 'waste', 'transport', 'refrigerants'];
    
    tables.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const rows = table.querySelectorAll('.data-row');
            rows.forEach(row => {
                const emissionSelect = row.querySelector('.emission-select');
                const co2Cell = row.querySelector('.co2-cell');
                const co2Value = parseFloat(co2Cell?.textContent) || 0;
                
                if (emissionSelect) {
                    const emissionType = emissionSelect.value;
                    
                    // Scope 1: Direct emissions
                    if (emissionType === 'naturalGas' || 
                        emissionType === 'diesel' || 
                        emissionType === 'transport_petrol' || 
                        emissionType === 'transport_diesel' ||
                        emissionType === 'refrigerant_R410A' ||
                        emissionType === 'refrigerant_R134a' ||
                        emissionType === 'refrigerant_R32') {
                        scope1 += co2Value;
                    }
                    // Scope 2: Indirect energy (electricity)
                    else if (emissionType === 'electricity') {
                        scope2 += co2Value;
                    }
                    // Scope 3: Other indirect (water, waste, flights)
                    else if (emissionType === 'water' || 
                             emissionType === 'wastewater' ||
                             emissionType === 'waste' || 
                             emissionType === 'wasteRecycled' ||
                             emissionType === 'flights_short' ||
                             emissionType === 'flights_medium' ||
                             emissionType === 'flights_long' ||
                             emissionType === 'transport_electric') {
                        scope3 += co2Value;
                    }
                }
            });
        }
    });
    
    return {
        scope1: scope1,
        scope2: scope2,
        scope3: scope3
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
    CONVERSION_FACTORS,
    // Allow external code (e.g. import/export tools) to replace factors database
    setConversionFactors: function (newDb) {
        if (!newDb || typeof newDb !== 'object') return;
        CONVERSION_FACTORS = newDb;
    },
    getConversionFactors: function () {
        return CONVERSION_FACTORS;
    }
};


