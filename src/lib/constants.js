// Target cities for search
export const TARGET_CITIES = [
  'Parker',
  'Castle Pines',
  'Castle Rock',
  'Highlands Ranch',
];

// Map center (roughly between all target cities)
export const DEFAULT_MAP_CENTER = {
  lat: parseFloat(import.meta.env.VITE_DEFAULT_LAT) || 39.5186,
  lng: parseFloat(import.meta.env.VITE_DEFAULT_LNG) || -104.7614,
};
export const DEFAULT_MAP_ZOOM = parseInt(import.meta.env.VITE_DEFAULT_ZOOM) || 11;

// Property types
export const PROPERTY_TYPES = {
  single_family: 'Single Family Home',
  townhome: 'Townhome',
  condo: 'Condo',
  apartment: 'Apartment',
  duplex: 'Duplex',
  other: 'Other',
};

// Dog policies
export const DOG_POLICIES = {
  allowed: 'Dogs Allowed',
  restricted: 'Dogs Restricted (breed/size limits)',
  not_allowed: 'No Dogs',
  unknown: 'Unknown',
};

// Listing sources
export const SOURCES = {
  craigslist: { name: 'Craigslist', color: '#5a0e99', automated: true },
  rapidapi_realtor: { name: 'Realtor.com (API)', color: '#d92228', automated: true },
  rapidapi_zillow: { name: 'Zillow (API)', color: '#006aff', automated: true },
  zillow: { name: 'Zillow', color: '#006aff', automated: false },
  redfin: { name: 'Redfin', color: '#a02021', automated: false },
  apartments_com: { name: 'Apartments.com', color: '#6b46c1', automated: false },
  homes_com: { name: 'Homes.com', color: '#0ea5e9', automated: false },
  trulia: { name: 'Trulia', color: '#3cb589', automated: false },
  hotpads: { name: 'HotPads', color: '#fd5631', automated: false },
  zumper: { name: 'Zumper', color: '#2dbe60', automated: false },
  rent_com: { name: 'Rent.com', color: '#f97316', automated: false },
  avail: { name: 'Avail', color: '#10b981', automated: false },
  facebook: { name: 'Facebook', color: '#1877f2', automated: false },
  manual: { name: 'Manual Entry', color: '#6b7280', automated: false },
};

// Default scoring weights
export const DEFAULT_WEIGHTS = {
  dogs_allowed: 15,
  backyard: 15,
  garage: 10,
  bedrooms: 10,
  lot_size: 15,
  property_type: 10,
  privacy_proxy: 10,
  value_score: 10,
  density: 5,
};

// Score color thresholds
export const SCORE_COLORS = {
  excellent: { min: 80, color: '#059669', label: 'Excellent Match' },
  good: { min: 60, color: '#2563eb', label: 'Good Match' },
  fair: { min: 40, color: '#d97706', label: 'Fair Match' },
  poor: { min: 0, color: '#9ca3af', label: 'Low Match' },
};

export function getScoreColor(score) {
  if (score >= SCORE_COLORS.excellent.min) return SCORE_COLORS.excellent;
  if (score >= SCORE_COLORS.good.min) return SCORE_COLORS.good;
  if (score >= SCORE_COLORS.fair.min) return SCORE_COLORS.fair;
  return SCORE_COLORS.poor;
}

// View modes
export const VIEW_MODES = {
  GRID: 'grid',
  LIST: 'list',
  MAP: 'map',
};

// Tabs
export const TABS = {
  SEARCH: 'search',
  FAVORITES: 'favorites',
  NEW: 'new',
  PRICE_DROPS: 'price_drops',
  HIDDEN: 'hidden',
  ADMIN: 'admin',
};

// Placeholder image
export const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
  '<rect width="400" height="300" fill="#f3f4f6"/>' +
  '<text x="200" y="140" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="16">No Image Available</text>' +
  '<text x="200" y="165" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="13">View on source site</text>' +
  '<path d="M185 100h30l5 8h15a5 5 0 015 5v40a5 5 0 01-5 5h-60a5 5 0 01-5-5v-40a5 5 0 015-5h10z" fill="none" stroke="#d1d5db" stroke-width="2"/>' +
  '<circle cx="200" cy="130" r="12" fill="none" stroke="#d1d5db" stroke-width="2"/>' +
  '</svg>'
);
