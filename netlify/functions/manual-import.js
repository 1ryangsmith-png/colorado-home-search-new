import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Manual Import endpoint
 * Accepts a listing URL or manual property data and adds it to the database.
 *
 * POST /api/manual-import
 * Body: { url?: string, property?: object, user_id: string }
 */
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { url, property, user_id } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let listing;

    if (url) {
      // Try to extract metadata from the URL
      listing = await extractFromURL(url);
    } else if (property) {
      // Direct property data
      listing = {
        ...property,
        source: property.source || 'manual',
        source_url: property.source_url || url,
      };
    } else {
      return new Response(JSON.stringify({ error: 'Provide a URL or property data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure required fields
    if (!listing.address || !listing.city) {
      return new Response(
        JSON.stringify({
          error: 'Address and city are required',
          partial: listing,
          message: 'We could not fully parse this URL. Please fill in the missing fields manually.',
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert into database
    const { data, error } = await supabase
      .from('properties')
      .insert({
        ...listing,
        status: 'active',
        date_posted: listing.date_posted || new Date().toISOString(),
        date_updated: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'This property already exists', code: 'DUPLICATE' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(JSON.stringify({ success: true, property: data }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ManualImport] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Extract metadata from a listing URL using public meta tags.
 * This only reads og: tags and structured data that the site
 * publicly exposes in HTML <head> — not scraping page content.
 */
async function extractFromURL(url) {
  const source = detectSource(url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ColoradoHomeSearch/1.0)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        source,
        source_url: url,
        address: '',
        city: '',
        state: 'CO',
        raw_data: { parse_error: `HTTP ${response.status}` },
      };
    }

    const html = await response.text();
    // Only extract from <head> meta tags — public metadata, not page scraping
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const head = headMatch ? headMatch[1] : html.substring(0, 5000);

    const meta = extractMetaTags(head);

    // Try to parse address from og:title or og:description
    const title = meta['og:title'] || meta['title'] || '';
    const description = meta['og:description'] || meta['description'] || '';
    const image = meta['og:image'] || '';

    // Parse price from title/description
    const priceMatch = (title + ' ' + description).match(/\$([0-9,]+)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

    // Parse bedrooms
    const bedsMatch = (title + ' ' + description).match(/(\d+)\s*(?:bed|br|bedroom)/i);
    const bedrooms = bedsMatch ? parseInt(bedsMatch[1]) : null;

    // Parse bathrooms
    const bathsMatch = (title + ' ' + description).match(/(\d+\.?\d*)\s*(?:bath|ba|bathroom)/i);
    const bathrooms = bathsMatch ? parseFloat(bathsMatch[1]) : null;

    // Parse sqft
    const sqftMatch = (title + ' ' + description).match(/([0-9,]+)\s*(?:sq\s*ft|sqft|square\s*feet)/i);
    const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : null;

    // Try to extract city from Colorado suburbs
    const cityMatch = (title + ' ' + description).match(/(?:Parker|Castle Pines|Castle Rock|Highlands Ranch)/i);
    const city = cityMatch ? cityMatch[0] : '';

    return {
      address: title.split(/[|–—,]/, 1)[0].trim().substring(0, 200),
      city,
      state: 'CO',
      price,
      bedrooms,
      bathrooms,
      sqft,
      images: image ? [{ url: image, source }] : [],
      thumbnail_url: image || null,
      source,
      source_url: url,
      source_listing_id: url,
      raw_data: { title, description: description.substring(0, 300) },
    };
  } catch (err) {
    console.warn('[ExtractURL] Failed:', err.message);
    return {
      source,
      source_url: url,
      address: '',
      city: '',
      state: 'CO',
      raw_data: { parse_error: err.message },
    };
  }
}

function extractMetaTags(head) {
  const meta = {};
  const tagRegex = /<meta\s+(?:[^>]*?\b(?:property|name)\s*=\s*"([^"]*)"[^>]*?\bcontent\s*=\s*"([^"]*)"[^>]*?|[^>]*?\bcontent\s*=\s*"([^"]*)"[^>]*?\b(?:property|name)\s*=\s*"([^"]*)"[^>]*?)\/?>/gi;
  let match;
  while ((match = tagRegex.exec(head)) !== null) {
    const key = match[1] || match[4];
    const value = match[2] || match[3];
    if (key && value) meta[key] = value;
  }

  // Also get <title>
  const titleMatch = head.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) meta['title'] = titleMatch[1].trim();

  return meta;
}

function detectSource(url) {
  const domain = url.toLowerCase();
  if (domain.includes('zillow.com')) return 'zillow';
  if (domain.includes('redfin.com')) return 'redfin';
  if (domain.includes('craigslist.org')) return 'craigslist';
  if (domain.includes('apartments.com')) return 'apartments_com';
  if (domain.includes('realtor.com')) return 'rapidapi_realtor';
  if (domain.includes('homes.com')) return 'homes_com';
  if (domain.includes('trulia.com')) return 'trulia';
  if (domain.includes('hotpads.com')) return 'hotpads';
  if (domain.includes('zumper.com')) return 'zumper';
  if (domain.includes('rent.com')) return 'rent_com';
  if (domain.includes('avail.co')) return 'avail';
  if (domain.includes('facebook.com')) return 'facebook';
  return 'manual';
}
