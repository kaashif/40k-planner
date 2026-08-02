# Project guidance

Mission Control is an 11th-edition-only Warhammer 40,000 mission and layout reference deployed as a static Next.js export on GitHub Pages.

## Commands

- `npm run dev` starts the local development server.
- `npm run build` creates the GitHub Pages-compatible static site in `out/`.
- `npm run lint` runs ESLint.
- `node scripts/extract-11e-layouts.mjs` regenerates the 45-layout JSON index.

## Structure

- `app/page.tsx` renders the reference site.
- `public/reference/11th-edition/` contains official source PDFs, text extractions, and normalized JSON.
- `scripts/extract-11e-layouts.mjs` parses Event Companion headings and measurement labels.
- `.github/workflows/deploy-pages.yml` builds and deploys the static export.

Do not introduce 10th-edition mission data, layouts, datasheet APIs, or BattleScribe submodules.
