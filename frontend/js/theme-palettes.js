/**
 * Preset color palettes (GUI-selectable). Applies CSS variables on :root and feeds chart colors.
 */
(function () {
    const STORAGE_KEY = 'carbonColorPalette';
    const DEFAULT_ID = 'ocean';

    function chartDefaults(primary, secondary, success, danger, warning, pieBorderLight, pieBorderDark, tickL, tickD, gridL, gridD, legL, legD) {
        return {
            yearBar: [secondary, primary, success, warning, danger, '#6610F2', '#FD7E14', '#20C997', '#E83E8C', '#343A40'],
            pie: [primary, warning, success, danger, secondary],
            lineBorder: primary,
            lineFill: hexToRgba(primary, 0.12),
            pointBg: primary,
            bank: [
                { border: primary, fill: hexToRgba(primary, 0.12) },
                { border: success, fill: hexToRgba(success, 0.12) },
                { border: danger, fill: hexToRgba(danger, 0.12) }
            ],
            doughnut: [success, danger],
            accountBar: [primary, success, warning, danger],
            pieBorderLight: pieBorderLight,
            pieBorderDark: pieBorderDark,
            tickLight: tickL,
            tickDark: tickD,
            gridLight: gridL,
            gridDark: gridD,
            legendLight: legL,
            legendDark: legD,
            changeUp: danger,
            changeDown: success,
            changeNa: secondary
        };
    }

    function hexToRgba(hex, alpha) {
        const h = (hex || '').replace('#', '');
        if (h.length !== 6) return `rgba(14, 165, 233, ${alpha})`;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    const PALETTES = {
        ocean: {
            label: { en: 'Ocean', pt: 'Oceano' },
            light: {
                '--primary-color': '#0EA5E9',
                '--primary-dark': '#0369A1',
                '--secondary-color': '#64748B',
                '--success-color': '#16A34A',
                '--danger-color': '#DC2626',
                '--warning-color': '#F59E0B',
                '--bg-main': '#F8FAFC',
                '--bg-card': '#FFFFFF',
                '--bg-sidebar': '#0F172A',
                '--bg-header': '#FFFFFF',
                '--text-primary': '#0F172A',
                '--text-secondary': '#475569',
                '--text-light': '#94A3B8',
                '--text-sidebar': '#FFFFFF',
                '--border-color': '#CBD5E1',
                '--login-gradient': 'linear-gradient(135deg, #0EA5E9 0%, #1D4ED8 100%)'
            },
            dark: {
                '--primary-color': '#38BDF8',
                '--primary-dark': '#0EA5E9',
                '--secondary-color': '#94A3B8',
                '--success-color': '#22C55E',
                '--danger-color': '#F87171',
                '--warning-color': '#FBBF24',
                '--bg-main': '#020617',
                '--bg-card': '#0F172A',
                '--bg-sidebar': '#020617',
                '--bg-header': '#0B1220',
                '--text-primary': '#E2E8F0',
                '--text-secondary': '#94A3B8',
                '--text-light': '#64748B',
                '--text-sidebar': '#F8FAFC',
                '--border-color': '#1E293B',
                '--login-gradient': 'linear-gradient(135deg, #0369A1 0%, #020617 100%)'
            },
            charts: chartDefaults(
                '#0EA5E9', '#64748B', '#16A34A', '#DC2626', '#F59E0B',
                '#FFFFFF', '#0F172A',
                '#64748B', '#94A3B8', '#CBD5E1', '#1E293B', '#0F172A', '#E2E8F0'
            )
        },
        forest: {
            label: { en: 'Forest', pt: 'Floresta' },
            light: {
                '--primary-color': '#059669',
                '--primary-dark': '#047857',
                '--secondary-color': '#64748B',
                '--success-color': '#16A34A',
                '--danger-color': '#B91C1C',
                '--warning-color': '#D97706',
                '--bg-main': '#F0FDF4',
                '--bg-card': '#FFFFFF',
                '--bg-sidebar': '#14532D',
                '--bg-header': '#FFFFFF',
                '--text-primary': '#14532D',
                '--text-secondary': '#166534',
                '--text-light': '#86EFAC',
                '--text-sidebar': '#ECFDF5',
                '--border-color': '#BBF7D0',
                '--login-gradient': 'linear-gradient(135deg, #059669 0%, #14532D 100%)'
            },
            dark: {
                '--primary-color': '#34D399',
                '--primary-dark': '#10B981',
                '--secondary-color': '#94A3B8',
                '--success-color': '#22C55E',
                '--danger-color': '#F87171',
                '--warning-color': '#FBBF24',
                '--bg-main': '#022C22',
                '--bg-card': '#065F46',
                '--bg-sidebar': '#064E3B',
                '--bg-header': '#047857',
                '--text-primary': '#ECFDF5',
                '--text-secondary': '#A7F3D0',
                '--text-light': '#6EE7B7',
                '--text-sidebar': '#ECFDF5',
                '--border-color': '#047857',
                '--login-gradient': 'linear-gradient(135deg, #047857 0%, #022C22 100%)'
            },
            charts: chartDefaults(
                '#059669', '#64748B', '#16A34A', '#B91C1C', '#D97706',
                '#FFFFFF', '#065F46',
                '#64748B', '#94A3B8', '#CBD5E1', '#1E293B', '#14532D', '#ECFDF5'
            )
        },
        sunset: {
            label: { en: 'Sunset', pt: 'Pôr do sol' },
            light: {
                '--primary-color': '#EA580C',
                '--primary-dark': '#C2410C',
                '--secondary-color': '#78716C',
                '--success-color': '#CA8A04',
                '--danger-color': '#DC2626',
                '--warning-color': '#F59E0B',
                '--bg-main': '#FFF7ED',
                '--bg-card': '#FFFFFF',
                '--bg-sidebar': '#431407',
                '--bg-header': '#FFFFFF',
                '--text-primary': '#431407',
                '--text-secondary': '#9A3412',
                '--text-light': '#FB923C',
                '--text-sidebar': '#FFEDD5',
                '--border-color': '#FED7AA',
                '--login-gradient': 'linear-gradient(135deg, #EA580C 0%, #9A3412 100%)'
            },
            dark: {
                '--primary-color': '#FB923C',
                '--primary-dark': '#EA580C',
                '--secondary-color': '#A8A29E',
                '--success-color': '#EAB308',
                '--danger-color': '#F87171',
                '--warning-color': '#FBBF24',
                '--bg-main': '#1C1917',
                '--bg-card': '#292524',
                '--bg-sidebar': '#0C0A09',
                '--bg-header': '#292524',
                '--text-primary': '#FFEDD5',
                '--text-secondary': '#FDBA74',
                '--text-light': '#A8A29E',
                '--text-sidebar': '#FFEDD5',
                '--border-color': '#44403C',
                '--login-gradient': 'linear-gradient(135deg, #9A3412 0%, #1C1917 100%)'
            },
            charts: chartDefaults(
                '#EA580C', '#78716C', '#CA8A04', '#DC2626', '#F59E0B',
                '#FFFFFF', '#292524',
                '#78716C', '#A8A29E', '#D6D3D1', '#44403C', '#431407', '#FFEDD5'
            )
        },
        royal: {
            label: { en: 'Royal', pt: 'Real' },
            light: {
                '--primary-color': '#6366F1',
                '--primary-dark': '#4F46E5',
                '--secondary-color': '#64748B',
                '--success-color': '#16A34A',
                '--danger-color': '#DC2626',
                '--warning-color': '#F59E0B',
                '--bg-main': '#EEF2FF',
                '--bg-card': '#FFFFFF',
                '--bg-sidebar': '#312E81',
                '--bg-header': '#FFFFFF',
                '--text-primary': '#1E1B4B',
                '--text-secondary': '#4338CA',
                '--text-light': '#A5B4FC',
                '--text-sidebar': '#EEF2FF',
                '--border-color': '#C7D2FE',
                '--login-gradient': 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)'
            },
            dark: {
                '--primary-color': '#818CF8',
                '--primary-dark': '#6366F1',
                '--secondary-color': '#94A3B8',
                '--success-color': '#22C55E',
                '--danger-color': '#F87171',
                '--warning-color': '#FBBF24',
                '--bg-main': '#0F0F23',
                '--bg-card': '#1E1B4B',
                '--bg-sidebar': '#0F0F23',
                '--bg-header': '#1E1B4B',
                '--text-primary': '#E0E7FF',
                '--text-secondary': '#A5B4FC',
                '--text-light': '#818CF8',
                '--text-sidebar': '#EEF2FF',
                '--border-color': '#3730A3',
                '--login-gradient': 'linear-gradient(135deg, #4F46E5 0%, #0F0F23 100%)'
            },
            charts: chartDefaults(
                '#6366F1', '#64748B', '#16A34A', '#DC2626', '#F59E0B',
                '#FFFFFF', '#1E1B4B',
                '#64748B', '#94A3B8', '#CBD5E1', '#3730A3', '#1E1B4B', '#E0E7FF'
            )
        },
        graphite: {
            label: { en: 'Graphite', pt: 'Grafite' },
            light: {
                '--primary-color': '#475569',
                '--primary-dark': '#334155',
                '--secondary-color': '#64748B',
                '--success-color': '#0D9488',
                '--danger-color': '#B91C1C',
                '--warning-color': '#CA8A04',
                '--bg-main': '#F1F5F9',
                '--bg-card': '#FFFFFF',
                '--bg-sidebar': '#1E293B',
                '--bg-header': '#FFFFFF',
                '--text-primary': '#0F172A',
                '--text-secondary': '#475569',
                '--text-light': '#94A3B8',
                '--text-sidebar': '#F8FAFC',
                '--border-color': '#CBD5E1',
                '--login-gradient': 'linear-gradient(135deg, #475569 0%, #1E293B 100%)'
            },
            dark: {
                '--primary-color': '#94A3B8',
                '--primary-dark': '#64748B',
                '--secondary-color': '#94A3B8',
                '--success-color': '#2DD4BF',
                '--danger-color': '#F87171',
                '--warning-color': '#FACC15',
                '--bg-main': '#0F172A',
                '--bg-card': '#1E293B',
                '--bg-sidebar': '#020617',
                '--bg-header': '#1E293B',
                '--text-primary': '#F1F5F9',
                '--text-secondary': '#CBD5E1',
                '--text-light': '#64748B',
                '--text-sidebar': '#F8FAFC',
                '--border-color': '#334155',
                '--login-gradient': 'linear-gradient(135deg, #334155 0%, #020617 100%)'
            },
            charts: chartDefaults(
                '#475569', '#64748B', '#0D9488', '#B91C1C', '#CA8A04',
                '#FFFFFF', '#1E293B',
                '#64748B', '#94A3B8', '#CBD5E1', '#334155', '#0F172A', '#F1F5F9'
            )
        }
    };

    function isDarkModeForPalette() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function getCarbonChartColors() {
        const id = localStorage.getItem(STORAGE_KEY) || DEFAULT_ID;
        const pal = PALETTES[id] || PALETTES[DEFAULT_ID];
        const c = pal.charts;
        const dark = isDarkModeForPalette();
        return {
            yearBar: c.yearBar,
            pie: c.pie,
            lineBorder: c.lineBorder,
            lineFill: c.lineFill,
            pointBg: c.pointBg,
            bank: c.bank,
            doughnut: c.doughnut,
            accountBar: c.accountBar,
            pieBorder: dark ? c.pieBorderDark : c.pieBorderLight,
            tick: dark ? c.tickDark : c.tickLight,
            grid: dark ? c.gridDark : c.gridLight,
            legend: dark ? c.legendDark : c.legendLight,
            changeUp: c.changeUp,
            changeDown: c.changeDown,
            changeNa: c.changeNa
        };
    }

    function applyCarbonPalette(paletteId) {
        const id = paletteId || localStorage.getItem(STORAGE_KEY) || DEFAULT_ID;
        const pal = PALETTES[id] || PALETTES[DEFAULT_ID];
        localStorage.setItem(STORAGE_KEY, id);

        const vars = isDarkModeForPalette() ? pal.dark : pal.light;
        const root = document.documentElement;
        Object.keys(vars).forEach(function (key) {
            root.style.setProperty(key, vars[key]);
        });

        const sel = document.getElementById('paletteSelect');
        if (sel && sel.value !== id) sel.value = id;

        try {
            if (typeof window.updateDashboard === 'function' && window.carbonCalc) {
                window.updateDashboard();
            }
        } catch (e) {
            console.warn('updateDashboard skipped:', e);
        }
        try {
            if (typeof window.updateAccountsCharts === 'function') {
                window.updateAccountsCharts();
            }
        } catch (e) {
            console.warn('updateAccountsCharts skipped:', e);
        }
    }

    function refreshCarbonPaletteLabels() {
        const sel = document.getElementById('paletteSelect');
        if (!sel) return;
        const lang = (typeof appState !== 'undefined' && appState.currentLanguage) ? appState.currentLanguage : 'en';
        for (let i = 0; i < sel.options.length; i++) {
            const opt = sel.options[i];
            const key = opt.value;
            if (PALETTES[key] && PALETTES[key].label) {
                opt.textContent = PALETTES[key].label[lang] || PALETTES[key].label.en;
            }
        }
        const labelEl = document.querySelector('.header-palette-label');
        if (labelEl && labelEl.getAttribute('data-' + lang)) {
            labelEl.textContent = labelEl.getAttribute('data-' + lang);
        }
    }

    let paletteUiInitialized = false;

    function initCarbonPaletteUI() {
        const sel = document.getElementById('paletteSelect');
        if (!sel || paletteUiInitialized) return;
        paletteUiInitialized = true;

        Object.keys(PALETTES).forEach(function (key) {
            const opt = document.createElement('option');
            opt.value = key;
            const lang = (typeof appState !== 'undefined' && appState.currentLanguage) ? appState.currentLanguage : 'en';
            opt.textContent = PALETTES[key].label[lang] || PALETTES[key].label.en;
            sel.appendChild(opt);
        });

        sel.value = localStorage.getItem(STORAGE_KEY) || DEFAULT_ID;
        sel.addEventListener('change', function () {
            applyCarbonPalette(sel.value);
        });

        applyCarbonPalette(sel.value);
        refreshCarbonPaletteLabels();
    }

    window.getCarbonChartColors = getCarbonChartColors;
    window.applyCarbonPalette = applyCarbonPalette;
    window.initCarbonPaletteUI = initCarbonPaletteUI;
    window.refreshCarbonPaletteLabels = refreshCarbonPaletteLabels;
})();
