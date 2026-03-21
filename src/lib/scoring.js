import { DEFAULT_WEIGHTS } from './constants';

/**
 * Colorado Home Search — Match Scoring Engine
 *
 * Calculates a 0–100 match score based on configurable weights.
 * Also determines if a property should be excluded based on hard requirements.
 */

/**
 * Check if a property should be excluded based on hard requirements.
 * Returns { excluded: boolean, reasons: string[] }
 */
export function checkExclusions(property, settings = {}) {
  const reasons = [];
  const {
    exclude_no_dogs = true,
    exclude_no_backyard = true,
    exclude_no_garage = true,
    exclude_under_3br = true,
  } = settings;

  if (exclude_no_dogs && property.dogs_policy === 'not_allowed') {
    reasons.push('No dogs allowed');
  }

  if (exclude_no_backyard && property.has_backyard === false) {
    reasons.push('No backyard');
  }

  if (exclude_no_garage && property.has_garage === false) {
    reasons.push('No garage');
  }

  if (exclude_under_3br && property.bedrooms && property.bedrooms < 3) {
    reasons.push(`Only ${property.bedrooms} bedroom(s)`);
  }

  return { excluded: reasons.length > 0, reasons };
}

/**
 * Calculate match score for a property.
 * Returns { score: number, breakdown: object, inferred: string[] }
 */
export function calculateScore(property, weights = DEFAULT_WEIGHTS) {
  const breakdown = {};
  const inferred = [];
  let totalWeight = 0;
  let totalScore = 0;

  // --- Dogs Allowed ---
  const dogsWeight = weights.dogs_allowed || 15;
  totalWeight += dogsWeight;
  if (property.dogs_allowed === true || property.dogs_policy === 'allowed') {
    breakdown.dogs_allowed = { score: dogsWeight, max: dogsWeight, label: 'Dogs allowed (confirmed)' };
    totalScore += dogsWeight;
  } else if (property.dogs_policy === 'unknown' || property.dogs_policy == null) {
    const partial = Math.round(dogsWeight * 0.33);
    breakdown.dogs_allowed = { score: partial, max: dogsWeight, label: 'Dog policy unknown' };
    totalScore += partial;
    inferred.push('dogs_policy');
  } else if (property.dogs_policy === 'restricted') {
    const partial = Math.round(dogsWeight * 0.5);
    breakdown.dogs_allowed = { score: partial, max: dogsWeight, label: 'Dogs restricted' };
    totalScore += partial;
  } else {
    breakdown.dogs_allowed = { score: 0, max: dogsWeight, label: 'No dogs' };
  }

  // --- Backyard ---
  const backyardWeight = weights.backyard || 15;
  totalWeight += backyardWeight;
  if (property.has_backyard === true) {
    breakdown.backyard = { score: backyardWeight, max: backyardWeight, label: 'Backyard confirmed' };
    totalScore += backyardWeight;
  } else if (property.has_backyard == null) {
    // Infer from lot size and property type
    const inferredScore = inferBackyard(property, backyardWeight);
    breakdown.backyard = { score: inferredScore, max: backyardWeight, label: 'Backyard (estimated)' };
    totalScore += inferredScore;
    inferred.push('has_backyard');
  } else {
    breakdown.backyard = { score: 0, max: backyardWeight, label: 'No backyard' };
  }

  // --- Garage ---
  const garageWeight = weights.garage || 10;
  totalWeight += garageWeight;
  if (property.has_garage === true) {
    const spaces = property.garage_spaces || 1;
    const garageScore = spaces >= 2 ? garageWeight : Math.round(garageWeight * 0.7);
    breakdown.garage = { score: garageScore, max: garageWeight, label: `${spaces}-car garage` };
    totalScore += garageScore;
  } else if (property.has_garage == null) {
    const partial = Math.round(garageWeight * 0.3);
    breakdown.garage = { score: partial, max: garageWeight, label: 'Garage unknown' };
    totalScore += partial;
    inferred.push('has_garage');
  } else {
    breakdown.garage = { score: 0, max: garageWeight, label: 'No garage' };
  }

  // --- Bedrooms ---
  const bedsWeight = weights.bedrooms || 10;
  totalWeight += bedsWeight;
  const beds = property.bedrooms || 0;
  if (beds >= 5) {
    breakdown.bedrooms = { score: bedsWeight, max: bedsWeight, label: `${beds} bedrooms` };
    totalScore += bedsWeight;
  } else if (beds >= 4) {
    const s = Math.round(bedsWeight * 0.8);
    breakdown.bedrooms = { score: s, max: bedsWeight, label: `${beds} bedrooms` };
    totalScore += s;
  } else if (beds >= 3) {
    const s = Math.round(bedsWeight * 0.6);
    breakdown.bedrooms = { score: s, max: bedsWeight, label: `${beds} bedrooms` };
    totalScore += s;
  } else {
    breakdown.bedrooms = { score: 0, max: bedsWeight, label: `${beds || '?'} bedrooms` };
  }

  // --- Lot Size ---
  const lotWeight = weights.lot_size || 15;
  totalWeight += lotWeight;
  const lotAcres = property.lot_size_acres || (property.lot_size_sqft ? property.lot_size_sqft / 43560 : null);
  if (lotAcres != null) {
    let lotScore;
    if (lotAcres >= 0.5) {
      lotScore = lotWeight;
    } else if (lotAcres >= 0.25) {
      lotScore = Math.round(lotWeight * 0.73);
    } else if (lotAcres >= 0.1) {
      lotScore = Math.round(lotWeight * 0.47);
    } else {
      lotScore = Math.round(lotWeight * 0.2);
    }
    breakdown.lot_size = { score: lotScore, max: lotWeight, label: `${lotAcres.toFixed(2)} acres` };
    totalScore += lotScore;
  } else {
    const partial = Math.round(lotWeight * 0.2);
    breakdown.lot_size = { score: partial, max: lotWeight, label: 'Lot size unknown' };
    totalScore += partial;
    inferred.push('lot_size');
  }

  // --- Property Type ---
  const typeWeight = weights.property_type || 10;
  totalWeight += typeWeight;
  const typeScores = {
    single_family: 1.0,
    townhome: 0.5,
    duplex: 0.4,
    condo: 0.2,
    apartment: 0.15,
  };
  const typeFactor = typeScores[property.property_type] ?? 0.3;
  const typeScore = Math.round(typeWeight * typeFactor);
  breakdown.property_type = {
    score: typeScore,
    max: typeWeight,
    label: property.property_type ? property.property_type.replace('_', ' ') : 'Unknown type',
  };
  totalScore += typeScore;
  if (!property.property_type) inferred.push('property_type');

  // --- Privacy Proxy ---
  const privacyWeight = weights.privacy_proxy || 10;
  totalWeight += privacyWeight;
  const privacyScore = calculatePrivacyScore(property, privacyWeight);
  breakdown.privacy_proxy = { score: privacyScore.score, max: privacyWeight, label: privacyScore.label };
  totalScore += privacyScore.score;
  if (privacyScore.inferred) inferred.push('privacy');

  // --- Value Score ---
  const valueWeight = weights.value_score || 10;
  totalWeight += valueWeight;
  const valueScore = calculateValueScore(property, valueWeight);
  breakdown.value_score = { score: valueScore.score, max: valueWeight, label: valueScore.label };
  totalScore += valueScore.score;

  // --- Density ---
  const densityWeight = weights.density || 5;
  totalWeight += densityWeight;
  const densityScore = calculateDensityScore(property, densityWeight);
  breakdown.density = { score: densityScore.score, max: densityWeight, label: densityScore.label };
  totalScore += densityScore.score;
  if (densityScore.inferred) inferred.push('density');

  // Normalize to 0–100
  const normalizedScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

  return {
    score: Math.min(100, Math.max(0, normalizedScore)),
    breakdown,
    inferred,
  };
}

// --- Helper: Infer backyard from lot size / property type ---
function inferBackyard(property, maxWeight) {
  const lotAcres = property.lot_size_acres || (property.lot_size_sqft ? property.lot_size_sqft / 43560 : null);
  const isSFH = property.property_type === 'single_family';

  if (lotAcres && lotAcres > 0.1 && isSFH) {
    return Math.round(maxWeight * 0.6); // Likely has backyard
  }
  if (isSFH) {
    return Math.round(maxWeight * 0.4); // SFH usually has some yard
  }
  return Math.round(maxWeight * 0.15); // Low confidence
}

// --- Helper: Privacy proxy score ---
function calculatePrivacyScore(property, maxWeight) {
  let factors = 0;
  let score = 0;
  let isInferred = true;

  const lotAcres = property.lot_size_acres || (property.lot_size_sqft ? property.lot_size_sqft / 43560 : null);

  // Lot size is primary privacy signal
  if (lotAcres != null) {
    factors++;
    if (lotAcres >= 0.5) score += 0.4;
    else if (lotAcres >= 0.25) score += 0.25;
    else if (lotAcres >= 0.1) score += 0.1;
  }

  // Property type
  if (property.property_type === 'single_family') {
    factors++;
    score += 0.3;
  } else if (property.property_type === 'townhome') {
    factors++;
    score += 0.1;
  }

  // Lot-to-building ratio (if both known)
  if (lotAcres && property.sqft) {
    factors++;
    const lotSqft = lotAcres * 43560;
    const ratio = lotSqft / property.sqft;
    if (ratio > 8) score += 0.3;
    else if (ratio > 4) score += 0.2;
    else if (ratio > 2) score += 0.1;
  }

  const finalScore = factors > 0 ? Math.round(maxWeight * Math.min(1, score)) : Math.round(maxWeight * 0.2);
  const label = factors > 0 ? `Privacy score (${factors} signals)` : 'Privacy unknown';

  return { score: finalScore, label, inferred: isInferred };
}

// --- Helper: Value score (price per sqft) ---
function calculateValueScore(property, maxWeight) {
  if (!property.price || !property.sqft) {
    return { score: Math.round(maxWeight * 0.3), label: 'Value unknown' };
  }

  const pricePerSqft = property.price / property.sqft;

  // Colorado suburbs rental benchmarks (rough $/sqft/month)
  // $1–1.5/sqft is good value, $1.5–2 is average, $2+ is premium
  if (pricePerSqft <= 1.0) {
    return { score: maxWeight, label: `Great value ($${pricePerSqft.toFixed(2)}/sqft)` };
  }
  if (pricePerSqft <= 1.5) {
    return { score: Math.round(maxWeight * 0.7), label: `Good value ($${pricePerSqft.toFixed(2)}/sqft)` };
  }
  if (pricePerSqft <= 2.0) {
    return { score: Math.round(maxWeight * 0.4), label: `Average value ($${pricePerSqft.toFixed(2)}/sqft)` };
  }
  return { score: Math.round(maxWeight * 0.15), label: `Premium ($${pricePerSqft.toFixed(2)}/sqft)` };
}

// --- Helper: Density score ---
function calculateDensityScore(property, maxWeight) {
  // Infer density from property type and lot size
  const lotAcres = property.lot_size_acres || (property.lot_size_sqft ? property.lot_size_sqft / 43560 : null);
  const type = property.property_type;

  if (type === 'apartment' || type === 'condo') {
    return { score: Math.round(maxWeight * 0.1), label: 'High density', inferred: true };
  }

  if (lotAcres && lotAcres >= 0.5) {
    return { score: maxWeight, label: 'Low density (large lot)', inferred: true };
  }
  if (lotAcres && lotAcres >= 0.25) {
    return { score: Math.round(maxWeight * 0.7), label: 'Moderate density', inferred: true };
  }
  if (type === 'single_family') {
    return { score: Math.round(maxWeight * 0.5), label: 'Typical suburban density', inferred: true };
  }
  if (type === 'townhome') {
    return { score: Math.round(maxWeight * 0.3), label: 'Townhome density', inferred: true };
  }

  return { score: Math.round(maxWeight * 0.3), label: 'Density unknown', inferred: true };
}

/**
 * Sort properties by score, with excluded ones at the end.
 */
export function rankProperties(properties, weights, exclusionSettings) {
  return properties
    .map((p) => {
      const exclusion = checkExclusions(p, exclusionSettings);
      const scoring = exclusion.excluded
        ? { score: 0, breakdown: {}, inferred: [] }
        : calculateScore(p, weights);
      return {
        ...p,
        match_score: scoring.score,
        score_breakdown: scoring.breakdown,
        inferred_fields: scoring.inferred,
        _excluded: exclusion.excluded,
        _exclusion_reasons: exclusion.reasons,
      };
    })
    .sort((a, b) => {
      if (a._excluded && !b._excluded) return 1;
      if (!a._excluded && b._excluded) return -1;
      return b.match_score - a.match_score;
    });
}
