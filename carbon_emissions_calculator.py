import streamlit as st
import plotly.express as px
import pandas as pd
from datetime import datetime

# Simple Login
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

if not st.session_state.logged_in:
    st.title("Carbon Emissions Calculator")
    st.markdown("### Login Required")
    col1, col2 = st.columns(2)
    username = col1.text_input("Username")
    password = col2.text_input("Password", type="password")
    if st.button("Login", use_container_width=True):
        if username == "admin" and password == "password":
            st.session_state.logged_in = True
            st.rerun()
        else:
            st.error("Incorrect username or password")
    st.stop()

# Main App
st.set_page_config(page_title="GHG Calculator", layout="wide")
st.title("Carbon Emissions Calculator - GHG Protocol")
st.markdown(f"**Welcome** • {datetime.now().strftime('%d %B %Y')}")

# Country selection
country = st.selectbox("Select Country", ["Saudi Arabia", "United Kingdom", "Brazil", "United States", "UAE"])

# 2025 Emission Factors (kg CO2e per unit)
factors = {
    "Saudi Arabia": {"Electricity (kWh)": 0.65, "Gasoline (L)": 2.31, "Diesel (L)": 2.68, "Natural Gas (m³)": 1.98, "Flights short": 250, "Flights long": 600, "Waste (tonnes)": 480, "Water (m³)": 1.10},
    "United Kingdom": {"Electricity (kWh)": 0.177, "Gasoline (L)": 2.30, "Diesel (L)": 2.69, "Natural Gas (m³)": 1.83, "Flights short": 250, "Flights long": 600, "Waste (tonnes)": 450, "Water (m³)": 0.344},
    "Brazil": {"Electricity (kWh)": 0.233, "Gasoline (L)": 2.31, "Diesel (L)": 2.68, "Natural Gas (m³)": 1.98, "Flights short": 250, "Flights long": 600, "Waste (tonnes)": 462, "Water (m³)": 0.421},
    "United States": {"Electricity (kWh)": 0.385, "Gasoline (L)": 2.31, "Diesel (L)": 2.68, "Natural Gas (m³)": 1.86, "Flights short": 250, "Flights long": 600, "Waste (tonnes)": 470, "Water (m³)": 0.71},
    "UAE": {"Electricity (kWh)": 0.58, "Gasoline (L)": 2.31, "Diesel (L)": 2.68, "Natural Gas (m³)": 1.90, "Flights short": 250, "Flights long": 600, "Waste (tonnes)": 490, "Water (m³)": 1.40}
}

f = factors[country]

st.subheader("Scope 1 - Direct Emissions")
c1, c2, c3 = st.columns(3)
gasoline = c1.number_input("Gasoline (liters)", 0.0, step=100.0)
diesel = c2.number_input("Diesel (liters)", 0.0, step=100.0)
natural_gas = c3.number_input("Natural Gas (m³)", 0.0, step=10.0)

st.subheader("Scope 2 - Electricity")
electricity = st.number_input("Electricity (kWh)", 0.0, step=1000.0)

st.subheader("Scope 3 - Other Indirect")
c1, c2, c3, c4 = st.columns(4)
short_flights = c1.number_input("Short flights (<3h)", 0, step=1)
long_flights = c2.number_input("Long flights (>3h)", 0, step=1)
waste = c3.number_input("Waste (tonnes)", 0.0, step=0.5)
water = c4.number_input("Water (m³)", 0.0, step=10.0)

# Calculations
emissions = {
    "Gasoline": gasoline * f["Gasoline (L)"],
    "Diesel": diesel * f["Diesel (L)"],
    "Natural Gas": natural_gas * f["Natural Gas (m³)"],
    "Electricity": electricity * f["Electricity (kWh)"],
    "Short Flights": short_flights * f["Flights short"],
    "Long Flights": long_flights * f["Flights long"],
    "Waste": waste * f["Waste (tonnes)"],
    "Water": water * f["Water (m³)"]
}

scope1 = emissions["Gasoline"] + emissions["Diesel"] + emissions["Natural Gas"]
scope2 = emissions["Electricity"]
scope3 = sum(emissions.values()) - scope1 - scope2
total = scope1 + scope2 + scope3

# Results
st.markdown("## Emissions Summary")
col1, col2, col3, col4 = st.columns(4)
col1.metric("Scope 1", f"{scope1:,.0f} kg CO₂e")
col2.metric("Scope 2", f"{scope2:,.0f} kg CO₂e")
col3.metric("Scope 3", f"{scope3:,.0f} kg CO₂e")
col4.metric("TOTAL", f"{total:,.0f} kg CO₂e", delta=f"{total/1000:,.1f} tonnes")

# Chart
fig = px.pie(names=emissions.keys(), values=emissions.values(), title="Emissions Breakdown")
st.plotly_chart(fig, use_container_width=True)

# Export Report
df = pd.DataFrame({
    "Country": [country] * len(emissions),
    "Category": emissions.keys(),
    "kg CO2e": emissions.values()
})

st.download_button(
    "Download GRI/ESG Report (CSV)",
    data=df.to_csv(index=False).encode(),
    file_name=f"GHG_Report_{country}_{datetime.now().strftime('%Y%m%d')}.csv",
    mime="text/csv"
)

st.success("Calculator ready for submission - GRI, CDP, SBTi, etc.")
st.balloons()