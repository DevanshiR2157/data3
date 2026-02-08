# Static AQI Double Jeopardy Dashboard (GitHub Pages)

This folder contains a **static** (HTML/CSS/JS) version of the Streamlit dashboard, designed to deploy **directly from GitHub Pages**.

## Files

- `index.html` → redirects to `pages/overview.html`
- `pages/` → all dashboard pages
- `assets/` → shared CSS/JS

## Data

Place these CSVs in the **repo root** (repo root (same folder as `index.html`)):

- `annual_aqi_by_county_2021.csv`
- `annual_aqi_by_county_2022.csv`
- `annual_aqi_by_county_2023.csv`
- `annual_aqi_by_county_2024.csv`
- `annual_aqi_by_county_2025.csv`

## Deploy (GitHub Pages)

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` (or default)
4. Folder: `/ (root)`

Then visit: `https://<username>.github.io/<repo>/`

> GitHub Pages serves static files (HTML/CSS/JS). Run locally via `python -m http.server 8000`.
