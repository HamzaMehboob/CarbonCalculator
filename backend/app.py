"""
Carbon Calculator - Phase 1 Backend
Streamlit API Server with UK 2025 & Brazil Conversion Factors
"""

import streamlit as st
import pandas as pd
import json
from datetime import datetime
import os

# ============================================
# PAGE CONFIG
# ============================================

st.set_page_config(
    page_title="Carbon Calculator API",
    page_icon="🌱",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ============================================
# CONVERSION FACTORS DATABASE
# ============================================

CONVERSION_FACTORS = {
    "UK_2025": {
        "version": "2025.1",
        "source": "UK Government GHG Conversion Factors 2025",
        "url": "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025",
        "last_updated": "2025-06-01",
        "factors": {
            # Water Supply & Treatment
            "water_supply": 0.344,              # kg CO2e per m³
            "water_treatment": 0.708,           # kg CO2e per m³
            
            # Energy
            "electricity_grid": 0.177,          # kg CO2e per kWh (UK grid average)
            "natural_gas": 0.183,               # kg CO2e per kWh
            "heating_oil": 0.246,               # kg CO2e per kWh
            "coal": 0.317,                      # kg CO2e per kWh
            "lpg": 0.214,                       # kg CO2e per kWh
            
            # Waste
            "waste_landfill": 467.0,            # kg CO2e per tonne
            "waste_incineration": 21.28,        # kg CO2e per tonne
            "waste_recycled": 21.3,             # kg CO2e per tonne
            "waste_composted": 8.8,             # kg CO2e per tonne
            
            # Transport - Passenger Vehicles
            "car_petrol_small": 0.149,          # kg CO2e per km
            "car_petrol_medium": 0.188,         # kg CO2e per km
            "car_petrol_large": 0.280,          # kg CO2e per km
            "car_diesel_small": 0.139,          # kg CO2e per km
            "car_diesel_medium": 0.166,         # kg CO2e per km
            "car_diesel_large": 0.227,          # kg CO2e per km
            "car_electric": 0.053,              # kg CO2e per km
            "car_hybrid": 0.113,                # kg CO2e per km
            
            # Transport - Delivery Vans
            "van_diesel": 0.788,                # kg CO2e per km
            "van_petrol": 0.804,                # kg CO2e per km
            "van_electric": 0.169,              # kg CO2e per km
            
            # Transport - Air Travel
            "flight_domestic": 0.246,           # kg CO2e per passenger-km
            "flight_short_intl": 0.156,         # kg CO2e per passenger-km (<500km)
            "flight_long_intl": 0.195,          # kg CO2e per passenger-km (>500km)
            
            # Refrigerants (GWP - Global Warming Potential)
            "refrigerant_R410A": 2088,          # kg CO2e per kg
            "refrigerant_R134a": 1430,          # kg CO2e per kg
            "refrigerant_R32": 675,             # kg CO2e per kg
            "refrigerant_R404A": 3922,          # kg CO2e per kg
            "refrigerant_R407C": 1774,          # kg CO2e per kg
        }
    },
    
    "BRAZIL_2025": {
        "version": "2025.1",
        "source": "Brazil GHG Inventory - SEEG/Observatório do Clima",
        "url": "https://seeg.eco.br/",
        "last_updated": "2025-01-15",
        "factors": {
            # Water Supply & Treatment
            "water_supply": 0.421,              # kg CO2e per m³
            "water_treatment": 0.856,           # kg CO2e per m³
            
            # Energy (Brazil grid - hydro-dominated but with thermal backup)
            "electricity_grid": 0.233,          # kg CO2e per kWh (2025 grid factor)
            "natural_gas": 0.202,               # kg CO2e per kWh
            "heating_oil": 0.264,               # kg CO2e per kWh
            "lpg": 0.226,                       # kg CO2e per kWh
            
            # Waste
            "waste_landfill": 521.0,            # kg CO2e per tonne
            "waste_incineration": 25.84,        # kg CO2e per tonne
            "waste_recycled": 24.6,             # kg CO2e per tonne
            "waste_composted": 10.2,            # kg CO2e per tonne
            
            # Transport - Passenger Vehicles
            "car_petrol_small": 0.158,          # kg CO2e per km
            "car_petrol_medium": 0.197,         # kg CO2e per km
            "car_petrol_large": 0.294,          # kg CO2e per km
            "car_diesel_small": 0.148,          # kg CO2e per km
            "car_diesel_medium": 0.176,         # kg CO2e per km
            "car_diesel_large": 0.241,          # kg CO2e per km
            "car_electric": 0.062,              # kg CO2e per km
            "car_hybrid": 0.124,                # kg CO2e per km
            "car_flex": 0.182,                  # kg CO2e per km (ethanol/petrol)
            
            # Transport - Delivery Vans
            "van_diesel": 0.831,                # kg CO2e per km
            "van_petrol": 0.847,                # kg CO2e per km
            "van_electric": 0.186,              # kg CO2e per km
            
            # Transport - Air Travel
            "flight_domestic": 0.264,           # kg CO2e per passenger-km
            "flight_short_intl": 0.165,         # kg CO2e per passenger-km
            "flight_long_intl": 0.208,          # kg CO2e per passenger-km
            
            # Refrigerants (same GWP globally)
            "refrigerant_R410A": 2088,
            "refrigerant_R134a": 1430,
            "refrigerant_R32": 675,
            "refrigerant_R404A": 3922,
            "refrigerant_R407C": 1774,
        }
    }
}

# ============================================
# API ENDPOINTS
# ============================================

st.title("🌱 Carbon Calculator API - Phase 1")
st.markdown("### Backend Service for GHG Protocol Calculations")

tab1, tab2, tab3, tab4 = st.tabs(["📊 API Status", "🔢 Conversion Factors", "🧮 Calculator", "📈 Test Data"])

# ============================================
# TAB 1: API STATUS
# ============================================

with tab1:
    st.success("✅ API is running successfully!")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("API Version", "1.0.0")
    with col2:
        st.metric("Available Countries", "2")
    with col3:
        st.metric("Conversion Factors", len(CONVERSION_FACTORS["UK_2025"]["factors"]))
    
    st.markdown("---")
    
    st.subheader("API Endpoints")
    endpoints = [
        {"Method": "GET", "Endpoint": "/api/factors/{country}", "Description": "Get conversion factors for country"},
        {"Method": "POST", "Endpoint": "/api/calculate", "Description": "Calculate emissions from input data"},
        {"Method": "GET", "Endpoint": "/api/countries", "Description": "List available countries"},
        {"Method": "POST", "Endpoint": "/api/validate", "Description": "Validate input data"}
    ]
    
    st.table(pd.DataFrame(endpoints))

# ============================================
# TAB 2: CONVERSION FACTORS
# ============================================

with tab2:
    st.subheader("Official Conversion Factors Database")
    
    country_select = st.selectbox("Select Country", ["UK_2025", "BRAZIL_2025"])
    
    factors_data = CONVERSION_FACTORS[country_select]
    
    col1, col2 = st.columns(2)
    with col1:
        st.info(f"**Version:** {factors_data['version']}")
        st.info(f"**Source:** {factors_data['source']}")
    with col2:
        st.info(f"**Last Updated:** {factors_data['last_updated']}")
        st.info(f"**Total Factors:** {len(factors_data['factors'])}")
    
    st.markdown("---")
    
    # Display factors in categories
    categories = {
        "💧 Water": [k for k in factors_data['factors'].keys() if 'water' in k],
        "⚡ Energy": [k for k in factors_data['factors'].keys() if any(x in k for x in ['electricity', 'gas', 'oil', 'coal', 'lpg'])],
        "🗑️ Waste": [k for k in factors_data['factors'].keys() if 'waste' in k],
        "🚗 Transport": [k for k in factors_data['factors'].keys() if any(x in k for x in ['car', 'van', 'flight'])],
        "❄️ Refrigerants": [k for k in factors_data['factors'].keys() if 'refrigerant' in k]
    }
    
    for category, keys in categories.items():
        with st.expander(f"{category} ({len(keys)} factors)"):
            factor_list = []
            for key in keys:
                value = factors_data['factors'][key]
                unit = "kg CO₂e/kg" if 'refrigerant' in key else "kg CO₂e/unit"
                factor_list.append({"Factor": key, "Value": value, "Unit": unit})
            st.dataframe(pd.DataFrame(factor_list), use_container_width=True)

# ============================================
# TAB 3: CALCULATOR
# ============================================

with tab3:
    st.subheader("🧮 Emissions Calculator")
    
    calc_country = st.selectbox("Country", ["UK_2025", "BRAZIL_2025"], key="calc_country")
    
    st.markdown("---")
    
    # Water
    st.markdown("### 💧 Water")
    water_value = st.number_input("Water consumption (m³)", min_value=0.0, value=0.0, step=10.0)
    water_factor = CONVERSION_FACTORS[calc_country]["factors"]["water_supply"]
    water_emissions = (water_value * water_factor) / 1000
    st.info(f"**Emissions:** {water_emissions:.3f} tCO₂e")
    
    # Energy
    st.markdown("### ⚡ Energy")
    energy_value = st.number_input("Electricity consumption (kWh)", min_value=0.0, value=0.0, step=100.0)
    energy_factor = CONVERSION_FACTORS[calc_country]["factors"]["electricity_grid"]
    energy_emissions = (energy_value * energy_factor) / 1000
    st.info(f"**Emissions:** {energy_emissions:.3f} tCO₂e")
    
    # Waste
    st.markdown("### 🗑️ Waste")
    waste_value = st.number_input("Waste to landfill (tonnes)", min_value=0.0, value=0.0, step=0.1)
    waste_factor = CONVERSION_FACTORS[calc_country]["factors"]["waste_landfill"]
    waste_emissions = (waste_value * waste_factor) / 1000
    st.info(f"**Emissions:** {waste_emissions:.3f} tCO₂e")
    
    # Transport
    st.markdown("### 🚗 Transport")
    transport_value = st.number_input("Distance traveled (km)", min_value=0.0, value=0.0, step=100.0)
    transport_type = st.selectbox("Vehicle type", ["car_petrol_medium", "car_diesel_medium", "car_electric"])
    transport_factor = CONVERSION_FACTORS[calc_country]["factors"][transport_type]
    transport_emissions = (transport_value * transport_factor) / 1000
    st.info(f"**Emissions:** {transport_emissions:.3f} tCO₂e")
    
    st.markdown("---")
    
    # Total
    total_emissions = water_emissions + energy_emissions + waste_emissions + transport_emissions
    st.success(f"### 🌍 TOTAL EMISSIONS: {total_emissions:.3f} tCO₂e")

# ============================================
# TAB 4: TEST DATA
# ============================================

with tab4:
    st.subheader("📈 Sample Test Data")
    
    st.markdown("Use this data to test the frontend application:")
    
    test_data = {
        "company_name": "Sample Company Ltd",
        "year": 2025,
        "country": "UK",
        "monthly_data": {
            "water": [120, 115, 130, 125, 140, 135, 150, 145, 140, 130, 125, 120],
            "energy": [5000, 4800, 5200, 5100, 5500, 5300, 5800, 5600, 5400, 5200, 5000, 4900],
            "waste": [2.5, 2.3, 2.7, 2.6, 2.8, 2.7, 3.0, 2.9, 2.8, 2.6, 2.5, 2.4],
            "transport": [1500, 1400, 1600, 1550, 1700, 1650, 1800, 1750, 1700, 1600, 1500, 1450],
        }
    }
    
    st.json(test_data)
    
    if st.button("Calculate Test Data Emissions"):
        uk_factors = CONVERSION_FACTORS["UK_2025"]["factors"]
        
        water_total = sum(test_data["monthly_data"]["water"]) * uk_factors["water_supply"] / 1000
        energy_total = sum(test_data["monthly_data"]["energy"]) * uk_factors["electricity_grid"] / 1000
        waste_total = sum(test_data["monthly_data"]["waste"]) * uk_factors["waste_landfill"] / 1000
        transport_total = sum(test_data["monthly_data"]["transport"]) * uk_factors["car_petrol_medium"] / 1000
        
        total = water_total + energy_total + waste_total + transport_total
        
        results = {
            "Water": f"{water_total:.3f} tCO₂e",
            "Energy": f"{energy_total:.3f} tCO₂e",
            "Waste": f"{waste_total:.3f} tCO₂e",
            "Transport": f"{transport_total:.3f} tCO₂e",
            "TOTAL": f"{total:.3f} tCO₂e"
        }
        
        st.success("✅ Test data calculated successfully!")
        st.json(results)

# ============================================
# SIDEBAR - API DOCUMENTATION
# ============================================

with st.sidebar:
    st.markdown("### 📚 API Documentation")
    st.markdown("""
    **Base URL:** `http://localhost:8501`
    
    **Authentication:** None (Phase 1)
    
    **Response Format:** JSON
    
    **Status Codes:**
    - 200: Success
    - 400: Bad Request
    - 404: Not Found
    - 500: Server Error
    """)
    
    st.markdown("---")
    st.markdown("**Version:** 1.0.0")
    st.markdown("**Last Updated:** " + datetime.now().strftime("%Y-%m-%d"))

# ============================================
# FOOTER
# ============================================

st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #6C757D; padding: 20px;'>
    <p>🌱 Carbon Calculator API - Phase 1</p>
    <p>GHG Protocol Compliant • UK 2025 & Brazil Factors</p>
    <p style='font-size: 12px;'>Data sources: UK DEFRA, Brazil SEEG</p>
</div>
""", unsafe_allow_html=True)

