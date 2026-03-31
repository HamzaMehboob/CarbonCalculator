# Carbon Calculator - Features and Functionalities

## Slide 1 - Title
- Carbon Calculator Platform
- Multi-site carbon accounting, tracking, and reporting
- GHG Protocol aligned workflow for operational use
- Presenter note: "This platform combines emissions accounting and practical business reporting in one place."

## Slide 2 - Product Overview
- Web application to collect activity data and convert it into CO2e emissions
- Supports multiple organizations, each with multiple sites/buildings
- Combines carbon data, financial indicators, dashboards, and reporting exports
- Tech stack: frontend (HTML/CSS/JS), backend API (Flask + MongoDB), Streamlit launcher
- Example: "A facilities team enters monthly energy/water data and gets instant totals and reports."

## Slide 3 - Core Value
- Creates a single source of truth for sustainability data
- Reduces manual spreadsheet work by auto-calculating emissions
- Improves reporting readiness (PDF, Excel, DOCX outputs)
- Enables collaboration through organization-scoped data
- Example: "Operations enters data, sustainability reviews, and management receives formatted reports."

## Slide 4 - Authentication and Security
- Signup/login with hashed passwords (bcrypt)
- JWT-based authentication for protected API endpoints
- Session expiration enforced at 30 minutes for better security
- Access is organization-linked, not anonymous
- Example: "If a user is inactive beyond the timeout, they must re-authenticate before editing data."

## Slide 5 - Organization and User Model (Shared Data Behavior)
- Each user account is linked to one organization
- Organization is created or reused during signup
- Users in the same organization share core datasets
- Shared datasets include site data (`/api/data`) and conversion factors (`/api/factors`)
- Example: "User A updates Site HQ energy data; User B from the same org sees that update after sync/login."
- Important note: browser preferences (dark mode/language) remain local per device/user

## Slide 6 - Data Input Modules
- Categories: Water, Energy, Waste, Transport, Refrigerants
- 12-month input structure per row, plus description and year
- Emission-type selector per category (for correct factor mapping)
- Row-level totals and immediate recalculation on input change
- Example: "Selecting `naturalGas` vs `electricity` changes which conversion factor is applied."

## Slide 7 - Multi-Site Management
- Add, rename, switch, and delete sites/buildings/events
- Site-level storage of notes, company name context, and activity data
- Local cache for fast UI plus backend synchronization for persistence
- Background autosave behavior for reduced data loss risk
- Example: "An org can maintain separate data for Headquarters, Warehouse, and Retail Store."

## Slide 8 - Conversion Factors Management
- Baseline factor sets provided (UK and Brazil examples)
- Organization can import custom factors from Excel
- Factors can be exported for audit/review and external editing
- Country/database selector controls active factor set in calculations
- Example: "A company imports client-specific refrigerant factors and uses them in all reports."

## Slide 9 - Calculations and Emissions Logic
- Computes category totals and grand total emissions
- Provides Scope 1, Scope 2, and Scope 3 breakdown
- Supports monthly trend and year-over-year comparison
- Applies selected factor database consistently across modules
- Example: "Transport kilometers entered monthly are converted into kgCO2e and rolled into yearly totals."

## Slide 10 - Dashboards and Visualization
- KPI cards for emissions and financial snapshots
- Charts: category distribution, yearly comparison, monthly trends
- Widget customization allows tailored executive dashboards
- Separate accounts visuals for cash and liabilities context
- Example: "Leadership can hide detailed widgets and keep only top KPIs + trend charts."

## Slide 11 - Financial Features
- Tracks business bank balance and savings balance
- Captures dated cash-in and cash-out transactions
- Maintains invoices owed and bills to pay summaries
- Supports account-level charts and monthly cashflow context
- Example: "Finance team enters cash transactions to align sustainability reports with business performance."

## Slide 12 - Reporting and Exports
- PDF exports:
- Carbon summary report
- Conversion factors report
- Input data summary report
- Input emissions report (kgCO2e)
- Excel export for summary, category sheets, monthly and yearly views
- Final DOCX report generation from branded template
- Example: "Consultants can send a branded DOCX final statement and an Excel workbook for audit trail."

## Slide 13 - Localization and User Experience
- Language toggle: English and Portuguese
- Dark mode support for accessibility and user preference
- Responsive UI with print-aware rendering
- Inline notifications for save/export/status feedback
- Example: "A bilingual team can switch language live without changing stored calculations."

## Slide 14 - Data Persistence and Integration
- MongoDB stores users, organizations, datasets, and factor databases
- JWT-protected API access for data operations
- Frontend autosave + backend sync to keep data current
- Streamlit integration supports hosted deployment scenarios
- Example: "Even after browser refresh, organization data is reloaded from backend storage."

## Slide 15 - API Capabilities (High Level)
- `/api/signup` and `/api/login` for user lifecycle and authentication
- `/api/data` GET/POST for organization-level site/emissions data
- `/api/factors` GET/POST for organization-level conversion factors
- `/api/reports/final` POST for generating final DOCX report
- Example payload concept: "frontend sends totals, scope values, and metadata; backend returns downloadable DOCX."

## Slide 16 - End-to-End Example Journey
- Step 1: User signs up with organization name
- Step 2: Adds sites and enters monthly operational data
- Step 3: Chooses/updates conversion factors
- Step 4: Reviews dashboard trends and scope totals
- Step 5: Exports PDF/Excel and generates final DOCX
- Collaboration example: "Two users in same organization contribute data and generate one shared final report."

## Slide 17 - Suggested Roadmap
- Role-based access control (admin/editor/viewer)
- Data change audit log (who changed what and when)
- Approval workflow for report sign-off
- Invite-based organization onboarding flow before user creation
- Enterprise SSO integration and stronger identity controls
- Automated anomaly detection on unusual emissions trends
