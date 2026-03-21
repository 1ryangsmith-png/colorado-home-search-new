# Colorado Home Search — Architecture & Technical Documentation

## Stack Decision

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React 18 + Vite | Fastest, most stable Netlify deployment. No SSR adapter quirks. |
| Styling | CSS Modules + custom properties | Zero runtime cost, easy theming, no build deps. |
| Backend | Netlify Functions (serverless) | Native Netlify integration, automatic scaling, scheduled functions for hourly sync. |
| Database | Supabase (PostgreSQL) | Free tier: 500MB DB, 1GB storage, 50k auth MAU. Row-level security, realtime subscriptions, built-in auth. |
| Auth | Supabase Auth | Google + email/password login. Integrates with RLS policies. |
| Maps | Google Maps (via @vis.gl/react-google-maps) | Street View for future use, reliable geocoding. |
| Deployment | Netlify | Static SPA + serverless functions + scheduled functions. |

---

## Compliant Data Ingestion Strategy

### Tier 1 — Compliant Automated Sources

| Source | Method | Status | Notes |
|--------|--------|--------|-------|
| **Craigslist** | Public RSS feeds | ✅ Ready | Craigslist publishes RSS feeds for search results. We build search URLs for each target city and parse the XML feed. Fully compliant. |
| **RapidAPI Real Estate APIs** | Licensed API | ✅ Ready (paid) | Several licensed APIs aggregate Zillow/Redfin/Realtor.com data legally. User provides their own API key. We support `realty-in-us` (Realtor.com data) and `zillow-com1` endpoints. |

### Tier 2 — Manual Import (Always Available)

| Source | Method | Notes |
|--------|--------|-------|
| **Zillow** | Manual URL paste | Zillow's Terms prohibit scraping. No public API. User pastes listing URLs; we extract what we can from meta tags or user fills in fields. |
| **Redfin** | Manual URL paste | Same as Zillow. No public API. |
| **Apartments.com** | Manual URL paste | No public API or feeds. |
| **Homes.com** | Manual URL paste | No public API. |
| **Trulia** | Manual URL paste | Owned by Zillow Group, same restrictions. |
| **HotPads** | Manual URL paste | Owned by Zillow Group. |
| **Zumper** | Manual URL paste | API is private/partner-only. |
| **Rent.com** | Manual URL paste | No public API. |
| **Avail** | Manual URL paste | Landlord platform, no consumer listing API. |
| **Facebook Marketplace** | Manual entry | No API. Cannot be automated compliantly. |

### Tier 3 — Future / Requires Licensing

| Source | Method | Notes |
|--------|--------|-------|
| **MLS/RETS Feed** | Licensed data feed | Requires broker partnership or IDX license. Most comprehensive data. Phase 2+. |
| **Zillow API (partner)** | Zillow Partner API | Requires business application to Zillow. If approved, would enable direct access. |

### Fallback Strategy

For every source that cannot be automated:
1. **Manual Import** — User pastes a URL, system creates a listing with source link
2. **Browser Extension** (Phase 2) — One-click import from any listing page
3. **Email Forwarding** (Phase 2) — Forward listing emails to a parsing endpoint
4. **CSV Import** — Bulk import from spreadsheet

---

## Database Schema

See `supabase/migrations/001_initial_schema.sql` for the full schema.

### Core Tables

- **profiles** — User profile extending Supabase auth
- **properties** — All listing data, images, scores, source info
- **user_properties** — Per-user favorites, hidden, notes, tags
- **scoring_weights** — Configurable scoring parameters per user
- **source_config** — Toggle sources on/off, API keys, refresh settings
- **sync_log** — Audit trail for automated sync jobs
- **alerts** — Price drop, new listing, and status change alerts

---

## Match Scoring Logic

### Required Filters (Exclusion)
Properties are **excluded** if ANY of these fail:
- Dogs not allowed → EXCLUDE
- No backyard / no outdoor space → EXCLUDE
- No garage → EXCLUDE
- Fewer than 3 bedrooms → EXCLUDE

### Scoring Weights (Default, Adjustable in Admin)

| Factor | Default Weight | Max Points | Scoring Method |
|--------|---------------|------------|----------------|
| Dogs explicitly allowed | 15 | 15 | Binary: confirmed = 15, unknown = 5 |
| Backyard confirmed | 15 | 15 | Binary: confirmed = 15, unknown = 5 |
| Garage confirmed | 10 | 10 | Binary: 1-car = 7, 2+ car = 10 |
| Bedrooms | 10 | 10 | 3BR = 6, 4BR = 8, 5+ = 10 |
| Lot size | 15 | 15 | Scaled: <0.1ac = 3, 0.1-0.25 = 7, 0.25-0.5 = 11, 0.5+ = 15 |
| Property type | 10 | 10 | Detached SFH = 10, Townhome = 5, Condo/Apt = 2 |
| Privacy proxy | 10 | 10 | Composite of lot size + property type + density |
| Value score | 10 | 10 | Price per sqft relative to area median |
| Neighborhood density | 5 | 5 | Inferred from lot size and property type |

**Total possible: 100 points**

### Privacy/Spacing Proxy Logic

Since listings rarely say "far from neighbors," we infer spacing from:
1. **Lot size** — Larger lot = more space (primary signal)
2. **Property type** — SFH > townhome > condo
3. **Lot-to-building ratio** — If lot size and sqft are known, ratio indicates yard/spacing
4. **Subdivision context** — If neighborhood is known, we can flag high-density subdivisions
5. **Labeled as inferred** — All proxy values show "(estimated)" in the UI

---

## Image Strategy

### Priority Order
1. **Direct image URLs** from compliant API sources (RapidAPI, RSS)
2. **Open Graph / meta tag images** from listing URLs (og:image is public metadata)
3. **User-uploaded photos** via manual import
4. **Google Street View** as fallback (using Maps Static API)
5. **Placeholder** with "View on [Source]" link

### Implementation
- Images stored as JSON array of URLs in the `images` column
- Lazy loading via `loading="lazy"` on all `<img>` tags
- Responsive sizing with `srcset` where source provides multiple sizes
- CSS aspect-ratio containers prevent layout shift
- Carousel component for multi-image browsing on cards
- Full-screen gallery in detail view

---

## Hourly Sync on Netlify

Netlify supports **Scheduled Functions** using cron syntax.

```js
// netlify/functions/sync-listings.js
export const config = {
  schedule: "@hourly"  // or "0 * * * *"
};
```

### Sync Flow
1. Scheduled function fires every hour
2. Reads enabled sources from `source_config` table
3. For each enabled automated source:
   a. Fetches new listings
   b. Normalizes data to our schema
   c. De-duplicates against existing properties (by address + source)
   d. Calculates match score
   e. Inserts/updates in database
4. Generates alerts for new listings, price drops, status changes
5. Logs sync results to `sync_log`

### Netlify Function Limits
- Execution: 10 seconds (regular), 15 minutes (background)
- We use background functions for sync to allow enough time
- If sync takes too long, we batch by source

---

## UI/UX Structure

### Navigation
- **Search** — Main grid/list view with filters
- **Map** — Google Maps with property pins
- **Favorites** — Saved listings
- **New** — Listings added in last 48 hours
- **Price Drops** — Listings with recent price reductions
- **Hidden** — Rejected/hidden listings
- **Admin** — Settings, weights, sources, manual import

### Property Card
- Hero image with carousel dots
- Price (prominent)
- Address + city
- Beds / Baths / Sqft / Lot size
- Match score badge (color-coded)
- Source badge
- Quick actions: favorite, hide, open source
- Dog/garage/backyard indicator icons

### Views
- Grid (default, 3 columns desktop)
- List (compact rows)
- Map (pins with mini-cards)
- Comparison (side-by-side selected properties)

---

## MVP vs Phase 2

### MVP (This Build)
- ✅ Supabase database + auth
- ✅ Property grid with image cards
- ✅ Carousel/gallery on cards
- ✅ Match scoring with configurable weights
- ✅ Filter bar (price, beds, city, property type)
- ✅ Favorites / hide / notes
- ✅ Manual import (paste URL or enter details)
- ✅ Craigslist RSS auto-sync
- ✅ RapidAPI integration framework
- ✅ Google Maps view
- ✅ Admin settings (weights, sources)
- ✅ New listings + price drops tabs
- ✅ Mobile responsive
- ✅ Netlify deployment ready

### Phase 2
- Browser extension for one-click import
- Email forwarding parser
- CSV bulk import
- Push notifications (web push / email)
- MLS/IDX feed integration
- Street View integration on cards
- Neighborhood analytics (schools, crime, walkability)
- Comparison view (side-by-side)
- Saved search alerts
- Home buying mode (extend beyond rentals)
- Collaborative features (share with partner/family)

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```
VITE_SUPABASE_URL=         # Supabase project URL
VITE_SUPABASE_ANON_KEY=    # Supabase anon/public key
VITE_GOOGLE_MAPS_API_KEY=  # Google Maps JavaScript API key
SUPABASE_SERVICE_KEY=       # Supabase service role key (serverless only)
RAPIDAPI_KEY=               # RapidAPI key (optional, for licensed APIs)
```

`VITE_` prefixed variables are exposed to the frontend (safe/public keys only).
Non-prefixed variables are only available in Netlify Functions (secrets).
