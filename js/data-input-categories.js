/**
 * Data input tab categories — transport split into fleet, business travel, freight, etc.
 */
(function (global) {
    const TRANSPORT_SUB_CATEGORIES = [
        'businessTravel',
        'freight',
        'staffCommute',
        'wfh',
        'materials',
    ];

    const DATA_INPUT_CATEGORIES = [
        'water',
        'energy',
        'waste',
        'transport',
        ...TRANSPORT_SUB_CATEGORIES,
        'refrigerants',
    ];

    const TAB_META = {
        transport: {
            titleEn: 'Company Fleet',
            titlePt: 'Frota da Empresa',
            icon: 'fa-car',
            summaryEn: 'Total Company Fleet Emissions:',
            summaryPt: 'Total de Emissões da Frota:',
            totalColEn: 'Total (km)',
            totalColPt: 'Total (km)',
            defaultEmission: 'transport_petrol',
            placeholder: 'Company vehicles',
        },
        businessTravel: {
            titleEn: 'Business Travel',
            titlePt: 'Viagens de Negócios',
            icon: 'fa-plane',
            summaryEn: 'Total Business Travel Emissions:',
            summaryPt: 'Total de Emissões de Viagens de Negócios:',
            totalColEn: 'Total (km)',
            totalColPt: 'Total (km)',
            defaultEmission: 'flights_short',
            placeholder: 'Business travel',
        },
        freight: {
            titleEn: 'Freighting Goods',
            titlePt: 'Frete de Mercadorias',
            icon: 'fa-truck-loading',
            summaryEn: 'Total Freight Emissions:',
            summaryPt: 'Total de Emissões de Frete:',
            totalColEn: 'Total (tonne-km)',
            totalColPt: 'Total (tonelada-km)',
            defaultEmission: 'freight_road_tonne_km',
            placeholder: 'Freighting goods',
        },
        staffCommute: {
            titleEn: 'Staff Commute',
            titlePt: 'Deslocamento de Equipe',
            icon: 'fa-bus',
            summaryEn: 'Total Staff Commute Emissions:',
            summaryPt: 'Total de Emissões de Deslocamento:',
            totalColEn: 'Total (km)',
            totalColPt: 'Total (km)',
            defaultEmission: 'staff_commute_car_km',
            placeholder: 'Staff commute',
        },
        wfh: {
            titleEn: 'Working from Home',
            titlePt: 'Trabalho Remoto',
            icon: 'fa-home',
            summaryEn: 'Total Working from Home Emissions:',
            summaryPt: 'Total de Emissões de Trabalho Remoto:',
            totalColEn: 'Total (days)',
            totalColPt: 'Total (dias)',
            defaultEmission: 'wfh_day',
            placeholder: 'Working from home',
        },
        materials: {
            titleEn: 'Materials',
            titlePt: 'Materiais',
            icon: 'fa-boxes',
            summaryEn: 'Total Materials Emissions:',
            summaryPt: 'Total de Emissões de Materiais:',
            totalColEn: 'Total (kg)',
            totalColPt: 'Total (kg)',
            defaultEmission: 'materials_paper_kg',
            placeholder: 'Materials',
        },
    };

    function dataCategoryForEmissionKey(emissionKey) {
        const k = String(emissionKey || '');
        if (!k) return 'transport';
        if (k.startsWith('staff_commute')) return 'staffCommute';
        if (k.startsWith('freight_') || k.startsWith('cargo_ship_') || k === 'rail_freight_train') {
            return 'freight';
        }
        if (k.includes('wfh')) return 'wfh';
        if (k.startsWith('materials_')) return 'materials';
        if (
            /^(flights_|flight_|business_travel|hotel_)/.test(k)
            || /^taxi_/.test(k)
            || /^bus_/.test(k)
            || /^rail_/.test(k)
        ) {
            return 'businessTravel';
        }
        if (/^(transport_petrol|transport_diesel|transport_electric|car_|van_|hgv_|motorbike_)/.test(k)) {
            return 'transport';
        }
        return 'transport';
    }

    function emissionKeyBelongsToDataCategory(emissionKey, dataCategory) {
        return dataCategoryForEmissionKey(emissionKey) === dataCategory;
    }

    function resolveUnitCategoryForDataTab(dataCategory) {
        if (TRANSPORT_SUB_CATEGORIES.includes(dataCategory) || dataCategory === 'transport') {
            return 'transport';
        }
        return dataCategory;
    }

    function migrateLegacyTransportData(site) {
        if (!site?.data) return;
        TRANSPORT_SUB_CATEGORIES.forEach((key) => {
            if (!Array.isArray(site.data[key])) site.data[key] = [];
        });
        if (site.data._transportSplitMigrated) return;

        const legacy = Array.isArray(site.data.transport) ? site.data.transport : [];
        if (legacy.length === 0) {
            site.data._transportSplitMigrated = true;
            return;
        }

        const fleet = [];
        legacy.forEach((row) => {
            const cat = dataCategoryForEmissionKey(row?.emissionType);
            if (cat === 'transport') {
                fleet.push(row);
            } else if (Array.isArray(site.data[cat])) {
                site.data[cat].push(row);
            } else {
                fleet.push(row);
            }
        });
        site.data.transport = fleet;
        site.data._transportSplitMigrated = true;
    }

    function ensureDefaultSiteData(site) {
        if (!site.data || typeof site.data !== 'object') {
            site.data = {};
        }
        DATA_INPUT_CATEGORIES.forEach((key) => {
            if (!Array.isArray(site.data[key])) site.data[key] = [];
        });
        migrateLegacyTransportData(site);
    }

    function buildTransportSubTabPanel(category) {
        const meta = TAB_META[category];
        if (!meta) return null;

        const panel = document.createElement('div');
        panel.className = 'tab-content';
        panel.dataset.content = category;
        panel.innerHTML = `
            <div class="tab-header">
                <h2 data-en="${meta.titleEn}" data-pt="${meta.titlePt}">${meta.titleEn}</h2>
                <div class="tab-actions">
                    <button class="btn-secondary" type="button" data-add-row="${category}">
                        <i class="fas fa-plus"></i>
                        <span data-en="Add new line" data-pt="Adicionar linha">Add new line</span>
                    </button>
                </div>
            </div>
            <div class="table-container">
                <table class="data-table" id="${category}Table">
                    <thead>
                        <tr>
                            <th data-en="Emission type" data-pt="Tipo de emissão">Emission type</th>
                            <th data-en="Description" data-pt="Descrição">Description</th>
                            <th data-en="Unit" data-pt="Unidade">Unit</th>
                            <th data-en="Year" data-pt="Ano">Year</th>
                            <th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th>
                            <th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th>
                            <th data-en="${meta.totalColEn}" data-pt="${meta.totalColPt}">${meta.totalColEn}</th>
                            <th class="emissions-col-header" data-en="Emissions (tCO₂e)" data-pt="Emissões (tCO₂e)">Emissions (tCO₂e)</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <div class="category-summary">
                <span data-en="${meta.summaryEn}" data-pt="${meta.summaryPt}">${meta.summaryEn}</span>
                <strong id="${category}Total">0.000 tCO₂e</strong>
            </div>
        `;

        panel.querySelector(`[data-add-row="${category}"]`)?.addEventListener('click', () => {
            if (typeof global.addDataRow === 'function') global.addDataRow(category);
        });

        return panel;
    }

    function initTransportSubTabs() {
        const host = document.getElementById('tabsContent');
        if (!host) return;

        const refrigerantsPanel = host.querySelector('[data-content="refrigerants"]');
        TRANSPORT_SUB_CATEGORIES.forEach((category) => {
            if (host.querySelector(`[data-content="${category}"]`)) return;
            const panel = buildTransportSubTabPanel(category);
            if (panel && refrigerantsPanel) {
                host.insertBefore(panel, refrigerantsPanel);
            } else if (panel) {
                host.appendChild(panel);
            }
        });

        if (global.carbonCalc?.refreshEmissionsUnitLabels) {
            global.carbonCalc.refreshEmissionsUnitLabels();
        }
    }

    global.DATA_INPUT_CATEGORIES = DATA_INPUT_CATEGORIES;
    global.TRANSPORT_SUB_CATEGORIES = TRANSPORT_SUB_CATEGORIES;
    global.DATA_TAB_META = TAB_META;
    global.dataCategoryForEmissionKey = dataCategoryForEmissionKey;
    global.emissionKeyBelongsToDataCategory = emissionKeyBelongsToDataCategory;
    global.resolveUnitCategoryForDataTab = resolveUnitCategoryForDataTab;
    global.migrateLegacyTransportData = migrateLegacyTransportData;
    global.ensureDefaultSiteData = ensureDefaultSiteData;
    global.initTransportSubTabs = initTransportSubTabs;
})(typeof window !== 'undefined' ? window : globalThis);
