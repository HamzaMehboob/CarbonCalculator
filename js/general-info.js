// General Info form — field definitions and render/bind (matches onboarding spreadsheet layout)

const GENERAL_INFO_STORAGE_KEYS = [
    'contactName', 'contactEmail', 'locationCountry', 'loginOrgCount',
    'organisationName', 'orgRegisteredAddress', 'orgSector', 'orgSubSector', 'orgIndustryCode',
    'buildingsAssessedCount', 'includeEvents', 'eventCount',
    'assetRegisteredOffice', 'assetGroupName', 'assetAddressLine1', 'assetAddressLine2', 'assetAddressLine3',
    'assetAddressLine4', 'assetTownCity', 'assetCounty', 'assetPostCode', 'assetFloorAreaM2', 'assetIncludeInOffset',
    'assetOwnerOrg', 'assetManagerOrg', 'assetOccupierOrg', 'assetDescription', 'assetOtherStakeholders',
    'buildingType', 'assetSubtype', 'constructionYear', 'refurbishmentYear', 'buildingHasCafe',
    'occupancyFte', 'operationalDaysAnnual', 'operationalHoursDaily',
    'giaM2', 'measurementStandard', 'nonLettableAreaM2', 'grossLettableAreaM2', 'planningRestrictions',
    'facadeWidthM', 'facadeLengthM', 'floorToFloorHeightM', 'floorsAboveGround', 'floorsBelowGround',
    'hardLandscapingM2', 'softLandscapingM2',
    'eventName', 'eventDurationDays', 'eventParticipants', 'eventEmployeeCount', 'eventIncludeInOffset',
    'eventCarPeopleEmp', 'eventCarPeopleGuest', 'eventCarDistanceEmp', 'eventCarDistanceGuest',
    'eventPublicTransportPeopleEmp', 'eventPublicTransportPeopleGuest',
    'eventPublicTransportDistanceEmp', 'eventPublicTransportDistanceGuest',
    'eventFlightsShortEmp', 'eventFlightsShortGuest', 'eventFlightsMediumEmp', 'eventFlightsMediumGuest',
    'eventFlightsLongEmp', 'eventFlightsLongGuest', 'eventFlightsBusinessClassPctEmp', 'eventFlightsBusinessClassPctGuest',
    'accPeople23Stars', 'accStays23Stars', 'accPeople4Stars', 'accStays4Stars', 'accPeople5Stars', 'accStays5Stars',
    'caterMealsNonVeg', 'caterMealsVeg', 'caterSnacks', 'caterWaterLitres', 'caterCoffeeCups', 'caterTeaCups',
    'caterWineLitres', 'caterBeerLitres', 'caterSpiritsLitres',
    'eventPowerKwh', 'eventGreenEnergy', 'eventMaterialsPrinted', 'eventMaterialsPlastics',
    'eventMaterialsRecyclable', 'eventMaterialsWoodPaper', 'eventStandAreaM2',
];

const GI_YES_NO_OPTIONS = [
    { value: '', label: '—' },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
];

function giLabel(text) {
    return String(text).replace(/</g, '&lt;');
}

function giFieldRow(field) {
    const id = `${field.key}Input`;
    const label = giLabel(field.label);
    const placeholder = field.placeholder ? ` placeholder="${giLabel(field.placeholder)}"` : '';
    const step = field.step != null ? ` step="${field.step}"` : '';
    const min = field.min != null ? ` min="${field.min}"` : '';

    if (field.type === 'textarea') {
        const rows = field.rows || 3;
        return `<div class="form-inline-group full-width">
            <label for="${id}">${label}</label>
            <textarea id="${id}" data-gi-key="${field.key}" rows="${rows}" maxlength="${field.maxlength || ''}"${placeholder}></textarea>
        </div>`;
    }
    if (field.type === 'select') {
        const opts = (field.options || GI_YES_NO_OPTIONS)
            .map((o) => `<option value="${giLabel(o.value)}">${giLabel(o.label)}</option>`)
            .join('');
        return `<div class="form-inline-group full-width">
            <label for="${id}">${label}</label>
            <select id="${id}" data-gi-key="${field.key}">${opts}</select>
        </div>`;
    }
    const inputType = field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text';
    return `<div class="form-inline-group full-width">
        <label for="${id}">${label}</label>
        <input type="${inputType}" id="${id}" data-gi-key="${field.key}"${placeholder}${step}${min} />
    </div>`;
}

function giPairedMobilityRow(field) {
    const base = field.baseKey;
    const label = giLabel(field.label);
    const empId = `${base}EmpInput`;
    const guestId = `${base}GuestInput`;
    const placeholder = field.placeholder ? ` placeholder="${giLabel(field.placeholder)}"` : '';
    const inputType = field.type === 'number' ? 'number' : 'text';
    const step = field.step != null ? ` step="${field.step}"` : '';
    const min = field.min != null ? ` min="${field.min}"` : '';
    return `<div class="form-inline-group full-width gi-paired-row">
        <label>${label}</label>
        <div class="gi-paired-inputs">
            <input type="${inputType}" id="${empId}" data-gi-key="${base}Emp" title="Employees"${placeholder}${step}${min} />
            <input type="${inputType}" id="${guestId}" data-gi-key="${base}Guest" title="Guests"${placeholder}${step}${min} />
        </div>
    </div>`;
}

function giSectionBlock(section) {
    const title = giLabel(section.title);
    let body = '';
    if (section.intro) {
        body += `<p class="general-info-intro">${giLabel(section.intro)}</p>`;
    }
    if (section.pairedColumns) {
        body += `<div class="general-info-two-col-headers">
            <span></span><span>Employees</span><span>Guests</span>
        </div>`;
        section.fields.forEach((f) => {
            body += giPairedMobilityRow(f);
        });
    } else if (section.splitColumns) {
        body += `<div class="general-info-split-cols">`;
        section.splitColumns.forEach((col) => {
            body += `<div class="general-info-split-col"><h4>${giLabel(col.title)}</h4>`;
            col.fields.forEach((f) => {
                body += giFieldRow(f);
            });
            body += `</div>`;
        });
        body += `</div>`;
    } else {
        section.fields.forEach((f) => {
            body += giFieldRow(f);
        });
    }
    return `<section class="general-info-section">
        <h3 data-en="${title}" data-pt="${title}">${title}</h3>
        ${body}
    </section>`;
}

const GENERAL_INFO_SECTIONS = [
    {
        title: 'Login details',
        fields: [
            { key: 'contactName', label: 'Contact Name', type: 'text' },
            { key: 'contactEmail', label: 'Email', type: 'email' },
            {
                key: 'locationCountry',
                label: 'Location (country)',
                type: 'select',
                options: [
                    { value: '', label: '—' },
                    { value: 'UK', label: 'United Kingdom' },
                    { value: 'BRAZIL', label: 'Brazil' },
                    { value: 'OTHER', label: 'Other' },
                ],
            },
            { key: 'loginOrgCount', label: 'How many organisations?', type: 'number', min: 0, step: 1 },
        ],
    },
    {
        title: 'Organisation details',
        fields: [
            { key: 'organisationName', label: 'Organisation Name', type: 'text' },
            {
                key: 'orgRegisteredAddress',
                label: 'Organisation Address (Registered address)',
                type: 'textarea',
                rows: 2,
            },
            { key: 'orgSector', label: 'Sector', type: 'text', placeholder: 'e.g. Commercial real estate' },
            { key: 'orgSubSector', label: 'Sub-sector', type: 'text' },
            { key: 'orgIndustryCode', label: 'Industry (SIC if available)', type: 'text' },
            {
                key: 'buildingsAssessedCount',
                label: 'How many buildings to be assessed?',
                type: 'number',
                min: 0,
                step: 1,
            },
            {
                key: 'includeEvents',
                label: 'Would you like to include events?',
                type: 'select',
                options: GI_YES_NO_OPTIONS,
            },
            { key: 'eventCount', label: 'How many events would you like to include?', type: 'number', min: 0, step: 1 },
        ],
    },
    {
        title: 'Full address — Asset 1',
        fields: [
            {
                key: 'assetRegisteredOffice',
                label: 'Is it the Registered office?',
                type: 'select',
                options: GI_YES_NO_OPTIONS,
            },
            { key: 'assetGroupName', label: 'Name of Asset / Property Group', type: 'text' },
            { key: 'assetAddressLine1', label: 'Address line 1', type: 'text' },
            { key: 'assetAddressLine2', label: 'Address line 2', type: 'text' },
            { key: 'assetAddressLine3', label: 'Address line 3', type: 'text' },
            { key: 'assetAddressLine4', label: 'Address line 4', type: 'text' },
            { key: 'assetTownCity', label: 'Town / City', type: 'text' },
            { key: 'assetCounty', label: 'County / Region / State', type: 'text' },
            { key: 'assetPostCode', label: 'Post code', type: 'text' },
            {
                key: 'assetFloorAreaM2',
                label: 'Building floor Area (m²)',
                type: 'number',
                min: 0,
                step: 'any',
            },
            {
                key: 'assetIncludeInOffset',
                label: 'Include in the offset calculation?',
                type: 'select',
                options: GI_YES_NO_OPTIONS,
            },
        ],
    },
    {
        title: 'Basic building details — Asset 1',
        fields: [
            { key: 'assetOwnerOrg', label: 'Organisation or person that owns the asset', type: 'text' },
            { key: 'assetManagerOrg', label: 'Organisation or person that manages the tenancy', type: 'text' },
            { key: 'assetOccupierOrg', label: 'Organisation or person that occupies / leases the asset', type: 'text' },
            {
                key: 'assetDescription',
                label: 'Asset Description (up to 500 characters)',
                type: 'textarea',
                rows: 4,
                maxlength: 500,
            },
            {
                key: 'assetOtherStakeholders',
                label: 'Add other stakeholders (Sustainability Consultant, MEP, partners…)',
                type: 'textarea',
                rows: 2,
            },
        ],
    },
    {
        title: 'General information — Asset 1',
        fields: [
            {
                key: 'buildingType',
                label: 'Building type',
                type: 'text',
                placeholder: 'e.g. office, theatre, museum, gym',
            },
            {
                key: 'assetSubtype',
                label: 'Asset Subtype',
                type: 'text',
                placeholder: 'headquarters, warehouse, supporting building…',
            },
            { key: 'constructionYear', label: 'Construction Year', type: 'number', min: 1800, step: 1 },
            { key: 'refurbishmentYear', label: 'Year of the latest major refurbishment', type: 'number', min: 1800, step: 1 },
            {
                key: 'buildingHasCafe',
                label: 'Café/restaurant in the building included in the assessment?',
                type: 'select',
                options: GI_YES_NO_OPTIONS,
            },
        ],
    },
    {
        title: 'Occupancy — Asset 1',
        fields: [
            {
                key: 'occupancyFte',
                label: 'Number of Full time Employee (FTE) in the building',
                type: 'number',
                min: 0,
                step: 1,
            },
            { key: 'operationalDaysAnnual', label: 'Annual operational days', type: 'number', min: 0, step: 1 },
            { key: 'operationalHoursDaily', label: 'Daily operational hours', type: 'number', min: 0, step: 'any' },
        ],
    },
    {
        title: 'Asset dimensions — Asset 1',
        fields: [
            { key: 'giaM2', label: 'Gross internal area (GIA scope only — m²)', type: 'number', min: 0, step: 'any' },
            {
                key: 'measurementStandard',
                label: 'Measurement standard',
                type: 'text',
                placeholder: 'e.g. Code of Measuring Practice (RICS)',
            },
            { key: 'nonLettableAreaM2', label: 'Non-lettable area (m²)', type: 'number', min: 0, step: 'any' },
            { key: 'grossLettableAreaM2', label: 'Gross lettable area (m²)', type: 'number', min: 0, step: 'any' },
            {
                key: 'planningRestrictions',
                label: 'Planning restrictions (listed?)',
                type: 'text',
                placeholder: 'e.g. Grade II Listed',
            },
            { key: 'facadeWidthM', label: 'Width (external façade) (m)', type: 'number', min: 0, step: 'any' },
            { key: 'facadeLengthM', label: 'Length (external façade) (m)', type: 'number', min: 0, step: 'any' },
            { key: 'floorToFloorHeightM', label: 'Height (floor-to-floor) (m)', type: 'number', min: 0, step: 'any' },
            { key: 'floorsAboveGround', label: 'Number of floors above ground', type: 'number', min: 0, step: 1 },
            { key: 'floorsBelowGround', label: 'Number of floors below ground', type: 'number', min: 0, step: 1 },
            { key: 'hardLandscapingM2', label: 'Area covered by hard landscaping (m²)', type: 'number', min: 0, step: 'any' },
            { key: 'softLandscapingM2', label: 'Area covered by soft landscaping (m²)', type: 'number', min: 0, step: 'any' },
        ],
    },
    {
        title: 'Events — General information',
        fields: [
            { key: 'eventName', label: 'Name of the event', type: 'text' },
            { key: 'eventDurationDays', label: 'Duration (days)', type: 'number', min: 0, step: 'any' },
            { key: 'eventParticipants', label: 'Participants', type: 'number', min: 0, step: 1 },
            { key: 'eventEmployeeCount', label: 'Number of employees for the event', type: 'number', min: 0, step: 1 },
            {
                key: 'eventIncludeInOffset',
                label: 'Include in the offset calculation?',
                type: 'select',
                options: GI_YES_NO_OPTIONS,
            },
        ],
    },
    {
        title: 'Events — Mobility',
        intro: 'Side-by-side: Employees | Guests',
        pairedColumns: true,
        fields: [
            { baseKey: 'eventCarPeople', label: 'Number of people arriving by car', type: 'number', min: 0, step: 1 },
            { baseKey: 'eventCarDistance', label: 'Average distance travelled (car)', type: 'number', min: 0, step: 'any', placeholder: 'km' },
            { baseKey: 'eventPublicTransportPeople', label: 'Number travelling by public transport', type: 'number', min: 0, step: 1 },
            { baseKey: 'eventPublicTransportDistance', label: 'Average distance (public transport)', type: 'number', min: 0, step: 'any', placeholder: 'km' },
            { baseKey: 'eventFlightsShort', label: 'Short-haul flights (up to 3 hours)', type: 'number', min: 0, step: 1 },
            { baseKey: 'eventFlightsMedium', label: 'Medium-haul flights (3–6 hours)', type: 'number', min: 0, step: 1 },
            { baseKey: 'eventFlightsLong', label: 'Long-haul flights (more than 6h)', type: 'number', min: 0, step: 1 },
            { baseKey: 'eventFlightsBusinessClassPct', label: 'Percentage business class flights', type: 'number', min: 0, max: 100, step: 'any', placeholder: '%' },
        ],
    },
    {
        title: 'Events — Accommodation & catering',
        splitColumns: [
            {
                title: 'Accommodation',
                fields: [
                    { key: 'accPeople23Stars', label: 'People staying overnight (2–3 star hotel)', type: 'number', min: 0, step: 1 },
                    { key: 'accStays23Stars', label: 'Overnight stays (2–3 star hotels)', type: 'number', min: 0, step: 1 },
                    { key: 'accPeople4Stars', label: 'People staying overnight (4 star hotel)', type: 'number', min: 0, step: 1 },
                    { key: 'accStays4Stars', label: 'Overnight stays (4 star hotels)', type: 'number', min: 0, step: 1 },
                    { key: 'accPeople5Stars', label: 'People staying overnight (5 star hotel)', type: 'number', min: 0, step: 1 },
                    { key: 'accStays5Stars', label: 'Overnight stays (5 star hotels)', type: 'number', min: 0, step: 1 },
                ],
            },
            {
                title: 'Catering',
                fields: [
                    { key: 'caterMealsNonVeg', label: 'Meals, not vegetarian (per person)', type: 'number', min: 0, step: 'any' },
                    { key: 'caterMealsVeg', label: 'Vegetarian meals (per person)', type: 'number', min: 0, step: 'any' },
                    { key: 'caterSnacks', label: 'Snacks', type: 'number', min: 0, step: 'any' },
                    { key: 'caterWaterLitres', label: 'Water / soft drinks (litres)', type: 'number', min: 0, step: 'any' },
                    { key: 'caterCoffeeCups', label: 'Coffee (cups)', type: 'number', min: 0, step: 1 },
                    { key: 'caterTeaCups', label: 'Tea (cups)', type: 'number', min: 0, step: 1 },
                    { key: 'caterWineLitres', label: 'Wine (litres)', type: 'number', min: 0, step: 'any' },
                    { key: 'caterBeerLitres', label: 'Beer (litres)', type: 'number', min: 0, step: 'any' },
                    { key: 'caterSpiritsLitres', label: 'Spirits (litres)', type: 'number', min: 0, step: 'any' },
                ],
            },
        ],
    },
    {
        title: 'Events — Energy & materials',
        splitColumns: [
            {
                title: 'Energy',
                fields: [
                    { key: 'eventPowerKwh', label: 'Power consumption (kWh)', type: 'number', min: 0, step: 'any' },
                    {
                        key: 'eventGreenEnergy',
                        label: 'Green energy',
                        type: 'select',
                        options: GI_YES_NO_OPTIONS,
                    },
                ],
            },
            {
                title: 'Materials',
                fields: [
                    { key: 'eventMaterialsPrinted', label: 'Printed (kg or ream)', type: 'text' },
                    { key: 'eventMaterialsPlastics', label: 'Plastics (kg)', type: 'number', min: 0, step: 'any' },
                    { key: 'eventMaterialsRecyclable', label: 'Recyclable material (kg)', type: 'number', min: 0, step: 'any' },
                    { key: 'eventMaterialsWoodPaper', label: 'Wood, carton, paper and plant-based (kg)', type: 'number', min: 0, step: 'any' },
                    { key: 'eventStandAreaM2', label: 'Area of stand (m² if applicable)', type: 'number', min: 0, step: 'any' },
                ],
            },
        ],
    },
];

function renderGeneralInfoSections(host) {
    if (!host || host.dataset.rendered === '1') return;
    host.dataset.rendered = '1';
    host.innerHTML = GENERAL_INFO_SECTIONS.map(giSectionBlock).join('');
}

function initGeneralInfoForm(getOrgLocalItem, setOrgLocalItem) {
    const host = document.getElementById('general-info-sections-host');
    renderGeneralInfoSections(host);

    const legacyMap = {
        assetGroupName: 'assetGroupName',
        orgRegisteredAddress: 'orgRegisteredAddress',
        orgSector: 'orgSector',
        orgSubSector: 'orgSubSector',
        orgIndustryCode: 'orgIndustryCode',
        buildingsAssessedCount: 'buildingsAssessedCount',
        eventCount: 'eventCount',
    };

    document.querySelectorAll('#section-general-info [data-gi-key]').forEach((el) => {
        const key = el.dataset.giKey;
        if (!key) return;

        let stored = getOrgLocalItem(key, '');
        if (!stored && key === 'organisationName') {
            stored = getOrgLocalItem('companyName', '');
            if (!stored) {
                const companyEl = document.getElementById('companyName');
                if (companyEl?.value) stored = companyEl.value;
            }
        }
        if (!stored && key === 'loginOrgCount') {
            stored = getOrgLocalItem('orgCount', '');
        }
        if (!stored && legacyMap[key]) {
            stored = getOrgLocalItem(legacyMap[key], '');
        }
        if (el.tagName === 'SELECT' || el.type === 'checkbox') {
            el.value = stored;
        } else {
            el.value = stored;
        }

        if (el.dataset.giBound === '1') return;
        el.dataset.giBound = '1';
        const persist = () => {
            const val = el.value || '';
            setOrgLocalItem(key, val);
            if (key === 'organisationName') {
                setOrgLocalItem('companyName', val);
                const companyEl = document.getElementById('companyName');
                if (companyEl) companyEl.value = val;
            }
            if (key === 'buildingsAssessedCount') {
                const legacyEl = document.getElementById('buildingsAssessedInput');
                if (legacyEl && legacyEl !== el) legacyEl.value = val;
            }
            if (key === 'locationCountry' && window.carbonCalc?.setCountry) {
                const c = val === 'BRAZIL' ? 'BRAZIL' : val === 'UK' ? 'UK' : null;
                if (c) window.carbonCalc.setCountry(c);
            }
        };
        el.addEventListener('input', persist);
        el.addEventListener('change', persist);
    });

    const buildingsAssessedEl = document.getElementById('buildingsAssessedInput');
    if (buildingsAssessedEl && buildingsAssessedEl.dataset.giBound !== '1') {
        buildingsAssessedEl.dataset.giBound = '1';
        const syncFromAssessment = () => {
            const v = buildingsAssessedEl.value || '';
            setOrgLocalItem('buildingsAssessedCount', v);
            const giEl = document.getElementById('buildingsAssessedCountInput');
            if (giEl) giEl.value = v;
        };
        buildingsAssessedEl.addEventListener('input', syncFromAssessment);
        buildingsAssessedEl.addEventListener('change', syncFromAssessment);
        const giVal = getOrgLocalItem('buildingsAssessedCount', '');
        if (giVal) buildingsAssessedEl.value = giVal;
    }
}

window.GeneralInfo = {
    STORAGE_KEYS: GENERAL_INFO_STORAGE_KEYS,
    initGeneralInfoForm,
};
