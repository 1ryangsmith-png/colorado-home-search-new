import { createClient } from '@supabase/supabase-js';

// Netlify Scheduled Function — runs every hour
export const config = {
  schedule: '0 * * * *', // Every hour
};

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Target search areas
const COLORADO_SEARCHES = [
  { city: 'Parker', region: 'denver' },
  { city: 'Castle Pines', region: 'denver' },
  { city: 'Castle Rock', region: 'denver' },
  { city: 'Highlands Ranch', region: 'denver' },
];

/**
 * Main sync handler
 */
export default async function handler(req) {
  const startTime = Date.now();
  console.log('[Sync] Starting hourly listing sync...');

  const results = {
    sources: {},
    totalNew: 0,
    totalUpdated: 0,
    errors: [],
  };

  try {
    // 1. Sync Craigslist RSS feeds
    try {
      const craigslistResults = await syncCraigslist();
      results.sources.craigslist = craigslistResults;
      results.totalNew += craigslistResults.new;
      results.totalUpdated += craigslistResults.updated;
    } catch (err) {
      console.error('[Sync] Craigslist error:', err.message);
      results.errors.push({ source: 'craigslist', error: err.message });
    }

    // 2. Sync RapidAPI sources (if key is configured)
    if (process.env.RAPIDAPI_KEY) {
      try {
        const rapidResults = await syncRapidAPI();
        results.sources.rapidapi = rapidResults;
        results.totalNew += rapidResults.new;
        results.totalUpdated += rapidResults.updated;
      } catch (err) {
        console.error('[Sync] RapidAPI error:', err.message);
        results.errors.push({ source: 'rapidapi', error: err.message });
      }
    }

    // 3. Check for price drops on existing listings
    await checkPriceDrops();

    // 4. Generate alerts for new listings
    await generateNewListingAlerts(results.totalNew);

  } catch (err) {
    console.error('[Sync] Fatal error:', err);
    results.errors.push({ source: 'general', error: err.message });
  }

  // Log sync results
  const duration = Date.now() - startTime;
  await supabase.from('sync_log').insert({
    source: 'all',
    status: results.errors.length > 0 ? 'partial' : 'success',
    listings_found: results.totalNew + results.totalUpdated,
    listings_new: results.totalNew,
    listings_updated: results.totalUpdated,
    error_message: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
    duration_ms: duration,
  });

  console.log(`[Sync] Complete in ${duration}ms. New: ${results.totalNew}, Updated: ${results.totalUpdated}`);

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Sync Craigslist RSS feeds
 * Craigslist provides public RSS feeds for search results — fully compliant.
 */
async function syncCraigslist() {
  let newCount = 0;
  let updatedCount = 0;

  for (const search of COLORADO_SEARCHES) {
    // Craigslist RSS URL for housing in Denver region, filtered to city
    // apa = apartments, hou = housing, sub = sublets
    const feedUrl = `https://${search.region}.craigslist.org/search/apa?format=rss&query=${encodeURIComponent(search.city + ' CO')}&min_bedrooms=3&pets_dog=1&hasPic=1`;

    try {
      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': 'ColoradoHomeSearch/1.0 (RSS Reader)' },
      });

      if (!response.ok) {
        console.warn(`[Craigslist] Failed to fetch ${search.city}: ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const listings = parseCraigslistRSS(xml, search.city);

      for (const listing of listings) {
        const result = await upsertProperty(listing);
        if (result === 'new') newCount++;
        else if (result === 'updated') updatedCount++;
      }
    } catch (err) {
      console.warn(`[Craigslist] Error for ${search.city}:`, err.message);
    }
  }

  return { new: newCount, updated: updatedCount, source: 'craigslist' };
}

/**
 * Parse Craigslist RSS XML into normalized listing objects
 */
function parseCraigslistRSS(xml, city) {
  const listings = [];
  // Simple XML parsing without external deps
  const items = xml.split('<item>').slice(1);

  for (const item of items) {
    try {
      const title = extractXML(item, 'title');
      const link = extractXML(item, 'link');
      const description = extractXML(item, 'description');
      const date = extractXML(item, 'dc:date') || extractXML(item, 'pubDate');

      // Extract price from title (e.g., "$2,500 / 3br - 1800ft² - Nice house")
      const priceMatch = title.match(/\$([0-9,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

      const bedsMatch = title.match(/(\d+)br/);
      const bedrooms = bedsMatch ? parseInt(bedsMatch[1]) : null;

      const sqftMatch = title.match(/(\d+)ft/);
      const sqft = sqftMatch ? parseInt(sqftMatch[1]) : null;

      // Extract image from description (Craigslist includes images in RSS)
      const imgMatch = description?.match(/<img[^>]+src="([^"]+)"/);
      const imageUrl = imgMatch ? imgMatch[1] : null;

      // Extract address from description if present
      const addressText = extractAddressFromText(title + ' ' + (description || ''), city);

      listings.push({
        address: addressText || title.substring(0, 100),
        city: city,
        state: 'CO',
        price,
        bedrooms,
        sqft,
        property_type: inferPropertyType(title + ' ' + (description || '')),
        dogs_allowed: true, // We filtered for pets_dog=1
        dogs_policy: 'allowed',
        has_backyard: inferHasBackyard(title + ' ' + (description || '')),
        has_garage: inferHasGarage(title + ' ' + (description || '')),
        images: imageUrl ? [{ url: imageUrl, source: 'craigslist' }] : [],
        thumbnail_url: imageUrl,
        source: 'craigslist',
        source_url: link,
        source_listing_id: link,
        date_posted: date ? new Date(date).toISOString() : new Date().toISOString(),
        raw_data: { title, description: description?.substring(0, 500) },
      });
    } catch (err) {
      console.warn('[Craigslist] Failed to parse item:', err.message);
    }
  }

  return listings;
}

/**
 * Sync from RapidAPI real estate endpoints (licensed data)
 */
async function syncRapidAPI() {
  let newCount = 0;
  let updatedCount = 0;

  const cities = [
    { city: 'Parker', state_code: 'CO' },
    { city: 'Castle Pines', state_code: 'CO' },
    { city: 'Castle Rock', state_code: 'CO' },
    { city: 'Highlands Ranch', state_code: 'CO' },
  ];

  for (const loc of cities) {
    try {
      // Using realty-in-us API — POST /properties/v3/list with JSON body
      const response = await fetch(
        'https://realty-in-us.p.rapidapi.com/properties/v3/list',
        {
          method: 'POST',
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'realty-in-us.p.rapidapi.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            limit: 50,
            offset: 0,
            city: loc.city,
            state_code: loc.state_code,
            status: ['for_rent'],
            beds: { min: 3 },
            sort: { direction: 'desc', field: 'list_date' },
          }),
        }
      );

      if (!response.ok) {
        console.warn(`[RapidAPI] Failed for ${loc.city}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const properties = data?.data?.home_search?.results || [];

      for (const prop of properties) {
        try {
          const listing = normalizeRapidAPIListing(prop, loc.city);
          if (listing) {
            const result = await upsertProperty(listing);
            if (result === 'new') newCount++;
            else if (result === 'updated') updatedCount++;
          }
        } catch (err) {
          console.warn('[RapidAPI] Failed to process listing:', err.message);
        }
      }
    } catch (err) {
      console.warn(`[RapidAPI] Error for ${loc.city}:`, err.message);
    }
  }

  return { new: newCount, updated: updatedCount, source: 'rapidapi' };
}

/**
 * Normalize a RapidAPI/Realtor.com listing to our schema
 */
function normalizeRapidAPIListing(prop, city) {
  const location = prop.location || {};
  const address = location.address || {};
  const description = prop.description || {};

  // Fix: correctly extract photos array (operator precedence bug previously caused only 1 photo)
  const photoArr = Array.isArray(prop.photos) && prop.photos.length > 0
    ? prop.photos
    : prop.primary_photo
    ? [prop.primary_photo]
    : [];

  // Pull description text from multiple possible fields
  const descriptionText = prop.description?.text
    || prop.text
    || (prop.tags?.length > 0 ? prop.tags.join(' · ') : null)
    || null;

  // Infer dog policy from tags
  const tags = prop.tags || [];
  const tagStr = tags.join(' ').toLowerCase();
  let dogs_policy = 'unknown';
  if (tagStr.includes('pet') || tagStr.includes('dog')) dogs_policy = 'allowed';
  if (tagStr.includes('no pet') || tagStr.includes('no dog')) dogs_policy = 'not_allowed';

  // Infer backyard/garage from tags and lot
  const hasBackyard = tagStr.includes('yard') || tagStr.includes('backyard') || tagStr.includes('fenced')
    ? true
    : (description.lot_sqft && description.lot_sqft > 3000 ? true : null);

  const hasGarage = description.garage > 0
    ? true
    : tagStr.includes('garage') ? true : null;

  return {
    address: `${address.line || ''}, ${address.city || city}, ${address.state_code || 'CO'} ${address.postal_code || ''}`.trim(),
    city: address.city || city,
    state: 'CO',
    zip: address.postal_code,
    neighborhood: address.neighborhood_name,
    latitude: address.coordinate?.lat,
    longitude: address.coordinate?.lon,
    price: prop.list_price || description.rent,
    bedrooms: description.beds,
    bathrooms: description.baths,
    sqft: description.sqft,
    lot_size_sqft: description.lot_sqft,
    lot_size_acres: description.lot_sqft ? parseFloat((description.lot_sqft / 43560).toFixed(3)) : null,
    year_built: description.year_built,
    property_type: mapPropertyType(description.type),
    description: descriptionText,
    dogs_allowed: dogs_policy === 'allowed',
    dogs_policy,
    has_backyard: hasBackyard,
    has_garage: hasGarage,
    garage_spaces: description.garage || null,
    images: photoArr.slice(0, 15).map((p) => ({
      url: p.href,
      source: 'realtor.com',
    })),
    thumbnail_url: photoArr[0]?.href || null,
    source: 'rapidapi_realtor',
    source_url: prop.permalink
      ? `https://www.realtor.com/realestateandhomes-detail/${prop.permalink}`
      : prop.href
      ? (prop.href.startsWith('http') ? prop.href : `https://www.realtor.com${prop.href}`)
      : null,
    source_listing_id: prop.property_id,
    date_posted: prop.list_date ? new Date(prop.list_date).toISOString() : null,
    raw_data: {
      property_id: prop.property_id,
      type: description.type,
      tags: prop.tags || [],
      photo_count: photoArr.length,
    },
  };
}

/**
 * Upsert a property into the database with dedup
 */
async function upsertProperty(listing) {
  // Check for existing by source + source_listing_id
  const { data: existing } = await supabase
    .from('properties')
    .select('id, price, status')
    .eq('source', listing.source)
    .eq('source_listing_id', listing.source_listing_id)
    .single();

  if (existing) {
    // Update if price changed
    if (listing.price && existing.price && listing.price !== parseFloat(existing.price)) {
      await supabase
        .from('properties')
        .update({
          price_previous: existing.price,
          price: listing.price,
          is_price_drop: listing.price < parseFloat(existing.price),
          date_updated: new Date().toISOString(),
          images: listing.images,
          thumbnail_url: listing.thumbnail_url,
        })
        .eq('id', existing.id);
      return 'updated';
    }
    return 'exists';
  }

  // Insert new
  const { error } = await supabase.from('properties').insert({
    ...listing,
    status: 'active',
    date_updated: new Date().toISOString(),
  });

  if (error) {
    // Might be a duplicate address from another source — that's fine
    if (error.code === '23505') return 'duplicate';
    console.warn('[Upsert] Insert error:', error.message);
    return 'error';
  }

  return 'new';
}

/**
 * Check existing listings for price drops
 */
async function checkPriceDrops() {
  // Reset is_price_drop for old drops (older than 7 days)
  await supabase
    .from('properties')
    .update({ is_price_drop: false })
    .eq('is_price_drop', true)
    .lt('date_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
}

/**
 * Generate alerts for new listings
 */
async function generateNewListingAlerts(newCount) {
  if (newCount === 0) return;

  // Get all users
  const { data: users } = await supabase.from('profiles').select('id');
  if (!users?.length) return;

  // Get new listings from this hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: newListings } = await supabase
    .from('properties')
    .select('id, address, city, price')
    .gte('created_at', oneHourAgo)
    .eq('status', 'active')
    .limit(20);

  if (!newListings?.length) return;

  // Create alerts for each user
  const alerts = [];
  for (const user of users) {
    for (const listing of newListings) {
      alerts.push({
        user_id: user.id,
        property_id: listing.id,
        alert_type: 'new_listing',
        message: `New listing: ${listing.address}, ${listing.city} — $${listing.price?.toLocaleString() || 'N/A'}`,
      });
    }
  }

  if (alerts.length > 0) {
    await supabase.from('alerts').insert(alerts);
  }
}

// --- Utility functions ---

function extractXML(text, tag) {
  const match = text.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return match ? match[1].trim() : '';
}

function extractAddressFromText(text, city) {
  // Try to find street address pattern
  const match = text.match(/\d+\s+[\w\s]+(?:St|Ave|Blvd|Dr|Ln|Rd|Ct|Cir|Pl|Way|Trail|Loop)/i);
  return match ? match[0] : null;
}

function inferPropertyType(text) {
  const lower = text.toLowerCase();
  if (lower.includes('house') || lower.includes('single family') || lower.includes('sfh')) return 'single_family';
  if (lower.includes('townhome') || lower.includes('townhouse') || lower.includes('town home')) return 'townhome';
  if (lower.includes('condo')) return 'condo';
  if (lower.includes('duplex')) return 'duplex';
  if (lower.includes('apartment') || lower.includes('apt')) return 'apartment';
  return null;
}

function inferHasBackyard(text) {
  const lower = text.toLowerCase();
  if (lower.includes('backyard') || lower.includes('back yard') || lower.includes('fenced yard') || lower.includes('large yard')) return true;
  if (lower.includes('no yard') || lower.includes('no outdoor')) return false;
  return null; // Unknown
}

function inferHasGarage(text) {
  const lower = text.toLowerCase();
  if (lower.includes('garage') || lower.includes('car garage')) return true;
  if (lower.includes('no garage') || lower.includes('street parking only')) return false;
  return null;
}

function mapPropertyType(apiType) {
  const map = {
    single_family: 'single_family',
    townhomes: 'townhome',
    condos: 'condo',
    apartments: 'apartment',
    multi_family: 'duplex',
  };
  return map[apiType] || 'other';
}
