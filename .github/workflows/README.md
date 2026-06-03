# GitHub Actions — Pages deployment

## Error: Multiple artifacts named `github-pages`

`actions/deploy-pages` expects **exactly one** artifact named `github-pages` per workflow run.

This error means **three** upload steps (or three workflows on the same commit) all called `upload-pages-artifact` with the default name.

### Fix on GitHub.com

1. Open the repo → **Actions** → **Workflows** (left sidebar).
2. Find **every** workflow that deploys Pages, for example:
   - `Deploy GitHub Pages` (keep this one)
   - `pages build and deployment`
   - `GitHub Pages` / `Static HTML` / Jekyll defaults
3. For each **duplicate**:
   - Open the workflow → **⋯** → **Disable workflow**, **or**
   - Delete the file under `.github/workflows/` on a branch and push.
4. **Settings** → **Pages** → **Build and deployment** → Source: **GitHub Actions**.
5. Re-run **only** `Deploy GitHub Pages` (workflow_dispatch) or push to `main`.

### Cancel stale runs

Actions → select failed run → **Cancel workflow** on any in-progress duplicates, then re-run once.

## Canonical workflow

Use **`deploy-github-pages.yml`** only. It builds `index.html`, `js/`, `css/`, and `assets/` into `_site/` and performs a single upload + deploy.

The Flask/Mongo API is **not** deployed to GitHub Pages (use [Render](https://render.com) or similar for `backend/mongo_api.py`).
