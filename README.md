# Mission Control

A static GitHub Pages reference for Warhammer 40,000 11th-edition missions and official event layouts.

The site is a compact 5×5 primary mission matrix. Selecting a cell shows both players' complete primary cards from GDM and the three matching measured Event Companion layouts. It also contains all 18 secondary mission names and a local source library containing the official public PDFs and normalized JSON.

Primary-card images are loaded from `gdmissions.app`; they are not duplicated in this repository. The 45 layout previews are generated from the local official Event Companion PDF.

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

## Regenerating layout previews

```sh
pdftoppm -f 9 -l 53 -r 110 -jpeg -jpegopt quality=82,progressive=y,optimize=y \
  public/reference/11th-edition/official/event-companion.pdf \
  public/reference/11th-edition/layouts/layout
```
