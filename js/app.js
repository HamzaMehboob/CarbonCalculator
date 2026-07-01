// ============================================
// CARBON CALCULATOR - PHASE 1
// Main Application Logic
// ============================================

const DEFAULT_DATA_INPUT_KEYS = [
    'water', 'energy', 'transmissionDistribution', 'waste', 'transport', 'businessTravel', 'freight',
    'staffCommute', 'wfh', 'materials', 'refrigerants',
];

function createEmptySiteData() {
    const keys =
        Array.isArray(window.DATA_INPUT_CATEGORIES) && window.DATA_INPUT_CATEGORIES.length
            ? window.DATA_INPUT_CATEGORIES
            : DEFAULT_DATA_INPUT_KEYS;
    const data = {};
    keys.forEach((key) => {
        data[key] = [];
    });
    return data;
}

function getDataInputCategoryList() {
    return window.DATA_INPUT_CATEGORIES || DEFAULT_DATA_INPUT_KEYS;
}

/** Create dynamic data-input tab panels before reading/writing table DOM. */
function ensureDataInputDomReady() {
    if (typeof window.initDynamicDataTabs === 'function') {
        window.initDynamicDataTabs();
    } else if (typeof window.initTransportSubTabs === 'function') {
        window.initTransportSubTabs();
    }
}

/** Map Mongo/local aliases (Water, tab_questions) to canonical tabQuestions keys. */
function normalizeSiteTabQuestions(site) {
    if (!site || typeof site !== 'object') return;
    const combined = {};
    const legacy = site.tab_questions;
    if (legacy && typeof legacy === 'object') {
        Object.keys(legacy).forEach((k) => {
            if (k != null && legacy[k] != null) combined[String(k).trim()] = legacy[k];
        });
    }
    const raw = site.tabQuestions;
    if (raw && typeof raw === 'object') {
        Object.keys(raw).forEach((k) => {
            if (k != null && raw[k] != null) combined[String(k).trim()] = raw[k];
        });
    } else if (typeof raw === 'string' && raw.trim()) {
        combined.water = raw;
    }
    site.tabQuestions = {};
    delete site.tab_questions;
    const lowerToCanonical = {};
    getDataInputCategoryList().forEach((cat) => {
        lowerToCanonical[cat.toLowerCase()] = cat;
    });
    Object.keys(combined).forEach((k) => {
        const canon = lowerToCanonical[String(k).toLowerCase()];
        if (!canon) return;
        const v = String(combined[k]).trim();
        const prev = String(site.tabQuestions[canon] ?? '').trim();
        site.tabQuestions[canon] = pickBetterTabQuestionValue(canon, prev, v) || '';
    });
}

function normalizeAllSitesDataShape() {
    if (!appState.sites || typeof appState.sites !== 'object') return;
    Object.values(appState.sites).forEach((site) => {
        if (typeof window.ensureDefaultSiteData === 'function') {
            window.ensureDefaultSiteData(site);
        }
        normalizeSiteTabQuestions(site);
        ensureSiteTabQuestions(site);
    });
}

function currentSiteStorageKey(orgId) {
    return `carbonCalcCurrentSite_${orgId || getOrgIdForDataCache()}`;
}

function persistCurrentSiteId() {
    const orgId = getOrgIdForDataCache();
    if (appState.currentSite) {
        localStorage.setItem(currentSiteStorageKey(orgId), appState.currentSite);
    }
}

function restoreCurrentSiteId() {
    const orgId = getOrgIdForDataCache();
    const saved = localStorage.getItem(currentSiteStorageKey(orgId));
    if (saved && appState.sites && appState.sites[saved]) {
        appState.currentSite = saved;
    }
}

/** Use Mongo currentSiteId when this browser has no per-org site selection cached. */
function applyCurrentSiteFromOrgPrefs(prefs) {
    if (!prefs || typeof prefs !== 'object') return;
    const id = prefs.currentSiteId;
    if (!id || !appState.sites?.[id]) return;
    const orgId = localStorage.getItem('organizationId') || 'default';
    if (localStorage.getItem(currentSiteStorageKey(orgId))) return;
    appState.currentSite = id;
    persistCurrentSiteId();
}

function readLocalSitesCache(orgId) {
    const key = `carbonCalcSites_${orgId || getOrgIdForDataCache()}`;
    const raw = localStorage.getItem(key) || localStorage.getItem(LEGACY_SITES_CACHE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_e) {
        return null;
    }
}

function categoryRowsHaveMonthData(rows) {
    if (!Array.isArray(rows)) return false;
    return rows.some((row) => {
        const months = Array.isArray(row?.months) ? row.months : [];
        return months.some((v) => Number(v) > 0);
    });
}

function isDataInputRowMeaningful(row) {
    if (!row || typeof row !== 'object') return false;
    const months = Array.isArray(row.months) ? row.months : [];
    return months.some((v) => Number(v) > 0);
}

function isDataInputCategoryMeaningful(rows) {
    return categoryRowsHaveMonthData(rows);
}

function cloneDataInputRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
        description: row.description || '',
        year: row.year,
        months: Array.isArray(row.months) ? [...row.months] : [],
        emissionType: row.emissionType ?? null,
        unit: row.unit || '',
    }));
}

function mergeSiteDataInputCategories(targetSite, localSite) {
    if (!targetSite || !localSite) return targetSite;
    if (typeof window.ensureDefaultSiteData === 'function') {
        window.ensureDefaultSiteData(targetSite);
        window.ensureDefaultSiteData(localSite);
    }
    getDataInputCategoryList().forEach((category) => {
        const localRows = localSite.data?.[category];
        // Prefer browser cache when it has real month values (survives refresh before Mongo sync).
        if (categoryRowsHaveMonthData(localRows)) {
            targetSite.data[category] = cloneDataInputRows(localRows);
        }
    });
    mergeSiteTabQuestions(targetSite, localSite);
    return targetSite;
}

function isTabQuestionPromptText(category, text) {
    const t = String(text || '').trim();
    if (!t) return false;
    const prompt = TAB_QUESTION_PROMPTS[category];
    return Boolean(prompt && t === String(prompt).trim());
}

/** Prefer real user notes over empty, placeholder prompt text, or shorter stale copies. */
function pickBetterTabQuestionValue(category, valueA, valueB) {
    let a = String(valueA || '').trim();
    let b = String(valueB || '').trim();
    if (isTabQuestionPromptText(category, a)) a = '';
    if (isTabQuestionPromptText(category, b)) b = '';
    if (!a) return b;
    if (!b) return a;
    return a.length >= b.length ? a : b;
}

function mergeSiteTabQuestions(targetSite, localSite) {
    if (!targetSite || !localSite) return targetSite;
    normalizeSiteTabQuestions(targetSite);
    normalizeSiteTabQuestions(localSite);
    const localQ = localSite.tabQuestions;
    if (!targetSite.tabQuestions || typeof targetSite.tabQuestions !== 'object') {
        targetSite.tabQuestions = {};
    }
    getDataInputCategoryList().forEach((key) => {
        const merged = pickBetterTabQuestionValue(
            key,
            targetSite.tabQuestions[key],
            localQ && typeof localQ === 'object' ? localQ[key] : ''
        );
        targetSite.tabQuestions[key] = merged || '';
    });
    return targetSite;
}

function mergeSitesPreferNonEmptyLocal(serverSites, localSites) {
    if (!localSites || typeof localSites !== 'object') return serverSites;
    const merged = { ...(serverSites || {}) };
    Object.keys(localSites).forEach((siteId) => {
        if (!merged[siteId]) {
            merged[siteId] = localSites[siteId];
            return;
        }
        merged[siteId] = mergeSiteDataInputCategories(merged[siteId], localSites[siteId]);
    });
    return merged;
}

function normalizeDataRowYearInputs() {
    document.querySelectorAll('.data-row').forEach((row) => {
        let yearInput = row.querySelector('.row-display-year');
        if (!yearInput) {
            yearInput = row.querySelector('input[type="number"]:not(.month-input)');
            if (yearInput) yearInput.classList.add('row-display-year');
        }
    });
}

function syncCanonicalBeforeSiteSave() {
    normalizeDataRowYearInputs();
}

function hasMeaningfulDataInputRowData(rowData) {
    if (!rowData || typeof rowData !== 'object') return false;
    const description = String(rowData.description || '').trim();
    if (description) return true;
    const months = Array.isArray(rowData.months) ? rowData.months : [];
    return months.some((value) => Number(value) > 0);
}

function extractDataInputRowFromDom(category, row) {
    const rowYear =
        window.carbonCalc?.getRowYear?.(row) ??
        parseInt(row.querySelector('.row-display-year')?.value, 10);
    if (!Number.isFinite(rowYear)) return null;

    const emissionSelect = row.querySelector('.emission-select');
    const unitSelect = row.querySelector('.row-unit-select');

    const months = window.carbonCalc?.readRowMonthsForSave
        ? window.carbonCalc.readRowMonthsForSave(row)
        : (() => {
              const out = [];
              row.querySelectorAll('.month-input').forEach((input) => {
                  out.push(parseFloat(input.value) || 0);
              });
              return out;
          })();

    const rowData = {
        description: row.querySelector('input[type="text"]')?.value || '',
        year: rowYear,
        months,
        emissionType: emissionSelect ? emissionSelect.value : null,
        unit: unitSelect
            ? unitSelect.value
            : getPreferredUnitForCategory(category, emissionSelect ? emissionSelect.value : null),
    };

    return hasMeaningfulDataInputRowData(rowData) ? rowData : null;
}

function collectCategoryRowsForSite(site, category) {
    const table = document.getElementById(`${category}Table`);
    if (!table) {
        return cloneDataInputRows(site.data?.[category]);
    }

    const nextRows = [];
    table.querySelectorAll('.data-row').forEach((row) => {
        const rowData = extractDataInputRowFromDom(category, row);
        if (rowData) nextRows.push(rowData);
    });

    // Trust the DOM whenever the table is present — including empty after a delete.
    return nextRows;
}

function ensureSiteTabQuestions(site) {
    if (!site) return;
    if (!site.tabQuestions || typeof site.tabQuestions !== 'object') {
        site.tabQuestions = {};
    }
}

function tabQuestionsLocalStorageKey(siteId, category, orgId) {
    const resolvedOrg = orgId || getOrgIdForDataCache();
    return `tabQuestions_${resolvedOrg}_${siteId}_${category}`;
}

function readTabQuestionCachedValue(siteId, category) {
    const orgCandidates = [
        localStorage.getItem('organizationId'),
        localStorage.getItem(LAST_ORG_DATA_CACHE_KEY),
        'default',
    ].filter((id, index, arr) => id && arr.indexOf(id) === index);
    let best = '';
    orgCandidates.forEach((orgId) => {
        try {
            const cached =
                localStorage.getItem(tabQuestionsLocalStorageKey(siteId, category, orgId)) || '';
            best = pickBetterTabQuestionValue(category, best, cached);
        } catch (_e) {
            /* ignore */
        }
    });
    return best;
}

/** Write every category's tab notes to org-scoped localStorage (survives logout). */
function persistAllTabQuestionsToLocalCache(site, siteId) {
    if (!site || !siteId) return;
    ensureSiteTabQuestions(site);
    getDataInputCategoryList().forEach((category) => {
        const value = String(site.tabQuestions[category] ?? '').trim();
        try {
            localStorage.setItem(tabQuestionsLocalStorageKey(siteId, category), value);
        } catch (_e) {
            /* ignore quota */
        }
    });
}

/** Which data-input category the shared notes textarea belongs to (water, energy, …). */
function getActiveDataInputTabKey() {
    const notesEl = document.getElementById('tabQuestionNotesInput');
    // While the user is typing, keep saving to the category bound when the tab was opened.
    if (notesEl && document.activeElement === notesEl) {
        const bound = notesEl.dataset.activeCategory;
        if (bound && getDataInputCategoryList().includes(bound)) {
            return bound;
        }
    }
    // Visible tab button is authoritative when not actively editing the textarea.
    const fromNav = document.querySelector(
        '#section-data-input .tabs-nav .tab-btn.active'
    )?.getAttribute('data-tab');
    if (fromNav && getDataInputCategoryList().includes(fromNav)) {
        return fromNav;
    }
    const fromDataset = notesEl?.dataset?.activeCategory;
    if (fromDataset && getDataInputCategoryList().includes(fromDataset)) {
        return fromDataset;
    }
    if (
        appState.activeDataTab &&
        getDataInputCategoryList().includes(appState.activeDataTab)
    ) {
        return appState.activeDataTab;
    }
    return 'water';
}

/** Hide guidance prompt text in the textarea only — never drop it on save. */
function tabQuestionNotesForDisplay(category, text) {
    const value = text == null ? '' : String(text);
    return isTabQuestionPromptText(category, value) ? '' : value;
}

/** Avoid wiping stored notes when the shared textarea is still empty (e.g. before UI hydrate). */
function shouldPersistTabQuestionValue(category, text, site, notesEl, options = {}) {
    const trimmed = String(text ?? '').trim();
    const existing = String(site.tabQuestions[category] ?? '').trim();
    if (trimmed) return true;
    if (!existing) return true;
    if (options.force) return true;
    if (options.fromUi && notesEl?.dataset?.tabNotesDirty === '1') return true;
    return false;
}

function persistTabQuestionNotesForCategory(category, text, options = {}) {
    const siteId = appState.currentSite;
    const site = appState.sites[siteId];
    if (!site || !category) return;
    ensureSiteTabQuestions(site);
    const notesEl = document.getElementById('tabQuestionNotesInput');
    if (!shouldPersistTabQuestionValue(category, text, site, notesEl, options)) return;
    const value = String(text ?? '').trim();
    site.tabQuestions[category] = value;
    try {
        localStorage.setItem(tabQuestionsLocalStorageKey(siteId, category), value);
    } catch (_e) {
        /* ignore quota */
    }
}

/** Merge per-tab notes from org-scoped localStorage into site (all categories). */
function hydrateTabQuestionsFromLocalCache(site, siteId) {
    if (!site || !siteId) return;
    ensureSiteTabQuestions(site);
    getDataInputCategoryList().forEach((category) => {
        const cached = readTabQuestionCachedValue(siteId, category);
        const merged = pickBetterTabQuestionValue(
            category,
            site.tabQuestions[category],
            cached
        );
        if (merged) {
            site.tabQuestions[category] = merged;
        } else if (site.tabQuestions[category] && isTabQuestionPromptText(category, site.tabQuestions[category])) {
            site.tabQuestions[category] = '';
        }
    });
}

/** Persist active textarea + every cached per-tab key into the current site before Mongo/local save. */
function syncAllTabQuestionsToSite() {
    const siteId = appState.currentSite;
    const site = appState.sites?.[siteId];
    if (!site) return;
    flushActiveTabQuestionNotes();
    hydrateTabQuestionsFromLocalCache(site, siteId);
    persistAllTabQuestionsToLocalCache(site, siteId);
}

function syncTabQuestionsFromDomToSite() {
    const site = appState.sites[appState.currentSite];
    if (!site) return;
    const notesEl = document.getElementById('tabQuestionNotesInput');
    const category = getActiveDataInputTabKey();
    if (!notesEl || !category) return;
    persistTabQuestionNotesForCategory(category, notesEl.value || '', {
        fromUi: notesEl.dataset.tabNotesDirty === '1',
    });
}

/** Persist the shared notes textarea into the site for the active data-input category. */
function flushActiveTabQuestionNotes() {
    const tabNotesInput = document.getElementById('tabQuestionNotesInput');
    const category = getActiveDataInputTabKey();
    if (!tabNotesInput || !category) return;
    persistTabQuestionNotesForCategory(category, tabNotesInput.value || '', {
        fromUi: tabNotesInput.dataset.tabNotesDirty === '1',
    });
}

function flushTabQuestionNotesForCategory(category) {
    const tabNotesInput = document.getElementById('tabQuestionNotesInput');
    if (!category || !tabNotesInput) return;
    persistTabQuestionNotesForCategory(category, tabNotesInput.value || '', {
        fromUi: tabNotesInput.dataset.tabNotesDirty === '1',
    });
}

function collectCurrentSiteDataInput(site) {
    if (!site) return;
    syncCanonicalBeforeSiteSave();

    if (!site.data || typeof site.data !== 'object') {
        site.data = createEmptySiteData();
    }

    getDataInputCategoryList().forEach((category) => {
        site.data[category] = collectCategoryRowsForSite(site, category);
    });
}

// Global State
const appState = {
    currentLanguage: 'en',
    darkMode: false,
    loggedIn: false,
    dataHydrated: false,
    loadingSiteData: false,
    activeDataTab: 'water',
    currentSite: 'site-1',
    sites: {
        'site-1': {
            name: 'Headquarters',
            companyName: 'My Company',
            notes: '',
            data: createEmptySiteData(),
            financials: {
                bankBalance: 0,
                savingsBalance: 0,
                cashIn: 0,
                cashOut: 0,
                invoicesOwed: 0,
                billsToPay: 0
            },
            tabQuestions: {},
            invoices: [],
            bills: [],
            cashTransactions: { cashIn: [], cashOut: [] },
            monthlyCashFlow: {}
        }
    },
    hiddenWidgets: []
};

// ============================================
// LOGIN & SIGNUP SYSTEM (MongoDB Integration)
// ============================================

// Default API; prefer resolveApiBaseUrl() from js/api-config.js (local vs Render, GitHub Pages).
const API_BASE_URL_DEFAULT = 'https://carboncalculator-2eak.onrender.com/api';

function getApiBaseUrl() {
    if (typeof resolveApiBaseUrl === 'function') {
        return resolveApiBaseUrl();
    }
    return API_BASE_URL_DEFAULT;
}

function getOrgApiHeaders(extraHeaders) {
    const headers = { ...(extraHeaders || {}) };
    const token = getActiveAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const orgId = localStorage.getItem('organizationId');
    if (orgId) headers['X-Organization-Id'] = orgId;
    return headers;
}
window.getOrgApiHeaders = getOrgApiHeaders;
window.getApiBaseUrl = getApiBaseUrl;

function applyUserSessionFromLogin(user) {
    if (!user) return;
    localStorage.setItem('userName', user.full_name || '');
    localStorage.setItem('isOrgAdmin', user.is_org_admin ? 'true' : 'false');
    localStorage.setItem('isPlatformAdmin', user.is_platform_admin ? 'true' : 'false');
    localStorage.setItem('isConsultant', user.is_consultant ? 'true' : 'false');
    if (user.email) localStorage.setItem('userEmail', user.email);
}

function selectOrganizationMembership(membership) {
    if (!membership) return;
    const orgId = membership.organization_id || '';
    const orgName = membership.organization_name || membership.company_name || 'My Company';
    localStorage.setItem('organizationId', orgId);
    localStorage.setItem('organizationName', orgName);
    localStorage.setItem('companyName', orgName);
    rememberOrgIdForDataCache(orgId);
    ensureOrganizationSession(orgId, orgName);
}

function showOrgPickerModal(memberships, onChosen) {
    let overlay = document.getElementById('orgPickerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'orgPickerOverlay';
        overlay.className = 'org-picker-overlay';
        overlay.innerHTML = `
            <div class="org-picker-card">
                <h2 data-en="Select organisation" data-pt="Selecionar organização">Select organisation</h2>
                <p data-en="Choose which organisation to work on." data-pt="Escolha a organização para trabalhar.">Choose which organisation to work on.</p>
                <div id="orgPickerList" class="org-picker-list"></div>
            </div>`;
        document.body.appendChild(overlay);
    }
    const list = overlay.querySelector('#orgPickerList');
    list.innerHTML = '';
    memberships.forEach((m) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-primary org-picker-btn';
        btn.textContent = m.organization_name || m.organization_id || 'Organisation';
        btn.addEventListener('click', () => {
            overlay.style.display = 'none';
            onChosen(m);
        });
        list.appendChild(btn);
    });
    overlay.style.display = 'flex';
}

function completeLoginFlow(user) {
    applyUserSessionFromLogin(user);
    const memberships = Array.isArray(user?.memberships) ? user.memberships : [];
    if (memberships.length > 1) {
        showOrgPickerModal(memberships, (chosen) => {
            selectOrganizationMembership(chosen);
            enterMainAppAfterLogin(user);
        });
        return;
    }
    if (memberships.length === 1) {
        selectOrganizationMembership(memberships[0]);
    } else if (user) {
        selectOrganizationMembership({
            organization_id: user.organization_id,
            organization_name: user.organization_name || user.company_name,
        });
    }
    enterMainAppAfterLogin(user);
}

function enterMainAppAfterLogin(user) {
    const allowOrgMainApp = localStorage.getItem('orgOpenMainApp') === 'true';
    const isPlatformAdmin =
        user?.is_platform_admin || localStorage.getItem('isPlatformAdmin') === 'true';
    const isConsultant = user?.is_consultant || localStorage.getItem('isConsultant') === 'true';

    if (isPlatformAdmin && !allowOrgMainApp) {
        window.location.href = 'platform-admin.html';
        return;
    }
    if (isConsultant && !allowOrgMainApp) {
        window.location.href = 'consultant-workbench.html';
        return;
    }
    if (user && user.is_org_admin && !isPlatformAdmin && !isConsultant && !allowOrgMainApp) {
        window.location.href = 'organization-users.html';
        return;
    }
    localStorage.removeItem('orgOpenMainApp');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    initializeApp();
}

const SESSION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_EXPIRES_AT_KEY = 'sessionExpiresAt';
const SESSION_LAST_ACTIVITY_KEY = 'sessionLastActivity';
let sessionMonitorStarted = false;
let sessionExpiryHandled = false;
const TAB_QUESTION_PROMPTS = {
    water: 'Water tab: include meter source, estimated readings, and any anomalies.',
    energy: 'Energy tab: include billing period type (calendar/financial), tariff notes, and kWh data source.',
    transmissionDistribution:
        'Transmission & distribution tab: UK electricity T&D losses and district heat & steam (kWh), per datasheet.',
    waste: 'Waste tab: include weighing source, uplift frequency, and conversion assumptions.',
    transport: 'Company fleet tab: include vehicle types, mileage evidence, and fuel card data sources.',
    businessTravel: 'Business travel tab: include flights, rail, hotel stays, and expense report sources.',
    freight: 'Freighting goods tab: include tonne-km or shipment records and carrier data.',
    staffCommute: 'Staff commute tab: include survey method, average distances, and working days.',
    wfh: 'Working from home tab: include remote working days/hours and occupancy assumptions.',
    materials: 'Materials tab: include purchase records, weights, and material types.',
    refrigerants: 'Refrigerants tab: include top-up records, service sheets, and gas type evidence.',
};
const QA_CHECKLIST_KEY = 'qaChecklistState';
const QA_ALLOWED_EMAIL = 'rd.hamza@isys.sa';
const LAST_LOADED_ORG_KEY = 'lastLoadedOrganizationId';
/** Survives logout so org-scoped site/tab-notes cache keys still resolve after login. */
const LAST_ORG_DATA_CACHE_KEY = 'lastOrganizationIdForDataCache';
const LEGACY_SITES_CACHE_KEY = 'carbonCalcSites';

function getOrgIdForDataCache() {
    return (
        localStorage.getItem('organizationId') ||
        localStorage.getItem(LAST_ORG_DATA_CACHE_KEY) ||
        'default'
    );
}

function rememberOrgIdForDataCache(orgId) {
    if (!orgId) return;
    localStorage.setItem(LAST_ORG_DATA_CACHE_KEY, orgId);
}

let knownUserProfile = null;

function getKnownUserProfile() {
    return knownUserProfile;
}

function setKnownUserProfile(profile) {
    if (!profile || typeof profile !== 'object') return;
    knownUserProfile = {
        full_name: profile.full_name || profile.fullName || '',
        email: profile.email || '',
    };
    if (knownUserProfile.full_name) {
        localStorage.setItem('userName', knownUserProfile.full_name);
    }
    if (knownUserProfile.email) {
        localStorage.setItem('userEmail', knownUserProfile.email);
    }
    if (window.GeneralInfo?.applyLoginDetailsFromKnownUser) {
        window.GeneralInfo.applyLoginDetailsFromKnownUser(
            knownUserProfile,
            getOrgLocalItem,
            setOrgLocalItem
        );
    }
}

window.getKnownUserProfile = getKnownUserProfile;
window.setKnownUserProfile = setKnownUserProfile;

const ORG_SCOPED_PREF_KEYS = [
    'companyName', 'companyNotes', 'companyLogo', 'hiddenWidgets',
    'projectNumber', 'reportingPeriod', 'issueDate', 'reportVersion', 'reportStatus',
    'scope1Enabled', 'scope2Enabled', 'scope3Enabled',
    'hotelStayEnabled', 'wfhEnabled', 'materialsEnabled',
    'orgRegisteredAddress', 'organizationProfile', 'buildingsAssessedCount',
    'assessmentOrgName', 'assessmentBaseYear', 'assessmentPeriodDetail', 'scopeStreamsSummary',
    'assessmentGeneralNotes', 'assessmentExtraNote1', 'assessmentExtraNote2',
    'assessmentCalculationUnit', 'netZeroCommitment', 'energyIncluded',
    'electricityIncluded', 'electricityUnit', 'gasIncluded', 'gasUnit', 'elecDistLossIncluded', 'elecDistLossUnit',
    'waterIncluded', 'wasteWaterIncluded', 'wasteWaterUnit', 'wasteIncluded',
    'fleetIncluded', 'businessTravelIncluded', 'businessTravelUnit', 'refrigerantIncluded',
    'hotelStayUnit', 'wfhUnit', 'materialsUnit',
    'carbonReductionPlanDesc', 'offsetStrategyDesc', 'elaborateSubmitReviewDesc',
    'policyEnvIso14001', 'policyHumanRights', 'policySustainableProcurement',
    'policyEnergyAudit', 'policyOdsGri', 'otherStandardRequiredIntl',
    'intlEcoAuditActionPlan', 'intlBreeamInUse', 'intlCarbonReductionPlan',
    'intlScienceBasedTargets', 'intlCibseBenchmark', 'intlFitwell', 'intlCrremEu',
    'intlNabersUk', 'intlGresb', 'intlLeedsOm', 'intlWellStandard', 'intlEcoChurch',
    'intlGhgProtocol', 'intlSasb', 'intlSfdr', 'intlGri', 'intlEuTaxonomy', 'intlSkaRating',
    'orgCount', 'assetAddress', 'buildingProfile', 'occupancyDimensions', 'assetOptionalFields',
    'eventGeneralInfo', 'eventOperationalInputs', 'eventInclusionWorkflow', 'onboardingReferences',
    ...(window.GeneralInfo?.STORAGE_KEYS || []),
    'waterUnit', 'energyUnit', 'wasteUnit', 'transportUnit', 'refrigerantsUnit',
    'otherEmissions', 'standardsPolicies', 'otherStandardRequired',
    'carbonCalcCountry', 'carbonCalcReportingYear', 'carbonCalcOutputUnit',
];

function orgStorageKey(baseKey) {
    const orgId = localStorage.getItem('organizationId') || 'default';
    return `${baseKey}__org_${orgId}`;
}

function getOrgLocalItem(baseKey, fallback = '') {
    if (window.OrgPreferences?.getOrgLocalItem) {
        return window.OrgPreferences.getOrgLocalItem(baseKey, fallback);
    }
    const scoped = localStorage.getItem(orgStorageKey(baseKey));
    if (scoped !== null) return scoped;
    return fallback;
}

function setOrgLocalItem(baseKey, value) {
    if (window.OrgPreferences?.setOrgLocalItem) {
        window.OrgPreferences.setOrgLocalItem(baseKey, value);
        return;
    }
    localStorage.setItem(orgStorageKey(baseKey), value == null ? '' : String(value));
}

function clearLegacyGlobalFormCache() {
    ORG_SCOPED_PREF_KEYS.forEach((key) => localStorage.removeItem(orgStorageKey(key)));
    localStorage.removeItem(LEGACY_SITES_CACHE_KEY);
    if (window.OrgPreferences?.clearOrgPreferencesCache) {
        window.OrgPreferences.clearOrgPreferencesCache();
    }
}

function collectLegacyOrgPreferencesFromLocalStorage() {
    const out = {};
    ORG_SCOPED_PREF_KEYS.forEach((key) => {
        const scoped = localStorage.getItem(orgStorageKey(key));
        if (scoped !== null && scoped !== '') out[key] = scoped;
    });
    const paletteLight = localStorage.getItem('carbonColorPalette_light');
    const paletteDark = localStorage.getItem('carbonColorPalette_dark');
    if (paletteLight) out.carbonPaletteLight = paletteLight;
    if (paletteDark) out.carbonPaletteDark = paletteDark;
    const chartPrefs = localStorage.getItem('carbonChartPreferences');
    if (chartPrefs) out.dashboardChartPreferences = chartPrefs;
    if (localStorage.getItem('language')) out.uiLanguage = localStorage.getItem('language');
    if (localStorage.getItem('darkMode')) out.uiDarkMode = localStorage.getItem('darkMode');
    const qa = localStorage.getItem(QA_CHECKLIST_KEY);
    if (qa) out.qaChecklistState = qa;
    return out;
}

/** Fill gaps in server org_preferences from local cache (never overwrite non-empty server values). */
function mergeOrgPreferencesPreferLocal(serverPrefs, localPrefs) {
    const merged = { ...(serverPrefs && typeof serverPrefs === 'object' ? serverPrefs : {}) };
    if (!localPrefs || typeof localPrefs !== 'object') return merged;
    Object.keys(localPrefs).forEach((key) => {
        const localVal = localPrefs[key];
        const localStr = localVal == null ? '' : String(localVal).trim();
        if (!localStr) return;
        const serverStr = String(merged[key] == null ? '' : merged[key]).trim();
        if (!serverStr || localStr.length > serverStr.length) {
            merged[key] = localVal;
        }
    });
    return merged;
}

function ensureSiteRecordComplete(site) {
    if (!site || typeof site !== 'object') return site;
    if (typeof window.ensureDefaultSiteData === 'function') {
        window.ensureDefaultSiteData(site);
    }
    ensureSiteTabQuestions(site);
    if (!site.financials || typeof site.financials !== 'object') {
        site.financials = {
            bankBalance: 0,
            savingsBalance: 0,
            cashIn: 0,
            cashOut: 0,
            invoicesOwed: 0,
            billsToPay: 0,
        };
    }
    if (!Array.isArray(site.invoices)) site.invoices = [];
    if (!Array.isArray(site.bills)) site.bills = [];
    if (!site.cashTransactions || typeof site.cashTransactions !== 'object') {
        site.cashTransactions = { cashIn: [], cashOut: [] };
    }
    if (!site.monthlyCashFlow || typeof site.monthlyCashFlow !== 'object') {
        site.monthlyCashFlow = {};
    }
    return site;
}

function ensureAllSitesRecordComplete() {
    if (!appState.sites || typeof appState.sites !== 'object') return;
    Object.keys(appState.sites).forEach((siteId) => {
        ensureSiteRecordComplete(appState.sites[siteId]);
    });
}

let orgPreferencesSaveTimer = null;
let siteDataSaveTimer = null;

function scheduleOrgPreferencesSave() {
    if (!appState.loggedIn) return;
    if (orgPreferencesSaveTimer) clearTimeout(orgPreferencesSaveTimer);
    orgPreferencesSaveTimer = setTimeout(() => {
        orgPreferencesSaveTimer = null;
        saveUserDataToBackend();
    }, 800);
}
window.scheduleOrgPreferencesSave = scheduleOrgPreferencesSave;

/** Debounced MongoDB sync for sites (water, energy, all data-input rows). */
function scheduleSiteDataSave() {
    if (!appState.loggedIn) return;
    if (siteDataSaveTimer) clearTimeout(siteDataSaveTimer);
    siteDataSaveTimer = setTimeout(() => {
        siteDataSaveTimer = null;
        saveUserDataToBackend();
    }, 1000);
}
window.scheduleSiteDataSave = scheduleSiteDataSave;

function flushSiteDataSave(options) {
    if (siteDataSaveTimer) {
        clearTimeout(siteDataSaveTimer);
        siteDataSaveTimer = null;
    }
    const opts = { ...(options || {}), force: true };
    return saveUserDataToBackend(opts);
}
window.flushSiteDataSave = flushSiteDataSave;

function createDefaultSitesState(companyName) {
    const name = companyName || 'My Company';
    return {
        'site-1': {
            name: 'Headquarters',
            companyName: name,
            notes: '',
            data: createEmptySiteData(),
            financials: {
                bankBalance: 0,
                savingsBalance: 0,
                cashIn: 0,
                cashOut: 0,
                invoicesOwed: 0,
                billsToPay: 0,
            },
            tabQuestions: {},
            invoices: [],
            bills: [],
            cashTransactions: { cashIn: [], cashOut: [] },
            monthlyCashFlow: {},
        },
    };
}

function resetAppStateForCompany(companyName) {
    appState.sites = createDefaultSitesState(companyName);
    appState.currentSite = 'site-1';
}

function refreshAssessmentScopeForm() {
    if (window.AssessmentScopeForm?.init) {
        window.AssessmentScopeForm.init();
    }
    bindAssessmentScopeExtras();
}

function syncToolbarOutputUnitToAssessmentScope(outputUnit) {
    const calcUnit = outputUnit === 'kgCO2e' ? 'kg_co2e' : 'tonnes_co2e';
    if (typeof setOrgLocalItem === 'function') {
        setOrgLocalItem('assessmentCalculationUnit', calcUnit);
    }
    const asSel = document.querySelector(
        '.assessment-scope-unit[data-storage-key="assessmentCalculationUnit"]'
    );
    if (asSel && Array.from(asSel.options).some((o) => o.value === calcUnit)) {
        asSel.value = calcUnit;
    }
    if (window.AssessmentScopeUnits?.applyCalculationUnitCascade) {
        window.AssessmentScopeUnits.applyCalculationUnitCascade(calcUnit, { skipCarbonCalc: true });
    }
}

function syncOutputUnitSelectValues(unit) {
    const normalized = unit === 'kgCO2e' ? 'kgCO2e' : 'tCO2e';
    ['outputUnitSelect', 'reportOutputUnitSelect'].forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.value !== normalized) {
            el.value = normalized;
        }
    });
}
window.syncOutputUnitSelectValues = syncOutputUnitSelectValues;

function bindOutputUnitControl(select) {
    if (!select || select.dataset.outputUnitBound === '1') return;
    select.dataset.outputUnitBound = '1';
    select.addEventListener('change', () => {
        const unit = select.value === 'kgCO2e' ? 'kgCO2e' : 'tCO2e';
        syncOutputUnitSelectValues(unit);
        if (window.carbonCalc?.setOutputUnit) {
            window.carbonCalc.setOutputUnit(unit);
        }
    });
}

function bindOutputUnitControls() {
    bindOutputUnitControl(document.getElementById('outputUnitSelect'));
    bindOutputUnitControl(document.getElementById('reportOutputUnitSelect'));
}
window.bindOutputUnitControls = bindOutputUnitControls;

function bindAssessmentScopeExtras() {
    const bindScope = (el, key) => {
        if (!el || el.dataset.bound === '1') return;
        el.dataset.bound = '1';
        el.checked = getOrgLocalItem(key, 'true') !== 'false';
        el.addEventListener('change', () => {
            setOrgLocalItem(key, el.checked ? 'true' : 'false');
            if (window.carbonCalc?.calculateAllTotals) {
                window.carbonCalc.calculateAllTotals();
            }
            if (typeof updateDashboard === 'function') {
                updateDashboard();
            }
        });
    };
    bindScope(document.getElementById('scope1EnabledInput'), 'scope1Enabled');
    bindScope(document.getElementById('scope2EnabledInput'), 'scope2Enabled');
    bindScope(document.getElementById('scope3EnabledInput'), 'scope3Enabled');

    bindOutputUnitControls();

    if (window.carbonCalc?.rebuildConversionFactorCheckboxes) {
        window.carbonCalc.rebuildConversionFactorCheckboxes();
    }
    if (window.carbonCalc?.syncAllDataInputRowsFromFactorUnits) {
        window.carbonCalc.syncAllDataInputRowsFromFactorUnits();
    }
}
window.bindAssessmentScopeExtras = bindAssessmentScopeExtras;
window.syncToolbarOutputUnitToAssessmentScope = syncToolbarOutputUnitToAssessmentScope;

function ensureOrganizationSession(orgId, companyName) {
    if (!orgId) return;
    rememberOrgIdForDataCache(orgId);
    const previousOrgId = localStorage.getItem(LAST_LOADED_ORG_KEY);
    if (previousOrgId && previousOrgId !== orgId) {
        clearLegacyGlobalFormCache();
        resetAppStateForCompany(companyName);
    }
    localStorage.removeItem(LEGACY_SITES_CACHE_KEY);
    localStorage.setItem(LAST_LOADED_ORG_KEY, orgId);
    if (companyName) {
        setOrgLocalItem('companyName', companyName);
        localStorage.setItem('companyName', companyName);
    }
    refreshAssessmentScopeForm();
}

function normalizeAccountEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function isQaAllowedUser() {
    if (!appState.loggedIn) return false;
    const email = normalizeAccountEmail(
        localStorage.getItem('userEmail') || localStorage.getItem('loginEmail')
    );
    return email === QA_ALLOWED_EMAIL;
}

function applyQaVisibility() {
    const show = isQaAllowedUser();
    document.querySelectorAll('.sub-nav-btn[data-sub="qa-signoff"]').forEach((btn) => {
        btn.style.display = show ? '' : 'none';
    });
    const qaSection = document.getElementById('section-qa-signoff');
    if (qaSection && !show) {
        qaSection.style.display = 'none';
        qaSection.classList.remove('active');
        const activeQaBtn = document.querySelector('.sub-nav-btn[data-sub="qa-signoff"].active');
        if (activeQaBtn) {
            setActiveSubNav('data-input');
        }
    }
}

function getQaSubNavButtonHtml() {
    if (!isQaAllowedUser()) return '';
    return `
            <button class="sub-nav-btn" data-sub="qa-signoff">
                <i class="fas fa-check-double"></i> <span data-en="QA & Sign-off" data-pt="QA e Aprovação">QA & Sign-off</span>
            </button>`;
}

function getQaChecklistState() {
    try {
        return JSON.parse(localStorage.getItem(QA_CHECKLIST_KEY) || '{}');
    } catch {
        return {};
    }
}

function renderQaState() {
    const state = getQaChecklistState();
    const checks = document.querySelectorAll('.qa-check-item');
    if (!checks.length) return;
    let completed = 0;
    checks.forEach((el) => {
        const key = el.getAttribute('data-key');
        const checked = state[key] === true;
        el.checked = checked;
        if (checked) completed += 1;
    });
    const statusEl = document.getElementById('qaSignoffStatus');
    if (statusEl) {
        statusEl.textContent = completed === checks.length
            ? 'Status: QA Complete - Ready for customer sign-off'
            : `Status: Pending (${completed}/${checks.length} complete)`;
    }
}

function generateQaSummary() {
    const checks = Array.from(document.querySelectorAll('.qa-check-item'));
    const complete = checks.filter((c) => c.checked).length;
    const lines = checks.map((c) => `- [${c.checked ? 'x' : ' '}] ${c.parentElement?.textContent?.trim() || c.getAttribute('data-key')}`);
    const summary = [
        `QA Sign-off Status: ${complete === checks.length ? 'READY' : 'PENDING'}`,
        `Completed: ${complete}/${checks.length}`,
        `Reporting year: ${window.carbonCalc?.getReportingYear?.() || 'n/a'}`,
        `Output unit: ${window.carbonCalc?.getOutputUnit?.() || 'n/a'}`,
        '',
        'Checklist:',
        ...lines,
    ].join('\n');
    const out = document.getElementById('qaSignoffSummary');
    if (out) out.value = summary;
    renderQaState();
}

function copyQaSummary() {
    const out = document.getElementById('qaSignoffSummary');
    if (!out || !out.value.trim()) {
        generateQaSummary();
    }
    const text = (out?.value || '').trim();
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
}

async function getChatbotReply(message) {
    const msg = String(message || '').toLowerCase();
    const hasApi = Boolean(localStorage.getItem('authToken'));
    if (hasApi) {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${getApiBaseUrl()}/chatbot/assist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ message }),
            });
            if (response.ok) {
                const data = await response.json();
                if (data?.reply) return data.reply;
            }
        } catch (err) {
            console.warn('Chatbot API unavailable, using local fallback', err);
        }
    }
    if (msg.includes('factor')) return 'Suggested factors are selected from your country, reporting year, source, and unit. Check the row source + year + unit first.';
    if (msg.includes('anomal') || msg.includes('outlier')) return detectAnomaliesSummary();
    if (msg.includes('how') || msg.includes('use')) return 'Use Assessment Scope / Conversion Factors to set year/unit context, then enter monthly source data in Data Input. Dashboard updates from the same calculation engine.';
    if (msg.includes('what is') || msg.includes('define') || msg.includes('scope')) return 'Scope 1 = direct emissions, Scope 2 = purchased energy, Scope 3 = other indirect emissions (travel, waste, materials, etc.).';
    return 'FAQ: Ensure source + unit + year are set per row. If a factor is missing, the row shows N/A and won\'t be included in totals.';
}

function detectAnomaliesSummary() {
    const issues = [];
    getDataInputCategoryList().forEach((cat) => {
        const table = document.getElementById(`${cat}Table`);
        if (!table) return;
        table.querySelectorAll('.data-row').forEach((row, idx) => {
            const months = Array.from(row.querySelectorAll('.month-input')).map((i) => parseFloat(i.value) || 0);
            const nonZero = months.filter((v) => v > 0);
            const max = Math.max(...months, 0);
            const avg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
            if (nonZero.length === 0) issues.push(`${cat} row ${idx + 1}: all months empty/zero`);
            if (avg > 0 && max > avg * 5) issues.push(`${cat} row ${idx + 1}: possible outlier (max ${max.toFixed(2)} vs avg ${avg.toFixed(2)})`);
        });
    });
    return issues.length ? `Anomaly review:\n- ${issues.join('\n- ')}` : 'No obvious anomalies detected in current visible data.';
}

function toggleChatbotPanel(show) {
    const panel = document.getElementById('chatbotPanel');
    if (!panel) return;
    panel.style.display = show ? 'flex' : 'none';
}

async function sendChatbotMessage() {
    const input = document.getElementById('chatbotInput');
    const box = document.getElementById('chatbotMessages');
    if (!input || !box || !input.value.trim()) return;
    const userMsg = input.value.trim();
    box.innerHTML += `<div><strong>You:</strong> ${userMsg}</div>`;
    input.value = '';
    const reply = await getChatbotReply(userMsg);
    box.innerHTML += `<div style="margin-top:6px;"><strong>Assistant:</strong> ${reply}</div>`;
    box.scrollTop = box.scrollHeight;
}

const CATEGORY_DEFAULT_UNITS = {
    water: 'm3',
    energy: 'kwh',
    transmissionDistribution: 'kwh',
    waste: 'tonnes',
    transport: 'km',
    businessTravel: 'km',
    freight: 'tonne_km',
    staffCommute: 'km',
    wfh: 'day',
    materials: 'kg',
    refrigerants: 'kg',
};

function clearAuthSession() {
    // Persist tab notes + site cache before clearing auth (backup if server sync missed).
    const orgIdForCache = localStorage.getItem('organizationId') || getOrgIdForDataCache();
    if (orgIdForCache && orgIdForCache !== 'default') {
        rememberOrgIdForDataCache(orgIdForCache);
    }
    if (appState.sites && Object.keys(appState.sites).length) {
        syncAllTabQuestionsToSite();
        Object.keys(appState.sites).forEach((siteId) => {
            const site = appState.sites[siteId];
            if (site) persistAllTabQuestionsToLocalCache(site, siteId);
        });
        try {
            localStorage.setItem(
                `carbonCalcSites_${orgIdForCache}`,
                JSON.stringify(appState.sites)
            );
            if (appState.currentSite) {
                localStorage.setItem(
                    currentSiteStorageKey(orgIdForCache),
                    appState.currentSite
                );
            }
        } catch (_e) {
            /* ignore */
        }
    }
    appState.loggedIn = false;
    knownUserProfile = null;
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('loginEmail');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('authToken');
    localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
    localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    localStorage.removeItem(LEGACY_SITES_CACHE_KEY);
    localStorage.removeItem(LAST_LOADED_ORG_KEY);
    localStorage.removeItem('organizationId');
    localStorage.removeItem('organizationName');
    localStorage.removeItem('userName');
    localStorage.removeItem('isOrgAdmin');
    localStorage.removeItem('isPlatformAdmin');
    localStorage.removeItem('isConsultant');
    localStorage.removeItem('orgOpenMainApp');
    if (typeof clearOrgAdminMainAppUnlock === 'function') {
        clearOrgAdminMainAppUnlock();
    }
}

function touchSession() {
    if (!appState.loggedIn || !localStorage.getItem('authToken')) return;
    const now = Date.now();
    localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(now));
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(now + SESSION_TIMEOUT_MS));
}

function isSessionExpired() {
    const expiresAtRaw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
    if (!expiresAtRaw) return false;
    const expiresAt = parseInt(expiresAtRaw, 10);
    if (Number.isNaN(expiresAt)) return false;
    return Date.now() > expiresAt;
}

function resetSessionExpiryState() {
    sessionExpiryHandled = false;
}

async function forceLogoutForExpiredSession(showMessage = true) {
    if (sessionExpiryHandled) return;
    sessionExpiryHandled = true;
    appState.loggedIn = false;

    try {
        syncAllTabQuestionsToSite();
        if (typeof saveCurrentSiteData === 'function') saveCurrentSiteData();
        saveSitesToLocalStorage();
        if (typeof window.flushSiteDataSave === 'function') {
            await window.flushSiteDataSave({ silent: true, force: true });
        }
    } catch (err) {
        console.error('Could not save data before session expiry:', err);
    }
    clearAuthSession();
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
    if (showMessage) {
        const lang = appState.currentLanguage === 'pt' ? 'pt' : 'en';
        alert(
            lang === 'pt'
                ? 'Sua sessão expirou. Faça login novamente.'
                : 'Your session has expired. Please login again.'
        );
    }
}

function getActiveAuthToken() {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    if (isSessionExpired()) {
        forceLogoutForExpiredSession(true);
        return null;
    }
    touchSession();
    return token;
}

function startSessionMonitor() {
    if (sessionMonitorStarted) return;
    sessionMonitorStarted = true;

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => {
        document.addEventListener(evt, () => {
            if (appState.loggedIn) touchSession();
        }, { passive: true });
    });

    setInterval(() => {
        if (appState.loggedIn && isSessionExpired()) {
            void forceLogoutForExpiredSession(true);
        }
    }, 60000);
}


// Toggle between Login and Signup forms
document.getElementById('showSignup')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('signupFormContainer').style.display = 'block';
    const v = document.getElementById('verifyFormContainer');
    if (v) v.style.display = 'none';
});

document.getElementById('showLogin')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('loginFormContainer').style.display = 'block';
    document.getElementById('signupFormContainer').style.display = 'none';
    const v = document.getElementById('verifyFormContainer');
    if (v) v.style.display = 'none';
});

function parseJsonResponse(raw) {
    if (!raw || !String(raw).trim()) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function loginFailureMessage(status, payload) {
    const msg =
        (payload && (payload.msg || payload.message || payload.error)) || '';
    if (msg) return String(msg);
    if (status === 401) {
        return appState.currentLanguage === 'pt'
            ? 'E-mail ou senha inválidos.'
            : 'Invalid email or password.';
    }
    if (status === 403) {
        return appState.currentLanguage === 'pt'
            ? 'Você não tem permissão para esta ação.'
            : 'You are not authorized for this action.';
    }
    return appState.currentLanguage === 'pt'
        ? 'Não foi possível entrar. Tente novamente.'
        : 'Could not sign in. Please try again.';
}

function showVerifyPanel(prefillEmail, verificationCode) {
    const loginFormContainer = document.getElementById('loginFormContainer');
    const signupFormContainer = document.getElementById('signupFormContainer');
    const verifyFormContainer = document.getElementById('verifyFormContainer');
    if (loginFormContainer) loginFormContainer.style.display = 'none';
    if (signupFormContainer) signupFormContainer.style.display = 'none';
    if (verifyFormContainer) verifyFormContainer.style.display = 'block';
    const ve = document.getElementById('verifyEmail');
    if (ve && prefillEmail) ve.value = prefillEmail;
    const verr = document.getElementById('verifyError');
    const vok = document.getElementById('verifySuccess');
    const vdev = document.getElementById('verifyDevHint');
    if (verr) verr.textContent = '';
    if (vok) vok.textContent = '';
    if (vdev) {
        vdev.textContent = verificationCode
            ? (appState.currentLanguage === 'pt' ? 'Código de verificação: ' : 'Verification code: ') + verificationCode
            : '';
    }
}

// LOGIN FORM SUBMIT
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const identifier = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginError = document.getElementById('loginError');
    
    if (loginError) loginError.textContent = '';
    
    try {
        const response =
            typeof loginPost === 'function'
                ? await loginPost(identifier, password)
                : await fetch(`${getApiBaseUrl()}/login`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ login: identifier, password }),
                      credentials: 'omit',
                      mode: 'cors',
                  });

        const raw = await response.text();
        const data = parseJsonResponse(raw);

        if (response.ok) {
            if (!data.access_token) {
                if (loginError) {
                    loginError.textContent =
                        appState.currentLanguage === 'pt'
                            ? 'Resposta inválida do servidor.'
                            : 'Invalid response from server.';
                }
                return;
            }
            appState.loggedIn = true;
            localStorage.setItem('loggedIn', 'true');
            localStorage.setItem('loginEmail', identifier);
            localStorage.setItem('authToken', data.access_token);
            resetSessionExpiryState();
            touchSession();
            startSessionMonitor();
            
            completeLoginFlow(data.user || {});
        } else {
            if (loginError) {
                loginError.textContent = loginFailureMessage(response.status, data);
            }
        }
    } catch (err) {
        console.error('Login error:', err);
        if (loginError) {
            loginError.textContent =
                typeof loginConnectionErrorMessage === 'function'
                    ? loginConnectionErrorMessage(err, appState.currentLanguage)
                    : appState.currentLanguage === 'pt'
                      ? 'Erro de conexão. O servidor está disponível?'
                      : 'Connection error. Is the backend running?';
        }
    }
});

// SIGNUP FORM SUBMIT
document.getElementById('signupForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const full_name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = (document.getElementById('signupPhone')?.value || '').trim();
    const company_name = document.getElementById('signupCompany').value;
    const password = document.getElementById('signupPassword').value;
    const confirm_password = document.getElementById('signupConfirmPassword').value;
    const signupError = document.getElementById('signupError');
    const signupSuccess = document.getElementById('signupSuccess');
    
    signupError.textContent = '';
    signupSuccess.textContent = '';
    
    if (password !== confirm_password) {
        signupError.textContent = 'Passwords do not match';
        return;
    }
    
    try {
        const response = await fetch(`${getApiBaseUrl()}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                full_name, 
                email,
                phone: phone || undefined,
                company_name, 
                password, 
                confirm_password 
            })
        });
        
        const raw = await response.text();
        const data = parseJsonResponse(raw);
        
        if (response.ok) {
            localStorage.removeItem(LEGACY_SITES_CACHE_KEY);
            localStorage.removeItem(LAST_LOADED_ORG_KEY);
            signupSuccess.textContent =
                data.msg ||
                (appState.currentLanguage === 'pt'
                    ? 'Conta da organização criada. Faça login.'
                    : 'Organization account created. Please log in.');
            setTimeout(() => {
                const loginFormContainer = document.getElementById('loginFormContainer');
                const signupFormContainer = document.getElementById('signupFormContainer');
                const verifyFormContainer = document.getElementById('verifyFormContainer');
                if (loginFormContainer) loginFormContainer.style.display = 'block';
                if (signupFormContainer) signupFormContainer.style.display = 'none';
                if (verifyFormContainer) verifyFormContainer.style.display = 'none';
                if (document.getElementById('loginEmail')) {
                    document.getElementById('loginEmail').value = email.trim();
                }
            }, 800);
        } else {
            const backendMsg =
                data.msg ||
                data.message ||
                data.error ||
                (raw && raw.length < 500 ? raw : '');
            signupError.textContent = backendMsg || 'Signup failed';
        }
    } catch (err) {
        console.error('Signup error:', err);
        signupError.textContent = 'Connection error. Is the backend running?';
    }
});

document.getElementById('verifyForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = (document.getElementById('verifyEmail')?.value || '').trim();
    const codeInput = document.getElementById('verifyCode');
    let code = (codeInput?.value || '').replace(/\D/g, '').slice(0, 6);
    if (codeInput) codeInput.value = code;
    const verr = document.getElementById('verifyError');
    const vok = document.getElementById('verifySuccess');
    if (verr) verr.textContent = '';
    if (vok) vok.textContent = '';

    if (!email || code.length !== 6) {
        if (verr) {
            verr.textContent =
                appState.currentLanguage === 'pt'
                    ? 'Informe o e-mail e o código de 6 dígitos.'
                    : 'Enter your email and the 6-digit code.';
        }
        return;
    }

    try {
        const response = await fetch(`${getApiBaseUrl()}/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        const raw = await response.text();
        const data = parseJsonResponse(raw);
        if (response.ok) {
            if (vok) {
                vok.textContent =
                    data.msg ||
                    (appState.currentLanguage === 'pt'
                        ? 'Verificado. Você já pode entrar.'
                        : 'Verified. You can log in.');
            }
            setTimeout(() => {
                document.getElementById('verifyFormContainer').style.display = 'none';
                document.getElementById('loginFormContainer').style.display = 'block';
                document.getElementById('loginEmail').value = email;
                if (codeInput) codeInput.value = '';
            }, 1200);
        } else if (verr) {
            verr.textContent = data.msg || 'Verification failed.';
        }
    } catch (err) {
        console.error(err);
        if (verr) {
            verr.textContent =
                appState.currentLanguage === 'pt'
                    ? 'Erro de conexão.'
                    : 'Connection error.';
        }
    }
});

document.getElementById('resendVerificationBtn')?.addEventListener('click', async function() {
    const email = (document.getElementById('verifyEmail')?.value || '').trim();
    const verr = document.getElementById('verifyError');
    const vok = document.getElementById('verifySuccess');
    const vdev = document.getElementById('verifyDevHint');
    if (verr) verr.textContent = '';
    if (vok) vok.textContent = '';
    if (!email) {
        if (verr) {
            verr.textContent =
                appState.currentLanguage === 'pt'
                    ? 'Informe seu e-mail.'
                    : 'Enter your email first.';
        }
        return;
    }
    try {
        const response = await fetch(`${getApiBaseUrl()}/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = parseJsonResponse(await response.text());
        if (response.ok) {
            if (vok) vok.textContent = data.msg || '';
            const codeToShow = data.verification_code || data.dev_verification_code;
            if (vdev && codeToShow) {
                vdev.textContent =
                    (appState.currentLanguage === 'pt' ? 'Código de verificação: ' : 'Verification code: ') +
                    codeToShow;
            }
        } else if (response.status === 429 && verr) {
            verr.textContent = data.msg || '';
        } else if (verr) {
            verr.textContent = data.msg || 'Could not resend.';
        }
    } catch (err) {
        console.error(err);
        if (verr) {
            verr.textContent =
                appState.currentLanguage === 'pt' ? 'Erro de conexão.' : 'Connection error.';
        }
    }
});

document.getElementById('backToLoginFromVerify')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('verifyFormContainer').style.display = 'none';
    document.getElementById('loginFormContainer').style.display = 'block';
    const verr = document.getElementById('verifyError');
    const vok = document.getElementById('verifySuccess');
    if (verr) verr.textContent = '';
    if (vok) vok.textContent = '';
});

// BACKEND DATA PERSISTENCE
async function loadUserDataFromBackend() {
    const token = getActiveAuthToken();
    if (!token) return false;

    let dataResponse;
    let factorsResponse;
    const apiFetch = typeof carbonApiFetch === 'function' ? carbonApiFetch : fetch;
    const dataHeaders = getOrgApiHeaders();
    try {
        [dataResponse, factorsResponse] = await Promise.all([
            apiFetch(`${getApiBaseUrl()}/data`, { headers: dataHeaders }),
            apiFetch(`${getApiBaseUrl()}/factors`, { headers: dataHeaders }),
        ]);
    } catch (err) {
        console.error('Error loading data from backend:', err);
        return false;
    }

    if (dataResponse.status === 401 || factorsResponse.status === 401) {
        forceLogoutForExpiredSession(true);
        return false;
    }

    let sitesLoaded = false;
    try {
        if (dataResponse.ok) {
            const data = await dataResponse.json();
            if (data.organization_id) {
                localStorage.setItem('organizationId', data.organization_id);
                rememberOrgIdForDataCache(data.organization_id);
            }
            const companyName =
                data.org_preferences?.companyName ||
                localStorage.getItem('companyName') ||
                'My Company';
            const serverSites = data.sites && typeof data.sites === 'object' ? data.sites : {};
            const hasServerSites = Object.keys(serverSites).length > 0;
            const orgId = data.organization_id || localStorage.getItem('organizationId') || 'default';
            const localSites = readLocalSitesCache(orgId);

            if (hasServerSites) {
                appState.sites = localSites
                    ? mergeSitesPreferNonEmptyLocal(serverSites, localSites)
                    : serverSites;
                normalizeAllSitesDataShape();
            } else {
                let migratedFromLocal = false;
                if (localSites && Object.keys(localSites).length > 0) {
                    appState.sites = localSites;
                    migratedFromLocal = true;
                    normalizeAllSitesDataShape();
                }
                if (!migratedFromLocal) {
                    appState.sites = createDefaultSitesState(companyName);
                } else {
                    scheduleSiteDataSave();
                }
            }
            restoreCurrentSiteId();
            Object.keys(appState.sites || {}).forEach((siteId) => {
                hydrateTabQuestionsFromLocalCache(appState.sites[siteId], siteId);
            });
            saveSitesToLocalStorage();
            sitesLoaded = true;

            const serverPrefs = data.org_preferences;
            const hasServerPrefs =
                serverPrefs && typeof serverPrefs === 'object' && Object.keys(serverPrefs).length > 0;
            if (data.user_profile) {
                setKnownUserProfile(data.user_profile);
            } else {
                setKnownUserProfile({
                    full_name: localStorage.getItem('userName') || '',
                    email:
                        localStorage.getItem('userEmail') ||
                        localStorage.getItem('loginEmail') ||
                        '',
                });
            }

            if (window.OrgPreferences?.hydrateFromServer) {
                const legacy = collectLegacyOrgPreferencesFromLocalStorage();
                if (hasServerPrefs) {
                    const mergedPrefs = mergeOrgPreferencesPreferLocal(serverPrefs, legacy);
                    window.OrgPreferences.hydrateFromServer(mergedPrefs);
                    if (Object.keys(legacy).length > 0) {
                        scheduleOrgPreferencesSave();
                    }
                } else if (Object.keys(legacy).length > 0) {
                    window.OrgPreferences.hydrateFromServer(legacy);
                    scheduleOrgPreferencesSave();
                } else {
                    window.OrgPreferences.hydrateFromServer({});
                }
                const mergedForSite =
                    hasServerPrefs && serverPrefs
                        ? mergeOrgPreferencesPreferLocal(
                              serverPrefs,
                              collectLegacyOrgPreferencesFromLocalStorage()
                          )
                        : collectLegacyOrgPreferencesFromLocalStorage();
                applyCurrentSiteFromOrgPrefs(mergedForSite);
            }

            if (window.carbonCalc?.migrateAllSitesToReportingPeriod && appState.sites) {
                const periodType = window.carbonCalc.getReportingPeriodType?.() || 'calendar';
                if (window.carbonCalc.migrateAllSitesToReportingPeriod(appState.sites, periodType)) {
                    saveSitesToLocalStorage();
                    scheduleSiteDataSave();
                }
            }
        }
    } catch (err) {
        console.error('Error parsing sites data from backend:', err);
    }

    try {
        if (factorsResponse.ok) {
            const factorsData = await factorsResponse.json();
            if (Array.isArray(factorsData) && factorsData.length > 0 && window.carbonCalc.mergeApiCatalogFactors) {
                window.carbonCalc.mergeApiCatalogFactors(factorsData);
                if (window.carbonCalc.calculateAllTotals) {
                    window.carbonCalc.calculateAllTotals();
                }
            }
        }
    } catch (err) {
        console.error('Error parsing factors from backend:', err);
    }

    return sitesLoaded;
}

async function syncOrganizationDataFromServer() {
    const companyName = localStorage.getItem('companyName') || 'My Company';
    const loadedFromBackend = await loadUserDataFromBackend();
    if (!loadedFromBackend) {
        loadSitesFromLocalStorage({ rebuildUI: false });
        if (!appState.sites || Object.keys(appState.sites).length === 0) {
            appState.sites = createDefaultSitesState(companyName);
        }
        normalizeAllSitesDataShape();
    }
    const siteIds = Object.keys(appState.sites || {});
    restoreCurrentSiteId();
    if (!appState.currentSite || !appState.sites[appState.currentSite]) {
        appState.currentSite = siteIds[0] || 'site-1';
    }
}

let dataSaveBannerTimer = null;

function showDataSaveStatus(message, isError) {
    let el = document.getElementById('dataSaveStatusBanner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'dataSaveStatusBanner';
        el.setAttribute('role', 'status');
        el.className = 'data-save-status-banner';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('data-save-status-banner--error', !!isError);
    el.classList.add('data-save-status-banner--visible');
    if (dataSaveBannerTimer) clearTimeout(dataSaveBannerTimer);
    dataSaveBannerTimer = setTimeout(() => {
        el.classList.remove('data-save-status-banner--visible');
    }, isError ? 8000 : 3500);
}

async function saveUserDataToBackend(options) {
    if (!appState.loggedIn) return false;
    if (!appState.dataHydrated && !(options && options.force === true)) return false;

    const token = getActiveAuthToken();
    if (!token) return false;

    syncAllTabQuestionsToSite();
    if (typeof saveCurrentSiteData === 'function') {
        saveCurrentSiteData();
    }
    ensureAllSitesRecordComplete();
    saveSitesToLocalStorage();
    if (siteDataSaveTimer) {
        clearTimeout(siteDataSaveTimer);
        siteDataSaveTimer = null;
    }

    const keepalive = options && options.keepalive === true;
    const silent = options && options.silent === true;
    const payload = JSON.stringify({
        sites: appState.sites,
        org_preferences: window.OrgPreferences?.collectOrgPreferencesFromDOM
            ? window.OrgPreferences.collectOrgPreferencesFromDOM()
            : {},
    });

    try {
        const apiFetch = typeof carbonApiFetch === 'function' ? carbonApiFetch : fetch;
        const response = await apiFetch(`${getApiBaseUrl()}/data`, {
            method: 'POST',
            headers: getOrgApiHeaders({ 'Content-Type': 'application/json' }),
            body: payload,
            keepalive,
        });
        if (response.status === 401) {
            forceLogoutForExpiredSession(true);
            return false;
        }
        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error('Failed to save organization data:', response.status, errBody);
            if (!silent) {
                const msg =
                    appState.currentLanguage === 'pt'
                        ? 'Não foi possível salvar os dados no servidor.'
                        : 'Could not save data to the server.';
                showDataSaveStatus(msg, true);
            }
            return false;
        }
        if (!silent && !keepalive) {
            const okMsg =
                appState.currentLanguage === 'pt' ? 'Dados salvos.' : 'Data saved.';
            showDataSaveStatus(okMsg, false);
        }
        return true;
    } catch (err) {
        console.error('Error saving data to backend:', err);
        if (!silent) {
            const msg =
                appState.currentLanguage === 'pt'
                    ? 'Erro de conexão ao salvar. Verifique se o servidor está ativo.'
                    : 'Connection error while saving. Is the backend running?';
            showDataSaveStatus(msg, true);
        }
        return false;
    }
}

window.showDataSaveStatus = showDataSaveStatus;

// LOGOUT
document.getElementById('logoutBtn')?.addEventListener('click', async function() {
    if (!(await showAppConfirm(appState.currentLanguage === 'en' ? 'Are you sure you want to logout?' : 'Tem certeza que deseja sair?'))) {
        return;
    }
    try {
        if (appState.loggedIn) {
            const notesEl = document.getElementById('tabQuestionNotesInput');
            const navTab = document.querySelector(
                '#section-data-input .tabs-nav .tab-btn.active'
            )?.getAttribute('data-tab');
            if (
                notesEl &&
                navTab &&
                getDataInputCategoryList().includes(navTab)
            ) {
                persistTabQuestionNotesForCategory(navTab, notesEl.value || '', {
                    fromUi: notesEl.dataset.tabNotesDirty === '1',
                });
            }
            syncAllTabQuestionsToSite();
            if (typeof saveCurrentSiteData === 'function') saveCurrentSiteData();
            saveSitesToLocalStorage();
            if (typeof flushSiteDataSave === 'function') {
                await flushSiteDataSave({ silent: true, force: true });
            } else {
                await saveUserDataToBackend({ silent: true, force: true });
            }
        }
    } catch (err) {
        console.error('Final sync before logout failed:', err);
    }
    clearAuthSession();
    applyQaVisibility();

    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';

    document.getElementById('loginPassword').value = '';
    if (document.getElementById('signupPassword')) document.getElementById('signupPassword').value = '';
    if (document.getElementById('signupConfirmPassword')) document.getElementById('signupConfirmPassword').value = '';
});

document.getElementById('orgUserSettingsBtn')?.addEventListener('click', function() {
    window.location.href = 'organization-users.html';
});

document.getElementById('orgAuditLogBtn')?.addEventListener('click', function() {
    window.location.href = 'organization-audit-log.html';
});

document.getElementById('switchOrgBtn')?.addEventListener('click', function() {
    localStorage.removeItem('orgOpenMainApp');
    if (typeof clearOrgAdminMainAppUnlock === 'function') {
        clearOrgAdminMainAppUnlock();
    }
    const isPlatformAdmin = localStorage.getItem('isPlatformAdmin') === 'true';
    window.location.href = isPlatformAdmin ? 'platform-admin.html' : 'consultant-workbench.html';
});

// ============================================
// TABS NAVIGATION
// ============================================

function setActiveTab(tabName) {
    const notesEl = document.getElementById('tabQuestionNotesInput');
    const prevDataTab = getActiveDataInputTabKey();
    if (
        notesEl &&
        prevDataTab &&
        getDataInputCategoryList().includes(prevDataTab)
    ) {
        persistTabQuestionNotesForCategory(prevDataTab, notesEl.value || '', {
            fromUi: notesEl.dataset.tabNotesDirty === '1',
        });
    }

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Update active states
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    const targetContent = document.querySelector(`[data-content="${tabName}"]`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // Update dashboard when switching to it
    if (tabName === 'dashboard') {
        if (window.updateDashboard) {
            updateDashboard();
        }
    } else if (tabName === 'accounts') {
        // Update accounts dashboard
        if (window.updateAccountsCharts) {
            updateAccountsCharts();
        }
        // Sync financial displays
        if (appState.currentSite && appState.sites[appState.currentSite] && appState.sites[appState.currentSite].financials) {
            Object.keys(appState.sites[appState.currentSite].financials).forEach(key => {
                const value = appState.sites[appState.currentSite].financials[key] || 0;
                updateFinancialDisplay(key, value);
            });
            if (window.updateBankReconciliationChart) {
                setTimeout(updateBankReconciliationChart, 100);
            }
            if (window.updateCashFlowChart) {
                setTimeout(updateCashFlowChart, 100);
            }
            if (window.updateAccountSummaryChart) {
                setTimeout(updateAccountSummaryChart, 100);
            }
        }
        // Populate bills and invoices lists when opening Accounts tab
        if (window.renderBillsTable) {
            window.renderBillsTable();
        }
        if (window.renderInvoicesTable) {
            window.renderInvoicesTable();
        }
    } else if (getDataInputCategoryList().includes(tabName)) {
        appState.activeDataTab = tabName;
        updateTabQuestionUI(tabName);
    }
}

function setActiveSubNav(subName) {
    if (subName === 'qa-signoff' && !isQaAllowedUser()) {
        subName = 'data-input';
    }
    const leavingDataInput =
        subName !== 'data-input' &&
        document.getElementById('section-data-input')?.classList.contains('active');
    if (leavingDataInput) {
        flushActiveTabQuestionNotes();
    }

    const subNavBtns = document.querySelectorAll('.sub-nav-btn');
    const subContentSections = document.querySelectorAll('.sub-content-section');

    // Remove active class from all buttons and sections
    subNavBtns.forEach(b => b.classList.remove('active'));
    subContentSections.forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active');
    });

    // Add active class to target button
    const targetBtn = document.querySelector(`.sub-nav-btn[data-sub="${subName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    // Show target section
    const targetSection = document.getElementById(`section-${subName}`);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
        
        // Ensure Tabs Content is visible if Data Input is selected
        const tabsContent = document.getElementById('tabsContent');
        if (subName === 'data-input') {
            tabsContent.style.display = 'block';
            const navTab = document.querySelector(
                '#section-data-input .tabs-nav .tab-btn.active'
            )?.getAttribute('data-tab');
            const category =
                navTab && getDataInputCategoryList().includes(navTab)
                    ? navTab
                    : getActiveDataInputTabKey();
            updateTabQuestionUI(category);
        } else {
            tabsContent.style.display = 'none';
        }
        if (subName === 'input-emissions') {
            updateInputEmissionsPreview();
        }
    }
}

function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            const notesEl = document.getElementById('tabQuestionNotesInput');
            const prevTab = getActiveDataInputTabKey();
            if (prevTab && prevTab !== tabName && notesEl) {
                persistTabQuestionNotesForCategory(prevTab, notesEl.value || '', {
                    fromUi: notesEl.dataset.tabNotesDirty === '1',
                });
            }
            setActiveTab(tabName);
            if (typeof saveCurrentSiteData === 'function') {
                saveCurrentSiteData();
            }
        });
    });

    // Initialize Sub Nav Buttons
    document.body.addEventListener('click', function(e) {
        const subNavBtn = e.target.closest('.sub-nav-btn');
        if (subNavBtn) {
            const subName = subNavBtn.getAttribute('data-sub');
            const dataInputSection = document.getElementById('section-data-input');
            const leavingDataInput =
                dataInputSection?.classList.contains('active') && subName !== 'data-input';
            if (leavingDataInput) {
                syncTabQuestionsFromDomToSite();
                if (typeof saveCurrentSiteData === 'function') {
                    saveCurrentSiteData();
                }
                if (typeof flushSiteDataSave === 'function') {
                    flushSiteDataSave({ silent: true, force: true });
                }
            }
            setActiveSubNav(subName);
        }
    });
}

// Expose tab switcher so sidebar circular buttons can use it
window.setActiveTab = setActiveTab;
window.setActiveSubNav = setActiveSubNav;

// ============================================
// SITE MANAGEMENT
// ============================================

document.getElementById('addSiteBtn')?.addEventListener('click', async function() {
    const siteName = await showAppPrompt(
        appState.currentLanguage === 'en' 
            ? 'Enter building/event name:' 
            : 'Digite o nome do edifício/evento:'
    );
    
    if (siteName && siteName.trim()) {
        const siteId = `site-${Date.now()}`;
        appState.sites[siteId] = {
            name: siteName.trim(),
            companyName: localStorage.getItem('companyName') || 'My Company',
            notes: localStorage.getItem('companyNotes') || '',
            data: createEmptySiteData(),
            financials: {
                bankBalance: 0,
                savingsBalance: 0,
                cashIn: 0,
                cashOut: 0,
                invoicesOwed: 0,
                billsToPay: 0
            },
            invoices: [],
            bills: [],
            cashTransactions: {
                cashIn: [],
                cashOut: []
            },
            monthlyCashFlow: {},
            tabQuestions: {}
        };
        
        addSiteToList(siteId, siteName.trim());
        switchSite(siteId);
        saveSitesToLocalStorage();
        saveUserDataToBackend();
    }
});

function addSiteToList(siteId, siteName) {
    const sitesList = document.getElementById('sitesList');
    const siteItem = document.createElement('li');
    siteItem.className = 'site-item';
    siteItem.setAttribute('data-site-id', siteId);
    siteItem.innerHTML = `
        <div class="site-main-item">
            <i class="fas fa-building"></i>
            <input type="text" class="site-name-input" value="${siteName}" placeholder="Site name">
            <button class="btn-delete"><i class="fas fa-times"></i></button>
        </div>
        <!-- Site Sub-navigation -->
        <div class="site-sub-nav">
            <button class="sub-nav-btn active" data-sub="data-input">
                <i class="fas fa-keyboard"></i> <span data-en="Data Input" data-pt="Entrada de Dados">Data Input</span>
            </button>
            <button class="sub-nav-btn" data-sub="general-info">
                <i class="fas fa-info-circle"></i> <span data-en="General Info" data-pt="Informações Gerais">General Info</span>
            </button>
            <button class="sub-nav-btn" data-sub="assessment-scope">
                <i class="fas fa-crosshairs"></i> <span data-en="Assessment Scope / Conversion Factors" data-pt="Escopo da Avaliação / Fatores de Conversão">Assessment Scope / Conversion Factors</span>
            </button>
            <button class="sub-nav-btn" data-sub="input-emissions">
                <i class="fas fa-cloud"></i> <span data-en="Input Emissions" data-pt="Emissões de Entrada">Input Emissions</span>
            </button>
            ${getQaSubNavButtonHtml()}
        </div>
    `;
    
    // Handle site name editing
    const nameInput = siteItem.querySelector('.site-name-input');
    nameInput.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    nameInput.addEventListener('blur', function() {
        const newName = this.value.trim() || 'Unnamed Site';
        this.value = newName;
        if (appState.sites[siteId]) {
            appState.sites[siteId].name = newName;
            saveSitesToLocalStorage();
            scheduleSiteDataSave();
        }
    });
    nameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            this.blur();
        }
    });
    
    siteItem.addEventListener('click', function(e) {
        if (!e.target.closest('.btn-delete') && !e.target.closest('.site-name-input')) {
            switchSite(siteId);
        }
    });
    
    siteItem.querySelector('.btn-delete').addEventListener('click', function(e) {
        e.stopPropagation();
        deleteSite(siteId, siteItem);
    });
    
    sitesList.appendChild(siteItem);
}

function switchSite(siteId) {
    // Save current site data before switching and sync to MongoDB
    if (appState.currentSite) {
        syncAllTabQuestionsToSite();
        saveCurrentSiteData();
        flushSiteDataSave();
    }

    appState.currentSite = siteId;
    persistCurrentSiteId();
    if (typeof scheduleOrgPreferencesSave === 'function') {
        scheduleOrgPreferencesSave();
    }

    document.querySelectorAll('.site-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const siteElement = document.querySelector(`[data-site-id="${siteId}"]`);
    if (siteElement) {
        siteElement.classList.add('active');
    }
    
    // Load new site data (this includes notes, company name, and all tables)
    loadSiteData(siteId);
    
    // Recalculate totals
    setTimeout(() => {
        calculateAllTotals();
    }, 200);
}

async function deleteSite(siteId, element) {
    if (Object.keys(appState.sites).length <= 1) {
        alert(appState.currentLanguage === 'en' 
            ? 'Cannot delete the last site!' 
            : 'Não é possível excluir o último local!');
        return;
    }
    
    if (await showAppConfirm(appState.currentLanguage === 'en' 
        ? 'Delete this site?' 
        : 'Excluir este local?')) {
        delete appState.sites[siteId];
        element.remove();
        saveSitesToLocalStorage();
        saveUserDataToBackend();

        if (appState.currentSite === siteId) {
            const firstSiteId = Object.keys(appState.sites)[0];
            switchSite(firstSiteId);
        }
    }
}

// ============================================
// RESET ACCOUNTS DATA (CURRENT SITE)
// ============================================

async function resetAccountsData() {
    const siteId = appState.currentSite;
    const site = appState.sites[siteId];

    if (!site) return;

    if (!(await showAppConfirm(appState.currentLanguage === 'en'
        ? 'Reset all account data (bank, savings, cash, invoices, bills)?'
        : 'Redefinir todos os dados de contas (banco, poupança, caixa, faturas, contas)?'))) {
        return;
    }

    // Reset financial-related data
    site.financials = {
        bankBalance: 0,
        savingsBalance: 0,
        cashIn: 0,
        cashOut: 0,
        invoicesOwed: 0,
        billsToPay: 0
    };
    site.invoices = [];
    site.bills = [];
    site.cashTransactions = {
        cashIn: [],
        cashOut: []
    };
    site.monthlyCashFlow = {};

    saveSitesToLocalStorage();
    if (window.saveCurrentSiteData) {
        window.saveCurrentSiteData();
    }

    // Update all financial KPI displays to 0 for this site
    if (typeof updateFinancialDisplay === 'function') {
        Object.keys(site.financials).forEach(key => {
            updateFinancialDisplay(key, site.financials[key] || 0);
        });
    }

    // Refresh all account-related visuals if functions are available
    if (window.updateBankReconciliationChart) window.updateBankReconciliationChart();
    if (window.updateCashFlowChart) window.updateCashFlowChart();
    if (window.updateAccountSummaryChart) window.updateAccountSummaryChart();
    if (window.updateMonthlyCashFlowChart) window.updateMonthlyCashFlowChart();
    if (window.updateInvoicesChart) window.updateInvoicesChart();
    if (window.updateInvoicesOwedWidget) window.updateInvoicesOwedWidget();
    if (window.updateBillsChart) window.updateBillsChart();
    if (window.updateBillsSummary) window.updateBillsSummary();
    if (window.updateBillsToPayWidget) window.updateBillsToPayWidget();
    if (window.renderBillsTable) window.renderBillsTable();
    if (window.renderInvoicesTable) window.renderInvoicesTable();
}

// ============================================
// DATA TABLE MANAGEMENT
// ============================================

function addDataRow(category) {
    const table = document.getElementById(`${category}Table`);
    if (!table) return;
    const tbody = table.querySelector('tbody');

    const row = document.createElement('tr');
    row.className = 'data-row';

    const meta = window.DATA_TAB_META?.[category];
    const reportYear = window.carbonCalc?.getReportingYear?.() || 2025;
    const defaultEmissionKey = meta?.defaultEmission || null;
    const emissionSelectHtml = getEmissionSelectHtml(category, defaultEmissionKey, reportYear);
    const defaultUnit = getPreferredUnitForCategory(category, defaultEmissionKey);
    const placeholder = meta?.placeholder || 'Description';

    row.innerHTML = `
        <td>${emissionSelectHtml}</td>
        <td><input type="text" placeholder="${placeholder}"></td>
        <td>${getUnitSelectHtml(category, defaultUnit, defaultEmissionKey)}</td>
        <td><input type="number" class="row-display-year" value="${reportYear}" min="2019" max="2035" title="Reporting year for this row (calendar Jan–Dec or financial year starting April)"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="0"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="1"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="2"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="3"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="4"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="5"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="6"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="7"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="8"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="9"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="10"></td>
        <td><input type="number" step="0.01" min="0" class="month-input" data-month="11"></td>
        <td class="total-cell">0.00</td>
        <td class="co2-cell">0.000</td>
        <td><button class="btn-delete" onclick="deleteRow(this)"><i class="fas fa-trash"></i></button></td>
    `;
    
    tbody.appendChild(row);
    const emissionSel = row.querySelector('.emission-select');
    const emissionKey = emissionSel?.value || null;
    if (emissionKey && row.cells[2]) {
        replaceRowUnitSelect(
            row,
            category,
            getPreferredUnitForCategory(category, emissionKey),
            emissionKey
        );
    }
    attachRowListeners(row);
    row.querySelectorAll('.month-input').forEach((input, slot) => {
        if (slot > 11) return;
        input.dataset.month = String(slot);
    });
}

window.addDataRow = addDataRow;

function getPreferredUnitForCategory(category, emissionKey) {
    const unitCategory =
        typeof window.resolveUnitCategoryForDataTab === 'function'
            ? window.resolveUnitCategoryForDataTab(category)
            : category;
    if (window.AssessmentScopeUnits?.resolvePreferredUnit) {
        const resolved = window.AssessmentScopeUnits.resolvePreferredUnit(unitCategory, emissionKey);
        if (resolved) return resolved;
    }
    const keyMap = {
        water: 'waterUnit',
        energy: 'energyUnit',
        transmissionDistribution: 'elecDistLossUnit',
        waste: 'wasteUnit',
        transport: 'transportUnit',
        businessTravel: 'businessTravelUnit',
        freight: 'businessTravelUnit',
        staffCommute: 'transportUnit',
        wfh: 'wfhUnit',
        materials: 'materialsUnit',
        refrigerants: 'refrigerantsUnit',
    };
    const key = keyMap[category] || keyMap[unitCategory];
    if (!key) return CATEGORY_DEFAULT_UNITS[category] || '';
    const scoped =
        typeof getOrgLocalItem === 'function' ? getOrgLocalItem(key, '') : localStorage.getItem(key);
    return scoped || CATEGORY_DEFAULT_UNITS[category] || CATEGORY_DEFAULT_UNITS[unitCategory] || '';
}

function filterEmissionOptionsForCategory(options, category) {
    if (typeof window.emissionKeyBelongsToDataCategory !== 'function') return options;
    return options.filter((opt) => window.emissionKeyBelongsToDataCategory(opt.key, category));
}

function dedupeEmissionSelectOptions(options) {
    if (window.carbonCalc?.dedupeEmissionOptions) {
        return window.carbonCalc.dedupeEmissionOptions(options);
    }
    const seen = new Set();
    return (options || []).filter((opt) => {
        const k = opt?.key;
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

function getUnitSelectHtml(category, selectedUnit, emissionKey) {
    let options;
    if (window.AssessmentScopeUnits?.getDataInputUnitOptions) {
        options = window.AssessmentScopeUnits.getDataInputUnitOptions(category, emissionKey);
    } else {
        const unitCategory =
            typeof window.resolveUnitCategoryForDataTab === 'function'
                ? window.resolveUnitCategoryForDataTab(category)
                : category;
        const unitsByCategory = {
            water: [['m3', 'm³'], ['million_litres', 'Million litres']],
            energy: [['kwh', 'kWh'], ['mwh', 'MWh'], ['gj', 'GJ'], ['mj', 'MJ'], ['therms', 'therms']],
            transmissionDistribution: [['kwh', 'kWh']],
            waste: [['tonnes', 'tonnes'], ['kg', 'kg'], ['lbs', 'lbs']],
            transport: [['km', 'km'], ['miles', 'miles'], ['passenger_km', 'passenger-km'], ['tonne_km', 'tonne-km'], ['night', 'night'], ['day', 'day']],
            refrigerants: [['kg', 'kg'], ['g', 'g'], ['lbs', 'lbs']],
        };
        options = unitsByCategory[unitCategory] || [['unit', 'unit']];
    }
    const isWaterTab = category === 'water';
    let normalized =
        selectedUnit || getPreferredUnitForCategory(category, emissionKey) || options[0][0];
    if (isWaterTab && window.AssessmentScopeUnits?.normalizeWaterRowUnit) {
        normalized = window.AssessmentScopeUnits.normalizeWaterRowUnit(normalized);
        options = options.filter(([val]) => val === 'm3' || val === 'million_litres');
        if (options.length === 0) {
            options = [
                ['m3', 'm³'],
                ['million_litres', 'Million litres'],
            ];
        }
    } else if (normalized && !options.some(([val]) => val === normalized)) {
        options = [[normalized, normalized], ...options];
    }
    let html = `<select class="row-unit-select" data-category="${category}">`;
    options.forEach(([val, label]) => {
        html += `<option value="${val}" ${val === normalized ? 'selected' : ''}>${label}</option>`;
    });
    html += '</select>';
    return html;
}

function replaceRowUnitSelect(row, category, selectedUnit, emissionKey) {
    const unitCell = row.cells?.[2];
    if (!unitCell) return null;
    unitCell.innerHTML = getUnitSelectHtml(category, selectedUnit, emissionKey);
    const unitSelect = row.querySelector('.row-unit-select');
    bindRowUnitSelect(row, unitSelect);
    return unitSelect;
}

function bindRowUnitSelect(row, unitSelect) {
    if (!unitSelect || unitSelect.dataset.unitBound === '1') return;
    unitSelect.dataset.unitBound = '1';
    unitSelect.addEventListener('change', () => {
        row.dataset.unitUserSet = '1';
        if (window.carbonCalc?.calculateRowTotal) {
            window.carbonCalc.calculateRowTotal(row);
            if (window.carbonCalc.calculateCategoryTotal) {
                window.carbonCalc.calculateCategoryTotal(row.closest('table'));
            }
        } else {
            calculateRowTotal(row);
            calculateCategoryTotal(row.closest('table'));
        }
        saveCurrentSiteData();
        if (typeof updateInputEmissionsPreview === 'function') {
            updateInputEmissionsPreview();
        }
        if (window.carbonCalc?.updateDataTableTotalColumnHeader) {
            window.carbonCalc.updateDataTableTotalColumnHeader(row.closest('table'));
        }
    });
}

const TRANSMISSION_DISTRIBUTION_EMISSION_OPTIONS = [
    {
        key: 'electricity_transmission_distribution',
        labelEn: 'T&D — UK electricity',
        labelPt: 'T&D — eletricidade UK',
    },
    {
        key: 'td_district_heat_steam',
        labelEn: 'T&D — district heat & steam',
        labelPt: 'T&D — calor distrital e vapor',
    },
];

// Build emission type dropdown HTML per category (options from conversion_factor_catalog via carbonCalc)
function getEmissionSelectHtml(category, selectedKey, year) {
    if (category === 'transmissionDistribution') {
        const defaultSelected =
            selectedKey || TRANSMISSION_DISTRIBUTION_EMISSION_OPTIONS[0].key;
        let html = `<select class="emission-select" data-category="${category}">`;
        TRANSMISSION_DISTRIBUTION_EMISSION_OPTIONS.forEach((opt) => {
            const selectedAttr = opt.key === defaultSelected ? 'selected' : '';
            html += `<option value="${opt.key}" ${selectedAttr} data-en="${opt.labelEn}" data-pt="${opt.labelPt}">${opt.labelEn}</option>`;
        });
        html += '</select>';
        return html;
    }

    const catalogCategory =
        typeof window.resolveUnitCategoryForDataTab === 'function'
            ? window.resolveUnitCategoryForDataTab(category)
            : category;

    if (window.carbonCalc && typeof window.carbonCalc.getCatalogEmissionOptions === 'function') {
        const catalogOpts = window.carbonCalc.getCatalogEmissionOptions(
            category,
            window.carbonCalc.getReportingYear?.()
        );
        const filtered = dedupeEmissionSelectOptions(
            filterEmissionOptionsForCategory(catalogOpts, category)
        );
        const defaultSelected =
            window.carbonCalc?.getCanonicalEmissionOptionKey?.(selectedKey) || selectedKey;
        if (filtered.length > 0) {
            const resolvedDefault =
                filtered.find((o) => o.key === defaultSelected)?.key || filtered[0].key;
            let html = `<select class="emission-select" data-category="${category}">`;
            filtered.forEach((opt) => {
                const selectedAttr = opt.key === resolvedDefault ? 'selected' : '';
                html += `<option value="${opt.key}" ${selectedAttr} data-en="${opt.labelEn}" data-pt="${opt.labelPt}">${opt.labelEn}</option>`;
            });
            html += '</select>';
            return html;
        }
    }

    const optionsByCategory = {
        water: [
            { key: 'water', labelEn: 'Water supply', labelPt: 'Abastecimento de água' },
            { key: 'wastewater', labelEn: 'Waste water', labelPt: 'Água residual' },
            { key: 'water_reuse', labelEn: 'Reused/recycled water', labelPt: 'Água reutilizada/reciclada' }
        ],
        energy: [
            { key: 'electricity', labelEn: 'Electricity (grid)', labelPt: 'Eletricidade (rede)' },
            { key: 'naturalGas', labelEn: 'Natural gas', labelPt: 'Gás natural' },
            { key: 'diesel', labelEn: 'Diesel (generator/boiler)', labelPt: 'Diesel (gerador/caldeira)' },
            { key: 'lpg', labelEn: 'LPG', labelPt: 'GLP' },
            { key: 'coal', labelEn: 'Coal', labelPt: 'Carvão' }
        ],
        transmissionDistribution: [
            {
                key: 'electricity_transmission_distribution',
                labelEn: 'T&D — UK electricity',
                labelPt: 'T&D — eletricidade UK',
            },
            {
                key: 'td_district_heat_steam',
                labelEn: 'T&D — district heat & steam',
                labelPt: 'T&D — calor distrital e vapor',
            },
        ],
        waste: [
            { key: 'waste_landfill', labelEn: 'Waste to landfill', labelPt: 'Resíduo para aterro' },
            { key: 'waste_to_energy', labelEn: 'Waste to energy', labelPt: 'Resíduo para energia' },
            { key: 'waste_to_recycling', labelEn: 'Waste to recycling', labelPt: 'Resíduo para reciclagem' },
            { key: 'waste_to_composting', labelEn: 'Waste to composting', labelPt: 'Resíduo para compostagem' },
        ],
        transport: [
            { key: 'transport_petrol', labelEn: 'Company vehicles - petrol', labelPt: 'Veículos - gasolina' },
            { key: 'transport_diesel', labelEn: 'Company vehicles - diesel', labelPt: 'Veículos - diesel' },
            { key: 'transport_electric', labelEn: 'Company vehicles - electric', labelPt: 'Veículos - elétrico' },
            { key: 'flights_short', labelEn: 'Flights - short-haul', labelPt: 'Voos - curta distância' },
            { key: 'flights_medium', labelEn: 'Flights - medium-haul', labelPt: 'Voos - média distância' },
            { key: 'flights_long', labelEn: 'Flights - long-haul', labelPt: 'Voos - longa distância' },
            { key: 'business_travel_rail', labelEn: 'Business travel - rail', labelPt: 'Viagem de negócios - trem' },
            { key: 'business_travel_hotel_night', labelEn: 'Business travel - hotel stay', labelPt: 'Viagem de negócios - hospedagem' },
            { key: 'freight_road_tonne_km', labelEn: 'Freighting goods - road', labelPt: 'Frete de mercadorias - rodoviário' },
            { key: 'freight_air_tonne_km', labelEn: 'Freighting goods - air', labelPt: 'Frete de mercadorias - aéreo' },
            { key: 'freight_sea_tonne_km', labelEn: 'Freighting goods - sea', labelPt: 'Frete de mercadorias - marítimo' },
            { key: 'staff_commute_car_km', labelEn: 'Staff commute - car', labelPt: 'Deslocamento de equipe - carro' },
            { key: 'staff_commute_bus_km', labelEn: 'Staff commute - bus', labelPt: 'Deslocamento de equipe - ônibus' },
            { key: 'staff_commute_rail_km', labelEn: 'Staff commute - rail', labelPt: 'Deslocamento de equipe - trem' },
            { key: 'wfh_day', labelEn: 'Working from home', labelPt: 'Trabalho remoto' },
            { key: 'materials_paper_kg', labelEn: 'Materials - paper', labelPt: 'Materiais - papel' },
            { key: 'materials_steel_kg', labelEn: 'Materials - steel', labelPt: 'Materiais - aço' },
            { key: 'car_petrol_small', labelEn: 'Car (small) petrol', labelPt: 'Carro (pequeno) gasolina' },
            { key: 'car_petrol_medium', labelEn: 'Car (medium) petrol', labelPt: 'Carro (médio) gasolina' },
            { key: 'car_petrol_large', labelEn: 'Car (large) petrol', labelPt: 'Carro (grande) gasolina' },
            { key: 'car_petrol_average', labelEn: 'Car (average) petrol', labelPt: 'Carro (médio) gasolina' },
            { key: 'car_diesel_small', labelEn: 'Car (small) diesel', labelPt: 'Carro (pequeno) diesel' },
            { key: 'car_diesel_medium', labelEn: 'Car (medium) diesel', labelPt: 'Carro (médio) diesel' },
            { key: 'car_diesel_large', labelEn: 'Car (large) diesel', labelPt: 'Carro (grande) diesel' },
            { key: 'car_diesel_average', labelEn: 'Car (average) diesel', labelPt: 'Carro (médio) diesel' },
            { key: 'car_hybrid_small', labelEn: 'Car (small) hybrid', labelPt: 'Carro híbrido (pequeno)' },
            { key: 'car_hybrid_medium', labelEn: 'Car (medium) hybrid', labelPt: 'Carro híbrido (médio)' },
            { key: 'car_hybrid_large', labelEn: 'Car (large) hybrid', labelPt: 'Carro híbrido (grande)' },
            { key: 'car_hybrid_average', labelEn: 'Car (average) hybrid', labelPt: 'Carro híbrido (médio)' },
            { key: 'car_plugin_hybrid_small', labelEn: 'Car (small) plug-in hybrid', labelPt: 'Carro híbrido plug-in (pequeno)' },
            { key: 'car_plugin_hybrid_medium', labelEn: 'Car (medium) plug-in hybrid', labelPt: 'Carro híbrido plug-in (médio)' },
            { key: 'car_plugin_hybrid_large', labelEn: 'Car (large) plug-in hybrid', labelPt: 'Carro híbrido plug-in (grande)' },
            { key: 'car_plugin_hybrid_average', labelEn: 'Car (average) plug-in hybrid', labelPt: 'Carro híbrido plug-in (médio)' },
            { key: 'motorbike_small', labelEn: 'Motorbike (small)', labelPt: 'Motocicleta (pequena)' },
            { key: 'motorbike_medium', labelEn: 'Motorbike (medium)', labelPt: 'Motocicleta (média)' },
            { key: 'motorbike_large', labelEn: 'Motorbike (large)', labelPt: 'Motocicleta (grande)' },
            { key: 'motorbike_average', labelEn: 'Motorbike (average)', labelPt: 'Motocicleta (média)' },
            { key: 'taxi_regular', labelEn: 'Taxi (regular)', labelPt: 'Táxi (regular)' },
            { key: 'taxi_black_cab', labelEn: 'Taxi (black cab)', labelPt: 'Táxi (black cab)' },
            { key: 'bus_local', labelEn: 'Bus (local)', labelPt: 'Ônibus (local)' },
            { key: 'bus_local_london', labelEn: 'Bus (local London)', labelPt: 'Ônibus (Londres)' },
            { key: 'bus_local_average', labelEn: 'Bus (average local)', labelPt: 'Ônibus (médio local)' },
            { key: 'bus_coach', labelEn: 'Bus (coach)', labelPt: 'Ônibus rodoviário' },
            { key: 'rail_international', labelEn: 'Rail (international)', labelPt: 'Trem (internacional)' },
            { key: 'rail_light_tram', labelEn: 'Rail (light rail/tram)', labelPt: 'Trem leve/VLT' },
            { key: 'rail_underground', labelEn: 'Rail (underground)', labelPt: 'Metrô' },
            { key: 'flight_short_economy', labelEn: 'Flight short-haul (economy)', labelPt: 'Voo curta distância (econômica)' },
            { key: 'flight_short_average', labelEn: 'Flight short-haul (average)', labelPt: 'Voo curta distância (médio)' },
            { key: 'flight_short_business', labelEn: 'Flight short-haul (business)', labelPt: 'Voo curta distância (executiva)' },
            { key: 'flight_long_economy', labelEn: 'Flight long-haul (economy)', labelPt: 'Voo longa distância (econômica)' },
            { key: 'flight_long_average', labelEn: 'Flight long-haul (average)', labelPt: 'Voo longa distância (médio)' },
            { key: 'flight_long_business', labelEn: 'Flight long-haul (business)', labelPt: 'Voo longa distância (executiva)' },
            { key: 'flight_non_uk_economy', labelEn: 'Flight non-UK (economy)', labelPt: 'Voo não-UK (econômica)' },
            { key: 'flight_non_uk_average', labelEn: 'Flight non-UK (average)', labelPt: 'Voo não-UK (médio)' },
            { key: 'flight_non_uk_business', labelEn: 'Flight non-UK (business)', labelPt: 'Voo não-UK (executiva)' },
            { key: 'van_diesel_average', labelEn: 'Van (diesel average)', labelPt: 'Van (diesel média)' },
            { key: 'van_petrol_average', labelEn: 'Van (petrol average)', labelPt: 'Van (gasolina média)' },
            { key: 'hgv_diesel', labelEn: 'HGV (diesel)', labelPt: 'Caminhão pesado (diesel)' },
            { key: 'hgv_diesel_refrigerated', labelEn: 'HGV refrigerated (diesel)', labelPt: 'Caminhão refrigerado (diesel)' },
            { key: 'freight_flight_domestic', labelEn: 'Freight flights domestic', labelPt: 'Frete aéreo doméstico' },
            { key: 'freight_flight_short_haul', labelEn: 'Freight flights short-haul', labelPt: 'Frete aéreo curta distância' },
            { key: 'freight_flight_long_haul', labelEn: 'Freight flights long-haul', labelPt: 'Frete aéreo longa distância' },
            { key: 'freight_flight_international', labelEn: 'Freight flights international', labelPt: 'Frete aéreo internacional' },
            { key: 'rail_freight_train', labelEn: 'Rail freight train', labelPt: 'Trem de carga' },
            { key: 'cargo_ship_bulk', labelEn: 'Cargo ship (bulk carrier)', labelPt: 'Navio cargueiro (graneleiro)' },
            { key: 'cargo_ship_general', labelEn: 'Cargo ship (general cargo)', labelPt: 'Navio cargueiro (carga geral)' },
            { key: 'cargo_ship_container', labelEn: 'Cargo ship (container)', labelPt: 'Navio porta-contêiner' },
            { key: 'cargo_ship_vehicle', labelEn: 'Cargo ship (vehicle transport)', labelPt: 'Navio cargueiro (veículos)' },
            { key: 'cargo_ship_refrigerated', labelEn: 'Cargo ship (refrigerated)', labelPt: 'Navio cargueiro (refrigerado)' },
            { key: 'hotel_uk', labelEn: 'Hotel stay (UK)', labelPt: 'Hospedagem (UK)' },
            { key: 'hotel_uk_london', labelEn: 'Hotel stay (UK London)', labelPt: 'Hospedagem (UK Londres)' },
            { key: 'materials_construction_avg', labelEn: 'Materials - avg construction', labelPt: 'Materiais - construção média' },
            { key: 'materials_aggregates_primary', labelEn: 'Materials - aggregates primary', labelPt: 'Materiais - agregados primários' },
            { key: 'materials_aggregates_reused', labelEn: 'Materials - aggregates reused', labelPt: 'Materiais - agregados reutilizados' },
            { key: 'materials_aggregates_closed_loop', labelEn: 'Materials - aggregates closed-loop', labelPt: 'Materiais - agregados ciclo fechado' },
            { key: 'materials_asphalt_primary', labelEn: 'Materials - asphalt primary', labelPt: 'Materiais - asfalto primário' },
            { key: 'materials_asphalt_reused', labelEn: 'Materials - asphalt reused', labelPt: 'Materiais - asfalto reutilizado' },
            { key: 'materials_asphalt_closed_loop', labelEn: 'Materials - asphalt closed-loop', labelPt: 'Materiais - asfalto ciclo fechado' },
            { key: 'materials_bricks_primary', labelEn: 'Materials - bricks primary', labelPt: 'Materiais - tijolos primários' },
            { key: 'materials_concrete_primary', labelEn: 'Materials - concrete primary', labelPt: 'Materiais - concreto primário' },
            { key: 'materials_concrete_closed_loop', labelEn: 'Materials - concrete closed-loop', labelPt: 'Materiais - concreto ciclo fechado' }
        ],
        refrigerants: [
            { key: 'refrigerant_R410A', labelEn: 'R-410A', labelPt: 'R-410A' },
            { key: 'refrigerant_R134a', labelEn: 'R-134a', labelPt: 'R-134a' },
            { key: 'refrigerant_R32', labelEn: 'R-32', labelPt: 'R-32' },
            { key: 'refrigerant_R404A', labelEn: 'R-404A', labelPt: 'R-404A' },
            { key: 'refrigerant_R407A', labelEn: 'R-407A', labelPt: 'R-407A' },
            { key: 'refrigerant_R407C', labelEn: 'R-407C', labelPt: 'R-407C' },
            { key: 'refrigerant_R408A', labelEn: 'R-408A', labelPt: 'R-408A' }
        ]
    };

    const options = dedupeEmissionSelectOptions(
        filterEmissionOptionsForCategory(
            optionsByCategory[category] || optionsByCategory[catalogCategory] || [],
            category
        )
    );
    const defaultSelected =
        window.carbonCalc?.getCanonicalEmissionOptionKey?.(selectedKey) ||
        selectedKey ||
        (options[0] ? options[0].key : '');
    const resolvedDefault =
        options.find((o) => o.key === defaultSelected)?.key || options[0]?.key || '';

    let html = `<select class="emission-select" data-category="${category}">`;
    options.forEach(opt => {
        const selectedAttr = opt.key === resolvedDefault ? 'selected' : '';
        html += `<option value="${opt.key}" ${selectedAttr} data-en="${opt.labelEn}" data-pt="${opt.labelPt}">${opt.labelEn}</option>`;
    });
    html += '</select>';
    return html;
}

async function deleteRow(button) {
    if (await showAppConfirm(appState.currentLanguage === 'en' 
        ? 'Delete this row?' 
        : 'Excluir esta linha?')) {
        button.closest('tr')?.remove();
        calculateAllTotals();
        saveCurrentSiteData();
        if (typeof flushSiteDataSave === 'function') {
            await flushSiteDataSave({ silent: true, force: true });
        }
    }
}

function attachRowListeners(row) {
    const monthInputs = row.querySelectorAll('.month-input');
    const descriptionInput = row.querySelector('input[type="text"]');
    const yearInput = row.querySelector('.row-display-year');
    const emissionSelect = row.querySelector('.emission-select');
    const unitSelect = row.querySelector('.row-unit-select');
    
    // Save on any input change
    const saveData = () => {
        if (window.carbonCalc && window.carbonCalc.calculateRowTotal) {
            window.carbonCalc.calculateRowTotal(row);
            if (window.carbonCalc.calculateCategoryTotal) {
                window.carbonCalc.calculateCategoryTotal(row.closest('table'));
            }
        } else {
            calculateRowTotal(row);
            calculateCategoryTotal(row.closest('table'));
        }
        saveCurrentSiteData();
        if (typeof updateInputEmissionsPreview === 'function') {
            updateInputEmissionsPreview();
        }
    };
    
    monthInputs.forEach(input => {
        const handleMonthChange = () => {
            saveData();
            // Keep dashboard in sync when any month value is updated
            if (window.updateDashboard) {
                setTimeout(window.updateDashboard, 200);
            }
        };
        input.addEventListener('input', handleMonthChange);
        input.addEventListener('blur', handleMonthChange); // Also save when leaving field
    });
    
    if (descriptionInput) {
        descriptionInput.addEventListener('input', saveData);
        descriptionInput.addEventListener('blur', saveData);
    }

    if (emissionSelect) {
        emissionSelect.addEventListener('change', () => {
            const table = row.closest('table');
            const category = table?.id?.replace(/Table$/, '') || emissionSelect.dataset.category;
            if (category) {
                const emissionKey = emissionSelect.value;
                const currentUnit = row.querySelector('.row-unit-select')?.value || '';
                const preferred = getPreferredUnitForCategory(category, emissionKey);
                const optionValues = window.AssessmentScopeUnits?.getDataInputUnitOptions
                    ? window.AssessmentScopeUnits.getDataInputUnitOptions(category, emissionKey).map(([val]) => val)
                    : [];
                const nextUnit =
                    currentUnit && optionValues.includes(currentUnit) ? currentUnit : preferred;
                replaceRowUnitSelect(row, category, nextUnit, emissionKey);
            }
            saveData();
        });
    }
    bindRowUnitSelect(row, unitSelect);
    
    if (yearInput) {
        const onYearChange = () => {
            // Row year labels the data period only — factors stay on reporting year.
            saveData();
            if (window.carbonCalc?.calculateAllTotals) {
                window.carbonCalc.calculateAllTotals();
            } else if (typeof calculateAllTotals === 'function') {
                calculateAllTotals();
            }
            window.carbonCalc?.refreshFinancialYearMonthHighlights?.();
            if (window.updateDashboard) {
                setTimeout(window.updateDashboard, 200);
            }
        };
        yearInput.addEventListener('change', onYearChange);
        yearInput.addEventListener('blur', onYearChange);
    }
}

// ============================================
// LOCAL STORAGE
// ============================================

function saveSitesToLocalStorage() {
    const orgId = getOrgIdForDataCache();
    if (appState.currentSite && appState.sites?.[appState.currentSite]) {
        persistAllTabQuestionsToLocalCache(
            appState.sites[appState.currentSite],
            appState.currentSite
        );
    }
    localStorage.setItem(`carbonCalcSites_${orgId}`, JSON.stringify(appState.sites));
}

/** Rebuild sidebar sites list from `appState.sites` (e.g. after Mongo load). */
function rebuildSitesUIFromState() {
    const sitesList = document.getElementById('sitesList');
    if (!sitesList || !appState.sites) return;

    const previousCurrent = appState.currentSite;
    sitesList.innerHTML = '';

    Object.keys(appState.sites).forEach(siteId => {
        const site = appState.sites[siteId];
        if (!site) return;
        addSiteToList(siteId, site.name || 'Site');
    });

    const keys = Object.keys(appState.sites);
    if (keys.length === 0) return;

    const next = previousCurrent && appState.sites[previousCurrent]
        ? previousCurrent
        : keys[0];
    appState.currentSite = next;

    document.querySelectorAll('.site-item').forEach(item => {
        const id = item.getAttribute('data-site-id');
        item.classList.toggle('active', id === next);
    });

    loadSiteData(next);
    if (typeof calculateAllTotals === 'function') {
        setTimeout(() => calculateAllTotals(), 100);
    }
}

function loadSitesFromLocalStorage(options) {
    const rebuildUI = !options || options.rebuildUI !== false;
    const orgId = getOrgIdForDataCache();
    let saved = localStorage.getItem(`carbonCalcSites_${orgId}`);
    if (!saved) {
        saved = localStorage.getItem(LEGACY_SITES_CACHE_KEY);
    }
    if (saved) {
        try {
            appState.sites = JSON.parse(saved);
        } catch (e) {
            console.error('loadSitesFromLocalStorage:', e);
            appState.sites = createDefaultSitesState(localStorage.getItem('companyName'));
        }
    } else {
        appState.sites = createDefaultSitesState(localStorage.getItem('companyName'));
    }
    normalizeAllSitesDataShape();
    restoreCurrentSiteId();
    Object.keys(appState.sites || {}).forEach((siteId) => {
        hydrateTabQuestionsFromLocalCache(appState.sites[siteId], siteId);
    });
    if (rebuildUI) {
        rebuildSitesUIFromState();
    }
}

function loadSiteData(siteId) {
    const site = appState.sites[siteId];
    if (!site) return;

    appState.loadingSiteData = true;
    try {
        loadSiteDataIntoDom(site, siteId);
    } finally {
        appState.loadingSiteData = false;
    }
}

function loadSiteDataIntoDom(site, siteId) {
    // Load site-specific company name if exists, otherwise use global
    const siteCompanyName = site.companyName || getOrgLocalItem('companyName', localStorage.getItem('companyName') || 'My Company');
    document.getElementById('companyNameInput').value = siteCompanyName;
    document.getElementById('companyName').textContent = siteCompanyName;
    setOrgLocalItem('companyName', siteCompanyName);
    localStorage.setItem('companyName', siteCompanyName);
    
    // Load site-specific notes if exists, otherwise use global
    const siteNotes = site.notes !== undefined ? site.notes : getOrgLocalItem('companyNotes', '');
    document.getElementById('companyNotes').value = siteNotes;
    
    if (typeof window.ensureDefaultSiteData === 'function') {
        window.ensureDefaultSiteData(site);
    }

    // Clear all tables
    getDataInputCategoryList().forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = '';
            
            // Load saved rows only — no placeholder row when empty (use "Add new line").
            const savedRows = site.data[category] || [];
            savedRows.forEach((rowData) => {
                const hasAnyData = Array.isArray(rowData.months) && rowData.months.some((v) => Number(v) > 0);
                const hasDescription = String(rowData.description || '').trim().length > 0;
                if (!hasAnyData && !hasDescription) return;

                addDataRow(category);
                const row = tbody.lastElementChild;
                loadRowData(row, rowData);
            });
        }
    });
    
    // Load financial data
    if (site.financials) {
        Object.keys(site.financials).forEach(key => {
            const value = site.financials[key] || 0;
            updateFinancialDisplay(key, value);
        });
    }

    ensureSiteTabQuestions(site);
    hydrateTabQuestionsFromLocalCache(site, siteId);
    const navTab = document.querySelector(
        '#section-data-input .tabs-nav .tab-btn.active'
    )?.getAttribute('data-tab');
    const notesCategory =
        navTab && getDataInputCategoryList().includes(navTab)
            ? navTab
            : getActiveDataInputTabKey();
    updateTabQuestionUI(notesCategory);

    if (window.carbonCalc?.refreshDataTableMonthHeaders) {
        window.carbonCalc.refreshDataTableMonthHeaders();
    }
    normalizeDataRowYearInputs();
    if (window.carbonCalc?.syncFinancialYearViewAfterDataLoad) {
        window.carbonCalc.syncFinancialYearViewAfterDataLoad();
    } else if (window.carbonCalc?.refreshFinancialYearMonthHighlights) {
        window.carbonCalc.refreshFinancialYearMonthHighlights();
    }
    
    // Recalculate totals after loading
    setTimeout(() => {
        calculateAllTotals();
    }, 100);
    
    // Update dashboard if it's active
    setTimeout(() => {
        if (document.querySelector('[data-content="dashboard"]')?.classList.contains('active')) {
            updateDashboard();
        }
        if (document.getElementById('section-input-emissions')?.classList.contains('active')) {
            updateInputEmissionsPreview();
        }
    }, 200);
}

window.removeEmptyRowsFromDom = function() {
    getDataInputCategoryList().forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        table.querySelectorAll('.data-row').forEach((row) => {
            const hasData = Array.from(row.querySelectorAll('.month-input')).some(
                (input) => Number(input.value) > 0
            );
            const hasDesc = String(row.querySelector('input[type="text"]')?.value || '').trim().length > 0;
            if (!hasData && !hasDesc) row.remove();
        });
    });
};

function migrateWasteEmissionType(emissionType) {
    if (window.carbonCalc?.getCanonicalEmissionOptionKey) {
        return window.carbonCalc.getCanonicalEmissionOptionKey(emissionType);
    }
    const legacy = {
        waste: 'waste_landfill',
        wasteRecycled: 'waste_to_recycling',
        waste_composted: 'waste_to_composting',
        waste_incineration: 'waste_to_energy',
        waste_recycled: 'waste_to_recycling',
    };
    return legacy[emissionType] || emissionType;
}

function loadRowData(row, data) {
    const descriptionInput = row.querySelector('input[type="text"]');
    const yearInput = row.querySelector('.row-display-year');
    const emissionSelect = row.querySelector('.emission-select');

    if (descriptionInput) descriptionInput.value = data.description || '';
    if (yearInput) {
        yearInput.value =
            data.year ||
            window.carbonCalc?.getReportingYear?.() ||
            new Date().getFullYear();
    }

    let emissionType = data.emissionType;
    const category = row.closest('table')?.id?.replace(/Table$/, '');
    if (emissionType) {
        emissionType = migrateWasteEmissionType(emissionType);
        data.emissionType = emissionType;
    }

    if (category === 'transmissionDistribution' && row.cells?.[0]) {
        const defaultTdEmission =
            window.DATA_TAB_META?.transmissionDistribution?.defaultEmission ||
            'electricity_transmission_distribution';
        emissionType = emissionType || defaultTdEmission;
        data.emissionType = emissionType;
        const rowYear =
            data.year || window.carbonCalc?.getReportingYear?.() || new Date().getFullYear();
        row.cells[0].innerHTML = getEmissionSelectHtml(
            category,
            emissionType,
            window.carbonCalc?.getReportingYear?.()
        );
        data.unit = 'kwh';
    }

    const emissionSelectAfterFix = row.querySelector('.emission-select');
    if (emissionSelectAfterFix && emissionType) {
        if (!Array.from(emissionSelectAfterFix.options).some((o) => o.value === emissionType)) {
            const opt = document.createElement('option');
            opt.value = emissionType;
            opt.textContent = window.carbonCalc?.getFactorDisplayLabel?.(emissionType) || emissionType;
            emissionSelectAfterFix.appendChild(opt);
        }
        emissionSelectAfterFix.value = emissionType;
    }
    const emissionKey = emissionSelectAfterFix?.value || data.emissionType || null;
    if (category && emissionKey && row.cells?.[2]) {
        let preferred = data.unit || getPreferredUnitForCategory(category, emissionKey);
        if (category === 'transmissionDistribution') {
            preferred = 'kwh';
        } else if (
            category === 'water' &&
            window.AssessmentScopeUnits?.normalizeWaterRowUnit
        ) {
            preferred = window.AssessmentScopeUnits.normalizeWaterRowUnit(preferred);
        }
        replaceRowUnitSelect(row, category, preferred, emissionKey);
        if (data.unit) {
            row.dataset.unitUserSet = '1';
        }
    } else if (data.unit) {
        const unitSelect = row.querySelector('.row-unit-select');
        if (unitSelect) {
            unitSelect.value = data.unit;
            row.dataset.unitUserSet = '1';
        }
    }
    
    if (window.carbonCalc?.setRowMonthsFromCalendarMonth) {
        window.carbonCalc.setRowMonthsFromCalendarMonth(row, data.months || []);
    } else {
        (data.months || []).forEach((value, index) => {
            const monthInput = row.querySelector(`.month-input[data-month="${index}"]`);
            if (monthInput) monthInput.value = value || '';
        });
    }
    
    if (window.carbonCalc && window.carbonCalc.calculateRowTotal) {
        window.carbonCalc.calculateRowTotal(row);
    } else if (typeof calculateRowTotal === 'function') {
        calculateRowTotal(row);
    }
}

function saveCurrentSiteData() {
    if (!appState.currentSite) return;
    
    const site = appState.sites[appState.currentSite];
    if (!site) return;
    
    // Save company notes to current site
    const notesInput = document.getElementById('companyNotes');
    if (notesInput) {
        site.notes = notesInput.value || '';
    }
    
    // Save company name to current site
    const nameInput = document.getElementById('companyNameInput');
    if (nameInput) {
        site.companyName = nameInput.value || '';
    }
    
    syncAllTabQuestionsToSite();
    if (appState.dataHydrated && !appState.loadingSiteData) {
        collectCurrentSiteDataInput(site);
    }

    // Save financial data (already saved by updateFinancialWidget, but ensure consistency)
    if (site.financials) {
        ['bankBalance', 'savingsBalance', 'cashIn', 'cashOut', 'invoicesOwed', 'billsToPay'].forEach(widgetId => {
            const element = document.getElementById(widgetId);
            if (element && element.textContent) {
                // Extract numeric value from text like "$50,000.00"
                const text = element.textContent.replace(/[$,]/g, '');
                const value = parseFloat(text) || 0;
                if (!isNaN(value)) {
                    site.financials[widgetId] = value;
                }
            }
        });
    }
    
    saveSitesToLocalStorage();
    scheduleSiteDataSave();
}

window.saveCurrentSiteData = saveCurrentSiteData;

function updateTabQuestionUI(category) {
    const siteId = appState.currentSite;
    const site = appState.sites[siteId];
    if (!site || !category) return;

    const notesEl = document.getElementById('tabQuestionNotesInput');
    const prevCategory = notesEl?.dataset?.activeCategory;
    if (
        notesEl &&
        prevCategory &&
        prevCategory !== category &&
        getDataInputCategoryList().includes(prevCategory)
    ) {
        persistTabQuestionNotesForCategory(prevCategory, notesEl.value || '', {
            fromUi: notesEl.dataset.tabNotesDirty === '1',
        });
    }

    ensureSiteTabQuestions(site);
    hydrateTabQuestionsFromLocalCache(site, siteId);
    appState.activeDataTab = category;
    const promptEl = document.getElementById('tabQuestionPromptText');
    if (promptEl) {
        promptEl.textContent = TAB_QUESTION_PROMPTS[category] || 'Add supporting notes and answers for this tab.';
    }
    if (notesEl) {
        notesEl.dataset.activeCategory = category;
        const stored = tabQuestionNotesForDisplay(category, site.tabQuestions[category]);
        notesEl.value = stored;
        notesEl.dataset.hydratedCategory = category;
        notesEl.dataset.tabNotesDirty = '';
        notesEl.placeholder = getTabQuestionNotesPlaceholder(category);
    }
}

function getTabQuestionNotesPlaceholder(category) {
    const hints = {
        water: 'e.g. Main meter, estimated Jan–Mar readings, leak in basement…',
        energy: 'e.g. Calendar year bills, tariff ABC, kWh from supplier portal…',
        transmissionDistribution: 'e.g. T&D kWh source, district heat meter ID…',
        waste: 'e.g. Weighed bins, weekly uplift, conversion assumptions…',
        transport: 'e.g. Fleet types, mileage from fuel cards…',
        businessTravel: 'e.g. Flights from expense system, rail receipts…',
        freight: 'e.g. Tonne-km from carrier reports…',
        staffCommute: 'e.g. Survey method, average km, working days…',
        wfh: 'e.g. Remote days per month, occupancy assumptions…',
        materials: 'e.g. Purchase records, weights, material types…',
        refrigerants: 'e.g. Top-up records, service sheets, gas type…',
    };
    return hints[category] || 'Your notes for this tab (saved to the cloud per site)…';
}

function updateInputEmissionsPreview() {
    const body = document.getElementById('inputEmissionsPreviewBody');
    if (!body || !window.carbonCalc?.getRowConversionFactor) return;

    const categoryLabel = {
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

    const lines = [];
    getDataInputCategoryList().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        table.querySelectorAll('.data-row').forEach((row) => {
            const emissionSelect = row.querySelector('.emission-select');
            const emissionType = emissionSelect?.selectedOptions?.[0]?.textContent?.trim() || emissionSelect?.value || '';
            const desc = row.querySelector('input[type="text"]')?.value?.trim() || emissionType;
            const year = row.querySelector('input[type="number"]:not(.month-input)')?.value || '';
            const inputTotal = window.carbonCalc.getInputRowBaseTotal
                ? window.carbonCalc.getInputRowBaseTotal(row, category)
                : Array.from(row.querySelectorAll('.month-input')).reduce(
                      (sum, input) => sum + (parseFloat(input.value) || 0),
                      0
                  );
            const factor = window.carbonCalc.getRowConversionFactor(row, `${category}Table`);
            const kg = inputTotal * factor;
            const tonnes = kg / 1000;
            lines.push({
                category: categoryLabel[category] || category,
                emissionType,
                desc,
                year,
                inputTotal,
                factor,
                tonnes,
            });
        });
    });

    if (lines.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-secondary);">No emissions rows yet.</td></tr>';
        return;
    }

    body.innerHTML = lines.map((line) => {
        const emissionsDisplay = line.factor > 0 && window.carbonCalc?.formatTonnesForDisplay
            ? window.carbonCalc.formatTonnesForDisplay(line.tonnes)
            : (line.factor > 0 ? `${line.tonnes.toFixed(3)} tCO₂e` : 'N/A');
        return `
        <tr>
            <td>${line.category}</td>
            <td>${line.emissionType}</td>
            <td>${line.desc}</td>
            <td>${line.year}</td>
            <td>${line.inputTotal.toFixed(2)}</td>
            <td>${line.factor > 0 ? line.factor.toFixed(6).replace(/\.?0+$/, '') : 'N/A'}</td>
            <td>${emissionsDisplay}</td>
        </tr>
    `;
    }).join('');
}

// Open cash transaction modal
function openCashTransactionModal(type) {
    const modal = document.getElementById('cashTransactionModal');
    if (!modal) return;
    
    modal.dataset.transactionType = type;
    document.getElementById('cashTransactionAmount').value = '';
    document.getElementById('cashTransactionDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('cashTransactionDescription').value = '';
    
    const title = modal.querySelector('.modal-header h3');
    if (title) {
        title.textContent = type === 'cashIn' 
            ? (appState.currentLanguage === 'en' ? 'Add Cash In' : 'Adicionar Entrada')
            : (appState.currentLanguage === 'en' ? 'Add Cash Out' : 'Adicionar Saída');
    }
    
    modal.style.display = 'flex';
    updateLanguage();
}

// Close cash transaction modal
function closeCashTransactionModal() {
    const modal = document.getElementById('cashTransactionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Save cash transaction - accumulates the amount with date
function saveCashTransaction() {
    const modal = document.getElementById('cashTransactionModal');
    const type = modal.dataset.transactionType;
    
    const amount = parseFloat(document.getElementById('cashTransactionAmount').value);
    const date = document.getElementById('cashTransactionDate').value;
    const description = document.getElementById('cashTransactionDescription').value.trim();
    
    if (!amount || amount <= 0) {
        alert(appState.currentLanguage === 'en' ? 'Please enter a valid amount' : 'Por favor, insira um valor válido');
        return;
    }
    
    if (!date) {
        alert(appState.currentLanguage === 'en' ? 'Please select a date' : 'Por favor, selecione uma data');
        return;
    }
    
    const site = appState.sites[appState.currentSite];
    if (!site) {
        console.error('No current site available');
        return;
    }
    
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
    
    // Initialize cash transactions array if not exists
    if (!site.cashTransactions) {
        site.cashTransactions = {
            cashIn: [],
            cashOut: []
        };
    }
    
    const transactionType = type === 'cashIn' ? 'cashIn' : 'cashOut';
    const currentTotal = site.financials[transactionType] || 0;
    
    // Add transaction record with date
    const newTransaction = {
        id: `trans-${Date.now()}-${Math.random()}`,
        amount: amount,
        date: date,
        description: description || '',
        timestamp: new Date(date).getTime()
    };
    site.cashTransactions[transactionType].push(newTransaction);
    
    // Sort transactions by date
    site.cashTransactions[transactionType].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Update total by adding the transaction amount
    site.financials[transactionType] = currentTotal + amount;
    
    // Update bank account based on transaction type
    if (!site.financials.bankBalance) site.financials.bankBalance = 0;
    if (type === 'cashIn') {
        site.financials.bankBalance += amount; // Add to bank
    } else {
        site.financials.bankBalance -= amount; // Subtract from bank
    }
    
    // Update displays
    updateFinancialDisplay(transactionType, site.financials[transactionType]);
    updateFinancialDisplay('bankBalance', site.financials.bankBalance);
    
    // Save immediately
    saveSitesToLocalStorage();
    saveCurrentSiteData();
    
    // Close modal
    closeCashTransactionModal();
    
    // Update charts (bank recon, monthly cash flow, cash flow donut, account summary)
    setTimeout(() => {
        if (typeof updateBankReconciliationChart === 'function') {
            updateBankReconciliationChart();
        }
        if (typeof updateMonthlyCashFlowChart === 'function') {
            updateMonthlyCashFlowChart();
        }
        if (typeof updateCashFlowChart === 'function') {
            updateCashFlowChart();
        }
        if (typeof updateAccountSummaryChart === 'function') {
            updateAccountSummaryChart();
        }
    }, 100);
}

// Legacy function for compatibility
function addCashTransaction(widgetId, value) {
    // Redirect to new modal-based approach
    openCashTransactionModal(widgetId);
}

// Financial widget functions - For widgets other than cash in/out
function updateFinancialWidget(widgetId, value) {
    const site = appState.sites[appState.currentSite];
    if (!site) {
        console.error('No current site available');
        return;
    }
    
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
    
    // If the input was cleared to empty string, ignore the subsequent blur event
    if (value === '' || value === null) return;
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    // Don't allow direct updates to invoicesOwed and billsToPay (they come from charts)
    if (widgetId === 'invoicesOwed' || widgetId === 'billsToPay') {
        return; // These are read-only, updated from their respective charts
    }
    
    // For other widgets, just update the value
    site.financials[widgetId] = numValue;
    
    // Update the display element
    updateFinancialDisplay(widgetId, numValue);
    
    // Save immediately
    saveSitesToLocalStorage();
    
    // Also save current site data
    saveCurrentSiteData();
    
    // Show confirmation (optional)
    const input = document.querySelector(`input[onchange*="${widgetId}"]`);
    if (input) {
        input.style.borderColor = '#28A745';
        setTimeout(() => {
            input.style.borderColor = '';
        }, 500);
    }
    
    // Update bank reconciliation chart if exists
    if (window.updateBankReconciliationChart && (widgetId === 'cashIn' || widgetId === 'cashOut' || widgetId === 'bankBalance')) {
        setTimeout(() => {
            if (typeof updateBankReconciliationChart === 'function') {
                updateBankReconciliationChart();
            }
            if (typeof updateMonthlyCashFlowChart === 'function') {
                updateMonthlyCashFlowChart();
            }
        }, 100);
    }
    
    // Clear and reset the input field smoothly if it was triggered by a manual entry
    const matchingInput = document.querySelector(`.kpi-edit[onchange*="${widgetId}"]`);
    if (matchingInput) {
        setTimeout(() => {
            if (document.activeElement !== matchingInput) {
                matchingInput.value = '';
            }
        }, 150);
    }
}

// Helper function to update financial display
function updateFinancialDisplay(widgetId, value) {
    // Update main display element
    const element = document.getElementById(widgetId);
    if (element) {
        element.textContent = `$${value.toFixed(2)}`;
    }
    
    // Update accounts dashboard display if exists
    const accountsElement = document.getElementById(widgetId + 'Accounts');
    if (accountsElement) {
        accountsElement.textContent = `$${value.toFixed(2)}`;
    }
    
    // Also update the input field value if it exists (only if not focused)
    document.querySelectorAll(`.kpi-edit[onchange*="${widgetId}"]`).forEach(input => {
        if (document.activeElement !== input) {
            input.value = '';
        }
    });
}

function toggleWidget(button) {
    const widget = button.closest('.widget-card');
    const widgetId = widget.getAttribute('data-widget');
    
    if (appState.hiddenWidgets.includes(widgetId)) {
        appState.hiddenWidgets = appState.hiddenWidgets.filter(id => id !== widgetId);
        widget.classList.remove('hidden');
    } else {
        appState.hiddenWidgets.push(widgetId);
        widget.classList.add('hidden');
    }
    
    setOrgLocalItem('hiddenWidgets', JSON.stringify(appState.hiddenWidgets));
}

function toggleDashboardWidgets() {
    // Create modal for widget selection
    const modal = document.createElement('div');
    modal.className = 'widget-modal';
    modal.innerHTML = `
        <div class="widget-modal-content">
            <div class="widget-modal-header">
                <h3 data-en="Customize Dashboard" data-pt="Personalizar Painel">Customize Dashboard</h3>
                <button class="widget-modal-close" onclick="this.closest('.widget-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="widget-modal-body">
                <p data-en="Select widgets to show on dashboard:" data-pt="Selecione widgets para mostrar no painel:">Select widgets to show on dashboard:</p>
                <div class="widget-checkboxes" id="widgetCheckboxes"></div>
            </div>
            <div class="widget-modal-footer">
                <button class="btn-primary" onclick="applyWidgetSelection()">
                    <span data-en="Apply" data-pt="Aplicar">Apply</span>
                </button>
                <button class="btn-secondary" onclick="this.closest('.widget-modal').remove()">
                    <span data-en="Cancel" data-pt="Cancelar">Cancel</span>
                </button>
            </div>
        </div>
    `;
    
    // Get all widgets
    const allWidgets = [
        { id: 'emissions', name: { en: 'Total Emissions', pt: 'Emissões Totais' } },
        { id: 'thisyear', name: { en: 'This Year (2025)', pt: 'Este Ano (2025)' } },
        { id: 'lastyear', name: { en: 'Last Year (2024)', pt: 'Ano Passado (2024)' } },
        { id: 'average', name: { en: 'Average/Month', pt: 'Média/Mês' } },
        { id: 'bank-account', name: { en: 'Business Bank Account', pt: 'Conta Bancária' } },
        { id: 'savings', name: { en: 'Business Savings', pt: 'Poupança' } },
        { id: 'cashin', name: { en: 'Total Cash In', pt: 'Total de Entrada' } },
        { id: 'cashout', name: { en: 'Total Cash Out', pt: 'Total de Saída' } },
        { id: 'invoices', name: { en: 'Invoices Owed to You', pt: 'Faturas a Receber' } },
        { id: 'bills', name: { en: 'Bills to Pay', pt: 'Contas a Pagar' } },
        { id: 'pie-chart', name: { en: 'Emissions by Category (Pie Chart)', pt: 'Emissões por Categoria (Gráfico de Pizza)' } },
        { id: 'bar-chart', name: { en: 'Year Comparison (Bar Chart)', pt: 'Comparação Anual (Gráfico de Barras)' } },
        { id: 'line-chart', name: { en: 'Monthly Trend – Total (Line Chart)', pt: 'Tendência Mensal – Total' } },
        { id: 'source-trend-chart', name: { en: 'Monthly Trend – All Sources', pt: 'Tendência Mensal – Todas as Fontes' } },
        { id: 'watchlist', name: { en: 'Account Watchlist', pt: 'Contas Monitoradas' } },
    ];

    const emissionCategories = Array.isArray(window.DATA_INPUT_CATEGORIES) ? window.DATA_INPUT_CATEGORIES : [];
    emissionCategories.forEach((category) => {
        const meta = window.DATA_TAB_META?.[category];
        const en = meta?.titleEn || category;
        const pt = meta?.titlePt || category;
        allWidgets.push({
            id: `source-trend-${category}`,
            name: {
                en: `Monthly Trend – ${en}`,
                pt: `Tendência Mensal – ${pt}`,
            },
        });
    });
    
    const checkboxesDiv = modal.querySelector('#widgetCheckboxes');
    allWidgets.forEach(widget => {
        const isHidden = appState.hiddenWidgets.includes(widget.id);
        const checkbox = document.createElement('div');
        checkbox.className = 'widget-checkbox-item';
        checkbox.innerHTML = `
            <label>
                <input type="checkbox" ${!isHidden ? 'checked' : ''} data-widget-id="${widget.id}">
                <span>${widget.name[appState.currentLanguage] || widget.name.en}</span>
            </label>
        `;
        checkboxesDiv.appendChild(checkbox);
    });
    
    document.body.appendChild(modal);
    updateLanguage(); // Update modal text
}

function applyWidgetSelection() {
    const checkboxes = document.querySelectorAll('#widgetCheckboxes input[type="checkbox"]');
    appState.hiddenWidgets = [];
    
    checkboxes.forEach(checkbox => {
        const widgetId = checkbox.getAttribute('data-widget-id');
        if (!checkbox.checked) {
            appState.hiddenWidgets.push(widgetId);
        }
    });
    
    // Apply visibility
    document.querySelectorAll('.widget-card').forEach(widget => {
        const widgetId = widget.getAttribute('data-widget');
        if (appState.hiddenWidgets.includes(widgetId)) {
            widget.classList.add('hidden');
        } else {
            widget.classList.remove('hidden');
        }
    });
    
    setOrgLocalItem('hiddenWidgets', JSON.stringify(appState.hiddenWidgets));
    document.querySelector('.widget-modal').remove();
    
    // Update dashboard if active
    if (document.querySelector('[data-content="dashboard"]')?.classList.contains('active')) {
        updateDashboard();
    }
}

window.applyWidgetSelection = applyWidgetSelection;

window.updateFinancialWidget = updateFinancialWidget;
window.addCashTransaction = addCashTransaction;
window.openCashTransactionModal = openCashTransactionModal;
window.closeCashTransactionModal = closeCashTransactionModal;
window.saveCashTransaction = saveCashTransaction;
window.toggleWidget = toggleWidget;
window.toggleDashboardWidgets = toggleDashboardWidgets;

// ============================================
// COMPANY NAME & LOGO UPDATE
// ============================================

document.getElementById('companyNameInput')?.addEventListener('input', async function() {
    const name = this.value || 'My Company';
    document.getElementById('companyName').textContent = name;
    setOrgLocalItem('companyName', name);
    localStorage.setItem('companyName', name);
    // Also save to current site if exists
    if (appState.currentSite && appState.sites[appState.currentSite]) {
        appState.sites[appState.currentSite].companyName = name;
        saveSitesToLocalStorage();
    }
    
    // Sync with backend profile
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            await fetch(`${getApiBaseUrl()}/user`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ company_name: name })
            });
        } catch (err) {
            console.error('Error syncing company name to profile:', err);
        }
    }
});

// Company Notes - Save to localStorage
document.getElementById('companyNotes')?.addEventListener('input', function() {
    const notes = this.value || '';
    setOrgLocalItem('companyNotes', notes);
    // Also save to current site if exists
    if (appState.currentSite && appState.sites[appState.currentSite]) {
        appState.sites[appState.currentSite].notes = notes;
        saveSitesToLocalStorage();
        scheduleSiteDataSave();
    }
});

document.getElementById('companyNotes')?.addEventListener('blur', function() {
    const notes = this.value || '';
    setOrgLocalItem('companyNotes', notes);
    if (appState.currentSite && appState.sites[appState.currentSite]) {
        appState.sites[appState.currentSite].notes = notes;
        saveSitesToLocalStorage();
        scheduleSiteDataSave();
    }
});

// ============================================
// FACTORS DATABASE / COUNTRY SELECTOR
// ============================================

document.getElementById('countrySelect')?.addEventListener('change', function() {
    const value = this.value || 'UK';
    if (window.carbonCalc && typeof window.carbonCalc.setCountry === 'function') {
        window.carbonCalc.setCountry(value);
    }
});

// Logo upload
document.getElementById('logoUpload')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const logoImg = document.getElementById('companyLogoImg');
            logoImg.src = event.target.result;
            setOrgLocalItem('companyLogo', event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// ============================================
// INITIALIZATION
// ============================================

async function initializeApp() {
    appState.dataHydrated = false;

    // Initialize theme palette UI first so it's ready for toggleDarkMode calls
    if (typeof window.initCarbonPaletteUI === 'function') {
        window.initCarbonPaletteUI();
    }

    // Load saved preferences
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
        appState.currentLanguage = savedLanguage;
        updateLanguage();
    }
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        toggleDarkMode();
    }
    
    const isOrgAdmin = localStorage.getItem('isOrgAdmin') === 'true';
    const isPlatformAdmin = localStorage.getItem('isPlatformAdmin') === 'true';
    const isConsultant = localStorage.getItem('isConsultant') === 'true';
    const orgUserSettingsBtn = document.getElementById('orgUserSettingsBtn');
    if (orgUserSettingsBtn) {
        orgUserSettingsBtn.style.display = isOrgAdmin && !isPlatformAdmin && !isConsultant ? 'inline-flex' : 'none';
    }
    const orgAuditLogBtn = document.getElementById('orgAuditLogBtn');
    if (orgAuditLogBtn) {
        const auditLoggingOn =
            typeof isMongoAuditLoggingEnabled === 'function' && isMongoAuditLoggingEnabled();
        const canAudit =
            auditLoggingOn && (isOrgAdmin || isPlatformAdmin || isConsultant);
        orgAuditLogBtn.style.display = canAudit ? 'inline-flex' : 'none';
    }
    const switchOrgBtn = document.getElementById('switchOrgBtn');
    if (switchOrgBtn) {
        switchOrgBtn.style.display = isPlatformAdmin || isConsultant ? 'inline-flex' : 'none';
    }

    // Dynamic data-input tables must exist before loading rows from MongoDB / local cache.
    ensureDataInputDomReady();

    // MongoDB is source of truth for sites + org_preferences (General Info, Assessment Scope)
    try {
        await syncOrganizationDataFromServer();
    } catch (syncErr) {
        console.error('Could not sync organization data from server:', syncErr);
    }

    initializeTabs();
    rebuildSitesUIFromState();

    const savedCompanyName = getOrgLocalItem('companyName', localStorage.getItem('companyName') || 'My Company');
    if (savedCompanyName) {
        const companyInput = document.getElementById('companyNameInput');
        const companyTitle = document.getElementById('companyName');
        if (companyInput) companyInput.value = savedCompanyName;
        if (companyTitle) companyTitle.textContent = savedCompanyName;
    }

    const companyNotesEl = document.getElementById('companyNotes');
    if (companyNotesEl) companyNotesEl.value = getOrgLocalItem('companyNotes', '');

    const projectNumberEl = document.getElementById('projectNumberInput');
    const reportingPeriodEl = document.getElementById('reportingPeriodInput');
    const issueDateEl = document.getElementById('issueDateInput');
    const reportVersionEl = document.getElementById('reportVersionInput');
    const reportStatusEl = document.getElementById('reportStatusSelect');
    const organizationProfileEl = document.getElementById('organizationProfileInput');

    if (projectNumberEl) projectNumberEl.value = getOrgLocalItem('projectNumber', '');
    if (reportingPeriodEl) reportingPeriodEl.value = getOrgLocalItem('reportingPeriod', '');
    if (issueDateEl) issueDateEl.value = getOrgLocalItem('issueDate', '');
    if (reportVersionEl) reportVersionEl.value = getOrgLocalItem('reportVersion', '1.0');
    if (reportStatusEl) reportStatusEl.value = getOrgLocalItem('reportStatus', 'Draft');
    const reportOutputUnitEl = document.getElementById('reportOutputUnitSelect');
    if (reportOutputUnitEl) {
        reportOutputUnitEl.value = getOrgLocalItem('carbonCalcOutputUnit', 'tCO2e');
    }
    if (organizationProfileEl) organizationProfileEl.value = getOrgLocalItem('organizationProfile', '');
    bindOutputUnitControls();
    if (window.carbonCalc?.getOutputUnit) {
        syncOutputUnitSelectValues(window.carbonCalc.getOutputUnit());
    }

    const savedLogo = getOrgLocalItem('companyLogo', '');
    if (savedLogo) {
        const logoImg = document.getElementById('companyLogoImg');
        if (logoImg) logoImg.src = savedLogo;
    }

    const savedHiddenWidgets = getOrgLocalItem('hiddenWidgets', '');
    if (savedHiddenWidgets) {
        try {
            appState.hiddenWidgets = JSON.parse(savedHiddenWidgets);
            appState.hiddenWidgets.forEach((widgetId) => {
                const widget = document.querySelector(`[data-widget="${widgetId}"]`);
                if (widget) widget.classList.add('hidden');
            });
        } catch (_e) {
            appState.hiddenWidgets = [];
        }
    }

    if (window.AssessmentScopeForm?.init) {
        window.AssessmentScopeForm.init();
    }
    bindAssessmentScopeExtras();

    // Bind General Info / report metadata (persisted via org_preferences on server)
    const bindTextInput = (el, key) => {
        if (!el || el.dataset.bound === '1') return;
        el.dataset.bound = '1';
        el.addEventListener('input', () => setOrgLocalItem(key, el.value || ''));
        el.addEventListener('change', () => setOrgLocalItem(key, el.value || ''));
    };
    bindTextInput(projectNumberEl, 'projectNumber');
    bindTextInput(reportingPeriodEl, 'reportingPeriod');
    bindTextInput(issueDateEl, 'issueDate');
    bindTextInput(reportVersionEl, 'reportVersion');
    if (reportStatusEl && reportStatusEl.dataset.bound !== '1') {
        reportStatusEl.dataset.bound = '1';
        reportStatusEl.addEventListener('change', () => setOrgLocalItem('reportStatus', reportStatusEl.value));
    }

    if (window.GeneralInfo?.initGeneralInfoForm) {
        window.GeneralInfo.initGeneralInfoForm(getOrgLocalItem, setOrgLocalItem);
    }

    bindTextInput(organizationProfileEl, 'organizationProfile');

    const tabQuestionNotesInput = document.getElementById('tabQuestionNotesInput');
    if (tabQuestionNotesInput && tabQuestionNotesInput.dataset.bound !== '1') {
        tabQuestionNotesInput.dataset.bound = '1';
        tabQuestionNotesInput.addEventListener('focus', () => {
            const navTab = document.querySelector(
                '#section-data-input .tabs-nav .tab-btn.active'
            )?.getAttribute('data-tab');
            if (navTab && getDataInputCategoryList().includes(navTab)) {
                tabQuestionNotesInput.dataset.activeCategory = navTab;
            }
        });
        const onTabQuestionNotesChange = () => {
            const activeTab = getActiveDataInputTabKey();
            if (!activeTab) return;
            tabQuestionNotesInput.dataset.tabNotesDirty = '1';
            persistTabQuestionNotesForCategory(activeTab, tabQuestionNotesInput.value || '', {
                fromUi: true,
            });
            saveSitesToLocalStorage();
            scheduleSiteDataSave();
        };
        tabQuestionNotesInput.addEventListener('input', onTabQuestionNotesChange);
        tabQuestionNotesInput.addEventListener('change', onTabQuestionNotesChange);
        tabQuestionNotesInput.addEventListener('blur', () => {
            onTabQuestionNotesChange();
            saveCurrentSiteData();
        });
    }

    // QA checklist (internal QA user only)
    if (isQaAllowedUser()) {
        document.querySelectorAll('.qa-check-item').forEach((el) => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            el.addEventListener('change', () => {
                const key = el.getAttribute('data-key');
                const state = getQaChecklistState();
                state[key] = el.checked;
                localStorage.setItem(QA_CHECKLIST_KEY, JSON.stringify(state));
                if (typeof scheduleOrgPreferencesSave === 'function') {
                    scheduleOrgPreferencesSave();
                }
                renderQaState();
            });
        });
        renderQaState();
    }
    applyQaVisibility();

    if (window.carbonCalc?.calculateAllTotals) {
        window.carbonCalc.calculateAllTotals();
    }
    if (typeof updateInputEmissionsPreview === 'function') {
        updateInputEmissionsPreview();
    }
    if (typeof updateDashboard === 'function') {
        updateDashboard();
    }
    
    // Attach listeners to existing rows
    document.querySelectorAll('.data-row').forEach(row => {
        attachRowListeners(row);
    });
    
    // Attach listeners to existing site name inputs
    document.querySelectorAll('.site-name-input').forEach(input => {
        input.addEventListener('blur', function() {
            const siteItem = this.closest('.site-item');
            const siteId = siteItem?.getAttribute('data-site-id');
            if (siteId && appState.sites[siteId]) {
                const newName = this.value.trim() || 'Unnamed Site';
                this.value = newName;
                appState.sites[siteId].name = newName;
                saveSitesToLocalStorage();
                saveUserDataToBackend(); // Sync backend on site name change
            }
        });
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
    });
    
    // Sync factors country selector
    try {
        if (window.carbonCalc && typeof window.carbonCalc.getCountry === 'function') {
            const savedCountry = window.carbonCalc.getCountry();
            const selectEl = document.getElementById('countrySelect');
            if (selectEl && savedCountry) {
                selectEl.value = savedCountry;
            }
        }
    } catch (err) {
        console.error('Error syncing country selector', err);
    }

    // Sync calculation context controls (reporting year + output unit)
    try {
        if (window.carbonCalc?.refreshReportingYearSelectOptions) {
            window.carbonCalc.refreshReportingYearSelectOptions();
        }
        const bindReportingYearSelect = (selectEl) => {
            if (!selectEl || selectEl.dataset.bound === '1') return;
            selectEl.dataset.bound = '1';
            selectEl.addEventListener('change', () => {
                if (window.carbonCalc?.setReportingYear) {
                    window.carbonCalc.setReportingYear(selectEl.value);
                }
            });
        };
        bindReportingYearSelect(document.getElementById('reportingYearSelect'));
        bindReportingYearSelect(document.getElementById('reportingYearGeneralSelect'));
        if (window.carbonCalc?.syncReportingYearSelects) {
            window.carbonCalc.syncReportingYearSelects();
        }
        const reportingPeriodTypeSelect = document.getElementById('reportingPeriodTypeSelect');
        if (reportingPeriodTypeSelect && window.carbonCalc?.setReportingPeriodType) {
            reportingPeriodTypeSelect.value =
                window.carbonCalc.getReportingPeriodType?.() || 'calendar';
            if (reportingPeriodTypeSelect.dataset.bound !== '1') {
                reportingPeriodTypeSelect.dataset.bound = '1';
                reportingPeriodTypeSelect.addEventListener('change', () => {
                    window.carbonCalc.setReportingPeriodType(reportingPeriodTypeSelect.value);
                });
            }
        }
        if (window.carbonCalc?.refreshDataTableMonthHeaders) {
            window.carbonCalc.refreshDataTableMonthHeaders();
        }
        if (window.carbonCalc?.syncFinancialYearViewAfterDataLoad) {
            window.carbonCalc.syncFinancialYearViewAfterDataLoad();
        }
        const outputUnitSelect = document.getElementById('outputUnitSelect');
        if (outputUnitSelect && window.carbonCalc?.getOutputUnit) {
            syncOutputUnitSelectValues(window.carbonCalc.getOutputUnit());
            bindOutputUnitControls();
        }
        if (window.carbonCalc?.refreshEmissionsUnitLabels) {
            window.carbonCalc.refreshEmissionsUnitLabels();
        }
    } catch (err) {
        console.error('Error syncing calculation context controls', err);
    }

    // Auto-save every 5 seconds to local storage and backend
    setInterval(() => {
        if (appState.loggedIn && appState.dataHydrated) {
            saveCurrentSiteData();
            saveUserDataToBackend({ silent: true });
        }
    }, 5000);

    appState.dataHydrated = true;
    console.log('✅ Carbon Calculator Phase 1 initialized successfully!');
}

// ============================================
// WINDOW LOAD
// ============================================

window.addEventListener('DOMContentLoaded', function() {
    if (typeof applyOrgMainUnlockFromUrl === 'function') {
        applyOrgMainUnlockFromUrl();
    }

    // Initialize theme palette UI as early as possible
    if (typeof window.initCarbonPaletteUI === 'function') {
        window.initCarbonPaletteUI();
    }

    // Restore dark mode state first
    if (localStorage.getItem('darkMode') === 'true') {
        appState.darkMode = false; // toggleDarkMode will flip this to true
        toggleDarkMode();
    } else if (typeof window.applyCarbonPalette === 'function') {
        window.applyCarbonPalette();
    }

    updateLanguage();
    const chatbotToggleBtn = document.getElementById('chatbotToggleBtn');
    if (chatbotToggleBtn && chatbotToggleBtn.dataset.bound !== '1') {
        chatbotToggleBtn.dataset.bound = '1';
        chatbotToggleBtn.addEventListener('click', () => toggleChatbotPanel(true));
    }
    
    // Check if user was previously logged in
    const wasLoggedIn = localStorage.getItem('loggedIn') === 'true';
    const savedEmail = localStorage.getItem('loginEmail');
    const token = localStorage.getItem('authToken');
    
    if (wasLoggedIn && savedEmail && token) {
        if (isSessionExpired()) {
            forceLogoutForExpiredSession(false);
            return;
        }
        const isOrgAdmin = localStorage.getItem('isOrgAdmin') === 'true';
        const isPlatformAdmin = localStorage.getItem('isPlatformAdmin') === 'true';
        const isConsultant = localStorage.getItem('isConsultant') === 'true';
        const allowOrgMainApp = localStorage.getItem('orgOpenMainApp') === 'true';
        if (isPlatformAdmin && !allowOrgMainApp) {
            window.location.href = 'platform-admin.html';
            return;
        }
        if (isConsultant && !allowOrgMainApp) {
            window.location.href = 'consultant-workbench.html';
            return;
        }
        if (isOrgAdmin && !isPlatformAdmin && !isConsultant && !allowOrgMainApp) {
            window.location.href = 'organization-users.html';
            return;
        }
        localStorage.removeItem('orgOpenMainApp');
        // Auto-login: set state and sync
        appState.loggedIn = true;
        resetSessionExpiryState();
        touchSession();
        startSessionMonitor();
        ensureOrganizationSession(
            localStorage.getItem('organizationId') || '',
            localStorage.getItem('companyName') || 'My Company'
        );
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        if (document.getElementById('loginEmail')) {
            document.getElementById('loginEmail').value = savedEmail;
        }

        // Same as manual login: load MongoDB org data first (see syncOrganizationDataFromServer).
        initializeApp();
    } else {
        // Show login screen
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }

    const flushOnPageExit = () => {
        if (!appState.loggedIn || !appState.dataHydrated) return;
        syncAllTabQuestionsToSite();
        if (typeof saveCurrentSiteData === 'function') saveCurrentSiteData();
        saveSitesToLocalStorage();
        if (typeof window.flushSiteDataSave === 'function') {
            window.flushSiteDataSave({ keepalive: true, silent: true, force: true });
        }
    };
    window.addEventListener('beforeunload', flushOnPageExit);
    window.addEventListener('pagehide', flushOnPageExit);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushOnPageExit();
        }
    });
});

// ============================================
// DARK MODE & LANGUAGE TOGGLE
// ============================================

function toggleDarkMode() {
    appState.darkMode = !appState.darkMode;
    
    if (appState.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.removeAttribute('data-theme');
    }
    
    localStorage.setItem('darkMode', appState.darkMode);
    if (typeof scheduleOrgPreferencesSave === 'function') {
        scheduleOrgPreferencesSave();
    }

    const icon = document.querySelector('#darkModeToggle i');
    if (icon) {
        icon.className = appState.darkMode ? 'fas fa-sun' : 'fas fa-moon';
    }

    if (typeof window.applyCarbonPalette === 'function') {
        window.applyCarbonPalette();
    }
}

function updateLanguage() {
    const lang = appState.currentLanguage;
    document.querySelectorAll('[data-en]').forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        }
    });
    
    // Update labels and other specific elements
    const langBtnText = document.getElementById('langText');
    if (langBtnText) langBtnText.textContent = lang.toUpperCase();
    
    const langBtnTextLogin = document.getElementById('langTextLogin');
    if (langBtnTextLogin) langBtnTextLogin.textContent = lang === 'en' ? 'PT' : 'EN';

    if (typeof window.refreshCarbonPaletteLabels === 'function') {
        window.refreshCarbonPaletteLabels();
    }
    if (window.carbonCalc?.refreshEmissionsUnitLabels) {
        window.carbonCalc.refreshEmissionsUnitLabels();
    }
}

function toggleLanguage() {
    appState.currentLanguage = appState.currentLanguage === 'en' ? 'pt' : 'en';
    localStorage.setItem('language', appState.currentLanguage);
    updateLanguage();
    if (typeof scheduleOrgPreferencesSave === 'function') {
        scheduleOrgPreferencesSave();
    }
    if (window.carbonCalc?.refreshDataTableMonthHeaders) {
        window.carbonCalc.refreshDataTableMonthHeaders();
    }
    if (document.querySelector('[data-content="dashboard"]')?.classList.contains('active') && typeof updateDashboard === 'function') {
        updateDashboard();
    }
    if (window.GeneralInfo?.syncLocationCountryFromLanguage) {
        window.GeneralInfo.syncLocationCountryFromLanguage(getOrgLocalItem, setOrgLocalItem);
    }
}

// Attach UI Toggles
document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);
document.getElementById('langToggle')?.addEventListener('click', toggleLanguage);
document.getElementById('langToggleLogin')?.addEventListener('click', toggleLanguage);

window.toggleDarkMode = toggleDarkMode;
window.updateLanguage = updateLanguage;
window.toggleLanguage = toggleLanguage;
window.toggleChatbotPanel = toggleChatbotPanel;
window.sendChatbotMessage = sendChatbotMessage;
window.generateQaSummary = generateQaSummary;
window.copyQaSummary = copyQaSummary;

// Prevent data loss on page unload
window.addEventListener('beforeunload', function() {
    if (!appState.loggedIn || !appState.dataHydrated) return;
    syncAllTabQuestionsToSite();
    saveCurrentSiteData();
    saveSitesToLocalStorage();
    flushSiteDataSave({ keepalive: true, silent: true, force: true });
});


