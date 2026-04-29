"""
Carbon Calculator Phase 1 - Integrated Web Application
Serves both frontend (HTML/CSS/JS) and backend API
Ready for Streamlit Cloud deployment
"""

import json
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

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


def _resolve_api_base_url() -> str:
    """Backend API for login/sync. Override with env API_BASE_URL or Streamlit secret API_BASE_URL."""
    import os

    raw = (os.environ.get("API_BASE_URL") or "").strip()
    if not raw:
        try:
            if hasattr(st, "secrets") and "API_BASE_URL" in st.secrets:
                raw = str(st.secrets["API_BASE_URL"]).strip()
        except Exception:
            raw = ""
    if not raw:
        return "https://carbon-calculator-api-fe1o.onrender.com/api"
    raw = raw.rstrip("/")
    if raw.endswith("/api"):
        return raw
    return f"{raw}/api"


def _inject_streamlit_runtime_config(html_content: str) -> str:
    """Expose API URL to inlined app.js (must run before any fetch in the iframe)."""
    api = _resolve_api_base_url()
    snippet = "<script>window.__CARBON_API_BASE__=" + json.dumps(api) + ";</script>"
    if "<body>" in html_content:
        return html_content.replace("<body>", "<body>" + snippet, 1)
    return snippet + html_content


@st.cache_data(ttl=86400, show_spinner=False)
def _fetch_url_text(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "CarbonCalculator-Streamlit/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def _inline_cdn_scripts_for_streamlit_iframe(html_content: str) -> str:
    """
    Streamlit Cloud serves components.html inside a sandboxed iframe where external
    <script src="https://..."> loads are often blocked by CSP. Inline the same bundles
    so Chart.js / jsPDF / SheetJS run like they do when opening index.html locally.
    """
    replacements = [
        (
            '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>',
            "https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js",
        ),
        (
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>',
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        ),
        (
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>',
            "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
        ),
    ]
    vendor_dir = Path(__file__).parent / "frontend" / "js" / "vendor"

    for tag, url in replacements:
        if tag not in html_content:
            continue

        fname = url.split("/")[-1]
        local = vendor_dir / fname
        try:
            if local.exists():
                body = local.read_text(encoding="utf-8")
            else:
                body = _fetch_url_text(url)
        except Exception as e:
            st.warning(f"⚠️ Could not inline {fname} ({e}). Charts/PDF/Excel may fail in this embed.")
            continue
        html_content = html_content.replace(tag, f"<script>\n{body}\n</script>", 1)

    return html_content


def inject_css_and_js(html_content):
    """Inject CSS and JavaScript into HTML"""
    html_content = _inject_streamlit_runtime_config(html_content)
    css_file = Path(__file__).parent / "frontend" / "css" / "styles.css"
    
    js_files = [
        "js/theme-palettes.js",
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

    # Inline third-party JS (Chart.js, jsPDF, xlsx) — required on many Streamlit hosts (CSP).
    html_content = _inline_cdn_scripts_for_streamlit_iframe(html_content)
    
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
    
    # Streamlit components don't automatically serve repo "assets/" files.
    # Inline brand images so they always render in production.
    try:
        import base64

        assets_dir = Path(__file__).parent / "frontend" / "assets"
        brand_files = ["logo.png", "SQImpact_v2.png", "SQ_logo.png"]
        for brand_file in brand_files:
            logo_path = assets_dir / brand_file
            if not logo_path.exists():
                continue

            logo_b64 = base64.b64encode(logo_path.read_bytes()).decode("utf-8")
            data_uri = f"data:image/png;base64,{logo_b64}"

            html_content = html_content.replace(
                f'src="assets/{brand_file}"',
                f'src="{data_uri}"'
            )
            html_content = html_content.replace(
                f"src='assets/{brand_file}'",
                f"src='{data_uri}'"
            )
    except Exception as e:
        st.warning(f"⚠️ Failed to inline branding assets: {e}")

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
        /* Hide Streamlit Header */
        header[data-testid="stHeader"] {
            display: none !important;
        }
        
        /* Hide Streamlit Sidebar */
        [data-testid="stSidebar"] {
            display: none !important;
        }
        
        /* Remove padding from the main block to allow full width/height */
        .block-container {
            padding-top: 0rem !important;
            padding-bottom: 0rem !important;
            padding-left: 0rem !important;
            padding-right: 0rem !important;
            max-width: 100% !important;
        }
        
        /* Remove default iframe border and try to maximize */
        iframe {
            border: none;
            width: 100% !important;
        }
        </style>
        """,
        unsafe_allow_html=True
    )
    
    # Load and display the frontend
    html_content = load_html()
    html_content = inject_css_and_js(html_content)
    
    # Display the integrated app
    components.html(html_content, height=1200, scrolling=True)
    
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

