# Borongan City Respondent GIS Dashboard (Prototype)

A React + Vite + Leaflet starter for mapping respondent categories in Borongan City, Eastern Samar.

## Features
- Interactive OpenStreetMap base layer
- Filters for LGU, Tourists, Business Owners, and Residents
- Search by demo respondent ID/category/barangay
- Barangay filter
- Clickable map pins with demo details
- Live category counts and distribution bars
- Export currently filtered demo records to CSV
- Responsive layout

## Important data note
The current records and coordinates in `src/main.jsx` are **illustrative demo data only**. They are not verified survey records or official respondent locations. Replace `DEMO_RESPONDENTS` with authorized, validated client data before use. Avoid exposing exact residential coordinates publicly; aggregate or generalize locations where appropriate.

## Run locally
Requires Node.js 20.19+ or 22.12+ (recommended current LTS).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Project structure

```text
borongan-respondent-gis/
├── index.html
├── package.json
└── src/
    ├── main.jsx
    └── style.css
```

## Next integration step
Once the client confirms the respondent spreadsheet format, connect the application to Supabase/PostgreSQL. Enable Row Level Security (RLS), use least-privilege access, and do not place service-role keys in frontend code. For production, load public/sanitized map data through a restricted query or backend endpoint.
