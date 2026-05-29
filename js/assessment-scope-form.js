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
        'electricityUnit',
        'gasIncluded',
        'gasUnit',
        'elecDistLossIncluded',
        'elecDistLossUnit',
        'waterIncluded',
        'waterUnit',
        'wasteWaterIncluded',
        'wasteWaterUnit',
        'wasteIncluded',
        'wasteUnit',
        'fleetIncluded',
        'transportUnit',
        'businessTravelIncluded',
        'businessTravelUnit',
        'refrigerantIncluded',
        'refrigerantsUnit',
        'hotelStayEnabled',
        'hotelStayUnit',
        'wfhEnabled',
        'wfhUnit',
        'materialsEnabled',
        'materialsUnit',
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

    const ELECTRICITY_EMISSION_KEYS = new Set(['electricity', 'electricity_grid']);
    const GAS_EMISSION_KEYS = new Set([
        'naturalGas', 'diesel', 'lpg', 'coal', 'natural_gas', 'heating_oil',
    ]);
    const WATER_SUPPLY_KEYS = new Set(['water', 'water_supply', 'water_reuse']);
    const WASTEWATER_KEYS = new Set(['wastewater', 'water_treatment']);
    const WASTE_EMISSION_KEYS = new Set([
        'waste', 'waste_landfill', 'waste_to_energy', 'waste_to_recycling', 'waste_to_composting',
        'wasteRecycled', 'waste_composted',
    ]);

    /** Pairs of assessment-scope unit keys that stay in sync (datasheet: same unit family). */
    const UNIT_MIRROR_KEYS = {
        waterUnit: 'wasteWaterUnit',
        wasteWaterUnit: 'waterUnit',
        transportUnit: 'businessTravelUnit',
        businessTravelUnit: 'transportUnit',
    };

    const SYNC_GROUP_TABLE = {
        energy_electricity: 'energyTable',
        energy_gas: 'energyTable',
        water_supply: 'waterTable',
        water_wastewater: 'waterTable',
        waste: 'wasteTable',
        transport_fleet: 'transportTable',
        transport_travel: 'transportTable',
        refrigerants: 'refrigerantsTable',
        transport_hotel: 'transportTable',
        transport_wfh: 'transportTable',
        transport_materials: 'transportTable',
    };

    /** Maps conversion-factor subgroups to assessment-scope unit storage keys. */
    const SUBGROUP_UNIT_STORAGE_KEYS = {
        electricity: 'electricityUnit',
        gas_energy: 'gasUnit',
        water: 'waterUnit',
        wastewater: 'wasteWaterUnit',
        waste: 'wasteUnit',
        fleet: 'transportUnit',
        business_travel: 'businessTravelUnit',
        freight: 'businessTravelUnit',
        refrigerants: 'refrigerantsUnit',
        hotel_stay: 'hotelStayUnit',
        wfh: 'wfhUnit',
        materials: 'materialsUnit',
        other_transport: 'businessTravelUnit',
    };

    const SECTIONS = [
        {
            titleEn: 'Organisation Details',
            titlePt: 'Detalhes da Organização',
            col3: 'description',
            hideUnitColumn: true,
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
            hideUnitColumn: true,
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
                    unitKey: 'electricityUnit',
                    unitId: 'electricityUnitInput',
                    unitSync: 'energy_electricity',
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
                    unitSync: 'energy_gas',
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
                    unitSync: 'energy_electricity',
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
                    unitSync: 'water_supply',
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
                    unitSync: 'water_wastewater',
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
                        { value: 'lbs', labelEn: 'lbs', labelPt: 'lbs' },
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
                    unitSync: 'transport_fleet',
                    unitOptions: [
                        { value: 'miles', labelEn: 'Miles', labelPt: 'Milhas' },
                        { value: 'km', labelEn: 'Km', labelPt: 'Km' },
                        { value: 'passenger_km', labelEn: 'Passenger-km', labelPt: 'Passageiro-km' },
                        { value: 'tonne_km', labelEn: 'Tonne-km', labelPt: 'Tonelada-km' },
                        { value: 'none', labelEn: 'No option', labelPt: 'Sem opção' },
                    ],
                },
                {
                    labelEn: 'Business and Staff Travel',
                    labelPt: 'Viagens de negócios e funcionários',
                    type: 'unit_yesno',
                    yesKey: 'businessTravelIncluded',
                    unitKey: 'businessTravelUnit',
                    unitSync: 'transport_travel',
                    unitOptions: [
                        { value: 'miles', labelEn: 'Miles', labelPt: 'Milhas' },
                        { value: 'km', labelEn: 'Km', labelPt: 'Km' },
                        { value: 'passenger_km', labelEn: 'Passenger-km', labelPt: 'Passageiro-km' },
                        { value: 'tonne_km', labelEn: 'Tonne-km', labelPt: 'Tonelada-km' },
                        { value: 'night', labelEn: 'Room-nights', labelPt: 'Noites-quarto' },
                        { value: 'day', labelEn: 'Day', labelPt: 'Dia' },
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
                        { value: 'g', labelEn: 'g', labelPt: 'g' },
                        { value: 'lbs', labelEn: 'lbs', labelPt: 'lbs' },
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
                    unitSync: 'transport_hotel',
                    unitOptions: [
                        { value: 'room_nights', labelEn: 'Room-Nights', labelPt: 'Noites-quarto' },
                        { value: 'night', labelEn: 'Night', labelPt: 'Noite' },
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
                    unitSync: 'transport_wfh',
                    unitOptions: [
                        { value: 'working_hour', labelEn: 'Working hour', labelPt: 'Hora de trabalho' },
                        { value: 'day', labelEn: 'Day', labelPt: 'Dia' },
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
                    unitSync: 'transport_materials',
                    unitOptions: [
                        { value: 'tonnes', labelEn: 'Tonnes', labelPt: 'Toneladas' },
                        { value: 'kg', labelEn: 'Kg', labelPt: 'Kg' },
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
            hideUnitColumn: true,
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
            hideUnitColumn: true,
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

    function isGasEmission(emissionKey) {
        return GAS_EMISSION_KEYS.has(String(emissionKey || ''));
    }

    function isElectricityEmission(emissionKey) {
        return ELECTRICITY_EMISSION_KEYS.has(String(emissionKey || ''));
    }

    function emissionMatchesSyncGroup(emissionKey, syncGroup) {
        const k = String(emissionKey || '');
        if (!k || !syncGroup) return false;
        switch (syncGroup) {
            case 'energy_electricity':
                return isElectricityEmission(k);
            case 'energy_gas':
                return isGasEmission(k);
            case 'water_supply':
                return WATER_SUPPLY_KEYS.has(k);
            case 'water_wastewater':
                return WASTEWATER_KEYS.has(k);
            case 'waste':
                return WASTE_EMISSION_KEYS.has(k) || k.startsWith('waste');
            case 'refrigerants':
                return k.startsWith('refrigerant_');
            case 'transport_fleet':
                return /^(car_|van_|hgv_|transport_petrol|transport_diesel|transport_electric|motorbike_)/.test(k);
            case 'transport_travel':
                return /^(flight_|staff_commute|business_travel|freight_|bus_|rail_|taxi_)/.test(k)
                    || k.includes('commute');
            case 'transport_hotel':
                return k.includes('hotel') || k === 'business_travel_hotel_night';
            case 'transport_wfh':
                return k.includes('wfh');
            case 'transport_materials':
                return k.startsWith('materials_');
            default:
                return false;
        }
    }

    function setUnitSelectValue(storageKey, value) {
        if (!storageKey || !value || typeof global.setOrgLocalItem !== 'function') return;
        global.setOrgLocalItem(storageKey, value);
        document.querySelectorAll(`.assessment-scope-unit[data-storage-key="${CSS.escape(storageKey)}"]`).forEach((sel) => {
            if (Array.from(sel.options).some((o) => o.value === value)) {
                sel.value = value;
            }
        });
    }

    function mirrorLinkedUnit(sourceKey, value) {
        const mirrorKey = UNIT_MIRROR_KEYS[sourceKey];
        if (!mirrorKey || !value || value === 'none') return;
        setUnitSelectValue(mirrorKey, value);
        const mirrorSelect = document.querySelector(
            `.assessment-scope-unit[data-storage-key="${CSS.escape(mirrorKey)}"]`
        );
        if (mirrorSelect?.dataset.unitSync) {
            syncCategoryUnits(mirrorSelect.dataset.unitSync, value);
        }
    }

    function findUnitOptionsForStorageKey(storageKey) {
        for (const section of SECTIONS) {
            for (const row of section.rows) {
                if (row.unitKey === storageKey && row.unitOptions) {
                    return row.unitOptions;
                }
            }
        }
        return null;
    }

    function getUnitDisplayLabelsForStorageKey(storageKey) {
        if (!storageKey) return null;
        let value = '';
        const sel = document.querySelector(
            `.assessment-scope-unit[data-storage-key="${CSS.escape(storageKey)}"]`
        );
        if (sel) value = sel.value;
        if (!value && typeof global.getOrgLocalItem === 'function') {
            value = global.getOrgLocalItem(storageKey, '');
        }
        if (!value || value === 'none') return null;

        if (sel) {
            const opt = Array.from(sel.options).find((o) => o.value === value);
            if (opt) {
                return {
                    en: opt.getAttribute('data-en') || opt.textContent || value,
                    pt: opt.getAttribute('data-pt') || opt.textContent || value,
                };
            }
        }

        const match = findUnitOptionsForStorageKey(storageKey)?.find((o) => o.value === value);
        if (match) {
            return { en: match.labelEn, pt: match.labelPt };
        }
        return { en: value, pt: value };
    }

    function getSubgroupUnitDisplayLabels(subgroup) {
        const storageKey = SUBGROUP_UNIT_STORAGE_KEYS[subgroup];
        if (!storageKey) return null;
        return getUnitDisplayLabelsForStorageKey(storageKey);
    }

    function refreshConversionFactorHeadings() {
        if (global.carbonCalc?.rebuildConversionFactorCheckboxes) {
            global.carbonCalc.rebuildConversionFactorCheckboxes();
        }
    }

    function applyCalculationUnitCascade(calcUnit, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const outputUnit = calcUnit === 'kg_co2e' ? 'kgCO2e' : 'tCO2e';

        const massPref = calcUnit === 'kg_co2e' ? 'kg' : 'tonnes';
        setUnitSelectValue('wasteUnit', massPref);
        syncCategoryUnits('waste', massPref);
        if (calcUnit === 'kg_co2e') {
            setUnitSelectValue('refrigerantsUnit', 'kg');
            syncCategoryUnits('refrigerants', 'kg');
        }

        const ou = document.getElementById('outputUnitSelect');
        if (ou) ou.value = outputUnit;

        refreshConversionFactorHeadings();

        // When syncing from toolbar setOutputUnit, skip calling back into carbonCalc.
        if (opts.skipCarbonCalc) return;

        if (typeof global.setOrgLocalItem === 'function') {
            global.setOrgLocalItem('carbonCalcOutputUnit', outputUnit);
        }
        if (global.carbonCalc?.setOutputUnit) {
            global.carbonCalc.setOutputUnit(outputUnit);
        }
    }

    function resolveCategoryPreferredUnit(category, emissionKey) {
        const get = (key, fallback) =>
            typeof global.getOrgLocalItem === 'function'
                ? global.getOrgLocalItem(key, fallback)
                : fallback;
        if (category === 'energy' && emissionKey) {
            if (isGasEmission(emissionKey)) {
                return mapAssessmentUnitToRowUnit('energy', get('gasUnit', 'kwh'), emissionKey);
            }
            if (isElectricityEmission(emissionKey)) {
                return mapAssessmentUnitToRowUnit('energy', get('electricityUnit', 'kwh'), emissionKey);
            }
            return mapAssessmentUnitToRowUnit('energy', get('energyUnit', 'kwh'), emissionKey);
        }
        const keyMap = {
            water: 'waterUnit',
            waste: 'wasteUnit',
            transport: 'transportUnit',
            refrigerants: 'refrigerantsUnit',
        };
        const prefKey = keyMap[category];
        if (!prefKey) return '';
        return mapAssessmentUnitToRowUnit(category, get(prefKey, ''), emissionKey);
    }

    function resolvePreferredUnit(category, emissionKey) {
        if (emissionKey && typeof global.getOrgLocalItem === 'function') {
            const factorUnit = global.getOrgLocalItem(`factorUnit_${emissionKey}`, '');
            if (factorUnit && factorUnit !== 'none') {
                return factorUnit;
            }
        }
        return resolveCategoryPreferredUnit(category, emissionKey);
    }

    function syncFactorUnitSelectsFromCategoryUnit(categoryUnitKey, assessmentValue) {
        if (!assessmentValue || assessmentValue === 'none') return;
        Object.entries(SUBGROUP_UNIT_STORAGE_KEYS).forEach(([subgroup, storageKey]) => {
            if (storageKey !== categoryUnitKey) return;
            document.querySelectorAll('.conversion-factor-unit').forEach((sel) => {
                const factorKey = sel.dataset.factorKey;
                if (!factorKey) return;
                if (global.carbonCalc?.inferFactorAssessmentSubgroup?.(factorKey) !== subgroup) return;
                const storageKeyFactor = global.carbonCalc?.factorUnitStorageKey?.(factorKey);
                if (
                    storageKeyFactor &&
                    typeof global.getOrgLocalItem === 'function' &&
                    global.getOrgLocalItem(storageKeyFactor, '')
                ) {
                    return;
                }
                const category = global.carbonCalc?.inferFactorCategory?.(factorKey) || 'transport';
                const rowUnit = mapAssessmentUnitToRowUnit(category, assessmentValue, factorKey);
                if (rowUnit && Array.from(sel.options).some((o) => o.value === rowUnit)) {
                    sel.value = rowUnit;
                }
            });
        });
    }

    function getEnergyUnitOptions(emissionKey) {
        if (isGasEmission(emissionKey)) {
            return [
                ['kwh', 'kWh'],
                ['litres', 'Litres'],
                ['tonnes', 'Tonnes'],
                ['mwh', 'MWh'],
                ['gj', 'GJ'],
            ];
        }
        return [['kwh', 'kWh'], ['mwh', 'MWh'], ['gj', 'GJ'], ['mj', 'MJ'], ['therms', 'therms']];
    }

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
            const val = control.value == null ? '' : String(control.value);
            global.setOrgLocalItem(key, val);
            if (key === 'assessmentCalculationUnit') {
                applyCalculationUnitCascade(val);
            }
            if (UNIT_MIRROR_KEYS[key]) {
                mirrorLinkedUnit(key, val);
            }
            if (control.dataset.unitSync) {
                syncCategoryUnits(control.dataset.unitSync, val);
            }
            if (control.classList.contains('assessment-scope-unit') && key !== 'assessmentCalculationUnit') {
                syncFactorUnitSelectsFromCategoryUnit(key, val);
            }
            recalcIfNeeded(control);
        };
        control.addEventListener('input', handler);
        control.addEventListener('change', handler);
        if (control.classList.contains('assessment-scope-yn')) {
            control.addEventListener('change', () => persistYesNo(control));
        }
    }

    function syncCategoryUnits(syncGroup, value) {
        if (!value || value === 'none') return;
        const tableId = SYNC_GROUP_TABLE[syncGroup];
        if (!tableId) return;
        const category = tableId.replace(/Table$/, '');
        document.querySelectorAll(`#${tableId} tr.data-row`).forEach((tr) => {
            const emissionSel = tr.querySelector('.emission-select');
            const unitEl = tr.querySelector('.row-unit-select');
            if (!emissionSel || !unitEl) return;
            if (!emissionMatchesSyncGroup(emissionSel.value, syncGroup)) return;
            const mapped = mapAssessmentUnitToRowUnit(category, value, emissionSel.value);
            if (mapped && Array.from(unitEl.options).some((o) => o.value === mapped)) {
                unitEl.value = mapped;
            }
        });
        if (typeof global.saveCurrentSiteData === 'function') {
            global.saveCurrentSiteData();
        }
        if (global.carbonCalc?.calculateAllTotals) {
            global.carbonCalc.calculateAllTotals();
        }
    }

    function mapAssessmentUnitToRowUnit(category, value, emissionKey) {
        const map = {
            water: { m3: 'm3', million_litres: 'litres', litres: 'litres', gallons: 'gallons', ft3: 'ft3' },
            energy: {
                kwh: 'kwh',
                litres: 'litres',
                tonnes: 'tonnes',
                mwh: 'mwh',
                gj: 'gj',
                mj: 'mj',
                therms: 'therms',
            },
            waste: { kg: 'kg', tonnes: 'tonnes', lbs: 'lbs' },
            transport: {
                miles: 'miles',
                km: 'km',
                passenger_km: 'passenger_km',
                tonne_km: 'tonne_km',
                room_nights: 'night',
                night: 'night',
                working_hour: 'day',
                day: 'day',
            },
            refrigerants: { kg: 'kg', g: 'g', lbs: 'lbs' },
        };
        const base = (map[category] && map[category][value]) || value;
        if (category === 'energy' && emissionKey && isGasEmission(emissionKey)) {
            if (['litres', 'tonnes', 'kwh'].includes(value)) return value;
        }
        return base;
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
            if (section.hideUnitColumn) {
                table.classList.add('assessment-scope-table--no-unit');
            }
            const thead = el('thead');
            const headRow = el('tr');
            const col3Label = section.col3 === 'yesno' ? '(Yes or No)' : 'Description';
            const col3LabelPt = section.col3 === 'yesno' ? '(Sim ou Não)' : 'Descrição';
            const headerCols = section.hideUnitColumn ? ['', col3Label] : ['', 'Unit', col3Label];
            headerCols.forEach((text, i) => {
                const th = el('th');
                if (i === 0) {
                    th.textContent = '';
                } else if (!section.hideUnitColumn && text === 'Unit') {
                    th.textContent = 'Unit';
                    th.setAttribute('data-en', 'Unit');
                    th.setAttribute('data-pt', 'Unidade');
                } else {
                    th.textContent = text;
                    th.setAttribute('data-en', text);
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

                const unitTd = section.hideUnitColumn ? null : el('td', 'assessment-scope-unit-cell');
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
                    if (unitTd) {
                        unitTd.textContent = '—';
                        unitTd.classList.add('assessment-scope-na');
                    }
                    const yn = createYesNoSelect(row.key);
                    valueTd.appendChild(yn);
                } else if (col3 === 'description' || row.type === 'text' || row.type === 'textarea' || row.type === 'number') {
                    if (unitTd) {
                        unitTd.textContent = '—';
                        unitTd.classList.add('assessment-scope-na');
                    }
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

                if (unitTd) tr.appendChild(unitTd);
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

        if (typeof global.getOrgLocalItem === 'function' && typeof global.setOrgLocalItem === 'function') {
            const legacyEnergy = global.getOrgLocalItem('energyUnit', '');
            if (!global.getOrgLocalItem('electricityUnit', '') && legacyEnergy) {
                global.setOrgLocalItem('electricityUnit', legacyEnergy);
            }
        }

        const calcUnit =
            typeof global.getOrgLocalItem === 'function'
                ? global.getOrgLocalItem('assessmentCalculationUnit', 'tonnes_co2e')
                : 'tonnes_co2e';
        applyCalculationUnitCascade(calcUnit || 'tonnes_co2e');
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

    global.AssessmentScopeUnits = {
        resolvePreferredUnit,
        resolveCategoryPreferredUnit,
        getEnergyUnitOptions,
        isGasEmission,
        isElectricityEmission,
        mapAssessmentUnitToRowUnit,
        applyCalculationUnitCascade,
        getSubgroupUnitDisplayLabels,
        getUnitDisplayLabelsForStorageKey,
    };

    global.AssessmentScopeForm = {
        SECTIONS,
        STORAGE_KEYS: ASSESSMENT_SCOPE_STORAGE_KEYS,
        init: initAssessmentScopeForm,
        render: renderAssessmentScopeForm,
    };
})(typeof window !== 'undefined' ? window : globalThis);
