/**
 * Assessment Scope tab — spreadsheet layout (label | unit | Yes/No or Description).
 */
(function (global) {
    const YES_NO = [
        { value: '', labelEn: '—', labelPt: '—' },
        { value: 'yes', labelEn: 'Yes', labelPt: 'Sim' },
        { value: 'no', labelEn: 'No', labelPt: 'Não' },
    ];

    const ASSESSMENT_SCOPE_STORAGE_KEYS = [
        'assessmentOrgName',
        'assessmentBaseYear',
        'assessmentCalculationUnit',
        'netZeroCommitment',
        'energyIncluded',
        'electricityIncluded',
        'gasIncluded',
        'gasUnit',
        'elecDistLossIncluded',
        'wasteWaterIncluded',
        'wasteWaterUnit',
        'fleetIncluded',
        'businessTravelIncluded',
        'carbonReductionPlanDesc',
        'offsetStrategyDesc',
        'elaborateSubmitReviewDesc',
        'policyEnvIso14001',
        'policyHumanRights',
        'policySustainableProcurement',
        'policyEnergyAudit',
        'policyOdsGri',
        'intlEcoAuditActionPlan',
        'intlBreeamInUse',
        'intlCarbonReductionPlan',
        'intlScienceBasedTargets',
        'intlCibseBenchmark',
        'intlFitwell',
        'intlCrremEu',
        'intlNabersUk',
        'intlGresb',
        'intlLeedsOm',
        'intlWellStandard',
        'intlEcoChurch',
        'intlGhgProtocol',
        'intlSasb',
        'intlSfdr',
        'intlGri',
        'intlEuTaxonomy',
        'intlSkaRating',
        'otherStandardRequiredIntl',
    ];

    const SECTIONS = [
        {
            titleEn: 'Organisation Details',
            titlePt: 'Detalhes da Organização',
            col3: 'description',
            rows: [
                {
                    labelEn: 'Organisation Name (Client/owner)',
                    labelPt: 'Nome da Organização (Cliente/proprietário)',
                    type: 'text',
                    key: 'assessmentOrgName',
                    id: 'assessmentOrgNameInput',
                },
                {
                    labelEn: 'Organisation Address (head quarters/Main address)',
                    labelPt: 'Endereço da Organização (sede/endereço principal)',
                    type: 'textarea',
                    key: 'orgRegisteredAddress',
                    id: 'orgRegisteredAddressInput',
                    rows: 2,
                },
                {
                    labelEn: 'How many buildings included/assessed?',
                    labelPt: 'Quantos edifícios incluídos/avaliados?',
                    type: 'number',
                    key: 'buildingsAssessedCount',
                    id: 'buildingsAssessedInput',
                    min: 0,
                    step: 1,
                },
            ],
        },
        {
            titleEn: 'General NOTES — All assets or clearly state which assets',
            titlePt: 'NOTAS GERAIS — Todos os ativos ou indicar claramente quais ativos',
            col3: 'description',
            rows: [
                {
                    labelEn: 'Extra note to the reports 1',
                    labelPt: 'Nota extra para os relatórios 1',
                    type: 'textarea',
                    key: 'assessmentExtraNote1',
                    id: 'assessmentExtraNote1Input',
                    rows: 2,
                },
                {
                    labelEn: 'Extra note to the reports 2',
                    labelPt: 'Nota extra para os relatórios 2',
                    type: 'textarea',
                    key: 'assessmentExtraNote2',
                    id: 'assessmentExtraNote2Input',
                    rows: 2,
                },
            ],
        },
        {
            titleEn: 'Quantified Carbon Emissions',
            titlePt: 'Emissões de Carbono Quantificadas',
            col3: 'yesno',
            rows: [
                {
                    labelEn: 'Base year',
                    labelPt: 'Ano base',
                    type: 'text',
                    key: 'assessmentBaseYear',
                    id: 'assessmentBaseYearInput',
                    col3: 'description',
                },
                {
                    labelEn: 'Calculation unit',
                    labelPt: 'Unidade de cálculo',
                    type: 'unit_only',
                    unitKey: 'assessmentCalculationUnit',
                    unitOptions: [
                        { value: 'kg_co2e', labelEn: 'kg CO₂e', labelPt: 'kg CO₂e' },
                        { value: 'tonnes_co2e', labelEn: 'tonnes CO₂e', labelPt: 'toneladas CO₂e' },
                    ],
                    col3: 'description',
                },
                {
                    labelEn: 'Commitment to achieve Net Zero',
                    labelPt: 'Compromisso de atingir Net Zero',
                    type: 'yesno',
                    key: 'netZeroCommitment',
                },
                {
                    labelEn: 'Energy',
                    labelPt: 'Energia',
                    type: 'yesno',
                    key: 'energyIncluded',
                },
                {
                    labelEn: 'Electricity',
                    labelPt: 'Eletricidade',
                    type: 'unit_yesno',
                    yesKey: 'electricityIncluded',
                    unitKey: 'energyUnit',
                    unitId: 'energyUnitInput',
                    unitSync: 'energy',
                    unitOptions: [
                        { value: 'kwh', labelEn: 'kWh', labelPt: 'kWh' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Gas',
                    labelPt: 'Gás',
                    type: 'unit_yesno',
                    yesKey: 'gasIncluded',
                    unitKey: 'gasUnit',
                    unitOptions: [
                        { value: 'kwh', labelEn: 'kWh', labelPt: 'kWh' },
                        { value: 'litres', labelEn: 'Litres', labelPt: 'Litros' },
                        { value: 'tonnes', labelEn: 'Tonnes', labelPt: 'Toneladas' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Tick to include electricity distribution losses',
                    labelPt: 'Incluir perdas de distribuição de eletricidade',
                    type: 'unit_yesno',
                    yesKey: 'elecDistLossIncluded',
                    unitKey: 'elecDistLossUnit',
                    unitOptions: [
                        { value: 'kwh', labelEn: 'kWh', labelPt: 'kWh' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Water',
                    labelPt: 'Água',
                    type: 'unit_yesno',
                    yesKey: 'waterIncluded',
                    unitKey: 'waterUnit',
                    unitId: 'waterUnitInput',
                    unitSync: 'water',
                    unitOptions: [
                        { value: 'm3', labelEn: 'm³', labelPt: 'm³' },
                        { value: 'million_litres', labelEn: 'Million litres', labelPt: 'Milhões de litros' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Waste Water',
                    labelPt: 'Águas residuais',
                    type: 'unit_yesno',
                    yesKey: 'wasteWaterIncluded',
                    unitKey: 'wasteWaterUnit',
                    unitOptions: [
                        { value: 'm3', labelEn: 'm³', labelPt: 'm³' },
                        { value: 'million_litres', labelEn: 'Million litres', labelPt: 'Milhões de litros' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Waste',
                    labelPt: 'Resíduos',
                    type: 'unit_yesno',
                    yesKey: 'wasteIncluded',
                    unitKey: 'wasteUnit',
                    unitId: 'wasteUnitInput',
                    unitSync: 'waste',
                    unitOptions: [
                        { value: 'kg', labelEn: 'Kg', labelPt: 'Kg' },
                        { value: 'tonnes', labelEn: 'Tonnes', labelPt: 'Toneladas' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Company fleet and leased vehicles',
                    labelPt: 'Frota da empresa e veículos alugados',
                    type: 'unit_yesno',
                    yesKey: 'fleetIncluded',
                    unitKey: 'transportUnit',
                    unitId: 'transportUnitInput',
                    unitSync: 'transport',
                    unitOptions: [
                        { value: 'miles', labelEn: 'Miles', labelPt: 'Milhas' },
                        { value: 'km', labelEn: 'Km', labelPt: 'Km' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Business and Staff Travel',
                    labelPt: 'Viagens de negócios e funcionários',
                    type: 'unit_yesno',
                    yesKey: 'businessTravelIncluded',
                    unitKey: 'businessTravelUnit',
                    unitOptions: [
                        { value: 'miles', labelEn: 'Miles', labelPt: 'Milhas' },
                        { value: 'km', labelEn: 'Km', labelPt: 'Km' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Refrigerant',
                    labelPt: 'Refrigerante',
                    type: 'unit_yesno',
                    yesKey: 'refrigerantIncluded',
                    unitKey: 'refrigerantsUnit',
                    unitId: 'refrigerantsUnitInput',
                    unitSync: 'refrigerants',
                    unitOptions: [
                        { value: 'kg', labelEn: 'Kg', labelPt: 'Kg' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Hotel Stay',
                    labelPt: 'Estadia em hotel',
                    type: 'unit_yesno',
                    yesKey: 'hotelStayEnabled',
                    yesStore: 'boolean',
                    unitKey: 'hotelStayUnit',
                    unitOptions: [
                        { value: 'room_nights', labelEn: 'Room-Nights', labelPt: 'Noites-quarto' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Working from Home',
                    labelPt: 'Trabalho remoto',
                    type: 'unit_yesno',
                    yesKey: 'wfhEnabled',
                    yesStore: 'boolean',
                    unitKey: 'wfhUnit',
                    unitOptions: [
                        { value: 'working_hour', labelEn: 'Working hour', labelPt: 'Hora de trabalho' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Materials',
                    labelPt: 'Materiais',
                    type: 'unit_yesno',
                    yesKey: 'materialsEnabled',
                    yesStore: 'boolean',
                    unitKey: 'materialsUnit',
                    unitOptions: [
                        { value: 'tonnes', labelEn: 'Tonnes', labelPt: 'Toneladas' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Carbon Reduction Plan',
                    labelPt: 'Plano de Redução de Carbono',
                    type: 'textarea',
                    key: 'carbonReductionPlanDesc',
                    col3: 'description',
                    rows: 2,
                },
                {
                    labelEn: 'Off set strategy and targets',
                    labelPt: 'Estratégia e metas de compensação',
                    type: 'textarea',
                    key: 'offsetStrategyDesc',
                    col3: 'description',
                    rows: 2,
                },
                {
                    labelEn: 'Elaborate and submit for review and implementation',
                    labelPt: 'Elaborar e submeter para revisão e implementação',
                    type: 'textarea',
                    key: 'elaborateSubmitReviewDesc',
                    col3: 'description',
                    rows: 2,
                },
            ],
        },
        {
            titleEn: 'Standards Policies in Place (All assets or clearly state which assets)?',
            titlePt: 'Normas e políticas em vigor (todos os ativos ou indicar quais)?',
            col3: 'yesno',
            rows: [
                {
                    labelEn: 'Environment Policy (accredited to ISO 14001)',
                    labelPt: 'Política ambiental (acreditada ISO 14001)',
                    type: 'yesno',
                    key: 'policyEnvIso14001',
                },
                {
                    labelEn: 'Human Rights Policy',
                    labelPt: 'Política de direitos humanos',
                    type: 'yesno',
                    key: 'policyHumanRights',
                },
                {
                    labelEn: 'Sustainable Procurement Policy (ISO 20400)',
                    labelPt: 'Política de compras sustentáveis (ISO 20400)',
                    type: 'yesno',
                    key: 'policySustainableProcurement',
                },
                {
                    labelEn: 'Energy Audit (ISO 50001)',
                    labelPt: 'Auditoria energética (ISO 50001)',
                    type: 'yesno',
                    key: 'policyEnergyAudit',
                },
                {
                    labelEn: 'Has the organisation not utilised any ozone-depletion substances (ODS - GRI Commitment)?',
                    labelPt: 'A organização não utilizou substâncias que empobrecem o ozônio (ODS - compromisso GRI)?',
                    type: 'yesno',
                    key: 'policyOdsGri',
                },
                {
                    labelEn: 'Add other standard required',
                    labelPt: 'Adicionar outra norma exigida',
                    type: 'textarea',
                    key: 'otherStandardRequired',
                    id: 'otherStandardRequiredInput',
                    col3: 'description',
                    rows: 2,
                },
            ],
        },
        {
            titleEn: 'International Standards',
            titlePt: 'Normas Internacionais',
            col3: 'yesno',
            rows: [
                { labelEn: 'Eco Audit action plan', labelPt: 'Plano de ação Eco Audit', type: 'yesno', key: 'intlEcoAuditActionPlan' },
                { labelEn: 'BREEAM In-use Part 2', labelPt: 'BREEAM In-use Parte 2', type: 'yesno', key: 'intlBreeamInUse' },
                { labelEn: 'Carbon Reduction Plan', labelPt: 'Plano de Redução de Carbono', type: 'yesno', key: 'intlCarbonReductionPlan' },
                { labelEn: 'Science Based Targets', labelPt: 'Metas baseadas na ciência', type: 'yesno', key: 'intlScienceBasedTargets' },
                { labelEn: 'CIBSE BENCHMARK', labelPt: 'CIBSE BENCHMARK', type: 'yesno', key: 'intlCibseBenchmark' },
                { labelEn: 'Fitwell', labelPt: 'Fitwell', type: 'yesno', key: 'intlFitwell' },
                { labelEn: 'CRREM (EU)', labelPt: 'CRREM (UE)', type: 'yesno', key: 'intlCrremEu' },
                { labelEn: 'NABERS UK (offices only)', labelPt: 'NABERS UK (apenas escritórios)', type: 'yesno', key: 'intlNabersUk' },
                { labelEn: 'GRESB', labelPt: 'GRESB', type: 'yesno', key: 'intlGresb' },
                { labelEn: 'LEEDS O&M', labelPt: 'LEED O&M', type: 'yesno', key: 'intlLeedsOm' },
                { labelEn: 'Well Standard', labelPt: 'Well Standard', type: 'yesno', key: 'intlWellStandard' },
                { labelEn: 'Eco Church', labelPt: 'Eco Church', type: 'yesno', key: 'intlEcoChurch' },
                { labelEn: 'GHG Protocol', labelPt: 'Protocolo GEE', type: 'yesno', key: 'intlGhgProtocol' },
                { labelEn: 'SASB', labelPt: 'SASB', type: 'yesno', key: 'intlSasb' },
                { labelEn: 'SFDR', labelPt: 'SFDR', type: 'yesno', key: 'intlSfdr' },
                { labelEn: 'GRI', labelPt: 'GRI', type: 'yesno', key: 'intlGri' },
                { labelEn: 'EU Taxonomy', labelPt: 'Taxonomia UE', type: 'yesno', key: 'intlEuTaxonomy' },
                { labelEn: 'Ska rating', labelPt: 'Classificação Ska', type: 'yesno', key: 'intlSkaRating' },
                {
                    labelEn: 'Add other standard required',
                    labelPt: 'Adicionar outra norma exigida',
                    type: 'textarea',
                    key: 'otherStandardRequiredIntl',
                    col3: 'description',
                    rows: 2,
                },
            ],
        },
    ];

    function el(tag, className, attrs) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (attrs) {
            Object.entries(attrs).forEach(([k, v]) => {
                if (v != null) node.setAttribute(k, v);
            });
        }
        return node;
    }

    function appendBilingualLabel(cell, labelEn, labelPt) {
        const span = el('span');
        span.textContent = labelEn;
        span.setAttribute('data-en', labelEn);
        span.setAttribute('data-pt', labelPt);
        cell.appendChild(span);
    }

    function createYesNoSelect(storageKey, { booleanStore = false, defaultYes = true } = {}) {
        const select = el('select', 'assessment-scope-yn');
        select.dataset.storageKey = storageKey;
        if (booleanStore) {
            select.dataset.booleanStore = '1';
            select.dataset.calcRecalc = '1';
        }
        YES_NO.forEach((opt) => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.labelEn;
            o.setAttribute('data-en', opt.labelEn);
            o.setAttribute('data-pt', opt.labelPt);
            select.appendChild(o);
        });
        const stored = booleanStore
            ? (typeof global.getOrgLocalItem === 'function'
                ? global.getOrgLocalItem(storageKey, defaultYes ? 'true' : 'false')
                : 'true')
            : (typeof global.getOrgLocalItem === 'function' ? global.getOrgLocalItem(storageKey, '') : '');
        if (booleanStore) {
            select.value = stored === 'false' ? 'no' : stored === 'true' ? 'yes' : '';
        } else {
            select.value = stored === 'no' ? 'no' : stored === 'yes' ? 'yes' : '';
        }
        return select;
    }

    function createUnitSelect(row, unitKey, unitOptions, unitId) {
        const select = el('select', 'assessment-scope-unit');
        select.dataset.storageKey = unitKey;
        if (unitId) select.id = unitId;
        if (row.unitSync) select.dataset.unitSync = row.unitSync;
        unitOptions.forEach((opt) => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.labelEn;
            o.setAttribute('data-en', opt.labelEn);
            o.setAttribute('data-pt', opt.labelPt);
            select.appendChild(o);
        });
        const fallback = unitOptions[0]?.value || '';
        const stored =
            typeof global.getOrgLocalItem === 'function'
                ? global.getOrgLocalItem(unitKey, fallback)
                : fallback;
        select.value = stored || fallback;
        return select;
    }

    function persistYesNo(select) {
        const key = select.dataset.storageKey;
        if (!key || typeof global.setOrgLocalItem !== 'function') return;
        if (select.dataset.booleanStore === '1') {
            if (!select.value) global.setOrgLocalItem(key, 'true');
            else global.setOrgLocalItem(key, select.value === 'yes' ? 'true' : 'false');
        } else {
            global.setOrgLocalItem(key, select.value || '');
        }
        recalcIfNeeded(select);
    }

    function recalcIfNeeded(el) {
        if (el.dataset.calcRecalc !== '1') return;
        if (global.carbonCalc?.calculateAllTotals) global.carbonCalc.calculateAllTotals();
        if (typeof global.updateDashboard === 'function') global.updateDashboard();
    }

    function bindField(control) {
        if (!control || control.dataset.asBound === '1') return;
        control.dataset.asBound = '1';
        const key = control.dataset.storageKey;
        const handler = () => {
            if (!key || typeof global.setOrgLocalItem !== 'function') return;
            global.setOrgLocalItem(key, control.value == null ? '' : String(control.value));
            if (control.dataset.unitSync) {
                syncCategoryUnits(control.dataset.unitSync, control.value);
            }
            recalcIfNeeded(control);
        };
        control.addEventListener('input', handler);
        control.addEventListener('change', handler);
        if (control.classList.contains('assessment-scope-yn')) {
            control.addEventListener('change', () => persistYesNo(control));
        }
    }

    function syncCategoryUnits(category, value) {
        if (!value || value === 'none') return;
        document.querySelectorAll(`#${category}Table .row-unit-select`).forEach((unitEl) => {
            const mapped = mapAssessmentUnitToRowUnit(category, value);
            if (mapped) unitEl.value = mapped;
        });
        if (typeof global.saveCurrentSiteData === 'function') {
            global.saveCurrentSiteData();
        }
    }

    function mapAssessmentUnitToRowUnit(category, value) {
        const map = {
            water: { m3: 'm3', million_litres: 'litres' },
            energy: { kwh: 'kwh' },
            waste: { kg: 'kg', tonnes: 'tonnes' },
            transport: { miles: 'miles', km: 'km' },
            refrigerants: { kg: 'kg' },
        };
        return (map[category] && map[category][value]) || value;
    }

    function renderAssessmentScopeForm(host) {
        if (!host) return;
        host.innerHTML = '';

        SECTIONS.forEach((section) => {
            const wrap = el('div', 'assessment-scope-section card p-4');
            const title = el('h3', 'assessment-scope-section-title');
            title.setAttribute('data-en', section.titleEn);
            title.setAttribute('data-pt', section.titlePt);
            title.textContent = section.titleEn;
            wrap.appendChild(title);

            const table = el('table', 'assessment-scope-table');
            const thead = el('thead');
            const headRow = el('tr');
            const col3Label = section.col3 === 'yesno' ? '(Yes or No)' : 'Description';
            const col3LabelPt = section.col3 === 'yesno' ? '(Sim ou Não)' : 'Descrição';
            ['', 'Unit', col3Label].forEach((text, i) => {
                const th = el('th');
                if (i === 0) th.textContent = '';
                else if (i === 1) {
                    th.textContent = 'Unit';
                    th.setAttribute('data-en', 'Unit');
                    th.setAttribute('data-pt', 'Unidade');
                } else {
                    th.textContent = col3Label;
                    th.setAttribute('data-en', col3Label);
                    th.setAttribute('data-pt', col3LabelPt);
                }
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);

            const tbody = el('tbody');
            section.rows.forEach((row) => {
                const tr = el('tr');
                const labelTd = el('td', 'assessment-scope-label');
                appendBilingualLabel(labelTd, row.labelEn, row.labelPt);
                tr.appendChild(labelTd);

                const unitTd = el('td', 'assessment-scope-unit-cell');
                const valueTd = el('td', 'assessment-scope-value-cell');
                const col3 = row.col3 || section.col3;

                if (row.type === 'unit_yesno') {
                    unitTd.appendChild(createUnitSelect(row, row.unitKey, row.unitOptions, row.unitId));
                    const yn = createYesNoSelect(row.yesKey, {
                        booleanStore: row.yesStore === 'boolean',
                        defaultYes: row.yesStore === 'boolean',
                    });
                    valueTd.appendChild(yn);
                } else if (row.type === 'unit_only') {
                    unitTd.appendChild(createUnitSelect(row, row.unitKey, row.unitOptions));
                    valueTd.textContent = '—';
                    valueTd.classList.add('assessment-scope-na');
                } else if (row.type === 'yesno') {
                    unitTd.textContent = '—';
                    unitTd.classList.add('assessment-scope-na');
                    const yn = createYesNoSelect(row.key);
                    valueTd.appendChild(yn);
                } else if (col3 === 'description' || row.type === 'text' || row.type === 'textarea' || row.type === 'number') {
                    unitTd.textContent = '—';
                    unitTd.classList.add('assessment-scope-na');
                    let control;
                    if (row.type === 'textarea') {
                        control = el('textarea', 'assessment-scope-input');
                        control.rows = row.rows || 2;
                    } else if (row.type === 'number') {
                        control = el('input', 'assessment-scope-input');
                        control.type = 'number';
                        if (row.min != null) control.min = String(row.min);
                        if (row.step != null) control.step = String(row.step);
                    } else {
                        control = el('input', 'assessment-scope-input');
                        control.type = 'text';
                    }
                    if (row.id) control.id = row.id;
                    control.dataset.storageKey = row.key;
                    const stored =
                        typeof global.getOrgLocalItem === 'function'
                            ? global.getOrgLocalItem(row.key, '')
                            : '';
                    control.value = stored;
                    valueTd.appendChild(control);
                }

                tr.appendChild(unitTd);
                tr.appendChild(valueTd);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            wrap.appendChild(table);
            host.appendChild(wrap);
        });

        host.querySelectorAll('[data-storage-key]').forEach(bindField);
        host.querySelectorAll('.assessment-scope-yn').forEach((select) => {
            if (select.dataset.asBound === '1') return;
            select.dataset.asBound = '1';
            select.addEventListener('change', () => persistYesNo(select));
        });

        const orgNameEl = document.getElementById('assessmentOrgNameInput');
        if (orgNameEl && !orgNameEl.value) {
            const company =
                document.getElementById('companyNameInput')?.value ||
                (typeof global.getOrgLocalItem === 'function'
                    ? global.getOrgLocalItem('companyName', '')
                    : '');
            if (company) orgNameEl.value = company;
        }
    }

    function initAssessmentScopeForm() {
        const host = document.getElementById('assessment-scope-form-host');
        if (!host) return;
        renderAssessmentScopeForm(host);
        if (typeof global.bindAssessmentScopeExtras === 'function') {
            global.bindAssessmentScopeExtras();
        } else if (global.carbonCalc?.rebuildConversionFactorCheckboxes) {
            global.carbonCalc.rebuildConversionFactorCheckboxes();
        }
    }

    global.AssessmentScopeForm = {
        SECTIONS,
        STORAGE_KEYS: ASSESSMENT_SCOPE_STORAGE_KEYS,
        init: initAssessmentScopeForm,
        render: renderAssessmentScopeForm,
    };
})(typeof window !== 'undefined' ? window : globalThis);
