# Colorado Home Search

A rental home search tool focused on Colorado suburbs (Parker, Castle Pines, Castle Rock, Highlands Ranch). Aggregates listings from compliant sources, scores them against your preferences, and helps you find the right home fast.

## Stack

- **Frontend**: React 18 + Vite (SPA)
- **Styling**: Custom CSS with design tokens
- **Backend**: Netlify Functions (serverless)
- **Database**: Supabase (PostgreSQL + Auth)
- **Maps**: Google Maps JavaScript API
- **Deployment**: Netlify

## Quick Start — Local Development

### 1. Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) account (free tier works)
- A [Google Maps API key](https://console.cloud.google.com/apis/credentials)

### 2. Clone and install

```bash
git clone <your-repo-url>
cd colorado-home-search
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/migrations/001_initial_schema.sql`
3. Go to **Settings → API** and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` public key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_KEY`
4. Go to **Authentication → Providers** and enable:
   - Email/Password (enabled by default)
   - Google (requires OAuth credentials from Google Cloud Console)
5. Go to **Authentication → URL Configuration** and add:
   - `http://localhost:3000` to allowed redirect URLs (for local dev)
   - Your Netlify URL later (e.g., `https://your-app.netlify.app`)

### 4. Set up Google Maps

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Maps JavaScript API**
3. Create an API key and restrict it to your domains
4. Copy the key → `VITE_GOOGLE_MAPS_API_KEY`

### 5. Configure environment

```bash
cp .env.example .env
```

Fill in your values:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

To test Netlify Functions locally, install the Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

This runs both the Vite dev server and the serverless functions.

### 7. Make yourself admin

After signing up, run this in Supabase SQL Editor:

```sql
UPDATE public.profiles SET is_admin = true WHERE email = 'your-email@example.com';
```

## Deploy to Netlify

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Connect to Netlify

1. Go to [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect your GitHub repo
3. Build settings (should auto-detect from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`

### 3. Set environment variables

In Netlify → **Site settings → Environment variables**, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Public |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | Public |
| `SUPABASE_SERVICE_KEY` | Your service role key | **Secret** |
| `VITE_GOOGLE_MAPS_API_KEY` | Your Google Maps key | Public |
| `RAPIDAPI_KEY` | Your RapidAPI key (optional) | **Secret** |

### 4. Update Supabase redirect URLs

Add your Netlify URL to Supabase → Authentication → URL Configuration:
- `https://your-site.netlify.app`

### 5. Deploy

Netlify will auto-deploy on push to `main`. You can also trigger manual deploys from the Netlify dashboard.

## How Hourly Sync Works

The `netlify/functions/sync-listings.js` function is configured as a Netlify **Scheduled Function**:

```js
export const config = {
  schedule: '0 * * * *', // Every hour, on the hour
};
```

When it runs, it:
1. Fetches Craigslist RSS feeds for each target city (Parker, Castle Pines, Castle Rock, Highlands Ranch)
2. If a RapidAPI key is configured, queries licensed real estate APIs
3. Normalizes all listings to the database schema
4. De-duplicates by address + source
5. Detects price drops and generates alerts
6. Logs results to the `sync_log` table

You can also trigger a manual sync from the Admin settings page (requires admin role).

**Netlify limits**: Scheduled functions run up to 10 seconds on the free plan. If you need more time, upgrade to Netlify Pro (15 minutes for background functions).

## Data Sources — Compliance Details

### Automated (Compliant)

| Source | Method | Setup |
|--------|--------|-------|
| **Craigslist** | Public RSS feeds | No setup needed. Built in. |
| **Realtor.com data** | RapidAPI (licensed) | Sign up at [rapidapi.com](https://rapidapi.com), subscribe to "Realty in US" API, add key to env |

### Manual Import (All Sources)

These sources don't offer public APIs or compliant automated access:

- Zillow, Redfin, Apartments.com, Homes.com, Trulia, HotPads, Zumper, Rent.com, Avail, Facebook Marketplace

For these, use the **Add Listing** button (+ icon in header) to:
1. Paste a listing URL — we extract og:image, title, and metadata (public HTML meta tags)
2. Or enter details manually

### Future Planned

- **MLS/IDX feed** — Requires broker partnership
- **Browser extension** — One-click import from any listing page
- **Email forwarding** — Forward listing alert emails to a parser
- **CSV import** — Bulk import from spreadsheet

## Scoring System

Properties are scored 0–100 based on weighted factors:

| Factor | Default Weight | How It's Scored |
|--------|---------------|----------------|
| Dogs allowed | 15 | Confirmed > restricted > unknown > no |
| Backyard | 15 | Confirmed > inferred from lot/type > no |
| Garage | 10 | 2+ car > 1 car > unknown > no |
| Bedrooms | 10 | 5+ > 4 > 3 |
| Lot size | 15 | 0.5+ ac > 0.25+ > 0.1+ > small |
| Property type | 10 | SFH > townhome > duplex > condo > apt |
| Privacy proxy | 10 | Composite of lot, type, lot:building ratio |
| Value ($/sqft) | 10 | Lower $/sqft = higher score |
| Density | 5 | Inferred from lot size and type |

**Exclusion rules** (configurable in Settings):
- No dogs allowed → excluded
- No backyard → excluded
- No garage → excluded
- Less than 3 bedrooms → excluded

All weights and exclusion rules are adjustable per user in the Settings tab.

## Project Structure

```
colorado-home-search/
├── netlify.toml                 # Netlify build config
├── package.json                 # Dependencies and scripts
├── vite.config.js               # Vite build config
├── index.html                   # Entry HTML
├── .env.example                 # Environment variable template
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx                 # React entry
│   ├── App.jsx                  # Root component + state management
│   ├── components/
│   │   ├── AdminSettings.jsx    # Scoring weights, sync controls
│   │   ├── AlertsPanel.jsx      # Notification dropdown
│   │   ├── Auth.jsx             # Login/signup page
│   │   ├── FilterBar.jsx        # Search + filter controls
│   │   ├── ImageCarousel.jsx    # Multi-image viewer on cards
│   │   ├── Layout.jsx           # Header, tabs, navigation
│   │   ├── ManualImport.jsx     # URL paste / manual entry modal
│   │   ├── PropertyCard.jsx     # Grid + list card component
│   │   ├── PropertyDetail.jsx   # Full detail modal
│   │   ├── PropertyGrid.jsx     # Grid/list container
│   │   └── PropertyMap.jsx      # Google Maps view
│   ├── hooks/
│   │   ├── useAlerts.js         # Alert state + actions
│   │   ├── useAuth.js           # Supabase auth
│   │   └── useProperties.js     # Property CRUD + scoring
│   ├── lib/
│   │   ├── constants.js         # Config, enums, defaults
│   │   ├── scoring.js           # Match scoring engine
│   │   └── supabase.js          # Supabase client
│   └── styles/
│       └── index.css            # All styles
├── netlify/
│   └── functions/
│       ├── sync-listings.js     # Hourly scheduled sync
│       ├── manual-import.js     # Manual URL/property import
│       └── trigger-sync.js      # On-demand sync trigger
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Full DB schema
└── docs/
    └── ARCHITECTURE.md          # Technical architecture doc
```

## Extending to Home Buying

The schema and scoring engine are designed to support buying in the future:

1. Add a `listing_type` field (`rental` / `sale`) to the `properties` table
2. Add purchase-specific fields (asking price, HOA, tax assessment)
3. Extend scoring to weight purchase-specific factors
4. Add a toggle in the UI to switch between rental and purchase modes

## License

Private — for personal use.
