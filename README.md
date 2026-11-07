# Attendance System (Google Sheets + Apps Script)

A simple Time In / Time Out form. Employees type their name or ID and click a button;
a timestamp is saved to a Google Sheet, linked to an employee masterlist.

## Repo structure
```
attendance-system/
├── README.md
├── data/masterlist_sample.csv   # 50 sample employees (random data)
└── src/
    ├── Code.gs                  # backend logic (Apps Script)
    ├── index.html               # the form
    └── appsscript.json          # project settings (timezone, web app access)
```

## Setup
1. Create a new Google Sheet. Rename the first tab to **Masterlist**.
2. File > Import > Upload `data/masterlist_sample.csv` > *Replace current sheet*.
3. Extensions > Apps Script. Paste `src/Code.gs` into `Code.gs`.
4. Add a new HTML file named **index** and paste `src/index.html`.
5. Select `setupSheets` in the toolbar and click Run (approve permissions). This creates the **Attendance** tab.
6. Deploy > New deployment > Web app. Execute as: *Me*. Who has access: *Anyone* (or your organization).
7. Open the web app URL and test with `EMP-001`.

## Rules (change in `CONFIG` at the top of Code.gs)
- Same action can't be repeated within `COOLDOWN_MINUTES` (default 480 = 8 hours), tracked per employee.
- Timestamp is taken by the server, not the user's device.
- Only employees with Status = `Active` can log. Two sample employees are Inactive for testing.
- Names must match exactly (case-insensitive). If two people share a name, the form asks for the ID.

## Data model
- **Masterlist** (one row per employee) - key: `Employee ID`
- **Attendance** (one row per click) - links to Masterlist through `Employee ID`

## Ideas for later
- Require Time In before Time Out
- Daily summary / hours worked
- Late-arrival flag

## Show the form on GitHub Pages
1. Put `index.html` (repo root) in your repo and paste your Apps Script `/exec` URL into `API_URL`.
2. Update `Code.gs` in Apps Script (it now has `doPost`), then Deploy > Manage deployments > Edit > New version.
3. Repo Settings > Pages > Deploy from branch `main` / root.
4. Open `https://<your-username>.github.io/<repo-name>/`.

`src/index.html` is the version served by Apps Script itself; root `index.html` is the GitHub Pages version.
