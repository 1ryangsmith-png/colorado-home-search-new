import { useState } from 'react';
import { getScoreColor, SOURCES, PROPERTY_TYPES, DOG_POLICIES } from '../lib/constants';

export default function PropertyDetail({
  property,
  userProperty,
  onClose,
  onToggleFavorite,
  onToggleHidden,
  onUpdateNotes,
}) {
  const [notes, setNotes] = useState(userProperty?.notes || '');
  const [notesChanged, setNotesChanged] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const safeScore = isNaN(property.match_score) ? 0 : (property.match_score || 0);
  const scoreInfo = getScoreColor(safeScore);
  const source = SOURCES[property.source] || SOURCES.manual;
  const isFavorite = userProperty?.is_favorite;

  const images = Array.isArray(property.images)
    ? property.images
    : typeof property.images === 'string'
    ? JSON.parse(property.images || '[]')
    : [];

  const tags = property.raw_data?.tags || [];
  const breakdown = property.score_breakdown || {};

  const saveNotes = () => {
    onUpdateNotes(notes);
    setNotesChanged(false);
  };

  const descText = property.description || '';
  const descShort = descText.length > 400;
  const displayDesc = descExpanded ? descText : descText.slice(0, 400);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content property-detail-v2" onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <button className="detail-close-btn" onClick={onClose}>✕</button>

        {/* ── Photo Grid ── */}
        <div className="detail-photo-grid">
          {/* Hero photo */}
          <div className="detail-photo-hero" onClick={() => images.length > 0 && setLightboxIndex(0)}>
            {images[0] ? (
              <img src={images[0].url} alt={property.address} />
            ) : (
              <div className="photo-placeholder">🏠<span>No photos</span></div>
            )}
          </div>

          {/* Side thumbnails */}
          <div className="detail-photo-thumbs">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="detail-photo-thumb" onClick={() => images[i] && setLightboxIndex(i)}>
                {images[i] ? (
                  <img src={images[i].url} alt={`Photo ${i + 1}`} />
                ) : (
                  <div className="thumb-empty" />
                )}
              </div>
            ))}
          </div>

          {/* All photos button */}
          {images.length > 1 && (
            <button className="all-photos-btn" onClick={() => setLightboxIndex(0)}>
              🖼 All {images.length} photos
            </button>
          )}
        </div>

        {/* ── Main Content ── */}
        <div className="detail-main">

          {/* Price + Score row */}
          <div className="detail-price-score">
            <div className="detail-price-big">
              {property.price ? `$${Number(property.price).toLocaleString()}/mo` : 'Price N/A'}
              {property.is_price_drop && property.price_previous && (
                <span className="price-was">was ${Number(property.price_previous).toLocaleString()}</span>
              )}
            </div>
            <div className="detail-score-badge" style={{ backgroundColor: scoreInfo.color }}>
              <span className="score-num">{safeScore}</span>
              <span className="score-lbl">{scoreInfo.label}</span>
            </div>
          </div>

          {/* Beds / Baths / Sqft */}
          <div className="detail-stats-row">
            {property.bedrooms && <span><strong>{property.bedrooms}</strong> bed</span>}
            {property.bathrooms && <span><strong>{property.bathrooms}</strong> bath</span>}
            {property.sqft && <span><strong>{Number(property.sqft).toLocaleString()}</strong> sqft</span>}
            {property.lot_size_acres && <span><strong>{Number(property.lot_size_acres).toFixed(2)}</strong> acres</span>}
          </div>

          {/* Address */}
          <div className="detail-address-block">
            <h2 className="detail-address-main">{property.address}</h2>
            {property.neighborhood && (
              <p className="detail-neighborhood">{property.neighborhood}</p>
            )}
          </div>

          {/* Tag chips */}
          {tags.length > 0 && (
            <div className="detail-tags">
              {tags.map((tag, i) => (
                <span key={i} className="detail-tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Meta row — type / posted / available */}
          <div className="detail-meta-row">
            <div className="meta-cell">
              <span className="meta-icon">🏠</span>
              <span className="meta-val">{PROPERTY_TYPES[property.property_type] || property.property_type || 'Unknown'}</span>
              <span className="meta-key">Property type</span>
            </div>
            {property.date_posted && (
              <div className="meta-cell">
                <span className="meta-icon">📅</span>
                <span className="meta-val">{new Date(property.date_posted).toLocaleDateString()}</span>
                <span className="meta-key">Listed</span>
              </div>
            )}
            {property.availability_date && (
              <div className="meta-cell">
                <span className="meta-icon">🗓</span>
                <span className="meta-val">{new Date(property.availability_date).toLocaleDateString()}</span>
                <span className="meta-key">Available</span>
              </div>
            )}
          </div>

          <div className="detail-divider" />

          {/* Pets / Backyard / Garage highlights */}
          <div className="detail-highlights">
            <div className={`highlight-item ${property.dogs_allowed ? 'yes' : property.dogs_policy === 'not_allowed' ? 'no' : 'unknown'}`}>
              <span className="hi-icon">🐕</span>
              <div>
                <span className="hi-label">{DOG_POLICIES[property.dogs_policy] || 'Dog policy unknown'}</span>
                {property.dogs_allowed && <span className="hi-sub">Pets ok</span>}
              </div>
            </div>
            <div className={`highlight-item ${property.has_backyard === true ? 'yes' : property.has_backyard === false ? 'no' : 'unknown'}`}>
              <span className="hi-icon">🌿</span>
              <div>
                <span className="hi-label">
                  {property.has_backyard === true ? 'Has backyard' : property.has_backyard === false ? 'No backyard' : 'Backyard unknown'}
                </span>
                {property.lot_size_acres && <span className="hi-sub">{Number(property.lot_size_acres).toFixed(2)} acres lot</span>}
              </div>
            </div>
            <div className={`highlight-item ${property.has_garage === true ? 'yes' : property.has_garage === false ? 'no' : 'unknown'}`}>
              <span className="hi-icon">🚗</span>
              <div>
                <span className="hi-label">
                  {property.has_garage
                    ? `${property.garage_spaces ? property.garage_spaces + '-car ' : ''}Garage`
                    : property.has_garage === false ? 'No garage' : 'Garage unknown'}
                </span>
              </div>
            </div>
          </div>

          <div className="detail-divider" />

          {/* Description */}
          {descText && (
            <div className="detail-section">
              <h3>Property details and fees</h3>
              <p className="detail-desc-text">
                {displayDesc}{descShort && !descExpanded ? '…' : ''}
              </p>
              {descShort && (
                <button className="read-more-btn" onClick={() => setDescExpanded(!descExpanded)}>
                  {descExpanded ? 'Read less ↑' : 'Read more ↓'}
                </button>
              )}
            </div>
          )}

          {/* Property Details grid */}
          <div className="detail-section">
            <h3>Features</h3>
            <div className="detail-info-grid">
              {property.bedrooms && <div className="info-row"><span className="info-label">Bedrooms</span><span className="info-value">{property.bedrooms}</span></div>}
              {property.bathrooms && <div className="info-row"><span className="info-label">Bathrooms</span><span className="info-value">{property.bathrooms}</span></div>}
              {property.sqft && <div className="info-row"><span className="info-label">Square Feet</span><span className="info-value">{Number(property.sqft).toLocaleString()} sqft</span></div>}
              {property.year_built && <div className="info-row"><span className="info-label">Year Built</span><span className="info-value">{property.year_built}</span></div>}
              {property.lot_size_acres && <div className="info-row"><span className="info-label">Lot Size</span><span className="info-value">{Number(property.lot_size_acres).toFixed(3)} acres</span></div>}
              {property.garage_spaces && <div className="info-row"><span className="info-label">Garage</span><span className="info-value">{property.garage_spaces}-car garage</span></div>}
              {property.zip && <div className="info-row"><span className="info-label">ZIP Code</span><span className="info-value">{property.zip}</span></div>}
              {property.neighborhood && <div className="info-row"><span className="info-label">Neighborhood</span><span className="info-value">{property.neighborhood}</span></div>}
            </div>
          </div>

          {/* Match Score Breakdown */}
          {Object.keys(breakdown).length > 0 && (
            <div className="detail-section">
              <h3>Match Score Breakdown</h3>
              <div className="score-breakdown">
                {Object.entries(breakdown).map(([key, item]) => (
                  <div key={key} className="breakdown-item">
                    <div className="breakdown-label">{item.label}</div>
                    <div className="breakdown-bar-container">
                      <div className="breakdown-bar" style={{ width: `${(item.score / item.max) * 100}%` }} />
                    </div>
                    <div className="breakdown-score">{item.score}/{item.max}</div>
                  </div>
                ))}
              </div>
              {property.inferred_fields?.length > 0 && (
                <p className="inferred-notice">
                  * Some scores estimated: {property.inferred_fields.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="detail-section">
            <h3>Your Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesChanged(true); }}
              placeholder="Add your notes about this property..."
              className="notes-textarea"
              rows={4}
            />
            {notesChanged && (
              <button className="btn-primary btn-sm" onClick={saveNotes} style={{ marginTop: '0.5rem' }}>
                Save Notes
              </button>
            )}
          </div>

          {/* Source */}
          <div className="detail-section detail-meta-footer">
            <span>Source: <strong style={{ color: source.color }}>{source.name}</strong></span>
            {property.date_posted && (
              <span>Posted: {new Date(property.date_posted).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="detail-footer-v2">
          <button className={`btn-action ${isFavorite ? 'active' : ''}`} onClick={onToggleFavorite}>
            {isFavorite ? '❤️ Favorited' : '🤍 Favorite'}
          </button>
          <button className="btn-action" onClick={onToggleHidden}>🙈 Hide</button>
          {property.source_url && (
            <a href={property.source_url} target="_blank" rel="noopener noreferrer" className="btn-primary">
              View on {source.name} →
            </a>
          )}
        </div>

        {/* ── Lightbox ── */}
        {lightboxIndex !== null && (
          <div className="lightbox-overlay" onClick={() => setLightboxIndex(null)}>
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setLightboxIndex(null)}>✕</button>
              <button
                className="lightbox-prev"
                onClick={() => setLightboxIndex((lightboxIndex - 1 + images.length) % images.length)}
                disabled={images.length <= 1}
              >‹</button>
              <img src={images[lightboxIndex]?.url} alt={`Photo ${lightboxIndex + 1}`} className="lightbox-img" />
              <button
                className="lightbox-next"
                onClick={() => setLightboxIndex((lightboxIndex + 1) % images.length)}
                disabled={images.length <= 1}
              >›</button>
              <div className="lightbox-counter">{lightboxIndex + 1} / {images.length}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
