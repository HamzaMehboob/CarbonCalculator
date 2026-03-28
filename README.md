# 🌱 Carbon Calculator - Phase 1

**Professional GHG Protocol Carbon Emissions Calculator**  
*Xero-style Interface • Real-time Calculations • Multi-language Support*

[![Deploy to Streamlit](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io)

Signin at https://share.streamlit.io/

---

## 🌐 Deploy Online (Recommended!)

**NEW:** Deploy your calculator online in 5 minutes!

### Quick Deploy to Streamlit Cloud:

1. **Push to GitHub:**
   ```bash
   # Windows: Double-click deploy_to_github.bat
   # Mac/Linux: chmod +x deploy_to_github.sh && ./deploy_to_github.sh
   ```

2. **Deploy on Streamlit:**
   - Go to https://share.streamlit.io
   - Connect your GitHub repository
   - Select `app_integrated.py` as main file
   - Click "Deploy"

3. **Done!** Your calculator is now online and accessible worldwide!

📖 **Full deployment guide:** See `DEPLOYMENT_GUIDE.md`

### 🔒 Secure Backend (Render.com):
To fix MongoDB credential leaks and ensure a secure production environment:
1.  **Backend:** Deployed on [Render.com](https://render.com) using the code in the `/backend` folder.
2.  **Security:** Credentials (MONGODB_URI) are stored as Environment Variables on Render, not in the code.
3.  **Setup:** Follow the `render_setup_guide.md` (in artifacts) to configure your own Render service.


---

## 📋 Overview

Phase 1 Carbon Calculator is a comprehensive web-based application for tracking and calculating carbon emissions according to the **GHG Protocol**. It features a modern, Xero-inspired interface with monthly data entry, live dashboards, and professional reporting capabilities.

### ✨ Key Features

- ✅ **Xero-style Monthly Input Tables** - Clean, intuitive data entry
- ✅ **Multi-Building/Site Support** - Track emissions across multiple locations (each site has separate data)
- ✅ **Real-time Calculations** - Instant CO₂e calculations as you type
- ✅ **Official Conversion Factors** - UK 2025 & Brazil latest data
- ✅ **Live Dashboard** - Interactive charts, financial widgets, customizable
- ✅ **PDF & Excel Export** - One-click professional reports
- ✅ **Bilingual** - English/Portuguese language toggle
- ✅ **Dark Mode** - Eye-friendly interface option
- ✅ **User Authentication** - Simple login system
- ✅ **Auto-save** - Never lose your data
- ✅ **Company Logo Upload** - Customize with your branding
- ✅ **Financial Tracking** - Bank accounts, invoices, bills monitoring

---

## 🚀 Quick Start (Local)

### Windows

1. **Download** the Phase1_CarbonCalculator folder
2. **Double-click** `launch.bat`
3. **Wait** for automatic installation (first time only)
4. **Open** `frontend/index.html` in your browser
5. **Login** with credentials below

### macOS / Linux

1. **Download** the Phase1_CarbonCalculator folder
2. **Open Terminal** in the folder
3. **Run:** `chmod +x launch.sh && ./launch.sh`
4. **Open** `frontend/index.html` in your browser
5. **Login** with credentials below

### 🔐 Login Credentials

```
Email: admin@company.com
Password: admin123
```

---

## 📊 Features Breakdown

### 1️⃣ Monthly Input Tables

Track emissions across 5 categories with 12-month views:

- 💧 **Water** - Consumption tracking with automatic CO₂e calculations
- ⚡ **Energy** - Electricity and other energy sources
- 🗑️ **Waste** - Waste disposal by type
- 🚗 **Transport** - Vehicle and travel emissions
- ❄️ **Refrigerants** - Refrigerant gas leakage tracking

**Each table includes:**
- Description field for custom labels
- Year selection (2020-2030)
- 12 monthly input columns
- Automatic total calculation
- Live tCO₂e conversion

### 2️⃣ Live Dashboard

Interactive visualizations updated in real-time:

- **Pie Chart** - Emissions breakdown by category
- **Bar Chart** - Year-over-year comparison (2024 vs 2025)
- **Line Chart** - Monthly emissions trend
- **KPI Cards** - Key metrics at a glance

### 3️⃣ Export Options

Professional reporting with one click:

**PDF Export:**
- Company header with logo
- Executive summary
- Category breakdown with charts
- Year-over-year analysis
- GHG Protocol scope classification

**Excel Export:**
- Summary sheet with totals
- Individual sheets per category
- Monthly breakdown
- Year comparison
- Formatted and ready for analysis

### 4️⃣ Multi-Site Management

Track emissions for multiple buildings/events:

- Add unlimited sites from sidebar
- Switch between sites instantly
- Independent data per site
- Delete sites with confirmation

### 5️⃣ Language Toggle

Full bilingual support:

- 🇬🇧 **English** - Default
- 🇧🇷 **Portuguese** - Toggle anytime
- All UI elements translated
- Saves preference

### 6️⃣ Dark Mode

Eye-friendly interface:

- Toggle dark/light themes
- Smooth transitions
- Preserves preference
- Professional appearance

---

## 🔢 Conversion Factors

### UK 2025 (Official DEFRA Data)

Based on UK Government GHG Conversion Factors 2025:

| Category | Factor | Unit |
|----------|--------|------|
| Water Supply | 0.344 | kg CO₂e/m³ |
| Electricity (Grid) | 0.177 | kg CO₂e/kWh |
| Natural Gas | 0.183 | kg CO₂e/kWh |
| Waste (Landfill) | 467.0 | kg CO₂e/tonne |
| Car (Petrol, Medium) | 0.188 | kg CO₂e/km |
| Car (Electric) | 0.053 | kg CO₂e/km |
| Flight (Short) | 0.156 | kg CO₂e/passenger-km |
| R-410A Refrigerant | 2088 | kg CO₂e/kg |

### Brazil 2025 (Latest Available)

Based on SEEG (Sistema de Estimativas de Emissões de Gases de Efeito Estufa):

| Category | Factor | Unit |
|----------|--------|------|
| Water Supply | 0.421 | kg CO₂e/m³ |
| Electricity (Grid) | 0.233 | kg CO₂e/kWh |
| Natural Gas | 0.202 | kg CO₂e/kWh |
| Waste (Landfill) | 521.0 | kg CO₂e/tonne |
| Car (Petrol, Medium) | 0.197 | kg CO₂e/km |
| Car (Flex Fuel) | 0.182 | kg CO₂e/km |

**Source Links:**
- UK: https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025
- Brazil: https://seeg.eco.br/

---

## 📁 Project Structure

```
Phase1_CarbonCalculator/
│
├── frontend/               # Client-side application
│   ├── index.html         # Main HTML file
│   ├── css/
│   │   └── styles.css     # Complete styling with dark mode
│   ├── js/
│   │   ├── app.js         # Main application logic
│   │   ├── calculations.js # Emissions calculations engine
│   │   ├── dashboard.js   # Chart.js dashboard
│   │   └── export.js      # PDF/Excel export functions
│   └── assets/            # Images and resources
│
├── backend/               # Streamlit API server
│   ├── app.py            # Backend API
│   ├── requirements.txt  # Python dependencies
│   └── data/             # Data storage
│
├── launch.bat            # Windows launcher
├── launch.sh             # macOS/Linux launcher
└── README.md             # This file
```

---

## 💻 Technical Stack

### Frontend
- **HTML5** - Semantic structure
- **CSS3** - Modern styling with CSS variables
- **JavaScript (ES6+)** - Application logic
- **Chart.js** - Interactive charts
- **jsPDF** - PDF generation
- **SheetJS (xlsx)** - Excel export
- **Font Awesome** - Icons
- **LocalStorage** - Data persistence

### Backend
- **Python 3.11+** - Backend language
- **Streamlit** - API framework
- **Pandas** - Data processing
- **OpenPyXL** - Excel operations

---

## 🎨 Screenshots

### Login Screen
Clean, professional authentication with language toggle.

### Main Interface
Xero-style layout with sidebar navigation and tabbed content.

### Monthly Table View
12-month data entry with automatic calculations.

### Live Dashboard
Real-time charts showing emissions breakdown and trends.

### Export Reports
Professional PDF and Excel reports ready for stakeholders.

---

## 📖 User Guide

### Getting Started

1. **Launch the application** using the appropriate launcher
2. **Login** with provided credentials
3. **Enter company name** in the header field
4. **Add notes** if needed (optional)

### Adding Data

1. **Select a category tab** (Water, Energy, etc.)
2. **Click "Add new line"** to add rows
3. **Enter description** (e.g., "Main Office Water")
4. **Select year** (2024 or 2025)
5. **Enter monthly values** in the columns
6. **Watch totals calculate automatically**

### Managing Sites

1. **Click "+"** button in left sidebar
2. **Enter building/event name**
3. **Switch between sites** by clicking names
4. **Delete sites** using the X button (except last one)

### Viewing Dashboard

1. **Click "Dashboard" tab**
2. **Review KPI cards** at top
3. **Analyze charts** for insights
4. **Export reports** using buttons

### Exporting Reports

**PDF:**
- Click "Export to PDF" on dashboard
- File downloads automatically
- Includes all data and charts

**Excel:**
- Click "Export to Excel" on dashboard
- File downloads with multiple sheets
- Ready for further analysis

### Changing Language

- Click **globe icon** in header
- Toggle between EN/PT
- All text updates instantly

### Enabling Dark Mode

- Click **moon icon** in header
- Interface switches to dark theme
- Preference saved automatically

---

## 🔄 Data Management

### Auto-save
- Data saves automatically every 30 seconds
- Also saves when switching sites
- And when closing browser

### Local Storage
- All data stored in browser
- No server uploads (Phase 1)
- Export regularly for backup

### Data Persistence
- Company name saved
- Language preference saved
- Dark mode preference saved
- All site data saved
- All monthly entries saved

---

## 🌍 GHG Protocol Compliance

This calculator follows the **GHG Protocol** standard:

### Scope Classification

**Scope 1 (Direct Emissions):**
- Refrigerants
- Company-owned vehicles (if applicable)

**Scope 2 (Indirect - Energy):**
- Purchased electricity
- Purchased heat/steam

**Scope 3 (Other Indirect):**
- Water supply and treatment
- Waste disposal
- Business travel
- Employee commuting

### Reporting Standards

Compatible with:
- ✅ GHG Protocol
- ✅ GRI (Global Reporting Initiative)
- ✅ CDP (Carbon Disclosure Project)
- ✅ SBTi (Science Based Targets initiative)

---

## 🔧 Troubleshooting

### Backend won't start

**Problem:** Streamlit fails to launch

**Solution:**
1. Ensure Python 3.11+ is installed
2. Run: `python --version`
3. Delete `venv` folder
4. Run launcher again

### Frontend not connecting

**Problem:** Can't access backend data

**Solution:**
1. Check backend is running (http://localhost:8501)
2. Look for errors in browser console (F12)
3. Clear browser cache

### Data not saving

**Problem:** Entries disappear on refresh

**Solution:**
1. Check browser LocalStorage is enabled
2. Don't use incognito/private mode
3. Check browser console for errors

### Export not working

**Problem:** PDF/Excel buttons don't download

**Solution:**
1. Check popup blocker settings
2. Allow downloads from localhost
3. Try different browser

---

## 🚀 Future Phases

### Phase 2 (Planned)
- ☐ Cloud storage with database
- ☐ Real user authentication
- ☐ Team collaboration features
- ☐ Advanced analytics
- ☐ Custom conversion factors
- ☐ Mobile responsive improvements

### Phase 3 (Planned)
- ☐ API integrations (Xero, SAP, Oracle)
- ☐ Automated data import
- ☐ Advanced GRI reporting
- ☐ Carbon offset recommendations
- ☐ Reduction target tracking
- ☐ Multi-company management

---

## 📞 Support

For questions or issues:

1. Check this README thoroughly
2. Review the troubleshooting section
3. Check browser console for errors (F12)
4. Verify all files are present

---

## 📄 License

Copyright © 2025. All rights reserved.

This software is provided for use by authorized users only.

---

## 🙏 Acknowledgments

**Data Sources:**
- UK DEFRA - GHG Conversion Factors 2025
- Brazil SEEG - Observatório do Clima
- GHG Protocol - Reporting standards

**Technology:**
- Chart.js for beautiful visualizations
- jsPDF for PDF generation
- SheetJS for Excel export
- Streamlit for backend API

---

## 📝 Version History

**Version 1.0.0** (Phase 1) - November 2025
- Initial release
- Core calculator functionality
- Xero-style interface
- UK & Brazil conversion factors
- PDF/Excel export
- Dark mode
- Bilingual support

---

**🌱 Built for a sustainable future**

*Track • Calculate • Report • Reduce*

