/**
 * Organisation preferences — stored in MongoDB (user_data.org_preferences), not browser cache.
 */
(function (global) {
    let cache = {};
    let hydratedFromServer = false;
    let saveTimer = null;

    const REPORT_META_BINDINGS = [
        { id: 'projectNumberInput', key: 'projectNumber' },
        { id: 'reportingPeriodInput', key: 'reportingPeriod' },
        { id: 'issueDateInput', key: 'issueDate' },
        { id: 'reportVersionInput', key: 'reportVersion' },
        { id: 'reportStatusSelect', key: 'reportStatus' },
        { id: 'organizationProfileInput', key: 'organizationProfile' },
        { id: 'companyNameInput', key: 'companyName' },
        { id: 'companyNotes', key: 'companyNotes' },
    ];

    function orgStorageKey(baseKey) {
        const orgId = global.localStorage?.getItem('organizationId') || 'default';
        return `${baseKey}__org_${orgId}`;
    }

    function legacyLocalGet(key) {
        const scoped = global.localStorage?.getItem(orgStorageKey(key));
        if (scoped !== null) return scoped;
        return null;
    }

    function getOrgLocalItem(key, fallback = '') {
        if (Object.prototype.hasOwnProperty.call(cache, key)) {
            const v = cache[key];
            return v === null || v === undefined ? fallback : String(v);
        }
        if (!hydratedFromServer) {
            const legacy = legacyLocalGet(key);
            if (legacy !== null) return legacy;
        }
        return fallback;
    }

    function setOrgLocalItem(key, value) {
        cache[key] = value == null ? '' : String(value);
        scheduleSave();
    }

    function clearOrgPreferencesCache() {
        cache = {};
        hydratedFromServer = false;
    }

    function setYesNoControlValue(el, stored) {
        if (!el) return;
        if (el.dataset.booleanStore === '1') {
            el.value = stored === 'false' ? 'no' : stored === 'true' ? 'yes' : '';
        } else {
            el.value = stored === 'no' ? 'no' : stored === 'yes' ? 'yes' : stored || '';
        }
    }

    function applyOrgPreferencesToDOM(prefs) {
        const data = prefs || cache;
        Object.entries(data).forEach(([key, raw]) => {
            const value = raw == null ? '' : String(raw);
            const gi = document.querySelector(`[data-gi-key="${CSS.escape(key)}"]`);
            if (gi && gi.value !== value) gi.value = value;

            document.querySelectorAll(`[data-storage-key="${CSS.escape(key)}"]`).forEach((el) => {
                if (el.classList.contains('assessment-scope-yn')) {
                    setYesNoControlValue(el, value);
                } else if (el.value !== value) {
                    el.value = value;
                }
            });
        });

        REPORT_META_BINDINGS.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (!el || !Object.prototype.hasOwnProperty.call(data, key)) return;
            const value = data[key] == null ? '' : String(data[key]);
            if (el.value !== value) el.value = value;
        });

        if (data.companyName) {
            const title = document.getElementById('companyName');
            if (title) title.textContent = data.companyName;
        }
        if (data.companyLogo) {
            const logo = document.getElementById('companyLogoImg');
            if (logo) logo.src = data.companyLogo;
        }
        if (data.hiddenWidgets) {
            try {
                const ids = JSON.parse(data.hiddenWidgets);
                if (Array.isArray(ids) && global.appState) {
                    global.appState.hiddenWidgets = ids;
                    document.querySelectorAll('[data-widget]').forEach((w) => {
                        w.classList.toggle('hidden', ids.includes(w.getAttribute('data-widget')));
                    });
                }
            } catch (_e) {
                /* ignore */
            }
        }
        if (data.carbonCalcCountry && global.carbonCalc?.setCountry) {
            global.carbonCalc.setCountry(data.carbonCalcCountry);
            const countrySelect = document.getElementById('countrySelect');
            if (countrySelect) countrySelect.value = data.carbonCalcCountry;
        }
        if (data.carbonCalcReportingYear && global.carbonCalc?.setReportingYear) {
            global.carbonCalc.setReportingYear(data.carbonCalcReportingYear);
            const yr = document.getElementById('reportingYearSelect');
            if (yr) yr.value = String(data.carbonCalcReportingYear);
        }
        if (data.carbonCalcOutputUnit && global.carbonCalc?.setOutputUnit) {
            global.carbonCalc.setOutputUnit(data.carbonCalcOutputUnit);
            const ou = document.getElementById('outputUnitSelect');
            if (ou) ou.value = data.carbonCalcOutputUnit;
        }

        if (global.GeneralInfo?.applyLoginDetailsFromKnownUser) {
            global.GeneralInfo.applyLoginDetailsFromKnownUser(null, getOrgLocalItem, setOrgLocalItem);
        }
    }

    function collectOrgPreferencesFromDOM() {
        const out = { ...cache };

        document.querySelectorAll('[data-gi-key]').forEach((el) => {
            const key = el.dataset.giKey;
            if (key) out[key] = el.value == null ? '' : String(el.value);
        });

        document.querySelectorAll('[data-storage-key]').forEach((el) => {
            const key = el.dataset.storageKey;
            if (!key) return;
            if (el.classList.contains('assessment-scope-yn')) {
                if (el.dataset.booleanStore === '1') {
                    if (!el.value) out[key] = 'true';
                    else out[key] = el.value === 'yes' ? 'true' : 'false';
                } else {
                    out[key] = el.value || '';
                }
            } else {
                out[key] = el.value == null ? '' : String(el.value);
            }
        });

        REPORT_META_BINDINGS.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (el) out[key] = el.value == null ? '' : String(el.value);
        });

        const profile =
            typeof global.getKnownUserProfile === 'function' ? global.getKnownUserProfile() : null;
        if (profile) {
            if (profile.full_name) out.contactName = profile.full_name;
            if (profile.email) out.contactEmail = profile.email;
        }
        const lang =
            global.appState?.currentLanguage ||
            global.localStorage?.getItem('language') ||
            'en';
        if (global.GeneralInfo?.countryForLanguage) {
            const locCountry = global.GeneralInfo.countryForLanguage(lang);
            out.locationCountry = locCountry;
            out.carbonCalcCountry = locCountry;
        } else if (global.carbonCalc?.getCountry) {
            out.carbonCalcCountry = global.carbonCalc.getCountry();
        }
        if (global.carbonCalc?.getReportingYear) {
            out.carbonCalcReportingYear = String(global.carbonCalc.getReportingYear());
        }
        if (global.carbonCalc?.getOutputUnit) {
            out.carbonCalcOutputUnit = global.carbonCalc.getOutputUnit();
        }
        if (global.appState?.hiddenWidgets) {
            out.hiddenWidgets = JSON.stringify(global.appState.hiddenWidgets);
        }
        const logo = document.getElementById('companyLogoImg');
        if (logo?.src && logo.src.startsWith('data:')) {
            out.companyLogo = logo.src;
        }

        return out;
    }

    function hydrateFromServer(prefs) {
        cache = prefs && typeof prefs === 'object' ? { ...prefs } : {};
        hydratedFromServer = true;
        applyOrgPreferencesToDOM(cache);
    }

    function scheduleSave() {
        if (typeof global.scheduleOrgPreferencesSave === 'function') {
            global.scheduleOrgPreferencesSave();
        }
    }

    function refreshForms() {
        if (global.AssessmentScopeForm?.init) {
            global.AssessmentScopeForm.init();
        }
        if (global.GeneralInfo?.initGeneralInfoForm) {
            global.GeneralInfo.initGeneralInfoForm(getOrgLocalItem, setOrgLocalItem);
        }
        applyOrgPreferencesToDOM(cache);
    }

    global.OrgPreferences = {
        getOrgLocalItem,
        setOrgLocalItem,
        clearOrgPreferencesCache,
        hydrateFromServer,
        applyOrgPreferencesToDOM,
        collectOrgPreferencesFromDOM,
        refreshForms,
        isHydrated: () => hydratedFromServer,
    };

    global.getOrgLocalItem = getOrgLocalItem;
    global.setOrgLocalItem = setOrgLocalItem;
})(typeof window !== 'undefined' ? window : globalThis);
