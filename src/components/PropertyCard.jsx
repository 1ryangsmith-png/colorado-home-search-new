import ImageCarousel from './ImageCarousel';
import { getScoreColor, SOURCES } from '../lib/constants';

export default function PropertyCard({
  property,
  userProperty,
  onSelect,
  onToggleFavorite,
  onToggleHidden,
  viewMode = 'grid',
}) {
  const scoreInfo = getScoreColor(property.match_score || 0);
  const source = SOURCES[property.source] || SOURCES.manual;
  const isFavorite = userProperty?.is_favorite;
  const isHidden = userProperty?.is_hidden;

  const formatPrice = (price) => {
    if (!price) return 'Price N/A';
    return `$${Number(price).toLocaleString()}/mo`;
  };

  const images = Array.isArray(property.images)
    ? property.images
    : typeof property.images === 'string'
    ? JSON.parse(property.images || '[]')
    : [];

  if (viewMode === 'list') {
    return (
      <div
        className={`property-card list-view ${property._excluded ? 'excluded' : ''}`}
        onClick={() => onSelect(property)}
      >
        <div className="list-image">
          <img
            src={images[0]?.url || property.thumbnail_url || ''}
            alt={property.address}
            loading="lazy"
            onError={(e) => { e.target.src = ''; e.target.classList.add('img-error'); }}
          />
        </div>
        <div className="list-details">
          <div className="list-price">{formatPrice(property.price)}</div>
          <div className="list-address">{property.address}</div>
          <div className="list-city">{property.city}, {property.state}</div>
          <div className="list-meta">
            {property.bedrooms && <span>{property.bedrooms} bd</span>}
            {property.bathrooms && <span>{property.bathrooms} ba</span>}
            {property.sqft && <span>{property.sqft.toLocaleString()} sqft</span>}
            {property.lot_size_acres && <span>{property.lot_size_acres} ac</span>}
          </div>
        </div>
        <div className="list-actions">
          <div className="score-badge" style={{ backgroundColor: scoreInfo.color }}>
            {property.match_score}
          </div>
          <button
            className={`btn-icon-sm ${isFavorite ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(property.id); }}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
        </div>
      </div>
    );
  }

  // Grid view (default)
  return (
    <div
      className={`property-card grid-view ${property._excluded ? 'excluded' : ''}`}
      onClick={() => onSelect(property)}
    >
      {/* Image */}
      <div className="card-image">
        <ImageCarousel
          images={images}
          thumbnail={property.thumbnail_url}
          alt={property.address}
        />

        {/* Badges */}
        <div className="card-badges">
          <div className="score-badge" style={{ backgroundColor: scoreInfo.color }}>
            {property.match_score}
          </div>
          {property.is_price_drop && (
            <div className="badge price-drop-badge">Price Drop</div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card-quick-actions">
          <button
            className={`btn-icon-sm ${isFavorite ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(property.id); }}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
          <button
            className="btn-icon-sm"
            onClick={(e) => { e.stopPropagation(); onToggleHidden(property.id); }}
            title={isHidden ? 'Unhide' : 'Hide listing'}
          >
            {isHidden ? '👁️' : '🙈'}
          </button>
        </div>

        {/* Source badge */}
        <div className="source-badge" style={{ backgroundColor: source.color }}>
          {source.name}
        </div>
      </div>

      {/* Content */}
      <div className="card-content">
        <div className="card-price">{formatPrice(property.price)}</div>

        <div className="card-meta">
          {property.bedrooms && <span className="meta-item">{property.bedrooms} bd</span>}
          {property.bathrooms && <span className="meta-item">{property.bathrooms} ba</span>}
          {property.sqft && <span className="meta-item">{property.sqft.toLocaleString()} sqft</span>}
          {property.lot_size_acres && (
            <span className="meta-item">{Number(property.lot_size_acres).toFixed(2)} ac</span>
          )}
        </div>

        <div className="card-address">
          <span className="address-line">{property.address}</span>
          <span className="city-line">{property.city}, {property.state} {property.zip || ''}</span>
        </div>

        {/* Feature indicators */}
        <div className="card-features">
          {property.dogs_allowed && <span className="feature-tag good" title="Dogs allowed">🐕 Dogs OK</span>}
          {property.dogs_policy === 'unknown' && <span className="feature-tag unknown" title="Dog policy unknown">🐕 ?</span>}
          {property.has_backyard && <span className="feature-tag good" title="Has backyard">🌿 Yard</span>}
          {property.has_backyard == null && <span className="feature-tag unknown" title="Backyard unknown">🌿 ?</span>}
          {property.has_garage && (
            <span className="feature-tag good" title={`${property.garage_spaces || ''}${property.garage_spaces ? '-car ' : ''}Garage`}>
              🚗 Garage{property.garage_spaces ? ` (${property.garage_spaces})` : ''}
            </span>
          )}
          {property.has_garage == null && <span className="feature-tag unknown" title="Garage unknown">🚗 ?</span>}
          {property.property_type === 'single_family' && (
            <span className="feature-tag good" title="Single family home">🏠 SFH</span>
          )}
        </div>

        {/* Description snippet */}
        {property.description && (
          <div className="card-description">
            {property.description.length > 100
              ? property.description.slice(0, 100) + '…'
              : property.description}
          </div>
        )}

        {/* Inferred data notice */}
        {property.inferred_fields?.length > 0 && (
          <div className="card-inferred" title={`Estimated: ${property.inferred_fields.join(', ')}`}>
            Some data estimated
          </div>
        )}

        {/* Notes indicator */}
        {userProperty?.notes && (
          <div className="card-notes-indicator" title={userProperty.notes}>
            📝 Has notes
          </div>
        )}
      </div>
    </div>
  );
}
