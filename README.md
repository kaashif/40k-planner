# Mission Control

A static GitHub Pages reference for Warhammer 40,000 11th-edition missions and official event layouts.

The site contains the five Force Dispositions, the complete directed 5×5 primary mission matrix, all 18 secondary mission names, all 45 measured Event Companion layouts, and a local source library containing the official public PDFs and normalized JSON.

## Development

```sh
npm ci
npm run dev
```

## Static export

```sh
npm run build
npm start
```

GitHub Pages deployment is handled by `.github/workflows/deploy-pages.yml`. The workflow sets `NEXT_PUBLIC_BASE_PATH=/40k-planner` so assets work beneath the repository Pages path.
