# AFL Predictions Website — Build Specification

## 1. Project Overview

A statically-generated website that surfaces AFL match predictions, predicted ladders, model accuracy tracking, and a methodology page. Data is sourced from Databricks at build time and deployed to Firebase Hosting via GitHub Actions.

The site participates in the Squiggle AFL tipping competition ecosystem. It should look professional, load fast, and update automatically when new predictions or results are available.

### 1.1 Design Principles

- Static-first: all pages are pre-rendered at build time. No client-side API calls to Databricks.
- Data refreshed via CI/CD pipeline (GitHub Actions on push + Databricks-triggered `repository_dispatch`).
- Mobile-responsive. Most visitors will check tips on their phone on game day.
- Clean, modern aesthetic. Reference sites: [Don't Blame the Data](https://www.dontblamethedata.com/models/afl/aflm_tipping) for layout clarity, [Winnable](https://www.winnableafl.com/) for information density.
- Australian English throughout.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Static export via `output: 'export'` in `next.config.ts` |
| Styling | Tailwind CSS | Utility-first. No separate CSS files. |
| Language | TypeScript | Strict mode enabled. |
| Data fetch | Node script (`scripts/fetch-data.ts`) | Runs at build time. Calls Databricks SQL Statement Execution API. Writes JSON to `src/data/` (fallback to `src/data-mock/` in local dev). |
| Hosting | Firebase Hosting | Global CDN, managed HTTPS, static file hosting from `out/`. |
| CI/CD | GitHub Actions | Deploy on push to `main` + `repository_dispatch` + manual `workflow_dispatch`. |
| DNS/CDN | Firebase Hosting custom domain (optional) | Domain mapping and SSL managed by Firebase. |
| Version control | GitHub | Private repository. |

---

## 3. Repository Structure

```
afl-predictions-site/
├── .github/
│   └── workflows/
│       └── deploy.yml                # push, repository_dispatch, manual
├── public/
│   └── teams/                        # 18 team logo files (SVG or PNG)
│       ├── adelaide.svg
│       ├── brisbane.svg
│       ├── carlton.svg
│       └── ... (all 18 teams)
├── scripts/
│   └── fetch-data.ts                 # Databricks SQL API → JSON
├── src/
│   ├── app/
│   │   ├── layout.tsx                # root layout with nav
│   │   ├── page.tsx                  # home → redirects to /tips or shows current round
│   │   ├── tips/
│   │   │   └── page.tsx              # tips/results table (main page)
│   │   ├── ladder/
│   │   │   └── page.tsx              # predicted ladder views
│   │   ├── accuracy/
│   │   │   └── page.tsx              # historical accuracy tracking
│   │   └── about/
│   │       └── page.tsx              # "how does this model work"
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx            # top navigation bar
│   │   │   └── Footer.tsx
│   │   ├── tips/
│   │   │   ├── TipsTable.tsx         # main sortable/filterable tips table
│   │   │   ├── RoundFilter.tsx       # round selector (dropdown or pills)
│   │   │   └── SeasonSummaryBar.tsx  # headline stats above table
│   │   ├── ladder/
│   │   │   └── LadderTable.tsx       # ladder with team badges + colours
│   │   └── shared/
│   │       ├── TeamBadge.tsx         # icon + abbreviated team name
│   │       ├── WinProbCell.tsx       # win% with conditional background
│   │       └── TipResultBadge.tsx    # tick or cross indicator
│   ├── config/
│   │   └── teams.ts                  # team colours, names, icon paths
│   ├── data/                         # git-ignored, populated at build time
│   │   ├── predictions.json
│   │   ├── ladder-preseason.json
│   │   ├── ladder-current.json
│   │   └── accuracy.json
│   ├── data-mock/                    # committed fallback fixtures for local dev
│   │   ├── predictions.json
│   │   ├── ladder-preseason.json
│   │   ├── ladder-current.json
│   │   └── accuracy.json
│   ├── content/
│   │   └── about.md                  # model methodology (rendered at build)
│   └── lib/
│       └── types.ts                  # shared TypeScript interfaces
├── firebase.json                     # Hosting config, serves from out/
├── infra/
│   ├── setup.sh                      # legacy Oracle VM script (no longer primary path)
│   └── firebase-iam.sh               # helper script for Firebase IAM/service account setup
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

---

## 4. Data Layer

### 4.1 Databricks Integration

The `scripts/fetch-data.ts` script runs during the build step (not in the browser). It:

1. Authenticates to Databricks using GitHub Secrets (`DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_HTTP_PATH`).
   - `DATABRICKS_HTTP_PATH` is the SQL warehouse HTTP path, from which the script derives `warehouse_id`.
2. Executes SQL queries via the [Databricks SQL Statement Execution API](https://docs.databricks.com/api/workspace/statementexecution).
3. Writes results as JSON files into `src/data/` (used at build/deploy time).
4. Process exits with code 0 on success, non-zero on failure (to fail the build).

### 4.2 Required Queries

| Output file | Purpose | Query description |
|---|---|---|
| `predictions.json` | All tips for the current season | Season, round, date, venue, home/away teams, predicted winner, predicted margin, win probability, actual winner (if played), actual margin, tip correct flag |
| `ladder-preseason.json` | Start-of-season predicted ladder | Team, predicted wins, predicted percentage, predicted finishing position |
| `ladder-current.json` | Current predicted ladder | Actual W/L/D to date + predicted results for remaining rounds. Team, current wins, current losses, current draws, current percentage, predicted final wins, predicted final position |
| `accuracy.json` | Season-level accuracy metrics | Tips correct, total tips, accuracy %, MAE, Bits score — both cumulative and per-round |

### 4.3 Data Shape — predictions.json

```typescript
interface Prediction {
  season: number;
  round: number;
  round_label: string;          // e.g., "Round 0", "Finals Week 1"
  date: string;                 // ISO 8601 with timezone
  venue: string;
  home_team: TeamKey;           // matches key in teams.ts config
  away_team: TeamKey;
  predicted_winner: TeamKey;
  predicted_margin: number;     // positive number
  win_probability: number;      // 0.0 to 1.0 (for the predicted winner)
  actual_winner: TeamKey | null;
  actual_margin: number | null;
  tip_correct: boolean | null;
  margin_error: number | null;  // absolute error: |predicted - actual|
}
```

### 4.4 Data Shape — ladder JSON

```typescript
interface LadderEntry {
  team: TeamKey;
  position: number;
  wins: number;
  losses: number;
  draws: number;
  percentage: number;
  // Current ladder only:
  predicted_final_wins?: number;
  predicted_final_position?: number;
}
```

### 4.5 Data Shape — accuracy.json

```typescript
interface AccuracyData {
  season: number;
  as_at_round: number;
  total_tips: number;
  tips_correct: number;
  accuracy_pct: number;
  mae: number;
  bits: number;
  by_round: {
    round: number;
    round_label: string;
    tips: number;
    correct: number;
    accuracy_pct: number;
    mae: number;
  }[];
}
```

---

## 5. Team Configuration

All team identity data lives in `src/config/teams.ts`. This is the single source of truth for colours, names, abbreviations, and icon paths. Components must reference this config — no hardcoded team colours or names elsewhere.

```typescript
export type TeamKey =
  | 'adelaide' | 'brisbane' | 'carlton' | 'collingwood'
  | 'essendon' | 'fremantle' | 'geelong' | 'goldcoast'
  | 'gws' | 'hawthorn' | 'melbourne' | 'northmelbourne'
  | 'portadelaide' | 'richmond' | 'stkilda' | 'sydney'
  | 'westcoast' | 'bulldogs';

export interface TeamInfo {
  name: string;         // Full name: "Brisbane Lions"
  short: string;        // 3-letter: "BRI"
  primary: string;      // Hex: "#A30046"
  secondary: string;    // Hex: "#0055A3"
  icon: string;         // Path: "/teams/brisbane.svg"
}

export const teams: Record<TeamKey, TeamInfo> = {
  adelaide:      { name: 'Adelaide',          short: 'ADE', primary: '#002B5C', secondary: '#FFD200', icon: '/teams/adelaide.svg' },
  brisbane:      { name: 'Brisbane Lions',    short: 'BRI', primary: '#A30046', secondary: '#0055A3', icon: '/teams/brisbane.svg' },
  carlton:       { name: 'Carlton',           short: 'CAR', primary: '#0E1E2D', secondary: '#FFFFFF', icon: '/teams/carlton.svg' },
  collingwood:   { name: 'Collingwood',       short: 'COL', primary: '#000000', secondary: '#FFFFFF', icon: '/teams/collingwood.svg' },
  essendon:      { name: 'Essendon',          short: 'ESS', primary: '#CC2031', secondary: '#000000', icon: '/teams/essendon.svg' },
  fremantle:     { name: 'Fremantle',         short: 'FRE', primary: '#2A0D45', secondary: '#FFFFFF', icon: '/teams/fremantle.svg' },
  geelong:       { name: 'Geelong',           short: 'GEE', primary: '#001F3D', secondary: '#FFFFFF', icon: '/teams/geelong.svg' },
  goldcoast:     { name: 'Gold Coast',        short: 'GCS', primary: '#D63239', secondary: '#F6BD00', icon: '/teams/goldcoast.svg' },
  gws:           { name: 'GWS Giants',        short: 'GWS', primary: '#F47920', secondary: '#4A4F55', icon: '/teams/gws.svg' },
  hawthorn:      { name: 'Hawthorn',          short: 'HAW', primary: '#4D2004', secondary: '#FBBF15', icon: '/teams/hawthorn.svg' },
  melbourne:     { name: 'Melbourne',         short: 'MEL', primary: '#0F1131', secondary: '#CC2031', icon: '/teams/melbourne.svg' },
  northmelbourne:{ name: 'North Melbourne',   short: 'NTH', primary: '#013B9F', secondary: '#FFFFFF', icon: '/teams/northmelbourne.svg' },
  portadelaide:  { name: 'Port Adelaide',     short: 'PTA', primary: '#008AAB', secondary: '#000000', icon: '/teams/portadelaide.svg' },
  richmond:      { name: 'Richmond',          short: 'RIC', primary: '#000000', secondary: '#FED102', icon: '/teams/richmond.svg' },
  stkilda:       { name: 'St Kilda',          short: 'STK', primary: '#ED0F05', secondary: '#000000', icon: '/teams/stkilda.svg' },
  sydney:        { name: 'Sydney',            short: 'SYD', primary: '#ED171F', secondary: '#FFFFFF', icon: '/teams/sydney.svg' },
  westcoast:     { name: 'West Coast',        short: 'WCE', primary: '#002B5C', secondary: '#F2A900', icon: '/teams/westcoast.svg' },
  bulldogs:      { name: 'Western Bulldogs',  short: 'WBD', primary: '#014896', secondary: '#E31937', icon: '/teams/bulldogs.svg' },
};
```

Team logos should be sourced as SVG or high-quality PNG files at approximately 48x48px native size. Store in `public/teams/`. These can be sourced from the AFL website or Squiggle's public assets and converted to SVG.

---

## 6. Page Specifications

### 6.1 Navigation

A persistent horizontal navigation bar across the top of all pages. Dark background, light text.

**Items:**

| Label | Route | Description |
|---|---|---|
| Site name/logo | `/` | Home link. Left-aligned. |
| Tips | `/tips` | Current season tips table |
| Ladder | `/ladder` | Predicted ladder views |
| Accuracy | `/accuracy` | Historical model performance |
| How It Works | `/about` | Model methodology |

Active page should be visually indicated (underline or highlight).

Mobile: collapse to a hamburger menu.

---

### 6.2 Tips Page (`/tips`)

This is the primary page of the site. It displays a filterable, sortable data table of match predictions and results.

**Reference design:** Combination of [Don't Blame the Data](https://www.dontblamethedata.com/models/afl/aflm_tipping) (clean layout, team logos on predicted winner) and [Winnable](https://www.winnableafl.com/) (information density, heat-mapped win%, tick/cross results, evaluation metrics per row).

#### 6.2.1 Layout

From top to bottom:

1. **Page title:** "2026 Tips" (dynamic based on current season)
2. **Season summary bar** (only shown when at least one result exists):
   - Tips correct: e.g., "42 / 56"
   - Accuracy: e.g., "75.0%"
   - MAE: e.g., "26.3"
   - Bits: e.g., "48.1"
   - Displayed as a horizontal row of stat cards.
3. **Round filter:** Dropdown or horizontal pill selector. Options: "All", then each round number/label. Default: current/latest round with results, or next upcoming round if no results yet.
4. **Tips table:** The main data table (see below).

#### 6.2.2 Table Columns

The table has two modes depending on whether results are available.

**Pre-match columns (predictions only):**

| Column | Content | Notes |
|---|---|---|
| Round | Round number or label | |
| Date | Date and time | Format: "Thu 5 Mar 7:30pm AEDT" (rendered in the viewer's local timezone, with timezone abbreviation) |
| Venue | Venue name | Short form preferred (SCG, MCG, Gabba) |
| Home | Team badge (icon + abbreviation) | e.g., [SYD icon] SYD |
| Away | Team badge (icon + abbreviation) | e.g., [CAR icon] CAR |
| Tip | Predicted winner badge | Team icon of the tipped team |
| Margin | Predicted margin | Numeric, 1 decimal place |
| Win% | Win probability | Percentage, 1 decimal place. **Conditional background shading** (see 6.2.3). |

**Post-match columns (results available — appended after Win%):**

| Column | Content | Notes |
|---|---|---|
| Winner | Actual winner badge | Team icon |
| Actual | Actual margin | Integer |
| Result | Tip correct indicator | ✓ (green) or ✗ (red) |
| MAE | Margin error for this match | Absolute value, 1 decimal place |

#### 6.2.3 Win Probability Shading

The Win% cell background should be conditionally shaded to indicate confidence level. Use a single-colour ramp (not team colours):

| Win% range | Background |
|---|---|
| 50.0% – 55.0% | Transparent / no shading |
| 55.1% – 65.0% | Light amber (low opacity) |
| 65.1% – 75.0% | Medium amber |
| 75.1% – 85.0% | Orange |
| 85.1% – 100% | Deep orange / red-orange |

Implement as a utility function that returns a Tailwind class or inline style based on the probability value. The shading should be a continuous gradient, not hard steps — use `rgba()` with opacity scaled to the probability.

#### 6.2.4 Sortable Columns

The following columns should be sortable (click header to toggle asc/desc): Round, Date, Margin, Win%, Actual, MAE.

Implement with React state — no external library required.

#### 6.2.5 Mobile Responsiveness

On mobile (< 768px):
- Hide the Venue and Date columns.
- Use team abbreviations only (no full names).
- Team badge icons remain visible at a smaller size (16–20px).
- Table scrolls horizontally if needed.

---

### 6.3 Ladder Page (`/ladder`)

Displays two ladder views with a toggle/tab to switch between them.

#### 6.3.1 Views

**Pre-season Predicted Ladder:**
- Generated before Round 1.
- Shows the model's start-of-season predictions.
- Columns: Position, Team (badge + full name), Predicted Wins, Predicted %.
- Left border on each row coloured with the team's primary colour.

**Current Predicted Ladder:**
- Updated weekly.
- Combines actual results to date with predicted outcomes for remaining matches.
- Columns: Position, Team (badge + full name), Current W-L-D, Current %, Predicted Final Wins, Predicted Final Position.
- Left border on each row coloured with the team's primary colour.
- Highlight the top 8 with a subtle background tint or a divider line after position 8.

#### 6.3.2 Toggle

A tab bar or segmented control at the top: **Pre-season** | **Current**

Default to "Current" once the season has started.

---

### 6.4 Accuracy Page (`/accuracy`)

Tracks model performance over the season, both cumulatively and round-by-round.

#### 6.4.1 Cumulative Stats

Display at the top (similar to SeasonSummaryBar on the tips page):
- Total tips correct / total tips
- Cumulative accuracy %
- Cumulative MAE
- Cumulative Bits

#### 6.4.2 Round-by-Round Table

| Column | Content |
|---|---|
| Round | Round number/label |
| Tips | Number of matches in round |
| Correct | Number tipped correctly |
| Accuracy | Round accuracy % |
| MAE | Round MAE |

#### 6.4.3 Future Enhancement (Not MVP)

A line chart showing cumulative accuracy % and MAE over the season. Defer this — table is sufficient for launch.

---

### 6.5 About Page (`/about`) — "How Does This Model Work?"

A static content page rendered from markdown (`src/content/about.md`). Use `next-mdx-remote` or `gray-matter` + `remark` to render at build time.

#### 6.5.1 Content Structure

The page should cover the following sections. Write in plain, accessible language — the audience is AFL fans and Squiggle community members, not ML researchers.

**Overview**

A two-layer prediction system. Layer 1 is an Elo ratings engine that estimates team strength. Layer 2 is an XGBoost regression model that combines Elo ratings with match-level features to produce margin predictions and win probabilities.

**Layer 1: Elo Ratings**

- Based on the Elo rating system (originally developed for chess).
- Each team starts at a base rating of 1500. Ratings increase after wins and decrease after losses.
- The magnitude of the rating change depends on the opponent's strength (beating a strong team is worth more than beating a weak team).
- Key tuning parameters:
  - **Venue-specific home ground advantage:** Rather than a flat constant, accounts for ground familiarity (how often each team plays at the venue) and travel fatigue. Informed by Ryall & Bedford (2010).
  - **Margin of victory multiplier:** Big wins are worth more than narrow wins, but with diminishing returns.
  - **Inter-season decay:** Ratings regress toward the mean between seasons, reflecting roster turnover and the inherent uncertainty of a new year.
- The 2020 season is excluded from parameter optimisation due to COVID-related anomalies (shortened season, neutral venues, no crowds).

**Layer 2: XGBoost Model**

- Takes the Elo ratings from Layer 1 as a key input, alongside other match-level features.
- Features include:
  - Elo ratings for both teams (from Layer 1)
  - Rolling team-aggregated match statistics: contested possessions differential, inside 50s, clearances, I50/R50 efficiency
  - "Completed rounds" as a proxy for how much information the Elo engine has processed — the model learns to weight Elo more heavily later in the season when ratings are more reliable, and lean on form-based features early on.
- Trained using temporal cross-validation to prevent look-ahead bias.
- Outputs a predicted margin. Win probability is derived from the predicted margin using a calibrated logistic function.

**What's Deliberately Excluded**

- **Bookmaker odds:** The model is independently derived. Using odds as a feature would mean outsourcing predictions to the betting market rather than building genuine forecasting capability.
- **Individual player statistics:** Team-aggregated stats are more tractable and don't depend on team sheet announcements (which often come less than 24 hours before a match). Player-level features may be explored in future.
- **Weather data:** Tested and found to be noisy with low marginal predictive value.

**Performance Targets**

- MAE < 28 points
- Tipping accuracy > 67%
- Benchmarked against the Squiggle tipping leaderboard.

**Acknowledgements**

- Squiggle community and API
- Ryall, R. & Bedford, A. (2010). "An optimized ratings-based model for forecasting Australian Rules football." *International Journal of Forecasting*, 26(3), 511–517.
- Betfair AFL modelling tutorial series

#### 6.5.2 Optional Diagram

Include a simple flow diagram showing the two-layer architecture. Either a static SVG or a Mermaid diagram:

```
Historical match data
        │
        ▼
  ┌─────────────┐
  │  Layer 1:   │
  │  Elo Engine │
  └──────┬──────┘
         │ Elo ratings
         ▼
  ┌─────────────────┐     Rolling match stats
  │    Layer 2:     │◄──── (contested possessions,
  │    XGBoost      │      inside 50s, clearances,
  │                 │      efficiency metrics)
  └──────┬──────────┘
         │
         ▼
  Predicted margin
  Win probability
```

---

## 7. Shared Components

### 7.1 TeamBadge

Renders a team's icon and abbreviated name side by side.

**Props:**
- `team: TeamKey` — the team identifier
- `size?: 'sm' | 'md'` — icon size. `sm` = 20px (for table cells), `md` = 28px (for ladder).

**Renders:**
- `<img>` of the team icon at specified size
- 3-letter abbreviation text next to the icon
- Both wrapped in a flex row.

### 7.2 WinProbCell

Renders a table cell with a win probability value and conditional background shading.

**Props:**
- `probability: number` — value between 0.0 and 1.0

**Renders:**
- Percentage text (e.g., "57.7%")
- Background colour scaled from transparent (at 0.5) to deep orange (at 1.0) using `rgba()` interpolation.

### 7.3 TipResultBadge

Renders a simple correct/incorrect indicator.

**Props:**
- `correct: boolean | null`

**Renders:**
- `null` → empty cell (match not yet played)
- `true` → green ✓
- `false` → red ✗

---

## 8. Styling Guidelines

- **Font:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`). No custom web fonts — keeps it fast.
- **Colour palette:**
  - Background: white (`#FFFFFF`) or very light grey (`#F9FAFB`)
  - Text: dark grey (`#111827`)
  - Nav background: dark (`#1F2937`)
  - Accent: a neutral blue (`#2563EB`) for links and active states
  - Team colours used only for team badges and ladder row borders — not for general UI elements.
- **Spacing:** Consistent use of Tailwind spacing scale. Tables should have comfortable padding (`px-4 py-3` on cells).
- **Dark mode:** Not required for MVP. Can be added later via Tailwind's `dark:` variant.

---

## 9. CI/CD Pipeline

### 9.1 Trigger Strategy

The website rebuild is triggered by three mechanisms:

| Trigger | When | Purpose |
|---|---|---|
| `push` to `main` | On code changes | Deploy code updates |
| `repository_dispatch` | Called by Databricks pipeline | Deploy fresh data after model predictions or results are updated |
| `workflow_dispatch` | Manual button in GitHub UI | Ad-hoc rebuilds, debugging |

There is no cron schedule. The Databricks model refresh pipeline is the authoritative source of "new data is ready" — it triggers the website deploy at the end of its run. This avoids unnecessary builds and ensures the site is always in sync with the latest predictions.

### 9.2 Pipeline-Triggered Deploy (`repository_dispatch`)

After the Databricks prediction pipeline completes (either generating new predictions or ingesting results), it makes a single API call to GitHub to trigger a website rebuild:

```python
# At the end of the Databricks prediction/results pipeline
import requests

requests.post(
    "https://api.github.com/repos/{owner}/{repo}/dispatches",
    headers={
        "Authorization": f"Bearer {github_pat}",
        "Accept": "application/vnd.github+json",
    },
    json={
        "event_type": "data-refresh",
        "client_payload": {
            "trigger": "databricks-pipeline",
            "timestamp": "2026-03-08T18:30:00+11:00"
        }
    }
)
```

The `client_payload` is optional but useful for logging which pipeline run triggered the deploy. The `event_type` value (`data-refresh`) is matched in the workflow file.

#### 9.2.1 GitHub PAT for Databricks → GitHub

The Databricks pipeline needs a **GitHub personal access token** (fine-grained, scoped to the website repo with `contents: write` permission) to call the `repository_dispatch` endpoint. Store this as a Databricks secret:

```python
# Store once via Databricks CLI
# databricks secrets put-secret --scope github --key pat

# Retrieve in pipeline code
github_pat = dbutils.secrets.get(scope="github", key="pat")
```

This is a separate token from the Databricks PAT used by GitHub Actions. The two systems authenticate to each other independently:

```
Databricks pipeline                GitHub Actions
       │                                 │
       │  GitHub PAT (stored in          │  Databricks PAT (stored in
       │  Databricks secrets)            │  GitHub Secrets)
       │                                 │
       ▼                                 ▼
  Triggers repository_dispatch      Calls Databricks SQL API
  on GitHub                         to fetch prediction data
```

### 9.3 Build and Deploy Steps

All triggers (push, repository_dispatch, workflow_dispatch) run the same job:

1. Checkout repository.
2. Set up Node.js 20.
3. `npm ci` — install dependencies.
4. `npx tsx scripts/fetch-data.ts` — fetch current data from Databricks via SQL Statement Execution API.
5. `npm run build` — Next.js static export.
6. Deploy `out/` directory to Firebase Hosting.

### 9.4 GitHub Secrets Required

| Secret | Purpose |
|---|---|
| `DATABRICKS_HOST` | Databricks workspace URL |
| `DATABRICKS_TOKEN` | Databricks personal access token (for GitHub → Databricks) |
| `DATABRICKS_HTTP_PATH` | SQL warehouse HTTP path (e.g. `/sql/1.0/warehouses/<warehouse-id>`), used to derive warehouse ID |
| `FIREBASE_PROJECT_ID` | Firebase project ID for Hosting deploy target |
| `FIREBASE_SERVICE_ACCOUNT` | JSON service account key with Firebase Hosting deploy permissions |

### 9.5 Databricks Secrets Required

| Scope | Key | Purpose |
|---|---|---|
| `github` | `pat` | GitHub fine-grained PAT (for Databricks → GitHub `repository_dispatch`) |

### 9.6 Deploy Workflow (Reference)

```yaml
name: Build and Deploy
on:
  push:
    branches: [main]

  repository_dispatch:
    types: [data-refresh]

  workflow_dispatch:

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Fetch data from Databricks
        run: npx tsx scripts/fetch-data.ts
        env:
          DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
          DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}
          DATABRICKS_HTTP_PATH: ${{ secrets.DATABRICKS_HTTP_PATH }}

      - run: npm run build

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
          channelId: live
```

### 9.7 Expected Trigger Cadence

During the season, the website will typically rebuild at the following points:

| Event | Trigger source | Frequency |
|---|---|---|
| Pre-round predictions generated | Databricks pipeline → `repository_dispatch` | Once per round (mid-week) |
| Match results ingested | Databricks pipeline → `repository_dispatch` | After each match day (Fri/Sat/Sun/Mon) |
| Ladder recalculated | Databricks pipeline → `repository_dispatch` | After final match of each round |
| Code changes pushed | `push` to `main` | As needed |

This means 3–5 rebuilds per round during the season. Each rebuild takes ~2–3 minutes (fetch + build + deploy). GitHub Actions free tier provides 2,000 minutes/month, which is well within budget for a 24-round season.

---

## 10. Firebase Hosting Setup

One-off manual setup (~20 minutes).

### 10.1 Provision

- Create a Firebase project and enable Firebase Hosting.
- Create a Google Cloud service account for GitHub Actions deployments.
- Grant least-privilege baseline project roles:
  - `roles/firebasehosting.admin`
  - `roles/serviceusage.apiKeysViewer` (required by Firebase CLI-based deployment flows)
- Generate a JSON key for this service account.

### 10.2 Repository Setup

- Add `firebase.json` with hosting `public` set to `out`.
- Use `infra/firebase-iam.sh` to create/configure deploy service account and optional key.
- Add GitHub Actions secrets:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_SERVICE_ACCOUNT`
  - Databricks secrets (`DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_HTTP_PATH`)
- Deploy via workflow on push to `main`, `repository_dispatch`, or manual trigger.

### 10.3 Custom Domain (Optional)

- Add the domain in Firebase Hosting.
- Configure DNS records as instructed by Firebase.
- Wait for certificate provisioning and verify HTTPS.

---

## 11. Implementation Sequence

Recommended order for building with Claude Code:

| Step | Task | Estimated effort |
|---|---|---|
| 1 | Scaffold Next.js project with Tailwind, TypeScript, static export config | Quick |
| 2 | Create `teams.ts` config and `TeamBadge` component | Quick |
| 3 | Create mock JSON data files (3–5 rounds of sample predictions + results) | Quick |
| 4 | Build `TipsTable`, `WinProbCell`, `TipResultBadge`, `RoundFilter`, `SeasonSummaryBar` | Core work |
| 5 | Build `LadderTable` with both views and toggle | Moderate |
| 6 | Build About page with markdown rendering | Quick |
| 7 | Build Accuracy page | Quick |
| 8 | Build `Navbar` and `Footer`, wire up routing | Quick |
| 9 | Mobile responsiveness pass | Moderate |
| 10 | Write `fetch-data.ts` script for Databricks integration | Moderate |
| 11 | Set up GitHub Actions workflow and Databricks `repository_dispatch` call | Quick |
| 12 | Configure Firebase Hosting and deploy | Manual, one-off |

Steps 1–9 can be completed in a single Claude Code session using mock data. Steps 10–12 require access to Databricks credentials and Firebase/GCP.

---

## 12. Mock Data for Development

To enable development without a live Databricks connection, create mock JSON files that match the schemas defined in Section 4 and commit them to `src/data-mock/`. Include:

- At least 2 rounds of predictions (e.g., Round 0 with 5 matches, Round 1 with 9 matches).
- At least 1 round with completed results (tip_correct, actual_winner, actual_margin populated).
- At least 1 round with predictions only (actual fields null).
- A mix of correct and incorrect tips.
- A range of win probabilities (some close to 50%, some above 80%).
- Pre-season and current ladder data for all 18 teams.

This allows the full UI to be built and tested before the Databricks integration is wired up.

---

## 13. Future Enhancements (Not MVP)

These are not in scope for the initial build but are worth considering for later iterations:

- **Accuracy charts:** Line charts showing cumulative accuracy and MAE over the season (Recharts or Chart.js).
- **Elo ratings page:** Display current Elo ratings for all 18 teams, similar to DBTD's "Team Ratings" tab.
- **Season archive:** Allow viewing tips and results from previous seasons.
- **Dark mode.**
- **Squiggle API integration:** Pull comparison data from the Squiggle API to show how the model ranks against others on the leaderboard.
- **RSS feed or Bluesky bot:** Automated posting of weekly tips.
