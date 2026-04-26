# Userscripts

## New Recruit to 40k Planner

Violentmonkey userscript:

`userscripts/newrecruit-to-40k-planner.user.js`

### Install

1. Install Violentmonkey in Firefox.
2. Open the Violentmonkey dashboard.
3. Click the `+` button or `New script`.
4. Paste the contents of `newrecruit-to-40k-planner.user.js`.
5. Save.

### Use

1. Start the planner:
   `npm run dev`
2. Open a New Recruit JSON export page.
3. Click `Open in 40k Planner`.

The script stores the roster JSON in Violentmonkey storage, opens `http://localhost:3000/?nrImport=1`, and the planner imports the roster through `localStorage`.
