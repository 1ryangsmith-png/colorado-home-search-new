import { useState } from 'react';
import ImageCarousel from './ImageCarousel';
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
  const [activeImageTab, setActiveImageTab] = useState('gallery');

  const safeScore = isNaN(property.match_score) ? 0 : (property.match_score || 0);
  const scoreInfo = getScoreColor(safeScore);
  const source = SOURCES[property.source] || SOURCES.manual;
  const isFavorite = userProperty?.is_favorite;

  const images = Array.isArray(property.images)
    ? property.images
    : typeof property.images === 'string'
    ? JSON.parse(property.images || '[]')
    : [];

  const breakdown = property.score_breakdown || {};

  const saveNotes = () => {
    onUpdateNotes(notes);
    setNotesChanged(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content property-detail" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="detail-header">
          <div className="detail-header-left">
            <h2>{property.address}</h2>
            <p className="detail-city">
              {property.city}, {property.state} {property.zip || ''}
              {property.neighborhood && ` · ${property.neighborhood}`}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="detail-body">
          {/* Image Gallery */}
          <div className="detail-gallery">
            {images.length > 0 ? (
              <div className="gallery-grid">
                {images.slice(0, 12).map((img, i) => (
                  <div key={i} className={`gallery-item ${i === 0 ? 'gallery-hero' : ''}`}>
                    <img
                      src={img.url}
                      alt={`${property.address} - Photo ${i + 1}`}
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="gallery-placeholder">
                <p>No photos available</p>
                {property.source_url && (
                  <a href={property.source_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                    View on {source.name}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Price and Score */}
          <div className="detail-price-row">
            <div className="detail-price">
              {property.price ? `$${Number(property.price).toLocaleString()}/mo` : 'Price N/A'}
              {property.is_price_drop && property.price_previous && (
                <span className="price-drop-info">
                  was ${Number(property.price_previous).toLocaleString()}
                </span>
              )}
            </div>
            <div className="detail-score" style={{ backgroundColor: scoreInfo.color }}>
              <span className="score-number">{safeScore}</span>
              <span className="score-label">{scoreInfo.label}</span>
            </div>
          </div>

          {/* Key Stats */}
          <div className="detail-stats">
            {property.bedrooms && (
              <div className="stat">
                <span className="stat-value">{property.bedrooms}</span>
                <span className="stat-label">Bedrooms</span>
              </div>
            )}
            {property.bathrooms && (
              <div className="stat">
                <span className="stat-value">{property.bathrooms}</span>
                <span className="stat-label">Bathrooms</span>
              </div>
            )}
            {property.sqft && (
              <div className="stat">
                <span className="stat-value">{property.sqft.toLocaleString()}</span>
                <span className="stat-label">Sq Ft</span>
              </div>
            )}
            {property.lot_size_acres && (
              <div className="stat">
                <span className="stat-value">{Number(property.lot_size_acres).toFixed(2)}</span>
                <span className="stat-label">Acres</span>
              </div>
            )}
            {property.year_built && (
              <div className="stat">
                <span className="stat-value">{property.year_built}</span>
                <span className="stat-label">Built</span>
              </div>
            )}
          </div>

          {/* Key Features */}
          <div className="detail-section">
            <h3>Key Features</h3>
            <div className="detail-features">
              <div className={`feature-item ${property.dogs_allowed ? 'yes' : property.dogs_policy === 'not_allowed' ? 'no' : 'unknown'}`}>
                <span className="feature-icon">🐕</span>
                <span className="feature-text">
                  {DOG_POLICIES[property.dogs_policy] || 'Dog policy unknown'}
                </span>
              </div>
              <div className={`feature-item ${property.has_backyard === true ? 'yes' : property.has_backyard === false ? 'no' : 'unknown'}`}>
                <span className="feature-icon">🌿</span>
                <span className="feature-text">
                  {property.has_backyard === true ? 'Has backyard' : property.has_backyard === false ? 'No backyard' : 'Backyard unknown'}
                  {property.backyard_details && ` — ${property.backyard_details}`}
                </span>
              </div>
              <div className={`feature-item ${property.has_garage === true ? 'yes' : property.has_garage === false ? 'no' : 'unknown'}`}>
                <span className="feature-icon">🚗</span>
                <span className="feature-text">
                  {property.has_garage
                    ? `${property.garage_spaces || ''} ${property.garage_spaces ? 'car ' : ''}Garage`
                    : property.has_garage === false
                    ? 'No garage'
                    : 'Garage unknown'}
                </span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🏠</span>
                <span className="feature-text">
                  {PROPERTY_TYPES[property.property_type] || 'Property type unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div className="detail-section">
              <h3>Description</h3>
              <p className="detail-description">{property.description}</p>
            </div>
          )}

          {/* Additional Details */}
          <div className="detail-section">
            <h3>Property Details</h3>
            <div className="detail-info-grid">
              {property.property_type && (
                <div className="info-row">
                  <span className="info-label">Type</span>
                  <span className="info-value">{PROPERTY_TYPES[property.property_type] || property.property_type}</span>
                </div>
              )}
              {property.year_built && (
                <div className="info-row">
                  <span className="info-label">Year Built</span>
                  <span className="info-value">{property.year_built}</span>
                </div>
              )}
              {property.sqft && (
                <div className="info-row">
                  <span className="info-label">Square Feet</span>
                  <span className="info-value">{Number(property.sqft).toLocaleString()} sqft</span>
                </div>
              )}
              {property.lot_size_acres && (
                <div className="info-row">
                  <span className="info-label">Lot Size</span>
                  <span className="info-value">{Number(property.lot_size_acres).toFixed(3)} acres ({property.lot_size_sqft ? Number(property.lot_size_sqft).toLocaleString() + ' sqft' : ''})</span>
                </div>
              )}
              {property.garage_spaces && (
                <div className="info-row">
                  <span className="info-label">Garage</span>
                  <span className="info-value">{property.garage_spaces}-car garage</span>
                </div>
              )}
              {property.zip && (
                <div className="info-row">
                  <span className="info-label">ZIP Code</span>
                  <span className="info-value">{property.zip}</span>
                </div>
              )}
              {property.neighborhood && (
                <div className="info-row">
                  <span className="info-label">Neighborhood</span>
                  <span className="info-value">{property.neighborhood}</span>
                </div>
              )}
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="detail-section">
            <h3>Match Score Breakdown</h3>
            <div className="score-breakdown">
              {Object.entries(breakdown).map(([key, item]) => (
                <div key={key} className="breakdown-item">
                  <div className="breakdown-label">{item.label}</div>
                  <div className="breakdown-bar-container">
                    <div
                      className="breakdown-bar"
                      style={{ width: `${(item.score / item.max) * 100}%` }}
                    />
                  </div>
                  <div className="breakdown-score">
                    {item.score}/{item.max}
                  </div>
                </div>
              ))}
            </div>
            {property.inferred_fields?.length > 0 && (
              <p className="inferred-notice">
                * Some scores are estimated because data was not confirmed in the listing:
                {' '}{property.inferred_fields.join(', ')}
              </p>
            )}
          </div>

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
              <button className="btn-primary btn-sm" onClick={saveNotes}>
                Save Notes
              </button>
            )}
          </div>

          {/* Listing Info */}
          <div className="detail-section detail-meta">
            <div className="meta-row">
              <span className="meta-label">Source</span>
              <span className="meta-value" style={{ color: source.color }}>{source.name}</span>
            </div>
            {property.date_posted && (
              <div className="meta-row">
                <span className="meta-label">Posted</span>
                <span className="meta-value">{new Date(property.date_posted).toLocaleDateString()}</span>
              </div>
            )}
            {property.availability_date && (
              <div className="meta-row">
                <span className="meta-label">Available</span>
                <span className="meta-value">{new Date(property.availability_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="detail-footer">
          <button
            className={`btn-action ${isFavorite ? 'active' : ''}`}
            onClick={onToggleFavorite}
          >
            {isFavorite ? '❤️ Favorited' : '🤍 Favorite'}
          </button>
          <button className="btn-action" onClick={onToggleHidden}>
            🙈 Hide
          </button>
          {property.source_url && (
            <a
              href={property.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              View on {source.name} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
