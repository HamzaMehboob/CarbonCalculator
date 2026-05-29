// ============================================
// CARBON CALCULATOR - DASHBOARD
// Live Charts and KPIs
// ============================================

let pieChart = null;
let barChart = null;
let lineChart = null;
let sourceTrendChart = null;
let bankReconChart = null;
let accountFlowChart = null;
let accountSummaryChart = null;

function _chartTheme() {
    return typeof window.getCarbonChartColors === 'function' ? window.getCarbonChartColors() : null;
}

const CHART_PREFS_KEY = 'carbonChartPreferences';
const BAR_CHART_YEAR_MIN = 2020;
const BAR_CHART_YEAR_MAX = 2025;

function getBarChartYearLabels() {
    const years = [];
    for (let y = BAR_CHART_YEAR_MIN; y <= BAR_CHART_YEAR_MAX; y++) {
        years.push(String(y));
    }
    return years;
}
const CATEGORY_COLOR_PALETTE = [
    '#0EA5E9', '#F59E0B', '#16A34A', '#DC2626', '#64748B', '#6610F2', '#FD7E14', '#20C997', '#E83E8C',
];
const sourceTrendChartInstances = new Map();
let _chartStyleModalTargetId = null;

const CHART_MODAL_TITLES = {
    pieChart: { en: 'Emissions by Category', pt: 'Emissões por Categoria' },
    barChart: { en: 'Year-over-Year Comparison', pt: 'Comparação Ano a Ano' },
    lineChart: { en: 'Monthly Emissions Trend (Total)', pt: 'Tendência Mensal (Total)' },
    sourceTrendChart: { en: 'Monthly Trend by Source (All)', pt: 'Tendência por fonte (todas)' },
};

/** Preset font stacks for chart.js (labels, axes, legend). */
const CHART_FONT_OPTIONS = [
    {
        value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
        labelEn: 'System UI',
        labelPt: 'Sistema (UI)',
    },
    { value: 'Inter, Arial, sans-serif', labelEn: 'Inter', labelPt: 'Inter' },
    { value: "Arial, Helvetica, sans-serif", labelEn: 'Arial', labelPt: 'Arial' },
    { value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", labelEn: 'Segoe UI', labelPt: 'Segoe UI' },
    { value: 'Roboto, Arial, sans-serif', labelEn: 'Roboto', labelPt: 'Roboto' },
    { value: "Verdana, Geneva, sans-serif", labelEn: 'Verdana', labelPt: 'Verdana' },
    { value: 'Tahoma, Geneva, sans-serif', labelEn: 'Tahoma', labelPt: 'Tahoma' },
    { value: "'Trebuchet MS', Helvetica, sans-serif", labelEn: 'Trebuchet MS', labelPt: 'Trebuchet MS' },
    { value: "Georgia, 'Times New Roman', serif", labelEn: 'Georgia', labelPt: 'Georgia' },
    { value: "'Times New Roman', Times, serif", labelEn: 'Times New Roman', labelPt: 'Times New Roman' },
    { value: "'Courier New', Courier, monospace", labelEn: 'Courier New', labelPt: 'Courier New' },
];

function escapeHtmlAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function buildChartFontFamilySelectHtml(selectedValue) {
    const selected = selectedValue || getChartPrefs().fontFamily;
    const pt = appState.currentLanguage === 'pt';
    const isKnown = CHART_FONT_OPTIONS.some((o) => o.value === selected);
    let optionsHtml = '';
    if (selected && !isKnown) {
        const customLabel = pt ? 'Personalizado' : 'Custom';
        optionsHtml += `<option value="${escapeHtmlAttr(selected)}" selected>${customLabel}</option>`;
    }
    CHART_FONT_OPTIONS.forEach((opt) => {
        const label = pt ? opt.labelPt : opt.labelEn;
        const sel = opt.value === selected ? ' selected' : '';
        optionsHtml += `<option value="${escapeHtmlAttr(opt.value)}"${sel}>${escapeHtmlAttr(label)}</option>`;
    });
    return `<select id="chartFontFamily">${optionsHtml}</select>`;
}

function getChartPrefs() {
    const defaults = {
        primaryColor: '#0EA5E9',
        secondaryColor: '#16A34A',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 12,
        fontWeight: '500',
        charts: {},
    };
    try {
        const parsed = JSON.parse(localStorage.getItem(CHART_PREFS_KEY) || '{}');
        return {
            ...defaults,
            ...parsed,
            charts: { ...(parsed.charts || {}) },
        };
    } catch {
        return defaults;
    }
}

function saveChartPrefs(prefs) {
    localStorage.setItem(CHART_PREFS_KEY, JSON.stringify(prefs));
}

function getChartConfig(chartId) {
    const prefs = getChartPrefs();
    const per = (chartId && prefs.charts[chartId]) || {};
    return {
        fontFamily: per.fontFamily || prefs.fontFamily,
        fontSize: per.fontSize != null ? per.fontSize : prefs.fontSize,
        fontWeight: per.fontWeight || prefs.fontWeight,
        borderColor: per.borderColor || per.primaryColor || prefs.primaryColor,
        fillColor: per.fillColor || per.secondaryColor || prefs.secondaryColor,
        colors: Array.isArray(per.colors) ? per.colors : null,
        datasetColors: per.datasetColors && typeof per.datasetColors === 'object' ? per.datasetColors : null,
    };
}

function chartTickFont(chartId) {
    const c = getChartConfig(chartId);
    return { family: c.fontFamily, size: c.fontSize, weight: c.fontWeight };
}

function chartScaleOptions(chartId, ct) {
    const tickColor = ct?.tick || (appState.darkMode ? '#94A3B8' : '#64748B');
    const gridColor = ct?.grid || (appState.darkMode ? '#1E293B' : '#CBD5E1');
    const font = chartTickFont(chartId);
    return {
        y: {
            beginAtZero: true,
            ticks: { color: tickColor, font, callback: (v) => Number(v).toFixed(2) },
            grid: { color: gridColor },
        },
        x: {
            ticks: { color: tickColor, font },
            grid: { color: gridColor },
        },
    };
}

function hexToRgba(hex, alpha) {
    const raw = String(hex || '#0EA5E9').replace('#', '');
    if (raw.length !== 6) return `rgba(14, 165, 233, ${alpha})`;
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function defaultPaletteColors(count) {
    const ct = _chartTheme();
    const palette = ct?.pie || ct?.yearBar || CATEGORY_COLOR_PALETTE;
    const colors = [];
    for (let i = 0; i < count; i++) colors.push(palette[i % palette.length]);
    return colors;
}

function getCategoryDisplayName(category) {
    const meta = window.DATA_TAB_META?.[category];
    if (meta) {
        return appState.currentLanguage === 'pt' ? meta.titlePt : meta.titleEn;
    }
    return category.charAt(0).toUpperCase() + category.slice(1);
}

function getEmissionCategories() {
    if (Array.isArray(window.DATA_INPUT_CATEGORIES) && window.DATA_INPUT_CATEGORIES.length) {
        return window.DATA_INPUT_CATEGORIES;
    }
    return ['water', 'energy', 'waste', 'transport', 'refrigerants'];
}

function getMonthLabels() {
    return appState.currentLanguage === 'en'
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
}

function chartModalTitle(chartId) {
    if (chartId && chartId.startsWith('sourceTrend_')) {
        const cat = chartId.replace('sourceTrend_', '');
        const name = getCategoryDisplayName(cat);
        return appState.currentLanguage === 'pt'
            ? `Tendência mensal — ${name}`
            : `Monthly trend — ${name}`;
    }
    const t = CHART_MODAL_TITLES[chartId];
    if (!t) return chartId || 'Chart';
    return appState.currentLanguage === 'pt' ? t.pt : t.en;
}

function buildChartStyleFormHtml(chartId) {
    const prefs = getChartPrefs();
    const cfg = chartId ? getChartConfig(chartId) : prefs;
    const isPie = chartId === 'pieChart';
    const isMultiLine = chartId === 'sourceTrendChart';
    const isCategoryLine = chartId && chartId.startsWith('sourceTrend_');

    let colorSection = '';
    if (isPie) {
        const totals = window.carbonCalc?.getCategoryTotals?.() || {};
        const keys = Object.keys(totals);
        const stored = prefs.charts.pieChart?.colors || defaultPaletteColors(keys.length || 5);
        keys.forEach((key, idx) => {
            const label = getCategoryDisplayName(key);
            const val = stored[idx] || defaultPaletteColors(keys.length)[idx];
            colorSection += `
                <div class="chart-style-color-row">
                    <span>${label}</span>
                    <input type="color" data-pie-slice="${key}" value="${val}">
                </div>`;
        });
        if (!keys.length) {
            colorSection = `<p style="color:var(--text-secondary);font-size:13px;">Enter data to customize slice colors.</p>`;
        }
    } else if (isMultiLine) {
        const dataByCategory = window.carbonCalc?.getMonthlyTotalsByCategory?.() || {};
        const cats = Object.keys(dataByCategory);
        const stored = prefs.charts.sourceTrendChart?.datasetColors || {};
        cats.forEach((cat, idx) => {
            const label = getCategoryDisplayName(cat);
            const val = stored[cat] || defaultPaletteColors(cats.length)[idx];
            colorSection += `
                <div class="chart-style-color-row">
                    <span>${label}</span>
                    <input type="color" data-dataset-cat="${cat}" value="${val}">
                </div>`;
        });
    } else {
        colorSection = `
            <label>Line / bar color
                <input type="color" id="chartBorderColor" value="${cfg.borderColor}">
            </label>
            <label>Fill color
                <input type="color" id="chartFillColor" value="${cfg.fillColor}">
            </label>`;
        if (chartId === 'barChart') {
            const years = getBarChartYearLabels();
            const stored = prefs.charts.barChart?.colors || defaultPaletteColors(years.length);
            const barYears = prefs.charts.barChart?.barYears || years;
            colorSection += `<p style="margin:12px 0 8px;font-size:13px;color:var(--text-secondary);">Bar colors by year</p>`;
            years.forEach((year, idx) => {
                const storedIdx = barYears.indexOf(year);
                const val = storedIdx >= 0 ? stored[storedIdx] : defaultPaletteColors(years.length)[idx];
                colorSection += `
                    <div class="chart-style-color-row">
                        <span>${year}</span>
                        <input type="color" data-bar-year="${year}" value="${val}">
                    </div>`;
            });
        }
    }

    const globalNote = chartId
        ? ''
        : `<p style="margin-bottom:12px;color:var(--text-secondary);font-size:13px;">Defaults for new charts. Use the palette icon on each chart for chart-specific styles.</p>`;

  return `
        ${globalNote}
        <div class="chart-style-form">
            <label>${appState.currentLanguage === 'pt' ? 'Família de fonte' : 'Font family'}
                ${buildChartFontFamilySelectHtml(cfg.fontFamily || prefs.fontFamily)}
            </label>
            <label>Font size
                <input type="number" id="chartFontSize" min="10" max="20" value="${cfg.fontSize ?? prefs.fontSize}">
            </label>
            <label>Font weight
                <select id="chartFontWeight">
                    ${['400', '500', '600', '700'].map((w) => `<option value="${w}" ${String(cfg.fontWeight || prefs.fontWeight) === w ? 'selected' : ''}>${w}</option>`).join('')}
                </select>
            </label>
            ${!chartId ? `
            <label>Default line color
                <input type="color" id="chartPrimaryColor" value="${prefs.primaryColor}">
            </label>
            <label>Default fill color
                <input type="color" id="chartSecondaryColor" value="${prefs.secondaryColor}">
            </label>` : ''}
            ${chartId && (isPie || isMultiLine) ? '<p style="margin:12px 0 8px;font-size:13px;color:var(--text-secondary);">Colors</p>' : ''}
            ${colorSection}
        </div>`;
}

function openChartStyleModal(chartId) {
    _chartStyleModalTargetId = chartId || null;
    const existing = document.getElementById('chartStyleModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'chartStyleModal';
    modal.className = 'widget-modal';
    const title = chartId
        ? (appState.currentLanguage === 'pt' ? 'Estilo do gráfico' : 'Chart style')
        : (appState.currentLanguage === 'pt' ? 'Estilos padrão dos gráficos' : 'Default chart styles');
    const subtitle = chartId ? `<p style="margin:0 0 12px;color:var(--text-secondary);font-size:14px;">${chartModalTitle(chartId)}</p>` : '';
    modal.innerHTML = `
        <div class="widget-modal-content">
            <div class="widget-modal-header">
                <h3>${title}</h3>
                <button class="widget-modal-close" onclick="document.getElementById('chartStyleModal')?.remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="widget-modal-body">
                ${subtitle}
                ${buildChartStyleFormHtml(chartId)}
            </div>
            <div class="widget-modal-footer">
                <button class="btn-secondary" onclick="resetChartStyleDefaults()">${appState.currentLanguage === 'pt' ? 'Repor' : 'Reset'}</button>
                <button class="btn-primary" onclick="applyChartStylePrefs()">${appState.currentLanguage === 'pt' ? 'Aplicar' : 'Apply'}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function applyChartStylePrefs() {
    const prefs = getChartPrefs();
    const chartId = _chartStyleModalTargetId;
    const fontFamily = document.getElementById('chartFontFamily')?.value || prefs.fontFamily;
    const fontSize = Number(document.getElementById('chartFontSize')?.value || prefs.fontSize);
    const fontWeight = document.getElementById('chartFontWeight')?.value || prefs.fontWeight;

    if (!chartId) {
        prefs.fontFamily = fontFamily;
        prefs.fontSize = fontSize;
        prefs.fontWeight = fontWeight;
        prefs.primaryColor = document.getElementById('chartPrimaryColor')?.value || prefs.primaryColor;
        prefs.secondaryColor = document.getElementById('chartSecondaryColor')?.value || prefs.secondaryColor;
    } else {
        if (!prefs.charts[chartId]) prefs.charts[chartId] = {};
        const entry = prefs.charts[chartId];
        entry.fontFamily = fontFamily;
        entry.fontSize = fontSize;
        entry.fontWeight = fontWeight;

        if (chartId === 'pieChart') {
            const slices = document.querySelectorAll('#chartStyleModal [data-pie-slice]');
            entry.colors = Array.from(slices).map((el) => el.value);
            entry.sliceKeys = Array.from(slices).map((el) => el.getAttribute('data-pie-slice'));
        } else if (chartId === 'sourceTrendChart') {
            entry.datasetColors = {};
            document.querySelectorAll('#chartStyleModal [data-dataset-cat]').forEach((el) => {
                entry.datasetColors[el.getAttribute('data-dataset-cat')] = el.value;
            });
        } else if (chartId === 'barChart') {
            entry.borderColor = document.getElementById('chartBorderColor')?.value || entry.borderColor;
            entry.fillColor = document.getElementById('chartFillColor')?.value || entry.fillColor;
            const yearInputs = document.querySelectorAll('#chartStyleModal [data-bar-year]');
            if (yearInputs.length) {
                entry.colors = Array.from(yearInputs).map((el) => el.value);
                entry.barYears = Array.from(yearInputs).map((el) => el.getAttribute('data-bar-year'));
            }
        } else {
            entry.borderColor = document.getElementById('chartBorderColor')?.value || entry.borderColor;
            entry.fillColor = document.getElementById('chartFillColor')?.value || entry.fillColor;
        }
    }

    saveChartPrefs(prefs);
    document.getElementById('chartStyleModal')?.remove();
    _chartStyleModalTargetId = null;
    updateDashboard();
}

function resetChartStyleDefaults() {
    const chartId = _chartStyleModalTargetId;
    const prefs = getChartPrefs();
    if (chartId) {
        delete prefs.charts[chartId];
        saveChartPrefs(prefs);
    } else {
        localStorage.removeItem(CHART_PREFS_KEY);
    }
    document.getElementById('chartStyleModal')?.remove();
    _chartStyleModalTargetId = null;
    updateDashboard();
}

function resolvePieColors(labels, keys) {
    const cfg = getChartConfig('pieChart');
    const defaults = defaultPaletteColors(labels.length);
    if (!cfg.colors?.length) return defaults;
    if (cfg.sliceKeys?.length) {
        return keys.map((key, idx) => {
            const storedIdx = cfg.sliceKeys.indexOf(key);
            return storedIdx >= 0 ? cfg.colors[storedIdx] : defaults[idx];
        });
    }
    return cfg.colors.slice(0, labels.length).concat(defaults).slice(0, labels.length);
}

function chartLabelForUnit() {
    return window.carbonCalc?.getOutputUnit?.() === 'kgCO2e' ? 'kgCO₂e' : 'tCO₂e';
}

function convertTonnesToDisplayValue(tonnes) {
    const t = Number(tonnes || 0);
    return window.carbonCalc?.getOutputUnit?.() === 'kgCO2e' ? t * 1000 : t;
}

function formatEmissionsForDisplay(tonnes, decimals = 3) {
    if (window.carbonCalc?.formatTonnesForDisplay) {
        return window.carbonCalc.formatTonnesForDisplay(tonnes, decimals);
    }
    const t = Number(tonnes || 0);
    return `${t.toFixed(decimals)} tCO₂e`;
}

function setKpiValue(elementId, tonnes) {
    const text = formatEmissionsForDisplay(tonnes);
    document.querySelectorAll(`[id="${elementId}"]`).forEach((el) => {
        el.textContent = text;
    });
}

// Generate colors for year bars dynamically
function generateYearColors(count) {
    const ct = _chartTheme();
    const colorPalette = ct?.yearBar || [
        '#64748B',  // Slate
        '#0EA5E9',  // Sky
        '#16A34A',  // Green
        '#F59E0B',  // Amber
        '#DC2626',  // Red
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
    
    // Get Scope breakdown
    const scopeBreakdown = window.carbonCalc.getScopeBreakdown();
    
    // Get year comparison (dynamic years)
    const yearComparison = window.carbonCalc.getYearComparison();
    const years = Object.keys(yearComparison).map(y => parseInt(y)).sort((a, b) => b - a); // Sort descending
    
    // Get current year (latest year) - use current year if no data
    const currentYearNum = new Date().getFullYear();
    // Prefer spreadsheet "2024 Results Graphs" (2024 vs 2023) when available.
    const latestYear = (yearComparison[2024] !== undefined) ? 2024 : (years.length > 0 ? years[0] : currentYearNum);
    const lastYearValue = yearComparison[latestYear] || 0;
    const previousYear = (yearComparison[2023] !== undefined)
        ? 2023
        : (years.length > 1 ? years[1] : (years.length > 0 && years[0] > 2020 ? years[0] - 1 : currentYearNum - 1));
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
    setKpiValue('totalEmissions', grandTotal);

    setKpiValue('scope1Emissions', scopeBreakdown.scope1);
    setKpiValue('scope2Emissions', scopeBreakdown.scope2);
    setKpiValue('scope3Emissions', scopeBreakdown.scope3);

    setKpiValue('currentYearEmissions', lastYearValue);

    // Update last year display with dynamic year
    const lastYearElements = document.querySelectorAll('#lastYearEmissions');
    if (lastYearElements.length) {
        const lastYearText = formatEmissionsForDisplay(
            previousYear && yearComparison[previousYear] !== undefined ? previousYearValue : 0
        );
        lastYearElements.forEach((el) => {
            el.textContent = lastYearText;
        });
        if (previousYear && yearComparison[previousYear] !== undefined) {
            lastYearElements.forEach((el) => {
                const lastYearLabel = el.parentElement?.querySelector('h3');
                if (lastYearLabel) {
                    const labelText = lastYearLabel.textContent || lastYearLabel.innerHTML;
                    lastYearLabel.innerHTML = labelText.replace(/\d{4}/, previousYear) || `Last Year (${previousYear})`;
                }
            });
        }
    }

    setKpiValue('avgMonthEmissions', avgMonth);

    const calcContext = document.getElementById('dashboardCalcContext');
    if (calcContext && window.carbonCalc?.getReportingYear && window.carbonCalc?.getOutputUnitDisplayLabel) {
        calcContext.textContent = `Year: ${window.carbonCalc.getReportingYear()} | Unit: ${window.carbonCalc.getOutputUnitDisplayLabel()}`;
    }
    
    // Update change indicator
    const ct = _chartTheme();
    const changeElement = document.getElementById('emissionsChange');
    if (changeElement && previousYear && previousYearValue > 0) {
        const changeText = changePercent > 0 ? `+${changePercent.toFixed(1)}%` : `${changePercent.toFixed(1)}%`;
        changeElement.textContent = changeText;
        changeElement.style.color = changePercent > 0
            ? (ct?.changeUp || '#DC2626')
            : (ct?.changeDown || '#16A34A');
    } else if (changeElement) {
        changeElement.textContent = 'N/A';
        changeElement.style.color = ct?.changeNa || '#64748B';
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
    ensureSourceTrendChartCards();
    updatePieChart();
    updateBarChart();
    updateLineChart();
    updateSourceTrendChart();
    updateSourceTrendCharts();
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
    const ct = _chartTheme();
    const totals = window.carbonCalc.getCategoryTotals();
    const keys = Object.keys(totals);
    const labels = keys.map((key) => getCategoryDisplayName(key));
    const data = Object.values(totals);

    const ctx = document.getElementById('pieChart');
    if (!ctx) return;

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: resolvePieColors(labels, keys),
                borderWidth: 2,
                borderColor: ct?.pieBorder || (appState.darkMode ? '#0F172A' : '#FFFFFF'),
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: ct?.legend || (appState.darkMode ? '#E2E8F0' : '#0F172A'),
                        font: chartTickFont('pieChart'),
                        padding: 15,
                    },
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${convertTonnesToDisplayValue(value).toFixed(3)} ${chartLabelForUnit()} (${percentage}%)`;
                        },
                    },
                },
            },
        },
    });
}

// ============================================
// BAR CHART - Year-over-Year Comparison
// ============================================

function updateBarChart() {
    const ct = _chartTheme();
    const barCfg = getChartConfig('barChart');
    // Force recalculation first
    if (window.carbonCalc && window.carbonCalc.calculateAllTotals) {
        window.carbonCalc.calculateAllTotals();
    }
    
    const yearComparison = window.carbonCalc.getYearComparison();
    const years = getBarChartYearLabels();
    const values = years.map((year) => yearComparison[year] || 0);
    
    let colors = barCfg.colors?.length === years.length
        ? barCfg.colors
        : generateYearColors(years.length);
    if (!colors?.length) colors = generateYearColors(years.length);
    
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
                label: appState.currentLanguage === 'en'
                    ? `Total Emissions (${chartLabelForUnit()})`
                    : `Emissões Totais (${chartLabelForUnit()})`,
                data: values.map(convertTonnesToDisplayValue),
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
                    ...chartScaleOptions('barChart', ct).y,
                    position: 'left',
                    ticks: {
                        ...chartScaleOptions('barChart', ct).y.ticks,
                        callback(value) {
                            return Number(value).toFixed(1);
                        },
                    },
                    grid: {
                        ...chartScaleOptions('barChart', ct).y.grid,
                        drawBorder: false,
                    },
                },
                x: {
                    position: 'bottom',
                    ticks: {
                        ...chartScaleOptions('barChart', ct).x.ticks,
                        maxRotation: 0,
                        minRotation: 0,
                    },
                    grid: { display: false, drawBorder: false },
                },
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(3)} ${chartLabelForUnit()}`;
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
    const ct = _chartTheme();
    const lineCfg = getChartConfig('lineChart');
    const monthlyData = window.carbonCalc.getMonthlyTotals();
    const monthNames = getMonthLabels();

    const ctx = document.getElementById('lineChart');
    if (!ctx) return;

    if (lineChart) lineChart.destroy();

    const border = lineCfg.borderColor || ct?.lineBorder || '#0EA5E9';
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthNames,
            datasets: [{
                label: appState.currentLanguage === 'en'
                    ? `Monthly Emissions (${chartLabelForUnit()})`
                    : `Emissões Mensais (${chartLabelForUnit()})`,
                data: monthlyData.map(convertTonnesToDisplayValue),
                borderColor: border,
                backgroundColor: hexToRgba(lineCfg.fillColor || border, 0.12),
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: border,
                pointBorderColor: ct?.pieBorder || '#FFFFFF',
                pointBorderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: chartScaleOptions('lineChart', ct),
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return `${context.parsed.y.toFixed(3)} ${chartLabelForUnit()}`;
                        },
                    },
                },
            },
        },
    });
}

function updateSourceTrendChart() {
    if (!window.carbonCalc?.getMonthlyTotalsByCategory) return;
    const ct = _chartTheme();
    const cfg = getChartConfig('sourceTrendChart');
    const chartEl = document.getElementById('sourceTrendChart');
    if (!chartEl) return;
    const dataByCategory = window.carbonCalc.getMonthlyTotalsByCategory();
    const labels = getMonthLabels();
    const cats = Object.keys(dataByCategory);
    const defaultColors = defaultPaletteColors(cats.length);

    if (sourceTrendChart) sourceTrendChart.destroy();
    sourceTrendChart = new Chart(chartEl, {
        type: 'line',
        data: {
            labels,
            datasets: cats.map((cat, idx) => ({
                label: getCategoryDisplayName(cat),
                data: (dataByCategory[cat] || []).map(convertTonnesToDisplayValue),
                borderColor: cfg.datasetColors?.[cat] || defaultColors[idx],
                tension: 0.35,
                fill: false,
                borderWidth: 2,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: chartScaleOptions('sourceTrendChart', ct),
            plugins: {
                legend: {
                    labels: {
                        color: ct?.legend || (appState.darkMode ? '#E2E8F0' : '#0F172A'),
                        font: chartTickFont('sourceTrendChart'),
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)} ${chartLabelForUnit()}`,
                    },
                },
            },
        },
    });
}

function ensureSourceTrendChartCards() {
    const grid = document.getElementById('sourceTrendChartsGrid');
    if (!grid) return;

    const categories = getEmissionCategories();
    const validWidgets = new Set(categories.map((c) => `source-trend-${c}`));

    grid.querySelectorAll('.source-trend-category-card').forEach((card) => {
        const wid = card.getAttribute('data-widget');
        if (wid && !validWidgets.has(wid)) card.remove();
    });

    categories.forEach((category, idx) => {
        const widgetId = `source-trend-${category}`;
        const chartId = `sourceTrend_${category}`;
        let card = grid.querySelector(`[data-widget="${widgetId}"]`);
        const titleEn = `Monthly Emissions Trend — ${getCategoryDisplayName(category)}`;
        const titlePt = `Tendência Mensal de Emissões — ${getCategoryDisplayName(category)}`;

        if (!card) {
            card = document.createElement('div');
            card.className = 'chart-card widget-card source-trend-category-card';
            card.setAttribute('data-widget', widgetId);
            card.innerHTML = `
                <div class="chart-header">
                    <h3 data-en="${titleEn}" data-pt="${titlePt}">${titleEn}</h3>
                    <button type="button" class="chart-style-btn" title="Customize chart colors and font">
                        <i class="fas fa-palette"></i>
                    </button>
                </div>
                <canvas id="sourceTrendChart_${category}"></canvas>
                <button class="widget-hide" onclick="toggleWidget(this)"><i class="fas fa-eye-slash"></i></button>
            `;
            const styleBtn = card.querySelector('.chart-style-btn');
            styleBtn.addEventListener('click', () => openChartStyleModal(chartId));
            grid.appendChild(card);
        } else {
            const h3 = card.querySelector('h3');
            if (h3) {
                h3.textContent = appState.currentLanguage === 'pt' ? titlePt : titleEn;
                h3.setAttribute('data-en', titleEn);
                h3.setAttribute('data-pt', titlePt);
            }
        }

        if (appState.hiddenWidgets?.includes(widgetId)) {
            card.classList.add('hidden');
        }
    });
}

function updateSourceTrendCharts() {
    if (!window.carbonCalc?.getMonthlyTotalsByCategory) return;
    ensureSourceTrendChartCards();

    const dataByCategory = window.carbonCalc.getMonthlyTotalsByCategory();
    const labels = getMonthLabels();
    const ct = _chartTheme();
    const categories = getEmissionCategories();

    categories.forEach((category, idx) => {
        const chartId = `sourceTrend_${category}`;
        const canvas = document.getElementById(`sourceTrendChart_${category}`);
        if (!canvas) return;

        const card = canvas.closest('.widget-card');
        if (card?.classList.contains('hidden')) return;

        const cfg = getChartConfig(chartId);
        const border = cfg.borderColor || defaultPaletteColors(categories.length)[idx];
        const existing = sourceTrendChartInstances.get(category);
        if (existing) existing.destroy();

        const instance = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: getCategoryDisplayName(category),
                    data: (dataByCategory[category] || []).map(convertTonnesToDisplayValue),
                    borderColor: border,
                    backgroundColor: hexToRgba(cfg.fillColor || border, 0.12),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: border,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: chartScaleOptions(chartId, ct),
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return `${context.parsed.y.toFixed(3)} ${chartLabelForUnit()}`;
                            },
                        },
                    },
                },
            },
        });
        sourceTrendChartInstances.set(category, instance);
    });

    sourceTrendChartInstances.forEach((chart, cat) => {
        if (!categories.includes(cat)) {
            chart.destroy();
            sourceTrendChartInstances.delete(cat);
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
        if (sourceTrendChart) updateSourceTrendChart();
        updateSourceTrendCharts();
    }, 300);
});

// ============================================
// BANK RECONCILIATION CHART - Last 29 Days
// ============================================

function updateBankReconciliationChart() {
    const ct = _chartTheme();
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
    
    const bankCols = ct?.bank || [
        { border: '#0EA5E9', fill: 'rgba(14, 165, 233, 0.1)' },
        { border: '#16A34A', fill: 'rgba(22, 163, 74, 0.1)' },
        { border: '#DC2626', fill: 'rgba(220, 38, 38, 0.1)' }
    ];
    bankReconChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: appState.currentLanguage === 'en' ? 'Bank Balance' : 'Saldo Bancário',
                    data: bankBalance,
                    borderColor: bankCols[0].border,
                    backgroundColor: bankCols[0].fill,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: appState.currentLanguage === 'en' ? 'Cash In' : 'Entrada',
                    data: cashIn,
                    borderColor: bankCols[1].border,
                    backgroundColor: bankCols[1].fill,
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: appState.currentLanguage === 'en' ? 'Cash Out' : 'Saída',
                    data: cashOut,
                    borderColor: bankCols[2].border,
                    backgroundColor: bankCols[2].fill,
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
                        color: ct?.tick || (appState.darkMode ? '#94A3B8' : '#64748B'),
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        color: ct?.grid || (appState.darkMode ? '#1E293B' : '#CBD5E1')
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    ticks: {
                        color: ct?.tick || (appState.darkMode ? '#94A3B8' : '#64748B'),
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
                        color: ct?.tick || (appState.darkMode ? '#94A3B8' : '#64748B'),
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: ct?.grid || (appState.darkMode ? '#1E293B' : '#CBD5E1')
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: ct?.legend || (appState.darkMode ? '#94A3B8' : '#64748B')
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
    const ct = _chartTheme();
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
                backgroundColor: ct?.doughnut || ['#16A34A', '#DC2626'],
                borderWidth: 2,
                borderColor: ct?.pieBorder || (appState.darkMode ? '#1E1E1E' : '#FFFFFF')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: ct?.legend || (appState.darkMode ? '#94A3B8' : '#64748B'),
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
    const ct = _chartTheme();
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
                backgroundColor: ct?.accountBar || ['#0EA5E9', '#16A34A', '#F59E0B', '#DC2626'],
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
                        color: ct?.tick || (appState.darkMode ? '#94A3B8' : '#64748B'),
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        color: ct?.grid || (appState.darkMode ? '#1E293B' : '#CBD5E1')
                    }
                },
                x: {
                    ticks: {
                        color: ct?.tick || (appState.darkMode ? '#94A3B8' : '#64748B')
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
window.updateAccountsCharts = updateAccountsCharts;
window.saveChartPrefs = saveChartPrefs;
window.getChartPrefs = getChartPrefs;
window.openChartStyleModal = openChartStyleModal;
window.applyChartStylePrefs = applyChartStylePrefs;
window.resetChartStyleDefaults = resetChartStyleDefaults;
window.getChartConfig = getChartConfig;
window.ensureSourceTrendChartCards = ensureSourceTrendChartCards;


