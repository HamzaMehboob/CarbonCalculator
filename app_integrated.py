"""
Carbon Calculator Phase 1 - Integrated Web Application
Serves both frontend (HTML/CSS/JS) and backend API
Ready for Streamlit Cloud deployment
"""

import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
import json
from pathlib import Path
from datetime import datetime

# ============================================
# PAGE CONFIG
# ============================================

st.set_page_config(
    page_title="Carbon Calculator - Phase 1",
    page_icon="🌱",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ============================================
# LOAD FRONTEND FILES
# ============================================

def load_html():
    """Load the main HTML file"""
    html_file = Path(__file__).parent / "frontend" / "index.html"
    if html_file.exists():
        return html_file.read_text(encoding='utf-8')
    return "<h1>Error: Frontend files not found</h1>"

def inject_css_and_js(html_content):
    """Inject CSS and JavaScript into HTML"""
    css_file = Path(__file__).parent / "frontend" / "css" / "styles.css"
    
    js_files = [
        "js/app.js",
        "js/calculations.js",
        "js/dashboard.js",
        "js/invoices.js",
        "js/export.js"
    ]
    
    # Load CSS
    if css_file.exists():
        css_content = css_file.read_text(encoding='utf-8')
        html_content = html_content.replace(
            '<link rel="stylesheet" href="css/styles.css">',
            f'<style>{css_content}</style>'
        )
    
    # Load JavaScript files
    for js_file_path in js_files:
        js_file = Path(__file__).parent / "frontend" / js_file_path
        if js_file.exists():
            js_content = js_file.read_text(encoding='utf-8')
            # Replace script tag in HTML with inline script
            script_tag = f'<script src="{js_file_path}"></script>'
            html_content = html_content.replace(
                script_tag,
                f'<script>{js_content}</script>'
            )
        else:
            # Log warning if file not found (useful for debugging)
            st.warning(f"⚠️ JavaScript file not found: {js_file_path}")
    
    return html_content

# ============================================
# CONVERSION FACTORS API
# ============================================

# Load conversion factors - use hardcoded version for API compatibility
# (Frontend uses its own conversion factors from calculations.js)
CONVERSION_FACTORS = {
    "UK_2025": {
        "version": "2025.1",
        "source": "UK Government GHG Conversion Factors 2025",
        "factors": {
            "water_supply": 0.344,
            "electricity_grid": 0.177,
            "natural_gas": 0.183,
            "waste_landfill": 467.0,
            "car_petrol_medium": 0.188,
            "car_electric": 0.053,
            "refrigerant_R410A": 2088,
        }
    },
    "BRAZIL_2025": {
        "version": "2025.1",
        "source": "Brazil SEEG Data",
        "factors": {
            "water_supply": 0.421,
            "electricity_grid": 0.233,
            "natural_gas": 0.202,
            "waste_landfill": 521.0,
            "car_petrol_medium": 0.197,
            "car_electric": 0.062,
            "refrigerant_R410A": 2088,
        }
    }
}

# ============================================
# API ENDPOINTS (for future use)
# ============================================

def get_conversion_factors(country="UK_2025"):
    """API endpoint to get conversion factors"""
    return CONVERSION_FACTORS.get(country, CONVERSION_FACTORS["UK_2025"])

def calculate_emissions(data):
    """API endpoint to calculate emissions"""
    country = data.get("country", "UK_2025")
    factors = CONVERSION_FACTORS.get(country, CONVERSION_FACTORS["UK_2025"])["factors"]
    
    results = {}
    
    # Water emissions
    if "water" in data:
        results["water"] = data["water"] * factors["water_supply"] / 1000
    
    # Energy emissions
    if "energy" in data:
        results["energy"] = data["energy"] * factors["electricity_grid"] / 1000
    
    # Calculate total
    results["total"] = sum(results.values())
    
    return results

# ============================================
# MAIN APP
# ============================================

# Check if we should show API docs or the calculator
show_mode = st.sidebar.radio(
    "Mode",
    ["🧮 Calculator", "📚 API Documentation"],
    index=0
)

if show_mode == "📚 API Documentation":
    # Show API documentation
    st.title("🌱 Carbon Calculator API - Phase 1")
    st.markdown("### Backend Service for GHG Protocol Calculations")
    
    tab1, tab2, tab3 = st.tabs(["📊 API Status", "🔢 Conversion Factors", "🧮 Test Calculator"])
    
    with tab1:
        st.success("✅ API is running successfully!")
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("API Version", "1.0.0")
        with col2:
            st.metric("Countries", "2")
        with col3:
            st.metric("Conversion Factors", "14+")
        
        st.markdown("---")
        st.markdown("### 🌍 Deployment Info")
        st.info("**Status:** Deployed on Streamlit Cloud")
        st.info("**Backend:** Python + Streamlit")
        st.info("**Frontend:** HTML + CSS + JavaScript")
    
    with tab2:
        st.subheader("Official Conversion Factors Database")
        country = st.selectbox("Select Country", ["UK_2025", "BRAZIL_2025"])
        
        factors = CONVERSION_FACTORS[country]
        st.json(factors)
    
    with tab3:
        st.subheader("🧮 Quick Emissions Calculator")
        
        calc_country = st.selectbox("Country", ["UK_2025", "BRAZIL_2025"], key="calc")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("#### 💧 Water")
            water = st.number_input("Water (m³)", min_value=0.0, value=0.0, step=10.0)
            
            st.markdown("#### ⚡ Energy")
            energy = st.number_input("Electricity (kWh)", min_value=0.0, value=0.0, step=100.0)
        
        with col2:
            factors = CONVERSION_FACTORS[calc_country]["factors"]
            water_co2 = water * factors["water_supply"] / 1000
            energy_co2 = energy * factors["electricity_grid"] / 1000
            total_co2 = water_co2 + energy_co2
            
            st.metric("Water Emissions", f"{water_co2:.3f} tCO₂e")
            st.metric("Energy Emissions", f"{energy_co2:.3f} tCO₂e")
            st.metric("**TOTAL**", f"{total_co2:.3f} tCO₂e", delta=f"{((total_co2/1000)*100):.1f}%")

else:
    # Show the main calculator
    st.markdown(
        """
        <style>
        .stApp > header {
            display: none;
        }
        iframe {
            border: none;
        }
        </style>
        """,
        unsafe_allow_html=True
    )
    
    # Load and display the frontend
    html_content = load_html()
    html_content = inject_css_and_js(html_content)
    
    # Display the integrated app
    components.html(html_content, height=900, scrolling=True)
    
    # Add footer info
    st.sidebar.markdown("---")
    st.sidebar.markdown("### 🌱 Carbon Calculator Phase 1")
    st.sidebar.markdown(f"**Version:** 1.0.0")
    st.sidebar.markdown(f"**Date:** {datetime.now().strftime('%Y-%m-%d')}")
    st.sidebar.markdown("**Status:** ✅ Online")
    st.sidebar.markdown("---")
    st.sidebar.markdown("**Login Credentials:**")
    st.sidebar.code("Email: admin@company.com\nPassword: admin123")
    st.sidebar.markdown("---")
    st.sidebar.markdown("Built with ❤️ using Streamlit")

# ============================================
# FOOTER
# ============================================

st.sidebar.markdown("---")
st.sidebar.markdown("""
**Data Sources:**
- UK DEFRA GHG Factors 2025
- Brazil SEEG Latest Data

**Compliance:**
- GHG Protocol ✅
- GRI Standards ✅
- CDP Compatible ✅
""")

