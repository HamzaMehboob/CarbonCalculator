# Carbon Calculator - Features and Functionalities

## Slide 1 - Title
- Carbon Calculator Platform
- Multi-site carbon accounting and reporting
- GHG Protocol aligned workflow

## Slide 2 - Product Overview
- Web application for emissions data collection, calculation, and reporting
- Supports organizations with multiple buildings/sites
- Includes operational carbon and financial visibility in one dashboard
- Frontend (HTML/CSS/JS), backend API (Flask + MongoDB), Streamlit integrated launcher

## Slide 3 - Core Value
- Centralizes sustainability data entry across scopes and categories
- Converts activity data into emissions using configurable factor databases
- Produces exportable outputs for internal review and external reporting
- Improves traceability with organization-level data persistence

## Slide 4 - Authentication and Security
- User signup and login with hashed passwords (bcrypt)
- JWT-based API authentication
- Session timeout enforced at 30 minutes
- Organization-linked access to data and conversion factors

## Slide 5 - Organization and User Model
- Each user belongs to an organization
- Organization is created/reused at signup
- Shared organization data model enables team-level consistency
- Conversion factors can be initialized and stored per organization

## Slide 6 - Data Input Modules
- Categories: Water, Energy, Waste, Transport, Refrigerants
- Monthly input model (12 months per row)
- Emission-type selector by category
- Description/year metadata and row-level totals
- Dynamic add/delete rows and immediate recalculation

## Slide 7 - Multi-Site Management
- Add, rename, switch, and delete sites/buildings
- Site-specific company notes and data
- Local caching with organization-scoped keys
- Background save and backend synchronization

## Slide 8 - Conversion Factors Management
- Built-in baseline databases (UK/Brazil examples)
- Factor selection by database/country
- Import factors from Excel
- Export factors to Excel
- Report generation using selected factors

## Slide 9 - Calculations and Emissions Logic
- Category-level and total emissions calculations
- Scope 1, Scope 2, Scope 3 breakdown
- Year-over-year comparison
- Monthly aggregation for trend analysis

## Slide 10 - Dashboards and Visualization
- KPI cards for emissions and financial metrics
- Category and trend charts (pie, bar, line)
- Customizable widget visibility
- Accounts area with additional financial charts

## Slide 11 - Financial Features
- Business bank and savings tracking
- Cash-in and cash-out transaction tracking with date
- Invoices owed and bills to pay summaries
- Monthly cash flow and reconciliation-oriented views

## Slide 12 - Reporting and Exports
- PDF export for carbon report summaries
- PDF conversion factors report
- PDF input data summary
- PDF input emissions report
- Excel export (summary, category sheets, monthly and yearly views)
- Final DOCX report generation from a branded template

## Slide 13 - Localization and UX
- English/Portuguese language toggle
- Dark mode support
- Responsive layout with print-aware styles
- Notification system for user actions

## Slide 14 - Data Persistence and Integration
- MongoDB persistence for users, organizations, data, and factors
- JWT-protected API endpoints
- Frontend periodic autosave and sync strategy
- Streamlit integration mode with inlined assets for reliable hosting

## Slide 15 - API Capabilities (High Level)
- `/api/signup` and `/api/login` for account access
- `/api/data` GET/POST for organization data
- `/api/factors` GET/POST for factor databases
- `/api/reports/final` for final DOCX report output

## Slide 16 - Suggested Roadmap
- Role-based access control (admin/editor/viewer)
- Audit trail for factor changes and data edits
- Approval workflow for final reports
- SSO integration and enterprise identity support
- Automated anomaly detection on emissions trends
